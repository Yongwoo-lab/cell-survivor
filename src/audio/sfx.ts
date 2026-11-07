// 효과음 (전부 합성)
import { voice, tone, noise, audio } from './engine';

const jitter = (f: number, k = 0.08) => f * (1 + (Math.random() - 0.5) * k);

export const sfx = {
  shot: () => voice('shot', (t, o) => (tone(o, t, { type: 'triangle', f0: jitter(1400), f1: 380, dur: 0.08, vol: 0.09 }), 0.08)),
  hit: () => voice('hit', (t, o) => {
    tone(o, t, { f0: jitter(760, 0.15), f1: 420, dur: 0.045, vol: 0.12 });
    noise(o, t, { dur: 0.025, vol: 0.05, filter: 'bandpass', f0: 3200, q: 2 });
    return 0.05;
  }),
  // tier: 콤보 단계(0~3). 단계가 오를수록 음이 올라간다
  kill: (tier = 0) => voice('kill', (t, o) => {
    const f = jitter(420, 0.2) * 2 ** ((tier * 3) / 12);
    tone(o, t, { f0: f, f1: f * 2.8, dur: 0.09, vol: 0.2 });
    tone(o, t, { type: 'triangle', f0: f * 4, f1: f * 6, dur: 0.05, vol: 0.04, at: 0.02 });
    return 0.11;
  }),
  // 연속으로 먹으면 반음씩 올라간다
  pickup: (() => {
    let step = 0, last = 0;
    return () => {
      const now = audio()?.currentTime ?? 0;
      step = now - last < 0.45 ? Math.min(step + 1, 14) : 0;
      last = now;
      const f = 1175 * 2 ** (step / 12);
      voice('pickup', (t, o) => {
        tone(o, t, { f0: f, dur: 0.14, vol: 0.07 });
        tone(o, t, { f0: f * 2, dur: 0.08, vol: 0.02 });
        return 0.14;
      });
    };
  })(),
  levelUp: () => voice('levelUp', (t, o) => {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
      tone(o, t, { type: 'triangle', f0: f, dur: 0.5, vol: 0.1, at: i * 0.07 });
      tone(o, t, { f0: f * 2, dur: 0.3, vol: 0.025, at: i * 0.07 });
    });
    return 0.9;
  }),
  card: () => voice('card', (t, o) => {
    tone(o, t, { type: 'triangle', f0: 880, dur: 0.1, vol: 0.12 });
    tone(o, t, { type: 'triangle', f0: 1318.5, dur: 0.18, vol: 0.12, at: 0.06 });
    return 0.26;
  }),
  hurt: () => voice('hurt', (t, o) => {
    tone(o, t, { f0: 150, f1: 42, dur: 0.32, vol: 0.45 });
    noise(o, t, { dur: 0.18, vol: 0.15, filter: 'lowpass', f0: 600, f1: 120 });
    return 0.33;
  }),
  siren: (dur = 3.6) => voice('siren', (t, o) => {
    const c = audio()!, osc = c.createOscillator(), lfo = c.createOscillator(), depth = c.createGain();
    const f = c.createBiquadFilter(), g = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 640;
    lfo.frequency.value = 1.6;
    depth.gain.value = 260;
    lfo.connect(depth).connect(osc.frequency);
    f.type = 'lowpass';
    f.frequency.value = 1800;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.1);
    g.gain.setValueAtTime(0.07, t + dur - 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(f).connect(g).connect(o);
    osc.start(t); lfo.start(t);
    osc.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
    return dur;
  }),
  bossDeath: () => voice('bossDeath', (t, o) => {
    noise(o, t, { dur: 1.9, vol: 0.55, filter: 'lowpass', f0: 5000, f1: 70, attack: 0.01 });
    tone(o, t, { f0: 95, f1: 26, dur: 1.6, vol: 0.7, attack: 0.01 });
    noise(o, t, { dur: 1.2, vol: 0.3, filter: 'lowpass', f0: 2500, f1: 60, at: 0.35 });
    tone(o, t, { f0: 70, f1: 24, dur: 1.2, vol: 0.45, at: 0.35 });
    return 2.0;
  }),
  pill: () => voice('pill', (t, o) => {
    tone(o, t, { type: 'triangle', f0: 600, f1: 1800, dur: 0.18, vol: 0.12 });
    noise(o, t, { dur: 0.25, vol: 0.05, filter: 'bandpass', f0: 4000, f1: 1500, q: 3 });
    return 0.25;
  }),
  evolve: () => voice('evolve', (t, o) => {
    [523.25, 783.99, 1046.5, 1568, 2093].forEach((f, i) => {
      tone(o, t, { type: 'triangle', f0: f, dur: 1.2, vol: 0.09, at: i * 0.05, attack: 0.02 });
      tone(o, t, { f0: f * 1.5, dur: 0.6, vol: 0.02, at: 0.3 + i * 0.05 });
    });
    noise(o, t, { dur: 1.0, vol: 0.06, filter: 'highpass', f0: 6000, attack: 0.05 });
    return 1.4;
  }),
  combo: (tier: number) => voice('combo', (t, o) => {
    const base = 660 * 2 ** ((tier * 3) / 12);
    [1, 1.25, 1.5, 2].forEach((k, i) => tone(o, t, { type: 'square', f0: base * k, dur: 0.12, vol: 0.05, at: i * 0.05 }));
    return 0.32;
  }),
  // "채택" 도장: 둔탁한 쿵 + 종이 위 마찰
  stamp: () => voice('stamp', (t, o) => {
    tone(o, t, { f0: 180, f1: 70, dur: 0.12, vol: 0.4 });
    noise(o, t, { dur: 0.08, vol: 0.18, filter: 'bandpass', f0: 1800, q: 0.8 });
    return 0.14;
  }),
  // 보스 포효: 거칠게 떨리는 저음 + 숨소리 같은 잡음
  roar: () => voice('roar', (t, o) => {
    const c = audio()!, osc = c.createOscillator(), lfo = c.createOscillator(), depth = c.createGain(), f = c.createBiquadFilter(), g = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(70, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 1.5);
    lfo.frequency.value = 23;
    depth.gain.value = 14;
    lfo.connect(depth).connect(osc.frequency);
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(220, t + 1.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    osc.connect(f).connect(g).connect(o);
    osc.start(t); lfo.start(t); osc.stop(t + 1.7); lfo.stop(t + 1.7);
    noise(o, t, { dur: 1.4, vol: 0.25, filter: 'bandpass', f0: 500, f1: 180, q: 0.7, attack: 0.1 });
    return 1.7;
  }),
  // 글자가 찍히는 임팩트: 묵직한 저음 + 금속성 타격
  impact: () => voice('impact', (t, o) => {
    tone(o, t, { f0: 90, f1: 30, dur: 0.9, vol: 0.7, attack: 0.003 });
    noise(o, t, { dur: 0.35, vol: 0.4, filter: 'lowpass', f0: 3000, f1: 200, attack: 0.002 });
    tone(o, t, { type: 'square', f0: 1900, f1: 1200, dur: 0.12, vol: 0.05 });
    return 0.9;
  }),
  // 저음 드롭: 아래로 떨어지는 사인파를 일그러뜨려 화면이 깨지는 느낌
  drop: () => voice('drop', (t, o) => {
    const c = audio()!, osc = c.createOscillator(), shaper = c.createWaveShaper(), g = c.createGain();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = (i / 255) * 2 - 1; curve[i] = Math.tanh(x * 3); }
    shaper.curve = curve;
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(26, t + 1.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.55, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
    osc.connect(shaper).connect(g).connect(o);
    osc.start(t); osc.stop(t + 1.8);
    noise(o, t, { dur: 0.25, vol: 0.5, filter: 'highpass', f0: 2500, attack: 0.001 }); // 유리 깨지는 순간
    return 1.8;
  }),
  // 현미경 초점 맞추기: 톱니 딸깍 세 번 + 짧게 차오르는 소리
  focus: () => voice('focus', (t, o) => {
    for (const at of [0, 0.07, 0.14]) noise(o, t, { dur: 0.025, vol: 0.18, filter: 'bandpass', f0: 2600, q: 5, at });
    noise(o, t, { dur: 0.45, vol: 0.08, filter: 'bandpass', f0: 400, f1: 2400, q: 1.5, at: 0.1, attack: 0.2 });
    return 0.6;
  }),
  tick: () => voice('tick', (t, o) => {
    noise(o, t, { dur: 0.03, vol: 0.12, filter: 'bandpass', f0: 3800, q: 6 });
    tone(o, t, { f0: 2200, dur: 0.02, vol: 0.03 });
    return 0.04;
  }),
  // 기침 두 번: 목을 긁는 잡음 + 낮은 울림
  cough: () => voice('cough', (t, o) => {
    for (const at of [0, 0.32]) {
      noise(o, t, { dur: 0.22, vol: 0.45, filter: 'bandpass', f0: 900, f1: 380, q: 1.2, at, attack: 0.01 });
      noise(o, t, { dur: 0.16, vol: 0.2, filter: 'lowpass', f0: 500, at, attack: 0.005 });
      tone(o, t, { type: 'triangle', f0: 170, f1: 95, dur: 0.18, vol: 0.18, at });
    }
    return 0.6;
  }),
  countdown: (last = false) => voice('countdown', (t, o) => (tone(o, t, { type: 'triangle', f0: last ? 1320 : 660, dur: last ? 0.5 : 0.18, vol: 0.14 }), 0.5)),
  act: () => voice('act', (t, o) => {
    tone(o, t, { f0: 55, f1: 49, dur: 2.4, vol: 0.4, attack: 0.5 });
    tone(o, t, { f0: 82.4, f1: 73.4, dur: 2.2, vol: 0.14, attack: 0.6 });
    noise(o, t, { dur: 2, vol: 0.05, filter: 'lowpass', f0: 300, f1: 90, attack: 0.6 });
    return 2.4;
  }),
};
