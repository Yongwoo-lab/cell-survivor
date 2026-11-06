import balance from '../data/balance.json';
import type { World } from './world';

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

// 랭킹 점수: 처치 수 + 생존 초 + 보스 처치 보너스
export function score(w: World) {
  const S = balance.score;
  const kills = w.kills.reduce((a, b) => a + b, 0);
  return Math.round(kills * S.perKill + Math.floor(w.time) * S.perSecond + (w.won ? S.bossBonus : 0));
}
