// 밸런스 봇: 카드를 무작위로 고르며 N판을 돌려 생존·보스 처치·보스전 길이를 낸다.
// 실행: npm run sim [-- 판수 [봇이름]]
import { createServer } from 'vite';

const RUNS = Number(process.argv[2] ?? 40);
const LIMIT = 360; // 보스를 못 잡으면 6분에서 끊는다
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { createWorld, updateWorld } = await vite.ssrLoadModule('/src/game/world.ts');
const { selectCard } = await vite.ssrLoadModule('/src/game/cards.ts');
const { BOTS, createBot } = await vite.ssrLoadModule('/src/game/bot.ts');
const balance = (await vite.ssrLoadModule('/src/data/balance.json')).default;
const BOSS_AT = balance.boss.at;

function play(skill) {
  const w = createWorld(), bot = createBot(skill), dt = 1 / 60;
  let bossAt = -1;
  while (!w.over && w.time < LIMIT) {
    if (w.choosing) selectCard(w, Math.floor(Math.random() * w.choosing.length));
    updateWorld(w, dt, bot(w, dt));
    if (bossAt < 0 && w.boss.spawned) bossAt = w.time;
  }
  return {
    pills: w.antibioticUses, evolved: Object.keys(w.evolved).length, allOut: w.allOut, time: w.time, level: w.player.level, reached: w.time >= BOSS_AT, won: w.won, phase2: w.boss.phase2,
    fight: bossAt >= 0 ? w.time - bossAt : 0, bossHpLeft: w.boss.maxHp ? w.boss.hp / w.boss.maxHp : 1,
  };
}

for (const [name, skill] of Object.entries(BOTS).filter(([n]) => !process.argv[3] || n === process.argv[3])) {
  const rs = Array.from({ length: RUNS }, () => play(skill));
  const avg = (list, f) => (list.length ? (list.reduce((a, r) => a + f(r), 0) / list.length).toFixed(1) : '-');
  const pct = (f) => `${Math.round((rs.filter(f).length / RUNS) * 100)}%`;
  const wins = rs.filter((r) => r.won), lost = rs.filter((r) => r.reached && !r.won);
  console.log(`${name.padEnd(8)} reachBoss ${pct((r) => r.reached)}  killBoss ${pct((r) => r.won)}  phase2 ${pct((r) => r.phase2)}`
    + `  winFight ${avg(wins, (r) => r.fight)}s  lostFight ${avg(lost, (r) => r.fight)}s  bossHpLeft(lost) ${avg(lost, (r) => r.bossHpLeft)}  avgLv ${avg(rs, (r) => r.level)}`
    + `  pills ${avg(rs, (r) => r.pills)}  evolved ${avg(rs, (r) => r.evolved)}  allOut ${pct((r) => r.allOut)}`);
}
await vite.close();
