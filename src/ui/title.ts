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

export function createTitle() {
  const title = el('title', `<h1>${dialogue.ui.title}</h1><p>${dialogue.ui.pressStart}</p><button class="codex-btn">${dialogue.ui.codexButton}</button><aside><h3>${dialogue.ui.ranking}</h3><ol></ol></aside>`);
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
