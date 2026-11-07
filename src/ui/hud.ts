// 현미경 HUD: 배율·축척 막대·시료 라벨, 실험 장비 같은 얇은 선 게이지
import enemies from '../data/enemies.json';
import balance from '../data/balance.json';
import dialogue from '../data/dialogue.json';
import type { World } from '../game/world';

const U = dialogue.ui;
const bossName = enemies.find((e) => e.id === balance.boss.id)!.name;
const actTitle = (act: number) => dialogue.acts.find((a) => a.id === balance.acts[act].id)!.title;
const pad = (n: number, w = 3) => String(Math.max(0, Math.round(n))).padStart(w, '0');

export function createHud() {
  const scope = document.createElement('div');
  scope.id = 'scope';
  scope.innerHTML = `<span class="mag">${U.magnification}</span><span class="sample"></span>
    <div class="scalebar"><i></i><span>${U.scaleBar}</span></div>`;
  const root = document.createElement('div');
  root.id = 'hud';
  root.innerHTML = `
    <div class="boss" hidden><div class="row"><span class="k">${U.boss}</span><span class="name">${bossName}</span><span class="v"></span></div><div class="line"><i></i></div></div>
    <div class="row"><span class="k">${U.hp}</span><div class="line hp"><i></i></div><span class="v hpv"></span></div>
    <div class="row"><span class="k">${U.xp}</span><div class="line xp"><b></b><i></i></div><span class="v lv"></span></div>
    <span class="pill sticker" hidden></span>`;
  // 발열: 화면 가장자리가 붉게 달아오름
  const fever = document.createElement('div');
  fever.id = 'fever';
  document.body.append(fever, scope, root);
  const $ = (s: string) => root.querySelector<HTMLElement>(s)!;
  const hp = $('.hp i'), hpv = $('.hpv'), xp = $('.xp i'), ghost = $('.xp b'), lv = $('.lv'), boss = $('.boss'), bossBar = $('.boss i'), bossV = $('.boss .v'), pill = $('.pill');
  const sample = scope.querySelector<HTMLElement>('.sample')!;
  let lastAct = -1, lastXp = 0, lastLv = 1;

  return (w: World | null) => {
    root.hidden = fever.hidden = scope.hidden = !w;
    if (!w) return;
    const p = w.player;
    hp.style.width = `${(p.hp / p.maxHp) * 100}%`;
    hpv.textContent = `${pad(p.hp)}/${pad(p.maxHp)}`;
    root.classList.toggle('low', p.hp / p.maxHp < 0.3);
    // 경험치: 흰 잔상이 먼저 가고 바가 부드럽게 따라 차오른다. 레벨업으로 줄어들 땐 바로.
    const xpw = (p.xp / p.xpToNext) * 100;
    if (p.level !== lastLv || xpw < lastXp) { xp.style.transition = ghost.style.transition = 'none'; void xp.offsetWidth; }
    else { xp.style.transition = 'width 0.45s cubic-bezier(.2,.7,.2,1)'; ghost.style.transition = 'none'; }
    if (xpw !== lastXp || p.level !== lastLv) { xp.style.width = ghost.style.width = `${xpw}%`; lastXp = xpw; lastLv = p.level; }
    lv.textContent = `Lv ${pad(p.level, 2)}`;
    boss.hidden = !w.boss.spawned || w.won;
    bossBar.style.width = `${(w.boss.hp / w.boss.maxHp) * 100}%`;
    bossV.textContent = `${pad((w.boss.hp / w.boss.maxHp) * 100)}%`;
    pill.hidden = !(w.antibioticT > 0);
    if (w.antibioticT > 0) pill.textContent = `${U.antibiotic} ${pad(Math.ceil(w.antibioticT), 2)}s`;
    if (w.act !== lastAct) {
      lastAct = w.act;
      sample.textContent = actTitle(w.act);
    }
    fever.style.opacity = String((w.cards.fever ?? 0) * 0.22);
  };
}
