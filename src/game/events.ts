// 흥미 요소: 대량 감염 경보(러시), 정예 적, 정예가 떨어뜨리는 보급품 (수치는 balance.json의 rush·elite·drops)
import balance from '../data/balance.json';
import type { World } from './world';
import { addEnemy, kindOf } from './spawner';
import { damageEnemy } from './cards';

const R = balance.rush, EL = balance.elite, D = balance.drops, B = balance.boss;
const RUSH_KINDS = R.kinds.map(kindOf), ELITE_KINDS = EL.kinds.map(kindOf);
// 보스 경고가 시작되기 전에 끝나는 러시만
const RUSH_UNTIL = B.at - B.warning - R.warning - R.duration;
export const DROP = Object.fromEntries(D.types.map((t, i) => [t, i])) as Record<string, number>;

function rushRing(w: World) {
  const n = R.counts[Math.min(w.rushN - 1, R.counts.length - 1)], kind = RUSH_KINDS[Math.min(w.act, RUSH_KINDS.length - 1)];
  const off = Math.random() * Math.PI * 2;
  for (let k = 0; k < n; k++) {
    if (w.enemies.count >= balance.spawn.maxEnemies) return;
    const a = off + (k / n) * Math.PI * 2 * (1 - R.gap); // 원의 gap만큼은 비워 빠져나갈 틈을 둔다
    const i = addEnemy(w, kind, w.player.x + Math.cos(a) * R.radius, w.player.y + Math.sin(a) * R.radius);
    if (i >= 0) { w.enemies.f.boost[i] = R.speedMul; w.enemies.f.hp[i] *= R.hpMul; }
  }
}

export function dropSupply(w: World, x: number, y: number) {
  const k = w.drops.add();
  if (k < 0) return;
  const f = w.drops.f;
  f.x[k] = x; f.y[k] = y; f.life[k] = D.life;
  f.type[k] = Math.floor(Math.random() * D.types.length);
}

export function updateEvents(w: World, dt: number) {
  const pl = w.player;
  // 러시: 경고 → duration초 동안 rings번 원형 포위
  const next = R.firstAt + w.rushN * R.every;
  if (w.rush <= 0 && next <= RUSH_UNTIL && w.time >= next - R.warning) {
    w.rushWarn = next - w.time;
    if (w.time >= next) {
      w.rushWarn = 0;
      w.rushN++;
      w.rush = R.duration;
      w.rushRings = 0;
      if (w.rushN === 1) w.notes.push('rush');
    }
  }
  if (w.rush > 0) {
    const due = Math.floor(((R.duration - w.rush) / R.duration) * R.rings) + 1;
    while (w.rushRings < Math.min(due, R.rings)) { w.rushRings++; rushRing(w); }
    w.rush -= dt;
  }

  // 정예: every초마다 하나 (보스 전까지)
  if (w.time >= w.nextElite && w.time < B.at) {
    w.nextElite += EL.every;
    const a = Math.random() * Math.PI * 2;
    const kind = ELITE_KINDS[Math.floor(Math.random() * ELITE_KINDS.length)];
    const i = addEnemy(w, kind, pl.x + Math.cos(a) * balance.spawn.distance, pl.y + Math.sin(a) * balance.spawn.distance);
    if (i >= 0) {
      const e = w.enemies.f;
      e.elite[i] = 1;
      e.size[i] = EL.sizeMul;
      e.hp[i] *= EL.hpMul;
      if (!w.notes.includes('elite')) w.notes.push('elite');
    }
  }

  // 보급품: 줍기
  const f = w.drops.f;
  for (let k = w.drops.count - 1; k >= 0; k--) {
    if ((f.life[k] -= dt) <= 0) { w.drops.remove(k); continue; }
    if ((f.x[k] - pl.x) ** 2 + (f.y[k] - pl.y) ** 2 > D.pickupRadius ** 2) continue;
    const type = f.type[k];
    w.pickups.push({ x: f.x[k], y: f.y[k], type });
    w.drops.remove(k);
    const view2 = D.viewRadius ** 2;
    if (type === DROP.heal) pl.hp = Math.min(pl.maxHp, pl.hp + pl.maxHp * D.heal);
    else if (type === DROP.magnet) {
      const g = w.gems.f;
      for (let i = 0; i < w.gems.count; i++) if ((g.x[i] - pl.x) ** 2 + (g.y[i] - pl.y) ** 2 < view2) g.pulled[i] = 1;
    } else {
      const e = w.enemies.f;
      for (let i = 0; i < w.enemies.count; i++)
        if ((e.x[i] - pl.x) ** 2 + (e.y[i] - pl.y) ** 2 < view2) damageEnemy(w, i, D.bombDamage, 'bomb', true);
      w.bursts.push({ x: pl.x, y: pl.y, r: D.viewRadius * 0.6 });
    }
  }
}
