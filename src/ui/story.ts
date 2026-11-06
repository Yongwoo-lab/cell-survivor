// 게임 중 연출 텍스트: 막 제목, 정보 장교 말풍선, 보스 경고. 게임은 멈추지 않는다.
import dialogue from '../data/dialogue.json';
import enemies from '../data/enemies.json';
import balance from '../data/balance.json';
import type { World } from '../game/world';
import { sfx } from '../audio';

const ACT_SHOW = 2500, OFFICER_SHOW = 3000;
const officerLines = dialogue.officer as Record<string, string>;

export function createStory() {
  const act = document.createElement('div');
  act.id = 'act';
  act.innerHTML = '<h2></h2><p></p>';
  const officer = document.createElement('div');
  officer.id = 'officer';
  officer.innerHTML = `<div class="icon"></div><div class="bubble"><b>${dialogue.officerName}</b><p></p></div>`;
  const warn = document.createElement('div');
  warn.id = 'warn';
  warn.hidden = true;
  warn.innerHTML = `<div class="edge"></div><div class="text"><strong>${dialogue.ui.bossWarning}</strong>${dialogue.bossIntro.map((l) => `<p>${l}</p>`).join('')}</div>`;
  document.body.append(act, officer, warn);

  let lastAct = -1, seen = 0, actTimer = 0, officerTimer = 0, busyUntil = 0;
  const queue: string[] = [];

  const showOfficer = (line: string) => {
    officer.querySelector('p')!.textContent = line;
    officer.classList.remove('on');
    void officer.offsetWidth; // 애니메이션 다시 시작
    officer.classList.add('on');
    clearTimeout(officerTimer);
    officerTimer = window.setTimeout(() => officer.classList.remove('on'), OFFICER_SHOW);
    busyUntil = performance.now() + OFFICER_SHOW + 300;
  };

  return {
    reset() {
      lastAct = -1; seen = 0; queue.length = 0; busyUntil = 0;
      act.classList.remove('on'); officer.classList.remove('on'); warn.hidden = true;
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
      if (queue.length && performance.now() > busyUntil) showOfficer(queue.shift()!);
      // 보스 경고: 켜지는 순간 사이렌
      const warnOn = w.bossWarn > 0;
      if (warnOn && warn.hidden && sound) sfx.siren(w.bossWarn);
      warn.hidden = !warnOn;
    },
  };
}
