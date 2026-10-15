import { glowSprite } from '../render/fighter';
import { hash } from './fx';

/** Meia-largura da zona de luta (entre as cordas laterais). */
export const RING = 460;
export const BACK_Y = -78;
export const FRONT_Y = 42;
export const BACK_X = RING + 8;
export const FRONT_X = RING + 54;
export const ROPE_H = [44, 86, 128];
export const POST_H = 150;
export const APRON_X = RING + 92;

export const TEAM_COLORS = ['#ff3b4e', '#2f7bff'];

/** Profundidade (0 = poste de trás, 1 = poste da frente) da linha onde os lutadores estão. */
export const ROPE_U = -BACK_Y / (FRONT_Y - BACK_Y);
/** x das cordas laterais na linha dos lutadores. */
export const ROPE_LINE_X = BACK_X + (FRONT_X - BACK_X) * ROPE_U;
const NODES = 15;

/** Uma corda simulada como fio elástico: deslocamento para fora (d) e para baixo (h) em cada nó. */
export interface RopeLine {
  d: Float32Array;
  vd: Float32Array;
  h: Float32Array;
  vh: Float32Array;
  /** Contactos ativos: deslocamento imposto em cada nó e até quando (tempo). */
  hd: Float32Array;
  hh: Float32Array;
  until: Float32Array;
}

export interface RopeState {
  /** Cordas laterais [lado][corda 0..2] e cordas da frente [corda 0..2]. */
  side: RopeLine[][];
  front: RopeLine[];
  t: number;
}

function line(): RopeLine {
  return {
    d: new Float32Array(NODES), vd: new Float32Array(NODES), h: new Float32Array(NODES), vh: new Float32Array(NODES),
    hd: new Float32Array(NODES), hh: new Float32Array(NODES), until: new Float32Array(NODES),
  };
}

export function newRopes(): RopeState {
  return { side: [[line(), line(), line()], [line(), line(), line()]], front: [line(), line(), line()], t: 0 };
}

const TENSION = 2600;
const DAMP = 2.6;

function stepLine(L: RopeLine, dt: number, now: number): void {
  const n = NODES - 1;
  for (let i = 1; i < n; i++) {
    const ad = TENSION * (L.d[i - 1] + L.d[i + 1] - 2 * L.d[i]) - DAMP * L.vd[i] - 14 * L.d[i];
    const ah = TENSION * (L.h[i - 1] + L.h[i + 1] - 2 * L.h[i]) - DAMP * L.vh[i] - 14 * L.h[i];
    L.vd[i] += ad * dt;
    L.vh[i] += ah * dt;
  }
  for (let i = 1; i < n; i++) {
    L.d[i] += L.vd[i] * dt;
    L.h[i] += L.vh[i] * dt;
    if (L.until[i] > now) {
      // o corpo empurra a corda: fica pelo menos tão deslocada como o contacto
      if (L.hd[i] > 0 && L.d[i] < L.hd[i]) {
        L.d[i] += (L.hd[i] - L.d[i]) * 0.6;
        L.vd[i] = Math.max(0, L.vd[i]) * 0.3;
      }
      if (L.hh[i] !== 0 && Math.abs(L.h[i]) < Math.abs(L.hh[i])) {
        L.h[i] += (L.hh[i] - L.h[i]) * 0.6;
        L.vh[i] *= 0.3;
      }
    }
  }
}

export function updateRopes(r: RopeState, dt: number): void {
  r.t += dt;
  const sub = 4;
  const h = Math.min(dt, 0.05) / sub;
  for (let k = 0; k < sub; k++) {
    for (const side of r.side) for (const L of side) stepLine(L, h, r.t);
    for (const L of r.front) stepLine(L, h, r.t);
  }
}

/**
 * Contacto com uma corda lateral: empurra-a para fora (`out`) e/ou para baixo (`down`) à volta
 * da profundidade `u`, durante `life` segundos (renovar a cada frame enquanto dura).
 */
export function ropeHold(r: RopeState, side: 0 | 1, rope: number, out: number, down = 0, u = ROPE_U, width = 0.2, life = 0.06): void {
  const L = r.side[side][rope];
  for (let i = 1; i < NODES - 1; i++) {
    const k = Math.abs(i / (NODES - 1) - u) / width;
    if (k >= 1) continue;
    const w = Math.cos(k * Math.PI * 0.5);
    const f = w * w;
    if (L.until[i] <= r.t) {
      L.hd[i] = 0;
      L.hh[i] = 0;
    }
    L.hd[i] = Math.max(L.hd[i], out * f);
    if (Math.abs(down * f) > Math.abs(L.hh[i])) L.hh[i] = down * f;
    L.until[i] = r.t + life;
  }
}

/** Impulso numa corda lateral (todas as 3 se `rope` < 0): ela abana e as ondas correm até aos postes. */
export function pushRope(r: RopeState, side: 0 | 1, amount: number, rope = -1, up = 0, u = ROPE_U): void {
  for (let j = 0; j < 3; j++) {
    if (rope >= 0 && j !== rope) continue;
    const L = r.side[side][j];
    const k = rope >= 0 ? 1 : [0.65, 1, 0.85][j];
    for (let i = 1; i < NODES - 1; i++) {
      const x = Math.abs(i / (NODES - 1) - u) / 0.22;
      if (x >= 1) continue;
      const f = Math.cos(x * Math.PI * 0.5);
      L.vd[i] += Math.abs(amount) * k * f;
      L.vh[i] -= up * k * f;
    }
  }
}

/** O ringue estremece (queda forte no tapete): todas as cordas vibram um pouco. */
export function ringShake(r: RopeState, power: number): void {
  const all = [...r.side[0], ...r.side[1], ...r.front];
  for (const L of all) {
    for (let i = 1; i < NODES - 1; i++) {
      const f = Math.sin((i / (NODES - 1)) * Math.PI);
      L.vh[i] += power * (40 + Math.random() * 30) * f;
      L.vd[i] += power * (Math.random() - 0.5) * 30 * f;
    }
  }
}

/** Altura (em ecrã) de uma corda lateral na linha dos lutadores, já com a deformação. */
export function ropeHeightAt(r: RopeState, side: 0 | 1, rope: number): number {
  const L = r.side[side][rope];
  const i = Math.round(ROPE_U * (NODES - 1));
  return ROPE_H[rope] * (0.92 + 0.08 * ROPE_U) - L.h[i];
}

// ───────────────────────── Fundo pré-renderizado ─────────────────────────

/** Camada pré-renderizada de uma faixa vertical do fundo (só guarda as linhas de BH que têm conteúdo). */
interface Layer {
  c: HTMLCanvasElement;
  y0: number;
  h: number;
}

let backdrop: HTMLCanvasElement | null = null;
let crowdBack: Layer[] = [];
let crowdFront: Layer[] = [];
let crowdArms: Layer[] = [];
let barrier: Layer | null = null;
let phones: { x: number; y: number; p: number }[] = [];
let sticks: { x: number; y: number; s: number; g: number; c: string; p: number }[] = [];
let vignette: HTMLCanvasElement | null = null;
const BW = 2600;
const BH = 760;

const OUT = '#160d24';
const SHIRTS = [
  '#e63946', '#f1c40f', '#3498db', '#2ecc71', '#9b59b6', '#ecf0f1', '#e67e22', '#1abc9c', '#ff6fb5', '#34495e', '#2f7bff', '#222831', '#f5f0e1', '#c0392b',
];
const SKINS = ['#f6c9a4', '#e8b083', '#b9774c', '#6e3f28', '#d29466', '#94593a'];
const HAIRS = ['#1b1714', '#3a2a1a', '#5a3418', '#e2b44a', '#b8461b', '#8d8f95', '#101010'];
const PRINTS = ['#ffffff', '#ffd23d', '#16121f', '#ff3b4e', '#2f7bff'];
const HATS = ['#e63946', '#2f7bff', '#16121f', '#f1c40f', '#2ecc71', '#ffffff', '#ff6fb5'];
const NEON = ['#39ff88', '#ff4fd8', '#3ad8ff', '#ffe14d'];
const SIGN_BG = ['#ffffff', '#ffe14d', '#ff9ccf', '#9fe8ff', '#ffffff'];
const SIGN_INK = ['#e63946', '#2f7bff', '#16121f', '#9b2fd6'];
const WORDS = ['WOW!', 'K.O.!', '10/10', 'LEGEND', 'POWER', 'GO!', 'CHAMP', 'BOOM', 'HYPE!', 'HI MOM', 'GOAT', 'SLAM!', 'KING ♛', 'RING ♥'];
const CROWD_GROUPS = 3;
/** Entrada dos lutadores (palco + rampa) e corredores das bancadas, em coordenadas do fundo. */
const STAGE_X = 820;
const STAGE_HW = 132;
const AISLES = [380, 1090, 1530, 2230];
const TRUSS_LIGHTS: number[] = [];
for (let x = 140; x < BW; x += 165) TRUSS_LIGHTS.push(x);

interface Spot {
  x: number;
  y: number;
  s: number;
  g: number;
  i: number;
  r: number;
}

function mk(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return [c, c.getContext('2d')!];
}

function darken(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${Math.round(((n >> 16) & 255) * k)},${Math.round(((n >> 8) & 255) * k)},${Math.round((n & 255) * k)})`;
}

function pick<T>(a: T[], v: number): T {
  return a[Math.floor(v * a.length) % a.length];
}

/** Preenche o caminho atual e contorna-o com o traço escuro do estilo cartoon. */
function inked(g: CanvasRenderingContext2D, fill: string | CanvasGradient, lw: number): void {
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = lw;
  g.strokeStyle = OUT;
  g.stroke();
}

function crownPath(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  g.beginPath();
  g.moveTo(x - w * 0.5, y);
  g.lineTo(x - w * 0.56, y - h * 0.85);
  g.lineTo(x - w * 0.26, y - h * 0.42);
  g.lineTo(x, y - h);
  g.lineTo(x + w * 0.26, y - h * 0.42);
  g.lineTo(x + w * 0.56, y - h * 0.85);
  g.lineTo(x + w * 0.5, y);
  g.closePath();
}

function starPath(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
}

/** Posições de todos os espectadores (determinísticas). Os grupos são blocos de vizinhos que saltam juntos. */
function crowdSpots(): Spot[] {
  const out: Spot[] = [];
  const rows = 8;
  for (let r = 0; r < rows; r++) {
    const s = 0.62 + r * 0.06;
    const y = 232 + r * 60;
    let x = -20 + hash(r * 31) * 30;
    let i = 0;
    while (x < BW + 30) {
      const blocked = Math.abs(x - STAGE_X) < STAGE_HW + 14 || AISLES.some((a) => Math.abs(x - a) < 20 + 10 * s);
      if (!blocked) {
        const blk = Math.floor((x + hash(r * 13) * 170) / 170);
        out.push({ x, y: y + (hash(r * 97 + i) - 0.5) * 8, s, g: Math.floor(hash(blk * 7.3 + r * 1.1) * CROWD_GROUPS), i: i + r * 1000, r });
      }
      x += (30 + hash(r * 999 + i) * 14) * s * 1.25;
      i++;
    }
  }
  return out;
}

/** Altura da cabeça de cada pessoa (há gente mais alta e mais baixa). */
function headY(p: Spot): number {
  return p.y + (hash(p.i * 4.9) - 0.5) * 7 * p.s;
}

function hairBack(g: CanvasRenderingContext2D, style: number, x: number, y: number, s: number, hair: string, sd: number): void {
  const lw = 1.8 * s;
  g.beginPath();
  if (style === 1) g.roundRect(x - 12.6 * s, y - 7 * s, 25.2 * s, 29 * s, 10 * s);
  else if (style === 3) g.arc(x, y - 2 * s, 15 * s, 0, Math.PI * 2);
  else if (style === 6) g.arc(x, y - 11 * s, 5.5 * s, 0, Math.PI * 2);
  else if (style === 8) g.ellipse(x + sd * 11 * s, y + 9 * s, 4.5 * s, 9 * s, sd * 0.4, 0, Math.PI * 2);
  else return;
  inked(g, hair, lw);
}

function hairFront(g: CanvasRenderingContext2D, p: Spot, style: number, x: number, y: number, s: number, hair: string, look: number): void {
  const lw = 1.8 * s;
  const hat = pick(HATS, hash(p.i * 11.3));
  const cap = () => {
    g.beginPath();
    g.ellipse(x, y + 0.5 * s, 11.2 * s, 10 * s, 0, Math.PI, 0);
    g.quadraticCurveTo(x + 4 * s, y - 2 * s, x - 2 * s, y + 1.5 * s);
    g.closePath();
    inked(g, hair, lw);
  };
  switch (style) {
    case 0:
    case 1:
    case 6:
    case 8:
      cap();
      break;
    case 2: // boné com pala para o ringue
      g.beginPath();
      g.ellipse(x + Math.sign(look) * 8 * s, y - 0.5 * s, 9 * s, 2.6 * s, 0, 0, Math.PI * 2);
      inked(g, darken(hat === '#ffffff' ? '#d8d8d8' : hat, 0.75), lw);
      g.beginPath();
      g.ellipse(x, y - 1 * s, 11.4 * s, 10 * s, 0, Math.PI, 0);
      g.closePath();
      inked(g, hat, lw);
      g.fillStyle = hat === '#ffffff' ? '#e63946' : '#ffffff';
      g.beginPath();
      g.arc(x, y - 5.5 * s, 2.3 * s, 0, Math.PI * 2);
      g.fill();
      break;
    case 3: // afro: linha do cabelo
      g.fillStyle = hair;
      g.beginPath();
      g.ellipse(x, y - 1 * s, 10.4 * s, 7.5 * s, 0, Math.PI, 0);
      g.fill();
      break;
    case 4: // gorro com pompom
      g.beginPath();
      g.ellipse(x, y - 1 * s, 11.8 * s, 12 * s, 0, Math.PI, 0);
      g.closePath();
      inked(g, hat, lw);
      g.beginPath();
      g.roundRect(x - 12.2 * s, y - 4 * s, 24.4 * s, 5.4 * s, 2 * s);
      inked(g, darken(hat === '#ffffff' ? '#cccccc' : hat, 0.7), lw);
      g.beginPath();
      g.arc(x, y - 14 * s, 3.4 * s, 0, Math.PI * 2);
      inked(g, '#ffffff', lw * 0.8);
      break;
    case 5: // careca com brilho
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath();
      g.ellipse(x - 3 * s, y - 3.5 * s, 4 * s, 2.3 * s, -0.4, 0, Math.PI * 2);
      g.fill();
      break;
    case 7: { // crista colorida
      g.beginPath();
      g.moveTo(x - 4 * s, y - 4 * s);
      for (let k = 0; k <= 4; k++) {
        const px = x - 4 * s + k * 2 * s;
        g.lineTo(px - 1.5 * s, y - (12 + (k % 2) * 4) * s - (k === 2 ? 3 * s : 0));
        g.lineTo(px + 1 * s, y - 7 * s);
      }
      g.lineTo(x + 4 * s, y - 4 * s);
      g.closePath();
      inked(g, pick(NEON, hash(p.i * 3.7)), lw);
      break;
    }
    case 9: // chapéu de cowboy
      g.beginPath();
      g.ellipse(x, y - 2 * s, 17 * s, 3.8 * s, 0, 0, Math.PI * 2);
      inked(g, '#8a5a2b', lw);
      g.beginPath();
      g.roundRect(x - 8.5 * s, y - 14 * s, 17 * s, 12 * s, 4 * s);
      inked(g, '#9c6a35', lw);
      g.fillStyle = '#3a2412';
      g.fillRect(x - 8 * s, y - 5.5 * s, 16 * s, 2.6 * s);
      break;
    case 10: // coroa de papel (somos os reis do ringue!)
      cap();
      crownPath(g, x, y - 4 * s, 18 * s, 11 * s);
      inked(g, '#ffd23d', lw);
      g.fillStyle = '#e63946';
      g.beginPath();
      g.arc(x, y - 7 * s, 1.6 * s, 0, Math.PI * 2);
      g.fill();
      break;
    case 11: // fita na testa
      cap();
      g.beginPath();
      g.rect(x - 10.8 * s, y - 2.5 * s, 21.6 * s, 3.6 * s);
      inked(g, hash(p.i * 2.9) > 0.5 ? '#ff3b4e' : '#2f7bff', lw * 0.7);
      break;
    default: { // caracóis
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = Math.PI + (k / 5) * Math.PI;
        const cx = x + Math.cos(a) * 9.5 * s;
        const cy = y + Math.sin(a) * 8.5 * s;
        g.moveTo(cx + 4.2 * s, cy);
        g.arc(cx, cy, 4.2 * s, 0, Math.PI * 2);
      }
      inked(g, hair, lw * 0.8);
    }
  }
}

function personBody(g: CanvasRenderingContext2D, p: Spot): void {
  const s = p.s;
  const x = p.x;
  const y = headY(p);
  const shirt = pick(SHIRTS, hash(p.i * 3.1));
  const skin = pick(SKINS, hash(p.i * 5.3));
  const hair = pick(HAIRS, hash(p.i * 7.7));
  const wide = 0.8 + hash(p.i * 2.3) * 0.5;
  const heavy = wide > 1.15 ? 2.5 * s : 0;
  const lw = 2.1 * s;
  const style = Math.floor(hash(p.i * 1.7) * 13);
  // a luz vem do ringue (centro): sombra do lado de fora; todos olham para o ringue
  const sd = x < BW / 2 ? -1 : 1;
  const look = -sd * 1.5 * s * (0.4 + hash(p.i * 8.3) * 0.6);
  hairBack(g, style, x, y, s, hair, sd);
  // tronco
  const sw = 19 * s * wide;
  const torso = () => {
    g.beginPath();
    g.moveTo(x - sw - heavy, y + 64 * s);
    g.quadraticCurveTo(x - sw - 1 * s, y + 23 * s, x - 8 * s, y + 18.5 * s);
    g.lineTo(x + 8 * s, y + 18.5 * s);
    g.quadraticCurveTo(x + sw + 1 * s, y + 23 * s, x + sw + heavy, y + 64 * s);
    g.closePath();
  };
  torso();
  g.save();
  g.fillStyle = shirt;
  g.fill();
  g.clip();
  let pc = pick(PRINTS, hash(p.i * 7.9));
  if (pc === shirt) pc = '#16121f';
  const pt = Math.floor(hash(p.i * 6.7) * 7);
  g.fillStyle = pc;
  if (pt === 1) {
    g.fillRect(x - 30 * s, y + 31 * s, 60 * s, 4 * s);
    g.fillRect(x - 30 * s, y + 41 * s, 60 * s, 4 * s);
  } else if (pt === 2) {
    starPath(g, x, y + 36 * s, 6.5 * s);
    g.fill();
  } else if (pt === 3) {
    g.font = `${(13 * s).toFixed(1)}px "Luckiest Guy", Impact, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(1 + (p.i % 99)), x, y + 38 * s);
  } else if (pt === 4) {
    g.fillStyle = hash(p.i * 9.9) > 0.5 ? '#ff3b4e' : '#2f7bff';
    g.fillRect(x, y + 15 * s, 40 * s, 52 * s);
  } else if (pt === 5) {
    g.fillRect(x - 6 * s, y + 18 * s, 12 * s, 3 * s);
    g.fillRect(x - 40 * s, y + 18 * s, 80 * s, 2.4 * s);
  } else if (pt === 6) {
    // capuz e cordões
    g.fillStyle = darken(shirt, 0.72);
    g.beginPath();
    g.ellipse(x, y + 20 * s, 13 * s, 5 * s, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = pc;
    g.lineWidth = 1.4 * s;
    g.beginPath();
    g.moveTo(x - 3 * s, y + 22 * s);
    g.lineTo(x - 3 * s, y + 32 * s);
    g.moveTo(x + 3 * s, y + 22 * s);
    g.lineTo(x + 3 * s, y + 32 * s);
    g.stroke();
  }
  // sombreamento cel: lado de fora e base
  g.fillStyle = 'rgba(16,4,40,0.28)';
  g.fillRect(sd > 0 ? x + 5 * s : x - sw - heavy - 5 * s, y + 16 * s, sw + heavy, 50 * s);
  g.fillStyle = 'rgba(16,4,40,0.22)';
  g.fillRect(x - 40 * s, y + 48 * s, 80 * s, 20 * s);
  g.fillStyle = 'rgba(255,255,255,0.2)';
  g.fillRect(x - sw * 0.6, y + 19.5 * s, sw * 1.2, 2.2 * s);
  g.restore();
  torso();
  g.lineWidth = lw;
  g.strokeStyle = OUT;
  g.lineJoin = 'round';
  g.stroke();
  // pescoço
  g.fillStyle = darken(skin, 0.78);
  g.fillRect(x - 3.8 * s, y + 12 * s, 7.6 * s, 8 * s);
  // orelhas
  g.beginPath();
  g.ellipse(x - 10.4 * s, y + 5 * s, 2.4 * s, 3.2 * s, 0, 0, Math.PI * 2);
  g.ellipse(x + 10.4 * s, y + 5 * s, 2.4 * s, 3.2 * s, 0, 0, Math.PI * 2);
  inked(g, skin, lw * 0.8);
  // cabeça com sombra em crescente
  g.fillStyle = darken(skin, 0.76);
  g.beginPath();
  g.ellipse(x, y + 4 * s, 10.5 * s, 12 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = skin;
  g.beginPath();
  g.ellipse(x - sd * 1.8 * s, y + 3 * s, 8.7 * s, 11 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(x, y + 4 * s, 10.5 * s, 12 * s, 0, 0, Math.PI * 2);
  g.lineWidth = lw;
  g.strokeStyle = OUT;
  g.stroke();
  // barba
  if (hash(p.i * 12.7) > 0.84) {
    g.fillStyle = hair;
    g.beginPath();
    g.ellipse(x, y + 8.5 * s, 9.6 * s, 7.4 * s, 0, 0.02 * Math.PI, 0.98 * Math.PI);
    g.fill();
  }
  // cara: olhos, sobrancelhas e boca bem legíveis à distância
  const ex = x + look;
  g.fillStyle = OUT;
  g.beginPath();
  g.ellipse(ex - 3.6 * s, y + 4.6 * s, 1.35 * s, 1.75 * s, 0, 0, Math.PI * 2);
  g.ellipse(ex + 3.6 * s, y + 4.6 * s, 1.35 * s, 1.75 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = OUT;
  g.lineWidth = 1.3 * s;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(ex - 6 * s, y + 0.8 * s);
  g.lineTo(ex - 1.8 * s, y - 0.4 * s);
  g.moveTo(ex + 6 * s, y + 0.8 * s);
  g.lineTo(ex + 1.8 * s, y - 0.4 * s);
  g.stroke();
  const mx = x + look * 0.6;
  const expr = hash(p.i * 9.1);
  if (expr < 0.45) {
    // a gritar
    g.fillStyle = '#4a0f1c';
    g.beginPath();
    g.ellipse(mx, y + 10.4 * s, 2.9 * s, 2.7 * s, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#e8566a';
    g.beginPath();
    g.ellipse(mx, y + 11.8 * s, 1.7 * s, 1 * s, 0, 0, Math.PI * 2);
    g.fill();
  } else if (expr < 0.78) {
    g.beginPath();
    g.arc(mx, y + 7.6 * s, 3.6 * s, 0.18 * Math.PI, 0.82 * Math.PI);
    g.stroke();
  } else {
    g.beginPath();
    g.moveTo(mx - 3.8 * s, y + 8.4 * s);
    g.quadraticCurveTo(mx, y + 14.5 * s, mx + 3.8 * s, y + 8.4 * s);
    g.closePath();
    inked(g, '#ffffff', 1.1 * s);
  }
  // pinturas de guerra nas bochechas
  if (hash(p.i * 14.3) > 0.9) {
    g.fillStyle = hash(p.i * 2.9) > 0.5 ? '#ff3b4e' : '#2f7bff';
    g.fillRect(x - 8.5 * s, y + 7 * s, 3.6 * s, 1.6 * s);
    g.fillRect(x + 4.9 * s, y + 7 * s, 3.6 * s, 1.6 * s);
  }
  // óculos de sol
  if (hash(p.i * 17) > 0.87) {
    g.fillStyle = '#0d0b14';
    g.beginPath();
    g.roundRect(ex - 7.4 * s, y + 2.4 * s, 6.4 * s, 4.4 * s, 1.6 * s);
    g.roundRect(ex + 1 * s, y + 2.4 * s, 6.4 * s, 4.4 * s, 1.6 * s);
    g.fill();
    g.fillRect(ex - 1.2 * s, y + 3 * s, 2.4 * s, 1.1 * s);
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.fillRect(ex - 6.4 * s, y + 3.2 * s, 2 * s, 1 * s);
  }
  hairFront(g, p, style, x, y, s, hair, look);
}

/** Adereços estáticos: cartazes, dedos de espuma, bandeiras, cachecóis, pipocas. */
function personAccessory(g: CanvasRenderingContext2D, p: Spot): void {
  const s = p.s;
  const x = p.x;
  const y = headY(p);
  const k = hash(p.i * 19);
  const team = hash(p.i * 3) > 0.5 ? '#ff3b4e' : '#2f7bff';
  const lw = 2 * s;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  if (k < 0.04 + p.r * 0.006) {
    g.strokeStyle = '#6b4a2a';
    g.lineWidth = 3 * s;
    g.beginPath();
    g.moveTo(x, y - 20 * s);
    g.lineTo(x, y + 26 * s);
    g.stroke();
    g.beginPath();
    g.roundRect(x - 28 * s, y - 50 * s, 56 * s, 30 * s, 3 * s);
    inked(g, pick(SIGN_BG, hash(p.i * 5.1)), lw);
    g.fillStyle = pick(SIGN_INK, hash(p.i * 6.1));
    g.font = `${(15 * s).toFixed(1)}px "Luckiest Guy", Impact, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(WORDS[p.i % WORDS.length], x, y - 34 * s, 50 * s);
  } else if (k < 0.1) {
    // dedo de espuma
    g.beginPath();
    g.roundRect(x + 7 * s, y - 14 * s, 20 * s, 23 * s, 6 * s);
    g.roundRect(x + 12 * s, y - 40 * s, 8.5 * s, 30 * s, 4 * s);
    inked(g, pick(['#ffd23d', '#ff3d6e', '#39d98a', '#3ad8ff'], hash(p.i * 2.1)), lw);
    g.fillStyle = OUT;
    g.font = `${(8 * s).toFixed(1)}px "Luckiest Guy", Impact, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('#1', x + 17 * s, y - 2 * s);
  } else if (k < 0.13) {
    // bandeira a ondular
    const px = x - 13 * s;
    const top = y - 42 * s;
    g.strokeStyle = '#cfcfcf';
    g.lineWidth = 2.2 * s;
    g.beginPath();
    g.moveTo(px, y + 22 * s);
    g.lineTo(px, top);
    g.stroke();
    g.beginPath();
    g.moveTo(px, top);
    g.quadraticCurveTo(px + 14 * s, top - 5 * s, px + 30 * s, top);
    g.lineTo(px + 30 * s, top + 18 * s);
    g.quadraticCurveTo(px + 14 * s, top + 13 * s, px, top + 18 * s);
    g.closePath();
    inked(g, team, lw);
    g.fillStyle = '#ffffff';
    starPath(g, px + 15 * s, top + 8 * s, 4.5 * s);
    g.fill();
  } else if (k < 0.17) {
    // cachecol da equipa
    g.beginPath();
    g.roundRect(x - 12 * s, y + 16 * s, 24 * s, 6 * s, 3 * s);
    g.rect(x + 3 * s, y + 18 * s, 6 * s, 22 * s);
    inked(g, team, lw * 0.8);
    g.fillStyle = '#ffffff';
    g.fillRect(x + 3.6 * s, y + 28 * s, 4.8 * s, 3 * s);
  } else if (k < 0.2) {
    // pipocas
    const bx = x + 7 * s;
    const by = y + 33 * s;
    g.fillStyle = '#fff3c4';
    g.beginPath();
    for (let j = 0; j < 4; j++) {
      g.moveTo(bx + (2 + j * 2.4) * s, by);
      g.arc(bx + (2 + j * 2.4) * s, by, 2.3 * s, 0, Math.PI * 2);
    }
    g.fill();
    g.beginPath();
    g.moveTo(bx, by);
    g.lineTo(bx + 11 * s, by);
    g.lineTo(bx + 9.5 * s, by + 13 * s);
    g.lineTo(bx + 1.5 * s, by + 13 * s);
    g.closePath();
    inked(g, '#ffffff', lw * 0.8);
    g.fillStyle = '#e63946';
    g.fillRect(bx + 2.8 * s, by + 1 * s, 1.8 * s, 11 * s);
    g.fillRect(bx + 6.6 * s, by + 1 * s, 1.8 * s, 11 * s);
  }
}

/** Braço cartoon: contorno, pele, manga da camisola e mão. */
function arm(g: CanvasRenderingContext2D, s: number, sx: number, sy: number, hx: number, hy: number, shirt: string, skin: string): void {
  const ex = (sx + hx) / 2 + (hx > sx ? 4 : -4) * s;
  const ey = (sy + hy) / 2 + 2 * s;
  g.beginPath();
  g.moveTo(sx, sy);
  g.lineTo(ex, ey);
  g.lineTo(hx, hy);
  g.strokeStyle = OUT;
  g.lineWidth = 8.8 * s;
  g.stroke();
  g.strokeStyle = skin;
  g.lineWidth = 6 * s;
  g.stroke();
  g.beginPath();
  g.moveTo(sx, sy);
  g.lineTo(sx + (ex - sx) * 0.85, sy + (ey - sy) * 0.85);
  g.strokeStyle = shirt;
  g.lineWidth = 6.6 * s;
  g.stroke();
  g.beginPath();
  g.arc(hx, hy, 4.4 * s, 0, Math.PI * 2);
  inked(g, skin, 1.8 * s);
}

/** Braços no ar (aparecem por grupos quando o público está ao rubro): punhos, palmas, luzes, telemóveis, cartazes. */
function personArms(g: CanvasRenderingContext2D, p: Spot): void {
  const s = p.s;
  const x = p.x;
  const y = headY(p);
  const shirt = pick(SHIRTS, hash(p.i * 3.1));
  const skin = pick(SKINS, hash(p.i * 5.3));
  const type = Math.floor(hash(p.i * 31) * 7);
  const sp = (4 + hash(p.i * 23) * 8) * s;
  const lx = x - 13 * s;
  const rx = x + 13 * s;
  const sy = y + 26 * s;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  if (type === 1) {
    // palmas por cima da cabeça
    arm(g, s, lx, sy, x - 3.5 * s, y - 30 * s, shirt, skin);
    arm(g, s, rx, sy, x + 3.5 * s, y - 31 * s, shirt, skin);
  } else if (type === 2) {
    arm(g, s, rx, sy, x + 17 * s, y - 32 * s, shirt, skin);
  } else if (type === 6) {
    // cartaz levantado bem alto
    arm(g, s, lx, sy, x - 15 * s, y - 26 * s, shirt, skin);
    arm(g, s, rx, sy, x + 15 * s, y - 26 * s, shirt, skin);
    g.beginPath();
    g.roundRect(x - 31 * s, y - 60 * s, 62 * s, 32 * s, 3 * s);
    inked(g, pick(SIGN_BG, hash(p.i * 4.1)), 2 * s);
    g.fillStyle = pick(SIGN_INK, hash(p.i * 8.1));
    g.font = `${(16 * s).toFixed(1)}px "Luckiest Guy", Impact, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(WORDS[(p.i * 7) % WORDS.length], x, y - 43 * s, 56 * s);
  } else {
    const hlx = x - 18 * s - sp;
    const hrx = x + 18 * s + sp;
    const hy = y - 25 * s;
    arm(g, s, lx, sy, hlx, hy, shirt, skin);
    arm(g, s, rx, sy, hrx, hy - 2 * s, shirt, skin);
    if (type === 3) {
      // pulseira luminosa (o brilho anima por frame)
      const c = pick(NEON, hash(p.i * 37));
      g.beginPath();
      g.moveTo(hrx, hy - 3 * s);
      g.lineTo(hrx + 3 * s, hy - 19 * s);
      g.strokeStyle = OUT;
      g.lineWidth = 5.4 * s;
      g.stroke();
      g.strokeStyle = c;
      g.lineWidth = 3.2 * s;
      g.stroke();
      g.strokeStyle = '#ffffff';
      g.lineWidth = 1.1 * s;
      g.stroke();
      sticks.push({ x: hrx + 1.5 * s, y: hy - 11 * s, s, g: p.g, c, p: hash(p.i * 41) * 6 });
    } else if (type === 4) {
      g.beginPath();
      g.roundRect(hrx - 9 * s, hy - 14 * s, 18 * s, 18 * s, 5 * s);
      g.roundRect(hrx - 4 * s, hy - 36 * s, 8 * s, 26 * s, 4 * s);
      inked(g, pick(['#ffd23d', '#ff3d6e', '#39d98a'], hash(p.i * 2.7)), 2 * s);
    } else if (type === 5) {
      g.beginPath();
      g.roundRect(hlx - 4 * s, hy - 15 * s, 9 * s, 14 * s, 2 * s);
      inked(g, '#1a1430', 1.6 * s);
      g.fillStyle = '#dff3ff';
      g.fillRect(hlx - 2.6 * s, hy - 13.4 * s, 6.2 * s, 10.6 * s);
    }
  }
}

/** Neblina cumulativa: tudo o que já está desenhado na camada fica um pouco mais "longe". */
function hazeFill(g: CanvasRenderingContext2D, a: number): void {
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = `rgba(30,16,58,${a})`;
  g.fillRect(0, 0, g.canvas.width, g.canvas.height);
  g.restore();
}

function makeLayer(y0: number, y1: number, cs: number, filter: string, draw: (g: CanvasRenderingContext2D) => void): Layer {
  const [c, g] = mk(BW * cs, (y1 - y0) * cs);
  g.scale(cs, cs);
  g.translate(0, -y0);
  draw(g);
  if (filter && 'filter' in g) {
    const [c2, g2] = mk(c.width, c.height);
    g2.filter = filter;
    g2.drawImage(c, 0, 0);
    return { c: c2, y0, h: y1 - y0 };
  }
  return { c, y0, h: y1 - y0 };
}

/** Desenha as filas [r0, r1] de um grupo, com neblina a crescer para trás. */
function drawRows(g: CanvasRenderingContext2D, spots: Spot[], group: number, r0: number, r1: number, haze: number, arms: boolean): void {
  for (let r = r0; r <= r1; r++) {
    for (const p of spots) {
      if (p.r !== r || p.g !== group) continue;
      if (arms) {
        if (hash(p.i * 29) < 0.44 + p.r * 0.03) personArms(g, p);
      } else {
        personBody(g, p);
        personAccessory(g, p);
      }
    }
    if (r < r1 || r1 < 7) hazeFill(g, r < 5 ? haze : haze * 0.45);
  }
}

// ── atmosfera: fachos de luz volumétricos, reflexo de lente, vinheta centrada no ringue ──

let shaftBase: HTMLCanvasElement | null = null;
const shaftCache = new Map<string, HTMLCanvasElement>();
/** Facho de luz (trapézio suave, estreito em cima), tingido e guardado em cache. */
function shaftSprite(color: string): HTMLCanvasElement {
  let c = shaftCache.get(color);
  if (c) return c;
  if (!shaftBase) {
    const [row, rg] = mk(64, 1);
    const hg = rg.createLinearGradient(0, 0, 64, 0);
    hg.addColorStop(0, 'rgba(255,255,255,0)');
    hg.addColorStop(0.5, 'rgba(255,255,255,1)');
    hg.addColorStop(1, 'rgba(255,255,255,0)');
    rg.fillStyle = hg;
    rg.fillRect(0, 0, 64, 1);
    const [b, bg] = mk(64, 256);
    for (let y = 0; y < 256; y++) {
      const w = 64 * (0.14 + 0.86 * (y / 255));
      bg.drawImage(row, 0, 0, 64, 1, 32 - w / 2, y, w, 1);
    }
    bg.globalCompositeOperation = 'destination-in';
    const vg = bg.createLinearGradient(0, 0, 0, 256);
    vg.addColorStop(0, 'rgba(0,0,0,0.85)');
    vg.addColorStop(0.06, 'rgba(0,0,0,1)');
    vg.addColorStop(0.6, 'rgba(0,0,0,0.38)');
    vg.addColorStop(1, 'rgba(0,0,0,0)');
    bg.fillStyle = vg;
    bg.fillRect(0, 0, 64, 256);
    shaftBase = b;
  }
  const [t, tg] = mk(64, 256);
  tg.drawImage(shaftBase, 0, 0);
  tg.globalCompositeOperation = 'source-in';
  tg.fillStyle = color;
  tg.fillRect(0, 0, 64, 256);
  shaftCache.set(color, t);
  return t;
}

let streak: HTMLCanvasElement | null = null;
/** Risco horizontal de reflexo de lente (anamórfico). */
function streakSprite(): HTMLCanvasElement {
  if (streak) return streak;
  const [c, g] = mk(256, 16);
  const hg = g.createLinearGradient(0, 0, 256, 0);
  hg.addColorStop(0, 'rgba(170,200,255,0)');
  hg.addColorStop(0.5, 'rgba(235,242,255,1)');
  hg.addColorStop(1, 'rgba(170,200,255,0)');
  g.fillStyle = hg;
  g.fillRect(0, 0, 256, 16);
  g.globalCompositeOperation = 'destination-in';
  const vg = g.createLinearGradient(0, 0, 0, 16);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(0.5, 'rgba(0,0,0,1)');
  vg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = vg;
  g.fillRect(0, 0, 256, 16);
  streak = c;
  return c;
}

const VIG = 'rgba(4,2,10,0.6)';
function makeVignette(): HTMLCanvasElement {
  const [c, g] = mk(256, 256);
  const rg = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  rg.addColorStop(0, 'rgba(4,2,10,0)');
  rg.addColorStop(0.42, 'rgba(4,2,10,0)');
  rg.addColorStop(0.78, 'rgba(4,2,10,0.36)');
  rg.addColorStop(1, VIG);
  g.fillStyle = rg;
  g.fillRect(0, 0, 256, 256);
  return c;
}

function shaft(ctx: CanvasRenderingContext2D, spr: HTMLCanvasElement, ox: number, oy: number, ang: number, len: number, wBottom: number, a: number): void {
  ctx.save();
  ctx.translate(ox, oy);
  ctx.rotate(ang);
  ctx.globalAlpha = a;
  ctx.drawImage(spr, -wBottom / 2, 0, wBottom, len);
  ctx.restore();
}

// ── estrutura estática da arena ──

function drawRafters(g: CanvasRenderingContext2D): void {
  g.strokeStyle = '#18122b';
  g.lineWidth = 12;
  g.beginPath();
  g.moveTo(0, 12);
  g.lineTo(BW, 12);
  g.moveTo(0, 44);
  g.lineTo(BW, 44);
  g.stroke();
  g.lineWidth = 4;
  g.beginPath();
  for (let x = 0; x < BW; x += 110) {
    g.moveTo(x, 12);
    g.lineTo(x + 55, 44);
    g.lineTo(x + 110, 12);
  }
  g.stroke();
  g.strokeStyle = 'rgba(150,120,230,0.16)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(0, 7);
  g.lineTo(BW, 7);
  g.moveTo(0, 39);
  g.lineTo(BW, 39);
  g.stroke();
}

function drawUpperTier(g: CanvasRenderingContext2D): void {
  const [c, u] = mk(BW, 110);
  u.translate(0, -120);
  for (let r = 0; r < 3; r++) {
    const s = 0.3 + r * 0.06;
    const y = 150 + r * 22;
    for (let x = hash(r * 5) * 20, i = 0; x < BW; x += 22 * s * 1.6 + hash(i + r * 77) * 8, i++) {
      u.fillStyle = pick(SHIRTS, hash(i * 3.3 + r));
      u.beginPath();
      u.ellipse(x, y + 22 * s, 16 * s, 12 * s, 0, Math.PI, 0);
      u.fill();
      u.fillStyle = pick(SKINS, hash(i * 1.9 + r));
      u.beginPath();
      u.arc(x, y + 4 * s, 9 * s, 0, Math.PI * 2);
      u.fill();
    }
    hazeFill(u, 0.3);
  }
  hazeFill(u, 0.35);
  u.globalCompositeOperation = 'source-over';
  u.fillStyle = '#e8f4ff';
  for (let i = 0; i < 60; i++) u.fillRect(hash(i * 13.1) * BW, 150 + hash(i * 3.7) * 60, 2, 3);
  g.drawImage(c, 0, 120);
  // fachada da bancada superior com fita de LED
  g.fillStyle = '#0b0714';
  g.fillRect(0, 214, BW, 16);
  g.fillStyle = 'rgba(255,79,216,0.55)';
  g.font = '11px "Luckiest Guy", Impact, sans-serif';
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  for (let x = 6; x < BW; x += 230) g.fillText('★ KINGS OF THE RING ★ FIGHT NIGHT', x, 223);
  g.fillStyle = 'rgba(255,255,255,0.08)';
  g.fillRect(0, 214, BW, 1.5);
}

function drawBanners(g: CanvasRenderingContext2D): void {
  const cols = ['#c4122c', '#1a4fc4', '#d9a21b', '#6b2fb3'];
  const xs = [150, 420, 650, 1950, 2180, 2450];
  xs.forEach((bx, k) => {
    const col = cols[k % cols.length];
    const top = 26;
    const h = 118 + (k % 2) * 16;
    g.fillStyle = '#4a4560';
    g.fillRect(bx - 40, top - 4, 80, 6);
    g.beginPath();
    g.moveTo(bx - 34, top);
    g.lineTo(bx + 34, top);
    g.lineTo(bx + 34, top + h);
    g.lineTo(bx, top + h - 18);
    g.lineTo(bx - 34, top + h);
    g.closePath();
    inked(g, col, 3);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(bx + 6, top + 2, 27, h - 20);
    g.strokeStyle = '#ffd23d';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(bx - 28, top + 8);
    g.lineTo(bx - 28, top + h - 14);
    g.moveTo(bx + 28, top + 8);
    g.lineTo(bx + 28, top + h - 14);
    g.stroke();
    crownPath(g, bx, top + 46, 34, 22);
    inked(g, '#ffd23d', 2.5);
    g.fillStyle = '#ffffff';
    g.font = '13px "Luckiest Guy", Impact, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('CHAMPS', bx, top + 66);
    g.fillText(String(2019 + k), bx, top + 82);
  });
  // escurece (estão longe e fora dos holofotes)
  g.fillStyle = 'rgba(10,5,24,0.35)';
  for (const bx of xs) g.fillRect(bx - 38, 18, 76, 140);
}

function drawTruss(g: CanvasRenderingContext2D): void {
  const metal = g.createLinearGradient(0, 56, 0, 86);
  metal.addColorStop(0, '#5b5474');
  metal.addColorStop(0.5, '#2b2440');
  metal.addColorStop(1, '#17122a');
  g.strokeStyle = metal;
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(0, 60);
  g.lineTo(BW, 60);
  g.moveTo(0, 84);
  g.lineTo(BW, 84);
  g.stroke();
  g.lineWidth = 2.5;
  g.beginPath();
  for (let x = 0; x < BW; x += 36) {
    g.moveTo(x, 60);
    g.lineTo(x + 18, 84);
    g.lineTo(x + 36, 60);
  }
  g.stroke();
  g.strokeStyle = 'rgba(210,200,255,0.25)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(0, 58);
  g.lineTo(BW, 58);
  g.moveTo(0, 82);
  g.lineTo(BW, 82);
  g.stroke();
  const tints = ['#fff4d6', '#ffd0f0', '#fff4d6', '#cfe6ff'];
  TRUSS_LIGHTS.forEach((x, k) => {
    g.beginPath();
    g.roundRect(x - 12, 84, 24, 20, 4);
    inked(g, '#2a2438', 2.5);
    g.fillStyle = '#141020';
    g.fillRect(x - 15, 86, 3, 12);
    g.fillRect(x + 12, 86, 3, 12);
    g.beginPath();
    g.ellipse(x, 104, 10, 4.5, 0, 0, Math.PI * 2);
    inked(g, tints[k % 4], 2);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.7;
    g.drawImage(glowSprite(tints[k % 4]), x - 34, 76, 68, 60);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  });
}

function drawJumbotron(g: CanvasRenderingContext2D): void {
  const jx = BW / 2;
  const jw = 540;
  const jh = 118;
  const jy = 100;
  g.strokeStyle = '#3d3656';
  g.lineWidth = 3;
  g.beginPath();
  for (const ox of [-220, -80, 80, 220]) {
    g.moveTo(jx + ox, 84);
    g.lineTo(jx + ox, jy - 8);
  }
  g.stroke();
  // ecrãs laterais (uma cor por equipa)
  for (const side of [-1, 1]) {
    const cx = jx + side * (jw / 2 + 92);
    g.beginPath();
    g.roundRect(cx - 66, jy + 10, 132, 92, 8);
    inked(g, '#1e1a2c', 3);
    const sg = g.createLinearGradient(0, jy + 16, 0, jy + 96);
    sg.addColorStop(0, side < 0 ? '#ff5468' : '#4a8cff');
    sg.addColorStop(1, side < 0 ? '#5c0816' : '#0c2466');
    g.fillStyle = sg;
    g.fillRect(cx - 58, jy + 18, 116, 76);
    g.fillStyle = '#ffffff';
    g.font = '20px "Luckiest Guy", Impact, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(side < 0 ? 'RED' : 'BLUE', cx, jy + 72);
    crownPath(g, cx, jy + 52, 34, 20);
    inked(g, '#ffd23d', 2);
  }
  // moldura metálica
  const fr = g.createLinearGradient(0, jy - 10, 0, jy + jh + 14);
  fr.addColorStop(0, '#5c5677');
  fr.addColorStop(0.15, '#2a2540');
  fr.addColorStop(1, '#0f0c18');
  g.beginPath();
  g.roundRect(jx - jw / 2 - 14, jy - 10, jw + 28, jh + 30, 12);
  inked(g, fr, 4);
  // ecrã
  const sg = g.createLinearGradient(jx - jw / 2, jy, jx + jw / 2, jy + jh);
  sg.addColorStop(0, '#2a0b4a');
  sg.addColorStop(0.5, '#a3123a');
  sg.addColorStop(1, '#ff8a00');
  g.fillStyle = sg;
  g.fillRect(jx - jw / 2, jy, jw, jh);
  g.save();
  g.beginPath();
  g.rect(jx - jw / 2, jy, jw, jh);
  g.clip();
  g.fillStyle = 'rgba(255,255,255,0.07)';
  for (let k = 0; k < 12; k++) {
    const a0 = (k / 12) * Math.PI * 2;
    g.beginPath();
    g.moveTo(jx, jy + 46);
    g.lineTo(jx + Math.cos(a0) * 600, jy + 46 + Math.sin(a0) * 600);
    g.lineTo(jx + Math.cos(a0 + 0.22) * 600, jy + 46 + Math.sin(a0 + 0.22) * 600);
    g.closePath();
    g.fill();
  }
  crownPath(g, jx, jy + 46, 64, 32);
  inked(g, '#ffd23d', 4);
  g.font = '44px "Luckiest Guy", Impact, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = 8;
  g.strokeStyle = OUT;
  g.strokeText('KINGS OF THE RING', jx, jy + 76);
  g.fillStyle = '#ffffff';
  g.fillText('KINGS OF THE RING', jx, jy + 76);
  g.font = '15px "Luckiest Guy", Impact, sans-serif';
  g.fillStyle = '#ffd23d';
  g.fillText('FIGHT NIGHT  •  LIVE', jx, jy + 104);
  g.fillStyle = 'rgba(0,0,0,0.16)';
  for (let yy = jy; yy < jy + jh; yy += 3) g.fillRect(jx - jw / 2, yy, jw, 1);
  g.fillStyle = 'rgba(255,255,255,0.07)';
  g.beginPath();
  g.moveTo(jx - jw / 2, jy);
  g.lineTo(jx - jw / 2 + 200, jy);
  g.lineTo(jx - jw / 2 + 80, jy + jh);
  g.lineTo(jx - jw / 2, jy + jh);
  g.closePath();
  g.fill();
  g.restore();
  // fita de LED por baixo
  for (let k = 0; k < 54; k++) {
    g.fillStyle = `hsl(${(k * 13) % 360} 90% 60%)`;
    g.fillRect(jx - jw / 2 - 8 + k * ((jw + 16) / 54), jy + jh + 8, (jw + 16) / 54 - 3, 5);
  }
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.3;
  g.drawImage(glowSprite('#ff5a8a'), jx - 420, jy - 90, 840, 320);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}

function drawStands(g: CanvasRenderingContext2D): void {
  for (let r = 0; r < 8; r++) {
    const yb = 232 + r * 60 + 36;
    g.fillStyle = `rgba(140,100,230,${0.03 + r * 0.006})`;
    g.fillRect(0, yb, BW, 16);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillRect(0, yb + 16, BW, 5);
  }
  // corredores com escadas e corrimão
  for (const a of AISLES) {
    g.fillStyle = '#120a20';
    g.fillRect(a - 22, 230, 44, 450);
    for (let y = 240; y < 680; y += 30) {
      g.fillStyle = 'rgba(255,255,255,0.05)';
      g.fillRect(a - 22, y, 44, 3);
      g.fillStyle = '#ffb347';
      g.fillRect(a - 18, y + 1, 3, 2);
      g.fillRect(a + 15, y + 1, 3, 2);
    }
    g.strokeStyle = '#8a86a6';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(a, 236);
    g.lineTo(a, 680);
    g.stroke();
  }
}

/** Palco e rampa de entrada (do lado esquerdo das bancadas). */
function drawStage(g: CanvasRenderingContext2D): void {
  const sx = STAGE_X;
  const top = 236;
  const bottom = 680;
  // paredes do túnel
  g.fillStyle = '#0c0717';
  g.fillRect(sx - 122, top + 120, 244, bottom - top - 120);
  // torres de treliça
  for (const side of [-1, 1]) {
    const tx = sx + side * 128;
    g.fillStyle = '#1d1830';
    g.fillRect(tx - 8, top - 16, 16, bottom - top + 16);
    g.strokeStyle = '#3c3558';
    g.lineWidth = 2;
    g.beginPath();
    for (let y = top - 16; y < bottom; y += 20) {
      g.moveTo(tx - 8, y);
      g.lineTo(tx + 8, y + 20);
      g.moveTo(tx + 8, y);
      g.lineTo(tx - 8, y + 20);
    }
    g.stroke();
    g.strokeStyle = OUT;
    g.strokeRect(tx - 8, top - 16, 16, bottom - top + 16);
  }
  g.fillStyle = '#1d1830';
  g.fillRect(sx - 136, top - 20, 272, 12);
  // ecrã LED do palco
  g.beginPath();
  g.roundRect(sx - 114, top, 228, 116, 6);
  inked(g, '#0d0a16', 3);
  const lg = g.createLinearGradient(0, top + 6, 0, top + 110);
  lg.addColorStop(0, '#3b0a6e');
  lg.addColorStop(1, '#e0145a');
  g.fillStyle = lg;
  g.fillRect(sx - 108, top + 6, 216, 104);
  crownPath(g, sx, top + 58, 72, 36);
  inked(g, '#ffd23d', 4);
  g.font = '30px "Luckiest Guy", Impact, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 6;
  g.strokeStyle = OUT;
  g.strokeText('KOTR', sx, top + 86);
  g.fillStyle = '#ffffff';
  g.fillText('KOTR', sx, top + 86);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  for (let y = top + 6; y < top + 110; y += 3) g.fillRect(sx - 108, y, 216, 1);
  // abertura do túnel com fumo iluminado
  const ay = top + 160;
  const tb = 600;
  g.beginPath();
  g.moveTo(sx - 64, tb);
  g.lineTo(sx - 64, ay + 30);
  g.quadraticCurveTo(sx - 64, ay, sx - 34, ay);
  g.lineTo(sx + 34, ay);
  g.quadraticCurveTo(sx + 64, ay, sx + 64, ay + 30);
  g.lineTo(sx + 64, tb);
  g.closePath();
  const tg = g.createRadialGradient(sx, tb - 20, 10, sx, tb - 40, 200);
  tg.addColorStop(0, '#e6d6ff');
  tg.addColorStop(0.35, '#8a5ad6');
  tg.addColorStop(1, '#1a0f30');
  g.fillStyle = tg;
  g.fill();
  g.strokeStyle = '#ff4fd8';
  g.lineWidth = 4;
  g.stroke();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.45;
  g.drawImage(glowSprite('#ff4fd8'), sx - 120, ay - 50, 240, 220);
  g.drawImage(glowSprite('#ffffff'), sx - 90, tb - 70, 180, 110);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  // rampa até à barreira
  g.beginPath();
  g.moveTo(sx - 64, tb);
  g.lineTo(sx + 64, tb);
  g.lineTo(sx + 112, bottom + 10);
  g.lineTo(sx - 112, bottom + 10);
  g.closePath();
  const rg = g.createLinearGradient(0, tb, 0, bottom);
  rg.addColorStop(0, '#2a2140');
  rg.addColorStop(1, '#141022');
  inked(g, rg, 3);
  g.beginPath();
  g.moveTo(sx - 20, tb);
  g.lineTo(sx + 20, tb);
  g.lineTo(sx + 38, bottom + 10);
  g.lineTo(sx - 38, bottom + 10);
  g.closePath();
  g.fillStyle = '#8e1622';
  g.fill();
  g.strokeStyle = '#3ad8ff';
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(sx - 64, tb);
  g.lineTo(sx - 112, bottom + 10);
  g.moveTo(sx + 64, tb);
  g.lineTo(sx + 112, bottom + 10);
  g.stroke();
  for (const side of [-1, 1]) {
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.6;
    g.drawImage(glowSprite('#3ad8ff'), sx + side * 88 - 30, bottom - 70, 60, 90);
    g.drawImage(glowSprite('#fff4d6'), sx + side * 128 - 26, top - 40, 52, 52);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }
}

function makeBackdrop(): HTMLCanvasElement {
  const [c, g] = mk(BW, BH);
  const bg = g.createLinearGradient(0, 0, 0, BH);
  bg.addColorStop(0, '#04020a');
  bg.addColorStop(0.3, '#120a24');
  bg.addColorStop(0.7, '#1d1034');
  bg.addColorStop(1, '#26153d');
  g.fillStyle = bg;
  g.fillRect(0, 0, BW, BH);
  // bloom quente atrás do ringue (as bancadas apanham a luz que transborda do ringue)
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.32;
  g.drawImage(glowSprite('#6a2fb0'), BW / 2 - 1150, 160, 2300, 900);
  g.globalAlpha = 0.16;
  g.drawImage(glowSprite('#ff7a3d'), BW / 2 - 650, 400, 1300, 520);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  drawRafters(g);
  drawUpperTier(g);
  drawBanners(g);
  drawTruss(g);
  drawJumbotron(g);
  drawStands(g);
  drawStage(g);
  return c;
}

/** Barreira das bancadas + mesa dos comentadores (à frente do público, desenhada por cima das camadas). */
function makeBarrier(): Layer {
  return makeLayer(630, BH, 0.6, '', (g) => {
    const by = 676;
    const labels = ['FIGHT!', 'KOTR ♛', 'LIVE'];
    const cols = ['#c4122c', '#1a3b9c', '#1b1428'];
    for (let x = -40, k = 0; x < BW; x += 150, k++) {
      if (Math.abs(x + 75 - STAGE_X) < 125) continue;
      g.beginPath();
      g.roundRect(x + 4, by + 10, 142, 70, 6);
      inked(g, cols[k % 3], 3);
      g.fillStyle = 'rgba(255,255,255,0.14)';
      g.fillRect(x + 10, by + 14, 130, 4);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(x + 6, by + 56, 138, 22);
      g.font = '24px "Luckiest Guy", Impact, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineJoin = 'round';
      g.lineWidth = 5;
      g.strokeStyle = OUT;
      g.strokeText(labels[k % 3], x + 75, by + 42);
      g.fillStyle = k % 3 === 2 ? '#ffd23d' : '#ffffff';
      g.fillText(labels[k % 3], x + 75, by + 42);
      // poste e grampo metálico
      g.fillStyle = '#9a9db0';
      g.fillRect(x - 3, by - 2, 6, 84);
      g.strokeStyle = OUT;
      g.lineWidth = 2;
      g.strokeRect(x - 3, by - 2, 6, 84);
    }
    // corrimão de cima (aberto na rampa)
    const rail = g.createLinearGradient(0, by - 4, 0, by + 8);
    rail.addColorStop(0, '#e6e8f0');
    rail.addColorStop(0.5, '#8d909c');
    rail.addColorStop(1, '#3a3c48');
    for (const [a, b] of [[0, STAGE_X - 118], [STAGE_X + 118, BW]]) {
      g.beginPath();
      g.rect(a, by - 4, b - a, 10);
      inked(g, rail, 2);
    }
    // mesa dos comentadores, junto ao ringue (lado direito)
    const ax = BW / 2 + 640;
    for (const ox of [-56, 56]) {
      const hx = ax + ox;
      g.beginPath();
      g.moveTo(hx - 30, 720);
      g.quadraticCurveTo(hx - 30, 680, hx - 10, 678);
      g.lineTo(hx + 10, 678);
      g.quadraticCurveTo(hx + 30, 680, hx + 30, 720);
      g.closePath();
      inked(g, '#1d1a2a', 3);
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.moveTo(hx - 5, 679);
      g.lineTo(hx, 692);
      g.lineTo(hx + 5, 679);
      g.fill();
      g.beginPath();
      g.arc(hx, 662, 13, 0, Math.PI * 2);
      inked(g, pick(SKINS, hash(ox)), 3);
      g.beginPath();
      g.arc(hx, 660, 15, Math.PI * 1.05, Math.PI * 1.95);
      g.strokeStyle = '#2a2a33';
      g.lineWidth = 3.5;
      g.stroke();
      g.fillStyle = '#2a2a33';
      g.fillRect(hx - 17, 657, 6, 10);
      g.fillRect(hx + 11, 657, 6, 10);
      g.beginPath();
      g.moveTo(hx + 14, 664);
      g.quadraticCurveTo(hx + 12, 672, hx + 4, 670);
      g.stroke();
      // monitor (visto de trás) com luz azul na cara
      g.beginPath();
      g.rect(hx - 20, 690, 40, 26);
      inked(g, '#141220', 2.5);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.35;
      g.drawImage(glowSprite('#6fb6ff'), hx - 30, 640, 60, 60);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }
    g.beginPath();
    g.rect(ax - 130, 712, 260, 10);
    inked(g, '#2d2840', 2.5);
    const tf = g.createLinearGradient(0, 722, 0, 760);
    tf.addColorStop(0, '#221a38');
    tf.addColorStop(1, '#0d0918');
    g.beginPath();
    g.rect(ax - 124, 722, 248, 38);
    inked(g, tf, 3);
    g.strokeStyle = '#e63946';
    g.lineWidth = 2;
    g.strokeRect(ax - 116, 727, 232, 28);
    g.font = '18px "Luckiest Guy", Impact, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#ffd23d';
    g.fillText('KOTR  •  TV', ax, 742);
  });
}

export function ensureArena(): void {
  if (backdrop) return;
  backdrop = makeBackdrop();
  const spots = crowdSpots();
  sticks = [];
  crowdBack = [];
  crowdFront = [];
  crowdArms = [];
  for (let gi = 0; gi < CROWD_GROUPS; gi++) {
    // filas de trás: mais pequenas, enevoadas e desfocadas
    crowdBack.push(makeLayer(186, 545, 0.55, 'blur(0.8px) saturate(0.8)', (g) => drawRows(g, spots, gi, 0, 4, 0.15, false)));
    // filas da frente (plano médio): mais nítidas e com mais resolução
    crowdFront.push(makeLayer(470, 700, 0.8, 'saturate(0.95)', (g) => drawRows(g, spots, gi, 5, 7, 0.15, false)));
    crowdArms.push(makeLayer(150, 700, 0.6, 'blur(0.4px) saturate(0.88)', (g) => drawRows(g, spots, gi, 0, 7, 0.13, true)));
  }
  barrier = makeBarrier();
  vignette = makeVignette();
  phones = spots.filter((p) => hash(p.i * 41) > 0.9).map((p) => ({ x: p.x + 9 * p.s, y: headY(p) + 30 * p.s, p: hash(p.i * 43) * 10 }));
}

function drawLayer(ctx: CanvasRenderingContext2D, L: Layer, x: number, y: number, s: number, dw: number, b: number): void {
  ctx.drawImage(L.c, x, y + L.y0 * s - b, dw, L.h * s);
}

const BEAM_COLS = ['#ff5a96', '#5aa8ff', '#ffdc78', '#a05aff'];
const armsA = [0, 0, 0];
const bounce = [0, 0, 0];

/** Desenha o fundo (público, ecrã gigante, holofotes) em espaço de ecrã com paralaxe. */
export function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  camX: number,
  zoom: number,
  horizonY: number,
  t: number,
  hype: number,
  low: boolean,
): void {
  ensureArena();
  const s = zoom * 0.95;
  const dw = BW * s;
  const dh = BH * s;
  const x = w / 2 - dw / 2 - camX * zoom * 0.45;
  const y = horizonY - dh + 40 * s;
  ctx.fillStyle = '#04020a';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(backdrop!, x, y, dw, dh);
  // cada grupo do público salta com o seu próprio ritmo; os braços sobem por grupos com o entusiasmo
  const freq = 3.5 + hype * 6;
  for (let gi = 0; gi < CROWD_GROUPS; gi++) {
    bounce[gi] = Math.max(0, Math.sin(t * freq + gi * 2.1)) * (1.5 + hype * 11) * s;
    const thr = 0.22 + gi * 0.13;
    armsA[gi] = Math.max(0, Math.min(1, (hype - thr + 0.12 * Math.sin(t * 0.8 + gi * 2.4)) * 5));
  }
  for (let gi = 0; gi < CROWD_GROUPS; gi++) drawLayer(ctx, crowdBack[gi], x, y, s, dw, bounce[gi]);
  for (let gi = 0; gi < CROWD_GROUPS; gi++) drawLayer(ctx, crowdFront[gi], x, y, s, dw, bounce[gi]);
  for (let gi = 0; gi < CROWD_GROUPS; gi++) {
    if (armsA[gi] < 0.02) continue;
    ctx.globalAlpha = armsA[gi];
    const pump = Math.abs(Math.sin(t * freq * 0.5 + gi)) * hype * 4 * s;
    drawLayer(ctx, crowdArms[gi], x, y, s, dw, bounce[gi] + pump);
  }
  ctx.globalAlpha = 1;
  drawLayer(ctx, barrier!, x, y, s, dw, 0);

  // queda de luz centrada no ringue: as bancadas longe do ringue ficam na penumbra
  const vcx = w / 2 - camX * zoom;
  const vcy = horizonY - 30 * zoom;
  const rx = 1350 * zoom;
  const ry = 720 * zoom;
  ctx.drawImage(vignette!, vcx - rx, vcy - ry, rx * 2, ry * 2);
  ctx.fillStyle = VIG;
  if (vcy - ry > 0) ctx.fillRect(0, 0, w, vcy - ry);
  if (vcx - rx > 0) ctx.fillRect(0, Math.max(0, vcy - ry), vcx - rx, ry * 2);
  if (vcx + rx < w) ctx.fillRect(vcx + rx, Math.max(0, vcy - ry), w - vcx - rx, ry * 2);

  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  // flashes de câmaras
  const nFlash = low ? 2 : 5;
  for (let i = 0; i < nFlash; i++) {
    const k = Math.floor(t * (1.5 + hype * 4) + i * 0.37);
    if (hash(k * 7 + i) > 0.25 + (1 - hype) * 0.4) continue;
    const fx = x + hash(k * 3 + i * 11) * dw;
    const fy = y + (250 + hash(k * 5 + i) * 400) * s;
    const a = 1 - ((t * (1.5 + hype * 4) + i * 0.37) % 1);
    ctx.globalAlpha = a * a;
    const r = 40 * s;
    ctx.drawImage(glowSprite('#ffffff'), fx - r, fy - r, r * 2, r * 2);
  }
  // ecrãs de telemóveis no público
  ctx.fillStyle = '#dff3ff';
  for (const ph of phones) {
    const a = 0.35 + 0.35 * Math.sin(t * 2 + ph.p);
    if (a < 0.1) continue;
    ctx.globalAlpha = a;
    ctx.fillRect(x + ph.x * s, y + ph.y * s, 4 * s, 6 * s);
  }
  if (!low) {
    // brilho das pulseiras luminosas (só dos grupos com os braços no ar)
    for (const st of sticks) {
      const a = armsA[st.g];
      if (a < 0.05) continue;
      ctx.globalAlpha = a * (0.55 + 0.35 * Math.sin(t * 5 + st.p));
      const r = 16 * st.s * s;
      ctx.drawImage(glowSprite(st.c), x + st.x * s - r, y + st.y * s - r - bounce[st.g], r * 2, r * 2);
    }
    // fachos de luz volumétricos da treliça até ao ringue
    const tx = vcx;
    const ty = horizonY + 70 * zoom;
    const warm = shaftSprite('#fff1d0');
    for (let i = 0; i < TRUSS_LIGHTS.length; i++) {
      const lx = x + TRUSS_LIGHTS[i] * s;
      if (i % 2 || lx < -w * 0.5 || lx > w * 1.5) continue;
      const ly = y + 104 * s;
      const dx = tx + (i % 4 ? 160 : -160) * zoom - lx;
      const dy = ty - ly;
      const len = Math.hypot(dx, dy);
      const fl = 0.9 + 0.1 * Math.sin(t * 7 + i * 1.3);
      shaft(ctx, warm, lx, ly, Math.atan2(-dx, dy), len * 1.05, 260 * zoom, (0.07 + hype * 0.05) * fl);
    }
    // holofotes móveis coloridos
    for (let i = 0; i < 4; i++) {
      const ang = Math.sin(t * 0.35 + i * 1.7) * 0.35;
      const bx = w * (0.12 + i * 0.25);
      shaft(ctx, shaftSprite(BEAM_COLS[i]), bx, -10, ang, h * 1.25, w * 0.26, 0.3 + hype * 0.2);
      ctx.globalAlpha = 0.5 + hype * 0.3;
      ctx.drawImage(glowSprite(BEAM_COLS[i]), bx - 50, -50, 100, 90);
    }
    // reflexos de lente nas luzes da treliça (quando estão no ecrã)
    const sp = streakSprite();
    const glow = glowSprite('#fff4d6');
    for (let i = 0; i < TRUSS_LIGHTS.length; i++) {
      const lx = x + TRUSS_LIGHTS[i] * s;
      const ly = y + 104 * s;
      if (ly < -40 || lx < -60 || lx > w + 60) continue;
      const fl = 0.75 + 0.25 * Math.sin(t * 3.1 + i * 2.7);
      ctx.globalAlpha = 0.55 * fl;
      const r = 46 * s;
      ctx.drawImage(glow, lx - r, ly - r, r * 2, r * 2);
      ctx.globalAlpha = 0.35 * fl;
      ctx.drawImage(sp, lx - 200 * s, ly - 6 * s, 400 * s, 12 * s);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = prev;
}


// ───────────────────────── Ringue (espaço do mundo) ─────────────────────────


function rope(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, cx: number, cy: number, color: string) {
  strokeRope(ctx, color, (dy) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1 + dy);
    ctx.quadraticCurveTo(cx, cy + dy, x2, y2 + dy);
  });
}

const ROPE_DARK: Record<string, string> = { '#e63946': '#8e1622', '#f1f1f1': '#9aa0ae', '#2f7bff': '#163f99' };

/** Corda com volume: contorno, cor, lado de baixo na sombra e reflexo do holofote por cima. */
function strokeRope(ctx: CanvasRenderingContext2D, color: string, trace: (dy: number) => void) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  trace(0);
  ctx.lineWidth = 7.5;
  ctx.strokeStyle = '#120a18';
  ctx.stroke();
  ctx.lineWidth = 5;
  ctx.strokeStyle = color;
  ctx.stroke();
  const a = ctx.globalAlpha;
  trace(1.4);
  ctx.lineWidth = 2;
  ctx.strokeStyle = ROPE_DARK[color] ?? '#000';
  ctx.globalAlpha = a * 0.75;
  ctx.stroke();
  trace(-1.3);
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = '#ffffff';
  ctx.globalAlpha = a * 0.65;
  ctx.stroke();
  ctx.globalAlpha = a;
}

/** Desenha uma corda simulada entre dois pontos (só os nós de i0 a i1), com curvas suaves. */
function simRope(
  ctx: CanvasRenderingContext2D, L: RopeLine, x1: number, y1: number, x2: number, y2: number, ox: number, sag: number, color: string, i0 = 0, i1 = NODES - 1,
) {
  const n = NODES - 1;
  const px = (i: number) => x1 + ((x2 - x1) * i) / n + L.d[i] * ox;
  const py = (i: number) => y1 + ((y2 - y1) * i) / n + L.h[i] + Math.sin((i / n) * Math.PI) * sag;
  strokeRope(ctx, color, (dy) => {
    ctx.beginPath();
    ctx.moveTo(px(i0), py(i0) + dy);
    for (let i = i0 + 1; i < i1; i++) {
      const mx = (px(i) + px(i + 1)) / 2;
      const my = (py(i) + py(i + 1)) / 2;
      ctx.quadraticCurveTo(px(i), py(i) + dy, mx, my + dy);
    }
    ctx.lineTo(px(i1), py(i1) + dy);
  });
}

/** Cordas laterais: a parte de trás (até à linha dos lutadores) ou a da frente (por cima deles). */
function sideRopes(ctx: CanvasRenderingContext2D, ropes: RopeState, front: boolean) {
  const split = Math.round(ROPE_U * (NODES - 1));
  for (let side = 0; side < 2; side++) {
    const sx = side ? 1 : -1;
    for (let i = 0; i < 3; i++) {
      const hb = ROPE_H[i] * 0.92;
      const hf = ROPE_H[i];
      simRope(
        ctx, ropes.side[side][i], sx * BACK_X, BACK_Y - hb, sx * FRONT_X, FRONT_Y - hf, sx, 2, ROPE_COLORS[i],
        front ? split : 0, front ? NODES - 1 : split,
      );
    }
  }
}

const ROPE_COLORS = ['#e63946', '#f1f1f1', '#2f7bff'];

const postGrads = new Map<string, CanvasGradient>();
function postGrad(ctx: CanvasRenderingContext2D, x: number, w: number): CanvasGradient {
  const k = `${x}|${w}`;
  let g = postGrads.get(k);
  if (!g) {
    g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    g.addColorStop(0, '#20202b');
    g.addColorStop(0.3, '#6c6f80');
    g.addColorStop(0.45, '#c9ccd6');
    g.addColorStop(0.6, '#5a5d6c');
    g.addColorStop(1, '#16161e');
    postGrads.set(k, g);
  }
  return g;
}

/** Poste metálico com esticadores e almofadas acolchoadas na cor da equipa. */
function post(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, w: number, team: number) {
  ctx.fillStyle = '#0d0a14';
  ctx.fillRect(x - w / 2 - 1.5, y - h - 1.5, w + 3, h + 1.5);
  ctx.fillStyle = postGrad(ctx, x, w);
  ctx.fillRect(x - w / 2, y - h, w, h);
  const c = TEAM_COLORS[team];
  const dark = team === 0 ? '#9c1424' : '#1640a0';
  for (const rh of ROPE_H) {
    // esticador metálico por trás da almofada
    ctx.fillStyle = '#8d909c';
    ctx.fillRect(x - w / 2 - 7, y - rh - 3, w + 14, 6);
    ctx.fillStyle = '#120a18';
    ctx.beginPath();
    ctx.roundRect(x - w / 2 - 5.5, y - rh - 10.5, w + 11, 21, 7);
    ctx.fill();
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.roundRect(x - w / 2 - 4, y - rh - 9, w + 8, 18, 6);
    ctx.fill();
    ctx.fillStyle = dark;
    ctx.fillRect(x - w / 2 - 3, y - rh + 3, w + 6, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.roundRect(x - w / 2 - 1, y - rh - 7, w + 2, 4, 2);
    ctx.fill();
  }
  ctx.fillStyle = '#120a18';
  ctx.fillRect(x - w / 2 - 3.5, y - h - 7.5, w + 7, 10);
  ctx.fillStyle = '#d4d7df';
  ctx.fillRect(x - w / 2 - 2, y - h - 6, w + 4, 7);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillRect(x - w / 2 - 1, y - h - 5, w + 2, 2);
}

let matCanvas: HTMLCanvasElement | null = null;
const MS = 2;

/** Tapete pré-desenhado: lona com textura, luz do holofote ao centro, cantos e bordos na sombra das cordas. */
function makeMat(): HTMLCanvasElement {
  const W = FRONT_X * 2;
  const H = FRONT_Y - BACK_Y;
  const c = document.createElement('canvas');
  c.width = Math.round(W * MS);
  c.height = Math.round(H * MS);
  const g = c.getContext('2d')!;
  g.scale(MS, MS);
  g.translate(FRONT_X, -BACK_Y);
  g.beginPath();
  g.moveTo(-BACK_X, BACK_Y);
  g.lineTo(BACK_X, BACK_Y);
  g.lineTo(FRONT_X, FRONT_Y);
  g.lineTo(-FRONT_X, FRONT_Y);
  g.closePath();
  g.clip();
  const base = g.createLinearGradient(0, BACK_Y, 0, FRONT_Y);
  base.addColorStop(0, '#99a1b6');
  base.addColorStop(0.55, '#d5dbe7');
  base.addColorStop(1, '#eef1f7');
  g.fillStyle = base;
  g.fillRect(-FRONT_X, BACK_Y, W, H);
  // trama da lona
  for (let i = 0; i < 9000; i++) {
    const x = (hash(i * 3 + 1) - 0.5) * W;
    const y = BACK_Y + hash(i * 7 + 2) * H;
    g.fillStyle = hash(i * 11) > 0.5 ? 'rgba(255,255,255,0.22)' : 'rgba(60,70,100,0.07)';
    g.fillRect(x, y, 2.2, 0.6);
  }
  // marcas de uso (pegadas e manchas suaves)
  for (let i = 0; i < 26; i++) {
    const x = (hash(i * 13 + 5) - 0.5) * W * 0.8;
    const y = BACK_Y + 10 + hash(i * 17 + 3) * (H - 20);
    g.fillStyle = 'rgba(70,75,100,0.05)';
    g.beginPath();
    g.ellipse(x, y, 18 + hash(i) * 30, 4 + hash(i * 2) * 5, 0, 0, Math.PI * 2);
    g.fill();
  }
  // costuras
  g.strokeStyle = 'rgba(70,80,110,0.13)';
  g.lineWidth = 1.6;
  g.beginPath();
  for (let i = 1; i < 4; i++) {
    const y = BACK_Y + ((FRONT_Y - BACK_Y) * i) / 4;
    const w = BACK_X + ((FRONT_X - BACK_X) * i) / 4;
    g.moveTo(-w, y);
    g.lineTo(w, y);
  }
  for (let i = -4; i <= 4; i++) {
    g.moveTo(i * (BACK_X / 5), BACK_Y);
    g.lineTo(i * (FRONT_X / 5), FRONT_Y);
  }
  g.stroke();
  // logótipo central
  g.save();
  g.scale(1, 0.24);
  g.globalAlpha = 0.5;
  g.lineWidth = 10;
  g.strokeStyle = '#c4122c';
  g.beginPath();
  g.arc(0, -40, 150, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = 'rgba(196,18,44,0.18)';
  g.fill();
  g.globalAlpha = 0.55;
  g.fillStyle = '#c4122c';
  g.beginPath();
  g.moveTo(-70, 10);
  g.lineTo(-80, -90);
  g.lineTo(-35, -40);
  g.lineTo(0, -110);
  g.lineTo(35, -40);
  g.lineTo(80, -90);
  g.lineTo(70, 10);
  g.closePath();
  g.fill();
  g.restore();
  g.globalAlpha = 1;
  // luz do holofote principal no centro do ringue
  g.save();
  g.scale(1, 0.26);
  const hot = g.createRadialGradient(0, -60, 0, 0, -60, 520);
  hot.addColorStop(0, 'rgba(255,250,235,0.55)');
  hot.addColorStop(0.5, 'rgba(255,248,230,0.18)');
  hot.addColorStop(1, 'rgba(255,248,230,0)');
  g.fillStyle = hot;
  g.fillRect(-FRONT_X, -1200, W, 2400);
  g.restore();
  // sombra das cordas e dos bordos (oclusão junto aos lados)
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const off = 12 + k * 9;
      g.strokeStyle = `rgba(30,25,50,${0.1 - k * 0.022})`;
      g.lineWidth = 6 + k * 3;
      g.beginPath();
      g.moveTo(sx * (BACK_X - off * 0.7), BACK_Y + 2);
      g.lineTo(sx * (FRONT_X - off), FRONT_Y - 4);
      g.stroke();
    }
    const eg = g.createLinearGradient(sx * FRONT_X, 0, sx * (FRONT_X - 90), 0);
    eg.addColorStop(0, 'rgba(20,15,40,0.22)');
    eg.addColorStop(1, 'rgba(20,15,40,0)');
    g.fillStyle = eg;
    g.fillRect(sx > 0 ? FRONT_X - 90 : -FRONT_X, BACK_Y, 90, H);
  }
  const back = g.createLinearGradient(0, BACK_Y, 0, BACK_Y + 34);
  back.addColorStop(0, 'rgba(20,15,40,0.3)');
  back.addColorStop(1, 'rgba(20,15,40,0)');
  g.fillStyle = back;
  g.fillRect(-FRONT_X, BACK_Y, W, 34);
  // bordo vermelho da frente
  g.fillStyle = 'rgba(196,18,44,0.9)';
  g.fillRect(-FRONT_X, FRONT_Y - 7, W, 7);
  g.fillStyle = 'rgba(255,255,255,0.25)';
  g.fillRect(-FRONT_X, FRONT_Y - 7, W, 1.5);
  return c;
}

export function drawRingBack(ctx: CanvasRenderingContext2D, ropes: RopeState): void {
  matCanvas ??= makeMat();
  ctx.drawImage(matCanvas, -FRONT_X, BACK_Y, FRONT_X * 2, FRONT_Y - BACK_Y);

  // postes de trás
  post(ctx, -BACK_X, BACK_Y, POST_H - 10, 14, 0);
  post(ctx, BACK_X, BACK_Y, POST_H - 10, 14, 1);
  // cordas de trás
  for (let i = 0; i < 3; i++) {
    const h = ROPE_H[i] * 0.92;
    rope(ctx, -BACK_X, BACK_Y - h, BACK_X, BACK_Y - h, 0, BACK_Y - h + 3, ROPE_COLORS[i]);
  }
  // cordas laterais: a metade de trás fica atrás dos lutadores
  sideRopes(ctx, ropes, false);
}


// ── saia do ringue, degraus de aço (pré-renderizados) ──

let skirtC: HTMLCanvasElement | null = null;
const SK_W = FRONT_X * 2 + 12;
const SK_H = 112;
const SKS = 2;

/** Saia acolhoada do ringue: painéis almofadados, medalhões, letreiro e rodapé (sem a fita de LED, que é animada). */
function makeSkirt(): HTMLCanvasElement {
  const [c, g] = mk(SK_W * SKS, SK_H * SKS);
  g.scale(SKS, SKS);
  g.translate(SK_W / 2, 0);
  const L = -SK_W / 2;
  const base = g.createLinearGradient(0, 0, 0, SK_H);
  base.addColorStop(0, '#251a40');
  base.addColorStop(0.6, '#130d22');
  base.addColorStop(1, '#0a0712');
  g.fillStyle = base;
  g.fillRect(L, 0, SK_W, SK_H);
  // painéis almofadados
  const n = 10;
  const pw = SK_W / n;
  const pad = g.createLinearGradient(0, 24, 0, 96);
  pad.addColorStop(0, '#33275a');
  pad.addColorStop(0.45, '#1e1636');
  pad.addColorStop(1, '#100b1e');
  for (let k = 0; k < n; k++) {
    const px = L + k * pw;
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(px - 1.5, 22, 3, 76);
    g.fillStyle = pad;
    g.beginPath();
    g.roundRect(px + 3, 25, pw - 6, 70, 10);
    g.fill();
    g.fillStyle = 'rgba(190,160,255,0.13)';
    g.beginPath();
    g.roundRect(px + 9, 28, pw - 18, 6, 3);
    g.fill();
    // capitonê (botões) e costura em losango
    g.strokeStyle = 'rgba(0,0,0,0.28)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(px + 6, 60);
    g.lineTo(px + pw / 2, 30);
    g.lineTo(px + pw - 6, 60);
    g.lineTo(px + pw / 2, 90);
    g.closePath();
    g.stroke();
    for (const [bx, by] of [[px + pw / 2, 30], [px + pw / 2, 90], [px + 6, 60], [px + pw - 6, 60], [px + pw / 2, 60]]) {
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.beginPath();
      g.arc(bx, by, 1.8, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(200,180,255,0.25)';
      g.fillRect(bx - 0.8, by - 1.8, 1.6, 0.8);
    }
  }
  // medalhões com a coroa (vermelho à esquerda, azul à direita)
  for (const side of [-1, 1]) {
    const mx = side * 372;
    const my = 60;
    const gold = g.createRadialGradient(mx - 8, my - 10, 2, mx, my, 32);
    gold.addColorStop(0, '#fff2b0');
    gold.addColorStop(0.6, '#f0b62e');
    gold.addColorStop(1, '#9a5e12');
    g.beginPath();
    g.arc(mx, my, 31, 0, Math.PI * 2);
    inked(g, gold, 4);
    g.beginPath();
    g.arc(mx, my, 24, 0, Math.PI * 2);
    inked(g, '#1a1030', 2.5);
    g.strokeStyle = TEAM_COLORS[side < 0 ? 0 : 1];
    g.lineWidth = 3;
    g.beginPath();
    g.arc(mx, my, 20, 0, Math.PI * 2);
    g.stroke();
    crownPath(g, mx, my + 9, 26, 18);
    inked(g, '#ffd23d', 2);
  }
  // letreiro central
  g.beginPath();
  g.roundRect(-252, 34, 504, 54, 14);
  g.fillStyle = 'rgba(6,3,14,0.6)';
  g.fill();
  g.strokeStyle = 'rgba(255,210,61,0.55)';
  g.lineWidth = 2;
  g.stroke();
  g.font = '44px "Luckiest Guy", Impact, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = 9;
  g.strokeStyle = OUT;
  g.strokeText('KINGS OF THE RING', 0, 63);
  const tg = g.createLinearGradient(0, 44, 0, 80);
  tg.addColorStop(0, '#fffbe6');
  tg.addColorStop(0.5, '#ffe07a');
  tg.addColorStop(1, '#f29b1d');
  g.fillStyle = tg;
  g.fillText('KINGS OF THE RING', 0, 63);
  for (const sx of [-272, 272]) {
    starPath(g, sx, 61, 11);
    inked(g, '#ffd23d', 2.5);
  }
  // bordo superior do apron (vermelho almofadado) e canal da fita de LED
  const top = g.createLinearGradient(0, 0, 0, 8);
  top.addColorStop(0, '#ff5a6c');
  top.addColorStop(1, '#9c0f22');
  g.fillStyle = top;
  g.fillRect(L, 0, SK_W, 8);
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.fillRect(L, 0, SK_W, 1.2);
  g.fillStyle = '#07050c';
  g.fillRect(L, 8, SK_W, 14);
  g.fillStyle = 'rgba(0,0,0,0.5)';
  g.fillRect(L, 22, SK_W, 3);
  // rodapé
  g.fillStyle = '#0b0812';
  g.fillRect(L, 96, SK_W, 8);
  const bot = g.createLinearGradient(0, 104, 0, 110);
  bot.addColorStop(0, '#e01a36');
  bot.addColorStop(1, '#7a0c1a');
  g.fillStyle = bot;
  g.fillRect(L, 104, SK_W, 6);
  g.fillStyle = '#000';
  g.fillRect(L, 110, SK_W, 2);
  // volume: as pontas da saia ficam na sombra
  const edge = g.createLinearGradient(L, 0, -L, 0);
  edge.addColorStop(0, 'rgba(0,0,0,0.5)');
  edge.addColorStop(0.1, 'rgba(0,0,0,0)');
  edge.addColorStop(0.9, 'rgba(0,0,0,0)');
  edge.addColorStop(1, 'rgba(0,0,0,0.5)');
  g.fillStyle = edge;
  g.fillRect(L, 0, SK_W, SK_H);
  // luz quente do holofote a cair no centro da saia
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.14;
  g.drawImage(glowSprite('#ffe6c0'), -360, -60, 720, 160);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  return c;
}

let stepsC: HTMLCanvasElement | null = null;
const ST_W = 118;
const ST_H = 104;
/** Degraus de aço do canto (lado direito; o esquerdo é o espelho). Mais altos junto ao ringue. */
function makeSteps(): HTMLCanvasElement {
  const [c, g] = mk(ST_W * 2, ST_H * 2);
  g.scale(2, 2);
  const blocks = [
    { w: 114, y: 70 },
    { w: 78, y: 36 },
    { w: 42, y: 2 },
  ];
  for (const b of blocks) {
    const steel = g.createLinearGradient(0, b.y, 0, b.y + 34);
    steel.addColorStop(0, '#80849a');
    steel.addColorStop(0.5, '#4a4d5e');
    steel.addColorStop(1, '#25262f');
    g.beginPath();
    g.rect(2, b.y, b.w, ST_H - b.y - 1);
    inked(g, steel, 2.5);
    // chapa xadrez
    g.fillStyle = 'rgba(255,255,255,0.12)';
    for (let yy = b.y + 12; yy < b.y + 32; yy += 6) {
      for (let xx = 8 + ((yy / 6) % 2) * 4; xx < b.w - 4; xx += 8) g.fillRect(xx, yy, 3, 1.2);
    }
    // cobertura acolchoada do degrau
    g.beginPath();
    g.roundRect(1, b.y - 1, b.w + 2, 9, 3);
    inked(g, '#1a1426', 2);
    g.fillStyle = '#c4122c';
    g.fillRect(4, b.y + 4, b.w - 4, 2);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(4, b.y + 0.5, b.w - 4, 1.2);
    // rebites
    g.fillStyle = '#c9ccd6';
    for (const rx of [8, b.w - 6]) {
      g.beginPath();
      g.arc(rx, b.y + 14, 1.6, 0, Math.PI * 2);
      g.fill();
    }
  }
  // sombra junto ao ringue
  const sh = g.createLinearGradient(2, 0, 30, 0);
  sh.addColorStop(0, 'rgba(0,0,0,0.45)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = sh;
  g.fillRect(2, 0, 28, ST_H);
  return c;
}

export function drawRingFront(ctx: CanvasRenderingContext2D, ropes: RopeState, t = 0, hype = 0.3): void {
  skirtC ??= makeSkirt();
  stepsC ??= makeSteps();
  // degraus de aço nos cantos da frente
  ctx.drawImage(stepsC, FRONT_X + 10, FRONT_Y + 110 - ST_H, ST_W, ST_H);
  ctx.save();
  ctx.scale(-1, 1);
  ctx.drawImage(stepsC, FRONT_X + 10, FRONT_Y + 110 - ST_H, ST_W, ST_H);
  ctx.restore();
  // saia do ringue
  ctx.drawImage(skirtC, -SK_W / 2, FRONT_Y, SK_W, SK_H);
  // fita de LED animada
  const seg = 26;
  const n = Math.ceil(SK_W / seg);
  const prevOp = ctx.globalCompositeOperation;
  for (let i = 0; i < n; i++) {
    const x = -FRONT_X - 6 + i * seg;
    const h = (i * 14 + t * (60 + hype * 160)) % 360;
    ctx.fillStyle = `hsl(${h} 95% ${50 + hype * 15}%)`;
    ctx.fillRect(x + 2, FRONT_Y + 12, seg - 4, 6);
  }
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.25 + hype * 0.25;
  ctx.fillStyle = '#ff7ad9';
  ctx.fillRect(-FRONT_X - 6, FRONT_Y + 8, SK_W, 14);
  // reflexo que varre o letreiro de vez em quando
  const gx = ((t * 260) % 2600) - 1300;
  if (Math.abs(gx) < SK_W / 2) {
    ctx.globalAlpha = 0.12;
    ctx.drawImage(glowSprite('#ffffff'), gx - 70, FRONT_Y + 24, 140, 76);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = prevOp;

  // postes da frente
  post(ctx, -FRONT_X, FRONT_Y, POST_H, 18, 0);
  post(ctx, FRONT_X, FRONT_Y, POST_H, 18, 1);
  // cordas da frente (ligeiramente transparentes para não tapar a ação)
  // metade da frente das cordas laterais: passa por cima de quem se encosta a elas
  sideRopes(ctx, ropes, true);
  ctx.globalAlpha = 0.9;
  for (let i = 0; i < 3; i++) {
    const h = ROPE_H[i];
    simRope(ctx, ropes.front[i], -FRONT_X, FRONT_Y - h, FRONT_X, FRONT_Y - h, 0, 4, ROPE_COLORS[i]);
  }
  ctx.globalAlpha = 1;
}

// ───────────────────────── Público em primeiro plano ─────────────────────────

let fgA: HTMLCanvasElement | null = null;
let fgB: HTMLCanvasElement | null = null;
let fgRail: HTMLCanvasElement | null = null;
const FW = 3200;
const FH = 420;

function makeForeground(odd: boolean): HTMLCanvasElement {
  const [c, g] = mk(FW / 2, FH / 2);
  g.scale(0.5, 0.5);
  const body = odd ? '#140c24' : '#1c1131';
  const rim = odd ? 'rgba(120,190,255,0.5)' : 'rgba(255,140,220,0.5)';
  g.lineCap = 'round';
  for (let i = 0, x = 20; x < FW; i++, x += 70 + hash(i * 5) * 40) {
    if ((i % 2 === 1) !== odd) continue;
    const y = 120 + hash(i * 3 + 1) * 40;
    const r = 34 + hash(i * 7) * 12;
    const kind = Math.floor(hash(i * 9.7) * 7);
    const wide = 1.7 + hash(i * 4.1) * 0.5;
    g.fillStyle = body;
    // braço no ar (telemóvel, dedo de espuma ou cartaz)
    const up = hash(i * 11);
    if (up > 0.7) {
      const px = x + (hash(i) - 0.5) * 40;
      g.strokeStyle = body;
      g.lineWidth = 15;
      g.beginPath();
      g.moveTo(x + r * 0.8, y + r * 1.4);
      g.lineTo(px + 10, y - r * 1.3);
      g.stroke();
      if (up > 0.9) {
        // dedo de espuma em contraluz
        g.beginPath();
        g.roundRect(px - 8, y - r * 1.9, 38, 40, 10);
        g.roundRect(px + 3, y - r * 1.9 - 46, 16, 54, 8);
        g.fill();
        g.strokeStyle = rim;
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(px + 4, y - r * 1.9 - 38);
        g.lineTo(px + 4, y - r * 1.9 - 4);
        g.stroke();
      } else if (up > 0.8) {
        // cartaz visto por trás com luz a passar no bordo
        g.fillStyle = '#2a1d24';
        g.fillRect(px - 50, y - r * 2.6, 110, 62);
        g.strokeStyle = 'rgba(255,230,190,0.45)';
        g.lineWidth = 3;
        g.strokeRect(px - 50, y - r * 2.6, 110, 62);
        g.fillStyle = body;
      } else {
        g.fillStyle = '#1a1430';
        g.fillRect(px - 6, y - r * 2.2, 34, 56);
        g.fillStyle = 'rgba(190,220,255,0.85)';
        g.fillRect(px - 2, y - r * 2.2 + 4, 26, 46);
        g.fillStyle = body;
      }
    }
    // ombros
    g.beginPath();
    g.ellipse(x, y + r * 2.3, r * wide, r * 1.5, 0, Math.PI, 0);
    g.lineTo(x + r * wide, FH);
    g.lineTo(x - r * wide, FH);
    g.fill();
    // cabeça e cabelo/chapéu
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    if (kind === 0) g.arc(x, y - r * 0.2, r * 1.3, 0, Math.PI * 2); // afro
    else if (kind === 1) g.arc(x, y - r * 1.05, r * 0.42, 0, Math.PI * 2); // carrapito
    else if (kind === 2) g.ellipse(x + r * 0.7, y - r * 0.35, r * 0.85, r * 0.18, 0, 0, Math.PI * 2); // pala do boné
    else if (kind === 3) g.ellipse(x - r * 0.9, y + r * 0.4, r * 0.3, r * 0.65, 0.3, 0, Math.PI * 2); // rabo de cavalo
    else if (kind === 4) g.ellipse(x, y - r * 0.55, r * 1.55, r * 0.22, 0, 0, Math.PI * 2); // chapéu
    g.fill();
    // luz de recorte (vem do ringue, por cima)
    g.strokeStyle = rim;
    g.lineWidth = 4;
    g.beginPath();
    const rr = kind === 0 ? r * 1.3 : r;
    g.arc(x, y - (kind === 0 ? r * 0.2 : 0), rr - 2, Math.PI * 1.15, Math.PI * 1.8);
    g.stroke();
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(x, y + r * 2.3, r * wide - 2, r * 1.5 - 2, 0, Math.PI * 1.15, Math.PI * 1.45);
    g.stroke();
  }
  return c;
}

/** Barreira à volta do ringue (entre o ringue e a primeira fila). */
function makeRail(): HTMLCanvasElement {
  const [c, g] = mk(FW / 2, 30);
  g.scale(0.5, 0.5);
  const labels = ['FIGHT!', 'KOTR ♛', 'LIVE'];
  const cols = ['#8e1622', '#16307e', '#16101f'];
  for (let x = 0, k = 0; x < FW; x += 200, k++) {
    g.fillStyle = cols[k % 3];
    g.fillRect(x + 3, 10, 194, 50);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(x + 3, 12, 194, 3);
    g.font = '26px "Luckiest Guy", Impact, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.fillText(labels[k % 3], x + 100, 37);
    g.fillStyle = '#6d7080';
    g.fillRect(x - 3, 0, 6, 60);
  }
  const rail = g.createLinearGradient(0, 0, 0, 10);
  rail.addColorStop(0, '#c9ccd6');
  rail.addColorStop(1, '#3a3c48');
  g.fillStyle = rail;
  g.fillRect(0, 0, FW, 10);
  return c;
}

/** Fila de espectadores em silhueta à frente do ringue (dá profundidade). */
export function drawForeground(ctx: CanvasRenderingContext2D, camX: number, t: number, hype: number): void {
  if (!fgA) {
    fgA = makeForeground(false);
    fgB = makeForeground(true);
    fgRail = makeRail();
  }
  ctx.drawImage(fgRail!, -FW / 2 + camX * 0.12, FRONT_Y + 128, FW, 60);
  const par = camX * 0.25;
  const y0 = FRONT_Y + 30;
  const b1 = Math.abs(Math.sin(t * (5 + hype * 5))) * hype * 16;
  const b2 = Math.abs(Math.sin(t * (5 + hype * 5) + 1.3)) * hype * 16;
  ctx.drawImage(fgB!, -FW / 2 + par, y0 - b2 + 18, FW, FH);
  ctx.drawImage(fgA!, -FW / 2 + par + 35, y0 - b1, FW, FH);
}

let floorC: HTMLCanvasElement | null = null;
/** Chão à volta do ringue: tapete de proteção, cabos e a luz que transborda do ringue. */
function makeFloor(): HTMLCanvasElement {
  const [c, g] = mk(1600, 300);
  g.scale(0.5, 0.5);
  g.translate(1600, 0);
  const base = g.createLinearGradient(0, 0, 0, 600);
  base.addColorStop(0, '#171126');
  base.addColorStop(0.4, '#0b0814');
  base.addColorStop(1, '#07050c');
  g.fillStyle = base;
  g.fillRect(-1600, 0, 3200, 600);
  g.fillStyle = '#10162a';
  g.fillRect(-680, 0, 1360, 200);
  g.fillStyle = 'rgba(90,140,255,0.25)';
  g.fillRect(-680, 198, 1360, 3);
  g.strokeStyle = '#05040a';
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(-900, 30);
  g.bezierCurveTo(-700, 120, -800, 220, -600, 320);
  g.moveTo(820, 10);
  g.bezierCurveTo(700, 140, 900, 260, 760, 400);
  g.stroke();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.3;
  g.drawImage(glowSprite('#7b5cff'), -900, -150, 1800, 330);
  g.globalAlpha = 0.18;
  g.drawImage(glowSprite('#ff7ad9'), -600, -60, 1200, 140);
  return c;
}

/** Chão fora do ringue (à frente da saia). */
export function drawFloor(ctx: CanvasRenderingContext2D): void {
  floorC ??= makeFloor();
  ctx.fillStyle = '#07050c';
  ctx.fillRect(-3000, FRONT_Y + 110, 6000, 600);
  ctx.drawImage(floorC, -1600, FRONT_Y + 110, 3200, 600);
}
