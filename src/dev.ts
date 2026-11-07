// 개발용 단축키: 주소에 ?dev=1이 있을 때만 동작
import balance from './data/balance.json';
import type { World } from './game/world';
import { addEnemy, kindOf } from './game/spawner';
import { EVOLUTIONS } from './game/cards';

export interface DevHooks {
  world(): World;
  phase(): string;
  info(): Record<string, number>;
  restartFromTop(): void; // 콜드 오픈부터 다시
  typing(): boolean; // 이름 입력 중이면 H를 가로채지 않는다
}

const HELP: [string, string][] = [
  ['F1', '2막으로'], ['F2', '3막으로'], ['F3', '보스 즉시 등장'], ['F4', '즉시 레벨업'], ['F5', '진화 재료 세팅'],
  ['F6', '항생제 생성'], ['F7', '무적 토글'], ['F8', '녹화 모드 (FPS·DEV 숨김)'], ['F9', '적 500마리'], ['F10', '처음부터 다시 보기'], ['H', '이 목록'],
];

export function installDev(h: DevHooks) {
  if (new URLSearchParams(location.search).get('dev') !== '1') return { frame() {} };
  // 자동 점검(npm run qa)이 읽는 상태. 개발 모드에서만 존재한다.
  (window as unknown as { __qa: unknown }).__qa = { world: h.world, phase: h.phase, info: h.info, bossKind: kindOf(balance.boss.id) };
  let god = false;
  const badge = document.createElement('div');
  badge.id = 'dev';
  const help = document.createElement('div');
  help.id = 'dev-help';
  help.hidden = true;
  help.innerHTML = HELP.map(([k, v]) => `<div><kbd>${k}</kbd>${v}</div>`).join('');
  document.body.append(badge, help);
  const label = () => { badge.textContent = god ? 'DEV · 무적' : 'DEV'; };
  label();

  const actions: Record<string, (w: World) => void> = {
    F1: (w) => { w.time = Math.max(w.time, balance.acts[1].start); },
    F2: (w) => { w.time = Math.max(w.time, balance.acts[2].start); },
    F3: (w) => { w.time = Math.max(w.time, balance.boss.at); },
    F4: (w) => { w.player.xp = w.player.xpToNext; },
    F5: (w) => {
      const ev = EVOLUTIONS.find((e) => !w.evolved[e.id]);
      if (!ev) return;
      for (const [id, lv] of Object.entries(ev.requires)) w.cards[id] = Math.max(w.cards[id] ?? 0, lv as number);
      w.player.xp = w.player.xpToNext; // 다음 레벨업에 진화 카드가 나온다
    },
    F6: (w) => {
      const k = w.pills.add();
      if (k >= 0) { w.pills.f.x[k] = w.player.x + 3; w.pills.f.y[k] = w.player.y; w.pills.f.life[k] = balance.antibiotic.life; }
    },
    F7: () => { god = !god; label(); },
    F8: () => document.body.classList.toggle('rec'),
    F9: (w) => {
      const kinds = ['coccus', 'bacillus', 'virus'].map(kindOf);
      for (let n = 0; n < 500; n++) {
        const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 16;
        addEnemy(w, kinds[n % 3], w.player.x + Math.cos(a) * r, w.player.y + Math.sin(a) * r);
      }
    },
    F10: () => h.restartFromTop(),
  };

  // 캡처 단계에서 먼저 받아 게임 쪽 키 처리(아무 키나 시작 등)로 넘어가지 않게 한다
  addEventListener('keydown', (e) => {
    if (e.code === 'KeyH' && !h.typing()) {
      help.hidden = !help.hidden;
      e.stopImmediatePropagation();
      return;
    }
    const f = actions[e.code];
    if (!f) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!e.repeat) f(h.world());
  }, { capture: true });

  return {
    frame(w: World) {
      if (god) { w.player.hp = w.player.maxHp; w.player.invuln = 0.1; }
    },
  };
}
