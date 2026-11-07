// 보스 공격 패턴: 돌진과 가시 발사를 번갈아. 공격 telegraph초 전에 바닥에 범위가 차오른다(피할 수 있게).
import balance from '../data/balance.json';
import type { World } from './world';

const B = balance.boss, A = B.patterns, P = balance.player;

export function bossIndex(w: World, boss: number) {
  const e = w.enemies.f;
  for (let i = 0; i < w.enemies.count; i++) if (e.kind[i] === boss) return i;
  return -1;
}

export function updateBoss(w: World, dt: number, boss: number) {
  const a = w.bossAtk, pl = w.player, e = w.enemies.f;
  const i = bossIndex(w, boss);
  if (i < 0) { a.state = 'idle'; return; }

  if (a.state === 'idle') {
    if ((a.t -= dt) > 0) return;
    a.type = a.type === 'dash' ? 'spikes' : 'dash';
    a.state = 'tele';
    a.t = A.telegraph;
    a.x = e.x[i]; a.y = e.y[i];
    const dx = pl.x - a.x, dy = pl.y - a.y, d = Math.hypot(dx, dy) || 1;
    a.dx = dx / d; a.dy = dy / d;
  } else if (a.state === 'tele') {
    e.x[i] = a.x; e.y[i] = a.y; // 예고하는 동안 제자리
    if ((a.t -= dt) > 0) return;
    if (a.type === 'dash') { a.state = 'dash'; a.t = A.dash.duration; }
    else {
      const S = A.spikes;
      for (let k = 0; k < S.count; k++) {
        const j = w.spikes.add();
        if (j < 0) break;
        const ang = (k / S.count) * Math.PI * 2, s = w.spikes.f;
        s.x[j] = a.x; s.y[j] = a.y; s.vx[j] = Math.cos(ang) * S.speed; s.vy[j] = Math.sin(ang) * S.speed; s.life[j] = S.life;
      }
      w.fx.bossSpikes++;
      a.state = 'idle';
      a.t = A.cooldown;
    }
  } else if (a.state === 'dash') {
    e.x[i] += a.dx * A.dash.speed * dt;
    e.y[i] += a.dy * A.dash.speed * dt;
    if ((a.t -= dt) <= 0) { a.state = 'idle'; a.t = A.cooldown; }
  }
}

// 보스 가시: 날아가다 플레이어에 닿으면 피해
export function updateSpikes(w: World, dt: number) {
  const S = A.spikes, s = w.spikes.f, pl = w.player, r = P.radius + S.radius;
  for (let k = w.spikes.count - 1; k >= 0; k--) {
    s.x[k] += s.vx[k] * dt;
    s.y[k] += s.vy[k] * dt;
    if ((s.life[k] -= dt) <= 0) { w.spikes.remove(k); continue; }
    if ((s.x[k] - pl.x) ** 2 + (s.y[k] - pl.y) ** 2 > r * r) continue;
    w.spikes.remove(k);
    if (pl.invuln > 0) continue;
    pl.hp = Math.max(0, pl.hp - S.damage);
    pl.invuln = P.invulnTime;
    w.fx.hurt++;
    w.fx.bossHit++;
  }
}
