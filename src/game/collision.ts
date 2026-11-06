// 격자 분할(공간 해시). 버킷 연결 리스트라 매 프레임 할당이 없다.
const TABLE = 4096; // 2의 거듭제곱

export class SpatialHash {
  private head = new Int32Array(TABLE);
  private next: Int32Array;
  private cell: number;
  constructor(capacity: number, cell = 2) {
    this.cell = cell;
    this.next = new Int32Array(capacity);
  }

  private key(cx: number, cy: number) {
    return (Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663)) & (TABLE - 1);
  }

  build(xs: Float32Array, ys: Float32Array, n: number) {
    this.head.fill(-1);
    for (let i = 0; i < n; i++) {
      const k = this.key(Math.floor(xs[i] / this.cell), Math.floor(ys[i] / this.cell));
      this.next[i] = this.head[k];
      this.head[k] = i;
    }
  }

  // (x, y) 반경 r 안에 있을 수 있는 후보를 fn에 넘긴다. fn이 true를 돌려주면 중단.
  // 버킷 충돌로 먼 후보나 중복이 섞일 수 있으니 호출 쪽에서 거리를 직접 확인한다.
  query(x: number, y: number, r: number, fn: (i: number) => boolean | void) {
    const c = this.cell;
    const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
    const y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
    for (let cx = x0; cx <= x1; cx++)
      for (let cy = y0; cy <= y1; cy++)
        for (let i = this.head[this.key(cx, cy)]; i !== -1; i = this.next[i]) if (fn(i) === true) return;
  }
}
