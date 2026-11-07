// 다음 이야기 예고 (승리했을 때만): 암전 → 에피소드 1 클리어 → 예고 세 줄 타이핑 → 에피소드 2 제목 → 아무 키나 → 결과 화면
// Enter, Space는 언제든 건너뛰기.
import dialogue from '../data/dialogue.json';
import { sfx, setMusicLevel } from '../audio';

const T = dialogue.teaser;
const LINE_MS = 1500, MUSIC_LOW = 0.35;

export function createTeaser() {
  const root = document.createElement('div');
  root.id = 'teaser';
  root.hidden = true;
  root.innerHTML = `<p class="clear"></p><div class="lines">${T.lines.map(() => '<p></p>').join('')}</div>
    <div class="next"><strong></strong><span></span></div><small class="key">${dialogue.ui.anyKey}</small><small class="skip">${dialogue.ui.skip}</small>`;
  document.body.appendChild(root);
  const clear = root.querySelector<HTMLElement>('.clear')!, lines = [...root.querySelectorAll<HTMLElement>('.lines p')];
  const next = root.querySelector<HTMLElement>('.next')!, keyHint = root.querySelector<HTMLElement>('.key')!;
  let run = 0, done: (() => void) | null = null, ended = false;
  const timers = new Set<number>();
  const wait = (ms: number) => new Promise<void>((res, rej) => {
    const id = run;
    const t = window.setTimeout(() => { timers.delete(t); id === run ? res() : rej(new Error('skip')); }, ms);
    timers.add(t);
  });

  async function timeline() {
    await wait(700); // 암전
    clear.textContent = T.clear;
    clear.classList.add('on');
    await wait(1400);
    for (let k = 0; k < T.lines.length; k++) {
      const text = T.lines[k], el = lines[k], per = (LINE_MS - 400) / text.length;
      el.classList.add('on', 'typing');
      for (let i = 1; i <= text.length; i++) { el.textContent = text.slice(0, i); await wait(per); }
      el.classList.remove('typing');
      await wait(400);
    }
    await wait(500);
    next.querySelector('strong')!.textContent = T.next;
    next.querySelector('span')!.textContent = T.soon;
    next.classList.add('on');
    sfx.impact();
    await wait(1200);
    keyHint.classList.add('on');
    ended = true;
  }

  function finish() {
    if (!done) return;
    run++;
    timers.forEach(clearTimeout);
    timers.clear();
    root.hidden = true;
    setMusicLevel(1);
    const d = done;
    done = null;
    d();
  }

  return {
    get isOn() { return !!done; },
    play(onDone: () => void) {
      run++;
      done = onDone;
      ended = false;
      root.hidden = false;
      for (const el of [clear, next, keyHint, ...lines]) { el.classList.remove('on', 'typing'); }
      for (const el of lines) el.textContent = '';
      clear.textContent = '';
      setMusicLevel(MUSIC_LOW);
      timeline().catch(() => { /* 건너뜀 */ });
    },
    key(e: KeyboardEvent) {
      if (ended || e.code === 'Enter' || e.code === 'Space') finish();
    },
    // 타이틀로 나갈 때: 콜백 없이 닫기
    hide() {
      run++;
      timers.forEach(clearTimeout);
      timers.clear();
      if (done) setMusicLevel(1);
      done = null;
      root.hidden = true;
    },
  };
}
