// 시간별 적 등장 (balance.json의 spawn.timeline), 정상 세포 배치, 보스 등장
import balance from '../data/balance.json';
import enemies from '../data/enemies.json';
import type { World } from './world';

const S = balance.spawn, C = balance.cells, B = balance.boss, A = balance.antibiotic;
export const kindOf = (id: string) => enemies.findIndex((e) => e.id === id);
const TIMELINE = S.timeline.map((t) => ({ ...t, k: kindOf(t.kind) }));
export const BOSS = kindOf(B.id);
const CELLS_FROM = balance.acts.findIndex((a) => a.id === C.fromAct);

export function addEnemy(w: World, kind: number, x: number, y: number) {
  const i = w.enemies.add();
  if (i < 0) return -1;
  const e = w.enemies.f, def = enemies[kind];
  e.x[i] = x; e.y[i] = y;
  e.kind[i] = kind;
  e.hp[i] = def.hp;
  e.flash[i] = e.mark[i] = e.macroCd[i] = e.silent[i] = 0;
  e.spawnCd[i] = def.spawnVirusEvery ?? 0;
  e.id[i] = w.nextId++;
  if (!w.seen.includes(kind)) w.seen.push(kind);
  return i;
}

function ring(w: World, min: number, max: number) {
  const a = Math.random() * Math.PI * 2, r = min + Math.random() * (max - min);
  return { x: w.player.x + Math.cos(a) * r, y: w.player.y + Math.sin(a) * r };
}

export function updateSpawner(w: World, dt: number) {
  for (const t of TIMELINE) {
    if (w.time < t.from || w.time >= t.to) continue;
    w.spawnAcc[t.k] += (t.startPerSec + t.growthPerSec * (w.time - t.from)) * dt;
    while (w.spawnAcc[t.k] >= 1) {
      w.spawnAcc[t.k]--;
      if (w.enemies.count >= S.maxEnemies) continue;
      const p = ring(w, S.distance, S.distance);
      addEnemy(w, t.k, p.x, p.y);
    }
  }

  // 정상 세포: 2막부터 맵 곳곳에. 멀어지면 화면 밖 다른 자리로 옮겨 밀도를 유지.
  if (w.act >= CELLS_FROM) {
    const c = w.cells, f = c.f;
    const first = c.count === 0 && !w.cellsPlaced;
    while (c.count < C.count) {
      const k = c.add();
      const p = first ? ring(w, C.spawnMin, C.spawnMax) : ring(w, C.refillMin, C.refillMax);
      f.x[k] = p.x; f.y[k] = p.y;
    }
    w.cellsPlaced = true;
    for (let k = 0; k < c.count; k++) {
      if ((f.x[k] - w.player.x) ** 2 + (f.y[k] - w.player.y) ** 2 < C.despawn ** 2) continue;
      const p = ring(w, C.refillMin, C.refillMax);
      f.x[k] = p.x; f.y[k] = p.y;
    }
  }

  // 항생제 알약: firstAt부터 every초마다, life초 뒤 사라짐
  if (w.time >= w.nextPill) {
    w.nextPill += A.every;
    const k = w.pills.add();
    if (k >= 0) {
      const p = ring(w, A.spawnMin, A.spawnMax);
      w.pills.f.x[k] = p.x; w.pills.f.y[k] = p.y; w.pills.f.life[k] = A.life;
      if (w.nextPill - A.every === A.firstAt) w.notes.push('antibioticSpawn');
    }
  }

  // 보스: 경고 후 등장
  if (!w.boss.spawned && w.time >= B.at - B.warning) {
    w.bossWarn = B.at - w.time;
    if (w.time >= B.at) {
      // maxEnemies와 상관없이 등장 (풀에 여유가 있다). 실패하면 다음 프레임에 다시.
      const p = ring(w, B.spawnDistance, B.spawnDistance);
      const i = addEnemy(w, BOSS, p.x, p.y);
      if (i < 0) return;
      w.boss.spawned = true;
      // 먹은 항생제마다 체력 +bossHpPerUse
      w.boss.maxHp = w.enemies.f.hp[i] = enemies[BOSS].hp * (1 + w.antibioticUses * A.bossHpPerUse);
      w.bossWarn = 0;
    }
  }
}
