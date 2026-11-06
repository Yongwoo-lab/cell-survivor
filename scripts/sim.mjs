// 밸런스 봇: 카드를 무작위로 고르며 N판을 돌려 생존 시간·레벨을 낸다.
// 실행: npm run sim [-- 판수]
import { createServer } from 'vite';

const RUNS = Number(process.argv[2] ?? 40);
const GOAL = 150; // 보스 등장 2:30
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { createWorld, updateWorld } = await vite.ssrLoadModule('/src/game/world.ts');
const { selectCard } = await vite.ssrLoadModule('/src/game/cards.ts');

// novice: 반응이 느리고 시야가 좁으며 가끔 딴짓. careful: 빠르게 피함.
const BOTS = {
  novice: { react: 0.35, sight: 4.5, wander: 0.3 },
  careful: { react: 0.1, sight: 7, wander: 0 },
};

function play(bot) {
  const w = createWorld();
  let move = { x: 0, y: 0 }, think = 0, wanderDir = { x: 1, y: 0 };
  const dt = 1 / 60;
  while (!w.over && w.time < GOAL) {
    if (w.choosing) selectCard(w, Math.floor(Math.random() * w.choosing.length));
    if ((think -= dt) <= 0) {
      think = bot.react;
      const e = w.enemies.f, pl = w.player;
      let fx = 0, fy = 0;
      for (let i = 0; i < w.enemies.count; i++) {
        const dx = pl.x - e.x[i], dy = pl.y - e.y[i], d2 = dx * dx + dy * dy;
        if (d2 < bot.sight ** 2 && d2 > 0) { fx += dx / d2; fy += dy / d2; }
      }
      if (Math.random() < bot.wander) {
        if (Math.random() < 0.2) { const a = Math.random() * 6.28; wanderDir = { x: Math.cos(a), y: Math.sin(a) }; }
        move = wanderDir;
      } else if (Math.hypot(fx, fy) > 0.05) move = { x: fx, y: fy };
      else {
        // 위협이 없으면 가장 가까운 항원 조각으로
        const g = w.gems.f;
        let best = -1, bd = 64;
        for (let i = 0; i < w.gems.count; i++) {
          const d = (g.x[i] - pl.x) ** 2 + (g.y[i] - pl.y) ** 2;
          if (d < bd) { bd = d; best = i; }
        }
        move = best >= 0 ? { x: g.x[best] - pl.x, y: g.y[best] - pl.y } : { x: 0, y: 0 };
      }
    }
    updateWorld(w, dt, move);
  }
  return { time: w.time, level: w.player.level, survived: !w.over, hp: w.player.hp, enemies: w.enemies.count };
}

for (const [name, bot] of Object.entries(BOTS)) {
  const rs = Array.from({ length: RUNS }, () => play(bot));
  const avg = (f) => (rs.reduce((a, r) => a + f(r), 0) / rs.length).toFixed(1);
  const deaths = rs.filter((r) => !r.survived).map((r) => r.time.toFixed(0)).sort((a, b) => a - b);
  console.log(`${name.padEnd(8)} survive ${rs.filter((r) => r.survived).length}/${RUNS}  avgTime ${avg((r) => r.time)}s  avgLv ${avg((r) => r.level)}  avgHpLeft ${avg((r) => r.hp)}  enemiesAt150 ${avg((r) => r.enemies)}  deaths@ [${deaths.join(' ')}]`);
}
await vite.close();
