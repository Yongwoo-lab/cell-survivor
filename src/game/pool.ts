// 같은 종류 개체를 Float32Array 묶음(SoA)으로 관리. 삭제는 마지막 원소와 교체.
export class Pool<K extends string> {
  count = 0;
  readonly f: Record<K, Float32Array>;
  readonly capacity: number;
  constructor(capacity: number, keys: readonly K[]) {
    this.capacity = capacity;
    this.f = Object.fromEntries(keys.map((k) => [k, new Float32Array(capacity)])) as Record<K, Float32Array>;
  }
  add() {
    return this.count < this.capacity ? this.count++ : -1;
  }
  remove(i: number) {
    const last = --this.count;
    for (const a of Object.values<Float32Array>(this.f)) a[i] = a[last];
  }
}
