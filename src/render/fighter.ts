import { shade } from '../data/appearance';
import type { Vis } from '../data/items';
import type { Look } from './look';
import {
  HEAD_R, J_BE, J_BF, J_BH, J_BK, J_FE, J_FF, J_FH, J_FK, J_HEAD, J_HIP, J_NECK, J_SH, type Skel,
} from './pose';

export type Expr = 'normal' | 'hurt' | 'ko' | 'angry' | 'happy' | 'power';

export interface DrawOpts {
  t: number;
  expr: Expr;
  /** Flash branco ao ser atingido. */
  flash: boolean;
  /** Cor do brilho do super (ou null). */
  glow: string | null;
  /** Qualidade baixa: menos detalhes nas auras. */
  low?: boolean;
  /** Cor da luz de recorte nas costas/topo (iluminação de palco). */
  rim?: string | null;
}

const OUT = '#1a1220';
const OW = 5;
const TAU = Math.PI * 2;

let F = false; // flash ativo neste desenho (ou silhueta)
/** Cor de silhueta (luz de recorte); quando definida tudo é pintado desta cor. */
let SIL: string | null = null;
const C = (c: string) => SIL ?? (F ? '#ffffff' : c);
const OC = () => SIL ?? OUT;

function seg(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, color: string, outline = true) {
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

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, outline = true) {
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

function hairColors(hc: Vis, t: number): [string, string] {
  if (hc.anim === 'rainbow') {
    const h = (t * 120) % 360;
    return [`hsl(${h} 95% 55%)`, `hsl(${(h + 40) % 360} 100% 75%)`];
  }
  return [hc.c1 ?? '#3a2a1a', hc.c2 ?? '#5a4030'];
}

function outfitC1(o: Vis, t: number): string {
  if (o.anim === 'cosmic') return `hsl(${250 + Math.sin(t * 1.3) * 25} 70% 16%)`;
  return o.c1 ?? '#d22';
}


// ───────────────────────── Membros musculados ─────────────────────────

type Prof = readonly [number, number, number];
const ARM_U: Prof = [10.5, 11.8, 7.6];
const ARM_L: Prof = [7.8, 9.2, 6.4];
const LEG_U: Prof = [13.5, 13.8, 9.2];
const LEG_L: Prof = [9.4, 10.8, 6.6];
const PTS = 6;

function profR(p: Prof, t: number): number {
  const base = p[0] + (p[2] - p[0]) * t;
  return base + (p[1] - (p[0] + (p[2] - p[0]) * 0.42)) * Math.sin(Math.PI * Math.min(1, t * 1.1));
}

/** Cápsula afunilada com bojo muscular, de (x1,y1) a (x2,y2). */
function capsule(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, p: Prof, k = 1, ox = 0, oy = 0) {
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
function shadeSide(dx: number, dy: number): [number, number] {
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
function limb(
  ctx: CanvasRenderingContext2D,
  ax: number, ay: number, bx: number, by: number, cx: number, cy: number,
  pu: Prof, pl: Prof, color: string, dark: string,
) {
  ctx.beginPath();
  capsule(ctx, ax, ay, bx, by, pu);
  capsule(ctx, bx, by, cx, cy, pl);
  ctx.lineWidth = OW;
  ctx.strokeStyle = OC();
  ctx.stroke();
  ctx.fillStyle = C(color);
  ctx.fill();
  if (F) return;
  // sombra (interior, do lado afastado da luz)
  ctx.fillStyle = dark;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  let [snx, sny] = shadeSide(bx - ax, by - ay);
  capsule(ctx, ax, ay, bx, by, pu, 0.5, snx * pu[1] * 0.42, sny * pu[1] * 0.42);
  [snx, sny] = shadeSide(cx - bx, cy - by);
  capsule(ctx, bx, by, cx, cy, pl, 0.5, snx * pl[1] * 0.42, sny * pl[1] * 0.42);
  ctx.fill();
  // brilho
  ctx.globalAlpha = 0.32;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  [snx, sny] = shadeSide(bx - ax, by - ay);
  ctx.moveTo(ax + (bx - ax) * 0.2 - snx * pu[1] * 0.55, ay + (by - ay) * 0.2 - sny * pu[1] * 0.55);
  ctx.lineTo(ax + (bx - ax) * 0.6 - snx * pu[1] * 0.6, ay + (by - ay) * 0.6 - sny * pu[1] * 0.6);
  ctx.stroke();
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

// ───────────────────────── Aura ─────────────────────────

function hash(i: number): number {
  const x = Math.sin(i * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function drawAura(ctx: CanvasRenderingContext2D, a: Vis, t: number, low: boolean) {
  const c1 = a.c1 ?? '#fff';
  const c2 = a.c2 ?? '#fff';
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  const g = glowSprite(c1);
  const pulse = 0.55 + Math.sin(t * 3) * 0.12;
  ctx.globalAlpha = a.type === 'sombra' ? 0.5 : pulse * 0.55;
  ctx.drawImage(g, -95, -170, 190, 220);
  ctx.globalAlpha = 1;
  const n = low ? 6 : 14;
  switch (a.type) {
    case 'faiscas': {
      for (let i = 0; i < n; i++) {
        const ph = (t * 0.6 + hash(i)) % 1;
        const x = (hash(i + 9) - 0.5) * 110 + Math.sin(t * 3 + i) * 8;
        const y = 50 - ph * 210;
        const s = 2.5 * (1 - ph) + 1;
        ctx.globalAlpha = 1 - ph;
        ctx.fillStyle = i % 2 ? c1 : c2;
        ctx.fillRect(x - s, y - s, s * 2, s * 2);
      }
      break;
    }
    case 'petalas': {
      ctx.globalCompositeOperation = prev;
      for (let i = 0; i < n; i++) {
        const ph = (t * 0.25 + hash(i)) % 1;
        const x = (hash(i + 3) - 0.5) * 150 + Math.sin(t * 2 + i * 2) * 20;
        const y = -170 + ph * 230;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * 2 + i);
        ctx.globalAlpha = Math.sin(ph * Math.PI);
        ctx.fillStyle = i % 3 ? c1 : c2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 6, 3.2, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      break;
    }
    case 'chamas': {
      for (let i = 0; i < n; i++) {
        const ph = (t * 1.3 + hash(i)) % 1;
        const x = (hash(i + 5) - 0.5) * 100;
        const y = 40 - ph * 200;
        const r = 16 * (1 - ph) + 3;
        ctx.globalAlpha = (1 - ph) * 0.8;
        ctx.fillStyle = ph < 0.4 ? c2 : c1;
        ctx.beginPath();
        ctx.moveTo(x - r, y);
        ctx.quadraticCurveTo(x, y - r * 2.6, x + r, y);
        ctx.quadraticCurveTo(x, y + r, x - r, y);
        ctx.fill();
      }
      break;
    }
    case 'raio': {
      const k = Math.floor(t * 12);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = c2;
      for (let j = 0; j < 2; j++) {
        if (hash(k + j * 31) < 0.45) continue;
        let x = (hash(k * 3 + j) - 0.5) * 120;
        let y = -170 + hash(k * 7 + j) * 40;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let s = 0; s < 6; s++) {
          x += (hash(k * 13 + s + j * 5) - 0.5) * 40;
          y += 30;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      for (let i = 0; i < n / 2; i++) {
        const ang = t * 4 + i * 1.3;
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = c1;
        ctx.fillRect(Math.cos(ang) * 60 - 2, -80 + Math.sin(ang * 1.7) * 80 - 2, 4, 4);
      }
      break;
    }
    case 'sombra': {
      ctx.globalCompositeOperation = prev;
      for (let i = 0; i < n; i++) {
        const ph = (t * 0.4 + hash(i)) % 1;
        const x = (hash(i + 7) - 0.5) * 120 + Math.sin(t + i) * 10;
        const y = 50 - ph * 190;
        ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.45;
        ctx.fillStyle = i % 2 ? c1 : '#000000';
        ctx.beginPath();
        ctx.arc(x, y, 22 * (1 - ph * 0.5), 0, TAU);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.8;
      for (let i = 0; i < 4; i++) {
        const ph = (t * 0.7 + hash(i + 40)) % 1;
        ctx.fillStyle = c2;
        ctx.fillRect((hash(i + 50) - 0.5) * 100, 30 - ph * 180, 3, 3);
      }
      break;
    }
    case 'cosmos': {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = c2;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.ellipse(0, -70, 85, 22, -0.25, 0, TAU);
      ctx.stroke();
      for (let i = 0; i < n; i++) {
        const ang = t * (0.8 + hash(i) * 0.6) + i * 2.1;
        const rx = 60 + hash(i + 2) * 40;
        const x = Math.cos(ang) * rx;
        const y = -70 + Math.sin(ang) * rx * 0.3 - x * 0.25;
        const tw = 0.5 + Math.sin(t * 6 + i) * 0.5;
        ctx.globalAlpha = 0.5 + tw * 0.5;
        ctx.fillStyle = i % 3 ? '#ffffff' : c1;
        const s = 1.5 + tw * 2;
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
      const pa = t * 0.9;
      circle(ctx, Math.cos(pa) * 90, -70 + Math.sin(pa) * 25 - Math.cos(pa) * 22, 6, c1, false);
      break;
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = prev;
}

// ───────────────────────── Cabelo ─────────────────────────

function hairBack(ctx: CanvasRenderingContext2D, style: string, c1: string, c2: string, t: number) {
  ctx.lineJoin = 'round';
  switch (style) {
    case 'afro':
      circle(ctx, -6, -10, 37, c1);
      break;
    case 'longo':
      ctx.beginPath();
      ctx.moveTo(-25, -14);
      ctx.quadraticCurveTo(-40 + Math.sin(t * 3) * 3, 25, -30 + Math.sin(t * 3) * 4, 48);
      ctx.lineTo(-8, 40);
      ctx.lineTo(4, 10);
      ctx.closePath();
      ctx.fillStyle = C(c1);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = OC();
      ctx.stroke();
      break;
    case 'mullet':
      ctx.beginPath();
      ctx.moveTo(-24, -6);
      ctx.quadraticCurveTo(-34, 20, -24 + Math.sin(t * 4) * 2, 34);
      ctx.lineTo(-8, 26);
      ctx.lineTo(-6, 4);
      ctx.closePath();
      ctx.fillStyle = C(c1);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = OC();
      ctx.stroke();
      break;
    case 'rabo': {
      const sw = Math.sin(t * 4) * 6;
      ctx.beginPath();
      ctx.moveTo(-22, -16);
      ctx.quadraticCurveTo(-46, -8 + sw, -40 + sw, 26);
      ctx.quadraticCurveTo(-30, 6, -14, -6);
      ctx.closePath();
      ctx.fillStyle = C(c1);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = OC();
      ctx.stroke();
      circle(ctx, -24, -14, 4, c2);
      break;
    }
    case 'trancas':
      for (let i = 0; i < 4; i++) {
        const sw = Math.sin(t * 4 + i) * 5;
        const x0 = -12 - i * 5;
        ctx.beginPath();
        ctx.moveTo(x0, -20 + i * 5);
        ctx.quadraticCurveTo(x0 - 14, 10, x0 - 8 + sw, 40 - i * 3);
        ctx.lineWidth = 9;
        ctx.strokeStyle = OC();
        ctx.stroke();
        ctx.lineWidth = 5;
        ctx.strokeStyle = C(i % 2 ? c2 : c1);
        ctx.stroke();
        circle(ctx, x0 - 8 + sw, 40 - i * 3, 3.5, '#ffd23d');
      }
      break;
    case 'espetado':
    case 'super': {
      const big = style === 'super' ? 1.6 : 1;
      ctx.beginPath();
      const n = 7;
      for (let i = 0; i <= n; i++) {
        const a = Math.PI * 1.05 + (i / n) * Math.PI * 0.95;
        const r1 = 22;
        const r2 = (34 + (i % 2) * 6) * big;
        const am = a + 0.18;
        if (i === 0) ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1 - 4);
        ctx.lineTo(Math.cos(am) * r2, Math.sin(am) * r2 - 4 + (style === 'super' ? Math.sin(t * 10 + i) * 1.5 : 0));
        ctx.lineTo(Math.cos(a + 0.4) * r1, Math.sin(a + 0.4) * r1 - 4);
      }
      ctx.closePath();
      ctx.fillStyle = C(c1);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = OC();
      ctx.stroke();
      break;
    }
    case 'chamas': {
      const prev = ctx.globalCompositeOperation;
      for (let i = 0; i < 7; i++) {
        const x = -24 + i * 7;
        const h = 30 + Math.sin(t * 12 + i * 1.7) * 9 + (i % 2) * 8;
        ctx.beginPath();
        ctx.moveTo(x - 8, -14);
        ctx.quadraticCurveTo(x - 6 + Math.sin(t * 9 + i) * 4, -20 - h * 0.6, x + Math.sin(t * 7 + i) * 6, -18 - h);
        ctx.quadraticCurveTo(x + 6, -20 - h * 0.5, x + 8, -14);
        ctx.fillStyle = C(c1);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const x = -18 + i * 8;
        const h = 18 + Math.sin(t * 14 + i * 2.3) * 6;
        ctx.beginPath();
        ctx.moveTo(x - 5, -18);
        ctx.quadraticCurveTo(x, -22 - h, x + 2, -22 - h);
        ctx.quadraticCurveTo(x + 4, -22 - h * 0.5, x + 5, -18);
        ctx.fillStyle = F ? '#fff' : '#ffd23d';
        ctx.fill();
      }
      ctx.globalCompositeOperation = prev;
      break;
    }
    case 'cometa': {
      const prev = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 6; i >= 0; i--) {
        const k = i / 6;
        const x = -18 - k * 70;
        const y = -14 + Math.sin(t * 5 - k * 4) * 8 * k + k * 10;
        ctx.globalAlpha = 0.85 - k * 0.6;
        ctx.fillStyle = C(i % 2 ? c2 : c1);
        ctx.beginPath();
        ctx.arc(x, y, 16 - k * 9, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = prev;
      break;
    }
  }
}

/**
 * Calota de cabelo assente no crânio (círculo de raio HEAD_R centrado na origem).
 * `low` controla até onde desce na nuca.
 */
function capPath(ctx: CanvasRenderingContext2D, low = 6) {
  const R = HEAD_R + 2.5;
  const a0 = Math.atan2(low, -R + 1);
  ctx.beginPath();
  ctx.moveTo(Math.cos(a0) * R, Math.sin(a0) * R);
  ctx.arc(0, 0, R, a0, Math.PI * 2 - 0.5);
  // franja
  ctx.lineTo(22, -9);
  ctx.lineTo(18, -15);
  ctx.lineTo(13, -10);
  ctx.lineTo(8, -15);
  ctx.quadraticCurveTo(1, -12, -1, -5);
  // patilha curta à frente da orelha
  ctx.lineTo(-3, 1);
  ctx.lineTo(-6, 1);
  // por cima da orelha até à nuca
  ctx.quadraticCurveTo(-11, -4, -17, -3);
  ctx.quadraticCurveTo(-23, -1, Math.cos(a0) * R + 3, Math.sin(a0) * R);
  ctx.closePath();
}

function hairFront(ctx: CanvasRenderingContext2D, style: string, c1: string, c2: string, t: number, hc: Vis) {
  ctx.lineJoin = 'round';
  const fillStroke = (fill: string) => {
    ctx.fillStyle = C(fill);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = OC();
    ctx.stroke();
  };
  switch (style) {
    case 'careca':
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(-4, -19, 9, 4, -0.3, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    case 'curto':
    case 'rabo':
    case 'longo':
    case 'trancas':
    case 'mullet':
    case 'espetado':
    case 'super':
    case 'cometa':
      capPath(ctx, style === 'curto' || style === 'espetado' || style === 'super' ? 0 : 8);
      fillStroke(c1);
      break;
    case 'afro':
      for (let i = 0; i < 5; i++) {
        circle(ctx, -18 + i * 9, -26 + Math.abs(i - 2) * 3, 11, c1);
      }
      break;
    case 'moicano': {
      ctx.beginPath();
      ctx.moveTo(-22, -12);
      for (let i = 0; i < 6; i++) {
        const a = Math.PI * 1.15 + (i / 5) * Math.PI * 0.6;
        const r = 40 + (i % 2) * 4;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        const a2 = a + 0.13;
        ctx.lineTo(Math.cos(a2) * 26, Math.sin(a2) * 26);
      }
      ctx.lineTo(16, -18);
      ctx.closePath();
      fillStroke(c1);
      break;
    }
    case 'topete':
      capPath(ctx, 0);
      fillStroke(c1);
      ctx.beginPath();
      ctx.moveTo(-6, -28);
      ctx.bezierCurveTo(10, -50, 44, -44, 36, -22);
      ctx.quadraticCurveTo(24, -30, 8, -22);
      ctx.closePath();
      fillStroke(c1);
      break;
    case 'samurai':
      ctx.beginPath();
      ctx.moveTo(-27, 2);
      ctx.bezierCurveTo(-30, -28, 0, -36, 18, -26);
      ctx.quadraticCurveTo(10, -24, -2, -22);
      ctx.quadraticCurveTo(-18, -14, -22, 8);
      ctx.closePath();
      fillStroke(c1);
      ctx.beginPath();
      ctx.ellipse(-12, -34, 7, 10, -0.5, 0, TAU);
      fillStroke(c1);
      seg(ctx, -14, -26, -10, -28, 4, '#d22', false);
      break;
    case 'chamas':
      capPath(ctx, 0);
      fillStroke(c1);
      break;
    case 'coroa': {
      capPath(ctx, 0);
      fillStroke(c1);
      const prev = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.6 + Math.sin(t * 4) * 0.2;
      ctx.drawImage(glowSprite('#ffe27a'), -40, -78, 80, 50);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = prev;
      ctx.beginPath();
      ctx.ellipse(-2, -48 + Math.sin(t * 2) * 2, 22, 6, -0.15, 0, TAU);
      ctx.lineWidth = 6;
      ctx.strokeStyle = OC();
      ctx.stroke();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = F ? '#fff' : '#ffe27a';
      ctx.stroke();
      break;
    }
  }
  if (hc.anim === 'shine' || style === 'super') {
    const p = (t * 0.7) % 1;
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-20 + p * 40, -24, 5, 2.5, -0.4, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (style !== 'careca' && !F) {
    // madeixas de brilho dentro da calota
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = c2;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, HEAD_R - 2, Math.PI * 1.22, Math.PI * 1.42);
    ctx.moveTo(-14, -18);
    ctx.quadraticCurveTo(-8, -24, 0, -25);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// ───────────────────────── Cara ─────────────────────────

function eye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, L: Look, expr: Expr, skin: string, power: boolean) {
  if (expr === 'ko') {
    ctx.strokeStyle = OC();
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - r, y - r);
    ctx.lineTo(x + r, y + r);
    ctx.moveTo(x + r, y - r);
    ctx.lineTo(x - r, y + r);
    ctx.stroke();
    return;
  }
  if (expr === 'hurt') {
    ctx.strokeStyle = OC();
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - r, y - r * 0.8);
    ctx.lineTo(x + r * 0.6, y);
    ctx.lineTo(x - r, y + r * 0.8);
    ctx.stroke();
    return;
  }
  let ry = r * 1.15;
  let rx = r;
  if (L.eyes === 'grandes') {
    rx *= 1.3;
    ry *= 1.35;
  } else if (L.eyes === 'estreitos') ry *= 0.5;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fillStyle = power ? '#fffbe0' : '#ffffff';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = OC();
  ctx.stroke();
  if (power) {
    const prev = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(glowSprite('#ffe27a'), x - 14, y - 14, 28, 28);
    ctx.globalCompositeOperation = prev;
    return;
  }
  const pr = Math.min(rx, ry) * 0.62;
  ctx.fillStyle = L.eyeColor;
  ctx.beginPath();
  ctx.arc(x + rx * 0.25, y + 0.5, pr, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(x + rx * 0.3, y + 0.5, pr * 0.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x + rx * 0.1, y - pr * 0.4, pr * 0.35, 0, TAU);
  ctx.fill();
  // pálpebras
  let lid = 0;
  if (L.eyes === 'determinado' || expr === 'angry') lid = 0.38;
  if (L.eyes === 'sonolento') lid = 0.55;
  if (lid > 0) {
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.rect(x - rx - 1, y - ry - 1, rx * 2 + 2, ry * 2 * lid + 1);
    ctx.fill();
    ctx.strokeStyle = OC();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - rx, y - ry + ry * 2 * lid);
    ctx.lineTo(x + rx, y - ry + ry * 2 * lid - (expr === 'angry' ? 1.5 : 0));
    ctx.stroke();
  }
  if (expr === 'happy') {
    ctx.fillStyle = skin;
    ctx.fillRect(x - rx - 1, y + ry * 0.2, rx * 2 + 2, ry);
    ctx.strokeStyle = OC();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y + ry * 0.25, rx, Math.PI, 0, true);
    ctx.stroke();
  }
}

function drawFace(ctx: CanvasRenderingContext2D, L: Look, expr: Expr, t: number, hairC: string) {
  const skin = C(L.skin);
  const power = expr === 'power';
  // orelha (lado do crânio, atrás da patilha)
  ctx.beginPath();
  ctx.ellipse(-10, 5, 5.5, 7.5, 0.15, 0, TAU);
  ctx.fillStyle = skin;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = OC();
  ctx.stroke();
  if (!F) {
    ctx.strokeStyle = L.skinShade;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-9.5, 5.5, 3, -1.9, 1.6);
    ctx.stroke();
    // bochecha
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#ff5a6a';
    ctx.beginPath();
    ctx.ellipse(11, 9, 5, 3.4, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  const blink = expr === 'normal' && t % 3.7 < 0.11;
  if (blink) {
    ctx.strokeStyle = OC();
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(1, -1);
    ctx.lineTo(11, -1);
    ctx.moveTo(15, -1.5);
    ctx.lineTo(23, -1.5);
    ctx.stroke();
  } else {
    eye(ctx, 6, -1, 5, L, expr, skin, power);
    eye(ctx, 19, -1.5, 4.2, L, expr, skin, power);
  }

  // sobrancelhas
  if (L.brows !== 'nenhuma' && expr !== 'ko') {
    const thick = L.brows === 'grossas' ? 4.5 : L.brows === 'finas' ? 1.8 : 3;
    const ang = L.brows === 'zangadas' || expr === 'angry' || expr === 'power' ? 0.35 : expr === 'hurt' ? -0.3 : 0.05;
    ctx.lineCap = 'round';
    ctx.lineWidth = thick;
    ctx.strokeStyle = hairC;
    const by = L.eyes === 'grandes' ? -11 : -9;
    ctx.beginPath();
    ctx.moveTo(1, by - ang * 5);
    ctx.lineTo(11, by + ang * 5);
    ctx.moveTo(15, by - 0.5 + ang * 4);
    ctx.lineTo(23, by - 0.5 - ang * 3);
    ctx.stroke();
  }

  // nariz (dentro do contorno da cara, vista 3/4)
  ctx.beginPath();
  ctx.moveTo(19.5, 3.5);
  ctx.quadraticCurveTo(27, 9.5, 22.5, 13);
  ctx.quadraticCurveTo(19, 14.5, 16.5, 11.7);
  ctx.quadraticCurveTo(19, 8.5, 19.5, 3.5);
  ctx.fillStyle = F ? '#fff' : shade(L.skin, -0.06);
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = OC();
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(21, 5);
  ctx.quadraticCurveTo(27, 9.5, 22.5, 13);
  ctx.quadraticCurveTo(19, 14.5, 16.5, 11.7);
  ctx.stroke();
  if (!F) {
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(22, 8, 1.6, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // boca
  const mouth = expr === 'hurt' || expr === 'ko' ? 'ai' : expr === 'angry' || expr === 'power' ? 'dentes' : expr === 'happy' ? 'grito' : L.mouth;
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = OC();
  switch (mouth) {
    case 'sorriso':
      ctx.beginPath();
      ctx.arc(13, 15, 5, 0.25, Math.PI - 0.55);
      ctx.stroke();
      break;
    case 'serio':
      ctx.beginPath();
      ctx.moveTo(9, 19);
      ctx.lineTo(18, 18.5);
      ctx.stroke();
      break;
    case 'maroto':
      ctx.beginPath();
      ctx.moveTo(8, 19);
      ctx.quadraticCurveTo(14, 20, 19, 15.5);
      ctx.stroke();
      break;
    case 'dentes':
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.roundRect(7.5, 16, 11, 5.5, 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(8, 18.7);
      ctx.lineTo(18.5, 18.7);
      ctx.stroke();
      break;
    case 'grito':
      ctx.fillStyle = '#5a1020';
      ctx.beginPath();
      ctx.ellipse(13.5, 18, 4.6, 4.2, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ff6a7a';
      ctx.beginPath();
      ctx.ellipse(13.5, 20.2, 2.6, 1.5, 0, 0, TAU);
      ctx.fill();
      break;
    case 'ai':
      ctx.beginPath();
      ctx.moveTo(8, 19);
      ctx.lineTo(10.5, 16.5);
      ctx.lineTo(13, 19);
      ctx.lineTo(15.5, 16.5);
      ctx.lineTo(18, 19);
      ctx.stroke();
      break;
  }

  // barba
  if (L.beard !== 'nenhuma') {
    ctx.fillStyle = hairC;
    switch (L.beard) {
      case 'curta':
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.moveTo(-4, 12);
        ctx.quadraticCurveTo(0, 28, 12, 29);
        ctx.quadraticCurveTo(21, 28, 23, 19);
        ctx.quadraticCurveTo(17, 22, 13, 19);
        ctx.quadraticCurveTo(5, 19, -4, 12);
        ctx.fill();
        ctx.globalAlpha = 1;
        break;
      case 'bigode':
        ctx.beginPath();
        ctx.moveTo(7, 15);
        ctx.quadraticCurveTo(14, 11.5, 21, 14.5);
        ctx.quadraticCurveTo(22.5, 17.5, 19, 16.5);
        ctx.quadraticCurveTo(14, 14.5, 9, 17);
        ctx.quadraticCurveTo(5.5, 17.5, 7, 15);
        ctx.fill();
        break;
      case 'cavanhaque':
        ctx.beginPath();
        ctx.moveTo(9, 22);
        ctx.quadraticCurveTo(14, 32, 19, 22);
        ctx.quadraticCurveTo(14, 24.5, 9, 22);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(8, 15);
        ctx.quadraticCurveTo(14, 12, 20, 14.5);
        ctx.lineTo(19.5, 16.3);
        ctx.quadraticCurveTo(14, 14.5, 8.5, 16.8);
        ctx.fill();
        break;
      case 'grande':
        ctx.beginPath();
        ctx.moveTo(-5, 8);
        ctx.quadraticCurveTo(-3, 33, 13, 37);
        ctx.quadraticCurveTo(26, 33, 24, 13);
        ctx.quadraticCurveTo(16, 18, 14.5, 18);
        ctx.quadraticCurveTo(8, 18, 5, 12);
        ctx.quadraticCurveTo(0, 13, -5, 8);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = OC();
        ctx.stroke();
        break;
    }
  }
}

function drawMask(ctx: CanvasRenderingContext2D, m: Vis, L: Look, expr: Expr, t: number) {
  const c1 = m.c1 ?? '#22f';
  const c2 = m.c2 ?? '#fff';
  switch (m.style) {
    case 'luchador': {
      ctx.beginPath();
      ctx.arc(0, 0, HEAD_R + 1, 0, TAU);
      ctx.fillStyle = C(c1);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = OC();
      ctx.stroke();
      // contornos dos olhos
      ctx.fillStyle = C(c2);
      for (const [x, y, r] of [[6, -1, 9], [19, -1.5, 7.5]] as const) {
        ctx.beginPath();
        ctx.moveTo(x - r, y);
        ctx.quadraticCurveTo(x, y - r * 1.6, x + r, y - 2);
        ctx.quadraticCurveTo(x, y + r, x - r, y);
        ctx.fill();
      }
      // boca aberta
      ctx.fillStyle = C(L.skin);
      ctx.beginPath();
      ctx.ellipse(15, 13, 8, 6, 0, 0, TAU);
      ctx.fill();
      // risca central
      ctx.strokeStyle = C(c2);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, HEAD_R - 6, Math.PI * 1.2, Math.PI * 1.75);
      ctx.stroke();
      eye(ctx, 6, -1, 5, L, expr, C(c2), expr === 'power');
      eye(ctx, 19, -1.5, 4, L, expr, C(c2), expr === 'power');
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = OC();
      ctx.beginPath();
      if (expr === 'hurt' || expr === 'ko') {
        ctx.moveTo(10, 14);
        ctx.lineTo(20, 13);
      } else ctx.arc(15, 10, 5, 0.3, Math.PI - 0.4);
      ctx.stroke();
      break;
    }
    case 'caveira': {
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = C(c1);
      ctx.beginPath();
      ctx.ellipse(12, 2, 17, 20, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = c2;
      ctx.beginPath();
      ctx.arc(6, -1, 7, 0, TAU);
      ctx.arc(19, -1.5, 6, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(24, 4);
      ctx.lineTo(28, 8);
      ctx.lineTo(23, 9);
      ctx.fill();
      ctx.strokeStyle = c2;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        ctx.moveTo(9 + i * 3, 12);
        ctx.lineTo(9 + i * 3, 18);
      }
      ctx.moveTo(8, 15);
      ctx.lineTo(22, 15);
      ctx.stroke();
      if (expr !== 'ko') {
        ctx.fillStyle = '#ff3030';
        ctx.beginPath();
        ctx.arc(7, -1, 1.8, 0, TAU);
        ctx.arc(20, -1.5, 1.5, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'demonio': {
      ctx.fillStyle = C(c1);
      ctx.beginPath();
      ctx.moveTo(-6, -12);
      ctx.quadraticCurveTo(14, -18, 30, -6);
      ctx.lineTo(30, 6);
      ctx.quadraticCurveTo(14, 2, -6, 6);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = OC();
      ctx.stroke();
      // chifres
      for (const [x, d] of [[0, -1], [16, 1]] as const) {
        ctx.beginPath();
        ctx.moveTo(x - 5, -22);
        ctx.quadraticCurveTo(x + d * 4, -46, x + d * 12, -48);
        ctx.quadraticCurveTo(x + 2, -36, x + 5, -22);
        ctx.fillStyle = C('#f2e6d0');
        ctx.fill();
        ctx.stroke();
      }
      const prev = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'lighter';
      const g = glowSprite(c2);
      ctx.globalAlpha = 0.8 + Math.sin(t * 6) * 0.2;
      ctx.drawImage(g, -6, -13, 24, 24);
      ctx.drawImage(g, 8, -13, 22, 22);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = prev;
      ctx.fillStyle = c2;
      ctx.beginPath();
      ctx.ellipse(6, -1, 5, 2.4, 0.2, 0, TAU);
      ctx.ellipse(19, -1.5, 4, 2, -0.2, 0, TAU);
      ctx.fill();
      break;
    }
    case 'cyber': {
      ctx.fillStyle = C(c1);
      ctx.beginPath();
      ctx.moveTo(-8, -9);
      ctx.lineTo(31, -8);
      ctx.lineTo(30, 5);
      ctx.lineTo(-8, 5);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = OC();
      ctx.stroke();
      const prev = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = c2;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(0, -3, 29, 3);
      const sx = ((t * 1.4) % 1) * 30;
      ctx.drawImage(glowSprite(c2), sx - 10, -12, 20, 20);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = prev;
      break;
    }
  }
}

/** Crânio redondo + maxilar e queixo virados para a frente. */
function headPath(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(-14, 22);
  ctx.arc(0, 0, HEAD_R, 2.14, Math.PI * 2 - 0.42);
  ctx.bezierCurveTo(27.5, -4, 28, 14, 22, 23);
  ctx.quadraticCurveTo(16, 31, 6, 31);
  ctx.quadraticCurveTo(-6, 30, -14, 22);
  ctx.closePath();
}

function drawHead(ctx: CanvasRenderingContext2D, L: Look, expr: Expr, t: number) {
  const hc = L.hairColor;
  const [c1, c2] = hairColors(hc, t);
  const style = L.hair.style ?? 'curto';
  const masked = L.mask?.style === 'luchador';
  if (!masked || style === 'longo' || style === 'rabo' || style === 'trancas' || style === 'cometa' || style === 'chamas') {
    hairBack(ctx, style, c1, c2, t);
  }
  headPath(ctx);
  ctx.lineWidth = OW;
  ctx.strokeStyle = OC();
  ctx.stroke();
  ctx.fillStyle = C(L.skin);
  ctx.fill();
  if (!F) {
    // sombreamento cel recortado pela forma da cabeça
    ctx.save();
    headPath(ctx);
    ctx.clip();
    ctx.fillStyle = L.skinShade;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(-34, 6, 26, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.ellipse(4, 42, 26, 15, -0.15, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(10, -17, 8, 4, -0.35, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  drawFace(ctx, L, expr, t, C(c1));
  if (L.mask) drawMask(ctx, L.mask, L, expr, t);
  if (!masked) hairFront(ctx, style, c1, c2, t, hc);
}

// ───────────────────────── Luvas e botas ─────────────────────────

function drawGlove(ctx: CanvasRenderingContext2D, g: Vis, x: number, y: number, ang: number, t: number, skin: string, back: boolean) {
  const c1 = back ? shade(g.c1 ?? '#d22', -0.2) : g.c1 ?? '#d22';
  const c2 = g.c2 ?? '#fff';
  const dx = Math.sin(ang);
  const dy = Math.cos(ang);
  switch (g.style) {
    case 'fita':
      circle(ctx, x + dx * 2, y + dy * 2, 9, skin);
      ctx.strokeStyle = C(c1);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x + dx * 2, y + dy * 2, 6, 0, TAU);
      ctx.stroke();
      seg(ctx, x - dx * 8, y - dy * 8, x, y, 13, c1, false);
      break;
    case 'garra':
      seg(ctx, x - dx * 10, y - dy * 10, x, y, 15, shade(c1, -0.25));
      circle(ctx, x + dx * 3, y + dy * 3, 10, c1);
      for (let i = -1; i <= 1; i++) {
        const px = -dy * i * 5;
        const py = dx * i * 5;
        seg(ctx, x + dx * 9 + px, y + dy * 9 + py, x + dx * 22 + px * 1.3, y + dy * 22 + py * 1.3, 3, c2);
      }
      break;
    case 'fogo':
    case 'cosmico': {
      circle(ctx, x + dx * 3, y + dy * 3, 12, c1);
      const prev = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.7 + Math.sin(t * 9) * 0.2;
      ctx.drawImage(glowSprite(c2), x - 22, y - 22, 44, 44);
      ctx.globalAlpha = 1;
      if (g.style === 'cosmico') {
        ctx.fillStyle = '#fff';
        for (let i = 0; i < 4; i++) {
          const a = t * 3 + i * 1.6;
          ctx.fillRect(x + Math.cos(a) * 7 - 1, y + Math.sin(a) * 7 - 1, 2, 2);
        }
      } else {
        for (let i = 0; i < 3; i++) {
          const fx = x + Math.sin(t * 11 + i * 2) * 6;
          const fy = y - 8 - ((t * 3 + i * 0.33) % 1) * 18;
          ctx.fillStyle = i % 2 ? c2 : c1;
          ctx.beginPath();
          ctx.arc(fx, fy, 4, 0, TAU);
          ctx.fill();
        }
      }
      ctx.globalCompositeOperation = prev;
      seg(ctx, x - dx * 9, y - dy * 9, x - dx * 3, y - dy * 3, 14, c2, false);
      break;
    }
    default: {
      // boxe
      seg(ctx, x - dx * 11, y - dy * 11, x - dx * 2, y - dy * 2, 16, c2);
      const gx = x + dx * 5;
      const gy = y + dy * 5;
      ctx.beginPath();
      ctx.ellipse(gx, gy, 13.5, 12, ang - Math.PI / 2, 0, TAU);
      ctx.lineWidth = 3;
      ctx.strokeStyle = OC();
      ctx.fillStyle = C(c1);
      ctx.fill();
      ctx.stroke();
      // polegar
      circle(ctx, gx - dy * 8 - dx * 3, gy + dx * 8 - dy * 3, 5, c1);
      if (!F) {
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(gx + 2, gy + 4, 10, 6.5, ang - Math.PI / 2, 0, Math.PI);
        ctx.fill();
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(gx - 4, gy - 5, 4.5, 2.6, -0.6, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }
}

function drawBoot(ctx: CanvasRenderingContext2D, kx: number, ky: number, fx: number, fy: number, ang: number, color: string) {
  // cano da bota sobre a parte de baixo da canela
  const bx = kx + (fx - kx) * 0.45;
  const by = ky + (fy - ky) * 0.45;
  seg(ctx, bx, by, fx, fy, 20, color);
  const tx = fx + Math.cos(ang) * 16;
  const ty = fy - Math.sin(ang) * 16;
  seg(ctx, fx - Math.cos(ang) * 4, fy + Math.sin(ang) * 4, tx, ty, 14, color);
  // sola
  const sx = Math.sin(ang) * 6;
  const sy = Math.cos(ang) * 6;
  seg(ctx, fx - Math.cos(ang) * 6 + sx, fy + Math.sin(ang) * 6 + sy, tx + sx * 0.6, ty + sy * 0.6, 4, '#e8e4dc', false);
  // atacadores
  if (!F) {
    ctx.strokeStyle = shade(color, 0.45);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const u = 0.25 + i * 0.22;
      const lx = bx + (fx - bx) * u;
      const ly = by + (fy - by) * u;
      ctx.moveTo(lx + Math.cos(ang) * 3, ly - Math.sin(ang) * 3);
      ctx.lineTo(lx + Math.cos(ang) * 9, ly - Math.sin(ang) * 9);
    }
    ctx.stroke();
  }
  // detalhe do cano
  ctx.lineCap = 'butt';
  seg(ctx, bx, by, bx + (fx - bx) * 0.14, by + (fy - by) * 0.14, 19, shade(color, 0.3), false);
  ctx.lineCap = 'round';
}

// ───────────────────────── Tronco e trajes ─────────────────────────

function torsoPath(ctx: CanvasRenderingContext2D, s: Skel, hw: number, sw: number) {
  const a = s.torsoA;
  const nx = Math.cos(a);
  const ny = Math.sin(a);
  const ux = Math.sin(a);
  const uy = -Math.cos(a);
  const hx = s.x[J_HIP];
  const hy = s.y[J_HIP];
  const sx = s.x[J_SH] + ux * 3;
  const sy = s.y[J_SH] + uy * 3;
  const P = (u: number, n: number): [number, number] => [hx + ux * u + nx * n, hy + uy * u + ny * n];
  const S = (u: number, n: number): [number, number] => [sx + ux * u + nx * n, sy + uy * u + ny * n];
  ctx.beginPath();
  let p = P(2, -hw);
  ctx.moveTo(p[0], p[1]);
  // costas (dorsais)
  let c = P(30, -hw - 7);
  p = S(-6, -sw + 2);
  ctx.quadraticCurveTo(c[0], c[1], p[0], p[1]);
  // ombro de trás → trapézio → ombro da frente
  c = S(6, -sw + 2);
  p = S(9, -6);
  ctx.quadraticCurveTo(c[0], c[1], p[0], p[1]);
  c = S(10, 6);
  p = S(4, sw - 4);
  ctx.quadraticCurveTo(c[0], c[1], p[0], p[1]);
  // peitoral
  c = S(-10, sw + 8);
  p = P(38, hw + 8);
  ctx.quadraticCurveTo(c[0], c[1], p[0], p[1]);
  // barriga até à cintura
  c = P(18, hw + 1);
  p = P(2, hw);
  ctx.quadraticCurveTo(c[0], c[1], p[0], p[1]);
  c = P(-6, 0);
  p = P(2, -hw);
  ctx.quadraticCurveTo(c[0], c[1], p[0], p[1]);
  ctx.closePath();
}

function fillOut(ctx: CanvasRenderingContext2D, color: string) {
  ctx.lineWidth = OW;
  ctx.strokeStyle = OC();
  ctx.stroke();
  ctx.fillStyle = C(color);
  ctx.fill();
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

function drawTorso(ctx: CanvasRenderingContext2D, L: Look, s: Skel, t: number) {
  const o = L.outfit;
  const style = o.style ?? 'trunks';
  const c1 = outfitC1(o, t);
  const c2 = o.c2 ?? '#fff';
  const c3 = o.c3 ?? c2;
  const a = s.torsoA;
  const ux = Math.sin(a);
  const uy = -Math.cos(a);
  const nx = Math.cos(a);
  const ny = Math.sin(a);
  const hx = s.x[J_HIP];
  const hy = s.y[J_HIP];

  const covered = style === 'gi' || style === 'armor' || style === 'jacket';
  torsoPath(ctx, s, 19, 30);
  fillOut(ctx, covered ? c1 : L.skin);
  if (!F) {
    // sombra das costas (cel shading)
    ctx.globalAlpha = covered ? 0.3 : 0.5;
    ctx.fillStyle = covered ? shade(c1, -0.35) : L.skinShade;
    ctx.beginPath();
    const b0x = hx - nx * 17 + ux * 4, b0y = hy - ny * 17 + uy * 4;
    const b1x = s.x[J_SH] - nx * 24, b1y = s.y[J_SH] - ny * 24;
    ctx.moveTo(b0x, b0y);
    ctx.quadraticCurveTo(hx - nx * 25 + ux * 30, hy - ny * 25 + uy * 30, b1x, b1y);
    ctx.quadraticCurveTo(hx - nx * 6 + ux * 34, hy - ny * 6 + uy * 34, hx - nx * 6 + ux * 4, hy - ny * 6 + uy * 4);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  if (!covered && !F) {
    // peitorais e abdominais
    ctx.strokeStyle = L.skinShade;
    ctx.lineWidth = 2.6;
    ctx.globalAlpha = 0.85;
    const px = hx + ux * 40 + nx * 2;
    const py = hy + uy * 40 + ny * 2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px + nx * 14 - ux * 9, py + ny * 14 - uy * 9, px + nx * 27 + ux * 2, py + ny * 27 + uy * 2);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    for (let i = 0; i < 2; i++) {
      const u = 27 - i * 10;
      ctx.moveTo(hx + ux * u + nx * 9, hy + uy * u + ny * 9);
      ctx.lineTo(hx + ux * u + nx * 19, hy + uy * u + ny * 19);
    }
    ctx.moveTo(hx + ux * 32 + nx * 13, hy + uy * 32 + ny * 13);
    ctx.lineTo(hx + ux * 9 + nx * 15, hy + uy * 9 + ny * 15);
    ctx.stroke();
    // brilho no peito
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(hx + ux * 48 + nx * 10, hy + uy * 48 + ny * 10);
    ctx.quadraticCurveTo(hx + ux * 47 + nx * 20, hy + uy * 47 + ny * 20, hx + ux * 42 + nx * 25, hy + uy * 42 + ny * 25);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (style === 'singlet') {
    ctx.beginPath();
    const top = 38;
    ctx.moveTo(hx - nx * 20, hy - ny * 20);
    ctx.lineTo(hx - nx * 23 + ux * top, hy - ny * 23 + uy * top);
    ctx.quadraticCurveTo(hx + ux * (top - 10), hy + uy * (top - 10), hx + nx * 27 + ux * top, hy + ny * 27 + uy * top);
    ctx.lineTo(hx + nx * 20, hy + ny * 20);
    ctx.closePath();
    fillOut(ctx, c1);
    // alças
    ctx.lineCap = 'round';
    seg(ctx, hx - nx * 14 + ux * top, hy - ny * 14 + uy * top, s.x[J_SH] - nx * 6, s.y[J_SH] - ny * 6, 6, c1);
    if (o.pattern === 'stars') {
      ctx.fillStyle = C(c2);
      star(ctx, hx + ux * 22 + nx * 6, hy + uy * 22 + ny * 6, 6);
      star(ctx, hx + ux * 10 - nx * 8, hy + uy * 10 - ny * 8, 4);
    } else if (o.pattern === 'stripe') {
      seg(ctx, hx + ux * 34 - nx * 20, hy + uy * 34 - ny * 20, hx + ux * 34 + nx * 25, hy + uy * 34 + ny * 25, 4, c2, false);
    }
  } else if (style === 'gi') {
    // decote em V
    ctx.beginPath();
    const sx = s.x[J_SH];
    const sy = s.y[J_SH];
    ctx.moveTo(sx + nx * 2 + ux * 4, sy + ny * 2 + uy * 4);
    ctx.lineTo(sx + nx * 18 + ux * 2, sy + ny * 18 + uy * 2);
    ctx.lineTo(hx + nx * 14 + ux * 22, hy + ny * 14 + uy * 22);
    ctx.closePath();
    ctx.fillStyle = C(L.skin);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = OC();
    ctx.stroke();
    if (o.pattern === 'scales') {
      const glow = o.anim === 'glow' ? 0.45 + Math.sin(t * 3) * 0.3 : 0.5;
      ctx.globalAlpha = glow;
      ctx.strokeStyle = C(c2);
      ctx.lineWidth = 2;
      for (let r = 0; r < 3; r++) {
        for (let k = -1; k <= 1; k++) {
          const cx = hx + ux * (12 + r * 12) + nx * (k * 10 - 4);
          const cy = hy + uy * (12 + r * 12) + ny * (k * 10 - 4);
          ctx.beginPath();
          ctx.arc(cx, cy, 5, a, a + Math.PI);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }
    // faixa
    seg(ctx, hx - nx * 21 + ux * 8, hy - ny * 21 + uy * 8, hx + nx * 22 + ux * 8, hy + ny * 22 + uy * 8, 7, c2);
    seg(ctx, hx + nx * 6 + ux * 8, hy + ny * 6 + uy * 8, hx + nx * 10 - ux * 6, hy + ny * 10 - uy * 6, 4, c2);
  } else if (style === 'jacket') {
    // colete aberto
    ctx.beginPath();
    ctx.moveTo(hx + nx * 10 + ux * 6, hy + ny * 10 + uy * 6);
    ctx.lineTo(s.x[J_SH] + nx * 14, s.y[J_SH] + ny * 14);
    ctx.lineTo(s.x[J_SH] + nx * 24, s.y[J_SH] + ny * 24);
    ctx.lineTo(hx + nx * 21 + ux * 6, hy + ny * 21 + uy * 6);
    ctx.closePath();
    ctx.fillStyle = C(L.skin);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = OC();
    ctx.stroke();
    seg(ctx, hx + nx * 9 + ux * 6, hy + ny * 9 + uy * 6, s.x[J_SH] + nx * 13, s.y[J_SH] + ny * 13, 4, c2, false);
    if (o.pattern === 'lightning') {
      ctx.strokeStyle = C(c2);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(hx + ux * 44 - nx * 14, hy + uy * 44 - ny * 14);
      ctx.lineTo(hx + ux * 30 - nx * 4, hy + uy * 30 - ny * 4);
      ctx.lineTo(hx + ux * 30 - nx * 12, hy + uy * 30 - ny * 12);
      ctx.lineTo(hx + ux * 14 - nx * 2, hy + uy * 14 - ny * 2);
      ctx.stroke();
    } else if (o.pattern === 'stripe') {
      seg(ctx, hx - nx * 18 + ux * 6, hy - ny * 18 + uy * 6, s.x[J_SH] - nx * 20, s.y[J_SH] - ny * 20, 4, c2, false);
    }
    // gola
    seg(ctx, s.x[J_SH] - nx * 10 + ux * 8, s.y[J_SH] - ny * 10 + uy * 8, s.x[J_SH] + nx * 8 + ux * 8, s.y[J_SH] + ny * 8 + uy * 8, 6, c2);
  } else if (style === 'armor') {
    // placa peitoral
    ctx.beginPath();
    const ax = hx + ux * 30;
    const ay = hy + uy * 30;
    ctx.ellipse(ax + nx * 4, ay + ny * 4, 21, 16, a, 0, TAU);
    ctx.fillStyle = C(c2);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = OC();
    ctx.stroke();
    ctx.strokeStyle = C(c3);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(ax + nx * 4, ay + ny * 4, 15, 10, a, 0, TAU);
    ctx.stroke();
    // padrões especiais
    if (o.pattern === 'cracks') {
      const pulse = 0.55 + Math.sin(t * 4) * 0.35;
      const prev = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = c3;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(hx - nx * 14 + ux * 8, hy - ny * 14 + uy * 8);
      ctx.lineTo(hx - nx * 4 + ux * 22, hy - ny * 4 + uy * 22);
      ctx.lineTo(hx + nx * 6 + ux * 18, hy + ny * 6 + uy * 18);
      ctx.lineTo(hx + nx * 14 + ux * 40, hy + ny * 14 + uy * 40);
      ctx.moveTo(hx - nx * 4 + ux * 22, hy - ny * 4 + uy * 22);
      ctx.lineTo(hx - nx * 12 + ux * 44, hy - ny * 12 + uy * 44);
      ctx.stroke();
      ctx.drawImage(glowSprite(c2), ax - 30, ay - 30, 60, 60);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = prev;
    } else if (o.pattern === 'crystals') {
      ctx.fillStyle = C('#ffffff');
      for (let i = 0; i < 3; i++) {
        const cx = hx + ux * (14 + i * 14) + nx * (i % 2 ? 8 : -8);
        const cy = hy + uy * (14 + i * 14) + ny * (i % 2 ? 8 : -8);
        ctx.globalAlpha = 0.6 + Math.sin(t * 3 + i * 2) * 0.35;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 7);
        ctx.lineTo(cx + 4, cy);
        ctx.lineTo(cx, cy + 7);
        ctx.lineTo(cx - 4, cy);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (o.pattern === 'cosmos') {
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 9; i++) {
        const cx = hx + ux * (8 + hash(i) * 46) + nx * ((hash(i + 4) - 0.5) * 32);
        const cy = hy + uy * (8 + hash(i) * 46) + ny * ((hash(i + 4) - 0.5) * 32);
        ctx.globalAlpha = 0.4 + Math.sin(t * 5 + i * 1.3) * 0.5;
        ctx.fillRect(cx - 1.2, cy - 1.2, 2.4, 2.4);
      }
      ctx.globalAlpha = 1;
    }
    if (o.anim === 'gold') {
      const p = ((t * 0.6) % 1.6) - 0.3;
      ctx.globalAlpha = 0.6;
      seg(ctx, hx + ux * (p * 60) - nx * 20, hy + uy * (p * 60) - ny * 20, hx + ux * (p * 60 + 12) + nx * 22, hy + uy * (p * 60 + 12) + ny * 22, 5, '#ffffff', false);
      ctx.globalAlpha = 1;
    }
  }

  // calções / cintura (todos menos gi)
  if (style !== 'gi') {
    const tc = style === 'jacket' ? c2 : style === 'armor' ? c1 : c1;
    const fkx = s.x[J_FK];
    const fky = s.y[J_FK];
    const bkx = s.x[J_BK];
    const bky = s.y[J_BK];
    const fk = 0.42;
    const tw = 22;
    ctx.lineCap = 'round';
    const fxk = hx + (fkx - hx) * fk;
    const fyk = hy + (fky - hy) * fk;
    const bxk = hx + (bkx - hx) * fk;
    const byk = hy + (bky - hy) * fk;
    // calções justos que seguem a forma das coxas
    const TR: Prof = [LEG_U[0] + 2.5, LEG_U[1] + 2.5, LEG_U[1] + 1.5];
    ctx.beginPath();
    capsule(ctx, hx - 3, hy, bxk, byk, TR);
    capsule(ctx, hx + 3, hy, fxk, fyk, TR);
    ctx.moveTo(hx - nx * 20 + ux * 14, hy - ny * 20 + uy * 14);
    ctx.lineTo(hx + nx * 20 + ux * 14, hy + ny * 20 + uy * 14);
    ctx.lineTo(hx + nx * 21 - ux * 4, hy + ny * 21 - uy * 4);
    ctx.lineTo(hx - nx * 21 - ux * 4, hy - ny * 21 - uy * 4);
    ctx.closePath();
    ctx.lineWidth = OW;
    ctx.strokeStyle = OC();
    ctx.stroke();
    ctx.fillStyle = C(tc);
    ctx.fill();
    if (!F) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = shade(tc, -0.45);
      ctx.beginPath();
      capsule(ctx, hx - 3, hy, bxk, byk, TR, 0.75);
      ctx.fill();
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(hx + nx * 4 + ux * 8, hy + ny * 4 + uy * 8);
      ctx.lineTo(hx + nx * 14 + ux * 6, hy + ny * 14 + uy * 6);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    void tw;
    // cós
    seg(ctx, hx - nx * 20 + ux * 14, hy - ny * 20 + uy * 14, hx + nx * 20 + ux * 14, hy + ny * 20 + uy * 14, 6, style === 'armor' ? c3 : c2);
    if (o.pattern === 'stripe' && style === 'trunks') {
      // debrum nas pernas
      const fa = Math.atan2(fky - hy, fkx - hx) + Math.PI / 2;
      ctx.strokeStyle = C(c2);
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(fxk + Math.cos(fa) * 11, fyk + Math.sin(fa) * 11);
      ctx.lineTo(fxk - Math.cos(fa) * 11, fyk - Math.sin(fa) * 11);
      ctx.stroke();
    } else if (o.pattern === 'spots') {
      ctx.fillStyle = C(c2);
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.ellipse(hx + (fxk - hx) * (0.2 + (i % 3) * 0.3) + (i - 2) * 4, hy + (fyk - hy) * (0.2 + (i % 2) * 0.4) - 4 + i, 2.8, 1.8, i, 0, TAU);
        ctx.fill();
      }
    }
  }
}

// ───────────────────────── Corpo completo ─────────────────────────

/**
 * Desenha o lutador com a anca na origem, virado para a direita.
 * O chamador trata da translação, espelhamento e escala.
 */
export function drawFighter(ctx: CanvasRenderingContext2D, L: Look, s: Skel, o: DrawOpts) {
  if (o.rim && !o.flash) {
    // silhueta desviada para trás/cima: fica uma orla colorida à volta do corpo
    F = true;
    SIL = o.rim;
    ctx.save();
    ctx.translate(-2.6, -2.2);
    drawBody(ctx, L, s, o);
    ctx.restore();
    SIL = null;
  }
  F = o.flash;
  drawBody(ctx, L, s, o);
  F = false;
}

function drawBody(ctx: CanvasRenderingContext2D, L: Look, s: Skel, o: DrawOpts) {
  const t = o.t;
  const X = s.x;
  const Y = s.y;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (L.aura && !F) drawAura(ctx, L.aura, t, !!o.low);
  if (o.glow && !F) {
    const prev = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.75 + Math.sin(t * 20) * 0.2;
    ctx.drawImage(glowSprite(o.glow), -110, -190, 220, 250);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = prev;
  }

  const out = L.outfit;
  const style = out.style ?? 'trunks';
  const skinB = shade(L.skin, -0.15);
  const legC = style === 'gi' ? outfitC1(out, t) : style === 'armor' ? out.boots ?? '#222' : L.skin;
  const legB = shade(legC, -0.15);
  const boots = out.boots ?? '#222';
  const sleeve = style === 'gi' ? outfitC1(out, t) : null;

  // braço de trás
  limb(ctx, X[J_SH], Y[J_SH], X[J_BE], Y[J_BE], X[J_BH], Y[J_BH], ARM_U, ARM_L, skinB, shade(L.skinShade, -0.15));
  if (sleeve) seg(ctx, X[J_SH], Y[J_SH], X[J_SH] + (X[J_BE] - X[J_SH]) * 0.8, Y[J_SH] + (Y[J_BE] - Y[J_SH]) * 0.8, 23, shade(sleeve, -0.15));
  drawGlove(ctx, L.gloves, X[J_BH], Y[J_BH], s.baL, t, skinB, true);

  // perna de trás
  limb(ctx, X[J_HIP] - 3, Y[J_HIP], X[J_BK], Y[J_BK], X[J_BF], Y[J_BF], LEG_U, LEG_L, legB, shade(legB, -0.3));
  drawBoot(ctx, X[J_BK], Y[J_BK], X[J_BF], Y[J_BF], s.blL, shade(boots, -0.15));
  // perna da frente
  limb(ctx, X[J_HIP] + 3, Y[J_HIP], X[J_FK], Y[J_FK], X[J_FF], Y[J_FF], LEG_U, LEG_L, legC, legC === L.skin ? L.skinShade : shade(legC, -0.3));
  if (style === 'trunks' || style === 'singlet') {
    // joelheira
    const kx = X[J_FK], ky = Y[J_FK];
    ctx.beginPath();
    capsule(ctx, kx + (X[J_HIP] - kx) * 0.18, ky + (Y[J_HIP] - ky) * 0.18, kx + (X[J_FF] - kx) * 0.2, ky + (Y[J_FF] - ky) * 0.2, [10.5, 11, 10]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = OC();
    ctx.stroke();
    ctx.fillStyle = C(out.c2 ?? '#fff');
    ctx.fill();
  }
  drawBoot(ctx, X[J_FK], Y[J_FK], X[J_FF], Y[J_FF], s.flL, boots);

  // pescoço
  seg(ctx, X[J_SH], Y[J_SH], X[J_HEAD] * 0.45 + X[J_NECK] * 0.55, Y[J_HEAD] * 0.45 + Y[J_NECK] * 0.55, 19, L.skin);
  drawTorso(ctx, L, s, t);

  // cabeça
  ctx.save();
  ctx.translate(X[J_HEAD], Y[J_HEAD]);
  ctx.rotate(s.headA);
  drawHead(ctx, L, o.expr, t);
  ctx.restore();

  // braço da frente
  limb(ctx, X[J_SH], Y[J_SH], X[J_FE], Y[J_FE], X[J_FH], Y[J_FH], ARM_U, ARM_L, L.skin, L.skinShade);
  if (sleeve) seg(ctx, X[J_SH], Y[J_SH], X[J_SH] + (X[J_FE] - X[J_SH]) * 0.8, Y[J_SH] + (Y[J_FE] - Y[J_SH]) * 0.8, 24, sleeve);
  if (style === 'armor') circle(ctx, X[J_SH], Y[J_SH], 13, out.c3 ?? out.c2 ?? '#aaa');
  drawGlove(ctx, L.gloves, X[J_FH], Y[J_FH], s.faL, t, L.skin, false);
  F = false;
}
