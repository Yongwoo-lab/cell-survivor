// 타이틀: 왼쪽 40% 로고·부제·메뉴, 오른쪽 60%는 3D 백혈구 장면. 맨 아래 띠, 오른쪽 아래 오늘의 기록.
import dialogue from '../data/dialogue.json';
import balance from '../data/balance.json';
import { topToday } from './ranking';
import { onBeat, sfx } from '../audio';
import type { Settings } from './settings';

const U = dialogue.ui;
type Item = 'start' | 'codex' | 'rank' | 'settings';
const ITEMS: Item[] = ['start', 'codex', 'rank', 'settings'];

// 로고: 두 줄, SURVIVOR의 O는 세포(초록 막 + 파란 핵)
const CELL_O = `<svg class="cell-o" viewBox="0 0 100 100" aria-hidden="true">
  <circle class="mem" cx="50" cy="50" r="40"/>
  <path class="nuc" d="M50 30c12 0 21 7 20 19-1 11-9 20-21 20-11 0-20-8-19-20 0-11 9-19 20-19z"/></svg>`;
const logo = () => {
  const [a, b] = U.logo;
  const i = b.indexOf('O');
  return `<h1 class="logo" aria-label="${a} ${b}"><span>${a}</span><span>${b.slice(0, i)}${CELL_O}${b.slice(i + 1)}</span></h1>`;
};

export interface TitleHooks {
  start(): void;
  codex(): void;
  rank(): void;
  settings(): Settings;
  toggle(key: keyof Settings): void;
}

export function createTitle(h: TitleHooks) {
  const root = document.createElement('div');
  root.id = 'title';
  root.hidden = true;
  root.innerHTML = `
    <section class="left">
      ${logo()}
      <p class="sub">${U.tagline}</p>
      <nav class="menu"></nav>
      <p class="hint">${U.titleHint}</p>
    </section>
    <aside class="log"><h3>${U.ranking}</h3><table></table></aside>
    <div class="lens"></div>`;
  const demo = document.createElement('div');
  demo.id = 'demo';
  demo.hidden = true;
  demo.innerHTML = `<p>${U.pressStart}</p><div class="mini">${U.logo.join(' ')}</div>`;
  document.body.append(root, demo);
  const nav = root.querySelector<HTMLElement>('.menu')!;
  const table = root.querySelector('table')!;
  const log = root.querySelector<HTMLElement>('.log')!;
  const logoEl = root.querySelector<HTMLElement>('.logo')!;
  let sel = 0, inSettings = false, seen = false, leaving = false;

  // 로고 핵: 브금의 심장 박동 저음이 울릴 때 같이 뛴다
  onBeat(() => {
    logoEl.classList.add('synced', 'beat');
    setTimeout(() => logoEl.classList.remove('beat'), 110);
  });

  const renderMenu = () => {
    const s = h.settings();
    const rows = inSettings
      ? [[U.settings.sound, s.muted ? U.settings.off : U.settings.on], [U.settings.cb, s.cb ? U.settings.on : U.settings.off], [U.settings.back, '']]
      : ITEMS.map((k) => [U.menu[k], '']);
    nav.innerHTML = rows.map(([label, v], i) =>
      `<button data-i="${i}" class="${i === sel ? 'sel' : ''}" style="--i:${i}"><span>${label}</span>${v ? `<em>${v}</em>` : ''}</button>`).join('');
  };
  const renderLog = () => {
    // 기록이 없으면 랭킹 영역 자체를 숨긴다
    const top = topToday(balance.score.titleSize);
    log.hidden = !top.length;
    table.innerHTML = top.map((e, i) => `<tr><td>${i + 1}</td><td>${e.name}</td><td>${e.score}</td></tr>`).join('');
  };

  const activate = () => {
    if (leaving) return;
    if (inSettings) {
      if (sel === 0) h.toggle('muted');
      else if (sel === 1) h.toggle('cb');
      else { inSettings = false; sel = 3; }
      renderMenu();
      return;
    }
    const item = ITEMS[sel];
    if (item === 'start') h.start();
    else if (item === 'codex') h.codex();
    else if (item === 'rank') h.rank();
    else { inSettings = true; sel = 0; renderMenu(); }
  };
  nav.addEventListener('mouseover', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (b && Number(b.dataset.i) !== sel) { sel = Number(b.dataset.i); renderMenu(); }
  });
  nav.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (b) { sel = Number(b.dataset.i); activate(); }
  });

  return {
    showTitle(on: boolean) {
      root.hidden = !on;
      if (!on) return;
      leaving = false;
      inSettings = false;
      sel = 0;
      root.className = seen ? 'quick' : 'enter'; // 처음엔 천천히, 다시 들어올 땐 짧게
      seen = true;
      renderMenu();
      renderLog();
    },
    showDemo: (on: boolean) => { demo.hidden = !on; },
    // ↑↓ 선택, Enter 실행, Space 바로 시작, Esc 설정에서 나가기. true면 처리함
    key(e: KeyboardEvent): boolean {
      const n = inSettings ? 3 : ITEMS.length;
      if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
        sel = (sel + (e.code === 'ArrowDown' ? 1 : n - 1)) % n;
        sfx.tick();
        renderMenu();
      } else if (e.code === 'Enter') activate();
      else if (e.code === 'Space' && !inSettings) { if (!leaving) h.start(); }
      else if (e.code === 'Escape' && inSettings) { inSettings = false; sel = 3; renderMenu(); }
      else return false;
      return true;
    },
    // 시작: '초점 조절' 기계음 + 렌즈 원으로 좁혀지며 넘어간다
    focusOut(next: () => void) {
      leaving = true;
      sfx.focus();
      root.classList.add('leaving');
      setTimeout(() => { root.hidden = true; root.classList.remove('leaving'); next(); }, 650);
    },
    get entranceSeconds() { return root.classList.contains('enter') ? 1 : 0.3; },
  };
}
