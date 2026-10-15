import type { Vis } from '../data/items';
import { flame } from './costume';
import { PS, TAU, circle, glowSprite, hash } from './paint';
import { HEAD_R, J_BE, J_BF, J_BH, J_BK, J_FE, J_FF, J_FH, J_FK, J_HEAD, J_HIP, J_NECK, J_SH, type Skel } from './pose';

/**
 * Auras: efeito à volta do lutador (lutas e menus) e cenário de fundo animado nos menus.
 */

function add(ctx: CanvasRenderingContext2D, f: () => void) {
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  f();
  ctx.globalCompositeOperation = prev;
  ctx.globalAlpha = 1;
}

// ───────────────────────── Aura do lutador (lutas e menus) ─────────────────────────
//
// Camadas, de trás para a frente:
//  1. halo que abraça a silhueta (traço grosso sobre os ossos, num só path → alpha uniforme),
//     em composição normal para se ler mesmo sobre o tapete branco do ringue;
//  2. brilho aditivo nas articulações (sprites em cache);
//  3. efeitos próprios de cada aura (chamas, raios, pétalas, ...).
// Tudo é determinístico a partir de `t` (hash), sem gradientes criados por frame.

const hexCache = new Map<number, string>();
/** Cor HSL quantizada (36 tons) em #rrggbb — serve de chave para os sprites em cache. */
function hueHex(h: number, s = 100, l = 60): string {
  const q = ((Math.round(h / 10) % 36) + 36) % 36;
  const key = q * 1e6 + s * 1e3 + l;
  let c = hexCache.get(key);
  if (c) return c;
  const hh = q * 10;
  const S = s / 100;
  const Lr = l / 100;
  const a = S * Math.min(Lr, 1 - Lr);
  const f = (n: number) => {
    const k = (n + hh / 30) % 12;
    return Lr - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  c = '#' + to(f(0)) + to(f(8)) + to(f(4));
  hexCache.set(key, c);
  return c;
}

const stripCache = new Map<string, HTMLCanvasElement>();
/** Faixa vertical suave (cortina de aurora), criada uma vez por cor. */
function stripSprite(color: string): HTMLCanvasElement {
  let c = stripCache.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = 16;
  c.height = 128;
  const g = c.getContext('2d')!;
  const v = g.createLinearGradient(0, 0, 0, 128);
  v.addColorStop(0, color + '00');
  v.addColorStop(0.2, color + 'ee');
  v.addColorStop(0.55, color + '77');
  v.addColorStop(1, color + '00');
  g.fillStyle = v;
  g.fillRect(0, 0, 16, 128);
  g.globalCompositeOperation = 'destination-in';
  const h = g.createLinearGradient(0, 0, 16, 0);
  h.addColorStop(0, '#0000');
  h.addColorStop(0.5, '#000f');
  h.addColorStop(1, '#0000');
  g.fillStyle = h;
  g.fillRect(0, 0, 16, 128);
  stripCache.set(color, c);
  return c;
}

const ADD = 'lighter';
const NORM = 'source-over';

/** Path com todos os ossos (cabeça, tronco largo, braços, pernas) — um único traço = alpha uniforme. */
function bonePath(ctx: CanvasRenderingContext2D, s: Skel, w: number) {
  const X = s.x;
  const Y = s.y;
  ctx.beginPath();
  // tronco: três linhas paralelas para ficar largo
  const dx = X[J_NECK] - X[J_HIP];
  const dy = Y[J_NECK] - Y[J_HIP];
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * 12;
  const ny = (dx / len) * 12;
  for (let k = -1; k <= 1; k++) {
    ctx.moveTo(X[J_HIP] + nx * k, Y[J_HIP] + ny * k);
    ctx.lineTo(X[J_SH] + nx * k, Y[J_SH] + ny * k);
  }
  ctx.moveTo(X[J_FH], Y[J_FH]);
  ctx.lineTo(X[J_FE], Y[J_FE]);
  ctx.lineTo(X[J_SH], Y[J_SH]);
  ctx.lineTo(X[J_BE], Y[J_BE]);
  ctx.lineTo(X[J_BH], Y[J_BH]);
  ctx.moveTo(X[J_FF], Y[J_FF]);
  ctx.lineTo(X[J_FK], Y[J_FK]);
  ctx.lineTo(X[J_HIP], Y[J_HIP]);
  ctx.lineTo(X[J_BK], Y[J_BK]);
  ctx.lineTo(X[J_BF], Y[J_BF]);
  ctx.moveTo(X[J_NECK], Y[J_NECK]);
  ctx.lineTo(X[J_HEAD], Y[J_HEAD]);
  // cabeça: anel cujo traço cobre o disco todo
  const r = Math.max(2, HEAD_R - 4);
  ctx.moveTo(X[J_HEAD] + r, Y[J_HEAD]);
  ctx.arc(X[J_HEAD], Y[J_HEAD], r, 0, TAU);
  ctx.lineWidth = w;
}

function halo(ctx: CanvasRenderingContext2D, s: Skel, w: number, color: string, alpha: number) {
  if (alpha <= 0.01) return;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.strokeStyle = color;
  bonePath(ctx, s, w);
  ctx.stroke();
}

/** Brilho aditivo nas zonas principais do corpo. */
function jointGlow(ctx: CanvasRenderingContext2D, s: Skel, color: string, alpha: number, size: number, low: boolean) {
  const sp = glowSprite(color);
  const js = low ? JG_LOW : JG;
  ctx.globalCompositeOperation = ADD;
  for (let i = 0; i < js.length; i++) {
    const j = js[i];
    const k = j === J_SH || j === J_HIP ? 1.25 : j === J_HEAD ? 1.1 : 0.75;
    const r = size * k;
    ctx.globalAlpha = alpha;
    ctx.drawImage(sp, s.x[j] - r, s.y[j] - r, r * 2, r * 2);
  }
  ctx.globalCompositeOperation = NORM;
}
const JG = [J_HEAD, J_SH, J_HIP, J_FH, J_BH, J_FF, J_BF];
const JG_LOW = [J_HEAD, J_SH, J_HIP];
/** Articulações de onde nascem chamas/raios/fumo. */
const JOINTS = [J_HEAD, J_SH, J_FE, J_BE, J_FH, J_BH, J_HIP, J_FK, J_BK, J_FF, J_BF];

/** Brilho de quatro pontas. */
function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

function ellipseRing(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, color: string, lw: number, alpha: number) {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, rx * 0.24, 0, 0, TAU);
  ctx.stroke();
}

/** Onda de choque no chão, repetida a cada 1/rate segundos. */
function shock(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, rate: number, r0: number, r1: number, color: string, lw: number) {
  const ph = (t * rate) % 1;
  ellipseRing(ctx, x, y, r0 + (r1 - r0) * ph, color, lw * (1 - ph) + 0.5, (1 - ph) * 0.9);
}

/** Linha em zig-zag (raio) — acrescenta ao path atual. */
function bolt(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, len: number, segs: number, seed: number) {
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  const st = len / segs;
  ctx.moveTo(x, y);
  for (let q = 1; q <= segs; q++) {
    const off = (hash(seed + q * 7.3) - 0.5) * st * 1.3;
    ctx.lineTo(x + ux * st * q - uy * off, y + uy * st * q + ux * off);
  }
}

function petal(ctx: CanvasRenderingContext2D, sz: number) {
  ctx.beginPath();
  ctx.moveTo(0, -sz);
  ctx.bezierCurveTo(sz * 0.9, -sz * 0.6, sz * 0.7, sz * 0.5, 0, sz);
  ctx.bezierCurveTo(-sz * 0.7, sz * 0.5, -sz * 0.9, -sz * 0.6, 0, -sz);
}

/** Chama em camadas (exterior escura, meio, núcleo claro) — lê-se bem sobre fundo claro. */
function bigFlame(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, w: number, t: number, seed: number, cOut: string, cMid: string, cCore: string) {
  flame(ctx, x, y, 0, -1, h * 1.12, w * 1.3, cOut, cMid, t, seed);
  flame(ctx, x, y + w * 0.1, 0, -1, h * 0.7, w * 0.75, cMid, cCore, t, seed + 0.37);
}

/** Aura em volta do corpo: halo à volta da silhueta + efeitos próprios de cada tipo. */
export function drawAura(ctx: CanvasRenderingContext2D, a: Vis, s: Skel, t: number, low: boolean) {
  if (PS.F) return;
  const type = a.type ?? '';
  const c1 = a.c1 ?? '#ffffff';
  const c2 = a.c2 ?? '#ffffff';
  const X = s.x;
  const Y = s.y;
  // caixa do corpo (funciona de pé ou deitado)
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  for (let j = 0; j < 12; j++) {
    if (X[j] < x0) x0 = X[j];
    if (X[j] > x1) x1 = X[j];
    if (Y[j] < y0) y0 = Y[j];
  }
  y0 = Math.min(y0, Y[J_HEAD] - HEAD_R);
  x0 -= 16;
  x1 += 16;
  const gy = Math.max(Y[J_FF], Y[J_BF], Y[J_HIP] + 12) + 8;
  const bw = x1 - x0;
  const bh = gy - y0;
  const mx = (x0 + x1) / 2;
  const cx = (X[J_HIP] + X[J_NECK]) / 2;
  const cy = (Y[J_HIP] + Y[J_NECK]) / 2;
  const m = low ? 0.5 : 1;
  const pulse = 0.5 + 0.5 * Math.sin(t * 3.2);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = NORM;

  switch (type) {
    // ── Comum: holofotes de arena e flashes de fotógrafos ──
    case 'holofotes': {
      ctx.globalCompositeOperation = ADD;
      for (let i = 0; i < 2; i++) {
        const sw = Math.sin(t * 0.9 + i * 2.5) * 40;
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = i ? c2 : c1;
        ctx.beginPath();
        ctx.moveTo(mx + sw * 2 - 10, y0 - 190);
        ctx.lineTo(mx + sw * 2 + 10, y0 - 190);
        ctx.lineTo(mx + sw * 0.3 + 75, gy);
        ctx.lineTo(mx + sw * 0.3 - 75, gy);
        ctx.fill();
      }
      ctx.globalAlpha = 0.7;
      ctx.drawImage(glowSprite('#ffffff'), mx - 110, gy - 30, 220, 60);
      ctx.globalCompositeOperation = NORM;
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(mx, gy, 78, 17, 0, 0, TAU);
      ctx.fill();
      halo(ctx, s, 46 + pulse * 6, c2, 0.28);
      halo(ctx, s, 32, '#ffffff', 0.55);
      jointGlow(ctx, s, c2, 0.35, 34, low);
      // flashes de câmara
      ctx.globalCompositeOperation = ADD;
      ctx.fillStyle = '#ffffff';
      for (let j = 0; j < (low ? 1 : 3); j++) {
        const v = t * 2.6 + j * 0.37;
        const k = Math.floor(v);
        const ph = v - k;
        if (hash(k * 7 + j) < 0.35 || ph > 0.3) continue;
        const x = x0 - 30 + hash(k * 3.1 + j) * (bw + 60);
        const y = y0 + hash(k * 5.7 + j) * bh * 0.85;
        const r = 22 * (1 - ph / 0.3);
        ctx.globalAlpha = 1;
        ctx.drawImage(glowSprite('#ffffff'), x - r * 1.6, y - r * 1.6, r * 3.2, r * 3.2);
        sparkle(ctx, x, y, r);
      }
      // poeira nos feixes
      for (let i = 0; i < 10 * m; i++) {
        const ph = (t * 0.12 + hash(i + 70)) % 1;
        ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.8;
        ctx.fillRect(x0 + hash(i + 71) * bw + Math.sin(t + i) * 10, gy - ph * (bh + 40), 2.5, 2.5);
      }
      break;
    }

    // ── Incomum: contorno neon com aberração cromática e equalizador ──
    case 'neon': {
      const gl = Math.floor(t * 8);
      const jit = hash(gl) < 0.2 ? (hash(gl + 1) - 0.5) * 10 : 0;
      ctx.save();
      ctx.translate(-5 + Math.sin(t * 5) * 2 + jit, -3);
      halo(ctx, s, 44, c2, 0.5);
      ctx.restore();
      ctx.save();
      ctx.translate(4 - jit, 2);
      halo(ctx, s, 40, c1, 0.6);
      ctx.restore();
      halo(ctx, s, 28, '#ffffff', 0.35 + pulse * 0.2);
      jointGlow(ctx, s, c1, 0.45, 38, low);
      // chão: anéis duplos + varrimento
      ctx.globalCompositeOperation = ADD;
      ctx.globalAlpha = 0.6;
      ctx.drawImage(glowSprite(c1), mx - 120, gy - 28, 240, 56);
      ctx.globalCompositeOperation = NORM;
      ellipseRing(ctx, mx, gy, 84 + Math.sin(t * 4) * 4, c1, 4.5, 0.95);
      ellipseRing(ctx, mx, gy, 100 + Math.sin(t * 4 + 1) * 4, c2, 3, 0.85);
      shock(ctx, mx, gy, t, 0.9, 40, 140, c2, 4);
      // equalizador dos dois lados
      const blk = 7;
      for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < (low ? 3 : 5); i++) {
          const bx = side < 0 ? x0 - 18 - i * 13 : x1 + 18 + i * 13;
          const lvl = Math.abs(Math.sin(t * 6 + i * 1.3 + side) + Math.sin(t * 9.7 + i * 2.1)) * 0.5;
          const nb = Math.max(1, Math.round((3 + lvl * 9) * (1 - i * 0.14)));
          for (let q = 0; q < nb; q++) {
            ctx.globalAlpha = 0.95 - q * 0.04;
            ctx.fillStyle = q > 6 ? '#ffffff' : q > 3 ? c2 : c1;
            ctx.fillRect(bx - 5, gy - 6 - q * (blk + 2), 10, blk);
          }
        }
      }
      // quadrados neon a subir
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 8 * m; i++) {
        const ph = (t * 0.5 + hash(i + 20)) % 1;
        const x = x0 + hash(i + 21) * bw;
        const y = gy - ph * (bh + 50);
        const sz = 5 + hash(i + 22) * 5;
        ctx.globalAlpha = (1 - ph) * 0.95;
        ctx.strokeStyle = i % 2 ? c1 : c2;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * 2 + i);
        ctx.strokeRect(-sz, -sz, sz * 2, sz * 2);
        ctx.restore();
      }
      break;
    }

    // ── Raro: chuva de faíscas douradas ──
    case 'faiscas': {
      ctx.globalCompositeOperation = ADD;
      ctx.globalAlpha = 0.45 + pulse * 0.2;
      ctx.drawImage(glowSprite(c1), cx - 110, cy - 140, 220, 280);
      ctx.globalCompositeOperation = NORM;
      halo(ctx, s, 52 + pulse * 8, c1, 0.3);
      halo(ctx, s, 34, c2, 0.6);
      jointGlow(ctx, s, c1, 0.5, 40, low);
      shock(ctx, mx, gy, t, 0.8, 30, 150, c1, 6);
      ellipseRing(ctx, mx, gy, 80, c1, 3, 0.7);
      // fontes de faíscas nos pés
      ctx.lineWidth = 3;
      for (let i = 0; i < 16 * m; i++) {
        const ph = (t * 1.2 + hash(i + 30)) % 1;
        const fx = i % 2 ? X[J_FF] : X[J_BF];
        const vx = (hash(i + 31) - 0.5) * 170;
        const vy = 200 + hash(i + 32) * 140;
        const p0 = Math.max(0, ph - 0.05);
        const xa = fx + vx * ph * 0.6;
        const ya = gy - (vy * ph - 330 * ph * ph) * 0.6;
        const xb = fx + vx * p0 * 0.6;
        const yb = gy - (vy * p0 - 330 * p0 * p0) * 0.6;
        ctx.globalAlpha = 1 - ph;
        ctx.strokeStyle = i % 3 ? c1 : '#ffb000';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(xb, yb);
        ctx.lineTo(xa, ya);
        ctx.stroke();
      }
      // traços a subir
      for (let i = 0; i < 18 * m; i++) {
        const ph = (t * 0.7 + hash(i)) % 1;
        const x = x0 + hash(i + 9) * bw + Math.sin(t * 3 + i) * 8;
        const y = gy - ph * (bh + 70);
        ctx.globalAlpha = 1 - ph;
        ctx.strokeStyle = i % 3 ? c1 : '#ffb000';
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - Math.sin(t * 3 + i) * 3, y + 20);
        ctx.stroke();
      }
      // brilhos em estrela
      for (let i = 0; i < 9 * m; i++) {
        const tw = Math.sin(t * (2.5 + hash(i + 40) * 2) + i * 1.7);
        if (tw <= 0) continue;
        const j = JOINTS[i % JOINTS.length];
        const x = X[j] + (hash(i + 41) - 0.5) * 70;
        const y = Y[j] + (hash(i + 42) - 0.5) * 60;
        const r = 6 + tw * 15;
        ctx.globalAlpha = tw;
        ctx.globalCompositeOperation = ADD;
        ctx.drawImage(glowSprite(c1), x - r * 1.5, y - r * 1.5, r * 3, r * 3);
        ctx.globalCompositeOperation = NORM;
        ctx.fillStyle = i % 2 ? '#ffb000' : c1;
        sparkle(ctx, x, y, r);
        ctx.fillStyle = '#ffffff';
        sparkle(ctx, x, y, r * 0.5);
      }
      break;
    }

    // ── Épico: vórtice de pétalas de cerejeira e mandala florida no chão ──
    case 'petalas': {
      ctx.globalCompositeOperation = ADD;
      ctx.globalAlpha = 0.4 + pulse * 0.15;
      ctx.drawImage(glowSprite(c1), cx - 120, cy - 140, 240, 280);
      ctx.globalCompositeOperation = NORM;
      halo(ctx, s, 58 + pulse * 8, c1, 0.3);
      halo(ctx, s, 38, c1, 0.5);
      halo(ctx, s, 26, c2, 0.5);
      jointGlow(ctx, s, c1, 0.45, 40, low);
      // mandala
      ctx.save();
      ctx.translate(mx, gy);
      ctx.scale(1, 0.26);
      ctx.rotate(t * 0.6);
      ctx.lineWidth = 4;
      for (let i = 0; i < 6; i++) {
        ctx.save();
        ctx.rotate((i / 6) * TAU);
        ctx.translate(0, -58);
        petal(ctx, 34);
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = c1;
        ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = '#d04a8c';
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      ellipseRing(ctx, mx, gy, 104, c2, 3, 0.8);
      shock(ctx, mx, gy, t, 0.6, 40, 140, c1, 5);
      // vórtice
      const PN = Math.round(28 * m);
      for (let i = 0; i < PN; i++) {
        const ph = (t * 0.22 + hash(i)) % 1;
        const ang = t * 2.2 + i * 2.39;
        const r = 52 + hash(i + 1) * 30 + ph * 30;
        const dep = Math.sin(ang);
        const x = mx + Math.cos(ang) * r;
        const y = gy - ph * (bh + 60) + dep * 10;
        const sz = (8 + hash(i + 2) * 5) * (0.9 + dep * 0.25);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang + t * 2);
        ctx.scale(1, 0.45 + Math.abs(Math.sin(t * 3 + i)) * 0.55);
        ctx.globalAlpha = Math.min(1, Math.sin(ph * Math.PI) * 1.6);
        petal(ctx, sz);
        ctx.fillStyle = i % 4 === 0 ? '#ffffff' : i % 2 ? c1 : c2;
        ctx.fill();
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = '#c23a7c';
        ctx.stroke();
        ctx.restore();
      }
      // brilhos
      ctx.globalCompositeOperation = ADD;
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 6 * m; i++) {
        const tw = Math.sin(t * 3 + i * 2.2);
        if (tw <= 0) continue;
        ctx.globalAlpha = tw;
        sparkle(ctx, x0 - 20 + hash(i + 60) * (bw + 40), y0 + hash(i + 61) * bh, 3 + tw * 7);
      }
      break;
    }

    // ── Épico: corpo envolto em chamas ──
    case 'chamas': {
      ctx.globalCompositeOperation = ADD;
      ctx.globalAlpha = 0.55 + pulse * 0.2;
      ctx.drawImage(glowSprite('#ff5a00'), mx - bw * 0.5 - 90, y0 - 70, bw + 180, bh + 110);
      ctx.globalCompositeOperation = NORM;
      halo(ctx, s, 60 + pulse * 10, '#ff2a00', 0.35);
      halo(ctx, s, 40, c1, 0.6);
      halo(ctx, s, 26, c2, 0.6);
      // parede de fogo no chão
      const FW = low ? 4 : 7;
      for (let i = 0; i < FW; i++) {
        const x = x0 - 18 + ((i + 0.5) / FW) * (bw + 36);
        const h = 70 + hash(i + 5) * 60 + Math.sin(t * 5 + i) * 10;
        bigFlame(ctx, x, gy + 4, h, 15 + hash(i + 2) * 6, t, i, '#e01e00', c1, c2);
      }
      // labaredas a sair das articulações
      const jn = low ? 5 : JOINTS.length;
      for (let i = 0; i < jn; i++) {
        const j = JOINTS[low ? i * 2 : i];
        const h = j === J_HEAD ? 68 : 38 + hash(i + 11) * 22;
        bigFlame(ctx, X[j] + (hash(i + 12) - 0.5) * 10, Y[j] + 6, h, j === J_HEAD ? 15 : 11, t, i + 20, '#e01e00', c1, c2);
      }
      ctx.globalCompositeOperation = ADD;
      jointGlow(ctx, s, '#ff8a00', 0.5, 40, low);
      ctx.globalCompositeOperation = ADD;
      // brasas
      for (let i = 0; i < 18 * m; i++) {
        const ph = (t * (0.6 + hash(i + 3) * 0.5) + hash(i)) % 1;
        const x = x0 + hash(i + 7) * bw + Math.sin(t * 4 + i) * 14 * ph;
        const y = gy - ph * (bh + 90);
        const r = 3 + (1 - ph) * 3;
        ctx.globalAlpha = 1 - ph;
        ctx.drawImage(glowSprite('#ff7a1a'), x - r * 3, y - r * 3, r * 6, r * 6);
        ctx.fillStyle = i % 2 ? c2 : '#ffffff';
        ctx.fillRect(x - r / 2, y - r / 2, r, r);
      }
      ctx.globalCompositeOperation = NORM;
      shock(ctx, mx, gy, t, 0.7, 40, 150, c1, 6);
      break;
    }

    // ── Lendário: tempestade elétrica ──
    case 'raio': {
      const k = Math.floor(t * 16);
      const flick = 0.75 + hash(k) * 0.25;
      const sv = t * 0.9;
      const strikeK = Math.floor(sv);
      const strikePh = sv - strikeK;
      const strike = hash(strikeK + 0.5) > 0.35 && strikePh < 0.18 ? 1 - strikePh / 0.18 : 0;
      ctx.globalCompositeOperation = ADD;
      ctx.globalAlpha = 0.5 * flick + strike * 0.5;
      ctx.drawImage(glowSprite(c1), cx - 130, cy - 150, 260, 300);
      ctx.globalCompositeOperation = NORM;
      halo(ctx, s, 58 + pulse * 8, '#1f5cff', 0.3 * flick + strike * 0.2);
      halo(ctx, s, 40, c1, 0.6 * flick);
      halo(ctx, s, 24, c2, 0.5 * flick + strike * 0.5);
      jointGlow(ctx, s, c1, 0.55 * flick, 40, low);
      // arcos a saltar das articulações
      const AN = low ? 3 : 7;
      ctx.beginPath();
      for (let i = 0; i < AN; i++) {
        const j = JOINTS[Math.floor(hash(k * 5 + i) * JOINTS.length)];
        const ang = hash(k * 3 + i * 1.7) * TAU;
        const len = 45 + hash(k * 2 + i) * 50;
        bolt(ctx, X[j], Y[j], ang, len, 6, k * 11 + i * 3);
        // ramo
        const bx = X[j] + Math.cos(ang) * len * 0.5;
        const by = Y[j] + Math.sin(ang) * len * 0.5;
        bolt(ctx, bx, by, ang + (hash(k + i) - 0.5) * 2, len * 0.45, 3, k * 17 + i);
      }
      // arco entre mãos e pés
      if (hash(k * 0.7) > 0.4) {
        const a1 = hash(k + 3) > 0.5 ? J_FH : J_BH;
        const a2 = hash(k + 4) > 0.5 ? J_FF : J_BF;
        const ddx = X[a2] - X[a1];
        const ddy = Y[a2] - Y[a1];
        bolt(ctx, X[a1], Y[a1], Math.atan2(ddy, ddx), Math.hypot(ddx, ddy), 7, k * 23);
      }
      // raio do céu
      if (strike > 0) {
        const sx = X[J_HEAD] + (hash(strikeK) - 0.5) * 60;
        bolt(ctx, sx, y0 - 260, Math.atan2(Y[J_HEAD] - y0 + 260, X[J_HEAD] - sx), Math.hypot(Y[J_HEAD] - y0 + 260, X[J_HEAD] - sx), 10, strikeK * 31);
      }
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#2a6cff';
      ctx.lineWidth = 11;
      ctx.stroke();
      ctx.globalAlpha = 0.95;
      ctx.strokeStyle = c1;
      ctx.lineWidth = 4.5;
      ctx.stroke();
      ctx.strokeStyle = c2;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      // bolas de plasma em órbita
      ctx.globalCompositeOperation = ADD;
      for (let i = 0; i < 3; i++) {
        for (let q = 0; q < (low ? 1 : 4); q++) {
          const ang = t * 4.2 + (i / 3) * TAU - q * 0.12;
          const x = cx + Math.cos(ang) * (bw * 0.5 + 34);
          const y = cy + Math.sin(ang) * (bh * 0.42) * Math.cos(t * 0.7 + i);
          const r = (q ? 10 : 16) * (1 - q * 0.18);
          ctx.globalAlpha = q ? 0.35 : 1;
          ctx.drawImage(glowSprite(c1), x - r * 1.6, y - r * 1.6, r * 3.2, r * 3.2);
          if (!q) {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(x, y, 3.5, 0, TAU);
            ctx.fill();
          }
        }
      }
      ctx.globalCompositeOperation = NORM;
      // anel elétrico no chão
      ctx.beginPath();
      for (let p = 0; p <= 28; p++) {
        const ang = (p / 28) * TAU;
        const rr = 90 + (hash(k * 31 + p) - 0.5) * 16;
        const x = mx + Math.cos(ang) * rr;
        const y = gy + Math.sin(ang) * rr * 0.24;
        if (p) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = c1;
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.3;
      ctx.stroke();
      shock(ctx, mx, gy, t, 0.9, 40, 170, c1, 6);
      if (strike > 0) ellipseRing(ctx, mx, gy, 60 + (1 - strike) * 120, '#ffffff', 8 * strike, strike);
      break;
    }

    // ── Lendário: cortinas de aurora boreal e cristais de gelo ──
    case 'aurora': {
      const hc = (u: number) => 150 + (Math.sin(t * 0.9 + u * 4) * 0.5 + 0.5) * 135;
      const h0 = hueHex(hc(0), 100, 62);
      // cortinas
      const SN = low ? 12 : 22;
      const ax0 = x0 - 55;
      const aw = bw + 110;
      const sw = (aw / SN) * 2.4;
      for (let pass = low ? 1 : 0; pass < 2; pass++) {
        ctx.globalCompositeOperation = pass ? ADD : NORM;
        for (let i = 0; i < SN; i++) {
          const u = i / (SN - 1);
          const x = ax0 + u * aw + Math.sin(t * 1.2 + u * 6) * 10;
          const top = y0 - 50 + Math.sin(t * 1.7 + u * 5) * 20;
          const h = bh * 0.95 + Math.sin(t * 2.1 + u * 7) * 22;
          const edge = Math.sin(u * Math.PI);
          ctx.globalAlpha = (pass ? 0.7 : 0.6) * (0.45 + edge * 0.55);
          ctx.drawImage(stripSprite(hueHex(hc(u), 100, 60)), x - sw / 2, top, sw, h);
        }
      }
      ctx.globalCompositeOperation = NORM;
      halo(ctx, s, 58 + pulse * 8, c2, 0.3);
      halo(ctx, s, 40, h0, 0.55);
      halo(ctx, s, 26, '#e8fff6', 0.45);
      jointGlow(ctx, s, h0, 0.5, 40, low);
      // gelo no chão
      ellipseRing(ctx, mx, gy, 92, c1, 4, 0.85);
      ctx.setLineDash([10, 9]);
      ctx.lineDashOffset = -t * 30;
      ellipseRing(ctx, mx, gy, 110, c2, 3, 0.8);
      ctx.setLineDash([]);
      shock(ctx, mx, gy, t, 0.6, 40, 150, h0, 5);
      // cristais de gelo
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 10 * m; i++) {
        const ph = (t * 0.18 + hash(i + 80)) % 1;
        const x = x0 - 30 + hash(i + 81) * (bw + 60) + Math.sin(t + i) * 12;
        const y = gy - ph * (bh + 60);
        const r = 5 + hash(i + 82) * 4;
        ctx.globalAlpha = Math.sin(ph * Math.PI);
        ctx.globalCompositeOperation = ADD;
        ctx.drawImage(glowSprite(i % 2 ? c1 : c2), x - r * 2.5, y - r * 2.5, r * 5, r * 5);
        ctx.globalCompositeOperation = NORM;
        ctx.strokeStyle = i % 2 ? c1 : '#7fe8ff';
        ctx.beginPath();
        for (let q = 0; q < 3; q++) {
          const an = t * 1.5 + i + (q * Math.PI) / 3;
          ctx.moveTo(x - Math.cos(an) * r, y - Math.sin(an) * r);
          ctx.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r);
        }
        ctx.stroke();
      }
      break;
    }

    // ── Mítico: fumo do abismo, tentáculos e olhos ──
    case 'sombra': {
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#05010a';
      ctx.beginPath();
      ctx.ellipse(mx, gy, 110, 24, 0, 0, TAU);
      ctx.fill();
      halo(ctx, s, 78 + pulse * 10, '#0a0212', 0.45);
      halo(ctx, s, 54, c1, 0.6);
      // fumo
      for (let i = 0; i < 14 * m; i++) {
        const ph = (t * 0.45 + hash(i)) % 1;
        const j = JOINTS[i % JOINTS.length];
        const x = X[j] + (hash(i + 3) - 0.5) * 50 + Math.sin(t * 1.3 + i) * 10;
        const y = Y[j] - ph * 90;
        ctx.globalAlpha = (1 - ph) * 0.55;
        ctx.fillStyle = i % 2 ? '#0a0212' : c1;
        ctx.beginPath();
        ctx.arc(x, y, 14 + ph * 28, 0, TAU);
        ctx.fill();
      }
      // tentáculos
      const TN = low ? 2 : 4;
      for (let i = 0; i < TN; i++) {
        const side = i % 2 ? 1 : -1;
        const bx = mx + side * (bw * 0.5 + 6 + (i >> 1) * 26);
        const hgt = 110 + (i >> 1) * 40 + Math.sin(t * 1.4 + i) * 15;
        const SEG = low ? 6 : 9;
        let px = bx;
        let py = gy + 4;
        for (let pass = 0; pass < 2; pass++) {
          px = bx;
          py = gy + 4;
          for (let q = 1; q <= SEG; q++) {
            const u = q / SEG;
            const nx2 = bx + side * (Math.sin(u * 3 + t * 2.2 + i) * 22 * u - u * u * 30 * Math.sin(t * 0.8 + i));
            const ny2 = gy + 4 - u * hgt;
            const w = 18 * (1 - u) + 3;
            ctx.globalAlpha = pass ? 1 : 0.8;
            ctx.strokeStyle = pass ? '#12031f' : c2;
            ctx.lineWidth = pass ? w : w + 6;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(nx2, ny2);
            ctx.stroke();
            px = nx2;
            py = ny2;
          }
        }
      }
      ctx.globalCompositeOperation = ADD;
      halo(ctx, s, 30, c2, 0.3 + pulse * 0.25);
      jointGlow(ctx, s, c2, 0.4, 36, low);
      ctx.globalCompositeOperation = ADD;
      // olhos no fumo
      for (let i = 0; i < (low ? 1 : 3); i++) {
        const cyc = t * 0.25 + i * 0.33;
        const ck = Math.floor(cyc);
        const ph = cyc - ck;
        const vis = Math.min(1, Math.sin(ph * Math.PI) * 2.5);
        if (vis <= 0) continue;
        const side = hash(ck * 3 + i) > 0.5 ? 1 : -1;
        const x = mx + side * (bw * 0.5 + 20 + hash(ck + i * 7) * 30);
        const y = y0 + 10 + hash(ck * 5 + i) * bh * 0.6;
        const blink = (t * 1.3 + i) % 3 < 0.12 ? 0.15 : 1;
        ctx.globalAlpha = vis;
        ctx.drawImage(glowSprite(c2), x - 28, y - 16, 56, 32);
        ctx.fillStyle = c2;
        ctx.beginPath();
        ctx.ellipse(x - 8, y, 5.5, 3.5 * blink, 0.25, 0, TAU);
        ctx.ellipse(x + 8, y, 5.5, 3.5 * blink, -0.25, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 8.7, y - 2.5 * blink, 1.4, 5 * blink);
        ctx.fillRect(x + 7.3, y - 2.5 * blink, 1.4, 5 * blink);
      }
      // brasas roxas
      for (let i = 0; i < 12 * m; i++) {
        const ph = (t * 0.6 + hash(i + 40)) % 1;
        const x = x0 + hash(i + 50) * bw + Math.sin(t * 2 + i) * 10;
        const y = gy - ph * (bh + 60);
        ctx.globalAlpha = 1 - ph;
        ctx.drawImage(glowSprite(c2), x - 8, y - 8, 16, 16);
      }
      ctx.globalCompositeOperation = NORM;
      ellipseRing(ctx, mx, gy, 96 + pulse * 6, c2, 3.5, 0.85);
      shock(ctx, mx, gy, t, 0.5, 120, 40, c2, 5);
      break;
    }

    // ── Celestial: galáxia, anéis orbitais, planetas e círculo de constelações ──
    case 'cosmos':
    default: {
      const hue = t * 45;
      const hc = hueHex(hue, 100, 65);
      const hc2 = hueHex(hue + 140, 100, 65);
      ctx.globalCompositeOperation = ADD;
      ctx.globalAlpha = 0.55;
      ctx.drawImage(glowSprite(c1), mx - bw * 0.5 - 90, y0 - 60, bw + 180, bh + 100);
      ctx.globalAlpha = 0.4;
      ctx.drawImage(glowSprite(c2), cx - 70 + Math.cos(t * 0.7) * 40, cy - 110 + Math.sin(t * 0.7) * 30, 140, 160);
      ctx.globalAlpha = 0.4;
      ctx.drawImage(glowSprite(hc), cx - 70 - Math.cos(t * 0.7) * 40, cy - 50 - Math.sin(t * 0.7) * 30, 140, 160);
      ctx.globalCompositeOperation = NORM;
      // círculo de constelações
      ctx.save();
      ctx.translate(mx, gy);
      ctx.scale(1, 0.27);
      ctx.rotate(t * 0.5);
      ctx.globalAlpha = 0.95;
      ctx.strokeStyle = c2;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, 112, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = hc;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 90, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = c2;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const an = ((i * 5) % 12) / 12 * TAU;
        if (i) ctx.lineTo(Math.cos(an) * 90, Math.sin(an) * 90);
        else ctx.moveTo(Math.cos(an) * 90, Math.sin(an) * 90);
      }
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 12; i++) {
        const an = (i / 12) * TAU;
        ctx.fillRect(Math.cos(an) * 101 - 3, Math.sin(an) * 101 - 6, 6, 12);
      }
      ctx.restore();
      shock(ctx, mx, gy, t, 0.7, 40, 170, hc, 6);
      // halo arco-íris
      halo(ctx, s, 64 + pulse * 10, hc, 0.32);
      halo(ctx, s, 44, c1, 0.55);
      halo(ctx, s, 28, c2, 0.55);
      jointGlow(ctx, s, hc, 0.5, 42, low);
      // anéis orbitais com planetas
      for (let i = 0; i < 2; i++) {
        const tilt = -0.35 + i * 0.75 + Math.sin(t * 0.4 + i) * 0.12;
        const rx = bw * 0.5 + 48 + i * 16;
        const ry = 24 + i * 6;
        ctx.save();
        ctx.translate(cx, cy - 10 + i * 8);
        ctx.rotate(tilt);
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = i ? hc2 : c2;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
        ctx.stroke();
        // poeira estelar no anel
        ctx.fillStyle = '#ffffff';
        for (let q = 0; q < (low ? 4 : 9); q++) {
          const an = t * (1.4 - i * 0.5) + (q / 9) * TAU;
          ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 5 + q);
          ctx.fillRect(Math.cos(an) * rx - 1.5, Math.sin(an) * ry - 1.5, 3, 3);
        }
        const pa = t * (1.1 - i * 0.45) + i * 2.3;
        const px = Math.cos(pa) * rx;
        const py = Math.sin(pa) * ry;
        const pr = i ? 6 : 9;
        ctx.globalCompositeOperation = ADD;
        ctx.globalAlpha = 0.8;
        ctx.drawImage(glowSprite(i ? hc2 : c1), px - pr * 3, py - pr * 3, pr * 6, pr * 6);
        ctx.globalCompositeOperation = NORM;
        ctx.globalAlpha = 1;
        circle(ctx, px, py, pr, i ? hc2 : c1, true);
        if (!i) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(px, py, pr * 1.8, pr * 0.5, -0.4, 0, TAU);
          ctx.stroke();
        }
        ctx.restore();
      }
      // estrelas cintilantes
      for (let i = 0; i < 16 * m; i++) {
        const tw = Math.sin(t * (2 + hash(i + 90) * 3) + i * 1.9);
        if (tw <= 0) continue;
        const x = x0 - 45 + hash(i + 91) * (bw + 90);
        const y = y0 - 35 + hash(i + 92) * (bh + 20);
        const r = 3 + tw * 8;
        ctx.globalAlpha = tw;
        ctx.fillStyle = i % 3 ? c2 : i % 2 ? c1 : hc;
        sparkle(ctx, x, y, r);
        ctx.fillStyle = '#ffffff';
        sparkle(ctx, x, y, r * 0.45);
      }
      // estrela cadente
      const sp = (t * 0.45) % 1;
      if (sp < 0.3) {
        const u = sp / 0.3;
        const sx = x1 + 80 - u * (bw + 180);
        const sy = y0 - 40 + u * bh * 0.6;
        ctx.globalAlpha = 1 - u;
        ctx.strokeStyle = c2;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + 50, sy - 18);
        ctx.stroke();
        ctx.drawImage(glowSprite('#ffffff'), sx - 12, sy - 12, 24, 24);
      }
      break;
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = NORM;
}

// ───────────────────────── Cenários de fundo (menus) ─────────────────────────

function vgrad(ctx: CanvasRenderingContext2D, H: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  for (const [k, c] of stops) g.addColorStop(k, c);
  return g;
}

function stars(ctx: CanvasRenderingContext2D, W: number, H: number, n: number, t: number, maxY = 1) {
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < n; i++) {
    const x = hash(i * 1.7) * W;
    const y = hash(i * 2.3 + 5) * H * maxY;
    const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * (1 + hash(i) * 2) + i));
    ctx.globalAlpha = tw;
    const s = hash(i + 9) < 0.15 ? 2 : 1.2;
    ctx.fillRect(x, y, s, s);
  }
  ctx.globalAlpha = 1;
}

/**
 * Cenário completo atrás do lutador nos menus. `fy` é a altura do chão (onde estão os pés),
 * `k` é a escala do lutador (para dimensionar os elementos).
 */
export function drawBackdrop(ctx: CanvasRenderingContext2D, a: Vis | null, W: number, H: number, t: number, fy: number, k: number) {
  const cx = W / 2;
  const type = a?.type ?? '';
  const c1 = a?.c1 ?? '#7a5cff';
  const c2 = a?.c2 ?? '#ffffff';
  ctx.save();
  switch (type) {
    case 'holofotes': {
      ctx.fillStyle = vgrad(ctx, H, [[0, '#0c0f1c'], [0.7, '#161a2e'], [1, '#07080f']]);
      ctx.fillRect(0, 0, W, H);
      add(ctx, () => {
        for (let i = 0; i < 3; i++) {
          const ox = W * (0.15 + i * 0.35);
          const tx = cx + Math.sin(t * 0.7 + i * 2.1) * W * 0.35;
          ctx.globalAlpha = 0.13;
          ctx.fillStyle = i === 1 ? c2 : c1;
          ctx.beginPath();
          ctx.moveTo(ox - 8, -10);
          ctx.lineTo(ox + 8, -10);
          ctx.lineTo(tx + W * 0.16, fy + 10);
          ctx.lineTo(tx - W * 0.16, fy + 10);
          ctx.fill();
          ctx.globalAlpha = 0.25;
          ctx.drawImage(glowSprite(c2), tx - W * 0.2, fy - H * 0.05, W * 0.4, H * 0.1);
        }
        // poeira no ar
        for (let i = 0; i < 26; i++) {
          const x = (hash(i) * W + t * 6 * (hash(i + 3) - 0.5) * 4 + W) % W;
          const y = (hash(i + 7) * H * 0.9 - t * 4) % H;
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x, (y + H) % H, 1.5, 1.5);
        }
      });
      // silhuetas do público
      ctx.fillStyle = '#05060b';
      for (let i = 0; i < 14; i++) {
        const x = (i / 13) * W;
        const r = (16 + hash(i) * 8) * k;
        const bob = Math.abs(Math.sin(t * 3 + i)) * 4 * k;
        ctx.beginPath();
        ctx.arc(x, H - r * 0.6 - bob, r * 0.55, 0, TAU);
        ctx.fill();
        ctx.fillRect(x - r * 0.8, H - r * 0.3 - bob, r * 1.6, r * 2);
      }
      break;
    }
    case 'neon': {
      const hz = fy - H * 0.12;
      ctx.fillStyle = vgrad(ctx, hz, [[0, '#12052e'], [0.6, '#5a0f6e'], [1, '#ff4f8b']]);
      ctx.fillRect(0, 0, W, hz);
      stars(ctx, W, hz, 30, t, 0.6);
      // sol às riscas
      const sr = Math.min(W, H) * 0.26;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, hz);
      ctx.clip();
      const sg = ctx.createLinearGradient(0, hz - sr * 1.6, 0, hz);
      sg.addColorStop(0, '#ffe45c');
      sg.addColorStop(1, '#ff2f8f');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(cx, hz - sr * 0.35, sr, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#5a0f6e';
      for (let i = 0; i < 6; i++) {
        const y = hz - sr * 0.35 + i * sr * 0.14 + ((t * 8) % (sr * 0.14));
        ctx.fillRect(0, y, W, 2 + i * 1.2);
      }
      ctx.restore();
      // montanhas
      ctx.fillStyle = '#1b0630';
      ctx.beginPath();
      ctx.moveTo(0, hz);
      for (let i = 0; i <= 10; i++) ctx.lineTo((i / 10) * W, hz - (i % 2 ? 0.06 : 0.14) * H * (0.6 + hash(i) * 0.6));
      ctx.lineTo(W, hz);
      ctx.fill();
      // grelha
      ctx.fillStyle = '#12021f';
      ctx.fillRect(0, hz, W, H - hz);
      add(ctx, () => {
        ctx.strokeStyle = c1;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        for (let i = -10; i <= 10; i++) {
          ctx.moveTo(cx + i * W * 0.04, hz);
          ctx.lineTo(cx + i * W * 0.22, H);
        }
        const off = (t * 0.6) % 1;
        for (let j = 0; j < 8; j++) {
          const q = Math.pow((j + off) / 8, 2);
          const y = hz + q * (H - hz);
          ctx.moveTo(0, y);
          ctx.lineTo(W, y);
        }
        ctx.stroke();
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = c2;
        ctx.beginPath();
        ctx.moveTo(0, hz);
        ctx.lineTo(W, hz);
        ctx.stroke();
      });
      break;
    }
    case 'faiscas': {
      ctx.fillStyle = vgrad(ctx, H, [[0, '#1a1006'], [0.6, '#3a2208'], [1, '#120a03']]);
      ctx.fillRect(0, 0, W, H);
      add(ctx, () => {
        for (let i = 0; i < 16; i++) {
          const x = hash(i * 3.3) * W;
          const y = hash(i * 5.1) * H * 0.8;
          const r = (14 + hash(i) * 30) * k;
          ctx.globalAlpha = 0.12 + 0.08 * Math.sin(t + i);
          ctx.drawImage(glowSprite(i % 2 ? c1 : '#ff9a3d'), x - r, y - r, r * 2, r * 2);
        }
        for (let i = 0; i < 40; i++) {
          const ph = (t * (0.15 + hash(i) * 0.2) + hash(i + 2)) % 1;
          const x = hash(i + 11) * W + Math.sin(t * 2 + i) * 10;
          const y = H - ph * H * 1.1;
          ctx.globalAlpha = (1 - ph) * 0.9;
          ctx.fillStyle = i % 3 ? c1 : c2;
          ctx.fillRect(x, y, 2.2, 2.2);
        }
      });
      break;
    }
    case 'petalas': {
      ctx.fillStyle = vgrad(ctx, H, [[0, '#2a1a4a'], [0.55, '#a8507e'], [1, '#ffb3c9']]);
      ctx.fillRect(0, 0, W, H);
      add(ctx, () => {
        ctx.globalAlpha = 0.9;
        ctx.drawImage(glowSprite('#fff2e0'), W * 0.62, H * 0.06, W * 0.34, W * 0.34);
      });
      ctx.fillStyle = '#fff6ec';
      ctx.beginPath();
      ctx.arc(W * 0.79, H * 0.06 + W * 0.17, W * 0.07, 0, TAU);
      ctx.fill();
      // monte distante
      ctx.fillStyle = '#7a3a64';
      ctx.beginPath();
      ctx.moveTo(0, fy);
      ctx.quadraticCurveTo(W * 0.3, fy - H * 0.22, W * 0.55, fy - H * 0.08);
      ctx.quadraticCurveTo(W * 0.8, fy - H * 0.18, W, fy - H * 0.05);
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.fill();
      // ramos de cerejeira
      for (const [sx, dir] of [[0, 1], [W, -1]] as const) {
        ctx.strokeStyle = '#2a1420';
        ctx.lineCap = 'round';
        ctx.lineWidth = 7 * k;
        ctx.beginPath();
        ctx.moveTo(sx, H * 0.12);
        ctx.quadraticCurveTo(sx + dir * W * 0.2, H * 0.1, sx + dir * W * 0.32, H * 0.2);
        ctx.stroke();
        ctx.lineWidth = 3.5 * k;
        ctx.beginPath();
        ctx.moveTo(sx + dir * W * 0.14, H * 0.11);
        ctx.quadraticCurveTo(sx + dir * W * 0.2, H * 0.02, sx + dir * W * 0.28, H * 0.04);
        ctx.stroke();
        for (let i = 0; i < 18; i++) {
          const x = sx + dir * hash(i + (dir > 0 ? 0 : 50)) * W * 0.34;
          const y = H * (0.02 + hash(i * 1.9 + (dir > 0 ? 3 : 70)) * 0.2);
          ctx.fillStyle = i % 3 ? c1 : c2;
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.arc(x, y, (5 + hash(i + 4) * 6) * k, 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      // pétalas a cair
      for (let i = 0; i < 30; i++) {
        const ph = (t * (0.05 + hash(i) * 0.05) + hash(i + 1)) % 1;
        const x = (hash(i + 2) * W + Math.sin(t + i) * 30 + ph * W * 0.3) % W;
        const y = ph * H;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * 2 + i);
        ctx.scale(k, k * (0.4 + Math.abs(Math.sin(t * 2 + i)) * 0.6));
        ctx.fillStyle = i % 3 ? c1 : c2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 5, 3, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      break;
    }
    case 'chamas': {
      ctx.fillStyle = vgrad(ctx, H, [[0, '#120302'], [0.6, '#3a0a04'], [1, '#6a1806']]);
      ctx.fillRect(0, 0, W, H);
      add(ctx, () => {
        ctx.globalAlpha = 0.5;
        ctx.drawImage(glowSprite('#ff5a00'), -W * 0.2, fy - H * 0.5, W * 1.4, H * 0.9);
        for (let i = 0; i < 16; i++) {
          const x = (i / 15) * W;
          ctx.globalAlpha = 0.42;
          flame(ctx, x, fy + 14 * k, 0, -1, (H * 0.18 + hash(i) * H * 0.22), (14 + hash(i + 3) * 10) * k, i % 2 ? c1 : '#ff2a00', '#ff9a1a', t, i);
        }
        for (let i = 0; i < 30; i++) {
          const ph = (t * (0.2 + hash(i) * 0.2) + hash(i + 2)) % 1;
          ctx.globalAlpha = 1 - ph;
          ctx.fillStyle = i % 2 ? c2 : '#ff7a1a';
          ctx.fillRect(hash(i + 5) * W + Math.sin(t * 3 + i) * 12, fy - ph * H, 2.5, 2.5);
        }
      });
      break;
    }
    case 'raio': {
      ctx.fillStyle = vgrad(ctx, H, [[0, '#060a16'], [0.6, '#141f38'], [1, '#0a0f1c']]);
      ctx.fillRect(0, 0, W, H);
      const k2 = Math.floor(t * 1.4);
      const flash = hash(k2) > 0.55 ? Math.max(0, 1 - ((t * 1.4) % 1) * 5) : 0;
      if (flash > 0) {
        ctx.fillStyle = `rgba(170,210,255,${flash * 0.35})`;
        ctx.fillRect(0, 0, W, H);
        add(ctx, () => {
          let x = W * (0.15 + hash(k2 + 3) * 0.7);
          let y = 0;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.globalAlpha = flash;
          ctx.beginPath();
          ctx.moveTo(x, y);
          while (y < fy) {
            x += (hash(x + y) - 0.5) * 50 * k;
            y += 26 * k;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.lineWidth = 10;
          ctx.strokeStyle = c1;
          ctx.globalAlpha = flash * 0.4;
          ctx.stroke();
        });
      }
      // nuvens
      for (let i = 0; i < 9; i++) {
        const x = ((hash(i) * W * 1.4 + t * 8 * (1 + hash(i + 1))) % (W * 1.4)) - W * 0.2;
        const y = H * (0.02 + hash(i + 4) * 0.18);
        const r = (40 + hash(i + 2) * 50) * k;
        ctx.fillStyle = flash > 0 ? '#3a4a70' : '#1c2742';
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.45, 0, 0, TAU);
        ctx.ellipse(x + r * 0.6, y + r * 0.1, r * 0.7, r * 0.35, 0, 0, TAU);
        ctx.fill();
      }
      // chuva
      ctx.strokeStyle = '#9ab8ff';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      for (let i = 0; i < 60; i++) {
        const x = (hash(i) * W + t * 120) % W;
        const y = (hash(i + 7) * H + t * 600 * (0.8 + hash(i) * 0.4)) % H;
        ctx.moveTo(x, y);
        ctx.lineTo(x - 4, y + 14);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    }
    case 'aurora': {
      ctx.fillStyle = vgrad(ctx, H, [[0, '#020814'], [0.7, '#0b1a33'], [1, '#13284a']]);
      ctx.fillRect(0, 0, W, H);
      stars(ctx, W, H, 60, t, 0.7);
      add(ctx, () => {
        for (let b = 0; b < 4; b++) {
          const g = ctx.createLinearGradient(0, H * 0.05, 0, H * 0.55);
          g.addColorStop(0, 'rgba(0,0,0,0)');
          g.addColorStop(0.5, b % 2 ? c2 : c1);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = 0.28;
          ctx.fillStyle = g;
          ctx.beginPath();
          for (let i = 0; i <= 16; i++) {
            const x = (i / 16) * W;
            const y = H * (0.12 + b * 0.05) + Math.sin(t * 0.8 + i * 0.5 + b * 1.7) * H * 0.05;
            if (i) ctx.lineTo(x, y);
            else ctx.moveTo(x, y);
          }
          for (let i = 16; i >= 0; i--) {
            const x = (i / 16) * W;
            const y = H * (0.42 + b * 0.04) + Math.sin(t * 0.6 + i * 0.4 + b) * H * 0.04;
            ctx.lineTo(x, y);
          }
          ctx.fill();
        }
      });
      // montanhas nevadas
      for (const [base, col, amp] of [[fy - H * 0.04, '#1a2c4a', 0.22], [fy + H * 0.02, '#0e1a30', 0.12]] as const) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (let i = 0; i <= 8; i++) ctx.lineTo((i / 8) * W, base - (i % 2 ? amp : amp * 0.3) * H * (0.6 + hash(i + amp * 10) * 0.6));
        ctx.lineTo(W, H);
        ctx.fill();
      }
      break;
    }
    case 'sombra': {
      ctx.fillStyle = vgrad(ctx, H, [[0, '#050208'], [0.6, '#140620'], [1, '#05010a']]);
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 14; i++) {
        const a0 = t * 0.2 + i * 0.9;
        const r = (W * 0.25 + hash(i) * W * 0.3);
        const x = cx + Math.cos(a0) * r;
        const y = H * 0.45 + Math.sin(a0) * r * 0.5;
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = i % 2 ? c1 : '#000000';
        ctx.beginPath();
        ctx.arc(x, y, (40 + hash(i + 3) * 50) * k, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // tentáculos do chão
      ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const sx = (i / 5) * W;
        ctx.strokeStyle = '#0b0214';
        ctx.lineWidth = (16 - (i % 3) * 3) * k;
        ctx.beginPath();
        ctx.moveTo(sx, H);
        ctx.bezierCurveTo(sx + Math.sin(t + i) * 40 * k, H * 0.75, sx - Math.sin(t * 0.8 + i) * 50 * k, H * 0.6, sx + Math.sin(t * 1.2 + i) * 30 * k, H * (0.42 + hash(i) * 0.15));
        ctx.stroke();
      }
      // olhos no escuro
      add(ctx, () => {
        for (let i = 0; i < 6; i++) {
          const x = hash(i * 4.1) * W;
          const y = H * (0.1 + hash(i * 2.7) * 0.4);
          if (Math.abs(x - cx) < W * 0.18) continue;
          const blink = (t + hash(i) * 5) % 4 < 0.15 ? 0.15 : 1;
          ctx.globalAlpha = 0.8;
          ctx.fillStyle = c2;
          const s = 3 * k;
          ctx.beginPath();
          ctx.ellipse(x - s * 2, y, s, s * 0.6 * blink, 0.2, 0, TAU);
          ctx.ellipse(x + s * 2, y, s, s * 0.6 * blink, -0.2, 0, TAU);
          ctx.fill();
          ctx.globalAlpha = 0.3;
          ctx.drawImage(glowSprite(c2), x - s * 8, y - s * 5, s * 16, s * 10);
        }
      });
      break;
    }
    case 'cosmos': {
      ctx.fillStyle = vgrad(ctx, H, [[0, '#03010c'], [1, '#0b0626']]);
      ctx.fillRect(0, 0, W, H);
      stars(ctx, W, H, 80, t);
      add(ctx, () => {
        ctx.globalAlpha = 0.35;
        ctx.drawImage(glowSprite(c1), -W * 0.1, H * 0.05, W * 0.8, H * 0.5);
        ctx.globalAlpha = 0.25;
        ctx.drawImage(glowSprite(c2), W * 0.4, H * 0.3, W * 0.7, H * 0.5);
        // galáxia em espiral
        const gx = cx;
        const gy = H * 0.32;
        for (let i = 0; i < 160; i++) {
          const arm = i % 2;
          const r = (i / 160) * W * 0.42;
          const a = r * 0.03 / k + arm * Math.PI + t * 0.08;
          const x = gx + Math.cos(a) * r + (hash(i) - 0.5) * 10 * k;
          const y = gy + Math.sin(a) * r * 0.35 + (hash(i + 1) - 0.5) * 6 * k;
          ctx.globalAlpha = 0.7 * (1 - i / 200);
          ctx.fillStyle = i % 5 ? '#d8d0ff' : c2;
          ctx.fillRect(x, y, 1.6, 1.6);
        }
        ctx.globalAlpha = 0.7;
        ctx.drawImage(glowSprite('#fff4d0'), gx - 22 * k, gy - 12 * k, 44 * k, 24 * k);
        // estrela cadente
        const ph = (t * 0.35) % 1;
        if (ph < 0.3) {
          const sx = W * (1.1 - ph * 3);
          const sy = H * (0.05 + ph * 0.6);
          ctx.globalAlpha = 1 - ph / 0.3;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + 60 * k, sy - 20 * k);
          ctx.stroke();
        }
      });
      // planeta com anel
      const px = W * 0.16;
      const py = H * 0.62;
      const pr = 26 * k;
      const pg = ctx.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr);
      pg.addColorStop(0, '#ffb36a');
      pg.addColorStop(1, '#7a2a50');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#ffd8a8';
      ctx.lineWidth = 3 * k;
      ctx.beginPath();
      ctx.ellipse(px, py, pr * 1.8, pr * 0.45, -0.3, 0, TAU);
      ctx.stroke();
      break;
    }
    default: {
      const g = ctx.createRadialGradient(cx, fy - H * 0.3, 10, cx, fy - H * 0.3, Math.max(W, H) * 0.75);
      g.addColorStop(0, '#2c2160');
      g.addColorStop(0.6, '#151032');
      g.addColorStop(1, '#0a0818');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      add(ctx, () => {
        ctx.globalAlpha = 0.35;
        ctx.drawImage(glowSprite(c1), cx - W * 0.45, fy - H * 0.12, W * 0.9, H * 0.24);
      });
    }
  }
  // chão / vinheta
  ctx.globalAlpha = 1;
  const vg = ctx.createRadialGradient(cx, H * 0.5, Math.min(W, H) * 0.3, cx, H * 0.5, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath();
  ctx.ellipse(cx, fy, 52 * k, 10 * k, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}
