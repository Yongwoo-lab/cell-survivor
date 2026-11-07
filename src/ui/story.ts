// 게임 중 연출 텍스트: 막 제목, 정보 장교 말풍선, 보스 경고. 게임은 멈추지 않는다.
import dialogue from '../data/dialogue.json';
import enemies from '../data/enemies.json';
import balance from '../data/balance.json';
import type { World } from '../game/world';
import { sfx } from '../audio';
import cardData from '../data/cards.json';

const ACT_SHOW = 2500, OFFICER_SHOW = 3000, EVOLVE_SHOW = 2500;
const officerLines = dialogue.officer as Record<string, string>;

export function createStory() {
  const act = document.createElement('div');
  act.id = 'act';
  act.innerHTML = '<h2></h2><p></p>';
  const officer = document.createElement('div');
  officer.id = 'officer';
  officer.className = 'officer';
  officer.innerHTML = `<div class="icon"></div><div class="bubble"><b>${dialogue.officerName}</b><p></p></div>`;
  const warn = document.createElement('div');
  warn.id = 'warn';
  warn.hidden = true;
  warn.innerHTML = `<div class="edge"></div><div class="text"><strong>${dialogue.ui.bossWarning}</strong>${dialogue.bossIntro.map((l) => `<p>${l}</p>`).join('')}</div>`;
  // 총공격: 가장자리 청록 맥동
  const allOut = document.createElement('div');
  allOut.id = 'allout';
  allOut.hidden = true;
  allOut.innerHTML = `<strong>${dialogue.ui.allOut}</strong>`;
  // 진화: 금빛 플래시 + "진화!" + science
  const evolve = document.createElement('div');
  evolve.id = 'evolve';
  evolve.hidden = true;
  document.body.append(act, officer, warn, allOut, evolve);

  let lastAct = -1, seen = 0, notes = 0, evolved = 0, actTimer = 0, officerTimer = 0, evolveTimer = 0, busyUntil = 0;
  const queue: string[] = [];

  // 말풍선: 아래에서 통 튀어 오르고 글자가 빠르게 타자 치듯
  let typing = 0;
  const showOfficer = (line: string) => {
    const p = officer.querySelector('p')!;
    p.textContent = '';
    clearInterval(typing);
    let n = 0;
    typing = window.setInterval(() => { p.textContent = line.slice(0, ++n); if (n >= line.length) clearInterval(typing); }, 24);
    officer.classList.remove('on');
    void officer.offsetWidth; // 애니메이션 다시 시작
    officer.classList.add('on');
    clearTimeout(officerTimer);
    officerTimer = window.setTimeout(() => officer.classList.remove('on'), OFFICER_SHOW);
    busyUntil = performance.now() + OFFICER_SHOW + 300;
  };

  return {
    reset() {
      lastAct = -1; seen = 0; notes = 0; evolved = 0; queue.length = 0; busyUntil = 0;
      act.classList.remove('on'); officer.classList.remove('on'); warn.hidden = true; allOut.hidden = true; evolve.hidden = true;
    },
    update(w: World, sound = true) {
      if (w.act !== lastAct) {
        lastAct = w.act;
        const a = dialogue.acts.find((x) => x.id === balance.acts[w.act].id)!;
        act.querySelector('h2')!.textContent = a.title;
        act.querySelector('p')!.textContent = a.line;
        act.classList.remove('on');
        void act.offsetWidth;
        act.classList.add('on');
        clearTimeout(actTimer);
        actTimer = window.setTimeout(() => act.classList.remove('on'), ACT_SHOW);
      }
      // 처음 등장한 적마다 정보 장교 한 줄 (겹치면 차례로)
      while (seen < w.seen.length) {
        const line = officerLines[enemies[w.seen[seen++]].id];
        if (line) queue.push(line);
      }
      // 항생제·총공격 같은 상황 대사
      while (notes < w.notes.length) {
        const line = officerLines[w.notes[notes++]];
        if (line) queue.push(line);
      }
      if (queue.length && performance.now() > busyUntil) showOfficer(queue.shift()!);
      allOut.hidden = !(w.allOut && !w.over);
      if (w.evolveLog.length > evolved) {
        const ev = cardData.evolutions.find((x) => x.id === w.evolveLog[w.evolveLog.length - 1])!;
        evolved = w.evolveLog.length;
        evolve.innerHTML = `<div class="flash"></div><div class="text"><strong>${dialogue.ui.evolve}</strong><h3>${ev.name}</h3><p>${ev.science}</p></div>`;
        evolve.hidden = false;
        clearTimeout(evolveTimer);
        evolveTimer = window.setTimeout(() => { evolve.hidden = true; }, EVOLVE_SHOW);
      }
      // 보스 경고: 켜지는 순간 사이렌
      const warnOn = w.bossWarn > 0;
      if (warnOn && warn.hidden && sound) sfx.siren(w.bossWarn);
      warn.hidden = !warnOn;
    },
  };
}
