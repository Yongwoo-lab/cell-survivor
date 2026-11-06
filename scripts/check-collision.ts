// 공간 해시 자체 점검: 무작위 점에서 브루트포스와 결과가 같은지. 실행: node scripts/check-collision.ts
import { SpatialHash } from '../src/game/collision.ts';
const n = 800, xs = new Float32Array(n), ys = new Float32Array(n);
for (let i = 0; i < n; i++) { xs[i] = (Math.random() - 0.5) * 100; ys[i] = (Math.random() - 0.5) * 100; }
const h = new SpatialHash(n);
h.build(xs, ys, n);
for (let q = 0; q < 200; q++) {
  const x = (Math.random() - 0.5) * 100, y = (Math.random() - 0.5) * 100, r = Math.random() * 5;
  const got = new Set<number>();
  h.query(x, y, r, (i) => { if ((xs[i] - x) ** 2 + (ys[i] - y) ** 2 <= r * r) got.add(i); });
  for (let i = 0; i < n; i++) {
    const inside = (xs[i] - x) ** 2 + (ys[i] - y) ** 2 <= r * r;
    if (inside !== got.has(i)) throw new Error(`mismatch at query ${q}, point ${i}`);
  }
}
console.log('collision ok');
