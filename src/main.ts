import './ui/style.css';
import { createWorld, updateWorld, type World } from './game/world';
import { selectCard } from './game/cards';
import { createScene } from './render/scene';
import { createView } from './render/meshes';
import { followCamera } from './render/camera';
import { createHud } from './ui/hud';
import { createCardPicker } from './ui/cards';
import { createTitle } from './ui/title';
import { createStory } from './ui/story';
import { createResult } from './ui/result';
import { tickFps } from './ui/fps';
import balance from './data/balance.json';

// 타이틀 → 인트로 → 플레이 → 엔딩 문장 → 결과 카드 → 타이틀
type Phase = 'title' | 'intro' | 'play' | 'ending' | 'result';
let phase: Phase = 'title';
let world: World = createWorld();

const { scene, camera, composer, setGlow, setAct } = createScene();
const view = createView(scene, camera);
const updateHud = createHud();
const updatePicker = createCardPicker((i) => selectCard(world, i));
const title = createTitle();
const story = createStory();
const result = createResult();

function startGame() {
  world = createWorld();
  story.reset();
  phase = 'play';
}

function toTitle() {
  result.hide();
  world = createWorld();
  phase = 'title';
  title.showTitle(true);
}

const keys = new Set<string>();
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.repeat) return;
  if (phase === 'title') {
    phase = 'intro';
    title.showTitle(false);
    title.playIntro(startGame);
  } else if (phase === 'intro') title.skipIntro();
  else if (phase === 'result' && (e.code === 'Enter' || e.code === 'KeyR')) toTitle();
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
  if (phase === 'play') {
    const move = {
      x: +held('ArrowRight', 'KeyD') - +held('ArrowLeft', 'KeyA'),
      y: +held('ArrowDown', 'KeyS') - +held('ArrowUp', 'KeyW'),
    };
    updateWorld(world, dt, move);
    if (world.over) {
      phase = 'ending';
      story.reset();
      result.show(world, () => { phase = 'result'; });
    }
  }
  view.sync(world, dt, now / 1000);
  setAct(world.act, dt);
  followCamera(camera, view.player.position, dt);
  // 슬로모션 동안 빛이 퍼지고, 카드 고르는 동안 은은하게 유지
  setGlow(world.slowmo > 0 ? 1 - world.slowmo / balance.levelUp.slowmoTime : world.choosing ? 0.35 : 0);
  composer.render();
  updateHud(phase === 'play' || phase === 'ending' ? world : null);
  updatePicker(world);
  if (phase === 'play') story.update(world);
  tickFps(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
