// 일시정지: 화면 전체를 흐리고 어둡게, 가운데 패널 (왼쪽 메뉴 / 오른쪽 이번 판 진행 상황)
import dialogue from '../data/dialogue.json';
import balance from '../data/balance.json';
import cardData from '../data/cards.json';
import type { World } from '../game/world';
import { isMaterial } from '../game/cards';

const U = dialogue.ui, P = U.pauseInfo;
type Action = 'resume' | 'restart' | 'sound' | 'codex' | 'title';
const CLOSE_MS = 150;
const cardName = Object.fromEntries(cardData.cards.map((c) => [c.id, c.name])) as Record<string, string>;
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

function progress(w: World) {
  const act = dialogue.acts.find((a) => a.id === balance.acts[w.act].id)!.title;
  const kills = w.kills.reduce((a, b) => a + b, 0);
  const evos = cardData.evolutions.filter((e) => w.evolved[e.id]);
  const owned = cardData.cards.filter((c) => w.cards[c.id] && !isMaterial(w, c.id));
  const slots = evos.map((e) => `<span class="slot evo" title="${e.name}"><i class="ico evo ico-${e.id}"></i><em>${e.name}</em></span>`).join('')
    + owned.map((c) => `<span class="slot" style="--c: var(--field-${c.field})"><i class="ico ico-${c.id}"></i><em>${c.name}</em>
      <span class="pips">${c.levels.map((_, k) => `<b class="${k < w.cards[c.id] ? 'on' : ''}"></b>`).join('')}</span></span>`).join('');
  // 진화까지: 아직 안 한 진화마다 모자란 재료 (하나라도 가진 것만)
  const evoRows = cardData.evolutions.filter((e) => !w.evolved[e.id] && Object.keys(e.requires).some((id) => w.cards[id]))
    .map((e) => {
      const req = Object.entries(e.requires) as [string, number][];
      const done = req.every(([id, lv]) => (w.cards[id] ?? 0) >= lv);
      return `<li${done ? ' class="ready"' : ''}><b>${e.name}</b><span>${done ? P.evoReady
        : req.map(([id, lv]) => `<i class="${(w.cards[id] ?? 0) >= lv ? 'ok' : ''}">${cardName[id]} <span class="n">${Math.min(w.cards[id] ?? 0, lv)}/${lv}</span></i>`).join('')}</span></li>`;
    }).join('');
  return `<div class="stats">
      <div><b class="n">${mmss(w.time)}</b><span>${U.resultTime}</span></div>
      <div><b class="n">${w.player.level}</b><span>${U.resultLevel}</span></div>
      <div><b class="n">${kills}</b><span>${U.resultKills}</span></div>
      <div><b>${act}</b><span>${P.act}</span></div>
    </div>
    <h3>${P.cards}</h3>
    <div class="slots">${slots || `<p class="none">${P.noCards}</p>`}</div>
    ${evoRows ? `<h3>${P.evo}</h3><ul class="evos">${evoRows}</ul>` : ''}`;
}

export function createPause(act: (a: Action) => void, isMuted: () => boolean, world: () => World) {
  const btn = document.createElement('button');
  btn.id = 'pause-btn';
  btn.setAttribute('aria-label', U.pause);
  btn.innerHTML = '<i></i><i></i>';
  btn.hidden = true;
  const root = document.createElement('div');
  root.id = 'pause';
  root.hidden = true;
  root.innerHTML = `<div class="pz"><h1>${U.pause}</h1><div class="cols"><nav></nav><section></section></div></div>`;
  document.body.append(btn, root);
  const nav = root.querySelector('nav')!, info = root.querySelector('section')!;
  const items: Action[] = ['resume', 'restart', 'sound', 'codex', 'title'];
  let sel = 0, closing = 0;

  const label = (a: Action) =>
    ({ resume: U.resume, restart: U.restart, sound: isMuted() ? U.soundOn : U.soundOff, codex: U.codex, title: U.toTitle })[a];
  const renderMenu = () => {
    nav.innerHTML = items.map((a, i) => `<button data-a="${a}" class="${i === sel ? 'sel' : ''}">${label(a)}</button>`).join('');
  };
  const setSel = (i: number) => {
    sel = i;
    nav.querySelectorAll('button').forEach((b, k) => b.classList.toggle('sel', k === i));
  };
  nav.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (b) act(b.dataset.a as Action);
  });
  nav.addEventListener('mouseover', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (b) setSel(items.indexOf(b.dataset.a as Action));
  });

  return {
    btn,
    get isOpen() { return !root.hidden && !root.classList.contains('closing'); },
    open() {
      clearTimeout(closing);
      sel = 0;
      renderMenu();
      info.innerHTML = progress(world());
      root.classList.remove('closing');
      root.hidden = false;
    },
    close() {
      if (root.hidden) return;
      root.classList.add('closing');
      clearTimeout(closing);
      closing = window.setTimeout(() => { root.hidden = true; root.classList.remove('closing'); }, CLOSE_MS);
    },
    refresh: renderMenu,
    key(e: KeyboardEvent) {
      if (e.code === 'Escape' || e.code === 'KeyP') return act('resume');
      if (e.code === 'ArrowDown' || e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'KeyS') {
        setSel((sel + (e.code === 'ArrowDown' || e.code === 'KeyS' ? 1 : items.length - 1)) % items.length);
      } else if (e.code === 'Enter' || e.code === 'Space') act(items[sel]);
    },
  };
}
