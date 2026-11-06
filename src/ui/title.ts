import dialogue from '../data/dialogue.json';
import balance from '../data/balance.json';
import { topToday, rankRows } from './ranking';

const TYPE_MS = 55; // 한 글자 간격
const LINE_PAUSE = 500;
const CALL_HOLD = 1400;

const el = (id: string, html = '') => {
  const d = document.createElement('div');
  d.id = id;
  d.hidden = true;
  d.innerHTML = html;
  document.body.appendChild(d);
  return d;
};

export function createTitle() {
  const title = el('title', `<h1>${dialogue.ui.title}</h1><p>${dialogue.ui.pressStart}</p><aside><h3>${dialogue.ui.ranking}</h3><ol></ol></aside>`);
  const side = title.querySelector<HTMLElement>('aside')!;
  // 대기 화면 자동 시연 위에 깜빡이는 안내
  const demo = el('demo', `<p>${dialogue.ui.pressStart}</p>`);
  const intro = el('intro', `<div class="lines"></div><div class="call">${dialogue.introCall}</div>`);
  const lines = intro.querySelector<HTMLElement>('.lines')!;
  const call = intro.querySelector<HTMLElement>('.call')!;
  let timers: number[] = [];
  let done: (() => void) | null = null;

  const finish = () => {
    timers.forEach(clearTimeout);
    timers = [];
    intro.hidden = true;
    const cb = done;
    done = null;
    cb?.();
  };

  return {
    showTitle(on: boolean) {
      title.hidden = !on;
      if (!on) return;
      const top = topToday(balance.score.titleSize);
      side.hidden = !top.length;
      side.querySelector('ol')!.innerHTML = rankRows(top);
    },
    showDemo: (on: boolean) => { demo.hidden = !on; },
    // 인트로: 세 문장을 타자 치듯, 마지막에 introCall
    playIntro(onDone: () => void) {
      done = onDone;
      intro.hidden = false;
      call.classList.remove('on');
      lines.innerHTML = dialogue.intro.map(() => '<p></p>').join('');
      const ps = [...lines.children] as HTMLElement[];
      let at = 400;
      dialogue.intro.forEach((text, li) => {
        for (let c = 1; c <= text.length; c++) {
          timers.push(window.setTimeout(() => {
            ps[li].textContent = text.slice(0, c);
            ps[li].classList.toggle('typing', c < text.length);
          }, at));
          at += TYPE_MS;
        }
        at += LINE_PAUSE;
      });
      timers.push(window.setTimeout(() => call.classList.add('on'), at));
      timers.push(window.setTimeout(finish, at + CALL_HOLD));
    },
    skipIntro: finish,
  };
}
