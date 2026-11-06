import enemies from '../data/enemies.json';
import balance from '../data/balance.json';
import type { World } from '../game/world';

const bossName = enemies.find((e) => e.id === balance.boss.id)!.name;

export function createHud() {
  const root = document.createElement('div');
  root.id = 'hud';
  root.innerHTML = `
    <div class="boss" hidden><span>${bossName}</span><div class="bar"><i></i></div></div>
    <div class="bar hp"><i></i></div>
    <div class="bar xp"><i></i></div>
    <span class="lv"></span>`;
  // 발열: 화면 가장자리가 붉게 달아오름
  const fever = document.createElement('div');
  fever.id = 'fever';
  document.body.append(fever, root);
  const hp = root.querySelector<HTMLElement>('.hp i')!;
  const xp = root.querySelector<HTMLElement>('.xp i')!;
  const lv = root.querySelector<HTMLElement>('.lv')!;
  const boss = root.querySelector<HTMLElement>('.boss')!;
  const bossBar = boss.querySelector<HTMLElement>('i')!;

  return (w: World | null) => {
    root.hidden = fever.hidden = !w;
    if (!w) return;
    const p = w.player;
    hp.style.width = `${(p.hp / p.maxHp) * 100}%`;
    xp.style.width = `${(p.xp / p.xpToNext) * 100}%`;
    lv.textContent = `Lv ${p.level}`;
    boss.hidden = !w.boss.spawned || w.won;
    bossBar.style.width = `${(w.boss.hp / w.boss.maxHp) * 100}%`;
    fever.style.opacity = String((w.cards.fever ?? 0) * 0.22);
  };
}
