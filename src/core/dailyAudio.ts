/** Tiny extra sounds for the DAILY hub (wheel ticks, scratching, pops) on top of src/audio/sfx. */
import { onAudioReady } from '../audio/sfx';
import { S } from './state';

let ac: AudioContext | null = null;
let noise: AudioBuffer | null = null;
onAudioReady((c, n) => {
  ac = c;
  noise = n;
});

function out(vol: number): GainNode | null {
  if (!ac || ac.state !== 'running' || !S.settings.sound) return null;
  const g = ac.createGain();
  g.gain.value = vol * (S.settings.volume ?? 0.8);
  g.connect(ac.destination);
  return g;
}

function env(g: GainNode, t: number, peak: number, dur: number): void {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

/** Wheel peg tick: a short wooden click. */
export function tick(pitch = 1): void {
  const o = out(0.55);
  if (!o || !ac) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(1500 * pitch, t);
  osc.frequency.exponentialRampToValueAtTime(600 * pitch, t + 0.03);
  const g = ac.createGain();
  env(g, t, 0.18, 0.04);
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 2200 * pitch;
  f.Q.value = 1.4;
  osc.connect(f).connect(g).connect(o);
  osc.start(t);
  osc.stop(t + 0.06);
}

/** Scratch: filtered noise burst. */
export function scratch(): void {
  const o = out(0.4);
  if (!o || !ac || !noise) return;
  const t = ac.currentTime;
  const src = ac.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = 0.8 + Math.random() * 0.5;
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 2600 + Math.random() * 1800;
  f.Q.value = 0.9;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  src.connect(f).connect(g).connect(o);
  const off = Math.random() * Math.max(0, noise.duration - 0.2);
  src.start(t, off, 0.12);
}

/** Bright pop (cell revealed, day stamped…). */
export function pop(step = 0): void {
  const o = out(0.5);
  if (!o || !ac) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  osc.type = 'triangle';
  const f0 = 520 * Math.pow(1.122, step);
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(f0 * 1.9, t + 0.08);
  const g = ac.createGain();
  env(g, t, 0.22, 0.16);
  osc.connect(g).connect(o);
  osc.start(t);
  osc.stop(t + 0.2);
}

/** Sad trombone-ish "aww" for a losing card. */
export function aww(): void {
  const o = out(0.45);
  if (!o || !ac) return;
  const t = ac.currentTime;
  [392, 370, 349, 311].forEach((f, i) => {
    const osc = ac!.createOscillator();
    osc.type = 'sawtooth';
    const g = ac!.createGain();
    const s = t + i * 0.22;
    osc.frequency.setValueAtTime(f, s);
    if (i === 3) osc.frequency.linearRampToValueAtTime(f * 0.94, s + 0.5);
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(0.08, s + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, s + (i === 3 ? 0.6 : 0.2));
    const lp = ac!.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    osc.connect(lp).connect(g).connect(o);
    osc.start(s);
    osc.stop(s + 0.7);
  });
}

/** Rising whoosh used while the wheel winds up. */
export function riser(dur = 0.5): void {
  const o = out(0.35);
  if (!o || !ac || !noise) return;
  const t = ac.currentTime;
  const src = ac.createBufferSource();
  src.buffer = noise;
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(300, t);
  f.frequency.exponentialRampToValueAtTime(2400, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.3, t + dur * 0.8);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1);
  src.connect(f).connect(g).connect(o);
  src.start(t, 0, dur + 0.15);
}
