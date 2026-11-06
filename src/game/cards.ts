// 카드 효과. 수치는 cards.json의 levels, 동작 상수는 balance.json의 cardTuning·evolutions.
import cardData from '../data/cards.json';
import enemies from '../data/enemies.json';
import balance from '../data/balance.json';
import type { World } from './world';
import { addPick } from './result';

const cards = cardData.cards;
export const EVOLUTIONS = cardData.evolutions;
export type Card = (typeof cards)[number];
export type Evolution = (typeof EVOLUTIONS)[number];
export type Pick = Card | Evolution;
export const isEvolution = (c: Pick): c is Evolution => 'requires' in c;
type Lv = Record<string, number>;

const T = balance.cardTuning, S = balance.shot, EV = balance.evolutions, A = balance.antibiotic, B = balance.boss;
const kindIdx = (id: string) => enemies.findIndex((e) => e.id === id);
const BOSS = kindIdx(B.id), VIRUS_SET = new Set(A.noEffect.map(kindIdx)), BACTERIA = new Set(A.bacteria.map(kindIdx));
export const FLASH_TIME = 0.05;
export const MAX_RADIUS = Math.max(...enemies.map((e) => e.radius));
const RADIUS = enemies.map((e) => e.radius);
const INFECTED = enemies.findIndex((e) => e.id === 'infected');
const byId = Object.fromEntries(cards.map((c) => [c.id, c])) as Record<string, Card>;

export function cardLevel(w: World, id: string): Lv | undefined {
  const l = w.cards[id];
  return l ? (byId[id].levels[l - 1] as Lv) : undefined;
}

export const atkMul = (w: World) => 1 + (cardLevel(w, 'cytokine')?.attackSpeed ?? 0);

// 최대 단계에 도달하지 않은 카드 중 무작위 3장
// 선행 카드: 보체는 항체 표식이 있어야 의미가 있다
const REQUIRES: Record<string, string> = { complement: 'antibody' };

function shuffle<T>(a: T[]) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const evolutionReady = (w: World, ev: Evolution) =>
  !w.evolved[ev.id] && Object.entries(ev.requires).every(([id, lv]) => (w.cards[id] ?? 0) >= lv);
// 진화 재료가 된 카드는 더 이상 뽑기에 나오지 않는다 (효과는 진화 카드 안에서 계속)
export const isMaterial = (w: World, id: string) => EVOLUTIONS.some((ev) => w.evolved[ev.id] && id in ev.requires);

// 진화 조건을 채웠으면 진화 카드 1장이 반드시 들어간다
export function drawCards(w: World): Pick[] {
  const pool: Pick[] = shuffle(cards.filter((c) =>
    (w.cards[c.id] ?? 0) < c.levels.length && !isMaterial(w, c.id) && (!REQUIRES[c.id] || w.cards[REQUIRES[c.id]])));
  const ready = EVOLUTIONS.filter((ev) => evolutionReady(w, ev));
  if (!ready.length) return pool.slice(0, 3);
  return shuffle([ready[Math.floor(Math.random() * ready.length)], ...pool.slice(0, 2)]);
}

export function selectCard(w: World, idx: number) {
  const c = w.choosing?.[idx];
  if (!c) return;
  if (isEvolution(c)) {
    w.evolved[c.id] = true;
    w.evolveLog.push(c.id);
    w.evoSlow = EV.slowmoTime;
  } else w.cards[c.id] = (w.cards[c.id] ?? 0) + 1;
  addPick(w.result, c.field);
  w.choosing = null;
  if (--w.pendingLevels > 0) w.slowmo = balance.levelUp.slowmoTime;
}

export type Source = 'shot' | 'macrophage' | 'net' | 'complement' | 'nk' | 'antibody';

// 표식(항체)·기억세포 보너스가 모든 공격에 곱해진다.
// 내성이 있는 적(보스)은 같은 공격 종류를 맞을수록 그 종류의 피해가 줄어든다. stack: 지속 피해는 dt만큼만 쌓임.
export function damageEnemy(w: World, i: number, amount: number, src: Source, flash = true, stack = 1) {
  const e = w.enemies.f, kind = e.kind[i];
  if (e.hp[i] <= 0) return;
  let mult = w.allOut ? 1 + B.allOutBonus : 1;
  const res = enemies[e.kind[i]].resistance;
  if (res) {
    const r = w.resist[src] ?? 0;
    amount *= 1 - r;
    w.resist[src] = Math.min(res.maxReduction, r + res.perHitStack * stack);
    if (r >= balance.boss.resistPopupThreshold && w.resistPopCd <= 0) {
      w.resistHits.push({ x: e.x[i], y: e.y[i] });
      w.resistPopCd = balance.boss.resistPopupInterval;
    }
  }
  const ab = cardLevel(w, 'antibody');
  if (ab && e.mark[i] > 0) mult += ab.markBonus;
  const mem = cardLevel(w, 'memory');
  if (mem) mult += Math.min(mem.maxBonus, w.kills[e.kind[i]] * mem.bonusPerKill);
  let total = amount * mult;
  // 항생제: 세균에게만 피해 ×damageMul, 바이러스에는 효과 없음
  if (w.antibioticT > 0) {
    if (BACTERIA.has(kind)) total *= A.damageMul;
    else if (VIRUS_SET.has(kind) && flash && w.noEffectCd <= 0) {
      w.noEffectHits.push({ x: e.x[i], y: e.y[i] });
      w.noEffectCd = A.popupInterval;
    }
  }
  // 항생제를 쓸수록 슈퍼버그의 기본 피해 감소가 쌓인다
  if (kind === BOSS) total *= 1 - Math.min(A.bossReductionMax, w.antibioticUses * A.bossReductionPerUse);
  e.hp[i] -= total;
  if (flash) { e.flash[i] = FLASH_TIME; w.fx.hit++; }
}

export function fireShot(w: World, kind: number, tx: number, ty: number, speed: number) {
  const k = w.shots.add();
  if (k < 0) return;
  const s = w.shots.f, pl = w.player;
  const d = Math.hypot(tx - pl.x, ty - pl.y) || 1;
  s.x[k] = pl.x; s.y[k] = pl.y;
  s.vx[k] = ((tx - pl.x) / d) * speed;
  s.vy[k] = ((ty - pl.y) / d) * speed;
  s.life[k] = S.life;
  s.kind[k] = kind;
}

// 플레이어에서 가까운 적 n마리 (사거리 안)
export function nearestEnemies(w: World, n: number) {
  const e = w.enemies.f, pl = w.player, r2 = S.range * S.range;
  const list: { i: number; d: number }[] = [];
  for (let i = 0; i < w.enemies.count; i++) {
    const d = (e.x[i] - pl.x) ** 2 + (e.y[i] - pl.y) ** 2;
    if (d < r2 && e.hp[i] > 0) list.push({ i, d });
  }
  return list.sort((a, b) => a.d - b.d).slice(0, n).map((o) => o.i);
}

// 쿨다운이 끝났으면 true, 공격 속도(사이토카인)가 쿨다운을 줄인다
function ready(w: World, id: string, cooldown: number, dt: number) {
  w.timers[id] = (w.timers[id] ?? 0) - dt;
  if (w.timers[id] > 0) return false;
  w.timers[id] = cooldown / atkMul(w);
  return true;
}

function nkTarget(w: World) {
  const e = w.enemies.f, pl = w.player, r2 = S.range * S.range;
  let best = -1, bestScore = -Infinity;
  for (let i = 0; i < w.enemies.count; i++) {
    if (e.hp[i] <= 0) continue;
    const d = (e.x[i] - pl.x) ** 2 + (e.y[i] - pl.y) ** 2;
    if (d > r2) continue;
    // 감염세포 우선(가까운 순), 없으면 체력이 가장 높은 적
    const score = e.kind[i] === INFECTED ? 1e6 - d : e.hp[i];
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}

// 보체 폭발 한 번: 주변 피해. 고전 경로면 맞은 적에게 표식을 붙이고 다음 연쇄를 예약한다.
function burst(w: World, x: number, y: number, cp: Lv, depth: number, self: number, dmgMul = 1) {
  const e = w.enemies.f, C = EV.classical, classical = w.evolved.classical;
  const dur = cardLevel(w, 'antibody')?.markDuration ?? 4;
  let branches = 0;
  w.hash.query(x, y, cp.splashRadius + MAX_RADIUS, (j) => {
    const r = cp.splashRadius + RADIUS[e.kind[j]];
    if (j === self || e.hp[j] <= 0 || (e.x[j] - x) ** 2 + (e.y[j] - y) ** 2 > r * r) return;
    damageEnemy(w, j, cp.burstDamage * (depth ? dmgMul : T.complementSplashRatio), 'complement');
    if (!classical) return;
    e.mark[j] = dur;
    if (depth < C.chainDepth && branches < C.chainBranch && w.chains.length < 200) {
      branches++;
      w.chains.push({ x: e.x[j], y: e.y[j], depth: depth + 1, t: C.chainDelay });
    }
  });
  w.bursts.push({ x, y, r: cp.splashRadius });
}

export function updateCards(w: World, dt: number) {
  const pl = w.player, e = w.enemies.f;

  // 대식세포: 주위를 돌며 닿는 적에게 피해 (적마다 짧은 재피격 간격)
  w.macro.length = 0;
  const mc = cardLevel(w, 'macrophage');
  if (mc) {
    // 활성화 대식세포 군단: 수 +extraCount, 크기·피해 배수, 주변 적을 끌어당김
    const am = w.evolved.activatedMacrophage ? EV.activatedMacrophage : null;
    const count = mc.count + (am ? am.extraCount : 0);
    const orbR = T.orbiterRadius * (am ? am.sizeMul : 1), dmg = mc.damage * (am ? am.damageMul : 1);
    const ring = mc.orbitRadius + (am ? orbR - T.orbiterRadius : 0);
    w.macroR = orbR;
    for (let k = 0; k < count; k++) {
      const a = w.time * mc.orbitSpeed + (k / count) * Math.PI * 2;
      const x = pl.x + Math.cos(a) * ring, y = pl.y + Math.sin(a) * ring;
      w.macro.push({ x, y });
      const reach = am ? orbR * am.pullRadiusMul : orbR;
      w.hash.query(x, y, reach + MAX_RADIUS, (i) => {
        const dx = x - e.x[i], dy = y - e.y[i], d2 = dx * dx + dy * dy;
        if (am && e.kind[i] !== BOSS && d2 < reach * reach && d2 > 0) {
          const d = Math.sqrt(d2), step = Math.min(d, am.pullSpeed * dt);
          e.x[i] += (dx / d) * step; e.y[i] += (dy / d) * step;
        }
        const r = orbR + RADIUS[e.kind[i]];
        if (e.macroCd[i] > 0 || d2 > r * r) return;
        damageEnemy(w, i, dmg, 'macrophage');
        e.macroCd[i] = T.macroHitInterval;
      });
    }
  }

  // 호중구 NET: 플레이어 자리에 그물을 깐다 (감속·지속 피해는 world의 적 이동에서 처리)
  const nt = cardLevel(w, 'net');
  if (nt && ready(w, 'net', nt.cooldown, dt)) {
    const k = w.nets.add();
    if (k >= 0) {
      const n = w.nets.f;
      n.x[k] = pl.x; n.y[k] = pl.y; n.life[k] = n.maxLife[k] = nt.duration; n.radius[k] = nt.radius;
    }
  }
  for (let k = w.nets.count - 1; k >= 0; k--) if ((w.nets.f.life[k] -= dt) <= 0) w.nets.remove(k);

  // 항체: 가까운 적 여러 마리에 표식 투사체
  const ab = cardLevel(w, 'antibody');
  if (ab && w.enemies.count && ready(w, 'antibody', ab.cooldown, dt))
    for (const i of nearestEnemies(w, ab.projectiles)) fireShot(w, 1, e.x[i], e.y[i], T.antibodyShotSpeed);

  // 보체: 표식 달린 적이 동시에 터지며 주변에도 피해. 표식이 없으면 쿨다운을 쓰지 않는다.
  const cp = cardLevel(w, 'complement');
  if (cp) {
    w.timers.complement = (w.timers.complement ?? 0) - dt;
    if (w.timers.complement <= 0) {
      const marked: number[] = [];
      for (let i = 0; i < w.enemies.count; i++) if (e.mark[i] > 0 && e.hp[i] > 0) marked.push(i);
      if (marked.length) {
        w.timers.complement = cp.cooldown / atkMul(w);
        for (const i of marked) {
          const x = e.x[i], y = e.y[i];
          damageEnemy(w, i, cp.burstDamage, 'complement');
          e.mark[i] = 0;
          burst(w, x, y, cp, 0, i);
        }
      }
    }
    // 고전 경로: 예약된 연쇄 폭발
    for (let k = w.chains.length - 1; k >= 0; k--) {
      const c = w.chains[k];
      if ((c.t -= dt) > 0) continue;
      w.chains.splice(k, 1);
      burst(w, c.x, c.y, cp, c.depth, -1, EV.classical.chainDamageMul);
    }
  }

  // 형질세포: interval마다 화면 안의 모든 적에게 표식
  if (w.evolved.plasmaCell && ready(w, 'plasmaCell', EV.plasmaCell.interval, dt)) {
    const P = EV.plasmaCell, dur = cardLevel(w, 'antibody')?.markDuration ?? 4;
    for (let i = 0; i < w.enemies.count; i++) {
      if ((e.x[i] - pl.x) ** 2 + (e.y[i] - pl.y) ** 2 > P.viewRadius ** 2) continue;
      e.mark[i] = dur;
      damageEnemy(w, i, P.dropDamage, 'antibody'); // 표식이 붙는 순간 항체 피해
      if (w.rain.length < P.maxDrops) w.rain.push({ x: e.x[i], y: e.y[i] });
    }
  }

  // NK세포: 표적에게 날아가 큰 피해 → 쿨다운 동안 플레이어 곁으로 복귀
  const nk = cardLevel(w, 'nk');
  if (nk) {
    const u = w.nk.f;
    while (w.nk.count < nk.count) {
      const k = w.nk.add();
      u.x[k] = pl.x; u.y[k] = pl.y; u.cd[k] = 0;
    }
    let target = -2;
    for (let k = 0; k < w.nk.count; k++) {
      const a = w.time + (k / w.nk.count) * Math.PI * 2;
      let tx = pl.x + Math.cos(a) * T.nkHomeRadius, ty = pl.y + Math.sin(a) * T.nkHomeRadius, speed = T.nkReturnSpeed;
      if (u.cd[k] > 0) u.cd[k] -= dt;
      else {
        if (target === -2) target = nkTarget(w);
        if (target >= 0) { tx = e.x[target]; ty = e.y[target]; speed = T.nkSpeed; }
      }
      const dx = tx - u.x[k], dy = ty - u.y[k], d = Math.hypot(dx, dy);
      if (d > 0) {
        const step = Math.min(d, speed * dt);
        u.x[k] += (dx / d) * step; u.y[k] += (dy / d) * step;
      }
      if (u.cd[k] <= 0 && target >= 0 && d < T.nkRadius + RADIUS[e.kind[target]]) {
        damageEnemy(w, target, nk.damage, 'nk');
        u.cd[k] = nk.cooldown / atkMul(w);
        target = -2; // 다음 NK는 새로 고른다 (같은 적이어도 됨)
      }
    }
  }

  // 발열: 체력이 서서히 줄어든다 (발열만으로는 죽지 않음)
  const fv = cardLevel(w, 'fever');
  if (fv && pl.hp > 1) pl.hp = Math.max(1, pl.hp - fv.selfDrainPerSec * dt);
}
