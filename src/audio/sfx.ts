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

let silentEl: HTMLAudioElement | null = null;

/**
 * iPhone: com o interruptor de silêncio ligado o WebAudio fica mudo. Pedir a sessão de áudio
 * "playback" (iOS 17+) e tocar um <audio> silencioso em loop faz o jogo soar como um vídeo.
 */
function iosPlayback(): void {
  try {
    const nav = navigator as unknown as { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = 'playback';
  } catch {
    /* sem suporte */
  }
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Mac') && navigator.maxTouchPoints > 1);
  if (!ios) return;
  if (silentEl) {
    if (silentEl.paused) void silentEl.play().catch(() => {});
    return;
  }
  // 0,1 s de silêncio em WAV (8 kHz, 8 bits)
  const n = 800;
  const bytes = new Uint8Array(44 + n);
  const dv = new DataView(bytes.buffer);
  const w = (o: number, s: string) => [...s].forEach((c, i) => (bytes[o + i] = c.charCodeAt(0)));
  w(0, 'RIFF');
  dv.setUint32(4, 36 + n, true);
  w(8, 'WAVEfmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, 8000, true);
  dv.setUint32(28, 8000, true);
  dv.setUint16(32, 1, true);
  dv.setUint16(34, 8, true);
  w(36, 'data');
  dv.setUint32(40, n, true);
  bytes.fill(128, 44);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  silentEl = new Audio('data:audio/wav;base64,' + btoa(bin));
  silentEl.loop = true;
  silentEl.setAttribute('playsinline', '');
  void silentEl.play().catch(() => {});
}

/** Ativa o áudio em qualquer toque/tecla (e volta a ativá-lo se o sistema o suspender). */
export function installAudioUnlock(): void {
  const h = () => unlockAudio();
  for (const e of ['pointerdown', 'touchend', 'click', 'keydown']) document.addEventListener(e, h, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && ac && ac.state !== 'running') void ac.resume().catch(() => {});
  });
}

/** Tem de ser chamado num gesto do utilizador (requisito dos browsers). */
export function unlockAudio(): void {
  if (ac) {
    if (ac.state !== 'running') void ac.resume().catch(() => {});
    iosPlayback();
    return;
  }
  iosPlayback();
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
  prewarmSamples();
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

// ───────── Amostras de impacto pré-calculadas ─────────
//
// Os sons da luta são "gravados" uma única vez em Float32Arrays (síntese modal: excitações curtas
// a passar por ressoadores de duas pólos que imitam tábuas, molas, cabos, carne…). Cada golpe toca
// depois um AudioBufferSourceNode + GainNode — barato no telemóvel — escolhendo uma de várias
// variantes e com pequenas variações de velocidade/ganho para nunca soar igual.

const TAU = Math.PI * 2;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const white = () => Math.random() * 2 - 1;
const mk = (sr: number, secs: number) => new Float32Array(Math.ceil(sr * secs));

/** Ruído com envolvente exponencial (tau em s), opcionalmente com ataque suave. */
function addBurst(x: Float32Array, sr: number, at: number, tau: number, amp: number, attack = 0): void {
  const s0 = Math.floor(at * sr);
  const n = Math.min(x.length - s0, Math.ceil(tau * 7 * sr + attack * sr));
  const k = Math.exp(-1 / (tau * sr));
  const ka = attack > 0 ? Math.exp(-1 / (attack * sr)) : 0;
  let e = amp;
  let a = attack > 0 ? 1 : 0;
  for (let i = 0; i < n; i++) {
    x[s0 + i] += white() * e * (1 - a);
    e *= k;
    a *= ka;
  }
}

/** Impulso em meio-seno (largura w s): o "peso" de um corpo a assentar, sem agudos. */
function addPulse(x: Float32Array, sr: number, at: number, w: number, amp: number): void {
  const s0 = Math.floor(at * sr);
  const n = Math.min(x.length - s0, Math.max(1, Math.floor(w * sr)));
  for (let i = 0; i < n; i++) x[s0 + i] += amp * Math.sin((Math.PI * (i + 0.5)) / n);
}

/** Seno amortecido com queda de tom (f0 → f1, constante sweep) e decaimento tau. */
function addSweep(
  x: Float32Array, sr: number, at: number, f0: number, f1: number, sweep: number, tau: number, amp: number, attack = 0.001,
): void {
  const s0 = Math.floor(at * sr);
  const n = Math.min(x.length - s0, Math.ceil(tau * 8 * sr));
  const kd = Math.exp(-1 / (tau * sr));
  const ks = Math.exp(-1 / (sweep * sr));
  const ka = Math.exp(-1 / (attack * sr));
  const w0 = (TAU * (f0 - f1)) / sr;
  const w1 = (TAU * f1) / sr;
  let ph = Math.random() * 0.3;
  let d = amp;
  let sw = 1;
  let a = 1;
  for (let i = 0; i < n; i++) {
    ph += w1 + w0 * sw;
    x[s0 + i] += (1 - a) * d * Math.sin(ph);
    d *= kd;
    sw *= ks;
    a *= ka;
  }
}

/** Ressoador de duas pólos (modo de vibração): excita com `x` e soma em `out`. t60 em s. */
function resonate(x: Float32Array, out: Float32Array, sr: number, f: number, t60: number, g: number): void {
  const w = (TAU * f) / sr;
  const r = Math.exp(-6.91 / (t60 * sr));
  const c = 2 * r * Math.cos(w);
  const r2 = r * r;
  const norm = (1 - r) * 2 * Math.sin(w) * g;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const y = x[i] + c * y1 - r2 * y2;
    out[i] += y * norm;
    y2 = y1;
    y1 = y;
  }
}

function lowpass(x: Float32Array, sr: number, fc: number): Float32Array {
  const a = 1 - Math.exp((-TAU * fc) / sr);
  let y = 0;
  for (let i = 0; i < x.length; i++) x[i] = y += a * (x[i] - y);
  return x;
}

function highpass(x: Float32Array, sr: number, fc: number): Float32Array {
  const a = 1 - Math.exp((-TAU * fc) / sr);
  let y = 0;
  for (let i = 0; i < x.length; i++) {
    y += a * (x[i] - y);
    x[i] -= y;
  }
  return x;
}

/** Soma `x` em `out` com o pico de `x` ajustado a `peak` — equilibrar camadas fica intuitivo. */
function mix(out: Float32Array, x: Float32Array, peak: number): void {
  let m = 0;
  for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i]));
  if (m < 1e-9) return;
  const k = peak / m;
  const n = Math.min(out.length, x.length);
  for (let i = 0; i < n; i++) out[i] += x[i] * k;
}

/** Saturação suave: dá "carne" e densidade ao transiente. */
function saturate(x: Float32Array, drive: number): void {
  const k = 1 / Math.tanh(drive);
  for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * drive) * k;
}

// ── Receitas ──

/** Murro: baque grave no corpo + estalo carnudo + (luva) estalo do cabedal + cauda abafada. */
function genPunch(sr: number, body: boolean): Float32Array {
  const L = 0.42;
  const out = mk(sr, L);
  const th = mk(sr, L);
  addSweep(th, sr, 0, rnd(body ? 92 : 118, body ? 112 : 145), body ? 44 : 56, 0.03, body ? 0.075 : 0.05, 1, 0.0012);
  mix(out, th, 1);
  // excitação da carne: ruído muito curto
  const x = mk(sr, L);
  addBurst(x, sr, 0, rnd(0.007, 0.012), 1);
  const smack = highpass(lowpass(lowpass(Float32Array.from(x), sr, body ? 1500 : 2300), sr, body ? 1800 : 2600), sr, 220);
  mix(out, smack, body ? 0.6 : 0.72);
  const meat = mk(sr, L);
  resonate(x, meat, sr, rnd(body ? 230 : 320, body ? 290 : 410), body ? 0.11 : 0.08, 1);
  resonate(x, meat, sr, rnd(640, 880), 0.045, 0.55);
  resonate(x, meat, sr, rnd(1300, 1700), 0.025, 0.25);
  mix(out, meat, body ? 0.6 : 0.5);
  // cabedal da luva
  const c = mk(sr, L);
  addBurst(c, sr, 0, 0.0011, 1);
  mix(out, highpass(highpass(c, sr, 2600), sr, 2600), body ? 0.22 : 0.34);
  // cauda: roupa/pele a assentar
  const t = mk(sr, L);
  addBurst(t, sr, 0.004, rnd(0.04, 0.06), 1, 0.003);
  mix(out, lowpass(lowpass(t, sr, 520), sr, 520), 0.22);
  saturate(out, 1.7);
  return out;
}

/** Pontapé: chapada de canela/peito do pé + baque mais seco + roçar de ar. */
function genKick(sr: number): Float32Array {
  const L = 0.45;
  const out = mk(sr, L);
  const th = mk(sr, L);
  addSweep(th, sr, 0.002, rnd(100, 125), 50, 0.035, 0.065, 1, 0.0015);
  mix(out, th, 1);
  const x = mk(sr, L);
  addBurst(x, sr, 0.001, rnd(0.003, 0.005), 1);
  mix(out, highpass(Float32Array.from(x), sr, 900), 0.75);
  const sk = mk(sr, L);
  resonate(x, sk, sr, rnd(1500, 1900), 0.04, 1);
  resonate(x, sk, sr, rnd(2500, 3100), 0.025, 0.6);
  resonate(x, sk, sr, rnd(380, 460), 0.07, 0.7);
  mix(out, sk, 0.6);
  // ar deslocado pela perna mesmo antes/depois do contacto
  const air = mk(sr, L);
  addBurst(air, sr, 0, 0.05, 1, 0.012);
  mix(out, lowpass(highpass(air, sr, 600), sr, 2200), 0.16);
  saturate(out, 1.8);
  return out;
}

/** Chapada / cutelo: pele contra pele, muito agudo e seco, com um pequeno baque no peito. */
function genSlap(sr: number): Float32Array {
  const L = 0.35;
  const out = mk(sr, L);
  const x = mk(sr, L);
  addBurst(x, sr, 0, rnd(0.0022, 0.0038), 1);
  mix(out, highpass(Float32Array.from(x), sr, 1300), 1);
  const r = mk(sr, L);
  resonate(x, r, sr, rnd(2000, 2700), 0.035, 1);
  resonate(x, r, sr, rnd(1000, 1300), 0.05, 0.7);
  resonate(x, r, sr, rnd(3800, 4600), 0.02, 0.5);
  mix(out, r, 0.7);
  const th = mk(sr, L);
  addSweep(th, sr, 0.001, rnd(165, 210), 92, 0.025, 0.035, 1);
  mix(out, th, 0.5);
  saturate(out, 2.2);
  return out;
}

/** Defesa: antebraço/luva a travar — abafado, sem estalo. */
function genBlock(sr: number): Float32Array {
  const L = 0.28;
  const out = mk(sr, L);
  const th = mk(sr, L);
  addSweep(th, sr, 0, rnd(140, 165), 92, 0.025, 0.032, 1);
  mix(out, th, 0.9);
  const x = mk(sr, L);
  addBurst(x, sr, 0, rnd(0.005, 0.008), 1);
  const r = mk(sr, L);
  resonate(x, r, sr, rnd(560, 720), 0.06, 1);
  resonate(x, r, sr, rnd(1100, 1300), 0.03, 0.4);
  mix(out, r, 0.55);
  mix(out, highpass(lowpass(lowpass(x, sr, 1200), sr, 1200), sr, 180), 0.7);
  saturate(out, 1.5);
  return out;
}

/**
 * Queda no tapete: lona sobre tábuas de contraplacado sobre molas. Estrondo grave e oco das
 * tábuas (modos de placa), chapada da pele na lona, aba da lona, e o chocalhar metálico das molas.
 */
function genSlam(sr: number): Float32Array {
  const L = 1.5;
  const out = mk(sr, L);
  // contacto do corpo: impulso macio (massa grande)
  const hit = mk(sr, L);
  addPulse(hit, sr, 0, rnd(0.006, 0.01), 1);
  // (uma só batida: uma segunda, ~25 ms depois, soava a duas quedas)
  const boards = mk(sr, L);
  const modes: [number, number, number][] = [
    [rnd(46, 55), 0.5, 1],
    [rnd(70, 84), 0.42, 0.85],
    [rnd(104, 122), 0.3, 0.65],
    [rnd(148, 170), 0.24, 0.55],
    [rnd(200, 236), 0.17, 0.45],
    [rnd(285, 330), 0.12, 0.3],
    [rnd(395, 450), 0.085, 0.2],
    [rnd(560, 630), 0.06, 0.12],
  ];
  for (const [f, t60, g] of modes) resonate(hit, boards, sr, f, t60, g);
  mix(out, boards, 1);
  // "bum" do ar debaixo do ringue (caixa oca), com queda de tom
  const boom = mk(sr, L);
  addSweep(boom, sr, 0, rnd(72, 86), 37, 0.07, 0.15, 1, 0.003);
  mix(out, boom, 0.75);
  // chapada da pele/costas na lona
  const sk = mk(sr, L);
  addBurst(sk, sr, 0.001, rnd(0.004, 0.007), 1);
  const skr = mk(sr, L);
  resonate(sk, skr, sr, rnd(1500, 2000), 0.03, 1);
  resonate(sk, skr, sr, rnd(2600, 3300), 0.02, 0.6);
  mix(skr, highpass(sk, sr, 900), 0.8);
  mix(out, skr, 0.42);
  // aba da lona / pó: ruído grave curto
  const fl = mk(sr, L);
  addBurst(fl, sr, 0.002, rnd(0.05, 0.075), 1, 0.004);
  mix(out, lowpass(lowpass(fl, sr, 650), sr, 650), 0.4);
  // molas e esticadores: estalidos irregulares em ressoadores metálicos
  const cl = mk(sr, L);
  addBurst(cl, sr, 0.003, 0.0015, 1);
  let t = rnd(0.014, 0.022);
  let a = rnd(0.6, 0.85);
  const clicks = 8 + Math.floor(Math.random() * 7);
  for (let k = 0; k < clicks && t < L - 0.1; k++) {
    addBurst(cl, sr, t, 0.0005, a * rnd(0.5, 1));
    t += rnd(0.01, 0.038) * (1 + k * 0.08);
    a *= rnd(0.72, 0.88);
  }
  const sp = mk(sr, L);
  const springs: [number, number, number][] = [
    [rnd(510, 590), rnd(0.22, 0.32), 0.9],
    [rnd(830, 930), rnd(0.2, 0.3), 1],
    [rnd(1240, 1400), rnd(0.16, 0.26), 0.8],
    [rnd(1880, 2120), rnd(0.12, 0.2), 0.6],
    [rnd(2850, 3250), rnd(0.08, 0.14), 0.4],
  ];
  for (const [f, t60, g] of springs) resonate(cl, sp, sr, f, t60, g);
  mix(out, sp, 0.13);
  saturate(out, 1.35);
  return out;
}

/** Ressalto nas cordas: três cabos de aço (parciais ligeiramente inarmónicos, desafinados entre si),
 *  rangido do revestimento (stick-slip), baque na almofada e "clinc" do esticador. */
function genRopes(sr: number): Float32Array {
  const L = 1.3;
  const out = mk(sr, L);
  const cab = mk(sr, L);
  const base = rnd(56, 66);
  for (let c = 0; c < 3; c++) {
    const f0 = base * (1 + (c - 1) * rnd(0.008, 0.016));
    const at = c * rnd(0.004, 0.012);
    for (let n = 1; n <= 6; n++) {
      const fn = f0 * n * Math.sqrt(1 + 0.0016 * n * n);
      const amp = (n % 2 ? 1 : 0.7) / Math.pow(n, 1.1) * (c === 1 ? 1 : 0.7);
      const t60 = 1.05 / (1 + 0.38 * (n - 1));
      addSweep(cab, sr, at, fn * rnd(1.03, 1.06), fn, 0.07, t60 / 6.9, amp, 0.004);
    }
  }
  mix(out, cab, 1);
  // baque do corpo nas cordas almofadadas
  const th = mk(sr, L);
  addSweep(th, sr, 0, rnd(90, 110), 60, 0.04, 0.045, 1, 0.006);
  mix(out, th, 0.55);
  // rangido: atrito em impulsos com intervalo a crescer
  const cr = mk(sr, L);
  let t = rnd(0.015, 0.03);
  const end = t + rnd(0.12, 0.22);
  let gap = rnd(0.0025, 0.004);
  while (t < end) {
    const u = (t - 0.015) / (end - 0.015);
    addBurst(cr, sr, t, 0.0004, Math.sin(Math.PI * Math.min(1, u)) * rnd(0.4, 1));
    t += gap * rnd(0.7, 1.3);
    gap *= 1.025;
  }
  const crr = mk(sr, L);
  resonate(cr, crr, sr, rnd(360, 420), 0.04, 1);
  resonate(cr, crr, sr, rnd(720, 830), 0.035, 0.8);
  resonate(cr, crr, sr, rnd(1400, 1600), 0.025, 0.5);
  mix(out, crr, 0.3);
  // esticador metálico
  const tb = mk(sr, L);
  addBurst(tb, sr, rnd(0.01, 0.02), 0.0006, 1);
  const tbr = mk(sr, L);
  resonate(tb, tbr, sr, rnd(2200, 2500), 0.14, 1);
  resonate(tb, tbr, sr, rnd(3500, 3800), 0.1, 0.7);
  resonate(tb, tbr, sr, rnd(5000, 5400), 0.07, 0.5);
  mix(out, tbr, 0.07);
  return out;
}

/** Deslocação de ar: ruído num filtro passa-banda que sobe e desce, com envolvente em sino. */
function genWhoosh(sr: number): Float32Array {
  const dur = rnd(0.26, 0.38);
  const out = mk(sr, dur + 0.04);
  const lo = rnd(300, 420);
  const hi = rnd(1300, 1900);
  const peakAt = rnd(0.45, 0.62);
  let low = 0;
  let band = 0;
  const q = rnd(0.9, 1.3);
  const n = Math.floor(dur * sr);
  const body = mk(sr, dur + 0.04);
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const shape = u < peakAt ? u / peakAt : 1 - (u - peakAt) / (1 - peakAt);
    const env = Math.pow(Math.sin((Math.PI / 2) * shape), 2.2);
    const fc = lo + (hi - lo) * shape;
    const f = 2 * Math.sin((Math.PI * fc) / sr);
    const inp = white();
    low += f * band;
    const high = inp - low - q * band;
    band += f * high;
    out[i] = band * env;
    body[i] = inp * env;
  }
  mix(out, lowpass(lowpass(body, sr, 380), sr, 380), 0.5);
  return out;
}

/** Sino de boxe: modos inarmónicos de uma campânula de latão, com pares a bater. */
function genBell(sr: number): Float32Array {
  const L = 2.6;
  const out = mk(sr, L);
  const x = mk(sr, L);
  addPulse(x, sr, 0, 0.0004, 1);
  const base = rnd(745, 765);
  const parts: [number, number, number][] = [
    [1, 1, 2.4], [1.0028, 0.7, 2.3], [2.02, 0.32, 1.6], [2.74, 0.55, 1.35], [2.752, 0.3, 1.3],
    [3.95, 0.3, 0.95], [5.31, 0.22, 0.65], [6.83, 0.12, 0.45], [8.42, 0.08, 0.3],
  ];
  const r = mk(sr, L);
  for (const [k, g, t60] of parts) resonate(x, r, sr, base * k, t60, g);
  mix(out, r, 1);
  const c = mk(sr, L);
  addBurst(c, sr, 0, 0.0015, 1);
  mix(out, highpass(c, sr, 3000), 0.35);
  return out;
}

/** Pisão: sola/tacão da bota a enterrar-se no tronco (couro + carne) e o tapete a ecoar por baixo. */
function genStomp(sr: number): Float32Array {
  const L = 0.9;
  const out = mk(sr, L);
  // tacão de borracha/couro: estalo seco e curto
  const heel = mk(sr, L);
  addBurst(heel, sr, 0, rnd(0.0018, 0.003), 1);
  const hr = mk(sr, L);
  resonate(heel, hr, sr, rnd(900, 1150), 0.035, 1);
  resonate(heel, hr, sr, rnd(1700, 2100), 0.025, 0.6);
  mix(hr, highpass(heel, sr, 1100), 0.7);
  mix(out, hr, 0.55);
  // carne/tronco: baque surdo com queda de tom (o ar a sair dos pulmões)
  const th = mk(sr, L);
  addSweep(th, sr, 0.001, rnd(105, 125), 48, 0.04, 0.09, 1, 0.002);
  mix(out, th, 1);
  const meat = mk(sr, L);
  addBurst(meat, sr, 0.001, rnd(0.006, 0.01), 1);
  const mr = mk(sr, L);
  resonate(meat, mr, sr, rnd(220, 280), 0.09, 1);
  resonate(meat, mr, sr, rnd(520, 640), 0.05, 0.5);
  mix(out, mr, 0.5);
  // o corpo afunda e as tábuas do ringue respondem (mais curto que uma queda)
  const hit = mk(sr, L);
  addPulse(hit, sr, 0.004, rnd(0.008, 0.012), 1);
  const boards = mk(sr, L);
  for (const [f, t60, g] of [[rnd(50, 58), 0.32, 1], [rnd(76, 88), 0.26, 0.8], [rnd(118, 134), 0.18, 0.55], [rnd(170, 195), 0.12, 0.4]] as [number, number, number][]) resonate(hit, boards, sr, f, t60, g);
  mix(out, boards, 0.55);
  // expiração abafada do adversário ("uff")
  const air = mk(sr, L);
  addBurst(air, sr, 0.02, 0.07, 1, 0.012);
  mix(out, lowpass(highpass(air, sr, 350), sr, 1400), 0.12);
  saturate(out, 1.6);
  return out;
}

const RECIPES: Record<string, { n: number; gen: (sr: number) => Float32Array }> = {
  stomp: { n: 3, gen: genStomp },
  punchHead: { n: 4, gen: (sr) => genPunch(sr, false) },
  punchBody: { n: 3, gen: (sr) => genPunch(sr, true) },
  kick: { n: 3, gen: genKick },
  slap: { n: 3, gen: genSlap },
  block: { n: 3, gen: genBlock },
  slam: { n: 3, gen: genSlam },
  ropes: { n: 3, gen: genRopes },
  whoosh: { n: 4, gen: genWhoosh },
  bell: { n: 1, gen: genBell },
};

type SampleName = keyof typeof RECIPES;
const samples: Partial<Record<SampleName, AudioBuffer[]>> = {};
const lastPick: Partial<Record<SampleName, number>> = {};

function toBuffer(c: BaseAudioContext, d: Float32Array, sr: number): AudioBuffer {
  let m = 0;
  for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i]));
  const k = m > 0 ? 0.95 / m : 1;
  const fade = Math.min(d.length, Math.floor(sr * 0.01));
  for (let i = 0; i < d.length; i++) d[i] *= k;
  for (let i = 0; i < fade; i++) d[d.length - 1 - i] *= i / fade;
  const b = c.createBuffer(1, d.length, sr);
  b.getChannelData(0).set(d);
  return b;
}

/** Taxa a que as amostras são calculadas (o browser reamostra ao tocar): poupa CPU e memória. */
const genRate = () => Math.min(ac!.sampleRate, 32000);

/** Calcula mais uma variante; devolve false quando a amostra já está completa. */
function genOne(name: SampleName): boolean {
  if (!ac) return false;
  const set = (samples[name] ??= []);
  const r = RECIPES[name];
  if (set.length >= r.n) return false;
  const c = ac;
  const sr = genRate();
  const d = r.gen(sr);
  set.push(toBuffer(c, d, sr));
  return true;
}

/** Variantes de uma amostra (se ainda não houver nenhuma, calcula uma já). */
function getSamples(name: SampleName): AudioBuffer[] | null {
  if (!ac) return null;
  if (!samples[name]?.length) genOne(name);
  return samples[name] ?? null;
}

/** Pré-calcula as amostras uma variante de cada vez, para não engasgar a interface. */
function prewarmSamples(): void {
  const names = Object.keys(RECIPES) as SampleName[];
  let i = 0;
  const step = () => {
    while (i < names.length && !genOne(names[i])) i++;
    if (i < names.length) setTimeout(step, 16);
  };
  setTimeout(step, 150);
}

/** Limite de vozes simultâneas (telemóveis). */
const MAX_VOICES = 20;
let liveVoices = 0;

interface ShotOpts {
  rate?: number;
  delay?: number;
  /** Passa-baixo opcional (ex.: golpes fracos mais abafados). */
  lp?: number;
  /** Toca mesmo acima do limite de vozes. */
  force?: boolean;
  bus?: AudioNode;
}

/** Toca uma variante (nunca a mesma duas vezes seguidas) de uma amostra pré-calculada. */
function shot(name: SampleName, gain: number, o: ShotOpts = {}): void {
  if (!ok()) return;
  if (liveVoices >= MAX_VOICES && !o.force) return;
  const set = getSamples(name);
  if (!set || !set.length) return;
  let idx = Math.floor(Math.random() * set.length);
  if (set.length > 1 && idx === lastPick[name]) idx = (idx + 1) % set.length;
  lastPick[name] = idx;
  const c = ac!;
  const s = c.createBufferSource();
  s.buffer = set[idx];
  s.playbackRate.value = o.rate ?? 1;
  const g = c.createGain();
  g.gain.value = gain;
  if (o.lp) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = o.lp;
    f.Q.value = 0.5;
    s.connect(f);
    f.connect(g);
  } else s.connect(g);
  g.connect(o.bus ?? arena ?? master!);
  liveVoices++;
  s.onended = () => {
    liveVoices = Math.max(0, liveVoices - 1);
    g.disconnect();
  };
  s.start(c.currentTime + (o.delay ?? 0));
}

let lastCrowd = 0;

export const sfx = {
  /** Silencia temporariamente (ex.: ao saltar a luta). */
  setMuted(m: boolean) {
    muted = m;
  },
  /**
   * Golpe que acerta. `power` 0..1; `body` = ao corpo (mais grave e surdo).
   * `kind` é opcional: sem ele, 0.75 (o valor que o motor usa para pontapés) soa a pontapé.
   */
  punch(power = 0.6, body = false, kind?: 'punch' | 'kick' | 'chop') {
    const p = Math.max(0.2, Math.min(1, power));
    const k = kind ?? (Math.abs(power - 0.75) < 0.02 ? 'kick' : 'punch');
    const lp = p < 0.5 ? 2200 + p * 4000 : undefined;
    if (k === 'chop') {
      shot('slap', 0.6 + p * 0.35, { rate: jit(1, 0.06) });
      shot('punchBody', 0.35 + p * 0.2, { rate: jit(1, 0.05), lp: 1800 });
    } else if (k === 'kick') {
      shot('kick', 0.6 + p * 0.4, { rate: jit(body ? 0.92 : 1, 0.05), lp });
    } else {
      shot(body ? 'punchBody' : 'punchHead', 0.55 + p * 0.45, { rate: jit(1.04 - p * 0.1, 0.05), lp });
    }
    if (p >= 0.95) {
      // golpe pesado: chapada extra e um "bum" grave no peito
      shot('slap', 0.22, { rate: jit(0.8, 0.05), delay: 0.003 });
      tone({ f: jit(68, 0.08), to: 36, dur: 0.2, peak: 0.45 });
    }
  },
  hit(heavy = false) {
    sfx.punch(heavy ? 1 : 0.6);
  },
  /** Pisão no adversário deitado. `power` 0..1 (o último é o mais forte). */
  stomp(power = 0.7) {
    const p = Math.max(0.3, Math.min(1.2, power));
    shot('stomp', 0.65 + p * 0.35, { rate: jit(1.04 - p * 0.08, 0.05), force: true });
    if (p > 0.9) tone({ f: jit(62, 0.06), to: 32, dur: 0.25, peak: 0.35 });
  },
  /** O outro pé a bater no tapete para fazer barulho (como os lutadores a sério). */
  stamp() {
    shot('slam', 0.22, { rate: jit(1.5, 0.05), lp: 1400 });
  },
  /** Impacto de golpe de assinatura / super: estrondo grave, estalo e cauda. */
  impact(power = 1) {
    // sem camada de queda: as projeções já tocam o seu estrondo (senão ouviam-se dois)
    tone({ f: jit(90, 0.05), to: 26, dur: 0.6 * power, peak: 0.55 * power });
    shot('slap', 0.3, { rate: jit(0.75, 0.05) });
  },
  /** Golpe defendido: luva/antebraço a travar, abafado. */
  block() {
    shot('block', jit(0.75, 0.1), { rate: jit(1, 0.06) });
  },
  /** Deslocação de ar de um golpe a passar / mergulho. */
  whoosh() {
    shot('whoosh', jit(0.32, 0.15), { rate: jit(1, 0.12) });
  },
  /** Queda no tapete do ringue: estrondo das tábuas + chapada na lona + molas. */
  slam(power = 1) {
    const p = Math.max(0.3, Math.min(1.3, power));
    shot('slam', 0.7 + 0.3 * Math.min(1, p), {
      rate: jit(1.06 - (p - 0.6) * 0.14, 0.04),
      lp: p < 0.6 ? 2500 : undefined,
      force: true,
    });
    if (p > 1.05) {
      // quedas enormes (finishers): segundo corpo do estrondo, mais grave
      shot('slam', 0.4 * (p - 0.9), { rate: jit(0.78, 0.03), lp: 900 });
      tone({ f: jit(55, 0.05), to: 28, dur: 0.45, peak: 0.5 * (p - 0.8) });
    }
  },
  thud() {
    sfx.slam(1);
  },
  /** Ressalto nas cordas: cabos esticados a vibrar + rangido + esticador. */
  ropes() {
    shot('ropes', jit(0.65, 0.1), { rate: jit(1, 0.05) });
  },
  /** Sino de boxe: três toques. */
  bell() {
    for (let i = 0; i < 3; i++) shot('bell', 0.55, { delay: i * 0.26, rate: jit(1, 0.004), force: true });
  },
  ding() {
    shot('bell', 0.55, { force: true });
  },
  /** Chapada / golpe de cutelo no peito. */
  slap() {
    shot('slap', jit(0.85, 0.08), { rate: jit(1, 0.07), force: true });
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
  /** Explosão / impacto de finisher: estrondo do ringue reforçado com sub-grave. */
  boom() {
    shot('slam', 0.9, { rate: jit(0.72, 0.03), force: true });
    tone({ f: 58, to: 26, dur: 1.1, peak: 0.8 });
    noise({ dur: 0.9, freq: 140, type: 'lowpass', peak: 0.6 });
    noise({ dur: 0.35, freq: 1400, q: 0.7, peak: 0.22 });
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
