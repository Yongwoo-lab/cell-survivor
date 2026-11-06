import dialogue from '../data/dialogue.json';
import type { World } from '../game/world';

export function createHud() {
  const root = document.createElement('div');
  root.id = 'hud';
  root.innerHTML = `
    <div class="bar hp"><i></i></div>
    <div class="bar xp"><i></i></div>
    <span class="lv"></span>`;
  const over = document.createElement('div');
  over.id = 'over';
  over.hidden = true;
  over.innerHTML = `<p>${dialogue.gameOver}</p><small>R 키로 다시 시작</small>`;
  document.body.append(root, over);
  const hp = root.querySelector<HTMLElement>('.hp i')!;
  const xp = root.querySelector<HTMLElement>('.xp i')!;
  const lv = root.querySelector<HTMLElement>('.lv')!;

  return (w: World) => {
    const p = w.player;
    hp.style.width = `${(p.hp / p.maxHp) * 100}%`;
    xp.style.width = `${(p.xp / p.xpToNext) * 100}%`;
    lv.textContent = `Lv ${p.level}`;
    over.hidden = !w.over;
  };
}
