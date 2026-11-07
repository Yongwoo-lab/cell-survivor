import './ui/fonts.css';
import './ui/style.css';
import { createWorld, updateWorld, clearEvents, ENEMIES, type World } from './game/world';
import { selectCard } from './game/cards';
import { addEnemy, kindOf } from './game/spawner';
import { createBot, BOTS } from './game/bot';
import { score } from './game/result';
import { createScene } from './render/scene';
import { createView } from './render/meshes';
import { followCamera, setLift, shake, setZoom, setLead } from './render/camera';
import { createColdOpen } from './ui/coldopen';
import { createHud } from './ui/hud';
import { createCardPicker } from './ui/cards';
import { createDeck } from './ui/deck';
import { createCardArt } from './render/cardArt';
import { createTitle } from './ui/title';
import { loadSettings, saveSettings } from './ui/settings';
import { createTitleScene } from './render/titleScene';
import { createStory } from './ui/story';
import { createResult } from './ui/result';
import { createRanking } from './ui/ranking';
import { createCodex, recordCodex } from './ui/codex';
import { createCombo } from './ui/combo';
import { createPause } from './ui/pause';
import { createPrologue } from './ui/prologue';
import { tickFps } from './ui/fps';
import { unlock, startMusic, toggleMute, isMuted, setPaused, setMuted, soundFrame, sfx, onBeat, duckMusic } from './audio';
import * as THREE from 'three';
import { installDev } from './dev';
import balance from './data/balance.json';
import dialogue from './data/dialogue.json';

// 타이틀 → 콜드 오픈 → 프롤로그 → 플레이 → 엔딩 문장 → 결과 카드 → 랭킹 → 타이틀
// 타이틀에서 입력이 없으면 demo(자동 시연, 프롤로그 없음)
type Phase = 'title' | 'cold' | 'prologue' | 'play' | 'victory' | 'ending' | 'result' | 'rank' | 'demo';
let phase: Phase = 'title';
let world: World = createWorld();
let paused = false, idle = 0, demoPick = 0;
let demoBot = createBot(BOTS.novice);
let bossGlow = 0, coldScale = 1, coldGlow = 0, coldStarted = false;
let titleT = 0; // 타이틀 등장 연출 진행 (초점이 맞아 가는 정도)
const BOSS_KIND = ENEMIES.findIndex((e) => e.id === balance.boss.id);

const { renderer, scene, camera, composer, setGlow, setAct, setDefocus, useView, setColorblind, ripple, updateRipples, prewarm } = createScene();
const titleScene = createTitleScene();
onBeat(() => titleScene.beat());
titleScene.onGlare(() => { if (phase === 'title') sfx.growl(); });
addEventListener('resize', () => titleScene.resize());

// 설정: 소리, 색약 모드 (기기에 남음)
const settings = loadSettings();
const applySettings = () => {
  setMuted(settings.muted);
  document.body.classList.toggle('cb', settings.cb);
  setColorblind(settings.cb);
};
applySettings();
const view = createView(scene, camera, ripple);

// 히트스톱: 큰 것이 이긴다 (쌓이지 않음). 처치 히트스톱은 0.4초에 한 번까지만.
const HITSTOP = { kill: 0.03, burst: 0.05, boss: 0.08 };
let hitstop = 0, killStopCd = 0, prevEvolveN = 0, bossZoomT = 0;
// 보스 등장: introSeconds 동안 카메라가 보스를 비추고 게임 속도를 줄인다
let bossIntroT = 0, prevBossSpawned = false;
const bossFocus = new THREE.Vector3();
// 보스 처치: 0.5초 슬로모션 → 섬광·폭발 → 0.3초 정적 → 승리 음악 → 엔딩
let victoryT = -1;
// 이번 프레임에 세계가 움직였는지. 안 움직인 프레임은 지난 이벤트를 비워 연출이 반복되지 않게 한다.
let stepped = false;
const step = (w: World, d: number, mv: { x: number; y: number }) => { stepped = true; updateWorld(w, d, mv); };
const flashEl = document.createElement('div');
flashEl.id = 'flash';
document.body.appendChild(flashEl);
function feel(w: World, realDt: number) {
  killStopCd -= realDt;
  let want = 0;
  if (w.deaths.length && killStopCd <= 0) { want = HITSTOP.kill; killStopCd = 0.4; }
  if (w.bursts.length || w.evolveLog.length > prevEvolveN) want = Math.max(want, HITSTOP.burst);
  if (w.fx.bossHit) want = Math.max(want, HITSTOP.boss);
  prevEvolveN = w.evolveLog.length;
  hitstop = Math.max(hitstop, want);
  // 카메라: 적이 많을수록 최대 15% 줌아웃, 보스 처치 순간 0.4초 줌인
  if (w.deaths.some((d) => d.kind === BOSS_KIND)) bossZoomT = 0.4;
  bossZoomT -= realDt;
  setZoom(bossZoomT > 0 ? -0.22 : Math.min(0.15, w.enemies.count / 300 * 0.15), bossZoomT > 0.35);
}
const updateHud = createHud();
const cardArt = createCardArt();
const deck = createDeck();
let artFocus = -1, defocus = 0;
const updatePicker = createCardPicker({
  pick(i) {
    if (phase !== 'play') return;
    selectCard(world, i);
    sfx.card();
  },
  show: (canvases, ids) => cardArt.show(canvases, ids),
  hide: () => { cardArt.hide(); artFocus = -1; },
  focus: (i) => { artFocus = i; },
  deckTarget: () => deck.target(),
});
const title = createTitle({
  start: () => startColdOpen(),
  codex: () => codex.open(),
  rank: () => ranking.showBoard(),
  settings: () => settings,
  toggle(k) {
    settings[k] = !settings[k];
    saveSettings(settings);
    applySettings();
    mutedEl.hidden = !settings.muted;
  },
});
const story = createStory();
const result = createResult();
const ranking = createRanking();
const codex = createCodex();
const updateCombo = createCombo();

const mutedEl = document.createElement('div');
mutedEl.id = 'muted';
mutedEl.hidden = true;
mutedEl.textContent = dialogue.ui.muted;
document.body.appendChild(mutedEl);
const mute = () => {
  settings.muted = toggleMute();
  saveSettings(settings);
  mutedEl.hidden = !settings.muted;
};
mutedEl.hidden = !settings.muted;

function startGame() {
  world = createWorld();
  bossIntroT = 0;
  prevBossSpawned = false;
  victoryT = -1;
  hitstop = 0;
  prevEvolveN = 0;
  setZoom(0, true);
  setLead(0, 0);
  story.reset();
  phase = 'play';
}

// 프롤로그 ③부터 보이는 몸속 장면: 구균 몇 마리가 가장자리에서 흘러 들어온다 (실제 판과는 별개인 세계)
function previewWorld() {
  const w = createWorld();
  w.player.hp = w.player.maxHp = 1e9;
  w.player.xpToNext = 1e9;
  w.spawnAcc = w.spawnAcc.map(() => -1e9);
  w.nextPill = Infinity;
  const coccus = kindOf('coccus');
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + Math.random() * 0.4, r = 13 + Math.random() * 3;
    addEnemy(w, coccus, Math.cos(a) * r, Math.sin(a) * r);
  }
  return w;
}

// 콜드 오픈 장면: 3막 보스전 한복판 (실제 판과는 별개인 세계)
function coldWorld() {
  const w = createWorld();
  w.time = balance.boss.at + 1;
  w.player.hp = w.player.maxHp = 1e9;
  w.player.xpToNext = 1e9;
  w.spawnAcc = w.spawnAcc.map(() => -1e9);
  w.nextPill = Infinity;
  w.fireCd = Infinity; // 슬로모션 순간까지 공격을 아껴 화면이 적으로 가득 차게
  const kinds = ['coccus', 'bacillus', 'virus', 'resistantCoccus'].map(kindOf);
  for (let n = 0; n < 280; n++) {
    const a = Math.random() * Math.PI * 2, r = 3.2 + Math.random() * 15;
    addEnemy(w, kinds[n % kinds.length], Math.cos(a) * r, Math.sin(a) * r);
  }
  const b = addEnemy(w, BOSS_KIND, 0, -6.5);
  w.enemies.f.hp[b] = w.boss.maxHp = 1e6; // 장면용 보스는 쓰러지지 않는다
  w.boss.spawned = true;
  w.bossTime = 1;
  return w;
}

const coldOpen = createColdOpen({
  setup() {
    coldStarted = true;
    world = coldWorld();
    setLift(0.1);
    followCamera(camera, view.player.position, 0, true);
  },
  roar: () => shake(1.4),
  sweep() {
    // 진화 공격: 대식세포 군단이 깨어나고, 가까운 적에 표식 → 고전 경로 연쇄 폭발
    const w = world, e = w.enemies.f;
    Object.assign(w.cards, { macrophage: 3, cytokine: 2, antibody: 3, complement: 2, nk: 2 });
    w.evolved.classical = w.evolved.activatedMacrophage = true;
    w.fireCd = 0;
    const near = [...Array(w.enemies.count).keys()].filter((i) => e.kind[i] !== BOSS_KIND)
      .sort((a, b) => Math.hypot(e.x[a], e.y[a]) - Math.hypot(e.x[b], e.y[b])).slice(0, 70);
    for (const i of near) e.mark[i] = 4;
    w.timers.complement = 0;
    coldGlow = 0.55;
    shake(0.9);
  },
  slow: (k) => { coldScale = k; },
  done() {
    phase = 'prologue';
    prologue.play();
  },
  skipAll() {
    setLift(0);
    startGame();
  },
});

function startColdOpen() {
  phase = 'cold';
  coldStarted = false;
  title.showDemo(false);
  titleScene.dive();
  title.focusOut(() => { if (phase === 'cold') coldOpen.play(); });
}

const prologue = createPrologue({
  reveal() {
    world = previewWorld();
    followCamera(camera, view.player.position, 0, true);
  },
  setLift,
  done: startGame,
});

function setPause(on: boolean) {
  paused = on;
  setPaused(on);
  on ? pause.open() : pause.close();
}

const pause = createPause((a) => {
  if (a === 'resume') setPause(false);
  else if (a === 'restart') { setPause(false); startGame(); }
  else if (a === 'sound') { mute(); pause.refresh(); }
  else if (a === 'codex') codex.open();
  else { setPause(false); toTitle(); }
}, isMuted);
pause.btn.addEventListener('click', () => { if (canPause()) setPause(!paused); });

const canPause = () => phase === 'play' && !world.choosing && !world.over;
// 탭이 가려지거나 창이 포커스를 잃으면 자동 일시정지
const autoPause = () => { if (canPause() && !paused) setPause(true); };
document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });

function toTitle() {
  result.hide();
  ranking.hide();
  story.reset();
  title.showDemo(false);
  world = createWorld();
  setLift(0);
  phase = 'title';
  idle = 0;
  titleT = 0;
  titleScene.reset();
  title.showTitle(true);
}

function startDemo() {
  world = createWorld();
  demoBot = createBot(BOTS.novice);
  story.reset();
  title.showTitle(false);
  title.showDemo(true);
  phase = 'demo';
}

const dev = installDev({
  world: () => world,
  phase: () => (paused ? 'paused' : phase),
  info: () => ({ ...renderer.info.memory, programs: renderer.info.programs?.length ?? 0, ...view.debug(), enemies: world.enemies.count }),
  restartFromTop() {
    setPause(false);
    toTitle();
    startColdOpen();
  },
  typing: () => phase === 'rank' && ranking.entering,
});

const keys = new Set<string>();
addEventListener('keydown', (e) => {
  keys.add(e.code);
  unlock(startMusic); // 브라우저 정책: 첫 키 입력 때 오디오 시작
  if (e.code === 'Space' && phase !== 'rank') e.preventDefault();
  if (e.repeat) return;
  idle = 0;
  if (codex.isOpen) return void codex.key(e);
  if (ranking.boardOpen) { if (['Enter', 'Escape', 'KeyR', 'Space'].includes(e.code)) ranking.hide(); return; }
  if (phase === 'rank') { if (ranking.key(e)) toTitle(); return; }
  if (phase === 'prologue') return prologue.key(e);
  if (phase === 'cold') return coldOpen.key(e);
  if (paused) {
    if (e.code === 'KeyM') { mute(); pause.refresh(); return; } // 일시정지 중에도 M으로 소리 켜기·끄기
    return pause.key(e);
  }
  if (phase === 'play' && (e.code === 'Escape' || e.code === 'KeyP')) { if (canPause()) setPause(true); return; }
  if (e.code === 'KeyM') return mute();
  if (phase === 'demo') toTitle();
  else if (phase === 'title') {
    if (title.key(e)) return;
    if (e.code === 'KeyD') codex.open();
  } else if (phase === 'result' && (e.code === 'Enter' || e.code === 'KeyR')) {
    result.hide();
    ranking.show(score(world));
    phase = 'rank';
  }
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); autoPause(); });
const held = (...codes: string[]) => codes.some((c) => keys.has(c));

toTitle();
view.sync(world, 0, 0);
prewarm([scene, camera], [titleScene.scene, titleScene.camera]);
followCamera(camera, view.player.position, 0, true);

let last = performance.now();
function frame(now: number) {
  const realDt = Math.min((now - last) / 1000, 0.1);
  last = now;
  const dt = paused ? 0 : realDt; // 일시정지: 게임 시간과 화면 효과 모두 멈춤
  if (phase === 'title' && !codex.isOpen && !ranking.boardOpen && (idle += realDt) > balance.attract.idleSeconds) startDemo();
  if (phase === 'play' && (paused || hitstop > 0)) {
    if (!paused) hitstop -= realDt; // 히트스톱: 세계가 잠깐 멈춤
  }
  else if (phase === 'play' && !paused) {
    const move = {
      x: +held('ArrowRight', 'KeyD') - +held('ArrowLeft', 'KeyA'),
      y: +held('ArrowDown', 'KeyS') - +held('ArrowUp', 'KeyW'),
    };
    setLead(move.x * 1.6, move.y * 1.6); // 이동 방향으로 약간 앞을 본다
    if (world.boss.spawned && !prevBossSpawned) { bossIntroT = balance.boss.introSeconds; duckMusic(0.35, 0.6); }
    prevBossSpawned = world.boss.spawned;
    step(world, bossIntroT > 0 ? dt * balance.boss.introTimeScale : dt, move);
    bossIntroT -= realDt;
    feel(world, realDt);
    recordCodex(world);
    if (world.over && world.won) { phase = 'victory'; victoryT = 0; story.reset(); }
    else if (world.over) {
      phase = 'ending';
      story.reset();
      result.show(world, () => { phase = 'result'; });
    }
  } else if (phase === 'demo') {
    // 초보 봇이 플레이. 카드는 보여 줄 시간을 둔 뒤 무작위로 고른다.
    if (world.choosing && (demoPick += dt) > balance.attract.pickDelay) {
      demoPick = 0;
      selectCard(world, Math.floor(Math.random() * world.choosing.length));
    }
    step(world, dt, demoBot(world, dt));
    if (world.over) toTitle();
  } else if (phase === 'prologue') step(world, dt, { x: 0, y: 0 });
  else if (phase === 'cold') {
    step(world, dt * coldScale, { x: 0, y: 0 });
    world.dmgNums.length = 0; // 장면을 깔끔하게: 피해 숫자·항원 조각 없음
    world.gems.count = 0;
  }
  // 타이틀(과 시작 직후 렌즈가 좁혀지는 동안)은 백혈구 클로즈업 장면, 나머지는 게임 장면
  const titleView = phase === 'title' || (phase === 'cold' && !coldStarted);
  useView(titleView ? titleScene.scene : scene, titleView ? titleScene.camera : camera, titleView);
  if (titleView) { titleScene.update(realDt); titleT = Math.min(1, titleT + realDt / title.entranceSeconds); }
  if (!stepped) clearEvents(world); // 세계가 안 움직인 프레임: 지난 이벤트로 연출·소리가 반복되지 않게
  stepped = false;
  dev.frame(world);
  soundFrame(world, phase === 'play' || phase === 'cold');
  const frozen = phase === 'play' && hitstop > 0;
  if (phase === 'victory') {
    const prev = victoryT;
    victoryT += realDt;
    if (prev < 0.5 && victoryT >= 0.5) { // 섬광 + 큰 폭발
      flashEl.classList.remove('on'); void flashEl.offsetWidth; flashEl.classList.add('on');
      view.bossExplode();
      shake(2);
      bossGlow = 1;
      sfx.bossDeath();
      duckMusic(0, 0.3 + 2.4, 0.8); // 정적 0.3초, 승리 음악 동안도 브금은 낮게
    }
    if (prev < 0.8 && victoryT >= 0.8) sfx.victory();
    if (prev < 3.6 && victoryT >= 3.6) {
      phase = 'ending';
      result.show(world, () => { phase = 'result'; });
    }
  }
  view.sync(world, frozen ? 0 : phase === 'victory' && victoryT < 0.5 ? dt * 0.2 : dt, now / 1000);
  updateRipples(paused ? 0 : realDt);
  setAct(world.act, dt);
  // 보스 등장 동안은 보스를 비춘다
  let focus = view.player.position;
  if (bossIntroT > 0 && phase === 'play') {
    const e = world.enemies.f;
    for (let i = 0; i < world.enemies.count; i++) if (e.kind[i] === BOSS_KIND) bossFocus.set(e.x[i], 1, e.y[i]);
    focus = bossFocus;
  }
  followCamera(camera, focus, dt);
  // 빛 번짐은 레벨업·진화·보스 처치 순간에만
  if (world.deaths.some((d) => d.kind === BOSS_KIND)) bossGlow = 1;
  bossGlow = Math.max(0, bossGlow - realDt * 0.7);
  setGlow(Math.max(
    world.slowmo > 0 ? 1 - world.slowmo / balance.levelUp.slowmoTime : 0,
    world.evoSlow > 0 ? world.evoSlow / balance.evolutions.slowmoTime : 0,
    bossGlow,
    coldGlow,
  ));
  coldGlow = Math.max(0, coldGlow - realDt * 0.9);
  composer.render();
  const inGame = phase === 'play' || phase === 'victory' || phase === 'ending' || phase === 'demo';
  updateHud(inGame ? world : null);
  updateCombo(inGame ? world : null);
  updatePicker(world);
  deck.update(inGame ? world : null);
  cardArt.render(realDt, artFocus);
  // 레벨업 슬로모션부터 카드 고르는 동안 초점이 나간다
  const wantDefocus = phase === 'title' ? 1 - titleT // 처음 나타날 때 초점이 맞듯 선명해짐
    : world.choosing ? 1 : world.slowmo > 0 ? 1 - world.slowmo / balance.levelUp.slowmoTime : 0;
  defocus += (wantDefocus - defocus) * Math.min(1, realDt * 10);
  setDefocus(defocus < 0.01 ? 0 : defocus);
  if ((phase === 'play' && !paused) || phase === 'demo') story.update(world, phase === 'play');
  pause.btn.hidden = !(phase === 'play' && !world.choosing && !world.over);
  tickFps(realDt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
