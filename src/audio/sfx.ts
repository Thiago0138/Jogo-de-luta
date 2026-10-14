/** Sons sintetizados com WebAudio: zero ficheiros para descarregar. */

let ac: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let enabled = true;
let ambientOn = true;
let muted = false;
let volume = 0.8;
let crowd: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null;

/** Volume geral de 0 a 1. */
export function setVolume(v: number): void {
  volume = Math.max(0, Math.min(1, v));
  if (master && enabled) master.gain.setTargetAtTime(volume, master.context.currentTime, 0.02);
}

export function setSound(on: boolean): void {
  enabled = on;
  if (master) master.gain.value = on ? volume : 0;
}

export function setAmbient(on: boolean): void {
  ambientOn = on;
  if (!on) stopCrowd();
}

/** Tem de ser chamado num gesto do utilizador (requisito dos browsers). */
export function unlockAudio(): void {
  if (ac) {
    if (ac.state === 'suspended') void ac.resume();
    return;
  }
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  ac = new Ctor();
  master = ac.createGain();
  master.gain.value = enabled ? volume : 0;
  const comp = ac.createDynamicsCompressor();
  master.connect(comp);
  comp.connect(ac.destination);
  const len = ac.sampleRate * 2;
  noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
}

function ok(): boolean {
  return !!ac && !!master && enabled && !muted && ac.state === 'running';
}

function env(g: GainNode, t: number, a: number, peak: number, dec: number): void {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
}

function noise(dur: number, freq: number, q: number, peak: number, type: BiquadFilterType = 'bandpass', delay = 0): void {
  if (!ok() || !noiseBuf) return;
  const t = ac!.currentTime + delay;
  const s = ac!.createBufferSource();
  s.buffer = noiseBuf;
  const f = ac!.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ac!.createGain();
  env(g, t, 0.004, peak, dur);
  s.connect(f);
  f.connect(g);
  g.connect(master!);
  s.start(t, Math.random() * 1.5);
  s.stop(t + dur + 0.05);
}

function tone(freq: number, dur: number, type: OscillatorType, peak: number, slideTo?: number, delay = 0): void {
  if (!ok()) return;
  const t = ac!.currentTime + delay;
  const o = ac!.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  const g = ac!.createGain();
  env(g, t, 0.005, peak, dur);
  o.connect(g);
  g.connect(master!);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export const sfx = {
  /** Silencia temporariamente (ex.: ao saltar a luta). */
  setMuted(m: boolean) {
    muted = m;
  },
  hit(heavy = false) {
    tone(heavy ? 120 : 180, heavy ? 0.25 : 0.12, 'sine', heavy ? 0.9 : 0.6, heavy ? 40 : 70);
    noise(heavy ? 0.18 : 0.08, heavy ? 900 : 1800, 0.8, heavy ? 0.7 : 0.45);
  },
  block() {
    noise(0.07, 2600, 2, 0.35);
    tone(320, 0.06, 'square', 0.12, 200);
  },
  whoosh() {
    noise(0.16, 1200, 0.6, 0.25, 'bandpass');
  },
  thud() {
    tone(90, 0.4, 'sine', 1, 30);
    noise(0.3, 300, 0.7, 0.8, 'lowpass');
  },
  bell() {
    for (let i = 0; i < 3; i++) {
      tone(1320, 0.9, 'triangle', 0.35, undefined, i * 0.22);
      tone(1980, 0.6, 'sine', 0.15, undefined, i * 0.22);
    }
  },
  ding() {
    tone(1320, 1.2, 'triangle', 0.4);
    tone(2640, 0.8, 'sine', 0.12);
  },
  slap() {
    noise(0.06, 3000, 1, 0.6, 'highpass');
    tone(220, 0.08, 'sine', 0.4, 120);
  },
  cheer(amount = 1) {
    noise(1.6 * amount, 900, 0.4, 0.35 * amount, 'bandpass');
    noise(1.2 * amount, 2400, 0.5, 0.15 * amount, 'bandpass', 0.05);
  },
  charge() {
    tone(180, 0.9, 'sawtooth', 0.18, 900);
    tone(240, 0.9, 'square', 0.08, 1200);
  },
  boom() {
    tone(70, 0.9, 'sine', 1, 25);
    noise(0.8, 200, 0.5, 0.9, 'lowpass');
    noise(0.4, 1500, 0.5, 0.3);
  },
  zap() {
    noise(0.35, 4000, 0.5, 0.6, 'highpass');
    tone(1400, 0.25, 'sawtooth', 0.15, 200);
  },
  fire() {
    noise(0.7, 500, 0.4, 0.6, 'lowpass');
    tone(110, 0.6, 'sawtooth', 0.12, 60);
  },
  heal() {
    [660, 880, 1320].forEach((f, i) => tone(f, 0.3, 'sine', 0.2, undefined, i * 0.07));
  },
  coin() {
    tone(988, 0.08, 'square', 0.12);
    tone(1319, 0.25, 'square', 0.12, undefined, 0.07);
  },
  click() {
    tone(660, 0.05, 'triangle', 0.15, 440);
  },
  open() {
    noise(0.5, 700, 0.6, 0.5, 'lowpass');
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, 'triangle', 0.22, undefined, 0.1 + i * 0.08));
  },
  reveal(tier: number) {
    const base = [523, 587, 659, 784, 880, 988, 1175][Math.min(6, tier)];
    const n = 2 + Math.min(4, tier);
    for (let i = 0; i < n; i++) tone(base * Math.pow(1.26, i), 0.4, 'triangle', 0.18, undefined, i * 0.06);
    if (tier >= 4) noise(1.0, 3000, 0.3, 0.12, 'highpass', 0.1);
  },
  levelUp() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.35, 'square', 0.1, undefined, i * 0.09));
  },
};

// ───────── Ambiente do público (loop de ruído filtrado) ─────────

export function startCrowd(): void {
  if (!ok() || !ambientOn || crowd || !noiseBuf) return;
  const src = ac!.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const filter = ac!.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 700;
  filter.Q.value = 0.5;
  const gain = ac!.createGain();
  gain.gain.value = 0.05;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master!);
  src.start();
  crowd = { src, gain, filter };
}

export function crowdLevel(hype: number): void {
  if (!crowd || !ac) return;
  const t = ac.currentTime;
  crowd.gain.gain.setTargetAtTime(0.04 + hype * 0.12, t, 0.3);
  crowd.filter.frequency.setTargetAtTime(600 + hype * 600, t, 0.3);
}

export function stopCrowd(): void {
  if (!crowd || !ac) return;
  const c = crowd;
  crowd = null;
  c.gain.gain.setTargetAtTime(0.0001, ac.currentTime, 0.2);
  setTimeout(() => c.src.stop(), 800);
}
