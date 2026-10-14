import { onAudioReady } from './sfx';

/**
 * Música de fundo sintetizada em tempo real (sequenciador WebAudio, zero ficheiros).
 * - 'menu': groove descontraído a 98 BPM
 * - 'fight': tema rápido e mexido a 152 BPM que ganha camadas com o entusiasmo do público
 */

type Track = 'menu' | 'fight';

let ac: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let out: GainNode | null = null;
let bus: GainNode | null = null;
let enabled = true;
let volume = 0.5;
let wanted: Track | null = null;
let current: Track | null = null;
let timer = 0;
let nextTime = 0;
let step = 0;
let intensity = 0.3;

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

onAudioReady((ctx, nb) => {
  ac = ctx;
  noise = nb;
  out = ac.createGain();
  out.gain.value = enabled ? volume * 0.55 : 0;
  out.connect(ac.destination);
  if (wanted) start(wanted);
});

function env(g: GainNode, t: number, a: number, peak: number, d: number): void {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function osc(type: OscillatorType, f: number, t: number, a: number, peak: number, d: number, dest: AudioNode, cutoff?: number): void {
  const o = ac!.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  const g = ac!.createGain();
  env(g, t, a, peak, d);
  if (cutoff) {
    const fl = ac!.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.setValueAtTime(cutoff, t);
    fl.frequency.exponentialRampToValueAtTime(Math.max(200, cutoff * 0.35), t + a + d);
    o.connect(fl);
    fl.connect(g);
  } else o.connect(g);
  g.connect(dest);
  o.start(t);
  o.stop(t + a + d + 0.05);
}

function kick(t: number, peak = 0.9): void {
  const o = ac!.createOscillator();
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  const g = ac!.createGain();
  env(g, t, 0.002, peak, 0.22);
  o.connect(g);
  g.connect(bus!);
  o.start(t);
  o.stop(t + 0.3);
}

function noiseHit(t: number, type: BiquadFilterType, f: number, peak: number, d: number): void {
  const s = ac!.createBufferSource();
  s.buffer = noise;
  const fl = ac!.createBiquadFilter();
  fl.type = type;
  fl.frequency.value = f;
  const g = ac!.createGain();
  env(g, t, 0.002, peak, d);
  s.connect(fl);
  fl.connect(g);
  g.connect(bus!);
  s.start(t, Math.random() * 1.5);
  s.stop(t + d + 0.05);
}

// ───────────── Tema dos menus ─────────────
const MENU_CHORDS = [
  [57, 60, 64, 67], // Am7
  [50, 53, 57, 60, 64], // Dm9
  [55, 59, 62, 65], // G7
  [48, 52, 55, 59], // Cmaj7
];
const MENU_BASS = [45, 50, 43, 48];
const MENU_BASSLINE = [0, -1, -1, 0, -1, -1, 7, -1, 0, -1, 12, -1, 7, -1, 5, -1];

function menuStep(t: number, s: number): void {
  const bar = Math.floor(s / 16) % 4;
  const i = s % 16;
  const sixteenth = 60 / 98 / 4;
  if (i === 0 || i === 10) kick(t, 0.55);
  if (i === 4 || i === 12) noiseHit(t, 'bandpass', 1800, 0.18, 0.18);
  if (i % 2 === 0) noiseHit(t, 'highpass', 7000, i % 4 === 2 ? 0.06 : 0.035, 0.05);
  const bn = MENU_BASSLINE[i];
  if (bn >= 0) osc('triangle', mtof(MENU_BASS[bar] + bn), t, 0.01, 0.22, sixteenth * 1.6, bus!);
  if (i === 0 || i === 8) {
    for (const n of MENU_CHORDS[bar]) osc('sine', mtof(n + 12), t, 0.04, 0.045, sixteenth * 7, bus!);
    for (const n of MENU_CHORDS[bar]) osc('triangle', mtof(n), t, 0.02, 0.03, sixteenth * 6, bus!, 2200);
  }
  // pequena melodia
  if (bar % 2 === 1 && (i === 6 || i === 9 || i === 14)) {
    const n = MENU_CHORDS[bar][(i / 3) % MENU_CHORDS[bar].length | 0] + 12;
    osc('sine', mtof(n), t, 0.01, 0.06, sixteenth * 3, bus!);
  }
}

// ───────────── Tema da luta ─────────────
const FIGHT_ROOTS = [40, 40, 36, 38]; // Em Em C D
const FIGHT_BASS = [0, 0, 12, 0, 0, 12, 0, 10, 0, 0, 12, 0, 7, 0, 10, 12];
const RIFF = [64, 67, 71, 76, 74, 71, 67, 71];

function fightStep(t: number, s: number): void {
  const bar = Math.floor(s / 16) % 4;
  const big = Math.floor(s / 64) % 2; // de 4 em 4 compassos muda a energia
  const i = s % 16;
  const sixteenth = 60 / 152 / 4;
  const root = FIGHT_ROOTS[bar];
  // bateria
  if (i % 4 === 0) kick(t, 0.95);
  if (i === 4 || i === 12) {
    noiseHit(t, 'bandpass', 1600, 0.4, 0.16);
    osc('triangle', 190, t, 0.002, 0.15, 0.08, bus!);
  }
  noiseHit(t, 'highpass', 8000, i % 2 ? 0.03 : 0.06, 0.04);
  if (i === 0 && bar === 0 && intensity > 0.5) noiseHit(t, 'highpass', 5000, 0.18, 1.2);
  // baixo distorcido em colcheias
  if (i % 2 === 0) osc('sawtooth', mtof(root + FIGHT_BASS[i]), t, 0.005, 0.16, sixteenth * 1.8, bus!, 1200);
  // power chords no início de cada meio compasso
  if (i === 0 || i === 8) {
    for (const iv of [0, 7, 12]) osc('sawtooth', mtof(root + 24 + iv), t, 0.01, 0.035, sixteenth * 7, bus!, 2600);
  }
  // riff/arpejo: entra com mais entusiasmo
  if (intensity > 0.35 || big) {
    if (i % 2 === 0) {
      const n = RIFF[(i / 2) % RIFF.length] + (root - 40);
      osc('square', mtof(n), t, 0.004, 0.05 * (0.6 + intensity * 0.6), sixteenth * 1.5, bus!, 3200);
    }
  }
  // camada extra no máximo de hype: lead em oitava
  if (intensity > 0.75 && (i === 2 || i === 6 || i === 10 || i === 14)) {
    osc('sawtooth', mtof(RIFF[(i + bar) % RIFF.length] + 12 + (root - 40)), t, 0.004, 0.035, sixteenth * 1.4, bus!, 4000);
  }
}

function schedule(): void {
  if (!ac || !current) return;
  const bpm = current === 'fight' ? 152 : 98;
  const dur = 60 / bpm / 4;
  while (nextTime < ac.currentTime + 0.12) {
    if (current === 'fight') fightStep(nextTime, step);
    else menuStep(nextTime, step);
    step++;
    nextTime += dur;
  }
}

function start(track: Track): void {
  if (!ac || !out) return;
  if (current === track) return;
  // crossfade: o bus antigo desvanece
  if (bus) {
    const old = bus;
    old.gain.setTargetAtTime(0.0001, ac.currentTime, 0.25);
    setTimeout(() => old.disconnect(), 1500);
  }
  bus = ac.createGain();
  bus.gain.setValueAtTime(0.0001, ac.currentTime);
  bus.gain.setTargetAtTime(1, ac.currentTime + 0.05, 0.3);
  bus.connect(out);
  current = track;
  step = 0;
  nextTime = ac.currentTime + 0.08;
  if (!timer) timer = window.setInterval(schedule, 25);
}

export const music = {
  play(track: Track): void {
    wanted = track;
    if (ac && enabled) start(track);
  },
  setEnabled(on: boolean): void {
    enabled = on;
    if (out && ac) out.gain.setTargetAtTime(on ? volume * 0.55 : 0, ac.currentTime, 0.1);
    if (on && wanted && ac && !current) start(wanted);
  },
  setVolume(v: number): void {
    volume = Math.max(0, Math.min(1, v));
    if (out && ac && enabled) out.gain.setTargetAtTime(volume * 0.55, ac.currentTime, 0.05);
  },
  /** 0–1: o tema da luta ganha camadas quando o público está ao rubro. */
  setIntensity(x: number): void {
    intensity = x;
  },
};
