// 엔딩 문장 → 세로형 결과 카드 (캡처용)
import dialogue from '../data/dialogue.json';
import fields from '../data/fields.json';
import cardData from '../data/cards.json';
import { isMaterial } from '../game/cards';
import { codexCount } from './codex';
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
        // 진화 재료가 된 카드는 진화 카드로 바뀌어 보인다
        const evos = cardData.evolutions.filter((ev) => w.evolved[ev.id]).map((c) => ({ c, lv: 0, evo: true }));
        const picked = [...evos, ...Object.entries(w.cards).filter(([id]) => !isMaterial(w, id))
          .map(([id, lv]) => ({ c: cardData.cards.find((c) => c.id === id)!, lv, evo: false }))];
        // science는 진화 카드 → 대표 분야 → 단계 높은 순으로 2장만
        const featured = [...picked].sort((a, b) => +b.evo - +a.evo || +(b.c.field === f.id) - +(a.c.field === f.id) || b.lv - a.lv).slice(0, 2);
        const n = w.antibioticUses;
        const antibiotic = n ? dialogue.antibioticResultUsed.replace('{n}', String(n)) : w.won ? dialogue.antibioticResultNone : '';
        const cx = codexCount();
        const kills = w.kills.reduce((a, b) => a + b, 0);
        card.className = w.won ? 'won' : 'lost';
        card.innerHTML = `<div class="rc">
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
          <div class="chips">${picked.map(({ c, lv, evo }) => evo ? `<span class="evo">${c.name} <i>${U.evolution}</i></span>`
            : `<span>${c.name} <i>${lv}/${'levels' in c ? c.levels.length : 1}</i></span>`).join('')}</div>
          <ul>${featured.map(({ c }) => `<li><b>${c.name}</b><span>${c.science}</span></li>`).join('')}</ul>
          ${antibiotic ? `<p class="abx${n ? ' used' : ''}">${antibiotic}</p>` : ''}
          <p class="cxc">${U.codexCount.replace('{n}', String(cx.n)).replace('{total}', String(cx.total))}</p>
          <small>${dialogue.disclaimer}</small>
        </div>
        <p class="back">${U.next}</p>`;
        card.hidden = false;
        // 숫자가 올라가며 세어진다
        const t0 = performance.now(), targets = [w.time, kills, w.player.level];
        const cells = [...card.querySelectorAll<HTMLElement>('.stats b')];
        const tick = () => {
          const k = Math.min(1, (performance.now() - t0) / 900), e = 1 - (1 - k) ** 3;
          cells.forEach((c, i) => { c.textContent = i === 0 ? mmss(targets[0] * e) : String(Math.round(targets[i] * e)); });
          if (k < 1 && !card.hidden) requestAnimationFrame(tick);
        };
        tick();
        onCard();
      }, ENDING_SHOW);
    },
    hide() {
      clearTimeout(timer);
      ending.hidden = card.hidden = true;
    },
  };
}
