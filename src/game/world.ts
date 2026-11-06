// 게임 상태. 2D 좌표(x, y)만 쓰고 Three.js를 import하지 않는다.
import enemies from '../data/enemies.json';
import balance from '../data/balance.json';
import { Pool } from './pool';
import { SpatialHash } from './collision';
import { updateSpawner } from './spawner';

export const COCCUS = enemies.find((e) => e.id === 'coccus')!;
const P = balance.player, S = balance.shot, X = balance.xp;
export const MAX_ENEMIES = 1024;
const FLASH_TIME = 0.05;

export interface Vec2 { x: number; y: number }

export function createWorld() {
  return {
    time: 0,
    over: false,
    player: { x: 0, y: 0, hp: P.hp, maxHp: P.hp, invuln: 0, xp: 0, level: 1, xpToNext: X.base },
    enemies: new Pool(MAX_ENEMIES, ['x', 'y', 'hp', 'flash', 'id'] as const),
    shots: new Pool(256, ['x', 'y', 'vx', 'vy', 'life'] as const),
    gems: new Pool(2048, ['x', 'y', 'xp', 'pulled'] as const),
    deaths: [] as Vec2[], // 이번 프레임에 죽은 적 위치 (화면 연출용, 매 프레임 비움)
    hash: new SpatialHash(MAX_ENEMIES),
    spawnAcc: 0,
    fireCd: S.interval,
    nextId: 0,
  };
}
export type World = ReturnType<typeof createWorld>;

export function updateWorld(w: World, dt: number, move: Vec2) {
  w.deaths.length = 0;
  if (w.over) return;
  w.time += dt;
  const pl = w.player;
  const len = Math.hypot(move.x, move.y) || 1;
  pl.x += (move.x / len) * P.speed * dt;
  pl.y += (move.y / len) * P.speed * dt;
  pl.invuln -= dt;

  updateSpawner(w, dt);

  // 적: 플레이어 추적
  const E = w.enemies, e = E.f, er = COCCUS.radius;
  for (let i = 0; i < E.count; i++) {
    const dx = pl.x - e.x[i], dy = pl.y - e.y[i];
    const d = Math.hypot(dx, dy) || 1;
    e.x[i] += (dx / d) * COCCUS.speed * dt;
    e.y[i] += (dy / d) * COCCUS.speed * dt;
    e.flash[i] -= dt;
  }
  w.hash.build(e.x, e.y, E.count);

  // 적끼리 겹치지 않게 밀어냄
  const minD = er * 2;
  for (let i = 0; i < E.count; i++) {
    w.hash.query(e.x[i], e.y[i], minD, (j) => {
      if (j <= i) return;
      const dx = e.x[j] - e.x[i], dy = e.y[j] - e.y[i];
      const d2 = dx * dx + dy * dy;
      if (d2 >= minD * minD || d2 === 0) return;
      const d = Math.sqrt(d2), push = (minD - d) * 0.5 / d;
      e.x[i] -= dx * push; e.y[i] -= dy * push;
      e.x[j] += dx * push; e.y[j] += dy * push;
    });
  }

  // 자동 발사: 사거리 안 가장 가까운 적
  w.fireCd -= dt;
  if (w.fireCd <= 0) {
    let best = -1, bestD = S.range * S.range;
    for (let i = 0; i < E.count; i++) {
      const d = (e.x[i] - pl.x) ** 2 + (e.y[i] - pl.y) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best >= 0) {
      const k = w.shots.add();
      if (k >= 0) {
        const s = w.shots.f, d = Math.sqrt(bestD) || 1;
        s.x[k] = pl.x; s.y[k] = pl.y;
        s.vx[k] = ((e.x[best] - pl.x) / d) * S.speed;
        s.vy[k] = ((e.y[best] - pl.y) / d) * S.speed;
        s.life[k] = S.life;
      }
      w.fireCd = S.interval;
    }
  }

  // 투사체 이동·명중
  const SH = w.shots, s = SH.f, hitR = S.radius + er;
  for (let k = SH.count - 1; k >= 0; k--) {
    s.x[k] += s.vx[k] * dt;
    s.y[k] += s.vy[k] * dt;
    s.life[k] -= dt;
    let hit = false;
    w.hash.query(s.x[k], s.y[k], hitR, (i) => {
      if (e.hp[i] <= 0 || (e.x[i] - s.x[k]) ** 2 + (e.y[i] - s.y[k]) ** 2 > hitR * hitR) return;
      e.hp[i] -= S.damage;
      e.flash[i] = FLASH_TIME;
      return (hit = true);
    });
    if (hit || s.life[k] <= 0) SH.remove(k);
  }

  // 적이 플레이어에 닿으면 피해 (맞은 뒤 잠깐 무적)
  if (pl.invuln <= 0) {
    const r = P.radius + er;
    w.hash.query(pl.x, pl.y, r, (i) => {
      if (e.hp[i] <= 0 || (e.x[i] - pl.x) ** 2 + (e.y[i] - pl.y) ** 2 > r * r) return;
      pl.hp = Math.max(0, pl.hp - COCCUS.damage);
      pl.invuln = P.invulnTime;
      return true;
    });
    if (pl.hp <= 0) w.over = true;
  }

  // 죽은 적 제거 → 항원 조각
  for (let i = E.count - 1; i >= 0; i--) {
    if (e.hp[i] > 0) continue;
    w.deaths.push({ x: e.x[i], y: e.y[i] });
    const g = w.gems.add();
    if (g >= 0) {
      const gf = w.gems.f;
      gf.x[g] = e.x[i]; gf.y[g] = e.y[i]; gf.xp[g] = COCCUS.xp; gf.pulled[g] = 0;
    }
    E.remove(i);
  }

  // 항원 조각: 가까우면 자석처럼 끌려와 흡수
  const G = w.gems, g = G.f;
  for (let i = G.count - 1; i >= 0; i--) {
    const dx = pl.x - g.x[i], dy = pl.y - g.y[i];
    const d = Math.hypot(dx, dy);
    if (d < P.pickupRadius) {
      pl.xp += g.xp[i];
      G.remove(i);
      continue;
    }
    if (d < P.magnetRadius) g.pulled[i] = 1;
    if (g.pulled[i]) {
      const step = Math.min(d, P.magnetSpeed * dt);
      g.x[i] += (dx / d) * step;
      g.y[i] += (dy / d) * step;
    }
  }
  while (pl.xp >= pl.xpToNext) {
    pl.xp -= pl.xpToNext;
    pl.level++;
    pl.xpToNext = Math.round(X.base * X.growth ** (pl.level - 1));
  }
}
