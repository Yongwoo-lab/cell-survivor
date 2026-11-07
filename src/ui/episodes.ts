// 에피소드 선택: 카드 2장 가로 배치. 열린 에피소드만 시작, 준비 중인 카드는 흔들리며 토스트.
import dialogue from '../data/dialogue.json';

const U = dialogue.ui, EPS = dialogue.episodes;
const TOAST_MS = 1800;

export function createEpisodes(h: { start(id: string): void; back(): void }) {
  const root = document.createElement('div');
  root.id = 'episodes';
  root.hidden = true;
  root.innerHTML = `<h2>${U.episodeSelect}</h2>
    <div class="eps">${EPS.map((e, i) => `<button class="ep${e.status === 'open' ? '' : ' locked'}" data-i="${i}">
      <span class="num">${e.number}</span><strong>${e.title}</strong>${e.status === 'open' ? '' : `<em><i class="lock"></i>${U.episodeSoon}</em>`}
    </button>`).join('')}</div>
    <p class="hint">${U.episodeHint}</p>
    <div class="toast" hidden>${dialogue.teaser.soon}</div>`;
  document.body.appendChild(root);
  const cards = [...root.querySelectorAll<HTMLElement>('.ep')], toast = root.querySelector<HTMLElement>('.toast')!;
  let sel = 0, toastT = 0;

  const setSel = (i: number) => { sel = i; cards.forEach((c, k) => c.classList.toggle('sel', k === i)); };
  const choose = (i: number) => {
    setSel(i);
    if (EPS[i].status === 'open') { root.hidden = true; h.start(EPS[i].id); return; }
    const c = cards[i];
    c.classList.remove('shake');
    void c.offsetWidth; // 흔들림 다시 시작
    c.classList.add('shake');
    toast.hidden = false;
    toast.classList.remove('on'); void toast.offsetWidth; toast.classList.add('on');
    clearTimeout(toastT);
    toastT = window.setTimeout(() => { toast.hidden = true; }, TOAST_MS);
  };
  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.ep');
    if (b) choose(+b.dataset.i!);
  });
  root.addEventListener('mouseover', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.ep');
    if (b && +b.dataset.i! !== sel) setSel(+b.dataset.i!);
  });

  return {
    get isOpen() { return !root.hidden; },
    open() { setSel(0); toast.hidden = true; root.hidden = false; },
    close() { clearTimeout(toastT); root.hidden = true; },
    key(e: KeyboardEvent) {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') setSel((sel + EPS.length - 1) % EPS.length);
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') setSel((sel + 1) % EPS.length);
      else if (e.code === 'Enter' || e.code === 'Space') choose(sel);
      else if (e.code === 'Escape' || e.code === 'Backspace') { this.close(); h.back(); }
    },
  };
}
