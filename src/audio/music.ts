// 브금: 심장 박동 + 신스 패드 (+ 긴장 시 하이햇, 보스전 베이스). 미리 예약하는 스케줄러로 반복.
import { audio, buses, tone, noise, midiHz } from './engine';

export type MusicMode = 'calm' | 'tense' | 'boss';
const MODES: Record<MusicMode, { bpm: number; chords: number[][]; cutoff: number; hats: boolean; bass: boolean; beat: number }> = {
  calm: { bpm: 64, cutoff: 900, hats: false, bass: false, beat: 0.45,
    chords: [[57, 60, 64, 71], [53, 57, 60, 64], [50, 57, 60, 65], [52, 55, 59, 62]] },
  tense: { bpm: 78, cutoff: 1300, hats: true, bass: false, beat: 0.55,
    chords: [[57, 60, 64, 65], [54, 57, 60, 63], [50, 53, 57, 62], [52, 56, 59, 65]] },
  boss: { bpm: 108, cutoff: 1700, hats: true, bass: true, beat: 0.75,
    chords: [[52, 55, 58, 62], [53, 56, 59, 62], [52, 55, 58, 61], [51, 54, 58, 61]] },
};
const BEATS_PER_CHORD = 8, AHEAD = 0.25;

let mode: MusicMode = 'calm', beat = 0, nextAt = 0, timer = 0;

export function setMusicMode(m: MusicMode) {
  if (m === mode) return;
  mode = m;
  beat = 0; // 다음 박에서 새 화음
}

function pad(t: number, notes: number[], len: number, cutoff: number) {
  const c = audio()!, out = buses().music;
  const f = c.createBiquadFilter(), g = c.createGain();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(cutoff * 0.6, t);
  f.frequency.linearRampToValueAtTime(cutoff, t + len * 0.5); // 천천히 열렸다 닫힘
  f.frequency.linearRampToValueAtTime(cutoff * 0.6, t + len);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.05, t + 1.5);
  g.gain.setValueAtTime(0.05, t + len);
  g.gain.linearRampToValueAtTime(0.0001, t + len + 1.5);
  f.connect(g).connect(out);
  for (const n of notes) for (const det of [-7, 7]) {
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = midiHz(n);
    o.detune.value = det;
    o.connect(f);
    o.start(t);
    o.stop(t + len + 1.6);
  }
}

function schedule(t: number) {
  const M = MODES[mode], out = buses().music, spb = 60 / M.bpm;
  // 심장 박동: 쿵-쿵
  tone(out, t, { f0: 62, f1: 34, dur: 0.22, vol: M.beat });
  tone(out, t, { f0: 56, f1: 32, dur: 0.18, vol: M.beat * 0.6, at: spb * 0.28 });
  const chord = M.chords[Math.floor(beat / BEATS_PER_CHORD) % M.chords.length];
  if (beat % BEATS_PER_CHORD === 0) pad(t, chord, spb * BEATS_PER_CHORD, M.cutoff);
  if (M.hats) {
    noise(out, t, { dur: 0.04, vol: 0.025, filter: 'highpass', f0: 7000, at: spb * 0.5 });
    if (mode === 'boss') noise(out, t, { dur: 0.03, vol: 0.02, filter: 'highpass', f0: 8000, at: spb * 0.75 });
  }
  if (M.bass) for (const k of [0, 0.5]) tone(out, t, { type: 'sawtooth', f0: midiHz(chord[0] - 24), dur: spb * 0.45, vol: 0.16, at: spb * k });
  beat++;
  return spb;
}

export function startMusic() {
  const c = audio()!;
  nextAt = c.currentTime + 0.1;
  clearInterval(timer);
  timer = window.setInterval(() => {
    while (nextAt < c.currentTime + AHEAD) nextAt += schedule(nextAt);
  }, 50);
}
