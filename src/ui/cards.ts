import fields from '../data/fields.json';
import dialogue from '../data/dialogue.json';
import type { World } from '../game/world';
import { type Pick, isEvolution } from '../game/cards';

const fieldName = Object.fromEntries(fields.map((f) => [f.id, f.name]));

// 레벨업 카드 선택. 1·2·3 키나 클릭으로 고른다.
export function createCardPicker(onPick: (i: number) => void) {
  const root = document.createElement('div');
  root.id = 'picker';
  root.hidden = true;
  document.body.appendChild(root);
  let shown: Pick[] | null = null, leaving = 0;

  // 고른 카드는 반짝이며 날아가고 나머지는 사라진다 (그동안 게임은 이미 다시 진행)
  const pick = (i: number) => {
    if (!shown || leaving || i < 0 || i >= shown.length) return;
    root.querySelectorAll('.card').forEach((c, j) => c.classList.add(j === i ? 'picked' : 'dismiss'));
    leaving = window.setTimeout(() => { leaving = 0; if (!shown) root.hidden = true; }, 480);
    onPick(i);
  };
  addEventListener('keydown', (e) => pick(['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].indexOf(e.code) % 3));
  root.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.card');
    if (el) pick(Number(el.dataset.i));
  });

  return (w: World) => {
    if (w.choosing === shown) return;
    shown = w.choosing;
    if (!shown) {
      if (!leaving) root.hidden = true;
      return;
    }
    clearTimeout(leaving);
    leaving = 0;
    root.hidden = false;
    root.innerHTML = `<h2>${dialogue.ui.levelUp}</h2><div class="hand">${shown.map((c, i) => {
      const evo = isEvolution(c);
      const cur = w.cards[c.id] ?? 0, max = evo ? 1 : c.levels.length;
      const lv = evo ? dialogue.ui.evolution : cur ? `${cur}/${max} → ${cur + 1}/${max}` : `${dialogue.ui.newCard} · 1/${max}`;
      return `<button class="card${evo ? ' evo' : ''}" data-i="${i}" style="--delay:${i * 0.12}s">
        <div class="face">
          <span class="tag">${fieldName[c.field] ?? c.field}</span>
          <h3>${c.name}</h3>
          <p class="effect">${c.effect}</p>
          <p class="sci">${c.science}</p>
          <div class="foot"><span class="lv">${lv}</span><kbd>${i + 1}</kbd></div>
        </div>
        <div class="back"></div>
      </button>`;
    }).join('')}</div>`;
  };
}
