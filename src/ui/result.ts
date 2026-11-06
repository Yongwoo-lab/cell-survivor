// 엔딩 문장 → 세로형 결과 카드 (캡처용)
import dialogue from '../data/dialogue.json';
import fields from '../data/fields.json';
import cards from '../data/cards.json';
import { topField } from '../game/result';
import type { World } from '../game/world';

const ENDING_SHOW = 2800;
const U = dialogue.ui;

export function createResult() {
  const ending = document.createElement('div');
  ending.id = 'ending';
  ending.hidden = true;
  const card = document.createElement('div');
  card.id = 'result';
  card.hidden = true;
  document.body.append(ending, card);
  let timer = 0;

  const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

  return {
    show(w: World, onCard: () => void) {
      ending.textContent = w.won ? dialogue.ending : dialogue.gameOver;
      ending.className = w.won ? 'won' : 'lost';
      ending.hidden = false;
      timer = window.setTimeout(() => {
        ending.hidden = true;
        const f = fields.find((x) => x.id === topField(w.result)) ?? fields[0];
        const picked = Object.entries(w.cards).map(([id, lv]) => ({ c: cards.find((c) => c.id === id)!, lv }));
        const kills = w.kills.reduce((a, b) => a + b, 0);
        card.className = w.won ? 'won' : 'lost';
        card.innerHTML = `<div class="rc">
          <div class="rc-top">${U.title}</div>
          <h1>${f.title}</h1>
          <h2>${f.subtitle}</h2>
          <p class="desc">${f.description}</p>
          <div class="courses"><span>${U.resultCourses}</span>${f.courses.map((c) => `<em>${c}</em>`).join('')}</div>
          <div class="stats">
            <div><b>${mmss(w.time)}</b><span>${U.resultTime}</span></div>
            <div><b>${kills}</b><span>${U.resultKills}</span></div>
            <div><b>${w.player.level}</b><span>${U.resultLevel}</span></div>
          </div>
          <h3>${U.resultCards}</h3>
          <ul>${picked.map(({ c, lv }) => `<li><b>${c.name}</b><i>${lv}/${c.levels.length}</i><span>${c.science}</span></li>`).join('')}</ul>
          <small>${dialogue.disclaimer}</small>
        </div>
        <p class="back">${U.backToTitle}</p>`;
        card.hidden = false;
        onCard();
      }, ENDING_SHOW);
    },
    hide() {
      clearTimeout(timer);
      ending.hidden = card.hidden = true;
    },
  };
}
