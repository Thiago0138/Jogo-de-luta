import { shade } from '../data/appearance';

export const OUT = '#1a1220';
export const OW = 5;
export const TAU = Math.PI * 2;

/** Estado de pintura partilhado: flash branco ao ser atingido e silhueta da luz de recorte. */
export const PS = { F: false, SIL: null as string | null };
export const C = (c: string) => PS.SIL ?? (PS.F ? '#ffffff' : c);
export const OC = () => PS.SIL ?? OUT;

export function seg(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, color: string, outline = true) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  if (outline) {
    ctx.lineWidth = w + OW;
    ctx.strokeStyle = OC();
    ctx.stroke();
  }
  ctx.lineWidth = w;
  ctx.strokeStyle = C(color);
  ctx.stroke();
}

export function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, outline = true) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = C(fill);
  ctx.fill();
  if (outline) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = OC();
    ctx.stroke();
  }
}

// ───────────────────────── Membros musculados ─────────────────────────

/** Perfil de um segmento: raio na raiz, raio do bojo, raio na ponta e (opcional) posição do bojo (0..1). */
export type Prof = readonly [number, number, number, number?];
export const ARM_U: Prof = [10.5, 12.3, 7.6, 0.48];
export const ARM_L: Prof = [7.9, 9.6, 6.2, 0.26];
export const LEG_U: Prof = [13.5, 14.2, 9.2, 0.36];
export const LEG_L: Prof = [9.4, 11.2, 6.4, 0.28];
const PTS = 8;

export function profR(p: Prof, t: number): number {
  const base = p[0] + (p[2] - p[0]) * t;
  const pk = p[3];
  let b: number;
  if (pk == null) b = Math.sin(Math.PI * Math.min(1, t * 1.1));
  else {
    // bojo assimétrico: sobe depressa até ao pico e desce suave até à articulação seguinte
    const tt = t < pk ? (t / pk) * 0.5 : 0.5 + ((t - pk) / (1 - pk)) * 0.5;
    b = Math.sin(Math.PI * Math.min(1, tt * 1.06));
  }
  return base + (p[1] - (p[0] + (p[2] - p[0]) * 0.42)) * b;
}

/** Cápsula afunilada com bojo muscular, de (x1,y1) a (x2,y2). */
export function capsule(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, p: Prof, k = 1, ox = 0, oy = 0) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const a = Math.atan2(dy, dx);
  x1 += ox;
  y1 += oy;
  x2 += ox;
  y2 += oy;
  ctx.moveTo(x1 + nx * p[0] * k, y1 + ny * p[0] * k);
  for (let i = 1; i < PTS; i++) {
    const t = i / PTS;
    const r = profR(p, t) * k;
    ctx.lineTo(x1 + dx * t + nx * r, y1 + dy * t + ny * r);
  }
  ctx.arc(x2, y2, p[2] * k, a + Math.PI / 2, a - Math.PI / 2, true);
  for (let i = PTS - 1; i >= 1; i--) {
    const t = i / PTS;
    const r = profR(p, t) * k;
    ctx.lineTo(x1 + dx * t - nx * r, y1 + dy * t - ny * r);
  }
  ctx.arc(x1, y1, p[0] * k, a - Math.PI / 2, a - Math.PI * 1.5, true);
  ctx.closePath();
}

/** Lado em sombra de um segmento (para baixo / para trás). */
export function shadeSide(dx: number, dy: number): [number, number] {
  const len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len;
  let ny = dx / len;
  if (ny < -0.25 || (Math.abs(ny) <= 0.25 && nx > 0)) {
    nx = -nx;
    ny = -ny;
  }
  return [nx, ny];
}

/** Membro de dois segmentos com contorno, sombra cel e brilho. */
export function limb(
  ctx: CanvasRenderingContext2D,
  ax: number, ay: number, bx: number, by: number, cx: number, cy: number,
  pu: Prof, pl: Prof, color: string, dark: string,
  deco?: (M: (t: number, s: number) => [number, number], len: number, seg: number) => void,
  /** Por cima desta zona (o tronco), o contorno é uma prega suave em vez de uma linha preta. */
  soft?: { over: Path2D; color: string },
) {
  ctx.beginPath();
  capsule(ctx, ax, ay, bx, by, pu);
  capsule(ctx, bx, by, cx, cy, pl);
  ctx.lineWidth = OW;
  ctx.strokeStyle = OC();
  if (soft && !PS.F) {
    ctx.save();
    const outside = new Path2D();
    outside.rect(-1e4, -1e4, 2e4, 2e4);
    outside.addPath(soft.over);
    ctx.clip(outside, 'evenodd');
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.clip(soft.over);
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = soft.color;
    ctx.stroke();
    ctx.restore();
  } else ctx.stroke();
  ctx.fillStyle = C(color);
  ctx.fill();
  if (PS.F) return;
  if (deco) {
    ctx.save();
    ctx.clip();
    const segs: [number, number, number, number, Prof][] = [[ax, ay, bx, by, pu], [bx, by, cx, cy, pl]];
    segs.forEach(([x1, y1, x2, y2, pr], i) => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const w = pr[1];
      deco((t, s) => [x1 + dx * t + nx * s * w, y1 + dy * t + ny * s * w], len, i);
    });
    ctx.restore();
  }
  limbShade(ctx, ax, ay, bx, by, cx, cy, pu, pl, dark);
  ctx.globalAlpha = 1;
}

/** Ponto de um segmento: t ao longo, s em raios para o lado da sombra. */
function segPt(x1: number, y1: number, x2: number, y2: number, p: Prof, snx: number, sny: number, t: number, s: number): [number, number] {
  const r = profR(p, t);
  return [x1 + (x2 - x1) * t + snx * s * r, y1 + (y2 - y1) * t + sny * s * r];
}

/**
 * Cel shading dos dois segmentos de um membro, com luz principal por cima/à frente:
 * sombra própria + sombra de núcleo, luz refletida na orla, vincos musculares e brilho de suor.
 * Cada camada é um único caminho para os dois segmentos (poucas chamadas de desenho).
 */
function limbShade(
  ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, cx: number, cy: number, pu: Prof, pl: Prof, dark: string,
) {
  const [un, uv] = shadeSide(bx - ax, by - ay);
  const [ln, lv] = shadeSide(cx - bx, cy - by);
  const segs = [
    [ax, ay, bx, by, un, uv],
    [bx, by, cx, cy, ln, lv],
  ] as const;
  const profs = [pu, pl];
  // sombra própria (metade afastada da luz) e sombra de núcleo junto à orla
  ctx.fillStyle = dark;
  for (const [k, off, alpha] of [[0.56, 0.44, 0.55], [0.3, 0.66, 0.32]] as const) {
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    for (let i = 0; i < 2; i++) {
      const [x1, y1, x2, y2, sx, sy] = segs[i];
      const w = profs[i][1];
      capsule(ctx, x1, y1, x2, y2, profs[i], k, sx * w * off, sy * w * off);
    }
    ctx.fill();
  }
  // luz refletida (fria) na orla do lado da sombra
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = '#d8ecff';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 0; i < 2; i++) {
    const [x1, y1, x2, y2, sx, sy] = segs[i];
    for (let j = 0; j <= 4; j++) {
      const q = segPt(x1, y1, x2, y2, profs[i], sx, sy, 0.14 + j * 0.18, 0.8);
      if (j) ctx.lineTo(q[0], q[1]);
      else ctx.moveTo(q[0], q[1]);
    }
  }
  ctx.stroke();
  // vincos musculares (deltóide/bíceps, rótula, gémeos, cotovelo)
  ctx.strokeStyle = dark;
  ctx.lineWidth = 1.8;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  for (let i = 0; i < 2; i++) {
    const [x1, y1, x2, y2, sx, sy] = segs[i];
    const p = profs[i];
    const M = (t: number, s: number) => segPt(x1, y1, x2, y2, p, sx, sy, t, s);
    let q: [number, number];
    let c: [number, number];
    if (p === ARM_U) {
      q = M(0.2, -0.95);
      ctx.moveTo(q[0], q[1]);
      c = M(0.36, -0.75);
      q = M(0.34, -0.2);
      ctx.quadraticCurveTo(c[0], c[1], q[0], q[1]);
    } else if (p === LEG_L) {
      q = M(0.12, 0.15);
      ctx.moveTo(q[0], q[1]);
      c = M(0.3, 0.55);
      q = M(0.58, 0.5);
      ctx.quadraticCurveTo(c[0], c[1], q[0], q[1]);
    } else if (p === LEG_U) {
      q = M(0.9, -0.55);
      ctx.moveTo(q[0], q[1]);
      c = M(0.98, -0.1);
      q = M(0.86, 0.05);
      ctx.quadraticCurveTo(c[0], c[1], q[0], q[1]);
    } else if (p === ARM_L) {
      q = M(0.08, 0.5);
      ctx.moveTo(q[0], q[1]);
      q = M(0.16, 0.05);
      ctx.lineTo(q[0], q[1]);
    }
  }
  ctx.stroke();
  // brilho de suor no bojo (lado da luz): reflexo largo + ponto forte
  ctx.fillStyle = '#ffffff';
  for (const [big, alpha] of [[true, 0.3], [false, 0.75]] as const) {
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    for (let i = 0; i < 2; i++) {
      const [x1, y1, x2, y2, sx, sy] = segs[i];
      const p = profs[i];
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const h = segPt(x1, y1, x2, y2, p, sx, sy, p[3] ?? 0.45, -0.5);
      const ang = Math.atan2(dy, dx);
      const rx = big ? Math.max(2, len * 0.2) : Math.max(1, len * 0.05);
      const ry = big ? Math.max(1, p[1] * 0.14) : Math.max(0.6, p[1] * 0.07);
      const o = big ? 0 : 0.06;
      ctx.moveTo(h[0] + dx * o + Math.cos(ang) * rx, h[1] + dy * o + Math.sin(ang) * rx);
      ctx.ellipse(h[0] + dx * o, h[1] + dy * o, rx, ry, ang, 0, TAU);
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ───────────────────────── Glow sprites (cache) ─────────────────────────

const glowCache = new Map<string, HTMLCanvasElement>();
export function glowSprite(color: string): HTMLCanvasElement {
  let c = glowCache.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, color);
  gr.addColorStop(0.35, color + '88');
  gr.addColorStop(1, color + '00');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  glowCache.set(color, c);
  return c;
}

export function hash(i: number): number {
  const x = Math.sin(i * 127.1) * 43758.5453;
  return x - Math.floor(x);
}


// ───────────────────────── Geometria 3D simples (projeção ortográfica) ─────────────────────────

/** Ponto projetado: X, Y no ecrã e D = profundidade (positivo = mais perto de quem vê). */
export type V3 = [number, number, number];

/** Converte coordenadas locais (x frente, y baixo, z lateral) em ecrã + profundidade. */
export interface Proj {
  p(x: number, y: number, z: number): V3;
}

/** Câmara orbital: `yaw` roda o lutador (0 = perfil a olhar para a direita), `pitch` inclina a vista de cima. */
export class Cam {
  cy = 1; sy = 0; cp = 1; sp = 0;
  set(yaw: number, pitch: number): this {
    this.cy = Math.cos(yaw);
    this.sy = Math.sin(yaw);
    this.cp = Math.cos(pitch);
    this.sp = Math.sin(pitch);
    return this;
  }
  w(x: number, y: number, z: number): V3 {
    const X = x * this.cy - z * this.sy;
    const dp = x * this.sy + z * this.cy;
    return [X, y * this.cp + dp * this.sp, dp * this.cp - y * this.sp];
  }
}

/** Referencial 2D (lutas): rotação `a` no plano do ecrã; z só serve de profundidade. */
export function proj2D(ox: number, oy: number, a: number): Proj {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { p: (x, y, z) => [ox + x * c - y * s, oy + x * s + y * c, z] };
}

/** Referencial 3D: origem e eixos no mundo (frente, baixo, lateral), visto por uma câmara. */
export function proj3D(cam: Cam, o: V3, a = 0, sx = 0, sy = 0): Proj {
  // rotação `a` no plano x-y (inclinação do tronco / cabeça); (sx, sy) desloca o resultado no ecrã
  const c = Math.cos(a);
  const s = Math.sin(a);
  return {
    p: (x, y, z) => {
      const r = cam.w(o[0] + x * c - y * s, o[1] + x * s + y * c, o[2] + z);
      r[0] += sx;
      r[1] += sy;
      return r;
    },
  };
}

/** Direção de vista (para quem vê) expressa nas coordenadas locais do referencial. */
export function viewDir(P: Proj): V3 {
  const o = P.p(0, 0, 0);
  return [P.p(1, 0, 0)[2] - o[2], P.p(0, 1, 0)[2] - o[2], P.p(0, 0, 1)[2] - o[2]];
}

/** Lista de desenhos ordenada por profundidade. */
export class DL {
  items: { d: number; f: () => void }[] = [];
  add(d: number, f: () => void): void {
    this.items.push({ d, f });
  }
  /** Desenha (e remove) os itens com profundidade entre `lo` e `hi`, de trás para a frente. */
  flush(lo = -Infinity, hi = Infinity): void {
    const keep: { d: number; f: () => void }[] = [];
    const run: { d: number; f: () => void }[] = [];
    for (const it of this.items) (it.d >= lo && it.d < hi ? run : keep).push(it);
    run.sort((a, b) => a.d - b.d);
    for (const it of run) it.f();
    this.items = keep;
  }
}

/** Elipse que resulta de projetar um elipsoide (semi-eixos a, b, c já projetados como vetores 2D). */
function projEllipse(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): [number, number, number] {
  const m11 = ax * ax + bx * bx + cx * cx;
  const m22 = ay * ay + by * by + cy * cy;
  const m12 = ax * ay + bx * by + cx * cy;
  const tr = (m11 + m22) / 2;
  const q = Math.sqrt(Math.max(0, tr * tr - (m11 * m22 - m12 * m12)));
  const ang = 0.5 * Math.atan2(2 * m12, m11 - m22);
  return [Math.sqrt(tr + q), Math.sqrt(Math.max(0, tr - q)), ang];
}

export interface EllOpts {
  /** Rotação no plano x-y local. */
  rot?: number;
  shade?: string | null;
  line?: number;
  alpha?: number;
  hi?: boolean;
}

/** Elipsoide com contorno, sombra cel e brilho. Devolve a profundidade do centro. */
export function ell(
  ctx: CanvasRenderingContext2D, P: Proj, x: number, y: number, z: number,
  rx: number, ry: number, rz: number, fill: string, o: EllOpts = {},
): number {
  const c = P.p(x, y, z);
  const r = o.rot ?? 0;
  const cr = Math.cos(r);
  const sr = Math.sin(r);
  const a = P.p(x + cr * rx, y + sr * rx, z);
  const b = P.p(x - sr * ry, y + cr * ry, z);
  const d = P.p(x, y, z + rz);
  const [r1, r2, ang] = projEllipse(a[0] - c[0], a[1] - c[1], b[0] - c[0], b[1] - c[1], d[0] - c[0], d[1] - c[1]);
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  ctx.beginPath();
  ctx.ellipse(c[0], c[1], Math.max(0.5, r1), Math.max(0.5, r2), ang, 0, TAU);
  ctx.fillStyle = C(fill);
  if (o.line !== 0) {
    ctx.lineWidth = o.line ?? 3;
    ctx.strokeStyle = OC();
    ctx.stroke();
  }
  ctx.fill();
  if (!PS.F && o.shade !== null) {
    ctx.save();
    ctx.clip();
    ctx.globalAlpha = (o.alpha ?? 1) * 0.45;
    ctx.fillStyle = o.shade ?? shade(fill, -0.35);
    ctx.beginPath();
    ctx.ellipse(c[0] + r1 * 0.35, c[1] + r2 * 0.45 + r1 * 0.1, r1, r2, ang, 0, TAU);
    ctx.fill();
    if (o.hi !== false) {
      ctx.globalAlpha = (o.alpha ?? 1) * 0.35;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(c[0] - r1 * 0.35, c[1] - r2 * 0.4, Math.max(1, r1 * 0.28), Math.max(0.6, r2 * 0.16), ang - 0.4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  return c[2];
}

/** Tubo afunilado que passa pelos pontos dados (caudas, chifres, rabos de cavalo…). */
export function tube(
  ctx: CanvasRenderingContext2D, P: Proj, pts: number[][], rad: number[], fill: string, dark?: string, line = OW,
): number {
  const q = pts.map((v) => P.p(v[0], v[1], v[2]));
  let d = 0;
  for (const v of q) d += v[2];
  ctx.beginPath();
  for (let i = 0; i < q.length - 1; i++) {
    const r1 = rad[i];
    const r2 = rad[i + 1];
    capsule(ctx, q[i][0], q[i][1], q[i + 1][0], q[i + 1][1], [Math.max(0.3, r1), r1 + (r2 - r1) * 0.42, Math.max(0.3, r2)]);
  }
  if (line > 0) {
    ctx.lineWidth = line;
    ctx.strokeStyle = OC();
    ctx.stroke();
  }
  ctx.fillStyle = C(fill);
  ctx.fill();
  if (!PS.F && dark) {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = dark;
    ctx.beginPath();
    for (let i = 0; i < q.length - 1; i++) {
      const [nx, ny] = shadeSide(q[i + 1][0] - q[i][0], q[i + 1][1] - q[i][1]);
      const r1 = rad[i];
      const r2 = rad[i + 1];
      capsule(ctx, q[i][0], q[i][1], q[i + 1][0], q[i + 1][1], [Math.max(0.3, r1), r1 + (r2 - r1) * 0.42, Math.max(0.3, r2)], 0.5, nx * r1 * 0.45, ny * r1 * 0.45);
    }
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  return d / q.length;
}

/** Polígono plano no espaço. */
export function poly(ctx: CanvasRenderingContext2D, P: Proj, pts: number[][], fill: string, line = 3, alpha = 1): number {
  let d = 0;
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const v = P.p(pts[i][0], pts[i][1], pts[i][2]);
    d += v[2];
    if (i === 0) ctx.moveTo(v[0], v[1]);
    else ctx.lineTo(v[0], v[1]);
  }
  ctx.closePath();
  ctx.globalAlpha = alpha;
  if (line > 0) {
    ctx.lineWidth = line;
    ctx.strokeStyle = OC();
    ctx.stroke();
  }
  ctx.fillStyle = C(fill);
  ctx.fill();
  ctx.globalAlpha = 1;
  return d / pts.length;
}

/** Espinho cónico visto sempre de lado (base perpendicular à direção no ecrã). */
export function spike(
  ctx: CanvasRenderingContext2D, P: Proj, bx: number, by: number, bz: number, tx: number, ty: number, tz: number, r: number, fill: string, line = 2.5,
): number {
  const b = P.p(bx, by, bz);
  const t = P.p(tx, ty, tz);
  const dx = t[0] - b[0];
  const dy = t[1] - b[1];
  const l = Math.hypot(dx, dy) || 1;
  const nx = (-dy / l) * r;
  const ny = (dx / l) * r;
  ctx.beginPath();
  ctx.moveTo(b[0] + nx, b[1] + ny);
  ctx.quadraticCurveTo(b[0] + nx * 0.4 + dx * 0.6, b[1] + ny * 0.4 + dy * 0.6, t[0], t[1]);
  ctx.quadraticCurveTo(b[0] - nx * 0.4 + dx * 0.6, b[1] - ny * 0.4 + dy * 0.6, b[0] - nx, b[1] - ny);
  ctx.closePath();
  if (line > 0) {
    ctx.lineWidth = line;
    ctx.strokeStyle = OC();
    ctx.stroke();
  }
  ctx.fillStyle = C(fill);
  ctx.fill();
  return (b[2] + t[2]) / 2;
}

/**
 * Superfície em grelha (capas, asas, crinas): cada quadrado é pintado pela ordem de profundidade,
 * com cor diferente na frente e no verso. Devolve a profundidade média.
 */
export function sheet(
  ctx: CanvasRenderingContext2D, P: Proj, grid: number[][][], front: string, back: string, line = 4,
): number {
  const rows = grid.length;
  const cols = grid[0].length;
  const g: V3[][] = grid.map((r) => r.map((v) => P.p(v[0], v[1], v[2])));
  let dsum = 0;
  // contorno exterior primeiro (fica meio tapado pelos quadrados)
  if (line > 0) {
    ctx.beginPath();
    for (let j = 0; j < cols; j++) ctx.lineTo(g[0][j][0], g[0][j][1]);
    for (let i = 1; i < rows; i++) ctx.lineTo(g[i][cols - 1][0], g[i][cols - 1][1]);
    for (let j = cols - 2; j >= 0; j--) ctx.lineTo(g[rows - 1][j][0], g[rows - 1][j][1]);
    for (let i = rows - 2; i > 0; i--) ctx.lineTo(g[i][0][0], g[i][0][1]);
    ctx.closePath();
    ctx.lineWidth = line;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = OC();
    ctx.stroke();
  }
  const quads: { d: number; i: number; j: number; f: boolean }[] = [];
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = g[i][j], b = g[i][j + 1], c = g[i + 1][j + 1], d = g[i + 1][j];
      const area = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]) + (c[0] - b[0]) * (d[1] - b[1]) - (c[1] - b[1]) * (d[0] - b[0]);
      const dd = (a[2] + b[2] + c[2] + d[2]) / 4;
      dsum += dd;
      quads.push({ d: dd, i, j, f: area >= 0 });
    }
  }
  quads.sort((p, q) => p.d - q.d);
  ctx.lineWidth = 1;
  for (const q of quads) {
    const a = g[q.i][q.j], b = g[q.i][q.j + 1], c = g[q.i + 1][q.j + 1], d = g[q.i + 1][q.j];
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.lineTo(d[0], d[1]);
    ctx.closePath();
    const col = C(q.f ? front : back);
    ctx.fillStyle = col;
    ctx.strokeStyle = col;
    ctx.fill();
    ctx.stroke();
  }
  return dsum / Math.max(1, quads.length);
}

/**
 * Região sobre uma esfera de raio R (cabelo, máscaras, bandas): `lat` vai de -π/2 (topo) a π/2,
 * `lon` 0 = frente, +π/2 = lado z+. Pontos de trás são empurrados para a silhueta, por isso a região
 * fica sempre bem recortada pelo contorno da cabeça.
 */
export function sphereRegion(
  ctx: CanvasRenderingContext2D, P: Proj, R: number, cy: number,
  lon0: number, lon1: number, latTop: (lon: number) => number, latBot: (lon: number) => number,
  fill: string, o: { line?: number; alpha?: number; n?: number; m?: number; edges?: boolean } = {},
): void {
  const v = viewDir(P);
  const n = o.n ?? 28;
  const m = o.m ?? 6;
  const pt = (lon: number, lat: number): [number, number, boolean] => {
    const cl = Math.cos(lon);
    const sl = Math.sin(lon);
    const k = cl * v[0] + sl * v[2];
    const nd = Math.cos(lat) * k + Math.sin(lat) * v[1];
    let vis = true;
    if (nd < 0) {
      // desliza ao longo do meridiano até à fronteira do visível (a silhueta)
      vis = false;
      const d = Math.atan2(v[1], k);
      const a1 = d + Math.PI / 2;
      const a2 = d - Math.PI / 2;
      let best = Math.abs(lat - a1) < Math.abs(lat - a2) ? a1 : a2;
      for (const w of [best - TAU, best + TAU]) if (Math.abs(lat - w) < Math.abs(lat - best)) best = w;
      lat = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, best));
    }
    const x = Math.cos(lat) * cl;
    const y = Math.sin(lat);
    const z = Math.cos(lat) * sl;
    const q = P.p(x * R, cy + y * R, z * R);
    return [q[0], q[1], vis];
  };
  // colunas de meridianos
  const cols: [number, number, boolean][][] = [];
  for (let j = 0; j <= n; j++) {
    const lon = lon0 + ((lon1 - lon0) * j) / n;
    const a = latTop(lon);
    const b = latBot(lon);
    const col: [number, number, boolean][] = [];
    for (let k = 0; k <= m; k++) col.push(pt(lon, a + ((b - a) * k) / m));
    cols.push(col);
  }
  const line = o.line ?? 3;
  if (line > 0 && o.edges !== false) {
    ctx.lineWidth = line;
    ctx.strokeStyle = OC();
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let j = 0; j < n; j++) {
      const A = cols[j];
      const B = cols[j + 1];
      if (!A.some((p) => p[2]) && !B.some((p) => p[2])) continue;
      // bordas de cima e de baixo visíveis
      for (const k of [0, m]) {
        if (A[k][2] || B[k][2]) {
          ctx.moveTo(A[k][0], A[k][1]);
          ctx.lineTo(B[k][0], B[k][1]);
        }
      }
      // troços empurrados para a silhueta
      for (let k = 0; k < m; k++) {
        if (!A[k][2] && !A[k + 1][2]) {
          ctx.moveTo(A[k][0], A[k][1]);
          ctx.lineTo(A[k + 1][0], A[k + 1][1]);
        }
      }
    }
    // laterais da região (se não der a volta completa)
    if (Math.abs(lon1 - lon0) < TAU - 0.01) {
      for (const col of [cols[0], cols[n]]) {
        if (!col.some((p) => p[2])) continue;
        ctx.moveTo(col[0][0], col[0][1]);
        for (let k = 1; k <= m; k++) ctx.lineTo(col[k][0], col[k][1]);
      }
    }
    ctx.stroke();
  }
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  const col = C(fill);
  ctx.fillStyle = col;
  ctx.strokeStyle = col;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let j = 0; j < n; j++) {
    const A = cols[j];
    const B = cols[j + 1];
    if (!A.some((p) => p[2]) && !B.some((p) => p[2])) continue;
    ctx.moveTo(A[0][0], A[0][1]);
    for (let k = 1; k <= m; k++) ctx.lineTo(A[k][0], A[k][1]);
    for (let k = m; k >= 0; k--) ctx.lineTo(B[k][0], B[k][1]);
    ctx.closePath();
  }
  ctx.fill();
  if (o.alpha == null) ctx.stroke();
  ctx.globalAlpha = 1;
}

/** Ponto na superfície de uma esfera (lon, lat) + se está virado para quem vê (fator de escorço). */
export function spherePt(P: Proj, R: number, cy: number, lon: number, lat: number, out = 0): [number, number, number, number] {
  const v = viewDir(P);
  const x = Math.cos(lat) * Math.cos(lon);
  const y = Math.sin(lat);
  const z = Math.cos(lat) * Math.sin(lon);
  const q = P.p(x * (R + out), cy + y * (R + out), z * (R + out));
  return [q[0], q[1], q[2], x * v[0] + y * v[1] + z * v[2]];
}
