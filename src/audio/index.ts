// 게임 상태 → 소리. 렌더처럼 world를 읽기만 한다.
import type { World } from '../game/world';
import { ENEMIES } from '../game/world';
import { sfx } from './sfx';
import { setTrack, setIntensity, stinger, type Track } from './music';

export { sfx } from './sfx';
export { unlock, toggleMute, isMuted, setPaused, setMuted, duckMusic } from './engine';
import balance from '../data/balance.json';
const TIERS = balance.juice.comboTiers;
export const comboTier = (n: number) => TIERS.filter((t) => n >= t).length;
export { startMusic, onBeat, musicTrack } from './music';

const BOSS = ENEMIES.findIndex((e) => e.id === 'superbug');
let seenWorld: World | null = null, prevAct = -1, prevSlowmo = 0, prevEvolved = 0, prevCombo = 0;

const ACT_TRACKS: Track[] = ['act1', 'act2', 'act3'];
const CROWD = 220; // 화면 적이 이만큼이면 음악 강도 최대

// menu: 타이틀·자동 시연 (타이틀 곡)
export function soundFrame(w: World, withSfx: boolean, menu = false) {
  setTrack(menu ? 'title' : w.over ? (w.won ? 'win' : 'lose') : w.boss.spawned ? 'boss' : ACT_TRACKS[w.act]);
  setIntensity(w.enemies.count / CROWD);
  if (w !== seenWorld) { seenWorld = w; prevAct = -1; prevSlowmo = 0; prevEvolved = 0; }
  if (!withSfx) return;
  if (w.fx.shot) sfx.shot();
  if (w.fx.hit) sfx.hit();
  if (w.fx.pickup) sfx.pickup();
  if (w.fx.hurt) sfx.hurt();
  if (w.fx.pill) sfx.pill();
  if (w.evolveLog.length > prevEvolved) { sfx.evolve(); stinger('evolve'); }
  prevEvolved = w.evolveLog.length;
  // 보스 처치 소리는 처치 연출(main의 승리 시퀀스)에서 낸다
  if (w.deaths.some((d) => d.kind !== BOSS)) sfx.kill(comboTier(w.combo));
  if (comboTier(w.combo) > comboTier(prevCombo)) sfx.combo(comboTier(w.combo));
  prevCombo = w.combo;
  if (w.slowmo > 0 && prevSlowmo <= 0) { sfx.levelUp(); stinger('level'); }
  prevSlowmo = w.slowmo;
  if (w.act !== prevAct) { if (prevAct >= 0 || w.time > 0) sfx.act(); prevAct = w.act; }
}
