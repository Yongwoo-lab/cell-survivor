// 게임 상태. 2D 좌표(x, y)만 쓰고 Three.js를 import하지 않는다.
import enemies from '../data/enemies.json';

const coccus = enemies.find((e) => e.id === 'coccus')!;
const ARENA = 30; // 반경
const PLAYER_SPEED = 6;

export interface Vec2 { x: number; y: number }

export interface World {
  player: Vec2;
  cocci: { x: Float32Array; y: Float32Array; vx: Float32Array; vy: Float32Array; count: number; radius: number };
}

export function createWorld(): World {
  const n = coccus.spawnCount;
  const c = { x: new Float32Array(n), y: new Float32Array(n), vx: new Float32Array(n), vy: new Float32Array(n), count: n, radius: coccus.radius };
  for (let i = 0; i < n; i++) {
    c.x[i] = (Math.random() * 2 - 1) * ARENA;
    c.y[i] = (Math.random() * 2 - 1) * ARENA;
    const a = Math.random() * Math.PI * 2;
    c.vx[i] = Math.cos(a) * coccus.speed;
    c.vy[i] = Math.sin(a) * coccus.speed;
  }
  return { player: { x: 0, y: 0 }, cocci: c };
}

export function updateWorld(w: World, dt: number, move: Vec2) {
  const len = Math.hypot(move.x, move.y) || 1;
  w.player.x += (move.x / len) * PLAYER_SPEED * dt;
  w.player.y += (move.y / len) * PLAYER_SPEED * dt;

  const c = w.cocci;
  for (let i = 0; i < c.count; i++) {
    // 천천히 방향이 바뀌며 떠다님
    const turn = (Math.random() - 0.5) * 2 * dt;
    const cs = Math.cos(turn), sn = Math.sin(turn);
    const vx = c.vx[i] * cs - c.vy[i] * sn;
    c.vy[i] = c.vx[i] * sn + c.vy[i] * cs;
    c.vx[i] = vx;
    c.x[i] += c.vx[i] * dt;
    c.y[i] += c.vy[i] * dt;
    if (Math.abs(c.x[i]) > ARENA) c.vx[i] = -Math.sign(c.x[i]) * Math.abs(c.vx[i]);
    if (Math.abs(c.y[i]) > ARENA) c.vy[i] = -Math.sign(c.y[i]) * Math.abs(c.vy[i]);
  }
}
