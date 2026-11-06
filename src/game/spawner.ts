import balance from '../data/balance.json';
import enemies from '../data/enemies.json';
import type { World } from './world';

const S = balance.spawn;
const COCCUS = enemies.findIndex((e) => e.id === 'coccus');

// 시간이 갈수록 초당 등장 수가 늘어난다. 화면 밖 원둘레에서 등장.
export function updateSpawner(w: World, dt: number) {
  w.spawnAcc += (S.startPerSec + S.growthPerSec * w.time) * dt;
  while (w.spawnAcc >= 1) {
    w.spawnAcc--;
    if (w.enemies.count >= S.maxEnemies) continue;
    const i = w.enemies.add();
    if (i < 0) continue;
    const a = Math.random() * Math.PI * 2;
    const e = w.enemies.f;
    e.x[i] = w.player.x + Math.cos(a) * S.distance;
    e.y[i] = w.player.y + Math.sin(a) * S.distance;
    e.kind[i] = COCCUS;
    e.hp[i] = enemies[COCCUS].hp;
    e.flash[i] = e.mark[i] = e.macroCd[i] = 0;
    e.id[i] = w.nextId++;
  }
}
