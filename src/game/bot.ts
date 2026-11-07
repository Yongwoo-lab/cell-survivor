// 초보 봇: 밸런스 시뮬레이션(scripts/sim.mjs)과 대기 화면 자동 시연에 같이 쓴다.
import type { World, Vec2 } from './world';

export interface BotSkill { react: number; sight: number; wander: number }
const PILL_CHANCE = 0.5; // 항생제를 먹으러 갈 확률 (알약마다 한 번 정함)
export const BOTS: Record<string, BotSkill> = {
  novice: { react: 0.35, sight: 4.5, wander: 0.3 }, // 반응이 느리고 시야가 좁으며 가끔 딴짓
  careful: { react: 0.1, sight: 7, wander: 0 }, // 빠르게 피함
};

export function createBot(skill: BotSkill) {
  let move: Vec2 = { x: 0, y: 0 }, think = 0, wanderDir: Vec2 = { x: 1, y: 0 };
  const wantPill = new Map<string, boolean>();
  return (w: World, dt: number): Vec2 => {
    if ((think -= dt) > 0) return move;
    think = skill.react;
    const e = w.enemies.f, pl = w.player;
    let fx = 0, fy = 0;
    for (let i = 0; i < w.enemies.count; i++) {
      const dx = pl.x - e.x[i], dy = pl.y - e.y[i], d2 = dx * dx + dy * dy;
      if (d2 < skill.sight ** 2 && d2 > 0) { fx += dx / d2; fy += dy / d2; }
    }
    if (Math.random() < skill.wander) {
      if (Math.random() < 0.2) {
        const a = Math.random() * Math.PI * 2;
        wanderDir = { x: Math.cos(a), y: Math.sin(a) };
      }
      move = wanderDir;
    } else if (Math.hypot(fx, fy) > 0.05) move = { x: fx, y: fy };
    else {
      // 위협이 없으면 먹기로 한 항생제 → 가장 가까운 항원 조각 순
      const pf = w.pills.f;
      for (let k = 0; k < w.pills.count; k++) {
        const key = `${pf.x[k]},${pf.y[k]}`;
        if (!wantPill.has(key)) wantPill.set(key, Math.random() < PILL_CHANCE);
        if (wantPill.get(key)) return (move = { x: pf.x[k] - pl.x, y: pf.y[k] - pl.y });
      }
      const df = w.drops.f;
      if (w.drops.count) return (move = { x: df.x[0] - pl.x, y: df.y[0] - pl.y }); // 보급품은 줍는다
      const g = w.gems.f;
      let best = -1, bd = 64;
      for (let i = 0; i < w.gems.count; i++) {
        const d = (g.x[i] - pl.x) ** 2 + (g.y[i] - pl.y) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
      move = best >= 0 ? { x: g.x[best] - pl.x, y: g.y[best] - pl.y } : { x: 0, y: 0 };
    }
    return move;
  };
}
