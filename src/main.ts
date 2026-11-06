import { createWorld, updateWorld } from './game/world';
import { createScene } from './render/scene';
import { createView } from './render/meshes';
import { followCamera } from './render/camera';
import { createHud } from './ui/hud';
import { createCardPicker } from './ui/cards';
import { selectCard } from './game/cards';
import balance from './data/balance.json';
import { tickFps } from './ui/fps';

const world = createWorld();

const keys = new Set<string>();
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyR' && world.over) location.reload();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
const held = (...codes: string[]) => codes.some((c) => keys.has(c));

const { scene, camera, composer, setGlow } = createScene();
const view = createView(scene);
const updateHud = createHud();
const updatePicker = createCardPicker((i) => selectCard(world, i));

view.sync(world, 0, 0);
followCamera(camera, view.player.position, 0, true);

let last = performance.now();
function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  const move = {
    x: +held('ArrowRight', 'KeyD') - +held('ArrowLeft', 'KeyA'),
    y: +held('ArrowDown', 'KeyS') - +held('ArrowUp', 'KeyW'),
  };
  updateWorld(world, dt, move);
  view.sync(world, dt, now / 1000);
  followCamera(camera, view.player.position, dt);
  // 슬로모션 동안 빛이 퍼지고, 카드 고르는 동안 은은하게 유지
  setGlow(world.slowmo > 0 ? 1 - world.slowmo / balance.levelUp.slowmoTime : world.choosing ? 0.35 : 0);
  composer.render();
  updateHud(world);
  updatePicker(world);
  tickFps(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
