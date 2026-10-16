import { glowSprite } from '../render/fighter';
import {
  BACK_X, BACK_Y, FRONT_X, FRONT_Y, POST_H, ROPE_H, ROPE_U, SKIRT_H, SKIRT_W, inked, mk, type ArenaTheme,
} from './arenaKit';
import { KINGS } from './arenas/kings';
import { DESERT } from './arenas/desert';
import { NEON } from './arenas/neon';
import { TEMPLE } from './arenas/temple';

export { RING, BACK_Y, FRONT_Y, BACK_X, FRONT_X, ROPE_H, POST_H, APRON_X, TEAM_COLORS, ROPE_U, ROPE_LINE_X } from './arenaKit';
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
// ───────────────────────── Arenas ─────────────────────────

/** Arena por defeito (toda a gente a tem). */
export const DEFAULT_ARENA = 'ar_kings';
const THEMES: Record<string, ArenaTheme> = { ar_kings: KINGS, ar_desert: DESERT, ar_neon: NEON, ar_temple: TEMPLE };
let cur: ArenaTheme = KINGS;
let curId = DEFAULT_ARENA;
const mats = new Map<ArenaTheme, HTMLCanvasElement>();

export function isArena(id: string | null | undefined): boolean {
  return !!id && id in THEMES;
}

/** Escolhe a arena desenhada a seguir (cada cena chama-a antes de desenhar). */
export function setArena(id: string | null | undefined): void {
  const k = id && THEMES[id] ? id : DEFAULT_ARENA;
  curId = k;
  cur = THEMES[k];
}

export function currentArena(): string {
  return curId;
}

/** Tons da arena atual usados pela cena (neblina, poças de luz, escurecimento do fundo). */
export function arenaTone(): { haze: string; pool: string; tint: string; rim?: [string, string] } {
  return cur;
}

/** Pré-renderiza as camadas estáticas da arena (atual ou indicada). */
export function ensureArena(id?: string): void {
  if (id) setArena(id);
  cur.prepare();
}

/** Desenha o fundo (público, ecrã gigante, holofotes...) em espaço de ecrã com paralaxe. */
export function drawBackdrop(
  ctx: CanvasRenderingContext2D, w: number, h: number, camX: number, zoom: number, horizonY: number, t: number, hype: number, low: boolean,
): void {
  cur.prepare();
  cur.backdrop(ctx, w, h, camX, zoom, horizonY, t, hype, low);
}

/** Efeitos de ambiente por cima de tudo (espaço de ecrã). */
export function drawAtmosphere(ctx: CanvasRenderingContext2D, w: number, h: number, camX: number, zoom: number, t: number, hype: number, low: boolean): void {
  cur.overlay?.(ctx, w, h, camX, zoom, t, hype, low);
}

// ───────────────────────── Ringue (espaço do mundo) ─────────────────────────

function rope(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, cx: number, cy: number, i: number) {
  strokeRope(ctx, i, (dy) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1 + dy);
    ctx.quadraticCurveTo(cx, cy + dy, x2, y2 + dy);
  });
}

/** Corda com volume: contorno, cor, lado de baixo na sombra e reflexo do holofote por cima. */
function strokeRope(ctx: CanvasRenderingContext2D, i: number, trace: (dy: number) => void) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const a = ctx.globalAlpha;
  const gl = cur.ropeGlow;
  if (gl) {
    // cordas de néon: halo aditivo à volta
    trace(0);
    const op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 16;
    ctx.strokeStyle = gl[i];
    ctx.globalAlpha = a * 0.22;
    ctx.stroke();
    ctx.lineWidth = 9;
    ctx.globalAlpha = a * 0.3;
    ctx.stroke();
    ctx.globalCompositeOperation = op;
    ctx.globalAlpha = a;
  }
  trace(0);
  ctx.lineWidth = 7.5;
  ctx.strokeStyle = '#120a18';
  ctx.stroke();
  ctx.lineWidth = 5;
  ctx.strokeStyle = cur.ropes[i];
  ctx.stroke();
  trace(1.4);
  ctx.lineWidth = 2;
  ctx.strokeStyle = cur.ropeDark[i];
  ctx.globalAlpha = a * 0.75;
  ctx.stroke();
  trace(-1.3);
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = '#ffffff';
  ctx.globalAlpha = a * (gl ? 0.85 : 0.65);
  ctx.stroke();
  ctx.globalAlpha = a;
}

/** Desenha uma corda simulada entre dois pontos (só os nós de i0 a i1), com curvas suaves. */
function simRope(
  ctx: CanvasRenderingContext2D, L: RopeLine, x1: number, y1: number, x2: number, y2: number, ox: number, sag: number, ci: number, i0 = 0, i1 = NODES - 1,
) {
  const n = NODES - 1;
  const px = (i: number) => x1 + ((x2 - x1) * i) / n + L.d[i] * ox;
  const py = (i: number) => y1 + ((y2 - y1) * i) / n + L.h[i] + Math.sin((i / n) * Math.PI) * sag;
  strokeRope(ctx, ci, (dy) => {
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
      simRope(ctx, ropes.side[side][i], sx * BACK_X, BACK_Y - hb, sx * FRONT_X, FRONT_Y - hf, sx, 2, i, front ? split : 0, front ? NODES - 1 : split);
    }
  }
}

const postGrads = new Map<string, CanvasGradient>();
function postGrad(ctx: CanvasRenderingContext2D, x: number, w: number): CanvasGradient {
  const k = `${curId}|${x}|${w}`;
  let g = postGrads.get(k);
  if (!g) {
    g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    for (const [p, c] of cur.post.stops) g.addColorStop(p, c);
    postGrads.set(k, g);
  }
  return g;
}

/** Poste com esticadores e almofadas acolchoadas na cor da equipa. */
function post(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, w: number, team: number) {
  const P = cur.post;
  ctx.fillStyle = '#0d0a14';
  ctx.fillRect(x - w / 2 - 1.5, y - h - 1.5, w + 3, h + 1.5);
  ctx.fillStyle = postGrad(ctx, x, w);
  ctx.fillRect(x - w / 2, y - h, w, h);
  const c = P.pads[team];
  const dark = P.padDark[team];
  for (const rh of ROPE_H) {
    // esticador metálico por trás da almofada
    ctx.fillStyle = P.buckle;
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
  ctx.fillStyle = P.cap;
  ctx.fillRect(x - w / 2 - 2, y - h - 6, w + 4, 7);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillRect(x - w / 2 - 1, y - h - 5, w + 2, 2);
  if (P.glow) {
    const op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5;
    const gs = glowSprite(P.glow[team]);
    for (const rh of ROPE_H) ctx.drawImage(gs, x - 30, y - rh - 22, 60, 44);
    ctx.drawImage(gs, x - 22, y - h - 22, 44, 34);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = op;
  }
}

export function drawRingBack(ctx: CanvasRenderingContext2D, ropes: RopeState, t = 0, hype = 0.3, low = false): void {
  let m = mats.get(cur);
  if (!m) {
    m = cur.mat();
    mats.set(cur, m);
  }
  ctx.drawImage(m, -FRONT_X, BACK_Y, FRONT_X * 2, FRONT_Y - BACK_Y);
  cur.matFx?.(ctx, t, hype, low);

  // postes de trás
  post(ctx, -BACK_X, BACK_Y, POST_H - 10, 14, 0);
  post(ctx, BACK_X, BACK_Y, POST_H - 10, 14, 1);
  // cordas de trás
  for (let i = 0; i < 3; i++) {
    const h = ROPE_H[i] * 0.92;
    rope(ctx, -BACK_X, BACK_Y - h, BACK_X, BACK_Y - h, 0, BACK_Y - h + 3, i);
  }
  // cordas laterais: a metade de trás fica atrás dos lutadores
  sideRopes(ctx, ropes, false);
}

// ── degraus de aço (pré-renderizados) ──

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

export function drawRingFront(ctx: CanvasRenderingContext2D, ropes: RopeState, t = 0, hype = 0.3, low = false): void {
  if (cur.steps) {
    stepsC ??= makeSteps();
    // degraus de aço nos cantos da frente
    ctx.drawImage(stepsC, FRONT_X + 10, FRONT_Y + 110 - ST_H, ST_W, ST_H);
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(stepsC, FRONT_X + 10, FRONT_Y + 110 - ST_H, ST_W, ST_H);
    ctx.restore();
  }
  // saia do ringue
  ctx.drawImage(cur.skirt(), -SKIRT_W / 2, FRONT_Y, SKIRT_W, SKIRT_H);
  cur.skirtFx?.(ctx, t, hype, low);

  // postes da frente
  post(ctx, -FRONT_X, FRONT_Y, POST_H, 18, 0);
  post(ctx, FRONT_X, FRONT_Y, POST_H, 18, 1);
  // metade da frente das cordas laterais: passa por cima de quem se encosta a elas
  sideRopes(ctx, ropes, true);
  // cordas da frente (ligeiramente transparentes para não tapar a ação)
  ctx.globalAlpha = 0.9;
  for (let i = 0; i < 3; i++) {
    const h = ROPE_H[i];
    simRope(ctx, ropes.front[i], -FRONT_X, FRONT_Y - h, FRONT_X, FRONT_Y - h, 0, 4, i);
  }
  ctx.globalAlpha = 1;
}

/** Primeiro plano (público em silhueta, ruínas, varandas...) por cima do ringue. */
export function drawForeground(ctx: CanvasRenderingContext2D, camX: number, t: number, hype: number, low = false): void {
  cur.foreground(ctx, camX, t, hype, low);
}

/** Chão fora do ringue (à frente da saia). */
export function drawFloor(ctx: CanvasRenderingContext2D, t = 0): void {
  cur.floor(ctx, t);
}
