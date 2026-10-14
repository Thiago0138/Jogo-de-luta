/**
 * Sons sintetizados com WebAudio: zero ficheiros para descarregar.
 * Os sons da luta passam por uma reverberação de pavilhão; o público é feito de dezenas de
 * "vozes" sintetizadas (formantes + sílabas) e palmas, renderizadas uma vez num OfflineAudioContext.
 */

let ac: AudioContext | null = null;
let master: GainNode | null = null;
/** Barramento dos sons da luta (seco + reverberação da arena). */
let arena: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let enabled = true;
let ambientOn = true;
let muted = false;
let volume = 0.8;
let crowd: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null;

/** Buffers do público (prontos uns instantes depois de desbloquear o áudio). */
const bank: { babble?: AudioBuffer; cheer?: AudioBuffer; oooh?: AudioBuffer; claps?: AudioBuffer } = {};

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
  comp.threshold.value = -14;
  comp.knee.value = 10;
  comp.ratio.value = 4;
  master.connect(comp);
  comp.connect(ac.destination);
  const len = ac.sampleRate * 2;
  noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  // reverberação de pavilhão
  arena = ac.createGain();
  arena.connect(master);
  const conv = ac.createConvolver();
  conv.buffer = impulse(ac, 1.7);
  const wet = ac.createGain();
  wet.gain.value = 0.26;
  arena.connect(conv);
  conv.connect(wet);
  wet.connect(master);
  for (const cb of unlockCbs) cb(ac, noiseBuf);
  void buildCrowd(ac.sampleRate);
}

const unlockCbs: ((ac: AudioContext, noise: AudioBuffer) => void)[] = [];
/** Regista código que precisa do AudioContext (corre logo se já existir). */
export function onAudioReady(cb: (ac: AudioContext, noise: AudioBuffer) => void): void {
  if (ac && noiseBuf) cb(ac, noiseBuf);
  else unlockCbs.push(cb);
}

function ok(): boolean {
  return !!ac && !!master && enabled && !muted && ac.state === 'running';
}

/** Resposta de impulso de um pavilhão: ruído com decaimento exponencial e cada vez mais abafado. */
function impulse(c: BaseAudioContext, secs: number): AudioBuffer {
  const n = Math.floor(c.sampleRate * secs);
  const b = c.createBuffer(2, n, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const k = i / n;
      const a = 0.5 - k * 0.42; // filtra mais as caudas
      lp = lp + a * (Math.random() * 2 - 1 - lp);
      const early = i < c.sampleRate * 0.06 && Math.random() < 0.004 ? 2 : 1;
      d[i] = lp * Math.pow(1 - k, 2.6) * early;
    }
  }
  return b;
}

const jit = (v: number, k = 0.1) => v * (1 + (Math.random() * 2 - 1) * k);

interface NOpts {
  dur: number;
  freq: number;
  q?: number;
  peak: number;
  type?: BiquadFilterType;
  attack?: number;
  delay?: number;
  /** Frequência final do filtro (varrimento). */
  to?: number;
  bus?: AudioNode;
}

function noise(o: NOpts): void {
  if (!ok() || !noiseBuf) return;
  const t = ac!.currentTime + (o.delay ?? 0);
  const s = ac!.createBufferSource();
  s.buffer = noiseBuf;
  const f = ac!.createBiquadFilter();
  f.type = o.type ?? 'bandpass';
  f.frequency.setValueAtTime(o.freq, t);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
  f.Q.value = o.q ?? 1;
  const g = ac!.createGain();
  const a = o.attack ?? 0.002;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + o.dur);
  s.connect(f);
  f.connect(g);
  g.connect(o.bus ?? arena ?? master!);
  s.start(t, Math.random() * 1.5);
  s.stop(t + a + o.dur + 0.05);
}

interface TOpts {
  f: number;
  dur: number;
  peak: number;
  type?: OscillatorType;
  to?: number;
  attack?: number;
  delay?: number;
  /** Tremor da amplitude (Hz) — cordas a vibrar. */
  wobble?: number;
  bus?: AudioNode;
}

function tone(o: TOpts): void {
  if (!ok()) return;
  const t = ac!.currentTime + (o.delay ?? 0);
  const os = ac!.createOscillator();
  os.type = o.type ?? 'sine';
  os.frequency.setValueAtTime(o.f, t);
  if (o.to) os.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
  const g = ac!.createGain();
  const a = o.attack ?? 0.003;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + o.dur);
  os.connect(g);
  if (o.wobble) {
    const lfo = ac!.createOscillator();
    lfo.frequency.value = o.wobble;
    const lg = ac!.createGain();
    lg.gain.value = o.peak * 0.6;
    lfo.connect(lg);
    lg.connect(g.gain);
    lfo.start(t);
    lfo.stop(t + a + o.dur + 0.05);
  }
  g.connect(o.bus ?? arena ?? master!);
  os.start(t);
  os.stop(t + a + o.dur + 0.05);
}

/** Toca um buffer do público. */
function play(buf: AudioBuffer | undefined, gain: number, rate = 1, offset = 0, bus?: AudioNode): void {
  if (!ok() || !buf) return;
  const s = ac!.createBufferSource();
  s.buffer = buf;
  s.playbackRate.value = rate;
  const g = ac!.createGain();
  g.gain.value = gain;
  s.connect(g);
  g.connect(bus ?? arena ?? master!);
  s.start(ac!.currentTime, offset);
}

let lastCrowd = 0;

export const sfx = {
  /** Silencia temporariamente (ex.: ao saltar a luta). */
  setMuted(m: boolean) {
    muted = m;
  },
  /** Soco com luva: estalo do cabedal + impacto no corpo. `power` 0..1. */
  punch(power = 0.6, body = false) {
    const p = Math.max(0.2, Math.min(1, power));
    noise({ dur: 0.012, freq: 3200, type: 'highpass', peak: 0.35 + p * 0.25 });
    noise({ dur: jit(0.05), freq: jit(body ? 700 : 1150), q: 1.3, peak: 0.6 + p * 0.3 });
    tone({ f: jit(body ? 120 : 150), to: body ? 42 : 55, dur: 0.09 + p * 0.08, peak: 0.55 + p * 0.45 });
    noise({ dur: 0.08 + p * 0.07, freq: body ? 220 : 300, type: 'lowpass', peak: 0.35 + p * 0.35, delay: 0.004 });
  },
  hit(heavy = false) {
    sfx.punch(heavy ? 1 : 0.6);
  },
  /** Golpe defendido: cabedal contra cabedal, abafado. */
  block() {
    noise({ dur: 0.05, freq: jit(820), q: 1.6, peak: 0.45 });
    tone({ f: 190, to: 110, dur: 0.06, peak: 0.25 });
  },
  /** Deslocação de ar de um golpe a passar. */
  whoosh() {
    noise({ dur: 0.17, freq: jit(500), to: jit(1900), q: 1.4, peak: 0.16, attack: 0.05 });
  },
  /** Queda no tapete do ringue: estrondo das tábuas + molas da lona. */
  slam(power = 1) {
    const p = Math.max(0.3, Math.min(1.3, power));
    tone({ f: jit(78, 0.06), to: 34, dur: 0.38 + p * 0.2, peak: 0.95 * Math.min(1, p) });
    noise({ dur: 0.3 + p * 0.15, freq: 170, type: 'lowpass', peak: 0.85 * Math.min(1, p) });
    noise({ dur: 0.2, freq: jit(240), q: 3, peak: 0.45 * p });
    noise({ dur: 0.05, freq: 1000, q: 1, peak: 0.45 * p });
    // molas e estrutura metálica do ringue
    for (const f of [410, 690, 1130]) noise({ dur: 0.45 + p * 0.2, freq: jit(f, 0.05), q: 22, peak: 0.12 * p, delay: 0.01 });
  },
  thud() {
    sfx.slam(1);
  },
  /** Ressalto nas cordas: cabos esticados a vibrar + rangido + esticador. */
  ropes() {
    tone({ f: jit(74, 0.05), to: 62, dur: 0.5, peak: 0.42, wobble: 11 });
    tone({ f: jit(148, 0.05), to: 120, dur: 0.3, peak: 0.12, type: 'triangle', wobble: 17 });
    noise({ dur: 0.22, freq: 420, to: 260, q: 5, peak: 0.16, attack: 0.02 });
    noise({ dur: 0.09, freq: 1700, q: 10, peak: 0.06, delay: 0.03 });
    tone({ f: 1250, dur: 0.12, peak: 0.03, type: 'square', delay: 0.02 });
  },
  /** Gongo/sino de boxe: parciais inarmónicos de metal. */
  bell() {
    for (let i = 0; i < 3; i++) bellHit(i * 0.26);
  },
  ding() {
    bellHit(0);
  },
  /** Chapada / golpe de cutelo no peito. */
  slap() {
    noise({ dur: 0.022, freq: 2200, type: 'highpass', peak: 0.75 });
    noise({ dur: 0.05, freq: jit(3400), q: 2, peak: 0.4 });
    tone({ f: 200, to: 110, dur: 0.07, peak: 0.35 });
  },
  /** Público a vibrar (gritos + palmas). */
  cheer(amount = 1) {
    if (!ambientOn) return;
    const now = ac?.currentTime ?? 0;
    if (now - lastCrowd < 0.6) return;
    lastCrowd = now;
    const a = Math.min(1.6, amount);
    play(bank.cheer, 0.32 * a, jit(1, 0.06), Math.random() * 0.3);
    if (a > 0.9) play(bank.claps, 0.22 * a, 1, Math.random() * 1.2);
  },
  /** "Uuuh!" do público num golpe brutal. */
  oooh(amount = 1) {
    if (!ambientOn) return;
    play(bank.oooh, 0.32 * Math.min(1.5, amount), jit(1, 0.05));
  },
  charge() {
    tone({ f: 160, to: 900, dur: 0.9, peak: 0.12, type: 'sawtooth' });
    noise({ dur: 0.9, freq: 300, to: 3000, q: 2, peak: 0.12, attack: 0.3 });
  },
  boom() {
    tone({ f: 58, to: 26, dur: 1.1, peak: 1 });
    noise({ dur: 0.9, freq: 140, type: 'lowpass', peak: 0.9 });
    noise({ dur: 0.35, freq: 1400, q: 0.7, peak: 0.3 });
    for (const f of [410, 690]) noise({ dur: 0.6, freq: f, q: 20, peak: 0.1, delay: 0.02 });
  },
  zap() {
    noise({ dur: 0.3, freq: 3500, type: 'highpass', peak: 0.45 });
    tone({ f: 1500, to: 180, dur: 0.22, peak: 0.12, type: 'sawtooth' });
    for (let i = 0; i < 4; i++) noise({ dur: 0.015, freq: 5000, type: 'highpass', peak: 0.5, delay: Math.random() * 0.2 });
  },
  fire() {
    noise({ dur: 0.7, freq: 420, type: 'lowpass', peak: 0.55, attack: 0.05 });
    for (let i = 0; i < 7; i++) noise({ dur: 0.012, freq: jit(2600, 0.3), q: 3, peak: 0.25, delay: Math.random() * 0.6 });
  },
  heal() {
    [660, 880, 1320].forEach((f, i) => tone({ f, dur: 0.3, peak: 0.2, delay: i * 0.07, bus: master! }));
  },
  coin() {
    tone({ f: 988, dur: 0.08, peak: 0.12, type: 'square', bus: master! });
    tone({ f: 1319, dur: 0.25, peak: 0.12, type: 'square', delay: 0.07, bus: master! });
  },
  click() {
    tone({ f: 660, to: 440, dur: 0.05, peak: 0.15, type: 'triangle', bus: master! });
  },
  open() {
    noise({ dur: 0.5, freq: 700, q: 0.6, peak: 0.5, type: 'lowpass', bus: master! });
    [523, 659, 784, 1047].forEach((f, i) => tone({ f, dur: 0.35, peak: 0.22, type: 'triangle', delay: 0.1 + i * 0.08, bus: master! }));
  },
  reveal(tier: number) {
    const base = [523, 587, 659, 784, 880, 988, 1175][Math.min(6, tier)];
    const n = 2 + Math.min(4, tier);
    for (let i = 0; i < n; i++) tone({ f: base * Math.pow(1.26, i), dur: 0.4, peak: 0.18, type: 'triangle', delay: i * 0.06, bus: master! });
    if (tier >= 4) noise({ dur: 1.0, freq: 3000, q: 0.3, peak: 0.12, type: 'highpass', delay: 0.1, bus: master! });
  },
  levelUp() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ f, dur: 0.35, peak: 0.1, type: 'square', delay: i * 0.09, bus: master! }));
  },
};

function bellHit(delay: number) {
  const base = 820;
  const parts: [number, number, number][] = [
    [1, 0.38, 1.6],
    [2.0, 0.16, 1.1],
    [2.76, 0.2, 0.9],
    [4.07, 0.1, 0.6],
    [5.4, 0.07, 0.4],
  ];
  for (const [r, g, d] of parts) tone({ f: base * r, dur: d, peak: g, delay, attack: 0.002 });
  noise({ dur: 0.02, freq: 4000, type: 'highpass', peak: 0.25, delay });
}

// ───────── Público sintetizado (vozes + palmas) ─────────

const VOWELS: [number, number][] = [
  [730, 1090], [530, 1840], [400, 2000], [570, 840], [440, 1020], [660, 1700], [300, 870],
];

async function buildCrowd(sr: number): Promise<void> {
  const Off = window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!Off) return;
  const rate = Math.min(sr, 24000);
  try {
    bank.babble = await render(Off, rate, 8, (c, out) => voices(c, out, 34, 8, 'babble'));
    bank.cheer = await render(Off, rate, 3.2, (c, out) => {
      voices(c, out, 40, 3.2, 'cheer');
      claps(c, out, 3.2, 90);
    });
    bank.oooh = await render(Off, rate, 2.2, (c, out) => voices(c, out, 36, 2.2, 'oooh'));
    bank.claps = await render(Off, rate, 3.5, (c, out) => claps(c, out, 3.5, 160));
  } catch {
    /* sem público sintetizado */
  }
}

async function render(
  Off: typeof OfflineAudioContext, rate: number, secs: number, build: (c: OfflineAudioContext, out: AudioNode) => void,
): Promise<AudioBuffer> {
  const c = new Off(1, Math.floor(rate * secs), rate);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 3400;
  const g = c.createGain();
  g.gain.value = 0.5;
  lp.connect(g);
  g.connect(c.destination);
  build(c, lp);
  return c.startRendering();
}

/** Vozes humanas: dente-de-serra com vibrato através de dois formantes, em sílabas. */
function voices(c: OfflineAudioContext, out: AudioNode, n: number, secs: number, kind: 'babble' | 'cheer' | 'oooh') {
  for (let i = 0; i < n; i++) {
    const o = c.createOscillator();
    o.type = 'sawtooth';
    const female = Math.random() < 0.35;
    const f0 = (female ? 190 : 105) * (0.85 + Math.random() * 0.4) * (kind === 'cheer' ? 1.45 : 1);
    o.frequency.setValueAtTime(f0, 0);
    const vib = c.createOscillator();
    vib.frequency.value = 4 + Math.random() * 3;
    const vg = c.createGain();
    vg.gain.value = f0 * 0.025;
    vib.connect(vg);
    vg.connect(o.frequency);
    const [f1, f2] = VOWELS[kind === 'oooh' ? 3 : kind === 'cheer' ? (Math.random() < 0.5 ? 0 : 5) : Math.floor(Math.random() * VOWELS.length)];
    const g = c.createGain();
    g.gain.value = 0;
    const b1 = c.createBiquadFilter();
    b1.type = 'bandpass';
    b1.frequency.value = f1 * (female ? 1.15 : 1);
    b1.Q.value = 6;
    const b2 = c.createBiquadFilter();
    b2.type = 'bandpass';
    b2.frequency.value = f2 * (female ? 1.15 : 1);
    b2.Q.value = 8;
    const b2g = c.createGain();
    b2g.gain.value = 0.5;
    o.connect(b1);
    o.connect(b2);
    b2.connect(b2g);
    b1.connect(g);
    b2g.connect(g);
    g.connect(out);
    const amp = (0.5 + Math.random() * 0.5) / Math.sqrt(n) * 2.2;
    if (kind === 'babble') {
      // sílabas soltas, conversa e incentivo
      let t = Math.random() * 0.5;
      while (t < secs - 0.2) {
        const len = 0.08 + Math.random() * 0.22;
        const a = amp * (0.4 + Math.random() * 0.6);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(a, t + 0.03);
        g.gain.linearRampToValueAtTime(a * 0.7, t + len);
        g.gain.linearRampToValueAtTime(0, t + len + 0.04);
        o.frequency.setValueAtTime(f0 * (0.9 + Math.random() * 0.25), t);
        t += len + 0.05 + Math.random() * (Math.random() < 0.2 ? 1.2 : 0.25);
      }
      g.gain.setValueAtTime(0, secs - 0.05);
    } else if (kind === 'cheer') {
      const t0 = Math.random() * 0.25;
      const peak = amp * 1.6;
      o.frequency.setValueAtTime(f0 * 0.85, t0);
      o.frequency.linearRampToValueAtTime(f0 * 1.15, t0 + 0.35);
      o.frequency.linearRampToValueAtTime(f0 * 1.05, t0 + 1.5);
      o.frequency.linearRampToValueAtTime(f0 * 0.8, secs);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(peak, t0 + 0.25);
      g.gain.linearRampToValueAtTime(peak * 0.7, t0 + 1.2 + Math.random() * 0.6);
      g.gain.linearRampToValueAtTime(0, secs - 0.05);
    } else {
      const t0 = Math.random() * 0.15;
      o.frequency.setValueAtTime(f0 * 1.25, t0);
      o.frequency.linearRampToValueAtTime(f0 * 0.75, t0 + 1.4);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(amp * 1.5, t0 + 0.18);
      g.gain.linearRampToValueAtTime(amp * 0.9, t0 + 0.9);
      g.gain.linearRampToValueAtTime(0, secs - 0.05);
    }
    o.start(0);
    vib.start(0);
    o.stop(secs);
    vib.stop(secs);
  }
}

/** Palmas: estalos curtos de ruído filtrado em instantes aleatórios. */
function claps(c: OfflineAudioContext, out: AudioNode, secs: number, n: number) {
  const len = Math.floor(c.sampleRate * 0.03);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  for (let i = 0; i < n; i++) {
    const s = c.createBufferSource();
    s.buffer = buf;
    s.playbackRate.value = 0.8 + Math.random() * 0.5;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900 + Math.random() * 1400;
    f.Q.value = 1.2;
    const g = c.createGain();
    const t = Math.random() * (secs - 0.1);
    g.gain.value = (0.25 + Math.random() * 0.35) * (1 - (t / secs) * 0.6);
    s.connect(f);
    f.connect(g);
    g.connect(out);
    s.start(t);
  }
}

// ───────── Ambiente do público (murmúrio de vozes em loop) ─────────

export function startCrowd(): void {
  if (!ok() || !ambientOn || crowd) return;
  if (!bank.babble) {
    // ainda a preparar: tenta outra vez daqui a pouco
    setTimeout(startCrowd, 400);
    return;
  }
  const src = ac!.createBufferSource();
  src.buffer = bank.babble;
  src.loop = true;
  const filter = ac!.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1800;
  const gain = ac!.createGain();
  gain.gain.value = 0.0001;
  gain.gain.setTargetAtTime(0.16, ac!.currentTime, 0.6);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(arena ?? master!);
  src.start();
  crowd = { src, gain, filter };
}

export function crowdLevel(hype: number): void {
  if (!crowd || !ac) return;
  const t = ac.currentTime;
  crowd.gain.gain.setTargetAtTime(0.12 + hype * 0.22, t, 0.4);
  crowd.filter.frequency.setTargetAtTime(1500 + hype * 1500, t, 0.4);
  crowd.src.playbackRate.setTargetAtTime(1 + hype * 0.06, t, 0.5);
}

export function stopCrowd(): void {
  if (!crowd || !ac) return;
  const c = crowd;
  crowd = null;
  c.gain.gain.setTargetAtTime(0.0001, ac.currentTime, 0.2);
  setTimeout(() => c.src.stop(), 800);
}
