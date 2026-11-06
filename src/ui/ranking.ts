// 오늘의 랭킹 (localStorage). 상위 rankSize 안이면 영문 3글자 이름 입력.
import dialogue from '../data/dialogue.json';
import balance from '../data/balance.json';

const KEY = 'cell-survivor-ranking';
const U = dialogue.ui, N = balance.score.rankSize;
interface Entry { name: string; score: number; date: string; at: number }

const today = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD (현지 날짜)

function loadAll(): Entry[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function topToday(n: number) {
  const d = today();
  return loadAll().filter((e) => e.date === d).sort((a, b) => b.score - a.score || a.at - b.at).slice(0, n);
}

function save(e: Entry) {
  // 오늘 기록만 남겨 저장소가 계속 커지지 않게 한다
  const keep = loadAll().filter((x) => x.date === e.date);
  keep.push(e);
  try {
    localStorage.setItem(KEY, JSON.stringify(keep));
  } catch {
    /* 저장 실패(사생활 모드 등)해도 게임은 계속 */
  }
}

export const rankRows = (list: Entry[], markAt?: number) =>
  list.map((e, i) => `<li class="${e.at === markAt ? 'me' : ''}"><span>${i + 1}</span><b>${e.name}</b><em>${e.score}</em></li>`).join('');

export function createRanking() {
  const root = document.createElement('div');
  root.id = 'ranking';
  root.hidden = true;
  document.body.appendChild(root);
  let score = 0, name = '', entering = false, saved: Entry | undefined;

  const render = () => {
    const list = topToday(N);
    let rows = rankRows(list, saved?.at);
    if (entering) {
      const slots = [0, 1, 2].map((i) => `<i>${name[i] ?? '_'}</i>`).join('');
      // 내 자리를 미리 끼워 보여 준다
      const pos = list.filter((e) => e.score >= score).length;
      const items = rows ? rows.split('</li>').filter(Boolean).map((r) => r + '</li>') : [];
      items.splice(pos, 0, `<li class="me entry"><span>${pos + 1}</span><b>${slots}</b><em>${score}</em></li>`);
      rows = items.slice(0, N).join('');
    }
    root.innerHTML = `<div class="rk">
      <h2>${U.ranking}</h2>
      <p class="mine">${U.yourScore} <b>${score}</b></p>
      ${entering ? `<p class="prompt">${U.enterName}</p>` : ''}
      <ol>${rows || `<li class="empty">${U.rankEmpty}</li>`}</ol>
      ${entering ? '' : `<p class="back">${U.backToTitle}</p>`}
    </div>`;
  };

  return {
    show(s: number) {
      score = s;
      name = '';
      saved = undefined;
      const list = topToday(N);
      entering = list.length < N || s > list[list.length - 1].score;
      render();
      root.hidden = false;
    },
    hide() { root.hidden = true; },
    get entering() { return entering; },
    // true를 돌려주면 랭킹 화면을 끝내고 타이틀로
    key(e: KeyboardEvent) {
      if (!entering) return e.code === 'Enter' || e.code === 'KeyR';
      if (/^Key[A-Z]$/.test(e.code) && name.length < 3) name += e.code.slice(3);
      else if (e.code === 'Backspace') name = name.slice(0, -1);
      else if (e.code === 'Enter' && name.length === 3) {
        saved = { name, score, date: today(), at: Date.now() };
        save(saved);
        entering = false;
      }
      render();
      return false;
    },
  };
}
