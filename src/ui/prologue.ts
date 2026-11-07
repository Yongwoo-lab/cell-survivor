// 프롤로그 (약 25초): 새벽 책상 → 기침·면역력 저하 → 렌즈로 몸속 진입 → 정보 장교 안내 → 몸을 지켜라! 3, 2, 1
// Space: 언제든 건너뛰기. 다른 키: 장교 대사 다음 줄.
import dialogue from '../data/dialogue.json';
import { sfx } from '../audio';

const P = dialogue.prologue;

export interface PrologueHooks {
  reveal(): void; // 3D 장면 준비 (구균 몇 마리, 카메라는 높은 곳)
  setLift(k: number): void; // 카메라 높이 1 → 0
  done(): void;
}

export function createPrologue(h: PrologueHooks) {
  const root = document.createElement('div');
  root.id = 'prologue';
  root.hidden = true;
  root.innerHTML = `
    <div class="bg"></div>
    <div class="room"><div class="lamp"></div><div class="clock"></div><p class="night"></p></div>
    <div class="cough"></div><div class="warning"></div>
    <p class="dive"></p>
    <div class="officer pro"><div class="icon"></div><div class="bubble"><b>${dialogue.officerName}</b><p></p></div></div>
    <div class="call"></div>
    <small class="skip">${dialogue.ui.skip}</small>`;
  document.body.appendChild(root);
  const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const bg = $('.bg'), room = $('.room'), night = $('.night'), cough = $('.cough'), warning = $('.warning');
  const dive = $('.dive'), officer = $('.officer'), line = officer.querySelector('p')!, call = $('.call');

  let run = 0, next: (() => void) | null = null;
  const timers = new Set<number>();
  // 건너뛰면 run이 바뀌어 남은 단계가 모두 멈춘다
  const wait = (ms: number) => new Promise<void>((res, rej) => {
    const id = run;
    const t = window.setTimeout(() => { timers.delete(t); id === run ? res() : rej(new Error('skip')); }, ms);
    timers.add(t);
  });
  const type = async (el: HTMLElement, text: string, ms: number) => {
    el.textContent = '';
    el.classList.add('typing');
    for (let i = 1; i <= text.length; i++) { el.textContent = text.slice(0, i); await wait(ms); }
    el.classList.remove('typing');
  };
  const show = (el: HTMLElement, on = true) => el.classList.toggle('on', on);
  const pop = async (text: string, cls: string) => {
    call.className = `call ${cls}`;
    call.textContent = text;
    void call.offsetWidth;
    call.classList.add('on');
  };
  const anim = (ms: number, f: (k: number) => void) => new Promise<void>((res) => {
    const t0 = performance.now(), id = run;
    const step = () => {
      if (id !== run) return res();
      const k = Math.min(1, (performance.now() - t0) / ms);
      f(k);
      k < 1 ? requestAnimationFrame(step) : res();
    };
    step();
  });

  async function timeline() {
    // ① 새벽 3시, 책상 스탠드
    show(room);
    $('.clock').textContent = P.clock;
    const tick = window.setInterval(() => sfx.tick(), 1000);
    sfx.tick();
    try {
      await wait(700);
      await type(night, P.night, 70);
      await wait(1800);
      // ② 기침 + 흔들림 + 면역력 저하
      cough.textContent = P.cough;
      show(cough);
      root.classList.add('shake');
      sfx.cough();
      await wait(500);
      warning.textContent = P.warning;
      show(warning);
      await wait(1900);
    } finally {
      clearInterval(tick);
    }
    root.classList.remove('shake');
    show(cough, false); show(warning, false); show(room, false);
    // ③ 렌즈가 커지며 몸속으로, 카메라가 높은 곳에서 내려온다
    h.reveal();
    h.setLift(1);
    await anim(1200, (k) => bg.style.setProperty('--lens', `${k * k * 150}vmax`));
    bg.hidden = true;
    const descent = anim(2400, (k) => h.setLift(1 - (1 - (1 - k) ** 3)));
    await wait(300);
    show(dive);
    await type(dive, P.dive, 45);
    await descent;
    await wait(900);
    show(dive, false);
    // ④ 정보 장교 세 줄 (키를 누르면 다음 줄)
    for (const text of P.officer) {
      show(officer, false);
      void officer.offsetWidth;
      show(officer);
      await type(line, text, 26);
      await Promise.race([wait(2600), new Promise<void>((r) => { next = r; })]);
      next = null;
    }
    show(officer, false);
    // ⑤ 몸을 지켜라! → 3, 2, 1
    await pop(P.call, 'big');
    await wait(1300);
    for (const n of ['3', '2', '1']) {
      await pop(n, 'count');
      sfx.countdown(n === '1');
      await wait(700);
    }
  }

  function finish() {
    run++;
    timers.forEach(clearTimeout);
    timers.clear();
    next = null;
    root.hidden = true;
    h.setLift(0);
    h.done();
  }

  return {
    play() {
      const id = ++run;
      root.hidden = false;
      root.className = '';
      bg.hidden = false;
      bg.style.setProperty('--lens', '0vmax');
      for (const el of [room, cough, warning, dive, officer, call]) el.classList.remove('on');
      night.textContent = dive.textContent = line.textContent = '';
      timeline().then(() => { if (id === run) finish(); }, () => { /* 건너뜀 */ });
    },
    key(e: KeyboardEvent) {
      if (e.code === 'Space') finish();
      else next?.();
    },
  };
}
