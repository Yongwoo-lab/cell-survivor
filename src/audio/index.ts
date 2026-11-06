// 게임 상태 → 소리. 렌더처럼 world를 읽기만 한다.
import type { World } from '../game/world';
import { ENEMIES } from '../game/world';
import { sfx } from './sfx';
import { setMusicMode } from './music';

export { sfx } from './sfx';
export { unlock, toggleMute, isMuted } from './engine';
export { startMusic } from './music';

const BOSS = ENEMIES.findIndex((e) => e.id === 'superbug');
let seenWorld: World | null = null, prevAct = -1, prevSlowmo = 0;

export function soundFrame(w: World, withSfx: boolean) {
  setMusicMode(w.boss.spawned && !w.over ? 'boss' : w.act >= 1 ? 'tense' : 'calm');
  if (w !== seenWorld) { seenWorld = w; prevAct = -1; prevSlowmo = 0; }
  if (!withSfx) return;
  if (w.fx.shot) sfx.shot();
  if (w.fx.hit) sfx.hit();
  if (w.fx.pickup) sfx.pickup();
  if (w.fx.hurt) sfx.hurt();
  if (w.deaths.length) w.deaths.some((d) => d.kind === BOSS) ? sfx.bossDeath() : sfx.kill();
  if (w.slowmo > 0 && prevSlowmo <= 0) sfx.levelUp();
  prevSlowmo = w.slowmo;
  if (w.act !== prevAct) { if (prevAct >= 0 || w.time > 0) sfx.act(); prevAct = w.act; }
}
