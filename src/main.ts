import './ui/fonts.css';
import './ui/style.css';
import { createWorld, updateWorld, type World } from './game/world';
import { selectCard } from './game/cards';
import { addEnemy, kindOf } from './game/spawner';
import { createBot, BOTS } from './game/bot';
import { score } from './game/result';
import { createScene } from './render/scene';
import { createView } from './render/meshes';
import { followCamera, setLift } from './render/camera';
import { createHud } from './ui/hud';
import { createCardPicker } from './ui/cards';
import { createTitle } from './ui/title';
import { createStory } from './ui/story';
import { createResult } from './ui/result';
import { createRanking } from './ui/ranking';
import { createCodex, recordCodex } from './ui/codex';
import { createCombo } from './ui/combo';
import { createPause } from './ui/pause';
import { createPrologue } from './ui/prologue';
import { tickFps } from './ui/fps';
import { unlock, startMusic, toggleMute, isMuted, setPaused, soundFrame, sfx } from './audio';
import { installDev } from './dev';
import balance from './data/balance.json';
import dialogue from './data/dialogue.json';

// 타이틀 → 프롤로그 → 플레이 → 엔딩 문장 → 결과 카드 → 랭킹 → 타이틀
// 타이틀에서 입력이 없으면 demo(자동 시연, 프롤로그 없음)
type Phase = 'title' | 'prologue' | 'play' | 'ending' | 'result' | 'rank' | 'demo';
let phase: Phase = 'title';
let world: World = createWorld();
let paused = false, idle = 0, demoPick = 0;
let demoBot = createBot(BOTS.novice);

const { scene, camera, composer, setGlow, setAct } = createScene();
const view = createView(scene, camera);
const updateHud = createHud();
const updatePicker = createCardPicker((i) => {
  if (phase !== 'play') return;
  selectCard(world, i);
  sfx.card();
});
const title = createTitle();
const story = createStory();
const result = createResult();
const ranking = createRanking();
const codex = createCodex();
const updateCombo = createCombo();
title.onCodex(() => { if (phase === 'title') codex.open(); });

const mutedEl = document.createElement('div');
mutedEl.id = 'muted';
mutedEl.hidden = true;
mutedEl.textContent = dialogue.ui.muted;
document.body.appendChild(mutedEl);
const mute = () => { mutedEl.hidden = !toggleMute(); };

function startGame() {
  world = createWorld();
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
  phase = 'title';
  idle = 0;
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
  restartFromTop() {
    setPause(false);
    result.hide();
    ranking.hide();
    toTitle();
    phase = 'prologue';
    title.showTitle(false);
    prologue.play();
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
  if (phase === 'rank') { if (ranking.key(e)) toTitle(); return; }
  if (phase === 'prologue') return prologue.key(e);
  if (paused) return pause.key(e);
  if (phase === 'play' && (e.code === 'Escape' || e.code === 'KeyP')) { if (canPause()) setPause(true); return; }
  if (e.code === 'KeyM') return mute();
  if (phase === 'demo') toTitle();
  else if (phase === 'title') {
    if (e.code === 'KeyD') return codex.open();
    phase = 'prologue';
    title.showTitle(false);
    prologue.play();
  } else if (phase === 'result' && (e.code === 'Enter' || e.code === 'KeyR')) {
    result.hide();
    ranking.show(score(world));
    phase = 'rank';
  }
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); autoPause(); });
const held = (...codes: string[]) => codes.some((c) => keys.has(c));

title.showTitle(true);
view.sync(world, 0, 0);
followCamera(camera, view.player.position, 0, true);

let last = performance.now();
function frame(now: number) {
  const realDt = Math.min((now - last) / 1000, 0.1);
  last = now;
  const dt = paused ? 0 : realDt; // 일시정지: 게임 시간과 화면 효과 모두 멈춤
  if (phase === 'title' && !codex.isOpen && (idle += realDt) > balance.attract.idleSeconds) startDemo();
  if (phase === 'play' && !paused) {
    const move = {
      x: +held('ArrowRight', 'KeyD') - +held('ArrowLeft', 'KeyA'),
      y: +held('ArrowDown', 'KeyS') - +held('ArrowUp', 'KeyW'),
    };
    updateWorld(world, dt, move);
    recordCodex(world);
    if (world.over) {
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
    updateWorld(world, dt, demoBot(world, dt));
    if (world.over) toTitle();
  } else if (phase === 'prologue') updateWorld(world, dt, { x: 0, y: 0 });
  dev.frame(world);
  soundFrame(world, phase === 'play');
  view.sync(world, dt, now / 1000);
  setAct(world.act, dt);
  followCamera(camera, view.player.position, dt);
  // 슬로모션 동안 빛이 퍼지고, 카드 고르는 동안 은은하게 유지
  setGlow(world.slowmo > 0 ? 1 - world.slowmo / balance.levelUp.slowmoTime : world.choosing ? 0.35 : 0);
  composer.render();
  const inGame = phase === 'play' || phase === 'ending' || phase === 'demo';
  updateHud(inGame ? world : null);
  updateCombo(inGame ? world : null);
  updatePicker(world);
  if ((phase === 'play' && !paused) || phase === 'demo') story.update(world, phase === 'play');
  pause.btn.hidden = !(phase === 'play' && !world.choosing && !world.over);
  tickFps(realDt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
