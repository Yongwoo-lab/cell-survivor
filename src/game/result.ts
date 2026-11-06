// 고른 카드의 분야 태그 누적 → 끝나면 가장 많이 고른 분야로 결과 카드
export type FieldCounts = Record<string, number>;

export function addPick(r: FieldCounts, field: string) {
  r[field] = (r[field] ?? 0) + 1;
}

export function topField(r: FieldCounts): string | undefined {
  let best: string | undefined;
  for (const f in r) if (best === undefined || r[f] > r[best]) best = f;
  return best;
}
