import { shade } from '../data/appearance';
import { drawAura } from './aura';
import { drawBoot, drawGlove } from './gloves';
import { HEAD_2D, bodyPieces, chestDecal, headPieces, hidesHair, hidesMask, matPattern } from './costume';
import type { Vis } from '../data/items';
import type { Look } from './look';
import {
  HEAD_R, J_BE, J_BF, J_BH, J_BK, J_FE, J_FF, J_FH, J_FK, J_HEAD, J_HIP, J_NECK, J_SH, type Skel,
} from './pose';

import {
  ARM_L, ARM_U, C, LEG_L, LEG_U, OC, OW, PS, TAU, DL, capsule, circle, glowSprite, hash, limb, proj2D, seg, shadeSide, type Prof,
} from './paint';

export { glowSprite };

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

export function hairColors(hc: Vis, t: number): [string, string] {
  if (hc.anim === 'rainbow') {
    const h = (t * 120) % 360;
    return [`hsl(${h} 95% 55%)`, `hsl(${(h + 40) % 360} 100% 75%)`];
  }
  return [hc.c1 ?? '#3a2a1a', hc.c2 ?? '#5a4030'];
}

export function outfitC1(o: Vis, t: number): string {
  if (o.anim === 'cosmic') return `hsl(${250 + Math.sin(t * 1.3) * 25} 70% 16%)`;
  return o.c1 ?? '#d22';
}


// ───────────────────────── Utilitários de cor / sombreado ─────────────────────────

const shCache = new Map<string, string>();
/** shade() com cache; cores que não são hex (hsl do arco-íris) passam sem alteração. */
function sh(c: string, amt: number): string {
  if (c.length !== 7 || c[0] !== '#') return c;
  const k = c + amt;
  let r = shCache.get(k);
  if (r === undefined) {
    if (shCache.size > 600) shCache.clear();
    r = shade(c, amt);
    shCache.set(k, r);
  }
  return r;
}

/** Recorta pelo caminho atual e pinta detalhes por dentro (nada no passe de silhueta). */
function inside(ctx: CanvasRenderingContext2D, f: () => void) {
  if (PS.F) return;
  ctx.save();
  ctx.clip();
  f();
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** Traços curvos: [x0, y0, cx, cy, x1, y1, ...] num só caminho. */
function curves(ctx: CanvasRenderingContext2D, col: string, alpha: number, w: number, q: readonly number[]) {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i + 5 < q.length; i += 6) {
    ctx.moveTo(q[i], q[i + 1]);
    ctx.quadraticCurveTo(q[i + 2], q[i + 3], q[i + 4], q[i + 5]);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** Sombra cel "por fora de um círculo": tudo o que fica fora de (cx, cy, r) escurece. */
function outerShade(ctx: CanvasRenderingContext2D, col: string, alpha: number, cx: number, cy: number, r: number) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = col;
  const m = r + 34;
  ctx.beginPath();
  ctx.rect(cx - m, cy - m, m * 2, m * 2);
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fill('evenodd');
  ctx.globalAlpha = 1;
}

/** Faixa de brilho partida (anel de luz do cabelo) ao longo de um arco. */
function shineBand(ctx: CanvasRenderingContext2D, c2: string, cx: number, cy: number, r: number, a0: number, a1: number, n: number, w = 3.4) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = c2;
  ctx.lineWidth = w;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  const step = (a1 - a0) / n;
  for (let i = 0; i < n; i++) {
    const a = a0 + step * i;
    const rr = r + (i % 2) * 1.6;
    ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    ctx.arc(cx, cy, rr, a, a + step * 0.62);
  }
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = w * 0.4;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  for (let i = 0; i < n; i += 2) {
    const a = a0 + step * i + step * 0.1;
    const rr = r + (i % 2) * 1.6;
    ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    ctx.arc(cx, cy, rr, a, a + step * 0.3);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** Contorno ondulado (tufos) à volta de um círculo. */
function puffPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, n: number, bump: number, ph = 0) {
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = ph + (i / n) * TAU;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else {
      const am = a - Math.PI / n;
      ctx.quadraticCurveTo(cx + Math.cos(am) * (r + bump * 2), cy + Math.sin(am) * (r + bump * 2), x, y);
    }
  }
  ctx.closePath();
}

/** Caracóis (textura do afro). */
function curls(ctx: CanvasRenderingContext2D, col: string, alpha: number, cx: number, cy: number, r: number, n: number, seed: number) {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = hash(seed + i) * TAU;
    const d = Math.sqrt(hash(seed + i + 50)) * r;
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d;
    const a0 = hash(seed + i + 90) * TAU;
    ctx.moveTo(x + Math.cos(a0) * 3, y + Math.sin(a0) * 3);
    ctx.arc(x, y, 3, a0, a0 + 3.6);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// ───────────────────────── Cabelo ─────────────────────────

function hairBack(ctx: CanvasRenderingContext2D, style: string, c1: string, c2: string, t: number) {
  ctx.lineJoin = 'round';
  const dark = sh(c1, -0.42);
  switch (style) {
    case 'afro':
      puffPath(ctx, -6, -10, 35, 15, 2.2, 0.2);
      ctx.fillStyle = C(c1);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = OC();
      ctx.stroke();
      inside(ctx, () => {
        outerShade(ctx, dark, 0.6, 2, -18, 33);
        curls(ctx, dark, 0.55, -8, -8, 32, 16, 3);
        curls(ctx, c2, 0.6, 2, -26, 16, 6, 40);
      });
      break;
    case 'longo': {
      const w = Math.sin(t * 3);
      ctx.beginPath();
      ctx.moveTo(-25, -14);
      ctx.quadraticCurveTo(-42 + w * 3, 22, -32 + w * 4, 48);
      ctx.quadraticCurveTo(-26 + w * 3, 44, -22 + w * 3, 49);
      ctx.quadraticCurveTo(-16 + w * 2, 42, -9, 42);
      ctx.lineTo(4, 10);
      ctx.closePath();
      ctx.fillStyle = C(c1);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = OC();
      ctx.stroke();
      inside(ctx, () => {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.ellipse(-8, 30, 16, 24, 0.2, 0, TAU);
        ctx.fill();
        curves(ctx, dark, 0.7, 1.6, [
          -24, -6, -36 + w * 2, 18, -30 + w * 4, 44,
          -18, -2, -26 + w, 22, -21 + w * 3, 45,
          -12, 4, -16, 24, -13 + w * 2, 40,
        ]);
        curves(ctx, c2, 0.7, 2.6, [-28, -6, -36 + w * 2, 10, -35 + w * 2, 24]);
      });
      break;
    }
    case 'mullet': {
      const w = Math.sin(t * 4) * 2;
      ctx.beginPath();
      ctx.moveTo(-24, -6);
      ctx.quadraticCurveTo(-35, 18, -26 + w, 35);
      ctx.quadraticCurveTo(-20 + w, 30, -16 + w, 34);
      ctx.quadraticCurveTo(-12, 28, -8, 27);
      ctx.lineTo(-6, 4);
      ctx.closePath();
      ctx.fillStyle = C(c1);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = OC();
      ctx.stroke();
      inside(ctx, () => {
        outerShade(ctx, dark, 0.45, -24, 6, 12);
        curves(ctx, dark, 0.7, 1.5, [-22, 0, -30, 18, -24 + w, 32, -15, 4, -20, 18, -17 + w, 30]);
      });
      break;
    }
    case 'rabo': {
      const sw = Math.sin(t * 4) * 6;
      ctx.beginPath();
      ctx.moveTo(-22, -16);
      ctx.quadraticCurveTo(-46, -8 + sw, -42 + sw, 22);
      ctx.quadraticCurveTo(-40 + sw, 30, -38 + sw, 30);
      ctx.quadraticCurveTo(-34 + sw * 0.6, 10, -14, -6);
      ctx.closePath();
      ctx.fillStyle = C(c1);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = OC();
      ctx.stroke();
      inside(ctx, () => {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.ellipse(-30 + sw * 0.5, 12, 6, 22, 0.2, 0, TAU);
        ctx.fill();
        curves(ctx, dark, 0.75, 1.5, [-24, -14, -40, -4 + sw, -40 + sw, 22, -22, -10, -34, 2 + sw, -36 + sw, 24]);
        curves(ctx, c2, 0.8, 2.4, [-26, -16, -40, -12 + sw, -42 + sw, 4]);
      });
      // elástico
      ctx.save();
      ctx.translate(-24, -13);
      ctx.rotate(-0.5);
      ctx.beginPath();
      ctx.roundRect(-4, -5.5, 8, 11, 3);
      ctx.fillStyle = C(c2 === c1 ? '#e3263b' : c2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = OC();
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'trancas':
      for (let i = 0; i < 4; i++) {
        const sw = Math.sin(t * 4 + i) * 5;
        const x0 = -12 - i * 5;
        const y0 = -20 + i * 5;
        const cx = x0 - 14;
        const ex = x0 - 8 + sw;
        const ey = 40 - i * 3;
        const col = i % 2 ? c2 : c1;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(cx, 10, ex, ey);
        ctx.lineWidth = 10;
        ctx.strokeStyle = OC();
        ctx.stroke();
        ctx.lineWidth = 6;
        ctx.strokeStyle = C(col);
        ctx.stroke();
        if (!PS.F) {
          // padrão entrançado: chevrons ao longo da trança
          ctx.strokeStyle = sh(col, -0.45);
          ctx.lineWidth = 1.3;
          ctx.globalAlpha = 0.85;
          ctx.beginPath();
          for (let k = 1; k < 8; k++) {
            const q = k / 8;
            const iq = 1 - q;
            const px = iq * iq * x0 + 2 * iq * q * cx + q * q * ex;
            const py = iq * iq * y0 + 2 * iq * q * 10 + q * q * ey;
            const tx = 2 * iq * (cx - x0) + 2 * q * (ex - cx);
            const ty = 2 * iq * (10 - y0) + 2 * q * (ey - 10);
            const l = Math.hypot(tx, ty) || 1;
            const ux = tx / l, uy = ty / l;
            ctx.moveTo(px - uy * 2.6 - ux * 1.5, py + ux * 2.6 - uy * 1.5);
            ctx.lineTo(px + ux * 1, py + uy * 1);
            ctx.lineTo(px + uy * 2.6 - ux * 1.5, py - ux * 2.6 - uy * 1.5);
          }
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        circle(ctx, ex, ey, 3.5, '#ffd23d');
      }
      break;
    case 'espetado':
    case 'super': {
      const big = style === 'super' ? 1.6 : 1;
      const n = 7;
      const tips: number[] = [];
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const a = Math.PI * 1.05 + (i / n) * Math.PI * 0.95;
        const r1 = 22;
        const r2 = (34 + (i % 2) * 6) * big;
        const am = a + 0.18;
        if (i === 0) ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1 - 4);
        const tx = Math.cos(am) * r2;
        const ty = Math.sin(am) * r2 - 4 + (style === 'super' ? Math.sin(t * 10 + i) * 1.5 : 0);
        ctx.lineTo(tx, ty);
        ctx.lineTo(Math.cos(a + 0.4) * r1, Math.sin(a + 0.4) * r1 - 4);
        tips.push(Math.cos(a + 0.2) * r1 * 0.7, Math.sin(a + 0.2) * r1 * 0.7 - 4, tx, ty);
      }
      ctx.closePath();
      ctx.fillStyle = C(c1);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = OC();
      ctx.stroke();
      inside(ctx, () => {
        outerShade(ctx, dark, 0.5, 8, -16, 30 * big);
        // aresta iluminada de cada espinho
        ctx.strokeStyle = c2;
        ctx.lineWidth = 2.2;
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        for (let i = 0; i < tips.length; i += 4) {
          const bx = tips[i], by = tips[i + 1], tx = tips[i + 2], ty = tips[i + 3];
          ctx.moveTo(bx + (tx - bx) * 0.35, by + (ty - by) * 0.35);
          ctx.lineTo(bx + (tx - bx) * 0.82, by + (ty - by) * 0.82);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
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
        ctx.fillStyle = PS.F ? '#fff' : '#ffd23d';
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
  // franja em madeixas curvas
  ctx.quadraticCurveTo(25, -10, 22, -8.5);
  ctx.quadraticCurveTo(20, -13, 16.5, -14);
  ctx.quadraticCurveTo(15, -10, 11, -9.5);
  ctx.quadraticCurveTo(9.5, -14, 5, -14);
  ctx.quadraticCurveTo(1.5, -11, -0.5, -5);
  // patilha curta à frente da orelha
  ctx.quadraticCurveTo(-1.5, -1, -2.5, 2);
  ctx.lineTo(-6, 1);
  // por cima da orelha até à nuca
  ctx.quadraticCurveTo(-11, -4, -17, -3);
  ctx.quadraticCurveTo(-23, -1, Math.cos(a0) * R + 3, Math.sin(a0) * R);
  ctx.closePath();
}

const CAP_STRANDS = [
  -4, -27, 13, -27, 21, -10,
  -6, -26, 7, -22, 13, -11,
  -8, -26, -1, -19, 4, -12,
  -10, -25, -11, -12, -3, -2,
  -12, -24, -19, -12, -15, -3,
  -14, -23, -26, -14, -25, 3,
];

/** Volume da calota: nuca escura, madeixas e anel de brilho. */
function capShade(ctx: CanvasRenderingContext2D, c1: string, c2: string) {
  const dark = sh(c1, -0.42);
  inside(ctx, () => {
    outerShade(ctx, dark, 0.55, 5, -7, HEAD_R + 1);
    curves(ctx, dark, 0.7, 1.6, CAP_STRANDS);
    shineBand(ctx, c2, 0, 0, HEAD_R - 5, -2.25, -0.95, 4);
  });
}

function hairFront(ctx: CanvasRenderingContext2D, style: string, c1: string, c2: string, t: number, hc: Vis) {
  ctx.lineJoin = 'round';
  const dark = sh(c1, -0.42);
  const fillStroke = (fill: string) => {
    ctx.fillStyle = C(fill);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = OC();
    ctx.stroke();
  };
  switch (style) {
    case 'careca':
      if (PS.F) return;
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(-3, -19, 9, 3.6, -0.3, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.ellipse(-6, -20, 2.6, 1.2, -0.3, 0, TAU);
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
    case 'chamas':
      capPath(ctx, style === 'curto' || style === 'espetado' || style === 'super' || style === 'chamas' ? 0 : 8);
      fillStroke(c1);
      capShade(ctx, c1, c2);
      if (style === 'rabo' || style === 'trancas') {
        // cabelo puxado para trás: madeixas a convergir para a nuca
        inside(ctx, () => curves(ctx, dark, 0.6, 1.4, [16, -20, -2, -26, -20, -14, 18, -14, 0, -18, -21, -9]));
      }
      break;
    case 'afro':
      for (let i = 0; i < 5; i++) {
        const x = -18 + i * 9;
        const y = -26 + Math.abs(i - 2) * 3;
        puffPath(ctx, x, y, 10, 7, 1.4, i);
        fillStroke(c1);
        inside(ctx, () => {
          outerShade(ctx, dark, 0.5, x + 2, y - 3, 9);
          ctx.globalAlpha = 0.6;
          ctx.fillStyle = c2;
          ctx.beginPath();
          ctx.ellipse(x - 1, y - 5, 3.5, 1.8, -0.4, 0, TAU);
          ctx.fill();
          ctx.globalAlpha = 1;
        });
      }
      break;
    case 'moicano': {
      // laterais rapadas (sombra de cabelo curto no crânio)
      if (!PS.F) {
        capPath(ctx, 0);
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = sh(c1, -0.2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      const tips: number[] = [];
      ctx.beginPath();
      ctx.moveTo(-22, -12);
      for (let i = 0; i < 6; i++) {
        const a = Math.PI * 1.15 + (i / 5) * Math.PI * 0.6;
        const r = 40 + (i % 2) * 4;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        tips.push(Math.cos(a + 0.06) * 24, Math.sin(a + 0.06) * 24, Math.cos(a) * r, Math.sin(a) * r);
        const a2 = a + 0.13;
        ctx.lineTo(Math.cos(a2) * 26, Math.sin(a2) * 26);
      }
      ctx.lineTo(16, -18);
      ctx.closePath();
      fillStroke(c1);
      inside(ctx, () => {
        outerShade(ctx, dark, 0.5, 6, -14, 26);
        ctx.strokeStyle = c2;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        for (let i = 0; i < tips.length; i += 4) {
          const bx = tips[i], by = tips[i + 1], tx = tips[i + 2], ty = tips[i + 3];
          ctx.moveTo(bx + (tx - bx) * 0.2, by + (ty - by) * 0.2);
          ctx.lineTo(bx + (tx - bx) * 0.75, by + (ty - by) * 0.75);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
      break;
    }
    case 'topete':
      capPath(ctx, 0);
      fillStroke(c1);
      capShade(ctx, c1, c2);
      ctx.beginPath();
      ctx.moveTo(-6, -28);
      ctx.bezierCurveTo(10, -50, 44, -44, 36, -22);
      ctx.quadraticCurveTo(24, -30, 8, -22);
      ctx.closePath();
      fillStroke(c1);
      inside(ctx, () => {
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.ellipse(22, -22, 16, 6, -0.1, 0, TAU);
        ctx.fill();
        curves(ctx, dark, 0.7, 1.5, [-2, -30, 14, -44, 34, -34, 2, -27, 18, -38, 33, -27]);
        curves(ctx, c2, 0.85, 3, [4, -36, 16, -46, 30, -40]);
        curves(ctx, '#ffffff', 0.55, 1.3, [8, -39, 15, -44, 22, -43]);
      });
      break;
    case 'samurai':
      ctx.beginPath();
      ctx.moveTo(-27, 2);
      ctx.bezierCurveTo(-30, -28, 0, -36, 18, -26);
      ctx.quadraticCurveTo(10, -24, -2, -22);
      ctx.quadraticCurveTo(-18, -14, -22, 8);
      ctx.closePath();
      fillStroke(c1);
      inside(ctx, () => {
        curves(ctx, dark, 0.7, 1.5, [-25, 0, -24, -24, 12, -28, -23, -4, -18, -20, 4, -25]);
        curves(ctx, c2, 0.85, 2.6, [-22, -16, -14, -28, 2, -30]);
      });
      ctx.beginPath();
      ctx.ellipse(-12, -34, 7, 10, -0.5, 0, TAU);
      fillStroke(c1);
      inside(ctx, () => {
        outerShade(ctx, dark, 0.5, -14, -37, 8);
        curves(ctx, c2, 0.8, 2, [-16, -38, -14, -43, -9, -41]);
      });
      seg(ctx, -14, -26, -10, -28, 4, '#d22', false);
      break;
    case 'coroa': {
      capPath(ctx, 0);
      fillStroke(c1);
      capShade(ctx, c1, c2);
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
      ctx.strokeStyle = PS.F ? '#fff' : '#ffe27a';
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
  }
}

/** Sombra que a franja projeta na testa (dá espessura ao cabelo). */
function capCastShadow(ctx: CanvasRenderingContext2D, L: Look, style: string) {
  if (PS.F) return;
  const cap = style === 'curto' || style === 'rabo' || style === 'longo' || style === 'trancas' || style === 'mullet' || style === 'espetado'
    || style === 'super' || style === 'cometa' || style === 'chamas' || style === 'topete' || style === 'coroa';
  if (!cap) return;
  ctx.save();
  headPath(ctx);
  ctx.clip();
  ctx.translate(1.2, 3.2);
  capPath(ctx, 0);
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = L.skinShade;
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ───────────────────────── Cara ─────────────────────────

/** Contorno amendoado do olho. */
function eyePath(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath();
  ctx.moveTo(x - rx, y + ry * 0.12);
  ctx.bezierCurveTo(x - rx * 0.62, y - ry * 1.2, x + rx * 0.6, y - ry * 1.2, x + rx, y);
  ctx.bezierCurveTo(x + rx * 0.58, y + ry * 1.12, x - rx * 0.58, y + ry * 1.12, x - rx, y + ry * 0.12);
  ctx.closePath();
}

export function eye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, L: Look, expr: Expr, skin: string, power: boolean) {
  // lado do canto interior (para o nariz): o olho mais perto (x < 12) tem-no à direita
  const inner = x < 12 ? 1 : -1;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (expr === 'ko') {
    // espiral de tonto
    ctx.strokeStyle = OC();
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 26; i++) {
      const a = (i / 26) * Math.PI * 4.2;
      const rr = 0.6 + (i / 26) * r * 1.05;
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.stroke();
    return;
  }
  if (expr === 'hurt') {
    // olho espremido em ">" com a ponta para o canto interior
    ctx.strokeStyle = OC();
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(x - inner * r, y - r * 0.85);
    ctx.quadraticCurveTo(x, y - r * 0.2, x + inner * r * 0.7, y);
    ctx.quadraticCurveTo(x, y + r * 0.2, x - inner * r, y + r * 0.75);
    ctx.stroke();
    return;
  }
  if (expr === 'happy') {
    // olhos fechados a sorrir
    ctx.strokeStyle = OC();
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(x - r * 1.05, y + r * 0.35);
    ctx.quadraticCurveTo(x, y - r * 1.15, x + r * 1.05, y + r * 0.35);
    ctx.stroke();
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x - inner * r * 1.0, y + r * 0.2);
    ctx.lineTo(x - inner * r * 1.45, y - r * 0.05);
    ctx.stroke();
    return;
  }
  let ry = r * 1.15;
  let rx = r * 1.05;
  if (L.eyes === 'grandes') {
    rx *= 1.25;
    ry *= 1.3;
  } else if (L.eyes === 'estreitos') ry *= 0.55;
  eyePath(ctx, x, y, rx, ry);
  ctx.fillStyle = C(power ? '#fffbe0' : '#fbf7f0');
  ctx.fill();
  if (power) {
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = OC();
    ctx.stroke();
    if (PS.F) return;
    const prev = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(glowSprite('#ffe27a'), x - 14, y - 14, 28, 28);
    ctx.globalCompositeOperation = prev;
    return;
  }
  if (!PS.F) {
    ctx.save();
    ctx.clip();
    const pr = rx * 0.66;
    const ix = x + inner * rx * 0.18;
    const iy = y + ry * 0.06;
    // sombra da pálpebra no branco do olho
    ctx.fillStyle = '#5a4a5a';
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.ellipse(x, y - ry * 1.05, rx * 1.3, ry * 0.6, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    // íris: anel escuro, centro e reflexo inferior mais claro
    ctx.fillStyle = sh(L.eyeColor, -0.45);
    ctx.beginPath();
    ctx.arc(ix, iy, pr, 0, TAU);
    ctx.fill();
    ctx.fillStyle = L.eyeColor;
    ctx.beginPath();
    ctx.arc(ix, iy, pr * 0.8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = sh(L.eyeColor, 0.4);
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.ellipse(ix, iy + pr * 0.42, pr * 0.55, pr * 0.3, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0d0a10';
    ctx.beginPath();
    ctx.arc(ix, iy, pr * 0.42, 0, TAU);
    ctx.fill();
    // pálpebra superior faz sombra também na íris
    ctx.fillStyle = '#000';
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.ellipse(x, y - ry * 1.15, rx * 1.4, ry * 0.62, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ix - pr * 0.36, iy - pr * 0.4, pr * 0.32, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(ix + pr * 0.38, iy + pr * 0.34, pr * 0.14, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  // pálpebras (por expressão / estilo)
  let lid = 0;
  let slant = 0;
  if (L.eyes === 'determinado') lid = 0.34;
  if (expr === 'angry') {
    lid = Math.max(lid, 0.3);
    slant = 0.45;
  }
  if (L.eyes === 'sonolento') lid = 0.52;
  if (lid > 0) {
    const yo = y - ry + ry * 2.1 * lid - inner * slant * ry * 0.5;
    const yi = y - ry + ry * 2.1 * lid + inner * slant * ry * 0.5;
    const xl = x - rx - 1;
    const xr = x + rx + 1;
    ctx.save();
    eyePath(ctx, x, y, rx + 0.6, ry + 0.6);
    ctx.clip();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.moveTo(xl, y - ry - 3);
    ctx.lineTo(xr, y - ry - 3);
    ctx.lineTo(xr, inner > 0 ? yi : yo);
    ctx.lineTo(xl, inner > 0 ? yo : yi);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = OC();
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(x - rx, inner > 0 ? yo : yi);
    ctx.lineTo(x + rx, inner > 0 ? yi : yo);
    ctx.stroke();
  }
  // linha das pestanas (grossa em cima, fina em baixo)
  ctx.strokeStyle = OC();
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(x - rx, y + ry * 0.12);
  ctx.bezierCurveTo(x - rx * 0.62, y - ry * 1.2, x + rx * 0.6, y - ry * 1.2, x + rx, y);
  // pestana no canto exterior
  const ox = x - inner * rx;
  const oy = inner > 0 ? y + ry * 0.12 : y;
  ctx.moveTo(ox + inner * 0.5, oy - 0.4);
  ctx.lineTo(ox - inner * 2.2, oy - ry * 0.45);
  ctx.stroke();
  ctx.lineWidth = 1.3;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.moveTo(x + rx, y);
  ctx.bezierCurveTo(x + rx * 0.58, y + ry * 1.12, x - rx * 0.58, y + ry * 1.12, x - rx, y + ry * 0.12);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** Sobrancelha afunilada (grossa no lado do nariz). */
function brow(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, th: number, col: string) {
  // (x1, y1) = ponta interior (grossa)
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l = Math.hypot(dx, dy) || 1;
  const nx = dy / l;
  const ny = -dx / l;
  const s = ny < 0 ? 1 : -1; // normal a apontar para cima
  const ux = nx * s;
  const uy = ny * s;
  const mx = (x0 + x1) / 2 + ux * 1.6;
  const my = (y0 + y1) / 2 + uy * 1.6;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(mx + ux * th * 0.5, my + uy * th * 0.5, x1 + ux * th * 0.5, y1 + uy * th * 0.5);
  ctx.lineTo(x1 - ux * th * 0.5, y1 - uy * th * 0.5);
  ctx.quadraticCurveTo(mx - ux * th * 0.3, my - uy * th * 0.3, x0, y0);
  ctx.closePath();
  ctx.fillStyle = col;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = col;
  ctx.stroke();
}

function drawFace(ctx: CanvasRenderingContext2D, L: Look, expr: Expr, t: number, hairC: string, hairC2: string) {
  const skin = C(L.skin);
  const power = expr === 'power';
  const shadeC = L.skinShade;
  // orelha (lado do crânio, atrás da patilha)
  ctx.beginPath();
  ctx.ellipse(-10.5, 5.5, 4.8, 7, 0.22, 0, TAU);
  ctx.fillStyle = skin;
  ctx.fill();
  ctx.lineWidth = 2.1;
  ctx.strokeStyle = OC();
  ctx.stroke();
  if (!PS.F) {
    // hélice em "C" aberta para a frente + concha
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = shadeC;
    ctx.beginPath();
    ctx.moveTo(-9, 1.8);
    ctx.quadraticCurveTo(-13.4, 2.4, -12.4, 6.5);
    ctx.quadraticCurveTo(-11.8, 9.6, -9.4, 9.4);
    ctx.quadraticCurveTo(-11, 6, -9, 1.8);
    ctx.fill();
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.ellipse(-9.6, 6, 1.4, 2, 0.2, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-13, 2.5, 1, 2, 0.3, 0, TAU);
    ctx.fill();
    // rubor nas maçãs do rosto
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#ff5a6a';
    ctx.beginPath();
    ctx.ellipse(9, 9.5, 5.5, 3.2, 0, 0, TAU);
    ctx.fill();
    // sombra da órbita por baixo da sobrancelha
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = shadeC;
    ctx.beginPath();
    ctx.ellipse(12, -5.5, 12, 3.4, 0.05, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  const blink = expr === 'normal' && t % 3.7 < 0.11;
  if (blink) {
    ctx.strokeStyle = OC();
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(1, 0);
    ctx.quadraticCurveTo(6, 2, 11, 0);
    ctx.moveTo(15, -0.5);
    ctx.quadraticCurveTo(19, 1.5, 23, -0.5);
    ctx.stroke();
  } else {
    eye(ctx, 6, -1, 5, L, expr, skin, power);
    eye(ctx, 19, -1.5, 4.2, L, expr, skin, power);
  }

  // sobrancelhas
  if (L.brows !== 'nenhuma' && expr !== 'ko' && !PS.F) {
    const thick = L.brows === 'grossas' ? 4.8 : L.brows === 'finas' ? 2 : 3.4;
    const ang = L.brows === 'zangadas' || expr === 'angry' || expr === 'power' ? 0.38 : expr === 'hurt' ? -0.35 : expr === 'happy' ? -0.12 : 0.04;
    const by = (L.eyes === 'grandes' ? -11.5 : -9.5) + (expr === 'happy' ? -1 : 0);
    brow(ctx, 0, by - ang * 4, 11.5, by + ang * 6, thick, hairC);
    brow(ctx, 23.5, by - 0.5 - ang * 3, 15, by - 0.5 + ang * 5, thick * 0.85, hairC);
  }

  // nariz (dentro do contorno da cara, vista 3/4)
  if (!PS.F) {
    // sombra lateral da cana do nariz
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = shadeC;
    ctx.beginPath();
    ctx.moveTo(16.5, -2);
    ctx.quadraticCurveTo(19.5, 4, 17.5, 11.5);
    ctx.lineTo(15.5, 11);
    ctx.quadraticCurveTo(17, 4, 16.5, -2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.beginPath();
  ctx.moveTo(19.5, 2.5);
  ctx.quadraticCurveTo(27.5, 9.5, 23, 13.2);
  ctx.quadraticCurveTo(20, 14.8, 16.8, 12.2);
  ctx.quadraticCurveTo(18.6, 8, 19.5, 2.5);
  ctx.fillStyle = PS.F ? C('#fff') : skin;
  ctx.fill();
  if (!PS.F) {
    ctx.save();
    ctx.clip();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = shadeC;
    ctx.beginPath();
    ctx.ellipse(20.5, 14.2, 6.5, 2.8, -0.15, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(23, 8.4, 1.7, 1.1, -0.5, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = sh(shadeC, -0.45);
    ctx.beginPath();
    ctx.ellipse(19.6, 12.4, 1.7, 0.9, -0.35, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.lineWidth = 1.9;
  ctx.strokeStyle = OC();
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(22.6, 6);
  ctx.quadraticCurveTo(27.5, 9.5, 23, 13.2);
  ctx.quadraticCurveTo(20, 14.8, 16.8, 12.2);
  ctx.stroke();

  // boca
  const mouth = expr === 'hurt' || expr === 'ko' ? 'ai' : expr === 'angry' || expr === 'power' ? 'dentes' : expr === 'happy' ? 'grito' : L.mouth;
  const lipShade = (x0: number, x1: number, y: number) => {
    if (PS.F) return;
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = shadeC;
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.quadraticCurveTo((x0 + x1) / 2, y + 1.4, x1, y - 0.3);
    ctx.stroke();
    ctx.globalAlpha = 1;
  };
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = OC();
  switch (mouth) {
    case 'sorriso':
      ctx.beginPath();
      ctx.moveTo(7.5, 15.4);
      ctx.quadraticCurveTo(13, 20.8, 19.2, 15);
      ctx.moveTo(6.8, 14.4);
      ctx.lineTo(8, 16.2);
      ctx.stroke();
      lipShade(10.5, 15.5, 20.6);
      if (!PS.F) {
        // prega da bochecha
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = shadeC;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(6, 10.5);
        ctx.quadraticCurveTo(4.6, 13.5, 5.8, 16.5);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      break;
    case 'serio':
      ctx.beginPath();
      ctx.moveTo(8.5, 18.8);
      ctx.quadraticCurveTo(13.5, 17.6, 18.6, 18.4);
      ctx.stroke();
      lipShade(10.5, 16, 21);
      break;
    case 'maroto':
      ctx.beginPath();
      ctx.moveTo(8, 19.2);
      ctx.quadraticCurveTo(14, 20.4, 19, 15.6);
      ctx.moveTo(18.6, 14.4);
      ctx.lineTo(19.8, 16.2);
      ctx.stroke();
      lipShade(10.5, 15, 21.4);
      break;
    case 'dentes': {
      ctx.beginPath();
      ctx.moveTo(7, 16.2);
      ctx.quadraticCurveTo(13, 14.6, 19.6, 15.6);
      ctx.lineTo(19.2, 20.6);
      ctx.quadraticCurveTo(13, 22.6, 7.4, 21.2);
      ctx.closePath();
      ctx.fillStyle = C('#fbf7ee');
      ctx.fill();
      inside(ctx, () => {
        ctx.fillStyle = '#3a0f18';
        ctx.globalAlpha = 0.85;
        ctx.fillRect(6, 13, 2.2, 10);
        ctx.fillRect(18.2, 13, 2.2, 10);
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#000';
        ctx.fillRect(6, 13, 16, 2.6);
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = OC();
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(7, 18.6);
        ctx.quadraticCurveTo(13, 19.4, 20, 18.2);
        for (const xx of [10.5, 13.4, 16.2]) {
          ctx.moveTo(xx, 15.4);
          ctx.lineTo(xx + 0.2, 21.6);
        }
        ctx.stroke();
      });
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = OC();
      ctx.beginPath();
      ctx.moveTo(7, 16.2);
      ctx.quadraticCurveTo(13, 14.6, 19.6, 15.6);
      ctx.lineTo(19.2, 20.6);
      ctx.quadraticCurveTo(13, 22.6, 7.4, 21.2);
      ctx.closePath();
      ctx.stroke();
      lipShade(10, 16, 23.4);
      break;
    }
    case 'grito': {
      ctx.beginPath();
      ctx.moveTo(7, 15.4);
      ctx.quadraticCurveTo(13.5, 14.2, 20, 15);
      ctx.quadraticCurveTo(19.8, 25.5, 13.5, 25.4);
      ctx.quadraticCurveTo(7.4, 24.8, 7, 15.4);
      ctx.closePath();
      ctx.fillStyle = C('#4a0f1c');
      ctx.fill();
      inside(ctx, () => {
        ctx.fillStyle = '#fbf7ee';
        ctx.fillRect(5, 13, 17, 3.6);
        ctx.fillStyle = '#ff6a7a';
        ctx.beginPath();
        ctx.ellipse(13.8, 24.4, 5, 3, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.ellipse(12.6, 22.6, 1.6, 0.8, 0, 0, TAU);
        ctx.fill();
      });
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = OC();
      ctx.beginPath();
      ctx.moveTo(7, 15.4);
      ctx.quadraticCurveTo(13.5, 14.2, 20, 15);
      ctx.quadraticCurveTo(19.8, 25.5, 13.5, 25.4);
      ctx.quadraticCurveTo(7.4, 24.8, 7, 15.4);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case 'ai':
      ctx.beginPath();
      ctx.moveTo(8, 18);
      ctx.quadraticCurveTo(13.5, 15, 19, 16.6);
      ctx.quadraticCurveTo(18.5, 20.4, 13.5, 20.6);
      ctx.quadraticCurveTo(9.5, 20.6, 8, 18);
      ctx.closePath();
      ctx.fillStyle = C('#fbf7ee');
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(9, 18.3);
      ctx.lineTo(11, 17);
      ctx.lineTo(13, 18.6);
      ctx.lineTo(15, 17);
      ctx.lineTo(17, 18.4);
      ctx.lineTo(18.6, 17.4);
      ctx.stroke();
      break;
  }

  // barba
  if (L.beard !== 'nenhuma') {
    const dark = sh(hairC, -0.4);
    ctx.fillStyle = hairC;
    switch (L.beard) {
      case 'curta':
        // barba de 3 dias: tom difuso + pontos de pelo
        ctx.beginPath();
        ctx.moveTo(-4, 12);
        ctx.quadraticCurveTo(0, 28, 12, 29);
        ctx.quadraticCurveTo(21, 28, 23, 19);
        ctx.quadraticCurveTo(17, 22, 13, 19.5);
        ctx.quadraticCurveTo(5, 19, -4, 12);
        ctx.globalAlpha = 0.32;
        ctx.fill();
        ctx.globalAlpha = 1;
        inside(ctx, () => {
          ctx.fillStyle = hairC;
          ctx.globalAlpha = 0.55;
          for (let i = 0; i < 46; i++) {
            const px = -4 + hash(i * 3.1) * 28;
            const py = 12 + hash(i * 7.3 + 1) * 18;
            ctx.fillRect(px, py, 1.1, 1.1);
          }
          ctx.globalAlpha = 1;
        });
        break;
      case 'bigode':
        ctx.beginPath();
        ctx.moveTo(7, 15);
        ctx.quadraticCurveTo(14, 11, 21, 14.3);
        ctx.quadraticCurveTo(23.5, 18, 19, 16.8);
        ctx.quadraticCurveTo(14, 14.6, 9, 17.2);
        ctx.quadraticCurveTo(5, 17.8, 7, 15);
        ctx.fill();
        inside(ctx, () => {
          curves(ctx, dark, 0.8, 1.1, [9, 15.6, 11, 14.4, 12, 13, 13, 15.4, 15, 13.6, 16, 12.6, 17, 15.6, 19, 14.4, 20.5, 14]);
          curves(ctx, hairC2, 0.8, 1.2, [9, 14.2, 13, 12.4, 18, 13]);
        });
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = OC();
        ctx.stroke();
        break;
      case 'cavanhaque':
        ctx.beginPath();
        ctx.moveTo(9, 22);
        ctx.quadraticCurveTo(14, 33, 19.5, 22);
        ctx.quadraticCurveTo(14, 24.5, 9, 22);
        ctx.fill();
        inside(ctx, () => curves(ctx, dark, 0.8, 1.1, [11, 23, 13, 27, 14, 30, 16, 23, 16, 27, 15, 30]));
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = OC();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8, 15);
        ctx.quadraticCurveTo(14, 11.6, 20, 14.4);
        ctx.lineTo(19.5, 16.4);
        ctx.quadraticCurveTo(14, 14.6, 8.5, 16.9);
        ctx.closePath();
        ctx.fillStyle = hairC;
        ctx.fill();
        ctx.stroke();
        break;
      case 'grande':
        ctx.beginPath();
        ctx.moveTo(-5, 8);
        ctx.quadraticCurveTo(-4, 34, 13, 38);
        ctx.quadraticCurveTo(27, 33, 24, 13);
        ctx.quadraticCurveTo(16, 18, 14.5, 18);
        ctx.quadraticCurveTo(8, 18, 5, 12);
        ctx.quadraticCurveTo(0, 13, -5, 8);
        ctx.fill();
        inside(ctx, () => {
          outerShade(ctx, dark, 0.55, 12, 14, 18);
          curves(ctx, dark, 0.75, 1.5, [
            -2, 12, -1, 26, 8, 34,
            3, 16, 5, 28, 12, 35,
            10, 21, 11, 30, 15, 36,
            17, 20, 20, 28, 18, 34,
            22, 16, 24, 24, 21, 31,
          ]);
          curves(ctx, hairC2, 0.85, 2, [0, 14, 1, 22, 6, 28, 18, 19, 21, 22, 22, 27]);
        });
        ctx.lineWidth = 2;
        ctx.strokeStyle = OC();
        ctx.stroke();
        break;
    }
  }
}

function drawMask(ctx: CanvasRenderingContext2D, m: Vis, L: Look, expr: Expr, t: number) {
  const c1 = m.c1 ?? '#2222ff';
  const c2 = m.c2 ?? '#ffffff';
  const R = HEAD_R;
  /** Brilho aditivo (só fora do passe de silhueta). */
  const glow = (f: () => void) => {
    if (PS.F) return;
    const prev = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    f();
    ctx.globalCompositeOperation = prev;
    ctx.globalAlpha = 1;
  };
  switch (m.style) {
    case 'luchador': {
      // capuz de vinil/lycra: cel shading, brilho envernizado, debruns, emblema e atacadores
      const skull = () => {
        ctx.beginPath();
        ctx.arc(0, 0, R + 1, 0, TAU);
      };
      skull();
      ctx.fillStyle = C(c1);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = OC();
      ctx.stroke();
      if (!PS.F) {
        ctx.save();
        skull();
        ctx.clip();
        // sombra própria (atrás/baixo) e reflexo
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = shade(c1, -0.45);
        ctx.beginPath();
        ctx.rect(-R * 2, -R * 2, R * 4, R * 4);
        ctx.moveTo(8 + R * 1.05, -5);
        ctx.arc(8, -5, R * 1.05, 0, TAU);
        ctx.fill('evenodd');
        // painéis laterais a contrastar (como as máscaras de lucha)
        ctx.globalAlpha = 1;
        ctx.fillStyle = c2;
        ctx.beginPath();
        ctx.moveTo(-6, -R - 2);
        ctx.quadraticCurveTo(-2, -12, -12, 2);
        ctx.quadraticCurveTo(-18, 14, -14, R);
        ctx.lineTo(-19, R);
        ctx.quadraticCurveTo(-24, 10, -17, -2);
        ctx.quadraticCurveTo(-10, -14, -12, -R);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = OC();
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // costura central (risca) pespontada
        ctx.strokeStyle = c2;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.arc(0, 0, R - 6, Math.PI * 1.2, Math.PI * 1.75);
        ctx.stroke();
        ctx.setLineDash([1.8, 2.2]);
        ctx.strokeStyle = shade(c1, -0.5);
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.arc(0, 0, R - 3.6, Math.PI * 1.2, Math.PI * 1.75);
        ctx.arc(0, 0, R - 8.4, Math.PI * 1.75, Math.PI * 1.2, true);
        ctx.stroke();
        ctx.setLineDash([]);
        // brilho envernizado
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(2, 2, R - 4, -2.0, -1.25);
        ctx.stroke();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(16, -18, 2.6, 1.3, -0.6, 0, TAU);
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
        // atacadores na nuca
        ctx.strokeStyle = c2;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const y = 2 + i * 5;
          ctx.moveTo(-25, y);
          ctx.lineTo(-21, y + 4);
          ctx.moveTo(-21, y);
          ctx.lineTo(-25, y + 4);
        }
        ctx.stroke();
      }
      // debruns dos olhos (chama estilizada) com contorno
      for (const [x, y, r] of [[6, -1, 9], [19, -1.5, 7.5]] as const) {
        ctx.beginPath();
        ctx.moveTo(x - r - 1.5, y + 0.5);
        ctx.quadraticCurveTo(x - r * 0.4, y - r * 1.9, x + r + 2, y - r * 0.7);
        ctx.quadraticCurveTo(x + r * 0.6, y - r * 0.2, x + r, y - 1);
        ctx.quadraticCurveTo(x, y + r * 1.1, x - r - 1.5, y + 0.5);
        ctx.closePath();
        ctx.fillStyle = C(c2);
        ctx.fill();
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = OC();
        ctx.stroke();
      }
      // emblema na testa
      ctx.beginPath();
      ctx.moveTo(13, -25);
      ctx.lineTo(18, -18);
      ctx.lineTo(13, -11.5);
      ctx.lineTo(8, -18);
      ctx.closePath();
      ctx.fillStyle = C(c2);
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = OC();
      ctx.stroke();
      if (!PS.F) {
        ctx.fillStyle = c1;
        ctx.beginPath();
        ctx.arc(13, -18, 2.2, 0, TAU);
        ctx.fill();
      }
      // boca aberta com debrum
      ctx.beginPath();
      ctx.ellipse(15, 13, 9.2, 7.2, 0, 0, TAU);
      ctx.fillStyle = C(c2);
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = OC();
      ctx.stroke();
      ctx.fillStyle = C(L.skin);
      ctx.beginPath();
      ctx.ellipse(15, 13, 7.4, 5.5, 0, 0, TAU);
      ctx.fill();
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
      // pintura de caveira: osso com sombreado, órbitas fundas, nariz, dentes e fendas
      ctx.globalAlpha = PS.F ? 1 : 0.94;
      ctx.fillStyle = C(c1);
      ctx.beginPath();
      ctx.moveTo(-2, -16);
      ctx.bezierCurveTo(2, -26, 26, -26, 29, -8);
      ctx.bezierCurveTo(30, 2, 26, 8, 25, 12);
      ctx.lineTo(25, 20);
      ctx.quadraticCurveTo(15, 25, 6, 20);
      ctx.lineTo(5, 12);
      ctx.bezierCurveTo(-4, 8, -6, -6, -2, -16);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      if (PS.F) break;
      ctx.save();
      ctx.clip();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#7a8090';
      ctx.beginPath();
      ctx.ellipse(2, 10, 14, 16, 0.3, 0, TAU);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
      // órbitas com gradiente (fundas)
      for (const [x, y, r] of [[6, -1, 7.2], [19, -1.5, 6.2]] as const) {
        const g = ctx.createRadialGradient(x + 1, y + 1, 0, x, y, r);
        g.addColorStop(0, '#000000');
        g.addColorStop(0.7, c2);
        g.addColorStop(1, shade(c2.length === 7 ? c2 : '#111111', 0.25));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x - r, y);
        ctx.quadraticCurveTo(x - r, y - r * 1.15, x + r * 0.2, y - r);
        ctx.quadraticCurveTo(x + r * 1.1, y - r * 0.6, x + r, y + r * 0.3);
        ctx.quadraticCurveTo(x, y + r * 1.25, x - r, y);
        ctx.fill();
      }
      // nariz em coração invertido
      ctx.fillStyle = c2;
      ctx.beginPath();
      ctx.moveTo(25.5, 4);
      ctx.quadraticCurveTo(29, 7, 26.5, 9.5);
      ctx.lineTo(22.5, 9);
      ctx.quadraticCurveTo(22, 6, 25.5, 4);
      ctx.fill();
      // dentes
      ctx.strokeStyle = c2;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(7, 15);
      ctx.quadraticCurveTo(15, 17, 24, 14.5);
      for (let i = 0; i < 6; i++) {
        const x = 8.5 + i * 2.8;
        ctx.moveTo(x, 12.5);
        ctx.lineTo(x + 0.2, 18.5);
      }
      ctx.stroke();
      // fendas no osso
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(10, -17);
      ctx.lineTo(12, -12);
      ctx.lineTo(10, -9);
      ctx.moveTo(12, -12);
      ctx.lineTo(15, -13);
      ctx.stroke();
      // brilho do osso
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(18, -16, 5, 1.8, -0.3, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      if (expr !== 'ko') {
        glow(() => {
          const p = 0.75 + Math.sin(t * 4) * 0.25;
          ctx.globalAlpha = p;
          ctx.drawImage(glowSprite('#ff3030'), 0, -7, 13, 13);
          ctx.drawImage(glowSprite('#ff3030'), 14, -7, 11, 11);
          ctx.fillStyle = '#ffd0c0';
          ctx.beginPath();
          ctx.arc(7, -1, 1.5, 0, TAU);
          ctx.arc(20, -1.5, 1.2, 0, TAU);
          ctx.fill();
        });
      }
      break;
    }
    case 'demonio': {
      // meia-máscara oni lacada: chifres estriados, sobrancelhas esculpidas e olhos em brasa
      for (const [x, d] of [[0, -1], [16, 1]] as const) {
        ctx.beginPath();
        ctx.moveTo(x - 5, -20);
        ctx.quadraticCurveTo(x + d * 4, -46, x + d * 12, -49);
        ctx.quadraticCurveTo(x + 2, -36, x + 5.5, -20);
        ctx.closePath();
        ctx.fillStyle = C('#f2e6d0');
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = OC();
        ctx.stroke();
        if (!PS.F) {
          ctx.save();
          ctx.clip();
          ctx.fillStyle = '#b8a888';
          ctx.beginPath();
          ctx.ellipse(x - 4 + d * 3, -30, 4, 14, d * 0.3, 0, TAU);
          ctx.fill();
          ctx.strokeStyle = '#8a7a60';
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          for (let i = 0; i < 4; i++) {
            const y = -24 - i * 5.5;
            ctx.moveTo(x - 6 + d * i * 1.4, y + 1);
            ctx.lineTo(x + 6 + d * i * 1.4, y - 1);
          }
          ctx.stroke();
          ctx.restore();
        }
      }
      ctx.beginPath();
      ctx.moveTo(-6, -12);
      ctx.quadraticCurveTo(4, -21, 12, -13);
      ctx.quadraticCurveTo(20, -21, 31, -7);
      ctx.lineTo(30, 6);
      ctx.quadraticCurveTo(24, 3, 21, 8);
      ctx.quadraticCurveTo(14, 2, 8, 8);
      ctx.quadraticCurveTo(2, 3, -6, 6);
      ctx.closePath();
      ctx.fillStyle = C(c1);
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = OC();
      ctx.stroke();
      if (!PS.F) {
        ctx.save();
        ctx.clip();
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = shade(c1, -0.5);
        ctx.beginPath();
        ctx.ellipse(4, 8, 16, 7, 0, 0, TAU);
        ctx.fill();
        // laca: brilho
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-1, -12);
        ctx.quadraticCurveTo(5, -17, 10, -13);
        ctx.moveTo(15, -14);
        ctx.quadraticCurveTo(21, -17, 27, -9);
        ctx.stroke();
        // filigrana dourada
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = c2;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(12, -12);
        ctx.quadraticCurveTo(12.5, -6, 12, 4);
        ctx.moveTo(-4, 3);
        ctx.quadraticCurveTo(0, -3, 2, 2);
        ctx.moveTo(28, 3);
        ctx.quadraticCurveTo(25, -3, 23, 3);
        ctx.stroke();
        ctx.restore();
        ctx.globalAlpha = 1;
      }
      glow(() => {
        const g = glowSprite(c2);
        const fl = 0.8 + Math.sin(t * 6) * 0.15 + Math.sin(t * 17) * 0.05;
        ctx.globalAlpha = 0.6 * fl;
        ctx.drawImage(g, -2, -9, 16, 16);
        ctx.drawImage(g, 12, -9, 14, 14);
        ctx.globalAlpha = 0.45 * fl;
        // fumo de brasa a subir dos olhos
        for (let i = 0; i < 2; i++) {
          const ph = (t * 0.9 + i * 0.5) % 1;
          ctx.drawImage(g, (i ? 17 : 4) + Math.sin(t * 3 + i) * 2 - 4, -6 - ph * 20, 8 - ph * 4, 8 - ph * 4);
        }
      });
      ctx.fillStyle = C(c2);
      ctx.beginPath();
      ctx.moveTo(1, -1);
      ctx.quadraticCurveTo(6, -4.5, 11, -2.5);
      ctx.quadraticCurveTo(6, 1.5, 1, -1);
      ctx.moveTo(15, -2.5);
      ctx.quadraticCurveTo(19.5, -5, 23.5, -1.5);
      ctx.quadraticCurveTo(19, 1, 15, -2.5);
      ctx.fill();
      if (!PS.F) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(5.5, -2.6, 2, 1.4);
        ctx.fillRect(19, -2.8, 1.6, 1.3);
      }
      break;
    }
    case 'cyber': {
      // visor envolvente: armação metálica, vidro com reflexos, linha de varrimento e módulo lateral
      ctx.beginPath();
      ctx.moveTo(-10, -10);
      ctx.lineTo(29, -10);
      ctx.quadraticCurveTo(33, -3, 30, 6);
      ctx.lineTo(-10, 6);
      ctx.closePath();
      ctx.fillStyle = C(c1);
      ctx.fill();
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = OC();
      ctx.stroke();
      // vidro
      ctx.beginPath();
      ctx.moveTo(-2, -6.5);
      ctx.lineTo(28, -6.5);
      ctx.quadraticCurveTo(30.5, -2, 28.5, 3);
      ctx.lineTo(-2, 3);
      ctx.closePath();
      if (PS.F) {
        ctx.fillStyle = C(c2);
        ctx.fill();
        break;
      }
      const gl = ctx.createLinearGradient(0, -6.5, 0, 3);
      gl.addColorStop(0, shade(c2, -0.35));
      gl.addColorStop(0.5, shade(c2, -0.7));
      gl.addColorStop(1, shade(c2, -0.45));
      ctx.fillStyle = gl;
      ctx.fill();
      ctx.save();
      ctx.clip();
      // linhas de varrimento
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = c2;
      for (let y = -6; y < 3; y += 2) ctx.fillRect(-2, y, 32, 0.7);
      ctx.globalAlpha = 1;
      const prev = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'lighter';
      // feixe que percorre o visor (vai e volta)
      const sx = (Math.sin(t * 2.6) * 0.5 + 0.5) * 30 - 1;
      ctx.globalAlpha = 0.95;
      ctx.drawImage(glowSprite(c2), sx - 10, -12, 20, 20);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx - 1, -6.5, 2, 9.5);
      // olhos-alvo
      ctx.fillStyle = c2;
      ctx.globalAlpha = 0.8 + Math.sin(t * 8) * 0.2;
      ctx.fillRect(3, -2.6, 6, 2);
      ctx.fillRect(16, -2.8, 5, 2);
      ctx.globalCompositeOperation = prev;
      // reflexo diagonal no vidro
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(18, -6.5);
      ctx.lineTo(23, -6.5);
      ctx.lineTo(19, 3);
      ctx.lineTo(16.5, 3);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
      // armação: friso de luz por cima
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-8, -8.6);
      ctx.lineTo(28, -8.6);
      ctx.stroke();
      // módulo lateral com LED
      ctx.beginPath();
      ctx.roundRect(-14, -9, 7, 13, 2);
      ctx.fillStyle = shade(c1, 0.25);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = OC();
      ctx.stroke();
      ctx.fillStyle = Math.floor(t * 3) % 3 ? c2 : '#ff4a3d';
      ctx.beginPath();
      ctx.arc(-10.5, -4, 1.4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = shade(c1, -0.4);
      ctx.fillRect(-12.5, 0, 4, 1);
      ctx.fillRect(-12.5, 2, 4, 1);
      break;
    }
  }
}

/** Crânio redondo + maxilar e queixo virados para a frente. */
function headPath(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(-14, 22);
  ctx.arc(0, 0, HEAD_R, 2.14, Math.PI * 2 - 0.42);
  ctx.bezierCurveTo(27.5, -4, 28.5, 13, 22.5, 22.5);
  ctx.quadraticCurveTo(17, 31.5, 7, 31.5);
  ctx.quadraticCurveTo(-5, 31, -14, 22);
  ctx.closePath();
}

function drawHead(ctx: CanvasRenderingContext2D, L: Look, expr: Expr, t: number) {
  const hc = L.hairColor;
  const [c1, c2] = hairColors(hc, t);
  const style = L.hair.style ?? 'curto';
  const o = L.outfit;
  const noHair = hidesHair(o);
  const mask = hidesMask(o) ? null : L.mask;
  const masked = mask?.style === 'luchador';
  if (o.head) headPieces(ctx, o, HEAD_2D, t, 'back');
  if (!noHair && (!masked || style === 'longo' || style === 'rabo' || style === 'trancas' || style === 'cometa' || style === 'chamas')) {
    hairBack(ctx, style, c1, c2, t);
  }
  headPath(ctx);
  ctx.lineWidth = OW;
  ctx.strokeStyle = OC();
  ctx.stroke();
  ctx.fillStyle = C(L.skin);
  ctx.fill();
  if (!PS.F) {
    // cel shading recortado pela forma da cabeça (luz de cima / da frente)
    ctx.save();
    headPath(ctx);
    ctx.clip();
    const sc = L.skinShade;
    // sombra própria: tudo o que fica fora da "bola" iluminada (nuca, maxilar)
    outerShade(ctx, sc, 0.6, 7, -4, 28);
    // sombra de núcleo na nuca
    outerShade(ctx, sh(sc, -0.15), 0.35, 10, -6, 31);
    // por baixo do maxilar
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = sc;
    ctx.beginPath();
    ctx.ellipse(4, 42, 26, 14, -0.15, 0, TAU);
    ctx.fill();
    // maçã do rosto e têmpora
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.ellipse(-3, 15, 6, 9, 0.3, 0, TAU);
    ctx.fill();
    // brilhos: testa, maçã do rosto e queixo
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.ellipse(10, -17, 8, 3.6, -0.35, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    ctx.ellipse(11, 6.5, 4.5, 2.2, -0.2, 0, TAU);
    ctx.ellipse(12, 27.5, 3.6, 1.6, -0.1, 0, TAU);
    ctx.fill();
    // covinha do queixo
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = sc;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(9, 25.6);
    ctx.quadraticCurveTo(12, 24.4, 15, 25.4);
    ctx.stroke();
    // luz de recorte do holofote por cima (dá volume à cabeça)
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = '#fff6e0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, HEAD_R - 2.5, -2.4, -0.55);
    ctx.stroke();
    // luz refletida (fria) na nuca
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = '#cfe4ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, HEAD_R - 2, 2.3, 3.5);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  if (o.mat && (o.mat === 'lava' || o.mat === 'ice' || o.mat === 'cosmic') && !PS.F) {
    ctx.save();
    headPath(ctx);
    ctx.clip();
    matPattern(ctx, o, (tt, ss) => [-26 + tt * 56, ss * 26], 40, t, 11);
    ctx.restore();
  }
  if (o.head) headPieces(ctx, o, HEAD_2D, t, 'skin');
  if (!masked && !noHair) capCastShadow(ctx, L, style);
  drawFace(ctx, L, expr, t, C(c1), c2);
  if (mask) drawMask(ctx, mask, L, expr, t);
  if (!masked && !noHair) hairFront(ctx, style, c1, c2, t, hc);
  if (o.head) headPieces(ctx, o, HEAD_2D, t, 'front');
}

// ───────────────────────── Tronco e trajes ─────────────────────────

function torsoPath(ctx: CanvasRenderingContext2D | Path2D, s: Skel, hw: number, sw: number) {
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
  if ('beginPath' in ctx) ctx.beginPath();
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

/**
 * Funde a raiz de um membro com o tronco (ombro / anca): tapa, só por dentro da silhueta do tronco,
 * o contorno do encaixe, para o membro sair do corpo em vez de parecer uma peça montada.
 */
function blendJoint(
  ctx: CanvasRenderingContext2D, s: Skel, color: string, shadeC: string,
  ax: number, ay: number, bx: number, by: number, p: Prof, frac: number, deltoid: boolean, overTorso = true,
) {
  if (PS.F) return;
  ctx.save();
  const ex = ax + (bx - ax) * frac;
  const ey = ay + (by - ay) * frac;
  const k = Math.max(0.5, 1 - (OW * 0.6) / p[1]);
  if (overTorso) torsoPath(ctx, s, 19, 30);
  else {
    // o tronco foi desenhado por cima do membro: tapa o contorno dele que atravessa a coxa
    ctx.beginPath();
    capsule(ctx, ax, ay, bx, by, p, k);
  }
  ctx.clip();
  ctx.beginPath();
  capsule(ctx, ax, ay, ex, ey, [p[0], p[1], p[1]], k);
  ctx.arc(ax, ay, p[0] * k + 2, 0, TAU);
  ctx.fillStyle = C(color);
  ctx.fill();
  if (deltoid) {
    // volume do deltóide: sombra suave por baixo e uma linha de músculo a ligar ao peito
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const [snx, sny] = shadeSide(dx, dy);
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = shadeC;
    ctx.beginPath();
    capsule(ctx, ax, ay, ex, ey, [p[0], p[1], p[1]], 0.55, snx * p[1] * 0.45, sny * p[1] * 0.45);
    ctx.fill();
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = shadeC;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    const mx = ax + (dx / len) * p[1] * 1.3;
    const my = ay + (dy / len) * p[1] * 1.3;
    ctx.moveTo(mx + snx * p[1] * 0.9, my + sny * p[1] * 0.9);
    ctx.quadraticCurveTo(mx + snx * p[1] * 0.2 - (dx / len) * 4, my + sny * p[1] * 0.2 - (dy / len) * 4, mx - snx * p[1] * 0.5, my - sny * p[1] * 0.5);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
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

const REF_WHITE = '#f2f2ef';

/** Camisa de árbitro: riscas verticais pretas (recortadas pelo tronco) e gola preta. */
function refShirt(ctx: CanvasRenderingContext2D, s: Skel) {
  const a = s.torsoA;
  const ux = Math.sin(a);
  const uy = -Math.cos(a);
  const nx = Math.cos(a);
  const ny = Math.sin(a);
  const hx = s.x[J_HIP];
  const hy = s.y[J_HIP];
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = '#141418';
  ctx.lineWidth = 4.2;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  for (let n = -24; n <= 32; n += 9) {
    ctx.moveTo(hx + nx * n - ux * 8, hy + ny * n - uy * 8);
    ctx.lineTo(hx + nx * n + ux * 76, hy + ny * n + uy * 76);
  }
  ctx.stroke();
  ctx.restore();
  // gola
  const sx = s.x[J_SH];
  const sy = s.y[J_SH];
  seg(ctx, sx - nx * 9 + ux * 6, sy - ny * 9 + uy * 6, sx + nx * 9 + ux * 4, sy + ny * 9 + uy * 4, 5, '#141418');
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

  const suit = style === 'none';
  const ref = style === 'ref';
  const covered = style === 'gi' || style === 'armor' || style === 'jacket' || ref;
  torsoPath(ctx, s, 19, 30);
  fillOut(ctx, ref ? REF_WHITE : covered ? c1 : L.body);
  if (ref && !PS.F) refShirt(ctx, s);
  if (suit && o.mat && !PS.F) {
    // material do fato (escamas, lava, metal…) recortado pelo tronco, com barriga clara
    ctx.save();
    ctx.clip();
    matPattern(ctx, o, (tt, ss) => [hx + ux * tt * 62 + nx * ss * 22, hy + uy * tt * 62 + ny * ss * 22], 62, t, 7, true);
    ctx.restore();
  }
  const P = (u: number, n: number): [number, number] => [hx + ux * u + nx * n, hy + uy * u + ny * n];
  if (!PS.F) {
    // cel shading do tronco: banda de sombra nas costas, núcleo mais escuro e luz refletida na orla
    const base = ref ? REF_WHITE : covered ? c1 : L.body;
    const shC = covered || suit ? sh(base, -0.35) : L.bodyShade;
    ctx.save();
    torsoPath(ctx, s, 19, 30);
    ctx.clip();
    const band = (inset: number, alpha: number, col: string) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = col;
      ctx.beginPath();
      let p = P(-6, -30);
      ctx.moveTo(p[0], p[1]);
      p = P(70, -40);
      ctx.lineTo(p[0], p[1]);
      p = P(64, -26 + inset);
      ctx.lineTo(p[0], p[1]);
      let c = P(40, -24 + inset * 1.2);
      p = P(22, -19 + inset);
      ctx.quadraticCurveTo(c[0], c[1], p[0], p[1]);
      c = P(8, -17 + inset);
      p = P(-6, -16 + inset * 0.6);
      ctx.quadraticCurveTo(c[0], c[1], p[0], p[1]);
      ctx.closePath();
      ctx.fill();
    };
    band(11, covered ? 0.32 : 0.5, shC);
    band(4, covered ? 0.18 : 0.3, sh(shC, -0.2));
    // luz refletida (fria) junto à orla das costas
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = '#d8ecff';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    let q = P(6, -18);
    ctx.moveTo(q[0], q[1]);
    let cq = P(32, -26);
    q = P(54, -27);
    ctx.quadraticCurveTo(cq[0], cq[1], q[0], q[1]);
    ctx.stroke();
    // sombra por baixo do peito / ombro (oclusão)
    ctx.globalAlpha = covered ? 0.18 : 0.22;
    ctx.fillStyle = shC;
    ctx.beginPath();
    q = P(36, 6);
    ctx.ellipse(q[0], q[1], 9, 18, a + 0.3, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (!covered && !suit) {
      const bs = L.bodyShade;
      // peitoral: sombra em lente por baixo + linha
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = bs;
      ctx.beginPath();
      q = P(48, 3);
      ctx.moveTo(q[0], q[1]);
      cq = P(34, 9);
      q = P(37, 28);
      ctx.quadraticCurveTo(cq[0], cq[1], q[0], q[1]);
      cq = P(39, 12);
      q = P(48, 3);
      ctx.quadraticCurveTo(cq[0], cq[1], q[0], q[1]);
      ctx.fill();
      curves(ctx, sh(bs, -0.1), 0.8, 2.3, [...P(48, 3), ...P(34, 9), ...P(37, 28)]);
      // dorsal (lat) e serrátil
      curves(ctx, bs, 0.55, 2, [...P(50, -12), ...P(36, -12), ...P(24, -5)]);
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = bs;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const u = 42 - i * 4.5;
        const p0 = P(u, -2 + i);
        const p1 = P(u - 3, 5 + i);
        ctx.moveTo(p0[0], p0[1]);
        ctx.lineTo(p1[0], p1[1]);
      }
      ctx.stroke();
      // abdominais: linha alba, separações e linha do oblíquo
      curves(ctx, bs, 0.55, 1.9, [
        ...P(35, 11.5), ...P(25, 10.5), ...P(16, 12.5),
        ...P(31, 8.5), ...P(29.5, 14), ...P(31, 19.5),
        ...P(24, 8.5), ...P(22.5, 14), ...P(24, 19.5),
        ...P(28, 1), ...P(20, 2), ...P(15, 9),
      ]);
      // umbigo
      q = P(18.5, 15.5);
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = sh(bs, -0.2);
      ctx.beginPath();
      ctx.ellipse(q[0], q[1], 1.1, 1.8, a, 0, TAU);
      ctx.fill();
      // trapézio
      curves(ctx, bs, 0.5, 1.8, [...P(68, -4), ...P(66, 4), ...P(61, 13)]);
      // brilho de suor: peito, abdominais e ombro
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.26;
      ctx.beginPath();
      q = P(49, 17);
      ctx.ellipse(q[0], q[1], 7, 3, a - 0.4, 0, TAU);
      q = P(27.5, 15.5);
      ctx.ellipse(q[0], q[1], 2.6, 1.6, a, 0, TAU);
      q = P(20.5, 15.8);
      ctx.ellipse(q[0], q[1], 2.2, 1.4, a, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      q = P(50, 19);
      ctx.ellipse(q[0], q[1], 2, 1, a - 0.4, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
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
    if (o.pattern === 'lacquer' && !PS.F) {
      // lâminas lacadas do do (samurai)
      ctx.strokeStyle = c3;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const u = 6 + i * 6;
        ctx.moveTo(hx + ux * u - nx * 20, hy + uy * u - ny * 20);
        ctx.lineTo(hx + ux * u + nx * 21, hy + uy * u + ny * 21);
      }
      ctx.stroke();
      ctx.fillStyle = c3;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(hx + ux * (9 + i * 6) + nx * 12, hy + uy * (9 + i * 6) + ny * 12, 1.4, 0, TAU);
        ctx.fill();
      }
    } else if (o.pattern === 'muscle' && !PS.F) {
      // couraça musculada (gladiador)
      ctx.strokeStyle = shade(c2, -0.4);
      ctx.lineWidth = 2;
      ctx.beginPath();
      const px = ax + nx * 4;
      const py = ay + ny * 4;
      ctx.moveTo(px - nx * 4 + ux * 8, py - ny * 4 + uy * 8);
      ctx.quadraticCurveTo(px + nx * 8 + ux * 1, py + ny * 8 + uy * 1, px + nx * 18 + ux * 6, py + ny * 18 + uy * 6);
      ctx.moveTo(px + nx * 6 - ux * 4, py + ny * 6 - uy * 4);
      ctx.lineTo(px + nx * 6 - ux * 14, py + ny * 6 - uy * 14);
      ctx.moveTo(px + nx * 1 - ux * 9, py + ny * 1 - uy * 9);
      ctx.lineTo(px + nx * 13 - ux * 9, py + ny * 13 - uy * 9);
      ctx.stroke();
      // saiote de tiras de couro
      for (let i = -2; i <= 2; i++) {
        const bx = hx + nx * i * 8;
        const by = hy + ny * i * 8;
        seg(ctx, bx + ux * 2, by + uy * 2, bx - ux * 18, by - uy * 18, 6, i % 2 ? c1 : shade(c1, -0.2));
      }
    } else if (o.pattern === 'royal' && !PS.F) {
      // filigrana e rubi central
      ctx.strokeStyle = '#fff8d0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 2; i++) {
        const rr = 6 + i * 6;
        ctx.ellipse(ax + nx * 4, ay + ny * 4, rr * 1.3, rr, a, 0, TAU);
      }
      ctx.stroke();
      ctx.fillStyle = '#d6202f';
      ctx.beginPath();
      ctx.arc(ax + nx * 4, ay + ny * 4, 4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(ax + nx * 3, ay + ny * 3 + uy, 1.3, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (o.pattern === 'cracks') {
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

  if (suit) {
    // cinto dos fatos tecnológicos / divinos
    if (o.mat === 'astro' || o.mat === 'metal' || o.mat === 'cosmic' || o.mat === 'feather') {
      const bc = o.mat === 'astro' ? '#cfd6e2' : o.mat === 'metal' ? '#59627a' : '#ffd23d';
      seg(ctx, hx - nx * 20 + ux * 10, hy - ny * 20 + uy * 10, hx + nx * 21 + ux * 10, hy + ny * 21 + uy * 10, 7, bc);
      circle(ctx, hx + nx * 16 + ux * 10, hy + ny * 16 + uy * 10, 4.5, o.mat === 'metal' ? (o.c2 ?? '#2be3ff') : o.mat === 'astro' ? '#3a8bff' : '#fff3b0');
    }
  }
  // emblema no peito (lado visível em perfil)
  if (o.chest) {
    const ex = hx + ux * 38 + nx * 14;
    const ey = hy + uy * 38 + ny * 14;
    chestDecal(ctx, o, ex, ey, nx * 0.62, ny * 0.62, ux * 0.62, uy * 0.62, t);
  }
  // calções / cintura (todos menos gi e fatos inteiros)
  if (style !== 'gi' && !suit) {
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
    if (!PS.F) {
      ctx.save();
      ctx.clip();
      // perna de trás dos calções na sombra
      ctx.globalAlpha = 0.38;
      ctx.fillStyle = sh(tc, -0.45);
      ctx.beginPath();
      capsule(ctx, hx - 3, hy, bxk, byk, TR, 0.8);
      ctx.fill();
      // sombra na orla de trás da perna da frente
      const [snx, sny] = shadeSide(fxk - hx, fyk - hy);
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      capsule(ctx, hx + 3, hy, fxk, fyk, TR, 0.55, snx * TR[1] * 0.5, sny * TR[1] * 0.5);
      ctx.fill();
      // pregas do tecido a sair do entrepernas
      const cx0 = hx + nx * 2 - ux * 8;
      const cy0 = hy + ny * 2 - uy * 8;
      curves(ctx, sh(tc, -0.5), 0.55, 1.5, [
        cx0, cy0, cx0 + (fxk - cx0) * 0.3 - snx * 3, cy0 + (fyk - cy0) * 0.3 - sny * 3, cx0 + (fxk - cx0) * 0.55 - snx * 6, cy0 + (fyk - cy0) * 0.55 - sny * 6,
        cx0, cy0, cx0 + (fxk - cx0) * 0.25 + snx * 2, cy0 + (fyk - cy0) * 0.25 + sny * 2, cx0 + (fxk - cx0) * 0.5 + snx * 2, cy0 + (fyk - cy0) * 0.5 + sny * 2,
      ]);
      // brilho acetinado ao longo da coxa da frente
      const sx0 = hx + (fxk - hx) * 0.2 - snx * 8;
      const sy0 = hy + (fyk - hy) * 0.2 - sny * 8;
      const sx1 = hx + (fxk - hx) * 0.85 - snx * 8;
      const sy1 = hy + (fyk - hy) * 0.85 - sny * 8;
      curves(ctx, '#ffffff', 0.3, 3.2, [sx0, sy0, (sx0 + sx1) / 2 - snx * 1.5, (sy0 + sy1) / 2 - sny * 1.5, sx1, sy1]);
      curves(ctx, '#ffffff', 0.6, 1.2, [sx0 + (sx1 - sx0) * 0.2, sy0 + (sy1 - sy0) * 0.2, (sx0 + sx1) / 2 - snx * 1.5, (sy0 + sy1) / 2 - sny * 1.5, sx0 + (sx1 - sx0) * 0.6, sy0 + (sy1 - sy0) * 0.6]);
      ctx.restore();
      // bainha nas aberturas das pernas
      const fa = Math.atan2(fyk - hy, fkx - hx) + Math.PI / 2;
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = sh(tc, -0.4);
      ctx.lineWidth = 2;
      ctx.beginPath();
      const hr = TR[2] - 0.5;
      const fa2 = Math.atan2(fyk - hy, fxk - hx);
      ctx.moveTo(fxk + Math.cos(fa) * hr - Math.cos(fa2) * 3, fyk + Math.sin(fa) * hr - Math.sin(fa2) * 3);
      ctx.lineTo(fxk - Math.cos(fa) * hr - Math.cos(fa2) * 3, fyk - Math.sin(fa) * hr - Math.sin(fa2) * 3);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    void tw;
    // cós elástico com pesponto e cordão
    const wc = style === 'armor' ? c3 : c2;
    const w0x = hx - nx * 20 + ux * 14, w0y = hy - ny * 20 + uy * 14;
    const w1x = hx + nx * 20 + ux * 14, w1y = hy + ny * 20 + uy * 14;
    seg(ctx, w0x, w0y, w1x, w1y, 7, wc);
    if (!PS.F) {
      ctx.lineCap = 'butt';
      ctx.setLineDash([2.2, 2]);
      ctx.strokeStyle = sh(wc, -0.4);
      ctx.lineWidth = 0.9;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      for (const d of [-2.3, 2.3]) {
        ctx.moveTo(w0x + ux * d + nx * 2, w0y + uy * d + ny * 2);
        ctx.lineTo(w1x + ux * d - nx * 2, w1y + uy * d - ny * 2);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.moveTo(w0x - ux * 1 - nx * 2, w0y - uy * 1 - ny * 2);
      ctx.lineTo(w0x - ux * 3.6 - nx * 2, w0y - uy * 3.6 - ny * 2);
      ctx.lineTo(w1x - ux * 3.6, w1y - uy * 3.6);
      ctx.lineTo(w1x - ux * 1, w1y - uy * 1);
      ctx.fill();
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(w0x + ux * 2.4 + nx * 3, w0y + uy * 2.4 + ny * 3);
      ctx.lineTo(w1x + ux * 2.4 - nx * 4, w1y + uy * 2.4 - ny * 4);
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (style === 'trunks') {
        // laço do cordão à frente
        const kx = hx + nx * 15 + ux * 13;
        const ky = hy + ny * 15 + uy * 13;
        ctx.strokeStyle = OC();
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(kx, ky);
        ctx.lineTo(kx - ux * 7 + nx * 1, ky - uy * 7 + ny * 1);
        ctx.moveTo(kx, ky);
        ctx.lineTo(kx - ux * 6 + nx * 4, ky - uy * 6 + ny * 4);
        ctx.stroke();
        ctx.strokeStyle = sh(wc, -0.15);
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.fillStyle = sh(wc, -0.15);
        ctx.beginPath();
        ctx.arc(kx, ky, 1.8, 0, TAU);
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = OC();
        ctx.stroke();
      }
    }
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

/** Joelheira almofadada: costuras, sombra e brilho. */
function kneePad(ctx: CanvasRenderingContext2D, kx: number, ky: number, hx: number, hy: number, fx: number, fy: number, col: string) {
  const ax = kx + (hx - kx) * 0.18;
  const ay = ky + (hy - ky) * 0.18;
  const bx = kx + (fx - kx) * 0.2;
  const by = ky + (fy - ky) * 0.2;
  const pr: Prof = [10.5, 11.4, 10];
  ctx.beginPath();
  capsule(ctx, ax, ay, bx, by, pr);
  ctx.lineWidth = 3;
  ctx.strokeStyle = OC();
  ctx.stroke();
  ctx.fillStyle = C(col);
  ctx.fill();
  if (PS.F) return;
  ctx.save();
  ctx.clip();
  const [snx, sny] = shadeSide(bx - ax, by - ay);
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = sh(col, -0.45);
  ctx.beginPath();
  capsule(ctx, ax, ay, bx, by, pr, 0.6, snx * 7, sny * 7);
  ctx.fill();
  // costuras dos gomos almofadados
  const dx = bx - ax;
  const dy = by - ay;
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = sh(col, -0.45);
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  for (const q of [0.12, 0.88]) {
    const mx = ax + dx * q;
    const my = ay + dy * q;
    ctx.moveTo(mx - snx * 12, my - sny * 12);
    ctx.quadraticCurveTo(mx + dx * 0.08, my + dy * 0.08, mx + snx * 12, my + sny * 12);
  }
  ctx.stroke();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(ax + dx * 0.5 - snx * 5.5, ay + dy * 0.5 - sny * 5.5, 2, Math.max(2, Math.hypot(dx, dy) * 0.32), Math.atan2(dy, dx) + Math.PI / 2, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** Pescoço com sombra do maxilar e esternocleidomastóideo. */
function drawNeck(ctx: CanvasRenderingContext2D, s: Skel, col: string, shadeC: string) {
  const x0 = s.x[J_SH];
  const y0 = s.y[J_SH];
  const x1 = s.x[J_HEAD] * 0.45 + s.x[J_NECK] * 0.55;
  const y1 = s.y[J_HEAD] * 0.45 + s.y[J_NECK] * 0.55;
  seg(ctx, x0, y0, x1, y1, 19, col);
  if (PS.F) return;
  const nx = Math.cos(s.torsoA);
  const ny = Math.sin(s.torsoA);
  ctx.globalAlpha = 0.5;
  seg(ctx, x0 - nx * 4, y0 - ny * 4, x1 - nx * 4, y1 - ny * 4, 9, shadeC, false);
  ctx.globalAlpha = 0.55;
  seg(ctx, x1 + nx * 1, y1 + ny * 1, x1 + (x0 - x1) * 0.3 + nx, y1 + (y0 - y1) * 0.3 + ny, 15, shadeC, false);
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = shadeC;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x1 - nx * 3, y1 - ny * 3);
  ctx.quadraticCurveTo(x0 + (x1 - x0) * 0.4 + nx * 2, y0 + (y1 - y0) * 0.4 + ny * 2, x0 + nx * 6, y0 + ny * 6);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// ───────────────────────── Corpo completo ─────────────────────────

/**
 * Desenha o lutador com a anca na origem, virado para a direita.
 * O chamador trata da translação, espelhamento e escala.
 */
export function drawFighter(ctx: CanvasRenderingContext2D, L: Look, s: Skel, o: DrawOpts) {
  if (o.rim && !o.flash) {
    // silhueta desviada para trás/cima: fica uma orla colorida à volta do corpo
    PS.F = true;
    PS.SIL = o.rim;
    ctx.save();
    ctx.translate(-2.6, -2.2);
    drawBody(ctx, L, s, o);
    ctx.restore();
    PS.SIL = null;
  }
  PS.F = o.flash;
  drawBody(ctx, L, s, o);
  PS.F = false;
}

const bodyDL = new DL();

function drawBody(ctx: CanvasRenderingContext2D, L: Look, s: Skel, o: DrawOpts) {
  const t = o.t;
  const X = s.x;
  const Y = s.y;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (L.aura && !PS.F) drawAura(ctx, L.aura, s, t, !!o.low);
  if (o.glow && !PS.F) {
    const prev = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.75 + Math.sin(t * 20) * 0.2;
    ctx.drawImage(glowSprite(o.glow), -110, -190, 220, 250);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = prev;
  }

  const out = L.outfit;
  const style = out.style ?? 'trunks';
  const suit = style === 'none';
  const skinB = shade(L.body, -0.15);
  const legC = style === 'gi' || style === 'ref' ? outfitC1(out, t) : style === 'armor' ? out.boots ?? '#222' : L.body;
  const legB = shade(legC, -0.15);
  const boots = out.boots ?? '#222';
  const sleeve = style === 'gi' && !out.suit ? outfitC1(out, t) : null;
  // mangas curtas da camisa de árbitro (brancas, com as riscas da camisa)
  const refSleeve = (ex: number, ey: number, c: string) => {
    if (style !== 'ref') return;
    const mx = X[J_SH] + (ex - X[J_SH]) * 0.62;
    const my = Y[J_SH] + (ey - Y[J_SH]) * 0.62;
    ctx.beginPath();
    capsule(ctx, X[J_SH], Y[J_SH], mx, my, [12.5, 12.5, 11.5]);
    fillOut(ctx, c);
    if (PS.F) return;
    ctx.save();
    ctx.clip();
    const a = s.torsoA;
    const ux = Math.sin(a) * 40;
    const uy = -Math.cos(a) * 40;
    ctx.strokeStyle = '#141418';
    ctx.lineWidth = 4.2;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    for (let n = -27; n <= 27; n += 9) {
      const cx = X[J_SH] + Math.cos(a) * n;
      const cy = Y[J_SH] + Math.sin(a) * n;
      ctx.moveTo(cx - ux, cy - uy);
      ctx.lineTo(cx + ux, cy + uy);
    }
    ctx.stroke();
    ctx.restore();
    ctx.lineCap = 'round';
  };
  const deco = out.mat ? (base: number) => (M: (t: number, s: number) => [number, number], len: number, i: number) => matPattern(ctx, out, M, len, t, base + i) : () => undefined;

  // peças do traje (capa, asas, cauda, ombreiras…) no referencial do tronco e da anca
  const dl = bodyDL;
  if (out.back || out.tail || out.shoulders) {
    const T = proj2D(X[J_SH], Y[J_SH], s.torsoA);
    const Hp = proj2D(X[J_HIP], Y[J_HIP], s.torsoA);
    bodyPieces(dl, ctx, out, T, Hp, t, true, !!o.low);
  }
  dl.flush(-Infinity, 0);

  // braço de trás
  limb(ctx, X[J_SH], Y[J_SH], X[J_BE], Y[J_BE], X[J_BH], Y[J_BH], ARM_U, ARM_L, skinB, shade(L.bodyShade, -0.15), out.mat ? deco(1) : undefined);
  if (sleeve) seg(ctx, X[J_SH], Y[J_SH], X[J_SH] + (X[J_BE] - X[J_SH]) * 0.8, Y[J_SH] + (Y[J_BE] - Y[J_SH]) * 0.8, 23, shade(sleeve, -0.15));
  refSleeve(X[J_BE], Y[J_BE], shade(REF_WHITE, -0.15));
  drawGlove(ctx, L.gloves, X[J_BH], Y[J_BH], s.baL, t, skinB, true);

  // perna de trás
  limb(ctx, X[J_HIP] - 3, Y[J_HIP], X[J_BK], Y[J_BK], X[J_BF], Y[J_BF], LEG_U, LEG_L, legB, shade(legB, -0.3), out.mat && legC === L.body ? deco(3) : undefined);
  drawBoot(ctx, X[J_BK], Y[J_BK], X[J_BF], Y[J_BF], s.blL, shade(boots, -0.15), out.mat);
  const pads = (style === 'trunks' || style === 'singlet') && !out.suit;
  if (pads) kneePad(ctx, X[J_BK], Y[J_BK], X[J_HIP], Y[J_HIP], X[J_BF], Y[J_BF], sh(out.c2 ?? '#ffffff', -0.18));
  // perna da frente
  limb(ctx, X[J_HIP] + 3, Y[J_HIP], X[J_FK], Y[J_FK], X[J_FF], Y[J_FF], LEG_U, LEG_L, legC, legC === L.body ? L.bodyShade : shade(legC, -0.3), out.mat && legC === L.body ? deco(5) : undefined);
  if (pads) kneePad(ctx, X[J_FK], Y[J_FK], X[J_HIP], Y[J_HIP], X[J_FF], Y[J_FF], out.c2 ?? '#fff');
  drawBoot(ctx, X[J_FK], Y[J_FK], X[J_FF], Y[J_FF], s.flL, boots, out.mat);

  // pescoço
  drawNeck(ctx, s, suit && out.head !== 'astro' ? L.body : L.skin, suit && out.head !== 'astro' ? L.bodyShade : L.skinShade);
  drawTorso(ctx, L, s, t);
  if (style === 'none' && legC === L.body) blendJoint(ctx, s, L.body, L.bodyShade, X[J_HIP] + 3, Y[J_HIP], X[J_FK], Y[J_FK], LEG_U, 0.35, false, false);

  // cabeça
  ctx.save();
  ctx.translate(X[J_HEAD], Y[J_HEAD]);
  ctx.rotate(s.headA);
  drawHead(ctx, L, o.expr, t);
  ctx.restore();

  // braço da frente
  // o ombro funde-se com o tronco quando são da mesma "pele" (sem mangas nem armadura)
  const bareTorso = style === 'trunks' || style === 'singlet' || style === 'none';
  let soft: { over: Path2D; color: string } | undefined;
  if (bareTorso && !sleeve && !PS.F) {
    const tp = new Path2D();
    torsoPath(tp, s, 19, 30);
    soft = { over: tp, color: shade(L.bodyShade, -0.25) };
  }
  if (!PS.F) {
    // sombra projetada do braço da frente no tronco (dá profundidade ao braço cruzado)
    ctx.save();
    torsoPath(ctx, s, 19, 30);
    ctx.clip();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#1a1020';
    ctx.beginPath();
    capsule(ctx, X[J_SH] - 2, Y[J_SH] + 4, X[J_FE] - 3, Y[J_FE] + 6, ARM_U);
    capsule(ctx, X[J_FE] - 3, Y[J_FE] + 6, X[J_FH] - 3, Y[J_FH] + 6, ARM_L);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  limb(ctx, X[J_SH], Y[J_SH], X[J_FE], Y[J_FE], X[J_FH], Y[J_FH], ARM_U, ARM_L, L.body, L.bodyShade, out.mat ? deco(7) : undefined, soft);
  if (bareTorso && !sleeve) blendJoint(ctx, s, L.body, L.bodyShade, X[J_SH], Y[J_SH], X[J_FE], Y[J_FE], ARM_U, 0.42, !out.mat);
  if (sleeve) seg(ctx, X[J_SH], Y[J_SH], X[J_SH] + (X[J_FE] - X[J_SH]) * 0.8, Y[J_SH] + (Y[J_FE] - Y[J_SH]) * 0.8, 24, sleeve);
  refSleeve(X[J_FE], Y[J_FE], REF_WHITE);
  if (style === 'armor' && !out.shoulders) circle(ctx, X[J_SH], Y[J_SH], 13, out.c3 ?? out.c2 ?? '#aaa');
  dl.flush(0, Infinity);
  drawGlove(ctx, L.gloves, X[J_FH], Y[J_FH], s.faL, t, L.body, false);
  PS.F = false;
}
