// 면역 도감: 만난 적·고른 카드·진화 카드를 칸으로. 기록은 localStorage에 계속 남는다(랭킹과 별개).
import dialogue from '../data/dialogue.json';
import enemies from '../data/enemies.json';
import cardData from '../data/cards.json';
import fields from '../data/fields.json';
import type { World } from '../game/world';

const KEY = 'cell-survivor-codex';
const U = dialogue.ui;
const fieldName = Object.fromEntries(fields.map((f) => [f.id, f.name]));
const cardName = Object.fromEntries(cardData.cards.map((c) => [c.id, c.name]));

interface Entry { key: string; id: string; group: 'enemy' | 'card' | 'evo'; name: string; science: string; field?: string; effect: string; color?: string }
const ENTRIES: Entry[] = [
  ...enemies.map((e) => ({
    key: `enemy:${e.id}`, id: e.id, group: 'enemy' as const, name: e.name, science: e.science ?? '', color: e.color,
    effect: U.codexStats.replace('{hp}', String(e.hp)).replace('{speed}', String(e.speed)).replace('{damage}', String(e.damage)),
  })),
  ...cardData.cards.map((c) => ({ key: `card:${c.id}`, id: c.id, group: 'card' as const, name: c.name, science: c.science, field: c.field, effect: c.effect })),
  ...cardData.evolutions.map((c) => ({
    key: `evo:${c.id}`, id: c.id, group: 'evo' as const, name: c.name, science: c.science, field: c.field,
    effect: `${c.effect}<br><small>${U.codexRequires}: ${Object.entries(c.requires).map(([id, lv]) => `${cardName[id]} ${lv}`).join(' + ')}</small>`,
  })),
];

function load(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return new Set(Array.isArray(v) ? v : []);
  } catch {
    return new Set();
  }
}
let unlocked = load();

// 이번 판에 만난 적·고른 카드·진화를 기록
export function recordCodex(w: World) {
  const before = unlocked.size;
  for (const k of w.seen) unlocked.add(`enemy:${enemies[k].id}`);
  for (const id in w.cards) unlocked.add(`card:${id}`);
  for (const id in w.evolved) unlocked.add(`evo:${id}`);
  if (unlocked.size === before) return;
  try {
    localStorage.setItem(KEY, JSON.stringify([...unlocked]));
  } catch {
    /* 저장 실패해도 게임은 계속 */
  }
}

export const codexCount = () => ({ n: ENTRIES.filter((e) => unlocked.has(e.key)).length, total: ENTRIES.length });

const icon = (e: Entry, open: boolean) =>
  `<i class="ico ${e.group} ico-${e.id}${open ? '' : ' locked'}" style="--c:${e.color ?? 'var(--field-' + e.field + ')'}"></i>`;

export function createCodex() {
  const root = document.createElement('div');
  root.id = 'codex';
  root.hidden = true;
  document.body.appendChild(root);
  let sel = 0;

  const groups: [Entry['group'], string][] = [['enemy', U.codexEnemies], ['card', U.codexCards], ['evo', U.codexEvolutions]];
  const render = () => {
    const { n, total } = codexCount();
    const cur = ENTRIES[sel], open = unlocked.has(cur.key);
    root.innerHTML = `<div class="cx">
      <header><h2>${U.codex}</h2><span>${U.codexCount.replace('{n}', String(n)).replace('{total}', String(total))}</span><small>${U.codexClose}</small></header>
      <div class="cx-body">
        <div class="cx-grid">${groups.map(([g, label]) => `<h3>${label}</h3><div class="tiles">${ENTRIES.map((e, i) => e.group !== g ? '' :
          `<button class="tile${i === sel ? ' sel' : ''}" data-i="${i}">${icon(e, unlocked.has(e.key))}<span>${unlocked.has(e.key) ? e.name : U.codexLocked}</span></button>`).join('')}</div>`).join('')}
        </div>
        <article class="cx-detail${open ? '' : ' locked'}">
          ${icon(cur, open)}
          <h3>${open ? cur.name : U.codexLocked}</h3>
          ${open ? `
            <p class="tag">${cur.field ? `${U.codexField} · ${fieldName[cur.field]}` : U.codexEnemies}</p>
            ${cur.science ? `<p class="sci">${cur.science}</p>` : ''}
            <h4>${U.codexEffect}</h4><p>${cur.effect}</p>` : ''}
        </article>
      </div>
    </div>`;
  };

  root.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('.tile');
    if (t) { sel = Number(t.dataset.i); render(); }
  });

  return {
    get isOpen() { return !root.hidden; },
    open() { unlocked = load(); render(); root.hidden = false; },
    close() { root.hidden = true; },
    // 방향키로 이동, Esc·D로 닫기. true면 닫힘
    key(e: KeyboardEvent) {
      if (e.code === 'Escape' || e.code === 'KeyD') { root.hidden = true; return true; }
      const cols = 6;
      const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols } as Record<string, number>;
      if (d[e.code]) { sel = Math.max(0, Math.min(ENTRIES.length - 1, sel + d[e.code])); render(); }
      return false;
    },
  };
}
