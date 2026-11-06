import fields from '../data/fields.json';
import type { World } from '../game/world';
import type { Card } from '../game/cards';

const fieldName = Object.fromEntries(fields.map((f) => [f.id, f.name]));

// 레벨업 카드 선택. 1·2·3 키나 클릭으로 고른다.
export function createCardPicker(onPick: (i: number) => void) {
  const root = document.createElement('div');
  root.id = 'picker';
  root.hidden = true;
  document.body.appendChild(root);
  let shown: Card[] | null = null;

  addEventListener('keydown', (e) => {
    const i = ['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].indexOf(e.code) % 3;
    if (shown && i >= 0 && i < shown.length) onPick(i);
  });
  root.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.card');
    if (shown && el) onPick(Number(el.dataset.i));
  });

  return (w: World) => {
    if (w.choosing === shown) return;
    shown = w.choosing;
    root.hidden = !shown;
    if (!shown) return;
    root.innerHTML = `<h2>레벨 업!</h2><div class="hand">${shown.map((c, i) => {
      const cur = w.cards[c.id] ?? 0;
      return `<button class="card" data-i="${i}" style="--delay:${i * 0.12}s">
        <div class="face">
          <span class="tag">${fieldName[c.field] ?? c.field}</span>
          <h3>${c.name}</h3>
          <p class="effect">${c.effect}</p>
          <p class="sci">${c.science}</p>
          <div class="foot"><span class="lv">${cur ? `${cur}/${c.levels.length} → ${cur + 1}/${c.levels.length}` : `NEW · 1/${c.levels.length}`}</span><kbd>${i + 1}</kbd></div>
        </div>
        <div class="back"></div>
      </button>`;
    }).join('')}</div>`;
  };
}
