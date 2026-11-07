import dialogue from '../data/dialogue.json';
import balance from '../data/balance.json';
import { topToday, rankRows } from './ranking';

const el = (id: string, html = '') => {
  const d = document.createElement('div');
  d.id = id;
  d.hidden = true;
  d.innerHTML = html;
  document.body.appendChild(d);
  return d;
};

// 로고: "Cell Survivor"의 o 하나가 세포(초록 막 + 파란 핵). 핵이 심장 박동에 맞춰 뛴다.
const logo = () => {
  const [head, tail] = [dialogue.ui.title.slice(0, dialogue.ui.title.lastIndexOf('o')), dialogue.ui.title.slice(dialogue.ui.title.lastIndexOf('o') + 1)];
  return `<h1 class="logo" aria-label="${dialogue.ui.title}">${head}<svg class="cell-o" viewBox="0 0 100 100" aria-hidden="true">
    <circle class="mem" cx="50" cy="52" r="37"/>
    <path class="nuc" d="M50 34c10 0 19 6 18 17-1 10-8 18-19 18-10 0-18-7-17-18 0-10 8-17 18-17z"/>
  </svg>${tail}</h1>`;
};

export function createTitle() {
  const title = el('title', `${logo()}<p>${dialogue.ui.pressStart}</p><button class="codex-btn">${dialogue.ui.codexButton}</button><aside><h3>${dialogue.ui.ranking}</h3><ol></ol></aside>`);
  const side = title.querySelector<HTMLElement>('aside')!;
  const codexBtn = title.querySelector<HTMLElement>('.codex-btn')!;
  // 대기 화면 자동 시연 위에 깜빡이는 안내
  const demo = el('demo', `<p>${dialogue.ui.pressStart}</p>`);
  return {
    showTitle(on: boolean) {
      title.hidden = !on;
      if (!on) return;
      const top = topToday(balance.score.titleSize);
      side.hidden = !top.length;
      side.querySelector('ol')!.innerHTML = rankRows(top);
    },
    showDemo: (on: boolean) => { demo.hidden = !on; },
    onCodex: (fn: () => void) => codexBtn.addEventListener('click', fn),
  };
}
