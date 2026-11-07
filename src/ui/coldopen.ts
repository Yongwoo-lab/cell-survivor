// 콜드 오픈 (약 6초): 보스전 한복판 → 슬로모션 진화 공격 → "이 몸의 운명은…" 찍힘 → 저음과 함께 깨지듯 암전 → "72시간 전…"
// Space: 콜드 오픈과 프롤로그를 모두 건너뛴다.
import dialogue from '../data/dialogue.json';
import { sfx } from '../audio';

export interface ColdHooks {
  setup(): void; // 보스전 장면 세계 준비
  roar(): void; // 보스 포효 (흔들림)
  sweep(): void; // 진화 공격으로 쓸어버림
  slow(k: number): void; // 시간 배속
  done(): void; // 프롤로그로
  skipAll(): void; // 바로 플레이
}

const C = dialogue.coldOpen;
// 화면 가운데에서 뻗는 금 (뷰박스 0~100)
const CRACKS = ['50,50 38,41 31,22 22,14 8,6', '50,50 63,44 72,30 86,24 97,10', '50,50 57,63 54,78 61,93', '50,50 39,58 24,63 12,79 3,84',
  '50,50 70,57 84,68 98,71', '31,22 18,26 5,24', '72,30 79,16', '24,63 21,77'];

export function createColdOpen(h: ColdHooks) {
  const root = document.createElement('div');
  root.id = 'coldopen';
  root.hidden = true;
  root.innerHTML = `<div class="bars"></div><p class="tagline">${C.tagline}</p>
    <svg class="crack" viewBox="0 0 100 100" preserveAspectRatio="none">${CRACKS.map((p) => `<polyline points="${p}"/>`).join('')}</svg>
    <div class="black"></div><p class="flashback">${C.flashback}</p><small class="skip">${dialogue.ui.skip}</small>`;
  document.body.appendChild(root);
  const timers: number[] = [];
  const at = (ms: number, f: () => void) => timers.push(window.setTimeout(f, ms));
  const on = (cls: string) => root.classList.add(cls);

  const stop = () => {
    timers.splice(0).forEach(clearTimeout);
    root.hidden = true;
    root.className = '';
    h.slow(1);
  };

  return {
    play() {
      stop();
      root.hidden = false;
      h.setup();
      at(350, () => { h.roar(); sfx.roar(); });
      at(1500, () => { h.slow(0.15); h.sweep(); });
      at(1900, () => { on('is-stamp'); sfx.impact(); });
      at(3400, () => h.slow(1));
      at(4000, () => { on('is-crack'); sfx.drop(); });
      at(4220, () => on('is-cut'));
      at(4700, () => on('is-flashback'));
      at(6100, () => { stop(); h.done(); });
    },
    key(e: KeyboardEvent) {
      if (e.code !== 'Space') return;
      stop();
      h.skipAll();
    },
  };
}
