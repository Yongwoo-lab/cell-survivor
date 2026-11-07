// 게임 상태. 2D 좌표(x, y)만 쓰고 Three.js를 import하지 않는다.
import enemies from '../data/enemies.json';
import balance from '../data/balance.json';
import { Pool } from './pool';
import { SpatialHash } from './collision';
import { updateSpawner, addEnemy, kindOf, BOSS } from './spawner';
import { updateBoss, updateSpikes } from './boss';
import { type FieldCounts } from './result';
import { type Pick, cardLevel, updateCards, damageEnemy, drawCards, fireShot, nearestEnemies, atkMul, MAX_RADIUS, FLASH_TIME } from './cards';

const P = balance.player, S = balance.shot, X = balance.xp, L = balance.levelUp;
export const ENEMIES = enemies;
const VIRUS = kindOf('virus'), INFECTED = kindOf('infected');
const C = balance.cells, B = balance.boss;
const MINION = kindOf(B.minionId);
const A = balance.antibiotic, EV = balance.evolutions;
export const MAX_ENEMIES = 1024;

export interface Vec2 { x: number; y: number }

export function createWorld() {
  return {
    time: 0,
    over: false,
    // 첫 레벨업만 경험치를 줄여 손맛을 빨리 느끼게 한다 (firstLevelMul)
    player: { x: 0, y: 0, hp: P.hp, maxHp: P.hp, invuln: 0, xp: 0, level: 1, xpToNext: Math.round(X.base * X.firstLevelMul) },
    // silent: 처치가 아니라 사라짐 (바이러스가 세포에 들어감) → 조각·처치 수 없음
    // squint: 맞았을 때 눈을 찡그리는 시간 (화면 연출용)
    enemies: new Pool(MAX_ENEMIES, ['x', 'y', 'hp', 'flash', 'id', 'kind', 'mark', 'macroCd', 'spawnCd', 'silent', 'squint'] as const),
    cells: new Pool(64, ['x', 'y'] as const), // 움직이지 않는 정상 세포 (2막~)
    cellsPlaced: false,
    act: 0,
    won: false,
    boss: { spawned: false, hp: 0, maxHp: 0, phase2: false },
    shotCount: 0,
    bossTime: 0, // 보스 등장 후 지난 시간
    allOut: false, // 보스전이 길어지면 총공격 (모든 피해 +allOutBonus)
    // 진화
    evolved: {} as Record<string, boolean>,
    evolveLog: [] as string[], // 진화한 순서 (화면 연출용)
    evoSlow: 0,
    chains: [] as { x: number; y: number; depth: number; t: number }[], // 고전 경로 연쇄 폭발 예약
    macroR: balance.cardTuning.orbiterRadius,
    rain: [] as Vec2[], // 이번 프레임 형질세포 표식 위치
    // 항생제
    pills: new Pool(8, ['x', 'y', 'life'] as const),
    nextPill: A.firstAt,
    antibioticT: 0, // 효과 남은 시간
    antibioticUses: 0,
    noEffectHits: [] as Vec2[],
    noEffectCd: 0,
    notes: [] as string[],
    // 화면 재미 요소 (규칙에는 영향 없음)
    combo: 0,
    comboT: 0,
    dmgNums: [] as { x: number; y: number; v: number }[], // 이번 프레임 피해 숫자 // 정보 장교에게 말할 거리 (dialogue.officer 키)
    fx: { shot: 0, hit: 0, pickup: 0, hurt: 0, pill: 0, bossHit: 0, bossSpikes: 0 },
    // 보스 공격: idle → tele(바닥 예고) → dash / 가시 발사
    bossAtk: { state: 'idle' as 'idle' | 'tele' | 'dash', type: 'spikes' as 'dash' | 'spikes', t: balance.boss.patterns.cooldown, x: 0, y: 0, dx: 0, dy: 0 },
    spikes: new Pool(128, ['x', 'y', 'vx', 'vy', 'life'] as const), // 이번 프레임 효과음용 횟수
    bossWarn: 0, // >0 이면 보스 등장까지 남은 초 (경고 연출)
    resist: {} as Record<string, number>, // 공격 종류 → 피해 감소율 (보스 내성)
    resistPopCd: 0,
    resistHits: [] as Vec2[], // 이번 프레임 "내성!" 표시 위치
    infections: [] as Vec2[], // 이번 프레임 감염된 세포 위치
    seen: [] as number[], // 처음 등장한 적 종류 순서 (정보 장교 대사)
    shots: new Pool(512, ['x', 'y', 'vx', 'vy', 'life', 'kind'] as const), // kind 0 기본, 1 항체
    gems: new Pool(2048, ['x', 'y', 'xp', 'pulled'] as const),
    nets: new Pool(16, ['x', 'y', 'life', 'maxLife', 'radius'] as const),
    nk: new Pool(8, ['x', 'y', 'cd'] as const),
    macro: [] as Vec2[],
    // 이번 프레임 이벤트 (화면 연출용, 매 프레임 비움)
    deaths: [] as { x: number; y: number; kind: number }[],
    bursts: [] as { x: number; y: number; r: number }[],
    hash: new SpatialHash(MAX_ENEMIES),
    spawnAcc: enemies.map(() => 0),
    fireCd: S.interval,
    nextId: 0,
    cards: {} as Record<string, number>, // 카드 id → 단계
    timers: {} as Record<string, number>,
    kills: enemies.map(() => 0), // 종류별 처치 수 (기억세포)
    result: {} as FieldCounts,
    slowmo: 0, // 레벨업 슬로모션 남은 실시간(초)
    pendingLevels: 0,
    choosing: null as Pick[] | null, // 카드 선택 중이면 게임 정지
  };
}
export type World = ReturnType<typeof createWorld>;

// 이번 프레임 이벤트 비우기. 세계가 멈춘 프레임(일시정지·히트스톱)에도 불러야 연출이 반복되지 않는다.
export function clearEvents(w: World) {
  w.deaths.length = 0;
  w.bursts.length = 0;
  w.resistHits.length = 0;
  w.infections.length = 0;
  w.fx.shot = w.fx.hit = w.fx.pickup = w.fx.hurt = w.fx.pill = w.fx.bossHit = w.fx.bossSpikes = 0;
  w.rain.length = 0;
  w.noEffectHits.length = 0;
  w.dmgNums.length = 0;
}

export function updateWorld(w: World, realDt: number, move: Vec2) {
  clearEvents(w);
  if (w.over || w.choosing) return;
  let dt = realDt;
  if (w.evoSlow > 0) {
    dt *= L.slowmoScale; // 진화 슬로모션
    w.evoSlow -= realDt;
  }
  if (w.slowmo > 0) {
    dt *= L.slowmoScale;
    if ((w.slowmo -= realDt) <= 0) {
      w.slowmo = 0;
      const hand = drawCards(w);
      if (hand.length) w.choosing = hand;
      else w.pendingLevels = 0; // 모든 카드가 최대 단계
    }
  }
  w.time += dt;
  const pl = w.player;
  const speed = P.speed * (1 + (cardLevel(w, 'cytokine')?.moveSpeed ?? 0));
  const len = Math.hypot(move.x, move.y) || 1;
  pl.x += (move.x / len) * speed * dt;
  pl.y += (move.y / len) * speed * dt;
  pl.invuln -= dt;

  while (w.act + 1 < balance.acts.length && w.time >= balance.acts[w.act + 1].start) w.act++;
  updateSpawner(w, dt);

  // 보스 내성은 시간이 지나면 회복
  const bossRes = enemies[BOSS].resistance!;
  for (const k in w.resist) w.resist[k] = Math.max(0, w.resist[k] - bossRes.decayPerSec * dt);
  w.resistPopCd -= dt;
  w.noEffectCd -= dt;
  if ((w.comboT -= dt) <= 0) w.combo = 0;
  w.antibioticT -= dt;

  // 보스전이 길어지면 총공격
  if (w.boss.spawned && !w.allOut && (w.bossTime += dt) > B.allOutAfter) {
    w.allOut = true;
    w.notes.push('allOut');
  }

  // 항생제: 줍는 순간 세균 피해 증가, 대신 내성균이 생기고 슈퍼버그가 강해진다
  const pf = w.pills.f;
  for (let k = w.pills.count - 1; k >= 0; k--) {
    if ((pf.life[k] -= dt) <= 0) { w.pills.remove(k); continue; }
    if ((pf.x[k] - pl.x) ** 2 + (pf.y[k] - pl.y) ** 2 > A.pickupRadius ** 2) continue;
    w.pills.remove(k);
    w.antibioticT = A.duration;
    if (++w.antibioticUses === 1) w.notes.push('antibioticTaken');
    w.fx.pill++;
    for (let n = 0; n < A.resistantSpawn; n++) {
      const a = Math.random() * Math.PI * 2;
      addEnemy(w, MINION, pl.x + Math.cos(a) * A.resistantRing, pl.y + Math.sin(a) * A.resistantRing);
    }
    w.bursts.push({ x: pl.x, y: pl.y, r: 2 });
    if (w.boss.spawned) {
      const add = enemies[BOSS].hp * A.bossHpPerUse;
      w.boss.maxHp += add;
      for (let i = 0; i < w.enemies.count; i++) if (w.enemies.f.kind[i] === BOSS) w.enemies.f.hp[i] += add;
    }
  }

  // 적: 플레이어 추적. 발열·그물이 느리게 하고, 그물 위에서는 지속 피해.
  const E = w.enemies, e = E.f;
  const fever = 1 - (cardLevel(w, 'fever')?.enemySlow ?? 0);
  const nt = cardLevel(w, 'net'), n = w.nets.f;
  for (let i = 0; i < E.count; i++) {
    const def = enemies[e.kind[i]];
    let mul = fever;
    if (nt) for (let k = 0; k < w.nets.count; k++) {
      if ((e.x[i] - n.x[k]) ** 2 + (e.y[i] - n.y[k]) ** 2 > n.radius[k] ** 2) continue;
      mul *= 1 - nt.slow;
      damageEnemy(w, i, nt.dps * dt, 'net', false, dt);
      break;
    }
    let tx = pl.x, ty = pl.y;
    if (e.kind[i] === VIRUS) {
      // 가까운 정상 세포가 있으면 세포를 노린다
      let bd = C.virusSeekRange ** 2;
      for (let k = 0; k < w.cells.count; k++) {
        const d2 = (w.cells.f.x[k] - e.x[i]) ** 2 + (w.cells.f.y[k] - e.y[i]) ** 2;
        if (d2 < bd) { bd = d2; tx = w.cells.f.x[k]; ty = w.cells.f.y[k]; }
      }
    }
    if (e.kind[i] === INFECTED && (e.spawnCd[i] -= dt) <= 0) {
      e.spawnCd[i] = def.spawnVirusEvery!;
      if (E.count < balance.spawn.maxEnemies) addEnemy(w, VIRUS, e.x[i] + (Math.random() - 0.5), e.y[i] + (Math.random() - 0.5));
    }
    const dx = tx - e.x[i], dy = ty - e.y[i];
    const d = Math.hypot(dx, dy) || 1;
    if (e.kind[i] === BOSS && d > B.catchUpBeyond) mul *= B.catchUpMul; // 보스는 멀어지면 빠르게 따라붙는다
    if (e.kind[i] === BOSS && w.bossAtk.state !== 'idle') mul = 0; // 예고·돌진 중에는 패턴이 움직인다
    e.x[i] += (dx / d) * def.speed * mul * dt;
    e.y[i] += (dy / d) * def.speed * mul * dt;
    e.flash[i] -= dt;
    e.mark[i] -= dt;
    e.macroCd[i] -= dt;
    e.squint[i] -= dt;
  }
  updateBoss(w, dt, BOSS);
  updateSpikes(w, dt);
  if (pl.hp <= 0) w.over = true;

  // 바이러스가 정상 세포에 닿으면 세포가 감염세포로 바뀐다
  const cf = w.cells.f, hitCell = C.radius + enemies[VIRUS].radius;
  for (let i = 0; i < E.count; i++) {
    if (e.kind[i] !== VIRUS || e.hp[i] <= 0) continue;
    for (let k = 0; k < w.cells.count; k++) {
      if ((cf.x[k] - e.x[i]) ** 2 + (cf.y[k] - e.y[i]) ** 2 > hitCell * hitCell) continue;
      e.hp[i] = 0;
      e.silent[i] = 1;
      addEnemy(w, INFECTED, cf.x[k], cf.y[k]);
      w.infections.push({ x: cf.x[k], y: cf.y[k] });
      w.cells.remove(k);
      break;
    }
  }
  w.hash.build(e.x, e.y, E.count);

  // 적끼리 겹치지 않게 밀어냄
  for (let i = 0; i < E.count; i++) {
    const ri = enemies[e.kind[i]].radius;
    w.hash.query(e.x[i], e.y[i], ri + MAX_RADIUS, (j) => {
      if (j <= i) return;
      const minD = ri + enemies[e.kind[j]].radius;
      const dx = e.x[j] - e.x[i], dy = e.y[j] - e.y[i];
      const d2 = dx * dx + dy * dy;
      if (d2 >= minD * minD || d2 === 0) return;
      const d = Math.sqrt(d2), push = ((minD - d) * 0.5) / d;
      e.x[i] -= dx * push; e.y[i] -= dy * push;
      e.x[j] += dx * push; e.y[j] += dy * push;
    });
  }

  // 기본 공격: 가장 가까운 적에게 자동 발사
  w.fireCd -= dt;
  if (w.fireCd <= 0) {
    let [t] = nearestEnemies(w, 1);
    // 보스가 사거리 안이면 priorityEvery발 중 1발은 보스를 노린다
    if (t !== undefined && ++w.shotCount % B.priorityEvery === 0) {
      for (let i = 0; i < E.count; i++)
        if (e.kind[i] === BOSS && (e.x[i] - pl.x) ** 2 + (e.y[i] - pl.y) ** 2 < S.range ** 2) t = i;
    }
    if (t !== undefined) {
      w.fx.shot++;
      fireShot(w, 0, e.x[t], e.y[t], S.speed);
      w.fireCd = S.interval / atkMul(w);
    }
  }

  // 투사체 이동·명중 (항체 투사체는 피해 대신 표식)
  const SH = w.shots, s = SH.f;
  const ab = cardLevel(w, 'antibody');
  for (let k = SH.count - 1; k >= 0; k--) {
    s.x[k] += s.vx[k] * dt;
    s.y[k] += s.vy[k] * dt;
    s.life[k] -= dt;
    let hit = false;
    w.hash.query(s.x[k], s.y[k], S.radius + MAX_RADIUS, (i) => {
      const r = S.radius + enemies[e.kind[i]].radius;
      if (e.hp[i] <= 0 || (e.x[i] - s.x[k]) ** 2 + (e.y[i] - s.y[k]) ** 2 > r * r) return;
      if (s.kind[k] === 1) {
        if (ab) e.mark[i] = ab.markDuration;
        e.flash[i] = FLASH_TIME;
      } else damageEnemy(w, i, S.damage, 'shot');
      return (hit = true);
    });
    if (hit || s.life[k] <= 0) SH.remove(k);
  }

  updateCards(w, dt);

  // 적이 플레이어에 닿으면 피해 (맞은 뒤 잠깐 무적)
  if (pl.invuln <= 0) {
    w.hash.query(pl.x, pl.y, P.radius + MAX_RADIUS, (i) => {
      const def = enemies[e.kind[i]], r = P.radius + def.radius;
      if (e.hp[i] <= 0 || (e.x[i] - pl.x) ** 2 + (e.y[i] - pl.y) ** 2 > r * r) return;
      pl.hp = Math.max(0, pl.hp - def.damage);
      pl.invuln = P.invulnTime;
      w.fx.hurt++;
      if (e.kind[i] === BOSS) w.fx.bossHit++;
      return true;
    });
    if (pl.hp <= 0) w.over = true;
  }

  // 죽은 적 제거 → 항원 조각
  for (let i = E.count - 1; i >= 0; i--) {
    if (e.hp[i] > 0) continue;
    const kind = e.kind[i];
    if (e.silent[i]) { E.remove(i); continue; }
    // 콤보: comboWindow초 안에 연속 처치
    w.combo = w.comboT > 0 ? w.combo + 1 : 1;
    w.comboT = balance.juice.comboWindow;
    w.deaths.push({ x: e.x[i], y: e.y[i], kind });
    w.kills[kind]++;
    const g = w.gems.add();
    if (g >= 0) {
      const gf = w.gems.f;
      gf.x[g] = e.x[i]; gf.y[g] = e.y[i]; gf.xp[g] = enemies[kind].xp; gf.pulled[g] = 0;
    }
    E.remove(i);
  }

  // 보스 체력 (화면 표시용), 보스를 잡으면 승리
  if (w.boss.spawned) {
    let hp = 0, bi = -1;
    for (let i = 0; i < E.count; i++) if (e.kind[i] === BOSS) { hp = e.hp[i]; bi = i; }
    w.boss.hp = hp;
    if (hp <= 0) w.won = w.over = true;
    // 2페이즈: 체력이 절반 아래로 → 주변에 내성균 소환 (한 번만)
    else if (!w.boss.phase2 && hp < w.boss.maxHp * B.phase2At) {
      w.boss.phase2 = true;
      const bx = e.x[bi], by = e.y[bi];
      for (let k = 0; k < B.minionCount; k++) {
        const a = (k / B.minionCount) * Math.PI * 2;
        addEnemy(w, MINION, bx + Math.cos(a) * B.minionRing, by + Math.sin(a) * B.minionRing);
      }
      w.bursts.push({ x: bx, y: by, r: B.minionRing * 1.6 });
    }
  }

  // 항원 조각: 가까우면 자석처럼 끌려와 흡수
  const G = w.gems, g = G.f;
  for (let i = G.count - 1; i >= 0; i--) {
    const dx = pl.x - g.x[i], dy = pl.y - g.y[i];
    const d = Math.hypot(dx, dy);
    if (d < P.pickupRadius) {
      pl.xp += g.xp[i];
      w.fx.pickup++;
      G.remove(i);
      continue;
    }
    if (d < P.magnetRadius) g.pulled[i] = 1;
    if (g.pulled[i]) {
      const step = Math.min(d, P.magnetSpeed * dt);
      g.x[i] += (dx / d) * step;
      g.y[i] += (dy / d) * step;
    }
  }
  while (pl.xp >= pl.xpToNext) {
    pl.xp -= pl.xpToNext;
    pl.level++;
    pl.xpToNext = Math.round(X.base * X.growth ** (pl.level - 1));
    w.pendingLevels++;
  }
  if (w.pendingLevels > 0 && w.slowmo <= 0 && !w.choosing) w.slowmo = L.slowmoTime;
}
