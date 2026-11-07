// 일시정지 메뉴: 계속하기 / 다시 시작 / 소리 / 도감 / 타이틀로
import dialogue from '../data/dialogue.json';

const U = dialogue.ui;
type Action = 'resume' | 'restart' | 'sound' | 'codex' | 'title';

export function createPause(act: (a: Action) => void, isMuted: () => boolean) {
  const btn = document.createElement('button');
  btn.id = 'pause-btn';
  btn.setAttribute('aria-label', U.pause);
  btn.innerHTML = '<i></i><i></i>';
  btn.hidden = true;
  const root = document.createElement('div');
  root.id = 'pause';
  root.hidden = true;
  document.body.append(btn, root);
  const items: Action[] = ['resume', 'restart', 'sound', 'codex', 'title'];
  let sel = 0;

  const label = (a: Action) =>
    ({ resume: U.resume, restart: U.restart, sound: isMuted() ? U.soundOn : U.soundOff, codex: U.codex, title: U.toTitle })[a];
  const render = () => {
    root.innerHTML = `<div class="pz"><h2>${U.pause}</h2>${items.map((a, i) =>
      `<button data-a="${a}" class="${i === sel ? 'sel' : ''}">${label(a)}</button>`).join('')}</div>`;
  };
  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (b) act(b.dataset.a as Action);
  });

  return {
    btn,
    get isOpen() { return !root.hidden; },
    open() { sel = 0; render(); root.hidden = false; },
    close() { root.hidden = true; },
    refresh: render,
    key(e: KeyboardEvent) {
      if (e.code === 'Escape' || e.code === 'KeyP') return act('resume');
      if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
        sel = (sel + (e.code === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
        render();
      } else if (e.code === 'Enter' || e.code === 'Space') act(items[sel]);
    },
  };
}
