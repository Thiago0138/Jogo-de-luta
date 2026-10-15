import { shade } from '../data/appearance';
import { ITEMS, type Vis } from '../data/items';
import {
  C, Cam, DL, OC, OW, PS, TAU, ell, glowSprite, hash, poly, proj3D, sheet, sphereRegion, spherePt, spike, tube, viewDir, type Proj,
} from './paint';
import { HEAD_R } from './pose';

/**
 * Peças dos trajes (capas, asas, caudas, capacetes, ombreiras, materiais do corpo).
 * Tudo é descrito em 3D no referencial do tronco/anca/cabeça e projetado por um `Proj`,
 * por isso a mesma peça serve para as lutas (perfil) e para a rotação 360° dos menus.
 */

const R = HEAD_R;

/** Projeção da cabeça nas lutas: a cara é desenhada a 3/4, o que equivale a uma rotação de ~1 rad. */
export const HEAD_YAW_2D = 1.0;
const cam34 = new Cam().set(HEAD_YAW_2D, 0);
export const HEAD_2D: Proj = proj3D(cam34, [0, 0, 0]);

// ───────────────────────── Utilidades ─────────────────────────

/** Cache de tons (evita refazer contas de cor a cada frame). */
const shCache = new Map<string, string>();
function sh(hex: string, amt: number): string {
  const k = hex + amt;
  let v = shCache.get(k);
  if (v === undefined) {
    v = hex.length === 7 ? shade(hex, amt) : hex;
    shCache.set(k, v);
  }
  return v;
}

function lighter(ctx: CanvasRenderingContext2D, f: () => void) {
  if (PS.F) return;
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  f();
  ctx.globalCompositeOperation = prev;
  ctx.globalAlpha = 1;
}

/** Língua de fogo a apontar na direção (ux, uy) do ecrã. */
export function flame(ctx: CanvasRenderingContext2D, x: number, y: number, ux: number, uy: number, h: number, w: number, c1: string, c2: string, t: number, seed: number) {
  const fl = 0.75 + Math.sin(t * 13 + seed * 5.1) * 0.15 + Math.sin(t * 7.3 + seed) * 0.1;
  const hh = h * fl;
  const nx = -uy;
  const ny = ux;
  const sw = Math.sin(t * 9 + seed * 3) * w * 0.5;
  ctx.beginPath();
  ctx.moveTo(x + nx * w, y + ny * w);
  ctx.quadraticCurveTo(x + ux * hh * 0.5 + nx * (w + sw), y + uy * hh * 0.5 + ny * (w + sw), x + ux * hh + nx * sw, y + uy * hh + ny * sw);
  ctx.quadraticCurveTo(x + ux * hh * 0.45 - nx * (w - sw), y + uy * hh * 0.45 - ny * (w - sw), x - nx * w, y - ny * w);
  ctx.quadraticCurveTo(x - ux * w * 0.8, y - uy * w * 0.8, x + nx * w, y + ny * w);
  ctx.fillStyle = PS.SIL ?? c1;
  ctx.fill();
  if (PS.SIL) return;
  ctx.beginPath();
  ctx.moveTo(x + nx * w * 0.5, y + ny * w * 0.5);
  ctx.quadraticCurveTo(x + ux * hh * 0.4 + nx * w * 0.5, y + uy * hh * 0.4 + ny * w * 0.5, x + ux * hh * 0.62 + nx * sw * 0.6, y + uy * hh * 0.62 + ny * sw * 0.6);
  ctx.quadraticCurveTo(x + ux * hh * 0.3 - nx * w * 0.5, y + uy * hh * 0.3 - ny * w * 0.5, x - nx * w * 0.5, y - ny * w * 0.5);
  ctx.fillStyle = c2;
  ctx.fill();
}

/** Estrela de 4 pontas (cintilação de metais, gelo e cosmos). Cor e alfa já definidos por quem chama. */
export function twinkle(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, col: string) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x, y, x + s, y);
  ctx.quadraticCurveTo(x, y, x, y + s);
  ctx.quadraticCurveTo(x, y, x - s, y);
  ctx.quadraticCurveTo(x, y, x, y - s);
  ctx.fill();
  ctx.fillRect(x - s * 0.18, y - s * 0.18, s * 0.36, s * 0.36);
}

const tiles = new Map<string, HTMLCanvasElement>();
/**
 * Mosaico de 64×64 com nebulosa e estrelas (fundo transparente), desenhado uma vez por cor.
 * Repete-se sem costuras: serve de "janela para o espaço" no corpo, nas luvas e nas capas cósmicas.
 */
export function starTile(neb: string): HTMLCanvasElement {
  let c = tiles.get(neb);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.scale(2, 2);
  // nebulosa (repetida nos 4 cantos para não ter costuras)
  const blob = (x: number, y: number, r: number, col: string, a: number) => {
    for (const dx of [-64, 0, 64]) {
      for (const dy of [-64, 0, 64]) {
        const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        gr.addColorStop(0, col);
        gr.addColorStop(1, col + '00');
        g.globalAlpha = a;
        g.fillStyle = gr;
        g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
      }
    }
  };
  blob(18, 20, 22, neb.length === 7 ? neb : '#7a5cff', 0.45);
  blob(46, 44, 18, '#ff4fd8', 0.22);
  blob(50, 12, 12, '#3ee6ff', 0.2);
  g.globalAlpha = 1;
  for (let i = 0; i < 26; i++) {
    const x = hash(i * 3.3 + 1) * 64;
    const y = hash(i * 7.7 + 2) * 64;
    const s = i < 4 ? 1.6 : 0.5 + hash(i * 1.9) * 0.8;
    g.fillStyle = i % 5 === 0 ? '#ffe9a8' : i % 4 === 0 ? '#bfe6ff' : '#ffffff';
    g.globalAlpha = 0.5 + hash(i * 5.1) * 0.5;
    g.beginPath();
    g.arc(x, y, s, 0, TAU);
    g.fill();
    if (i < 4) {
      g.globalAlpha = 0.7;
      g.fillRect(x - 3, y - 0.3, 6, 0.6);
      g.fillRect(x - 0.3, y - 3, 0.6, 6);
    }
  }
  tiles.set(neb, c);
  return c;
}

/** Converte um ponto local em ecrã (atalho). */
const pp = (P: Proj, x: number, y: number, z: number) => P.p(x, y, z);

// ───────────────────────── Materiais do corpo ─────────────────────────

/**
 * Padrão de material desenhado dentro de uma forma já recortada (`ctx.clip`).
 * `M(t, s)` dá o ponto no ecrã: t ao longo do membro (0..1), s de lado a lado (-1..1).
 */
export function matPattern(
  ctx: CanvasRenderingContext2D, o: Vis, M: (t: number, s: number) => [number, number], len: number, t: number, seed: number, belly = false,
) {
  if (PS.F) return;
  const mat = o.mat;
  const c2 = o.c2 ?? '#ffffff';
  const c3 = o.c3 ?? c2;
  const suit = o.suit ?? '#999999';
  const n = Math.max(2, Math.round(len / 14));
  const line = (pts: [number, number][], w: number, col: string, a = 1) => {
    ctx.globalAlpha = a;
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke();
    ctx.globalAlpha = 1;
  };
  /** Cintilações que nascem e morrem em pontos aleatórios do membro. */
  const sparkles = (count: number, speed: number, size: number, col: string, spread = 1.4) => {
    lighter(ctx, () => {
      for (let i = 0; i < count; i++) {
        const u = t * speed + hash(seed * 3.7 + i);
        const ph = u % 1;
        const k = Math.floor(u);
        const p = M(0.1 + hash(k * 7.3 + seed + i) * 0.8, (hash(k * 3.1 + i * 5 + seed) - 0.5) * spread);
        ctx.globalAlpha = Math.sin(ph * Math.PI);
        twinkle(ctx, p[0], p[1], size * (0.5 + Math.sin(ph * Math.PI) * 0.5), col);
      }
    });
  };
  if (belly && (mat === 'dino' || mat === 'shark' || mat === 'dragon' || mat === 'feather')) {
    // barriga clara
    ctx.fillStyle = c2;
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const p = M(0.04 + (i / 8) * 0.8, 0.28);
      if (i) ctx.lineTo(p[0], p[1]);
      else ctx.moveTo(p[0], p[1]);
    }
    for (let i = 8; i >= 0; i--) {
      const p = M(0.04 + (i / 8) * 0.8, 1.3);
      ctx.lineTo(p[0], p[1]);
    }
    ctx.fill();
    if (mat !== 'shark') {
      ctx.strokeStyle = sh(c2, -0.25);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let i = 1; i < 7; i++) {
        const a = M(0.04 + i * 0.11, 0.35);
        const b = M(0.04 + i * 0.11, 1.1);
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
      }
      ctx.stroke();
    }
  }
  switch (mat) {
    case 'lava': {
      const pulse = 0.7 + Math.sin(t * 3 + seed) * 0.25;
      // placas de crosta arrefecida
      ctx.fillStyle = sh(suit, -0.4);
      ctx.beginPath();
      for (let k = 0; k < 2; k++) {
        const tc = 0.22 + k * 0.5 + (hash(seed * 2 + k) - 0.5) * 0.16;
        const sc = (hash(seed * 5 + k) - 0.5) * 0.9;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU;
          const rr = 0.75 + hash(seed + k * 9 + i) * 0.4;
          const p = M(tc + Math.cos(a) * 0.13 * rr, sc + Math.sin(a) * 0.42 * rr);
          if (i) ctx.lineTo(p[0], p[1]);
          else ctx.moveTo(p[0], p[1]);
        }
        ctx.closePath();
      }
      ctx.fill();
      // fendas de magma com fluxo a correr por dentro
      for (let k = 0; k < 2; k++) {
        const pts: [number, number][] = [];
        const s0 = (hash(seed * 7 + k) - 0.5) * 1.2;
        for (let i = 0; i <= n + 1; i++) {
          const tt = i / (n + 1);
          pts.push(M(tt, s0 + (hash(seed * 13 + k * 5 + i) - 0.5) * 0.9));
        }
        lighter(ctx, () => {
          line(pts, 5, c2, 0.5 * pulse);
          line(pts, 2, c3, pulse);
          ctx.setLineDash([3, 9]);
          ctx.lineDashOffset = -t * 22 - seed * 7 - k * 5;
          line(pts, 1.6, '#ffffff', 0.85);
          ctx.setLineDash([]);
          ctx.lineDashOffset = 0;
        });
      }
      lighter(ctx, () => {
        const p = M(0.3 + hash(seed) * 0.4, (hash(seed + 2) - 0.5) * 0.8);
        ctx.globalAlpha = 0.5 * pulse;
        ctx.drawImage(glowSprite(c2), p[0] - 14, p[1] - 14, 28, 28);
      });
      break;
    }
    case 'ice': {
      // facetas de cristal (claras e escuras)
      for (let k = 0; k < 3; k++) {
        const tt = 0.1 + hash(seed + k * 3) * 0.6;
        const a = M(tt, -0.9 + k * 0.3);
        const b = M(tt + 0.28, -0.2 + k * 0.35);
        const c = M(tt + 0.06, 0.7);
        ctx.globalAlpha = k === 2 ? 0.16 : 0.3;
        ctx.fillStyle = k === 2 ? sh(c2, -0.3) : '#ffffff';
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.lineTo(c[0], c[1]);
        ctx.fill();
      }
      const pts: [number, number][] = [];
      for (let i = 0; i <= n; i++) pts.push(M(i / n, (hash(seed * 3 + i) - 0.5) * 1.1));
      line(pts, 1.3, '#ffffff', 0.7);
      // gelo vivo: luz fria que respira lá dentro
      lighter(ctx, () => {
        const p = M(0.5, -0.2);
        ctx.globalAlpha = 0.18 + Math.sin(t * 2 + seed) * 0.08;
        ctx.drawImage(glowSprite('#bff4ff'), p[0] - 16, p[1] - 16, 32, 32);
      });
      sparkles(2, 0.7, 4.5, '#ffffff');
      break;
    }
    case 'metal': {
      const dark = sh(suit, -0.45);
      for (const tt of [0.34, 0.68]) line([M(tt, -1.2), M(tt, 1.2)], 1.8, dark, 0.9);
      for (const tt of [0.28, 0.62]) {
        for (const s of [-0.6, 0.6]) {
          const p = M(tt, s);
          ctx.fillStyle = dark;
          ctx.beginPath();
          ctx.arc(p[0], p[1], 1.5, 0, TAU);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(p[0] - 0.9, p[1] - 0.9, 0.8, 0.8);
        }
      }
      line([M(0.05, -0.55), M(0.95, -0.55)], 2.5, '#ffffff', 0.45);
      // reflexo que varre o metal
      const u = ((t * 0.35 + seed * 0.17) % 1.8) - 0.4;
      lighter(ctx, () => {
        line([M(u - 0.07, -1.3), M(u + 0.07, 1.3)], 6, '#ffffff', 0.18);
        line([M(u - 0.07, -1.3), M(u + 0.07, 1.3)], 1.6, '#ffffff', 0.55);
      });
      if (seed % 3 === 0) lighter(ctx, () => line([M(0.45, 0.2), M(0.6, 0.2)], 2, c2, 0.7 + Math.sin(t * 5 + seed) * 0.3));
      break;
    }
    case 'cosmic': {
      // janela para o espaço: mosaico de nebulosa a deslizar, contínuo entre membros
      const q = [M(0, -1.3), M(1, -1.3), M(0, 1.3), M(1, 1.3)];
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const p of q) {
        x0 = Math.min(x0, p[0]);
        y0 = Math.min(y0, p[1]);
        x1 = Math.max(x1, p[0]);
        y1 = Math.max(y1, p[1]);
      }
      const tile = starTile(c2);
      const ox = (t * 5) % 64;
      const oy = (t * 2) % 64;
      ctx.globalAlpha = 0.95;
      for (let x = Math.floor((x0 - ox) / 64) * 64 + ox; x < x1; x += 64) {
        for (let y = Math.floor((y0 - oy) / 64) * 64 + oy; y < y1; y += 64) ctx.drawImage(tile, x, y, 64, 64);
      }
      ctx.globalAlpha = 1;
      lighter(ctx, () => {
        const p = M(0.3 + hash(seed) * 0.4, hash(seed + 1) - 0.5);
        ctx.globalAlpha = 0.35 + Math.sin(t * 1.5 + seed) * 0.12;
        ctx.drawImage(glowSprite(c2), p[0] - 16, p[1] - 16, 32, 32);
        // estrela cadente ocasional
        const ph = (t * 0.22 + hash(seed * 1.3)) % 1;
        if (ph < 0.12) {
          const k = ph / 0.12;
          const a = M(k * 1.1 - 0.1, -0.8 + k * 1.2);
          const b = M(k * 1.1 - 0.3, -1.1 + k * 1.2);
          line([b, a], 1.6, '#ffffff', Math.sin(k * Math.PI));
        }
      });
      sparkles(2, 0.9, 3.5, '#ffffff', 1.6);
      break;
    }
    case 'dragon':
    case 'dino': {
      const dark = sh(suit, -0.32);
      const light = sh(suit, 0.35);
      const rows = Math.max(2, Math.round(len / 9));
      const arcs = (dt: number, ds: number) => {
        ctx.beginPath();
        for (let i = 0; i < rows; i++) {
          for (let k = -1; k <= 1; k++) {
            const s = k * 0.55 + (i % 2) * 0.27 - 0.6;
            if (s < -1 || s > 0.9) continue;
            const a = M((i + 0.1) / rows + dt, s - 0.22 + ds);
            const b = M((i + 0.75) / rows + dt, s + ds);
            const c = M((i + 0.1) / rows + dt, s + 0.22 + ds);
            ctx.moveTo(a[0], a[1]);
            ctx.quadraticCurveTo(b[0], b[1], c[0], c[1]);
          }
        }
        ctx.stroke();
      };
      // escamas: aresta escura + reflexo claro por cima (relevo)
      ctx.strokeStyle = light;
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.45;
      arcs(-0.03, -0.06);
      ctx.strokeStyle = dark;
      ctx.lineWidth = 1.6;
      ctx.globalAlpha = 0.85;
      arcs(0, 0);
      ctx.globalAlpha = 1;
      if (mat === 'dino') {
        ctx.fillStyle = sh(suit, -0.18);
        for (let i = 0; i < 2; i++) {
          const p = M(0.25 + hash(seed + i) * 0.5, -0.6 + hash(seed * 2 + i) * 0.5);
          ctx.beginPath();
          ctx.ellipse(p[0], p[1], 4, 2.6, hash(seed + i * 4) * 3, 0, TAU);
          ctx.fill();
        }
      } else if (o.anim === 'glow') {
        // veias de energia a pulsar ao longo do membro
        const pts: [number, number][] = [];
        for (let i = 0; i <= n + 1; i++) pts.push(M(i / (n + 1), 0.05 + Math.sin(i * 1.7 + seed) * 0.25));
        lighter(ctx, () => {
          const a = 0.35 + Math.sin(t * 3 + seed) * 0.2;
          line(pts, 3, c2, a * 0.6);
          ctx.setLineDash([2, 10]);
          ctx.lineDashOffset = -t * 16 - seed * 3;
          line(pts, 1.5, c3, 0.9);
          ctx.setLineDash([]);
          ctx.lineDashOffset = 0;
          ctx.globalAlpha = a * 0.6;
          const p = M(0.5, 0);
          ctx.drawImage(glowSprite(c2), p[0] - 14, p[1] - 14, 28, 28);
        });
      }
      break;
    }
    case 'shark': {
      ctx.fillStyle = c2;
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const p = M(i / 6, 0.45);
        if (i) ctx.lineTo(p[0], p[1]);
        else ctx.moveTo(p[0], p[1]);
      }
      for (let i = 6; i >= 0; i--) {
        const p = M(i / 6, 1.3);
        ctx.lineTo(p[0], p[1]);
      }
      ctx.fill();
      // pele lisa e molhada: reflexo comprido
      line([M(0.08, -0.62), M(0.5, -0.7), M(0.92, -0.6)], 2.2, '#ffffff', 0.4);
      if (seed % 4 === 1) {
        // cicatrizes de batalha
        const a = M(0.4, -0.3);
        const b = M(0.55, 0.15);
        const c = M(0.5, -0.4);
        const d = M(0.63, 0.05);
        ctx.strokeStyle = sh(suit, -0.35);
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.moveTo(c[0], c[1]);
        ctx.lineTo(d[0], d[1]);
        ctx.stroke();
      }
      break;
    }
    case 'astro': {
      const dark = sh(suit, -0.25);
      // pregas do tecido almofadado (vinco escuro + aresta clara)
      for (const tt of [0.2, 0.55, 0.85]) {
        for (const [dt, col, w] of [[-0.035, '#ffffff', 1.4], [0, dark, 1.7]] as const) {
          const a = M(tt + dt, -1);
          const b = M(tt + dt + 0.05, 0);
          const c = M(tt + dt, 1);
          ctx.strokeStyle = col;
          ctx.globalAlpha = col === '#ffffff' ? 0.7 : 1;
          ctx.lineWidth = w;
          ctx.beginPath();
          ctx.moveTo(a[0], a[1]);
          ctx.quadraticCurveTo(b[0], b[1], c[0], c[1]);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      line([M(0.02, -0.72), M(0.98, -0.72)], 3, c2, 1);
      ctx.setLineDash([1.4, 1.8]);
      line([M(0.02, -0.52), M(0.98, -0.52)], 0.8, dark, 0.9);
      ctx.setLineDash([]);
      break;
    }
    case 'feather': {
      // penas em escama: filas alternadas (cor por fila), com ráquis e pontas claras
      const rows = n + 1;
      const fe = (i: number, s: number) => {
        const tt = (i + 0.35) / rows;
        const sway = Math.sin(t * 4 + i + s * 2 + seed) * 0.03;
        const b = M(tt - 0.16, s);
        const l = M(tt, s - 0.36);
        const tip = M(tt + 0.13 + sway, s + sway * 3);
        const r = M(tt, s + 0.36);
        ctx.moveTo(b[0], b[1]);
        ctx.quadraticCurveTo(l[0], l[1], tip[0], tip[1]);
        ctx.quadraticCurveTo(r[0], r[1], b[0], b[1]);
      };
      const cols = [-0.75, -0.15, 0.45, 1.05];
      for (let par = 0; par < 2; par++) {
        ctx.beginPath();
        for (let i = par; i < rows; i += 2) for (const s of cols) fe(i, s + (i % 2) * 0.3);
        ctx.fillStyle = par ? c2 : sh(o.c1 ?? suit, 0.08);
        ctx.fill();
        ctx.strokeStyle = sh(o.c1 ?? suit, -0.45);
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.75;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // ráquis
      ctx.strokeStyle = c3;
      ctx.lineWidth = 0.9;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      for (let i = 0; i < rows; i++) {
        for (const s0 of cols) {
          const s = s0 + (i % 2) * 0.3;
          const tt = (i + 0.35) / rows;
          const a = M(tt - 0.12, s);
          const b = M(tt + 0.08, s);
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
        }
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      // brilho de brasa a percorrer as penas
      lighter(ctx, () => {
        const u = (t * 0.5 + hash(seed)) % 1;
        const p = M(u, (hash(seed + 3) - 0.5) * 0.8);
        ctx.globalAlpha = 0.35 + Math.sin(t * 5 + seed) * 0.12;
        ctx.drawImage(glowSprite(c2), p[0] - 18, p[1] - 18, 36, 36);
      });
      if (o.anim === 'fire') sparkles(1, 1.2, 3, c3);
      break;
    }
  }
}

// ───────────────────────── Peças do corpo ─────────────────────────

/**
 * Acrescenta à lista as peças do traje presas ao tronco (origem no ombro) e à anca.
 * `flat` = vista de perfil das lutas: tudo o que é das costas vai para trás do corpo.
 */
export function bodyPieces(
  dl: DL, ctx: CanvasRenderingContext2D, o: Vis, T: Proj, Hp: Proj, t: number, flat: boolean, low = false,
): void {
  const c1 = o.c1 ?? '#888';
  const c2 = o.c2 ?? '#fff';
  const c3 = o.c3 ?? c2;
  const suit = o.suit ?? c1;
  // profundidade de uma peça das costas (em perfil fica sempre atrás)
  const backD = (x: number, y: number, z: number, bias = 0) => (flat ? -60 + z * 0.1 + bias * 0.1 : Tb.p(x, y, z)[2] + bias);
  // as peças das costas assentam atrás do tronco
  const sh = flat ? -15 : -2;
  const Tb: Proj = { p: (x, y, z) => T.p(x + sh, y, z) };

  switch (o.back) {
    case 'cape':
    case 'cape_long':
    case 'royalcape': {
      const long = o.back !== 'cape';
      const L = o.back === 'cape' ? 62 : 112;
      const outer = o.back === 'royalcape' ? '#a3121f' : o.c3 ?? '#c22';
      const inner = o.back === 'royalcape' ? '#5e0a12' : o.c4 ?? shade(outer, -0.35);
      const rows = long ? 6 : 4;
      const cols = 7;
      const grid: number[][][] = [];
      for (let i = 0; i <= rows; i++) {
        const k = i / rows;
        const row: number[][] = [];
        for (let j = 0; j <= cols; j++) {
          const u = j / cols - 0.5;
          const zz = u * (46 + k * 26);
          const wave = Math.sin(t * 3.2 + k * 2.4 + u * 3) * 5 * k;
          const wrap = Math.cos(u * Math.PI) * 6 * (1 - k);
          const bulge = (1 - 4 * u * u) * (6 + 14 * k);
          row.push([-2 - k * (long ? 30 : 20) - wave + wrap * 0.5 - bulge, -3 + k * L * (long ? 0.94 : 1), zz]);
        }
        grid.push(row);
      }
      dl.add(backD(-16, 30, 0, -6), () => {
        sheet(ctx, Tb, grid, outer, inner, 4.5);
        if (o.back === 'royalcape' && !PS.F) {
          // arminho na barra
          const trim: number[][][] = [];
          for (let i = 0; i <= 1; i++) {
            const row: number[][] = [];
            for (let j = 0; j <= cols; j++) {
              const g = grid[rows][j];
              const g2 = grid[rows - 1][j];
              const k = 0.82 + i * 0.18;
              row.push([g2[0] + (g[0] - g2[0]) * (k * 5 - 4), g2[1] + (g[1] - g2[1]) * (k * 5 - 4), g2[2] + (g[2] - g2[2]) * (k * 5 - 4)]);
            }
            trim.push(row);
          }
          sheet(ctx, Tb, trim, '#f7f4ee', '#e2ddd2', 0);
          ctx.fillStyle = '#16121a';
          for (let j = 1; j < cols; j += 2) {
            const p = Tb.p(grid[rows][j][0], grid[rows][j][1] - 7, grid[rows][j][2]);
            ctx.fillRect(p[0] - 1.5, p[1] - 2.5, 3, 5);
          }
        }
        // fecho dourado nos ombros
        for (const zz of [-20, 20]) ell(ctx, Tb, 4, -1, zz, 4.5, 4.5, 4.5, o.back === 'cape' ? (o.c4 ?? '#ffd700') : '#ffd23d', { line: 2 });
      });
      break;
    }
    case 'wings_dragon':
    case 'wings_fire': {
      const fire = o.back === 'wings_fire';
      const flap = Math.sin(t * (fire ? 4 : 3)) * 0.22;
      for (const sd of [-1, 1]) {
        const rx = -12;
        const ry = 6;
        const rz = sd * 8;
        const tips = [
          [-58, -62, 34],
          [-82, -22, 52],
          [-70, 18, 46],
          [-40, 44, 30],
        ].map(([x, y, z]) => [rx + x * (1 - flap * 0.3) * 0.8, ry + y - flap * 26 * (y < 0 ? 1 : 0.3), rz + sd * z * 1.7 * (1 + flap)]);
        const elbow = [rx - 22, ry - 34 - flap * 12, rz + sd * 30 * (1 + flap)];
        const draw = () => {
          // membrana: leque entre os dedos
          const mem = fire ? c1 : shade(c1, -0.05);
          for (let i = 0; i < tips.length - 1; i++) {
            const a = tips[i];
            const b = tips[i + 1];
            const mid = [(a[0] + b[0]) / 2 * 0.82 + rx * 0.18, (a[1] + b[1]) / 2 * 0.82 + ry * 0.18, (a[2] + b[2]) / 2 * 0.82 + rz * 0.18];
            poly(ctx, Tb, [[rx, ry, rz], i === 0 ? elbow : [rx, ry, rz], a, mid, b], i % 2 ? shade(mem, -0.12) : mem, 3);
          }
          if (fire) {
            lighter(ctx, () => {
              for (let i = 0; i < tips.length; i++) {
                const p = pp(Tb, tips[i][0], tips[i][1], tips[i][2]);
                ctx.globalAlpha = 0.85;
                const up = pp(Tb, tips[i][0] - 10, tips[i][1] - 14, tips[i][2]);
                const ux = up[0] - p[0];
                const uy = up[1] - p[1];
                const l = Math.hypot(ux, uy) || 1;
                flame(ctx, p[0], p[1], ux / l, uy / l, 26, 7, c2, c3, t, i + sd * 3);
              }
              const e = pp(Tb, elbow[0], elbow[1], elbow[2]);
              ctx.globalAlpha = 0.5;
              ctx.drawImage(glowSprite(c2), e[0] - 40, e[1] - 40, 80, 80);
            });
          }
          // ossos
          const bone = fire ? c2 : c2;
          tube(ctx, Tb, [[rx, ry, rz], elbow, tips[0]], [4, 3, 1], bone, shade(bone, -0.3), 3);
          for (let i = 1; i < tips.length; i++) tube(ctx, Tb, [elbow, tips[i]], [2.6, 0.8], bone, undefined, 2.5);
          // garra no cotovelo
          const e2 = [elbow[0] + 2, elbow[1] - 10, elbow[2]];
          spike(ctx, Tb, elbow[0], elbow[1], elbow[2], e2[0], e2[1], e2[2], 3, '#f2e6d0', 2);
        };
        dl.add(backD(rx - 30, ry - 10, rz + sd * 30, -14), draw);
      }
      break;
    }
    case 'jetpack': {
      const draw = () => {
        for (const zz of [-9, 9]) {
          ell(ctx, Tb, -24, 16, zz, 8, 19, 8, '#c3ccd8');
          ell(ctx, Tb, -24, 37, zz, 5.5, 3, 5.5, '#2b2f3a', { shade: null, hi: false });
        }
        poly(ctx, Tb, [[-17, 2, -12], [-17, 2, 12], [-17, 30, 12], [-17, 30, -12]], '#59627a', 2.5);
        const b = pp(Tb, -21, 14, 0);
        lighter(ctx, () => {
          ctx.globalAlpha = 0.9;
          ctx.drawImage(glowSprite(c2), b[0] - 7, b[1] - 7, 14, 14);
        });
        // chamas
        lighter(ctx, () => {
          for (const zz of [-9, 9]) {
            const p = pp(Tb, -24, 40, zz);
            const d = pp(Tb, -24, 60, zz);
            const ux = d[0] - p[0];
            const uy = d[1] - p[1];
            const l = Math.hypot(ux, uy) || 1;
            ctx.globalAlpha = 0.9;
            flame(ctx, p[0], p[1], ux / l, uy / l, 34, 6, '#ff7a1a', '#fff3a0', t * 2, zz);
            ctx.globalAlpha = 0.5;
            ctx.drawImage(glowSprite('#4ac8ff'), p[0] - 12, p[1] - 6, 24, 24);
          }
        });
      };
      dl.add(backD(-24, 16, 0, -5), draw);
      break;
    }
    case 'astropack': {
      dl.add(backD(-24, 18, 0, -5), () => {
        ell(ctx, Tb, -24, 18, 0, 10, 24, 19, '#e9edf3');
        poly(ctx, Tb, [[-33, 6, -10], [-33, 6, 10], [-33, 22, 10], [-33, 22, -10]], '#cfd6e2', 2);
        const blink = Math.floor(t * 3) % 3;
        ['#ff4a3d', '#3dff7a', '#3a8bff'].forEach((col, i) => {
          const p = pp(Tb, -34, 10 + i * 5, -5 + i * 5);
          ctx.fillStyle = C(i === blink ? '#ffffff' : col);
          ctx.beginPath();
          ctx.arc(p[0], p[1], 2.2, 0, TAU);
          ctx.fill();
        });
        tube(ctx, Tb, [[-26, -4, 12], [-30, -30, 14]], [1.6, 1], '#9aa4b2', undefined, 2);
        const a = pp(Tb, -30, -31, 14);
        ctx.fillStyle = C(Math.floor(t * 2) % 2 ? '#ff4a3d' : '#ffb0a8');
        ctx.beginPath();
        ctx.arc(a[0], a[1], 2.6, 0, TAU);
        ctx.fill();
      });
      break;
    }
    case 'shield': {
      dl.add(backD(-24, 22, 0, -7), () => {
        ell(ctx, Tb, -23, 24, 0, 3, 30, 23, c2, { shade: shade(c2, -0.4) });
        ell(ctx, Tb, -24, 24, 0, 2, 25, 19, shade(c2, -0.15), { line: 2, shade: null, hi: false });
        ell(ctx, Tb, -26, 24, 0, 3, 6, 6, c3, { line: 2 });
        // águia (raios)
        if (!PS.F) {
          ctx.strokeStyle = c3;
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU + 0.3;
            const p1 = pp(Tb, -25.5, 24 + Math.sin(a) * 8, Math.cos(a) * 8);
            const p2 = pp(Tb, -25.5, 24 + Math.sin(a) * 20, Math.cos(a) * 15);
            ctx.moveTo(p1[0], p1[1]);
            ctx.lineTo(p2[0], p2[1]);
          }
          ctx.stroke();
        }
      });
      break;
    }
    case 'guitar': {
      dl.add(backD(-22, 30, 0, -6), () => {
        tube(ctx, Tb, [[-20, 22, 4], [-18, -30, -16]], [2.8, 2.4], '#6a3a1a', undefined, 3);
        poly(ctx, Tb, [[-18, -30, -16], [-17, -42, -22], [-17, -44, -15], [-18, -32, -12]], '#151518', 2.5);
        ell(ctx, Tb, -21, 40, 7, 4, 15, 14, c2);
        ell(ctx, Tb, -21, 26, 5, 4, 11, 10, c2);
        poly(ctx, Tb, [[-24.5, 30, -2], [-24.5, 44, 4], [-24.5, 40, 14], [-24.5, 28, 10]], '#151518', 2);
        if (!PS.F) {
          const a = pp(Tb, -25, 46, 7);
          const b = pp(Tb, -25, 0, -6);
          ctx.strokeStyle = '#eeeeee';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
          ctx.stroke();
          // raio pintado
          const p = pp(Tb, -25, 38, 9);
          ctx.fillStyle = '#151518';
          ctx.beginPath();
          ctx.moveTo(p[0] - 2, p[1] - 7);
          ctx.lineTo(p[0] + 3, p[1] - 1);
          ctx.lineTo(p[0], p[1]);
          ctx.lineTo(p[0] + 2, p[1] + 7);
          ctx.lineTo(p[0] - 3, p[1] + 1);
          ctx.lineTo(p[0], p[1]);
          ctx.closePath();
          ctx.fill();
        }
      });
      break;
    }
    case 'katana': {
      dl.add(backD(-18, 10, 0, -6), () => {
        tube(ctx, Tb, [[-17, 42, 14], [-17, -22, -12]], [3, 3], '#16141c', '#000', 3);
        ell(ctx, Tb, -17, -23, -12.5, 1.5, 3, 6, '#d4a24a', { line: 2, rot: 0.4 });
        tube(ctx, Tb, [[-17, -24, -13], [-17, -44, -21]], [2.6, 2.6], '#7f1dd1', undefined, 2.5);
        if (!PS.F) {
          ctx.strokeStyle = '#e8e2f0';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          for (let i = 1; i < 5; i++) {
            const p = pp(Tb, -17, -24 - i * 4, -13 - i * 1.6);
            ctx.moveTo(p[0] - 2, p[1] - 1.5);
            ctx.lineTo(p[0] + 2, p[1] + 1.5);
          }
          ctx.stroke();
        }
      });
      break;
    }
    case 'fin': {
      dl.add(backD(-16, 8, 0, -4), () => poly(ctx, Tb, [[-12, 0, 0], [-40, -30, 0], [-34, -24, 0], [-28, 4, 0], [-14, 24, 0]], suit, 3.5));
      break;
    }
    case 'plates': {
      dl.add(backD(-16, 20, 0, -4), () => {
        for (let i = 0; i < 6; i++) {
          const y = -4 + i * 12;
          const h = 12 + Math.sin((i / 5) * Math.PI) * 8;
          poly(ctx, Tb, [[-12, y - 5, 0], [-12 - h * 0.7, y - 4, 0], [-12 - h, y + 2, 0], [-12 - h * 0.6, y + 7, 0], [-12, y + 7, 0]], i % 2 ? c2 : '#e98a2a', 2.5);
        }
      });
      break;
    }
    case 'orbit': {
      const rings = [
        { tilt: 0.35, r: 50, y: -10, spd: 0.6, col: c2 },
        { tilt: -0.5, r: 42, y: 26, spd: -0.9, col: '#7af7ff' },
      ];
      for (const rg of rings) {
        const pts: number[][] = [];
        for (let i = 0; i <= 32; i++) {
          const a = (i / 32) * TAU;
          pts.push([Math.cos(a) * rg.r, rg.y + Math.sin(a) * rg.r * rg.tilt * 0.6, Math.sin(a) * rg.r]);
        }
        const half = (front: boolean) => () => {
          lighter(ctx, () => {
            ctx.strokeStyle = rg.col;
            ctx.lineWidth = 2.2;
            ctx.globalAlpha = 0.75;
            ctx.beginPath();
            let on = false;
            for (const q of pts) {
              const p = T.p(q[0], q[1], q[2]);
              const ok = flat ? (q[2] >= 0) === front : (p[2] >= 0) === front;
              if (ok) {
                if (on) ctx.lineTo(p[0], p[1]);
                else ctx.moveTo(p[0], p[1]);
              }
              on = ok;
            }
            ctx.stroke();
          });
          // planeta
          const a = t * rg.spd + rg.r;
          const q = [Math.cos(a) * rg.r, rg.y + Math.sin(a) * rg.r * rg.tilt * 0.6, Math.sin(a) * rg.r];
          const p = T.p(q[0], q[1], q[2]);
          if ((flat ? q[2] >= 0 : p[2] >= 0) === front) ell(ctx, T, q[0], q[1], q[2], 6, 6, 6, rg.col, { line: 2 });
        };
        dl.add(flat ? -70 : -40, half(false));
        dl.add(flat ? 70 : 40, half(true));
      }
      break;
    }
  }

  // ───── caudas ─────
  if (o.tail) {
    const sw = Math.sin(t * 2.4);
    const sw2 = Math.sin(t * 2.4 - 1);
    let pts: number[][];
    let rad: number[];
    let col = suit;
    switch (o.tail) {
      case 'dino':
        pts = [[-10, 4, 0], [-32, 14, sw * 3], [-56, 26, sw * 8], [-80, 36, sw2 * 14], [-98, 40, sw2 * 18]];
        rad = [14, 12, 9, 5, 1.5];
        break;
      case 'dragon':
        pts = [[-10, 6, 0], [-36, 22, sw * 6], [-60, 30, sw * 12], [-84, 24, sw2 * 16], [-102, 12, sw2 * 22]];
        rad = [7, 6, 4.5, 3, 1.5];
        break;
      case 'shark':
        pts = [[-10, 4, 0], [-30, 12, sw * 5], [-50, 18, sw2 * 10], [-64, 20, sw2 * 14]];
        rad = [11, 8, 5, 3];
        break;
      default:
        pts = [[-10, 4, 0], [-28, 12, sw * 4], [-44, 18, sw * 8]];
        rad = [6, 4, 2];
        col = c1;
    }
    const tip = pts[pts.length - 1];
    dl.add(backD(-40, 20, 0, -3), () => {
      if (o.tail === 'fire') {
        // penas de fogo em leque
        for (let i = 0; i < 5; i++) {
          const a = -0.5 + i * 0.25 + Math.sin(t * 3 + i) * 0.05;
          const L = 70 + (i % 2) * 14;
          const ex = -10 - Math.cos(a) * L;
          const ey = 4 + Math.sin(a) * L * 0.6 + 20;
          const ez = (i - 2) * 6;
          poly(ctx, Hp, [[-10, 2, 0], [(-10 + ex) / 2, (4 + ey) / 2 - 7, ez], [ex, ey, ez * 1.5], [(-10 + ex) / 2, (4 + ey) / 2 + 7, ez]], i % 2 ? c2 : c1, 2.5);
          lighter(ctx, () => {
            const p = Hp.p(ex, ey, ez * 1.5);
            const q = Hp.p(ex - 8, ey + 2, ez * 1.5);
            const ux = q[0] - p[0];
            const uy = q[1] - p[1];
            const l = Math.hypot(ux, uy) || 1;
            ctx.globalAlpha = 0.9;
            flame(ctx, p[0], p[1], ux / l, uy / l, 22, 6, c2, c3, t, i);
          });
        }
        return;
      }
      tube(ctx, Hp, pts, rad, col, shade(col, -0.3));
      if (o.tail === 'dino' || o.tail === 'dragon') {
        for (let i = 1; i < pts.length - 1; i++) {
          const a = pts[i];
          spike(ctx, Hp, a[0], a[1] - rad[i] * 0.8, a[2], a[0] - 4, a[1] - rad[i] - 9, a[2], 4, o.tail === 'dino' ? '#e98a2a' : c2, 2);
        }
      }
      if (o.tail === 'dragon') poly(ctx, Hp, [[tip[0] + 4, tip[1], tip[2]], [tip[0] - 8, tip[1] - 10, tip[2]], [tip[0] - 18, tip[1], tip[2]], [tip[0] - 8, tip[1] + 10, tip[2]]], c2, 2.5);
      if (o.tail === 'shark') poly(ctx, Hp, [[tip[0] + 2, tip[1], tip[2]], [tip[0] - 16, tip[1] - 22, tip[2]], [tip[0] - 10, tip[1], tip[2]], [tip[0] - 14, tip[1] + 14, tip[2]]], col, 3);
    });
  }

  // ───── ombreiras ─────
  if (o.shoulders) {
    for (const sd of [-1, 1]) {
      const z = sd * 22;
      const d = flat ? sd * 60 : T.p(0, 2, z * 1.1)[2] + 2;
      dl.add(d, () => shoulder(ctx, o, T, z, sd, t, low));
    }
  }
}

function shoulder(ctx: CanvasRenderingContext2D, o: Vis, T: Proj, z: number, sd: number, t: number, low: boolean) {
  const c1 = o.c1 ?? '#888';
  const c2 = o.c2 ?? '#fff';
  const c3 = o.c3 ?? c2;
  switch (o.shoulders) {
    case 'samurai': {
      const zz = z + sd * 6;
      poly(ctx, T, [[-12, -6, zz], [12, -6, zz], [14, 22, zz + sd * 5], [-14, 22, zz + sd * 5]], c1, 3);
      if (!PS.F) {
        for (let i = 1; i < 4; i++) {
          const a = pp(T, -13, -6 + i * 7, zz + sd * i * 1.2);
          const b = pp(T, 13, -6 + i * 7, zz + sd * i * 1.2);
          ctx.strokeStyle = c3;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
          ctx.stroke();
        }
      }
      break;
    }
    case 'spikes':
      ell(ctx, T, 0, 0, z, 13, 9, 11, '#26262c');
      for (let i = -1; i <= 1; i++) spike(ctx, T, i * 7, -6, z + sd * 3, i * 9, -20, z + sd * 9, 3.2, '#e8eef5', 2);
      break;
    case 'bronze':
    case 'gold':
      ell(ctx, T, -1, -2, z, 11.5, 8, 11, o.shoulders === 'gold' ? c1 : c2, { rot: -0.2 });
      ell(ctx, T, -1, 4, z + sd * 2, 10, 3, 10, c3, { line: 2, shade: null });
      if (o.shoulders === 'gold') ell(ctx, T, 0, -3, z + sd * 10, 2.8, 2.8, 1.6, '#d6202f', { line: 1.5 });
      break;
    case 'rock': {
      ell(ctx, T, -3, -2, z, 13, 11, 12, '#3a2620', { rot: 0.3 });
      ell(ctx, T, 6, -8, z + sd * 4, 8, 7, 8, '#4a3228');
      if (!PS.F) {
        lighter(ctx, () => {
          const a = pp(T, -8, -6, z + sd * 11);
          const b = pp(T, 2, 2, z + sd * 12);
          const c = pp(T, 8, -4, z + sd * 11);
          ctx.globalAlpha = 0.6 + Math.sin(t * 3) * 0.3;
          ctx.strokeStyle = c2;
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
          ctx.lineTo(c[0], c[1]);
          ctx.stroke();
          if (!low) {
            const p = pp(T, 0, -14 - ((t * 20) % 30), z);
            ctx.globalAlpha = 0.8 * (1 - ((t * 20) % 30) / 30);
            ctx.fillStyle = c3;
            ctx.fillRect(p[0] - 1.5, p[1] - 1.5, 3, 3);
          }
        });
      }
      break;
    }
    case 'crystals':
      for (let i = 0; i < 3; i++) {
        const a = (i - 1) * 0.7;
        spike(ctx, T, Math.sin(a) * 6, -2, z, Math.sin(a) * 14, -22 - (i === 1 ? 8 : 0), z + sd * 12, 4.5, i === 1 ? '#e8f8ff' : c1, 2);
      }
      if (!PS.F) {
        lighter(ctx, () => {
          const p = pp(T, 0, -10, z);
          ctx.globalAlpha = 0.35;
          ctx.drawImage(glowSprite(c2), p[0] - 18, p[1] - 18, 36, 36);
        });
      }
      break;
    case 'mecha':
      poly(ctx, T, [[-14, 4, z], [-10, -12, z + sd * 2], [10, -14, z + sd * 2], [16, 2, z], [6, 12, z + sd * 4], [-8, 12, z + sd * 4]], '#9aa6b8', 3);
      if (!PS.F) {
        lighter(ctx, () => {
          const a = pp(T, -8, -2, z + sd * 4);
          const b = pp(T, 8, -4, z + sd * 4);
          ctx.strokeStyle = c2;
          ctx.lineWidth = 2.6;
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
          ctx.stroke();
        });
      }
      break;
  }
}

// ───────────────────────── Emblemas do peito ─────────────────────────

/**
 * Desenha um emblema num referencial afim: centro (cx, cy), vetor "direita" (rx, ry) e "cima" (ux, uy),
 * ambos com o comprimento de 1 unidade do emblema (o escorço vem destes vetores).
 */
export function chestDecal(
  ctx: CanvasRenderingContext2D, o: Vis, cx: number, cy: number, rx: number, ry: number, ux: number, uy: number, t: number,
) {
  if (!o.chest) return;
  ctx.save();
  ctx.transform(rx, ry, -ux, -uy, cx, cy);
  const c2 = o.c2 ?? '#ffd23d';
  ctx.lineJoin = 'round';
  switch (o.chest) {
    case 'emblem': {
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(12, -4);
      ctx.lineTo(0, 12);
      ctx.lineTo(-12, -4);
      ctx.closePath();
      ctx.fillStyle = C(c2);
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = OC();
      ctx.stroke();
      ctx.fillStyle = C(o.c1 ?? '#d22');
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 ? 2.6 : 6;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r - 1);
      }
      ctx.fill();
      break;
    }
    case 'medal':
      ctx.strokeStyle = C('#e2b44a');
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-10, -22);
      ctx.quadraticCurveTo(0, -4, 10, -22);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -2, 6.5, 0, TAU);
      ctx.fillStyle = C('#ffd23d');
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = OC();
      ctx.stroke();
      if (!PS.F) {
        ctx.fillStyle = '#b07d00';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('1', 0, -1.5);
      }
      break;
    case 'panel':
      ctx.fillStyle = C('#cfd6e2');
      ctx.beginPath();
      ctx.roundRect(-10, -8, 20, 15, 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = OC();
      ctx.stroke();
      if (!PS.F) {
        const b = Math.floor(t * 4);
        ['#ff4a3d', '#3dff7a', '#ffd23d', '#3a8bff'].forEach((c, i) => {
          ctx.fillStyle = (b + i) % 4 === 0 ? '#ffffff' : c;
          ctx.fillRect(-7 + i * 4, -4, 3, 3);
        });
        ctx.fillStyle = '#1a1d26';
        ctx.fillRect(-7, 1, 14, 3);
      }
      break;
    case 'core': {
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, TAU);
      ctx.fillStyle = C('#59627a');
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = OC();
      ctx.stroke();
      if (!PS.F) {
        const prev = ctx.globalCompositeOperation;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.8 + Math.sin(t * 6) * 0.2;
        ctx.drawImage(glowSprite(c2), -18, -18, 36, 36);
        ctx.fillStyle = '#e8ffff';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = c2;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + t;
          ctx.moveTo(Math.cos(a) * 4.5, Math.sin(a) * 4.5);
          ctx.lineTo(Math.cos(a) * 7, Math.sin(a) * 7);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = prev;
      }
      break;
    }
  }
  ctx.restore();
}

// ───────────────────────── Peças da cabeça ─────────────────────────

const HIDE_HAIR = new Set(['ninja', 'kabuto', 'galea', 'robo', 'lava', 'ice', 'fenix', 'shark', 'dino']);
const HIDE_MASK = new Set(['ninja', 'kabuto', 'galea', 'robo', 'lava', 'ice', 'fenix', 'shark', 'dino', 'astro']);

export const hidesHair = (o: Vis) => !!o.head && HIDE_HAIR.has(o.head);
export const hidesMask = (o: Vis) => !!o.head && HIDE_MASK.has(o.head);

/** O traje muda a cabeça (capacete, capuz ou pele de material)? Usado nos menus de aparência. */
export function coversHead(outfitId: string): boolean {
  const o = ITEMS[outfitId]?.vis;
  if (!o) return false;
  return hidesHair(o) || hidesMask(o) || o.mat === 'lava' || o.mat === 'ice' || o.mat === 'cosmic';
}

/**
 * Capuz esférico com uma abertura na frente (para a cara espreitar).
 * A abertura é um disco tangente à esfera, projetado com escorço.
 */
function hood(
  ctx: CanvasRenderingContext2D, H: Proj, cx: number, cy: number, rr: number, col: string,
  hole: { lat: number; ry: number; rz: number } | null,
) {
  const c = H.p(cx, cy, 0);
  ctx.save();
  ctx.beginPath();
  ctx.arc(c[0], c[1], rr, 0, TAU);
  ctx.lineWidth = OW;
  ctx.strokeStyle = OC();
  ctx.stroke();
  ctx.clip();
  ctx.beginPath();
  ctx.arc(c[0], c[1], rr + 4, 0, TAU);
  let hx = 0, hy = 0, h1 = 0, h2 = 0, ha = 0;
  let hasHole = false;
  if (hole) {
    const v = viewDir(H);
    const nx = Math.cos(hole.lat);
    const ny = Math.sin(hole.lat);
    const facing = nx * v[0] + ny * v[1];
    if (facing > 0.04) {
      hasHole = true;
      const ox = cx + nx * (rr - 2);
      const oy = cy + ny * (rr - 2);
      const o = H.p(ox, oy, 0);
      const a = H.p(ox - ny * hole.ry, oy + nx * hole.ry, 0);
      const b = H.p(ox, oy, hole.rz);
      const ax = a[0] - o[0], ay = a[1] - o[1], bx = b[0] - o[0], by = b[1] - o[1];
      const m11 = ax * ax + bx * bx, m22 = ay * ay + by * by, m12 = ax * ay + bx * by;
      const tr = (m11 + m22) / 2;
      const q = Math.sqrt(Math.max(0, tr * tr - (m11 * m22 - m12 * m12)));
      hx = o[0];
      hy = o[1];
      h1 = Math.sqrt(tr + q);
      h2 = Math.sqrt(Math.max(0, tr - q));
      ha = 0.5 * Math.atan2(2 * m12, m11 - m22);
      ctx.moveTo(hx + Math.cos(ha) * h1, hy + Math.sin(ha) * h1);
      ctx.ellipse(hx, hy, h1, Math.max(0.5, h2), ha, 0, TAU, true);
    }
  }
  ctx.fillStyle = C(col);
  ctx.fill('evenodd');
  if (!PS.F) {
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = shade(col, -0.35);
    ctx.beginPath();
    ctx.arc(c[0] - rr * 0.35, c[1] + rr * 0.3, rr, 0, TAU);
    ctx.arc(c[0], c[1], rr + 6, 0, TAU, true);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  if (hasHole) {
    ctx.beginPath();
    ctx.ellipse(hx, hy, h1, Math.max(0.5, h2), ha, 0, TAU);
    ctx.lineWidth = 3;
    ctx.strokeStyle = OC();
    ctx.stroke();
  }
  return hasHole ? { hx, hy, h1, h2, ha } : null;
}

/** Calota de capacete: esfera cortada pelo plano horizontal y = ringY (local). */
function capDome(ctx: CanvasRenderingContext2D, H: Proj, cx: number, cy: number, rr: number, ringY: number, col: string) {
  const c = H.p(cx, cy, 0);
  const dy = ringY - cy;
  const rr2 = Math.sqrt(Math.max(1, rr * rr - dy * dy));
  const o = H.p(cx, ringY, 0);
  const a = H.p(cx + rr2, ringY, 0);
  const b = H.p(cx, ringY, rr2);
  const ax = a[0] - o[0], ay = a[1] - o[1], bx = b[0] - o[0], by = b[1] - o[1];
  const m11 = ax * ax + bx * bx, m22 = ay * ay + by * by, m12 = ax * ay + bx * by;
  const tr = (m11 + m22) / 2;
  const q = Math.sqrt(Math.max(0, tr * tr - (m11 * m22 - m12 * m12)));
  const e1 = Math.sqrt(tr + q);
  const e2 = Math.sqrt(Math.max(0, tr - q));
  const ea = 0.5 * Math.atan2(2 * m12, m11 - m22);
  // semiplano do lado do topo
  const top = H.p(cx, cy - rr, 0);
  const lx = Math.cos(ea);
  const ly = Math.sin(ea);
  let nx = -ly;
  let ny = lx;
  if ((top[0] - o[0]) * nx + (top[1] - o[1]) * ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  const big = rr * 3;
  const half = () => {
    ctx.beginPath();
    ctx.moveTo(o[0] - lx * big, o[1] - ly * big);
    ctx.lineTo(o[0] + lx * big, o[1] + ly * big);
    ctx.lineTo(o[0] + lx * big + nx * big, o[1] + ly * big + ny * big);
    ctx.lineTo(o[0] - lx * big + nx * big, o[1] - ly * big + ny * big);
    ctx.closePath();
  };
  const ringPath = () => {
    ctx.beginPath();
    ctx.ellipse(o[0], o[1], e1, Math.max(0.3, e2), ea, 0, TAU);
  };
  ctx.lineWidth = OW;
  ctx.strokeStyle = OC();
  ctx.save();
  half();
  ctx.clip();
  ctx.beginPath();
  ctx.arc(c[0], c[1], rr, 0, TAU);
  ctx.stroke();
  ctx.restore();
  ringPath();
  ctx.stroke();
  ctx.save();
  half();
  ctx.clip();
  ctx.beginPath();
  ctx.arc(c[0], c[1], rr, 0, TAU);
  ctx.fillStyle = C(col);
  ctx.fill();
  if (!PS.F) {
    ctx.clip();
    ctx.globalAlpha = 0.38;
    ctx.fillStyle = shade(col, -0.4);
    ctx.beginPath();
    ctx.arc(c[0] + rr * 0.45, c[1] + rr * 0.15, rr * 0.9, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(c[0] - rr * 0.3, c[1] - rr * 0.55, rr * 0.3, rr * 0.12, -0.5, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  ringPath();
  ctx.fillStyle = C(shade(col, -0.12));
  ctx.fill();
}

/** Pontos de um anel horizontal (y constante) à volta da cabeça. */
function ringAt(y: number, r: number, a: number): number[] {
  return [Math.cos(a) * r, y, Math.sin(a) * r];
}

export type HeadPhase = 'back' | 'skin' | 'front';

/**
 * Peças da cabeça do traje no referencial da cabeça (origem no centro do crânio, raio HEAD_R).
 * Chamado três vezes: 'back' (antes da cabeça), 'skin' (por cima da pele, antes da cara)
 * e 'front' (no fim).
 */
export function headPieces(ctx: CanvasRenderingContext2D, o: Vis, H: Proj, t: number, phase: HeadPhase, eyes?: () => void) {
  const head = o.head;
  if (!head) return;
  const c1 = o.c1 ?? '#888';
  const c2 = o.c2 ?? '#fff';
  const c3 = o.c3 ?? c2;
  const suit = o.suit ?? c1;
  const D0 = H.p(0, 0, 0)[2];
  const behind = (x: number, y: number, z: number) => H.p(x, y, z)[2] < D0;
  const byDepth = (x: number, y: number, z: number, f: () => void) => {
    if ((phase === 'back') === behind(x, y, z) && phase !== 'skin') f();
  };

  switch (head) {
    case 'bandana': {
      if (phase === 'front') {
        sphereRegion(ctx, H, R + 3, 0, 0, TAU, () => -0.66, () => -0.4, c2, { line: 2.5, n: 30, m: 2 });
      }
      for (const sd of [-1, 1]) {
        byDepth(-28, -12, sd * 4, () => tube(ctx, H, [[-27, -13, 0], [-40, -6 + Math.sin(t * 5 + sd) * 2, sd * 6], [-48, 6, sd * 9]], [3, 2.5, 1.5], c2, undefined, 2.5));
      }
      break;
    }
    case 'domino':
      if (phase === 'skin') sphereRegion(ctx, H, R + 0.5, 0, -1.05, 1.05, (l) => -0.24 - Math.abs(l) * 0.04, (l) => 0.1 - Math.abs(l) * 0.06, '#16121a', { line: 2, n: 20, m: 2 });
      for (const sd of [-1, 1]) byDepth(-26, -2, sd * 6, () => tube(ctx, H, [[-24, -2, sd * 12], [-36, 4 + Math.sin(t * 5 + sd) * 2, sd * 10], [-44, 14, sd * 8]], [2.4, 2, 1.2], '#16121a', undefined, 2));
      break;
    case 'ninja':
      if (phase === 'front') {
        ell(ctx, H, 10, 16, 0, 20, 17, 21, c1, { line: OW });
        hood(ctx, H, -1, -2, R + 4, c1, { lat: -0.04, ry: 8.5, rz: 22 });
      }
      for (const sd of [-1, 1]) byDepth(-30, -6, sd * 4, () => tube(ctx, H, [[-29, -6, sd * 3], [-42, 2 + Math.sin(t * 5 + sd) * 3, sd * 8], [-52, 14, sd * 10]], [3.5, 3, 1.5], c2, undefined, 2.5));
      break;
    case 'kabuto': {
      // proteção do pescoço (shikoro): duas metades ordenadas pela profundidade
      for (const half of [0, 1]) {
        const a0 = half ? Math.PI : 0.95;
        const a1 = half ? TAU - 0.95 : Math.PI;
        const mid = (a0 + a1) / 2;
        const m = ringAt(-4, R + 6, mid);
        byDepth(m[0], m[1], m[2], () => {
          const grid: number[][][] = [];
          for (let i = 0; i <= 2; i++) {
            const row: number[][] = [];
            for (let j = 0; j <= 5; j++) {
              const a = a0 + ((a1 - a0) * j) / 5;
              row.push(ringAt(-6 + i * 11, R + 5 + i * 6, a));
            }
            grid.push(row);
          }
          sheet(ctx, H, grid, c1, shade(c1, -0.35), 3.5);
        });
      }
      if (phase === 'front') {
        capDome(ctx, H, -1, -4, R + 5, -6, '#1a1a1a');
        // pala
        const brim: number[][][] = [];
        for (let i = 0; i <= 1; i++) {
          const row: number[][] = [];
          for (let j = 0; j <= 6; j++) {
            const a = -0.9 + (1.8 * j) / 6;
            row.push(ringAt(-6 + i * 2, R + 5 + i * 7, a));
          }
          brim.push(row);
        }
        sheet(ctx, H, brim, '#1a1a1a', '#0b0b0b', 3);
        // crista dourada (kuwagata)
        for (const sd of [-1, 1]) {
          poly(ctx, H, [[R + 3, -12, sd * 2], [R + 6, -30, sd * 10], [R + 8, -50, sd * 24], [R + 6, -46, sd * 26], [R + 3, -26, sd * 14], [R + 1, -12, sd * 7]], c3, 2.5);
        }
        ell(ctx, H, R + 5, -12, 0, 2, 5, 5, c3, { line: 2 });
        ell(ctx, H, R + 6, -12, 0, 1, 2.5, 2.5, o.c1 ?? '#a3121f', { line: 0, shade: null, hi: false });
      }
      break;
    }
    case 'galea': {
      for (const sd of [-1, 1]) {
        byDepth(10, 8, sd * (R + 2), () => poly(ctx, H, [[2, -6, sd * (R + 2)], [16, -6, sd * (R - 2)], [18, 14, sd * (R - 6)], [10, 24, sd * (R - 6)], [2, 16, sd * (R + 1)]], c2, 3));
      }
      if (phase === 'front') {
        capDome(ctx, H, -1, -3, R + 4.5, -5, c2);
        tube(ctx, H, [ringAt(-5, R + 5, -1.1), ringAt(-6, R + 6, -0.4), ringAt(-6.5, R + 6.5, 0), ringAt(-6, R + 6, 0.4), ringAt(-5, R + 5, 1.1)], [2.2, 2.6, 2.8, 2.6, 2.2], c3, undefined, 2.5);
        // penacho
        const pts: number[][] = [];
        for (let i = 0; i <= 10; i++) {
          const a = -0.15 - (i / 10) * 2.3;
          const r1 = R + 5;
          pts.push([Math.cos(a) * r1, Math.sin(a) * r1 - 3, 0]);
        }
        const plume: number[][] = [...pts];
        for (let i = 10; i >= 0; i--) {
          const a = -0.15 - (i / 10) * 2.3;
          const r2 = R + 20 + (i % 2) * 4 + Math.sin(t * 6 + i) * 1;
          plume.push([Math.cos(a) * r2 - 2, Math.sin(a) * r2 - 6, 0]);
        }
        for (const zz of [-4, 4, 0]) poly(ctx, H, plume.map((q) => [q[0], q[1], zz]), zz ? '#9e0c1c' : '#c4122c', 3);
        if (!PS.F) {
          ctx.strokeStyle = '#7a0a16';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          for (let i = 1; i < 10; i += 2) {
            const p = H.p(pts[i][0], pts[i][1], 0);
            const q = H.p(plume[20 - i][0], plume[20 - i][1], 0);
            ctx.moveTo(p[0], p[1]);
            ctx.lineTo(q[0], q[1]);
          }
          ctx.stroke();
        }
      }
      break;
    }
    case 'crown':
      if (phase === 'front') {
        const dl = new DL();
        const n = 16;
        const grid: number[][][] = [];
        for (let i = 0; i <= 1; i++) {
          const row: number[][] = [];
          for (let j = 0; j <= n; j++) row.push(ringAt(-30 + i * 10, 19 + i * 2, (j / n) * TAU));
          grid.push(row);
        }
        dl.add(0, () => sheet(ctx, H, grid, '#ffd23d', '#b8860b', 3));
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * TAU;
          const b = ringAt(-30, 19, a);
          const tp = ringAt(-44, 20, a);
          const d = H.p(b[0], b[1], b[2])[2] - D0;
          dl.add(d * 0.01 + (d > 0 ? 1 : -1), () => {
            const ta = [-Math.sin(a) * 5, 0, Math.cos(a) * 5];
            poly(ctx, H, [[b[0] - ta[0], b[1], b[2] - ta[2]], tp, [b[0] + ta[0], b[1], b[2] + ta[2]]], '#ffd23d', 2.5);
            ell(ctx, H, tp[0], tp[1], tp[2], 2.6, 2.6, 2.6, '#fff3b0', { line: 2, shade: null });
            if (d > 0) {
              const g = ringAt(-25, 20.6, a);
              ell(ctx, H, g[0], g[1], g[2], 2.6, 2.6, 2.6, k % 2 ? '#d6202f' : '#2a7bff', { line: 1.5, shade: null });
            }
          });
        }
        dl.flush();
      }
      break;
    case 'horns':
      for (const sd of [-1, 1]) {
        const base = [6, -22, sd * 15];
        byDepth(base[0] - 10, base[1], base[2], () =>
          tube(ctx, H, [base, [-6, -36, sd * 20], [-22, -42, sd * 22], [-34, -38, sd * 22]], [6.5, 4.6, 2.6, 0.6], '#f2e6d0', '#b8a888', 3),
        );
      }
      if (phase === 'skin' && o.mat === 'dragon') {
        // escamas na testa
        sphereRegion(ctx, H, R + 0.5, 0, -0.5, 0.5, () => -0.95, () => -0.62, c1, { line: 2, n: 8, m: 2, alpha: 0.85 });
      }
      break;
    case 'astro':
      if (phase === 'back') ell(ctx, H, -2, -2, 0, 38, 38, 38, '#9fd3ff', { alpha: 0.12, line: 0, shade: null, hi: false });
      if (phase === 'front') {
        // gola
        ell(ctx, H, 2, 33, 0, 22, 6, 22, '#d9dde6', { line: 3 });
        ell(ctx, H, 2, 31, 0, 17, 3.5, 17, '#59627a', { line: 2, shade: null, hi: false });
        const c = H.p(2, -2, 0);
        ctx.beginPath();
        ctx.arc(c[0], c[1], 39, 0, TAU);
        ctx.lineWidth = 7;
        ctx.strokeStyle = OC();
        ctx.stroke();
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = C('#e8eef5');
        ctx.stroke();
        if (!PS.F) {
          ctx.fillStyle = '#9fd3ff';
          ctx.globalAlpha = 0.16;
          ctx.fill();
          ctx.globalAlpha = 0.75;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(c[0], c[1], 31, Math.PI * 1.08, Math.PI * 1.42);
          ctx.stroke();
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(c[0], c[1], 31, Math.PI * 1.5, Math.PI * 1.56);
          ctx.stroke();
          ctx.globalAlpha = 0.25;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.ellipse(c[0] + 14, c[1] + 16, 10, 5, -0.7, 0, TAU);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      break;
    case 'shark':
    case 'dino': {
      const dino = head === 'dino';
      if (phase === 'back' && dino) {
        // olhos no topo do capuz que ficam atrás
        dinoEyes(ctx, H, c1, true, D0);
      }
      if (phase !== 'front') break;
      // maxila de baixo
      ell(ctx, H, 13, 32, 0, 22, 7.5, 21, dino ? c2 : o.c2 ?? '#eee', { line: OW });
      teethRow(ctx, H, 13, 26, 21, 19, -1.25, 1.25, 7, -1, 4.5);
      const hl = hood(ctx, H, -3, -5, R + 6, suit, { lat: 0.22, ry: 19, rz: 19 });
      if (dino) {
        // focinho de cima com dentes
        ell(ctx, H, 24, -15, 0, 25, 12, 21, suit, { rot: -0.08 });
        teethRow(ctx, H, 24, -4, 23, 19, -1.2, 1.2, 9, 1, 6);
        for (const sd of [-1, 1]) {
          const p = H.p(46, -18, sd * 6);
          if (H.p(46, -18, sd * 6)[2] > D0 - 10) {
            ctx.fillStyle = C('#1a1220');
            ctx.beginPath();
            ctx.ellipse(p[0], p[1], 2.2, 1.6, 0, 0, TAU);
            ctx.fill();
          }
        }
        dinoEyes(ctx, H, c1, false, D0);
      } else {
        teethRing(ctx, hl);
        ell(ctx, H, 22, -22, 0, 16, 9, 13, suit, { rot: -0.25 });
        for (const sd of [-1, 1]) {
          const e = spherePt(H, R + 6, -5, sd * 1.2, -0.42);
          if (e[3] > 0.05) {
            ctx.fillStyle = C('#0b0b10');
            ctx.beginPath();
            ctx.ellipse(e[0], e[1], 4 * Math.max(0.3, e[3]), 4, 0, 0, TAU);
            ctx.fill();
            if (!PS.F) {
              ctx.fillStyle = '#fff';
              ctx.beginPath();
              ctx.arc(e[0] - 1, e[1] - 1.5, 1.2, 0, TAU);
              ctx.fill();
            }
          }
          // guelras
          if (!PS.F) {
            ctx.strokeStyle = shade(suit, -0.4);
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            for (let i = 0; i < 3; i++) {
              let first = true;
              for (let k = 0; k <= 4; k++) {
                const g = spherePt(H, R + 6, -5, sd * (1.75 + i * 0.16), 0.05 + k * 0.1);
                if (g[3] <= 0) {
                  first = true;
                  continue;
                }
                if (first) ctx.moveTo(g[0], g[1]);
                else ctx.lineTo(g[0], g[1]);
                first = false;
              }
            }
            ctx.stroke();
          }
        }
      }
      break;
    }
    case 'robo': {
      if (phase === 'front') {
        ell(ctx, H, 8, 16, 0, 20, 17, 20, '#9aa6b8', { line: OW });
        ell(ctx, H, -1, -2, 0, R + 4, R + 4, R + 4, '#c3ccd8', { line: OW });
        sphereRegion(ctx, H, R + 4.5, -2, -1.0, 1.0, (l) => -0.24 - Math.abs(l) * 0.05, () => 0.12, '#0a1a22', { line: 3, n: 18, m: 2 });
        // varrimento do visor
        if (!PS.F) {
          lighter(ctx, () => {
            const k = Math.sin(t * 2.5) * 0.8;
            const p = spherePt(H, R + 5, -2, k, -0.06);
            if (p[3] > 0) {
              ctx.globalAlpha = 0.95;
              ctx.drawImage(glowSprite(c2), p[0] - 14, p[1] - 10, 28, 20);
            }
            for (let i = 0; i <= 8; i++) {
              const q = spherePt(H, R + 5, -2, -0.9 + i * 0.225, -0.06);
              if (q[3] <= 0) continue;
              ctx.globalAlpha = 0.55;
              ctx.fillStyle = c2;
              ctx.fillRect(q[0] - 2.5, q[1] - 1.5, 5, 3);
            }
          });
        }
        // grelha da boca
        if (!PS.F) {
          ctx.strokeStyle = '#59627a';
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = 0; i < 3; i++) {
            let first = true;
            for (let k = 0; k <= 4; k++) {
              const g = spherePt(H, R + 4, -2, -0.35 + k * 0.175, 0.42 + i * 0.1);
              if (g[3] <= 0.05) {
                first = true;
                continue;
              }
              if (first) ctx.moveTo(g[0], g[1]);
              else ctx.lineTo(g[0], g[1]);
              first = false;
            }
          }
          ctx.stroke();
        }
      }
      for (const sd of [-1, 1]) {
        byDepth(0, -2, sd * (R + 5), () => {
          ell(ctx, H, 0, -2, sd * (R + 5), 9, 9, 3, '#59627a', { line: 3 });
          ell(ctx, H, 0, -2, sd * (R + 7), 4, 4, 1.5, Math.floor(t * 2) % 2 ? c3 : c2, { line: 1.5, shade: null });
        });
      }
      byDepth(-2, -34, 0, () => {
        tube(ctx, H, [[-2, -30, 0], [-6, -48, 0]], [2, 1.4], '#9aa6b8', undefined, 2.5);
        ell(ctx, H, -6, -50, 0, 3.5, 3.5, 3.5, Math.floor(t * 3) % 2 ? c3 : '#ffb0a8', { line: 2 });
      });
      break;
    }
    case 'lava':
      if (phase === 'skin' && !PS.F) {
        lighter(ctx, () => {
          ctx.strokeStyle = c2;
          ctx.globalAlpha = 0.6 + Math.sin(t * 3) * 0.3;
          ctx.lineWidth = 2.2;
          for (const crack of [[[-0.9, -0.7], [-0.6, -0.45], [-0.75, -0.2], [-0.5, 0.1]], [[0.6, 0.35], [0.85, 0.55], [0.7, 0.8]]]) {
            ctx.beginPath();
            let first = true;
            for (const [lon, lat] of crack) {
              const p = spherePt(H, R, 0, lon, lat);
              if (p[3] <= 0) {
                first = true;
                continue;
              }
              if (first) ctx.moveTo(p[0], p[1]);
              else ctx.lineTo(p[0], p[1]);
              first = false;
            }
            ctx.stroke();
          }
        });
      }
      if (phase === 'front') {
        // cabelo de fogo
        lighter(ctx, () => {
          const up = H.p(0, -1, 0);
          const o0 = H.p(0, 0, 0);
          let ux = up[0] - o0[0];
          let uy = up[1] - o0[1];
          const l = Math.hypot(ux, uy) || 1;
          ux /= l;
          uy /= l;
          for (let i = 0; i < 7; i++) {
            const lon = -1.6 + i * 0.55;
            const p = spherePt(H, R - 3, 0, lon + Math.PI * (i % 2 ? 0 : 1) * 0, -1.05 + (i % 2) * 0.15);
            ctx.globalAlpha = 0.95;
            flame(ctx, p[0], p[1], ux, uy, 30 + (i % 3) * 8, 8, c2, c3, t, i);
          }
        });
        // olhos em brasa
        eyesGlow(ctx, H, c3, t);
      }
      break;
    case 'ice':
      for (let k = 0; k < 9; k++) {
        const a = -2.2 + (k / 8) * 4.4;
        const b = ringAt(-18, 20, a);
        const len = 16 + (k === 4 ? 14 : (k % 2) * 6);
        byDepth(b[0], b[1], b[2], () =>
          spike(ctx, H, b[0], b[1], b[2], b[0] * 1.15, b[1] - len, b[2] * 1.15, 5, k % 2 ? '#e8f8ff' : c1, 2.5),
        );
      }
      if (phase === 'front') eyesGlow(ctx, H, '#bff4ff', t);
      break;
    case 'halo':
      if (phase === 'front') {
        const c = H.p(-2, -46 + Math.sin(t * 2) * 2, 0);
        const a = H.p(20, -46, 0);
        const b = H.p(-2, -46, 20);
        const ax = a[0] - c[0], ay = a[1] - c[1], bx = b[0] - c[0], by = b[1] - c[1];
        const rx = Math.hypot(ax, bx);
        const ry = Math.max(4, Math.hypot(ay, by));
        lighter(ctx, () => {
          ctx.globalAlpha = 0.6 + Math.sin(t * 4) * 0.2;
          ctx.drawImage(glowSprite('#ffe27a'), c[0] - 42, c[1] - 22, 84, 44);
        });
        ctx.beginPath();
        ctx.ellipse(c[0], c[1], Math.max(rx, 20), ry * 0.4 + 3, 0, 0, TAU);
        ctx.lineWidth = 7;
        ctx.strokeStyle = OC();
        ctx.stroke();
        ctx.lineWidth = 4;
        ctx.strokeStyle = C('#ffe27a');
        ctx.stroke();
        eyesGlow(ctx, H, '#ffffff', t);
      }
      break;
    case 'fenix': {
      for (let i = 0; i < 6; i++) {
        const a = -0.2 - i * 0.42;
        const bx = Math.cos(a) * (R - 4);
        const by = Math.sin(a) * (R - 4) - 2;
        const L = 30 + (i === 1 || i === 2 ? 14 : 0) - i * 2;
        const tx = bx + Math.cos(a - 0.25) * L;
        const ty = by + Math.sin(a - 0.25) * L - 8;
        const zz = (i % 2 ? 4 : -4);
        byDepth(bx, by, zz, () => {
          const mx = (bx + tx) / 2;
          const my = (by + ty) / 2;
          const nx = -Math.sin(a) * 7;
          const ny = Math.cos(a) * 7;
          poly(ctx, H, [[bx, by, zz], [mx + nx, my + ny, zz], [tx, ty, zz], [mx - nx, my - ny, zz]], i % 2 ? c2 : c1, 2.5);
          lighter(ctx, () => {
            const p = H.p(tx, ty, zz);
            ctx.globalAlpha = 0.85;
            flame(ctx, p[0], p[1], Math.cos(a - 0.4), Math.sin(a - 0.4), 16, 4.5, c2, c3, t, i);
          });
        });
      }
      break;
    }
  }
  void eyes;
}

function eyesGlow(ctx: CanvasRenderingContext2D, H: Proj, col: string, t: number) {
  if (PS.F) return;
  lighter(ctx, () => {
    for (const lon of [-0.38, 0.38]) {
      const p = spherePt(H, R, 0, lon, -0.04, 1);
      if (p[3] <= 0.05) continue;
      ctx.globalAlpha = 0.85 + Math.sin(t * 6) * 0.15;
      ctx.drawImage(glowSprite(col), p[0] - 9, p[1] - 9, 18, 18);
    }
  });
}

function dinoEyes(ctx: CanvasRenderingContext2D, H: Proj, c1: string, back: boolean, D0: number) {
  for (const sd of [-1, 1]) {
    const x = 10;
    const y = -26;
    const z = sd * 14;
    if ((H.p(x, y, z)[2] < D0) !== back) continue;
    ell(ctx, H, x, y, z, 7, 8, 7, '#ffffff', { line: 3, shade: null });
    const v = viewDir(H);
    const p = H.p(x + 4 + v[0] * 3, y + 1, z + v[2] * 3);
    ctx.fillStyle = C('#1a1220');
    ctx.beginPath();
    ctx.ellipse(p[0], p[1], 2.2, 4, 0, 0, TAU);
    ctx.fill();
    tube(ctx, H, [[x - 6, y - 7, z], [x + 7, y - 9, z * 0.9]], [3, 2], shade(c1, -0.15), undefined, 2.5);
  }
}

/** Fila de dentes ao longo de um arco horizontal (dir = +1 aponta para baixo, -1 para cima). */
function teethRow(ctx: CanvasRenderingContext2D, H: Proj, cx: number, y: number, rx: number, rz: number, a0: number, a1: number, n: number, dir: number, len: number) {
  const v = viewDir(H);
  for (let i = 0; i < n; i++) {
    const a = a0 + ((a1 - a0) * (i + 0.5)) / n;
    const x = cx + Math.cos(a) * rx;
    const z = Math.sin(a) * rz;
    if (Math.cos(a) * v[0] + Math.sin(a) * v[2] < -0.1) continue;
    spike(ctx, H, x, y, z, x, y + dir * len, z, 2.6, '#ffffff', 1.6);
  }
}

/** Dentes à volta da abertura de um capuz (já projetada no ecrã). */
function teethRing(ctx: CanvasRenderingContext2D, hl: { hx: number; hy: number; h1: number; h2: number; ha: number } | null) {
  if (!hl) return;
  const { hx, hy, h1, h2, ha } = hl;
  const ca = Math.cos(ha);
  const sa = Math.sin(ha);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    const ex = Math.cos(a) * h1;
    const ey = Math.sin(a) * h2;
    const x = hx + ex * ca - ey * sa;
    const y = hy + ex * sa + ey * ca;
    const ix = hx + (x - hx) * 0.8;
    const iy = hy + (y - hy) * 0.8;
    const nx = -(y - hy);
    const ny = x - hx;
    const l = Math.hypot(nx, ny) || 1;
    ctx.beginPath();
    ctx.moveTo(x + (nx / l) * 2.6, y + (ny / l) * 2.6);
    ctx.lineTo(ix, iy);
    ctx.lineTo(x - (nx / l) * 2.6, y - (ny / l) * 2.6);
    ctx.closePath();
    ctx.fillStyle = C('#ffffff');
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = OC();
    ctx.stroke();
  }
}
