// Web Audio 공용: 컨텍스트, 음소거, 같은 효과음 동시 재생 제한, 합성 도우미
let ctx: AudioContext | null = null;
let master: GainNode, sfxBus: GainNode, musicBus: GainNode, noiseBuf: AudioBuffer;
let muted = false;
const MAX_SAME = 4;
const active: Record<string, number> = {};

export const audio = () => ctx;
export const buses = () => ({ sfx: sfxBus, music: musicBus });
export const isMuted = () => muted;

// 브라우저 정책: 사용자 입력이 있어야 오디오를 시작할 수 있다
export function unlock(onStart: () => void) {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume();
    return;
  }
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 1;
  master.connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = 0.8;
  sfxBus.connect(master);
  musicBus = ctx.createGain();
  musicBus.gain.value = 0.5;
  musicBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  onStart();
}

// 일시정지: 컨텍스트를 멈추면 브금 스케줄러도 시간이 멈춘다
export function setPaused(on: boolean) {
  if (!ctx) return;
  void (on ? ctx.suspend() : ctx.resume());
}

export function setMuted(on: boolean) {
  muted = on;
  if (ctx) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.03);
}

export function toggleMute() {
  muted = !muted;
  if (ctx) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.03);
  return muted;
}

// 같은 이름의 효과음은 동시에 MAX_SAME개까지. build는 길이(초)를 돌려준다.
export function voice(name: string, build: (t: number, out: AudioNode) => number) {
  if (!ctx || (active[name] ?? 0) >= MAX_SAME) return;
  active[name] = (active[name] ?? 0) + 1;
  const dur = build(ctx.currentTime, sfxBus);
  setTimeout(() => active[name]--, dur * 1000 + 50);
}

interface ToneOpts { type?: OscillatorType; f0: number; f1?: number; dur: number; vol: number; attack?: number; at?: number }
export function tone(out: AudioNode, t: number, o: ToneOpts) {
  const c = ctx!, osc = c.createOscillator(), g = c.createGain();
  const start = t + (o.at ?? 0), atk = o.attack ?? 0.004;
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.f0, start);
  if (o.f1 && o.f1 !== o.f0) osc.frequency.exponentialRampToValueAtTime(o.f1, start + o.dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(o.vol, start + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, start + o.dur);
  osc.connect(g).connect(out);
  osc.start(start);
  osc.stop(start + o.dur + 0.02);
  return osc;
}

interface NoiseOpts { dur: number; vol: number; filter: BiquadFilterType; f0: number; f1?: number; q?: number; attack?: number; at?: number }
export function noise(out: AudioNode, t: number, o: NoiseOpts) {
  const c = ctx!, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  const start = t + (o.at ?? 0);
  src.buffer = noiseBuf;
  src.loop = true;
  f.type = o.filter;
  f.Q.value = o.q ?? 1;
  f.frequency.setValueAtTime(o.f0, start);
  if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, start + o.dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(o.vol, start + (o.attack ?? 0.004));
  g.gain.exponentialRampToValueAtTime(0.0001, start + o.dur);
  src.connect(f).connect(g).connect(out);
  src.start(start);
  src.stop(start + o.dur + 0.02);
}

export const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);
