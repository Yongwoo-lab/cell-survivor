// 브금: 장면마다 곡이 바뀐다 (타이틀·1막·2막·3막·보스전·승리·패배), 전환은 크로스페이드.
// public/music/<곡>.mp3 가 있으면 그 파일을, 없으면 아래 합성 곡을 쓴다.
// 합성 곡은 16분음표 스텝 시퀀서: 킥·스네어·하이햇, 베이스라인, 아르페지오 리드. 적이 많을수록 층이 더해진다.
import files from 'virtual:music';
import musicData from '../data/music.json';
import { audio, buses, tone, noise, midiHz, duckMusic } from './engine';

export type Track = 'title' | 'act1' | 'act2' | 'act3' | 'boss' | 'win' | 'lose';
const FADE = musicData.crossfade;

interface Song {
  bpm: number;
  chords: number[][]; // 한 마디에 화음 하나 (MIDI)
  kick: string; snare: string; hat: string; // 16스텝, x = 침, o = 세게
  bass: string; // r 근음, o 옥타브 위, 5 5도, . 쉼
  arp: number[]; // 화음 구성음 번호 (-1 쉼), 16스텝
  drums: number; // 드럼 세기
  pad?: boolean;
  floor: number; // 강도 최솟값 (보스전은 처음부터 드럼이 다 나온다)
}
const SONGS: Record<Track, Song> = {
  title: { bpm: 100, drums: 0.5, floor: 0, pad: true,
    chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
    kick: 'x.......x.......', snare: '................', hat: '................',
    bass: 'r.......r...5...', arp: [0, -1, 1, -1, 2, -1, 1, -1, 0, -1, 1, -1, 2, -1, 3, -1] },
  act1: { bpm: 124, drums: 0.8, floor: 0.2,
    chords: [[48, 52, 55], [55, 59, 62], [57, 60, 64], [53, 57, 60]],
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.',
    bass: 'r.r.o.r.r.r.o.5.', arp: [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1, 2, 3] },
  act2: { bpm: 132, drums: 0.85, floor: 0.2,
    chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
    kick: 'x...x...x...x..x', snare: '....x.......x...', hat: '..x...x...x...x.',
    bass: 'r..r..o.r..r.5o.', arp: [0, 2, 1, 3, 2, 4, 3, 2, 0, 2, 1, 3, 2, 4, 3, 5] },
  act3: { bpm: 140, drums: 0.95, floor: 0.3,
    chords: [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]],
    kick: 'x...x...x.x.x...', snare: '....x.......x..x', hat: 'x.x.x.x.x.x.x.x.',
    bass: 'rrorrrorrrorr5o5', arp: [0, 1, 2, 1, 3, 2, 4, 3, 0, 1, 2, 1, 3, 2, 5, 4] },
  boss: { bpm: 150, drums: 1.25, floor: 0.6,
    chords: [[52, 55, 59], [53, 57, 60], [52, 55, 59], [50, 53, 57]],
    kick: 'o..xo..xo..xo.xx', snare: '....o.......o.xx', hat: 'xxxxxxxxxxxxxxxx',
    bass: 'rrorrrorrror5r5o', arp: [0, 2, 1, 3, 2, 4, 3, 5, 0, 2, 1, 3, 4, 3, 5, 4] },
  win: { bpm: 116, drums: 0.7, floor: 0.5, pad: true,
    chords: [[48, 52, 55], [53, 57, 60], [55, 59, 62], [48, 52, 55]],
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.',
    bass: 'r...o...r...5...', arp: [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5, 4, 3] },
  lose: { bpm: 72, drums: 0, floor: 0, pad: true,
    chords: [[57, 60, 64], [50, 53, 57], [52, 55, 59], [57, 60, 64]],
    kick: '................', snare: '................', hat: '................',
    bass: 'r...............', arp: [0, -1, -1, -1, 1, -1, -1, -1, 2, -1, -1, -1, 1, -1, -1, -1] },
};
const STEPS = 16, AHEAD = 0.2;
const hit = (s: string, k: number) => (s[k] === 'o' ? 1.3 : s[k] === 'x' ? 1 : 0);

// 지금 울리는 소리 묶음. 꺼질 때는 FADE초에 걸쳐 작아진 뒤 정리된다.
interface Voice { track: Track; gain: GainNode; endAt: number; synth?: { nextAt: number; step: number }; el?: HTMLAudioElement }
const voices: Voice[] = [];
const elements = new Map<Track, { el: HTMLAudioElement; gain: GainNode }>();
const fileUrl = (t: Track) => (files.includes(`${t}.mp3`) ? `${import.meta.env.BASE_URL}music/${t}.mp3` : '');
let current: Track | null = null, want: Track = 'title', intensity = 0, timer = 0, nextBeat = 0;
const beatListeners: (() => void)[] = [];
// 박자가 실제로 울리는 순간에 알린다 (타이틀 로고 핵이 같이 뛴다)
export const onBeat = (fn: () => void) => beatListeners.push(fn);
export const musicTrack = () => current;

export function setTrack(t: Track) { want = t; if (timer) apply(); }
// 0~1. 화면의 적 수·러시. 합성 곡의 드럼·리드 층 수를 정한다.
export function setIntensity(v: number) { intensity = Math.max(0, Math.min(1, v)); }

function fadeTo(g: GainNode, v: number) {
  const t = audio()!.currentTime;
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(g.gain.value, t);
  g.gain.linearRampToValueAtTime(v, t + FADE);
}

function apply() {
  if (want === current) return;
  const c = audio()!, now = c.currentTime;
  for (const v of voices) if (v.endAt === Infinity) { v.endAt = now + FADE + 0.1; fadeTo(v.gain, 0); }
  current = want;
  const url = fileUrl(want);
  if (url) {
    let e = elements.get(want);
    if (!e) {
      const el = new Audio(url);
      el.loop = musicData.loop.includes(want);
      el.preload = 'auto';
      const g = c.createGain();
      c.createMediaElementSource(el).connect(g).connect(buses().music);
      elements.set(want, e = { el, gain: g });
    }
    e.gain.gain.cancelScheduledValues(now);
    e.gain.gain.setValueAtTime(0, now);
    e.el.currentTime = 0;
    e.el.play().catch(() => {}); // 재생 실패(자동 재생 정책 등)는 조용히 무시
    voices.push({ track: want, gain: e.gain, endAt: Infinity, el: e.el });
    fadeTo(e.gain, musicData.fileLevel);
  } else {
    const gain = c.createGain();
    gain.gain.value = 0;
    gain.connect(buses().music);
    voices.push({ track: want, gain, endAt: Infinity, synth: { nextAt: now + 0.05, step: 0 } });
    fadeTo(gain, 1);
  }
}

// ── 합성 악기 ──
function kick(out: AudioNode, t: number, v: number) {
  tone(out, t, { f0: 160, f1: 42, dur: 0.2, vol: 0.55 * v });
  noise(out, t, { dur: 0.012, vol: 0.12 * v, filter: 'highpass', f0: 3000 });
}
const snare = (out: AudioNode, t: number, v: number) => {
  noise(out, t, { dur: 0.16, vol: 0.2 * v, filter: 'bandpass', f0: 1900, q: 0.8 });
  tone(out, t, { type: 'triangle', f0: 200, f1: 150, dur: 0.08, vol: 0.14 * v });
};
const hat = (out: AudioNode, t: number, v: number) => noise(out, t, { dur: 0.035, vol: 0.045 * v, filter: 'highpass', f0: 8000 });
function bass(out: AudioNode, t: number, m: number, dur: number) {
  const c = audio()!, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
  o.type = 'sawtooth';
  o.frequency.value = midiHz(m);
  f.type = 'lowpass';
  f.Q.value = 6;
  f.frequency.setValueAtTime(1400, t);
  f.frequency.exponentialRampToValueAtTime(220, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.2, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f).connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}
function pad(out: AudioNode, t: number, notes: number[], len: number) {
  const c = audio()!, f = c.createBiquadFilter(), g = c.createGain();
  f.type = 'lowpass';
  f.frequency.value = 1100;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.035, t + 0.6);
  g.gain.setValueAtTime(0.035, t + len - 0.2);
  g.gain.linearRampToValueAtTime(0.0001, t + len + 0.6);
  f.connect(g).connect(out);
  for (const n of notes) for (const det of [-8, 8]) {
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = midiHz(n);
    o.detune.value = det;
    o.connect(f);
    o.start(t);
    o.stop(t + len + 0.7);
  }
}

function step(v: Voice) {
  const S = SONGS[v.track], s = v.synth!, out = v.gain, t = s.nextAt, k = s.step % STEPS;
  const spb = 60 / S.bpm / 4, bar = Math.floor(s.step / STEPS);
  const chord = S.chords[bar % S.chords.length];
  const I = Math.max(S.floor, v.track === 'title' || v.track === 'lose' || v.track === 'win' ? 0 : intensity);
  const D = S.drums;
  if (k === 0 && S.pad) pad(out, t, chord, spb * STEPS);
  if (hit(S.kick, k)) kick(out, t, D * hit(S.kick, k));
  if (I >= 0.75 && k % 4 === 2 && !hit(S.kick, k)) kick(out, t, D * 0.6); // 강도 최대: 킥 추가
  if (I >= 0.2 && hit(S.snare, k)) snare(out, t, D * hit(S.snare, k));
  if (I >= 0.2 && hit(S.hat, k)) hat(out, t, D * hit(S.hat, k));
  if (I >= 0.75 && !hit(S.hat, k)) hat(out, t, D * 0.6); // 16분 하이햇
  const b = S.bass[k];
  if (b !== '.') bass(out, t, chord[0] - 24 + (b === 'o' ? 12 : b === '5' ? 7 : 0), spb * 1.6);
  const a = S.arp[k];
  if (I >= 0.45 && a >= 0) {
    // 화음 구성음을 옥타브 위로 이어서 고른다 (번호 3 = 근음 한 옥타브 위)
    const m = chord[a % 3] + 12 * Math.floor(a / 3) + 12;
    tone(out, t, { type: 'square', f0: midiHz(m), dur: spb * 0.9, vol: 0.035 });
    if (I >= 0.75) tone(out, t, { type: 'triangle', f0: midiHz(m + 12), dur: spb * 0.7, vol: 0.03 });
  } else if (S.pad && a >= 0) tone(out, t, { type: 'triangle', f0: midiHz(chord[a % 3] + 12 * Math.floor(a / 3) + 12), dur: spb * 3, vol: 0.04 });
  s.nextAt += spb;
  s.step++;
}

function tick() {
  const c = audio()!, now = c.currentTime;
  apply();
  for (let i = voices.length - 1; i >= 0; i--) {
    const v = voices[i];
    if (now > v.endAt) {
      if (v.el) v.el.pause(); else v.gain.disconnect();
      voices.splice(i, 1);
      continue;
    }
    if (v.synth) while (v.synth.nextAt < now + AHEAD) step(v);
  }
  // 박동: 합성 곡은 반 마디마다, 파일 곡은 0.9초마다
  if (nextBeat < now + AHEAD) {
    const S = SONGS[current ?? 'title'];
    const at = Math.max(nextBeat, now);
    setTimeout(() => beatListeners.forEach((f) => f()), (at - now) * 1000);
    nextBeat = at + (fileUrl(current ?? 'title') ? 0.9 : (60 / S.bpm) * 2);
  }
}

export function startMusic() {
  clearInterval(timer);
  timer = window.setInterval(tick, 50);
  tick();
}

// 짧은 효과 음악: 레벨업은 화음 한 번 + 스네어 롤, 진화는 더 크게 (브금 위에 얹힌다)
export function stinger(kind: 'level' | 'evolve') {
  const c = audio();
  if (!c) return;
  const out = buses().sfx, t = c.currentTime + 0.01;
  duckMusic(0.5, kind === 'evolve' ? 1 : 0.5);
  const root = SONGS[current && !fileUrl(current) ? current : 'act1'].chords[0][0];
  const notes = kind === 'evolve' ? [0, 4, 7, 12, 16, 19, 24] : [0, 7, 12, 16];
  const gap = kind === 'evolve' ? 0.06 : 0.045;
  for (let k = 0; k < 6; k++) snare(out, t + k * gap, 0.3 + k * 0.1);
  notes.forEach((n, i) => {
    const at = 6 * gap + i * 0.03;
    tone(out, t, { type: 'sawtooth', f0: midiHz(root + 12 + n), dur: kind === 'evolve' ? 1.4 : 0.7, vol: 0.03, at });
    tone(out, t, { type: 'square', f0: midiHz(root + 24 + n), dur: kind === 'evolve' ? 1.0 : 0.5, vol: 0.02, at });
  });
  kick(out, t + 6 * gap, kind === 'evolve' ? 1.4 : 1);
  if (kind === 'evolve') noise(out, t, { dur: 1.2, vol: 0.06, filter: 'highpass', f0: 6000, at: 6 * gap });
}
