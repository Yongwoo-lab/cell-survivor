// 게임 상태 → 소리. 렌더처럼 world를 읽기만 한다.
import type { World } from '../game/world';
import { ENEMIES } from '../game/world';
import { sfx } from './sfx';
import { setMusicMode } from './music';

export { sfx } from './sfx';
export { unlock, toggleMute, isMuted, setPaused } from './engine';
import balance from '../data/balance.json';
const TIERS = balance.juice.comboTiers;
export const comboTier = (n: number) => TIERS.filter((t) => n >= t).length;
export { startMusic, onBeat } from './music';

const BOSS = ENEMIES.findIndex((e) => e.id === 'superbug');
let seenWorld: World | null = null, prevAct = -1, prevSlowmo = 0, prevEvolved = 0, prevCombo = 0;

export function soundFrame(w: World, withSfx: boolean) {
  setMusicMode(w.boss.spawned && !w.over ? 'boss' : w.act >= 1 ? 'tense' : 'calm');
  if (w !== seenWorld) { seenWorld = w; prevAct = -1; prevSlowmo = 0; prevEvolved = 0; }
  if (!withSfx) return;
  if (w.fx.shot) sfx.shot();
  if (w.fx.hit) sfx.hit();
  if (w.fx.pickup) sfx.pickup();
  if (w.fx.hurt) sfx.hurt();
  if (w.fx.pill) sfx.pill();
  if (w.evolveLog.length > prevEvolved) sfx.evolve();
  prevEvolved = w.evolveLog.length;
  if (w.deaths.length) w.deaths.some((d) => d.kind === BOSS) ? sfx.bossDeath() : sfx.kill(comboTier(w.combo));
  if (comboTier(w.combo) > comboTier(prevCombo)) sfx.combo(comboTier(w.combo));
  prevCombo = w.combo;
  if (w.slowmo > 0 && prevSlowmo <= 0) sfx.levelUp();
  prevSlowmo = w.slowmo;
  if (w.act !== prevAct) { if (prevAct >= 0 || w.time > 0) sfx.act(); prevAct = w.act; }
}
