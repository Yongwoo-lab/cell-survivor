import './ui/style.css';
import { createWorld, updateWorld, type World } from './game/world';
import { selectCard } from './game/cards';
import { createBot, BOTS } from './game/bot';
import { score } from './game/result';
import { createScene } from './render/scene';
import { createView } from './render/meshes';
import { followCamera } from './render/camera';
import { createHud } from './ui/hud';
import { createCardPicker } from './ui/cards';
import { createTitle } from './ui/title';
import { createStory } from './ui/story';
import { createResult } from './ui/result';
import { createRanking } from './ui/ranking';
import { createCodex, recordCodex } from './ui/codex';
import { tickFps } from './ui/fps';
import { unlock, startMusic, toggleMute, soundFrame, sfx } from './audio';
import balance from './data/balance.json';
import dialogue from './data/dialogue.json';

// 타이틀 → 인트로 → 플레이 → 엔딩 문장 → 결과 카드 → 랭킹 → 타이틀
// 타이틀에서 입력이 없으면 demo(자동 시연)
type Phase = 'title' | 'intro' | 'play' | 'ending' | 'result' | 'rank' | 'demo';
let phase: Phase = 'title';
let world: World = createWorld();
let idle = 0, demoPick = 0;
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
title.onCodex(() => { if (phase === 'title') codex.open(); });

const mutedEl = document.createElement('div');
mutedEl.id = 'muted';
mutedEl.hidden = true;
mutedEl.textContent = dialogue.ui.muted;
document.body.appendChild(mutedEl);

function startGame() {
  world = createWorld();
  story.reset();
  phase = 'play';
}

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

const keys = new Set<string>();
addEventListener('keydown', (e) => {
  keys.add(e.code);
  unlock(startMusic); // 브라우저 정책: 첫 키 입력 때 오디오 시작
  if (e.repeat) return;
  idle = 0;
  if (phase === 'rank') {
    if (ranking.key(e)) toTitle();
    return;
  }
  if (codex.isOpen) {
    codex.key(e);
    return;
  }
  if (phase === 'title' && e.code === 'KeyD') {
    codex.open();
    return;
  }
  if (e.code === 'KeyM') {
    mutedEl.hidden = !toggleMute();
    return;
  }
  if (phase === 'demo') toTitle();
  else if (phase === 'title') {
    phase = 'intro';
    title.showTitle(false);
    title.playIntro(startGame);
  } else if (phase === 'intro') title.skipIntro();
  else if (phase === 'result' && (e.code === 'Enter' || e.code === 'KeyR')) {
    result.hide();
    ranking.show(score(world));
    phase = 'rank';
  }
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
const held = (...codes: string[]) => codes.some((c) => keys.has(c));

title.showTitle(true);
view.sync(world, 0, 0);
followCamera(camera, view.player.position, 0, true);

let last = performance.now();
function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (phase === 'title' && !codex.isOpen && (idle += dt) > balance.attract.idleSeconds) startDemo();
  if (phase === 'play') {
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
  }
  soundFrame(world, phase === 'play');
  view.sync(world, dt, now / 1000);
  setAct(world.act, dt);
  followCamera(camera, view.player.position, dt);
  // 슬로모션 동안 빛이 퍼지고, 카드 고르는 동안 은은하게 유지
  setGlow(world.slowmo > 0 ? 1 - world.slowmo / balance.levelUp.slowmoTime : world.choosing ? 0.35 : 0);
  composer.render();
  updateHud(phase === 'play' || phase === 'ending' || phase === 'demo' ? world : null);
  updatePicker(world);
  if (phase === 'play' || phase === 'demo') story.update(world, phase === 'play');
  tickFps(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
