import { createWorld, updateWorld } from './game/world';
import { createScene } from './render/scene';
import { createPlayerMesh, createCocciMesh, syncMeshes } from './render/meshes';
import { followCamera } from './render/camera';
import { tickFps } from './ui/fps';

const keys = new Set<string>();
addEventListener('keydown', (e) => keys.add(e.code));
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
const held = (...codes: string[]) => codes.some((c) => keys.has(c));

const world = createWorld();
const { scene, camera, composer } = createScene();
const player = createPlayerMesh();
const cocci = createCocciMesh(world.cocci.count, world.cocci.radius);
scene.add(player, cocci);

syncMeshes(world, player, cocci, 0);
followCamera(camera, player.position, 0, true);

let last = performance.now();
function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  const move = {
    x: +held('ArrowRight', 'KeyD') - +held('ArrowLeft', 'KeyA'),
    y: +held('ArrowDown', 'KeyS') - +held('ArrowUp', 'KeyW'),
  };
  updateWorld(world, dt, move);
  syncMeshes(world, player, cocci, now / 1000);
  followCamera(camera, player.position, dt);
  composer.render();
  tickFps(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
