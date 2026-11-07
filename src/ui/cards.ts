// 레벨업 카드 선택 (표본 슬라이드 라벨 디자인)
// 초점이 나간 화면 → 유리 슬라이드 뒷면으로 올라와 차례로 뒤집힘 → 고르면 "채택" 도장 → 보유 카드 줄로 날아감 → 재개
import fields from '../data/fields.json';
import dialogue from '../data/dialogue.json';
import cardData from '../data/cards.json';
import type { World } from '../game/world';
import { type Pick, isEvolution } from '../game/cards';
import { sfx } from '../audio';

const U = dialogue.ui;
const fieldName = Object.fromEntries(fields.map((f) => [f.id, f.name]));
const cardName = Object.fromEntries(cardData.cards.map((c) => [c.id, c.name]));
const FLIP_GAP = 120, STAMP_MS = 250, FLY_MS = 380;
const no = (c: Pick) => isEvolution(c)
  ? `No.E${cardData.evolutions.findIndex((e) => e.id === c.id) + 1}`
  : `No.${String(cardData.cards.findIndex((e) => e.id === c.id) + 1).padStart(2, '0')}`;

const STATS: Record<string, string> = U.stats;
const BY_CARD: Record<string, Record<string, string>> = U.statsByCard;

// 수치를 사람이 읽는 말로: 템플릿 "피해 {v}", "공격 속도 +{v}%", "재사용 {v}초". 숫자만 고정폭.
function statLine(cardId: string, key: string, next: number, prev?: number) {
  const tpl = BY_CARD[cardId]?.[key] ?? STATS[key] ?? `${key} {v}`;
  const [before, after = ''] = tpl.split('{v}');
  const sign = before.endsWith('+') ? '+' : '';
  const label = before.slice(0, before.length - sign.length).trim();
  const pct = after.startsWith('%');
  const num = (v: number, bold: boolean) => {
    const x = +(pct ? v * 100 : v).toFixed(pct ? 1 : 2);
    return `<${bold ? 'b' : 'span'} class="n">${sign}${x}</${bold ? 'b' : 'span'}>${after}`;
  };
  return `<span>${label ? `${label} ` : ''}${prev === undefined ? num(next, false) : `${num(prev, false)} → ${num(next, true)}`}</span>`;
}

// 이미 가진 카드는 바뀌는 값만 ("피해 12 → 16", 새 값 굵게), 처음이면 값만
function deltas(c: Pick, cur: number) {
  if (isEvolution(c)) {
    return `<span>${U.materials}: ${Object.entries(c.requires).map(([id, lv]) => `${cardName[id]} <span class="n">${lv}</span>`).join(' + ')}</span>`;
  }
  const next = c.levels[cur] as Record<string, number>, prev = cur ? (c.levels[cur - 1] as Record<string, number>) : null;
  return Object.keys(next).filter((k) => !prev || prev[k] !== next[k]).map((k) => statLine(c.id, k, next[k], prev?.[k])).join('');
}

const MICROSCOPE = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 1h3v2H8v5.2a3 3 0 1 1-2 0V3H6zM3 14h10v1H3zm2-2h6v1H5z" fill="currentColor"/></svg>`;

export interface PickerHooks {
  pick(i: number): void; // 실제 선택 (게임 규칙)
  show(canvases: HTMLCanvasElement[], ids: string[]): void;
  hide(): void;
  focus(i: number): void;
  deckTarget(): DOMRect | null; // 날아갈 곳 (보유 카드 줄)
}

export function createCardPicker(h: PickerHooks) {
  const root = document.createElement('div');
  root.id = 'picker';
  root.hidden = true;
  document.body.appendChild(root);
  let shown: Pick[] | null = null, busy = false, focus = -1;
  const timers: number[] = [];

  const cards = () => [...root.querySelectorAll<HTMLElement>('.card')];
  const setFocus = (i: number) => {
    focus = i;
    cards().forEach((c, j) => { c.classList.toggle('focus', j === i); c.classList.toggle('dim', i >= 0 && j !== i); });
    h.focus(i);
  };

  const choose = (i: number) => {
    if (!shown || busy || i < 0 || i >= shown.length) return;
    busy = true;
    setFocus(i);
    const el = cards()[i];
    el.classList.add('stamped');
    sfx.stamp();
    // 도장 → 보유 카드 줄로 날아감 → 선택 확정
    timers.push(window.setTimeout(() => {
      const from = el.getBoundingClientRect(), to = h.deckTarget();
      const dx = to ? to.left + to.width / 2 - (from.left + from.width / 2) : 0;
      const dy = to ? to.top + to.height / 2 - (from.top + from.height / 2) : -from.top;
      el.style.setProperty('--fly', `translate(${dx}px, ${dy}px) scale(0.12)`);
      el.classList.add('fly');
      cards().forEach((c, j) => j !== i && c.classList.add('gone'));
    }, STAMP_MS));
    timers.push(window.setTimeout(() => h.pick(i), STAMP_MS + FLY_MS));
  };

  addEventListener('keydown', (e) => {
    if (!shown || root.hidden) return;
    const n = ['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].indexOf(e.code) % 3;
    if (n >= 0) return choose(n);
    if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') setFocus(((focus < 0 ? 0 : focus) + (e.code === 'ArrowRight' ? 1 : shown.length - 1)) % shown.length);
    else if ((e.code === 'Enter' || e.code === 'Space') && focus >= 0) choose(focus);
  });
  root.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.card');
    if (el) choose(Number(el.dataset.i));
  });
  root.addEventListener('mouseover', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.card');
    if (el && !busy) setFocus(Number(el.dataset.i));
  });

  return (w: World) => {
    if (w.choosing === shown) return;
    shown = w.choosing;
    timers.splice(0).forEach(clearTimeout);
    busy = false;
    focus = -1;
    if (!shown) {
      root.hidden = true;
      h.hide();
      return;
    }
    root.hidden = false;
    root.innerHTML = `<h2>${U.levelUp}</h2><div class="hand">${shown.map((c, i) => {
      const evo = isEvolution(c), cur = w.cards[c.id] ?? 0, max = evo ? 1 : c.levels.length;
      const dots = evo ? `<span class="new">${U.evolution}</span>`
        : cur ? Array.from({ length: max }, (_, k) => `<i class="${k < cur ? 'on' : k === cur ? 'next' : ''}"></i>`).join('') : `<span class="new">${U.newCard}</span>`;
      return `<button class="card${evo ? ' evo' : ''}" data-i="${i}" style="--delay:${i * FLIP_GAP}ms; --fc: var(--field-${c.field})">
        <div class="face">
          <header class="band"><span class="chip"><i></i>${fieldName[c.field] ?? c.field}</span><span class="no">${no(c)}</span></header>
          <canvas class="art" width="320" height="200"></canvas>
          <div class="title"><h3>${c.name}</h3><span class="dots">${dots}</span></div>
          <p class="effect">${c.effect}</p>
          <p class="delta">${deltas(c, cur)}</p>
          <footer class="sci">${MICROSCOPE}<span>${c.science}</span></footer>
          <kbd>${i + 1}</kbd>
          <span class="stamp">${U.adopted}</span>
        </div>
        <div class="back"><span>${no(c)}</span></div>
      </button>`;
    }).join('')}</div>`;
    h.show([...root.querySelectorAll<HTMLCanvasElement>('canvas.art')], shown.map((c) => c.id));
    // 카드가 뒤집히는 순간마다 '틱'
    shown.forEach((_, i) => timers.push(window.setTimeout(() => sfx.tick(), 260 + i * FLIP_GAP)));
  };
}
