/**
 * Arte dos baús: cada tier tem um visual próprio (madeira com ferro, aço rebitado, ouro com gemas,
 * púrpura com runas, obsidiana com fendas incandescentes). Tudo é desenhado UMA vez para canvases
 * fora do ecrã (corpo, tampa, interior da tampa e camadas emissivas) e depois só se faz drawImage.
 * Também gera os ícones SVG usados nos menus, com o mesmo visual.
 */
import { CHESTS, type ChestId } from '../data/chests';

/** Geometria do baú em unidades locais (base em y = 0, centro em x = 0). */
export const CW = 220;
export const CH = 118;
export const LID_H = 70;

type Style = 'wood' | 'steel' | 'gold' | 'rune' | 'obsidian';

interface Look {
  style: Style;
  /** Gradiente do corpo (cima → baixo). */
  b0: string;
  b1: string;
  /** Metal das ferragens (escuro, claro). */
  m0: string;
  m1: string;
  rivet: string;
  /** Gema / runa / fenda. */
  accent: string;
  /** Forro do interior. */
  lining: string;
  emit: string;
}

const LOOKS: Record<ChestId, Look> = {
  bronze: { style: 'wood', b0: '#a8662f', b1: '#5e3215', m0: '#3b3b44', m1: '#8c8c98', rivet: '#b9b9c4', accent: '#ffb070', lining: '#3a1d0c', emit: '#ffb070' },
  prata: { style: 'steel', b0: '#9aa6b8', b1: '#46505f', m0: '#6c7889', m1: '#f2f6fb', rivet: '#ffffff', accent: '#9fd2ff', lining: '#1d2a3c', emit: '#cfe6ff' },
  ouro: { style: 'gold', b0: '#ffd453', b1: '#9c6400', m0: '#a86d00', m1: '#fff1b0', rivet: '#fff6cf', accent: '#ff2d55', lining: '#6e0d1e', emit: '#ffd23d' },
  lendario: { style: 'rune', b0: '#7b35d6', b1: '#2e0b63', m0: '#b06d00', m1: '#ffe08a', rivet: '#fff1c2', accent: '#e9b6ff', lining: '#1c0838', emit: '#d07aff' },
  mitico: { style: 'obsidian', b0: '#4a0a1d', b1: '#0d0207', m0: '#0b0a12', m1: '#3a3550', rivet: '#7af7ff', accent: '#ff3d6e', lining: '#140006', emit: '#ff3d6e' },
};

const OUT = '#140a1c';

export interface Sprite {
  c: HTMLCanvasElement;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ChestSprites {
  body: Sprite;
  bodyGlow: Sprite | null;
  lid: Sprite;
  lidGlow: Sprite | null;
  lidIn: Sprite;
  look: Look;
}

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sprite(x: number, y: number, w: number, h: number, rs: number, draw: (g: CanvasRenderingContext2D) => void): Sprite {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * rs);
  c.height = Math.ceil(h * rs);
  const g = c.getContext('2d')!;
  g.setTransform(rs, 0, 0, rs, -x * rs, -y * rs);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  draw(g);
  return { c, x, y, w, h };
}

export function drawSprite(ctx: CanvasRenderingContext2D, s: Sprite): void {
  ctx.drawImage(s.c, s.x, s.y, s.w, s.h);
}

const cache = new Map<string, ChestSprites>();

/** Sprites de um baú; `rs` = píxeis por unidade (arredondado para não recriar a cada resize). */
export function chestSprites(id: ChestId, rs: number): ChestSprites {
  const q = Math.max(1.25, Math.min(3, Math.round(rs * 4) / 4));
  const key = `${id}@${q}`;
  let s = cache.get(key);
  if (s) return s;
  const L = LOOKS[id];
  const glowB = L.style === 'gold' || L.style === 'rune' || L.style === 'obsidian';
  s = {
    look: L,
    body: sprite(-134, -128, 268, 146, q, (g) => drawBody(g, L, id)),
    bodyGlow: glowB ? sprite(-134, -128, 268, 146, q, (g) => drawBodyGlow(g, L, id)) : null,
    lid: sprite(-124, -LID_H - 26, 248, LID_H + 66, q, (g) => drawLid(g, L, id)),
    lidGlow: glowB ? sprite(-124, -LID_H - 26, 248, LID_H + 66, q, (g) => drawLidGlow(g, L, id)) : null,
    lidIn: sprite(-124, -LID_H - 12, 248, LID_H + 22, q, (g) => drawLidInside(g, L)),
  };
  cache.set(key, s);
  return s;
}

// ───────────────────────── Peças ─────────────────────────

function vgrad(g: CanvasRenderingContext2D, y0: number, y1: number, a: string, b: string): CanvasGradient {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  gr.addColorStop(0, a);
  gr.addColorStop(1, b);
  return gr;
}

/** Faixa metálica vertical com brilho a meio. */
function metal(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, L: Look): void {
  const gr = g.createLinearGradient(x, 0, x + w, 0);
  gr.addColorStop(0, L.m0);
  gr.addColorStop(0.35, L.m1);
  gr.addColorStop(0.55, L.m0);
  gr.addColorStop(1, L.m0);
  g.fillStyle = gr;
  g.fillRect(x, y, w, h);
  g.strokeStyle = OUT;
  g.lineWidth = 3;
  g.strokeRect(x, y, w, h);
}

/** Faixa metálica horizontal. */
function hmetal(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, L: Look): void {
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, L.m1);
  gr.addColorStop(0.45, L.m0);
  gr.addColorStop(1, L.m0);
  g.fillStyle = gr;
  g.fillRect(x, y, w, h);
  g.strokeStyle = OUT;
  g.lineWidth = 3;
  g.strokeRect(x, y, w, h);
}

function rivet(g: CanvasRenderingContext2D, x: number, y: number, r: number, L: Look): void {
  g.fillStyle = OUT;
  g.beginPath();
  g.arc(x, y + 0.8, r + 1.2, 0, 6.283);
  g.fill();
  const gr = g.createRadialGradient(x - r * 0.4, y - r * 0.4, 0, x, y, r);
  gr.addColorStop(0, '#ffffff');
  gr.addColorStop(0.4, L.rivet);
  gr.addColorStop(1, L.m0);
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, r, 0, 6.283);
  g.fill();
}

function gem(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, shape: 'round' | 'diamond' = 'round'): void {
  g.save();
  g.translate(x, y);
  g.fillStyle = OUT;
  g.beginPath();
  if (shape === 'diamond') {
    g.moveTo(0, -r - 2.5);
    g.lineTo(r + 2.5, 0);
    g.lineTo(0, r + 2.5);
    g.lineTo(-r - 2.5, 0);
  } else g.arc(0, 0, r + 2.5, 0, 6.283);
  g.fill();
  const gr = g.createRadialGradient(-r * 0.3, -r * 0.35, 0, 0, 0, r);
  gr.addColorStop(0, '#ffffff');
  gr.addColorStop(0.3, color);
  gr.addColorStop(1, shade(color, -0.55));
  g.fillStyle = gr;
  g.beginPath();
  if (shape === 'diamond') {
    g.moveTo(0, -r);
    g.lineTo(r, 0);
    g.lineTo(0, r);
    g.lineTo(-r, 0);
  } else g.arc(0, 0, r, 0, 6.283);
  g.fill();
  // faceta
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.beginPath();
  g.ellipse(-r * 0.35, -r * 0.4, r * 0.32, r * 0.18, -0.6, 0, 6.283);
  g.fill();
  g.restore();
}

/** Escurece (k < 0) ou clareia (k > 0) uma cor #rrggbb. */
export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let gg = (n >> 8) & 255;
  let b = n & 255;
  if (k < 0) {
    r *= 1 + k;
    gg *= 1 + k;
    b *= 1 + k;
  } else {
    r += (255 - r) * k;
    gg += (255 - gg) * k;
    b += (255 - b) * k;
  }
  const h = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(gg)}${h(b)}`;
}

/** Sombreamento cilíndrico por cima de uma forma já recortada. */
function cylShade(g: CanvasRenderingContext2D, x0: number, x1: number, y0: number, y1: number, strength = 1): void {
  const gr = g.createLinearGradient(x0, 0, x1, 0);
  gr.addColorStop(0, `rgba(0,0,0,${0.42 * strength})`);
  gr.addColorStop(0.22, 'rgba(0,0,0,0)');
  gr.addColorStop(0.5, `rgba(255,255,255,${0.06 * strength})`);
  gr.addColorStop(0.78, 'rgba(0,0,0,0)');
  gr.addColorStop(1, `rgba(0,0,0,${0.5 * strength})`);
  g.fillStyle = gr;
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
}

const BX = 80; // centro das faixas verticais
const BW = 24;

function bodyPath(g: CanvasRenderingContext2D): void {
  g.beginPath();
  g.roundRect(-CW / 2, -CH, CW, CH, 8);
}

function drawBody(g: CanvasRenderingContext2D, L: Look, id: ChestId): void {
  const R = rng(id.length * 977 + 13);
  // sombra de contacto suave por baixo
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath();
  g.ellipse(0, 4, CW * 0.56, 12, 0, 0, 6.283);
  g.fill();
  // pés (ouro/lendário/mítico)
  if (L.style !== 'wood' && L.style !== 'steel') {
    for (const sx of [-1, 1]) {
      g.fillStyle = L.style === 'obsidian' ? '#1a1724' : L.m0;
      g.strokeStyle = OUT;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(sx * (CW / 2 - 6), -6);
      g.lineTo(sx * (CW / 2 + 6), 10);
      g.lineTo(sx * (CW / 2 - 26), 10);
      g.lineTo(sx * (CW / 2 - 30), -6);
      g.closePath();
      g.fill();
      g.stroke();
    }
  }
  g.save();
  bodyPath(g);
  g.fillStyle = vgrad(g, -CH, 0, L.b0, L.b1);
  g.fill();
  g.clip();
  switch (L.style) {
    case 'wood': {
      // tábuas com veios
      for (let i = 1; i < 4; i++) {
        const y = -CH + (i * CH) / 4;
        g.strokeStyle = 'rgba(30,12,2,0.55)';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(-CW / 2, y);
        g.lineTo(CW / 2, y);
        g.stroke();
        g.strokeStyle = 'rgba(255,210,150,0.18)';
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(-CW / 2, y + 2.5);
        g.lineTo(CW / 2, y + 2.5);
        g.stroke();
      }
      g.lineWidth = 1.2;
      for (let k = 0; k < 26; k++) {
        const y = -CH + R() * CH;
        const x = -CW / 2 + R() * CW;
        const len = 30 + R() * 60;
        g.strokeStyle = R() < 0.5 ? 'rgba(40,16,4,0.3)' : 'rgba(255,200,140,0.12)';
        g.beginPath();
        g.moveTo(x, y);
        g.bezierCurveTo(x + len * 0.3, y - 3, x + len * 0.6, y + 3, x + len, y);
        g.stroke();
      }
      // nós da madeira
      for (let k = 0; k < 3; k++) {
        g.strokeStyle = 'rgba(40,16,4,0.45)';
        g.lineWidth = 1.5;
        g.beginPath();
        g.ellipse(-40 + R() * 80, -CH + 18 + R() * (CH - 30), 5 + R() * 3, 2.5, 0, 0, 6.283);
        g.stroke();
      }
      break;
    }
    case 'steel': {
      // aço escovado + painel central em relevo
      for (let k = 0; k < 70; k++) {
        const y = -CH + R() * CH;
        g.strokeStyle = R() < 0.5 ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(-CW / 2, y);
        g.lineTo(CW / 2, y + (R() - 0.5) * 2);
        g.stroke();
      }
      g.fillStyle = vgrad(g, -CH + 22, -20, '#7b879a', '#3c4655');
      g.beginPath();
      g.roundRect(-54, -CH + 24, 108, CH - 44, 6);
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 2;
      g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.45)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.roundRect(-51, -CH + 27, 102, CH - 50, 5);
      g.stroke();
      break;
    }
    case 'gold': {
      // filigrana em relevo
      g.lineWidth = 2.5;
      for (const sx of [-1, 1]) {
        for (let k = 0; k < 2; k++) {
          const cx = sx * 34;
          const cy = -CH + 40 + k * 40;
          g.strokeStyle = 'rgba(110,60,0,0.6)';
          scroll(g, cx, cy, 14, sx);
          g.strokeStyle = 'rgba(255,250,210,0.5)';
          scroll(g, cx - 0.8, cy - 1, 14, sx);
        }
      }
      // brilho diagonal
      const sh = g.createLinearGradient(-CW / 2, -CH, CW / 2, 0);
      sh.addColorStop(0.25, 'rgba(255,255,255,0)');
      sh.addColorStop(0.35, 'rgba(255,255,255,0.25)');
      sh.addColorStop(0.45, 'rgba(255,255,255,0)');
      g.fillStyle = sh;
      g.fillRect(-CW / 2, -CH, CW, CH);
      break;
    }
    case 'rune': {
      // padrão de losangos subtil
      g.strokeStyle = 'rgba(230,190,255,0.10)';
      g.lineWidth = 1.5;
      for (let x = -CW; x < CW; x += 22) {
        g.beginPath();
        g.moveTo(x, -CH);
        g.lineTo(x + CH, 0);
        g.moveTo(x + CH, -CH);
        g.lineTo(x, 0);
        g.stroke();
      }
      // placa central de ouro com runas (as runas brilham na camada emissiva)
      g.fillStyle = vgrad(g, -CH + 30, -24, '#3a0f78', '#1d0640');
      g.beginPath();
      g.roundRect(-52, -CH + 30, 104, CH - 52, 10);
      g.fill();
      g.strokeStyle = L.m1;
      g.lineWidth = 2.5;
      g.stroke();
      runes(g, 0, -CH / 2 + 3, 5, 15, 'rgba(255,220,255,0.35)', 1.6);
      break;
    }
    case 'obsidian': {
      // facetas de obsidiana
      for (let k = 0; k < 14; k++) {
        const x = -CW / 2 + R() * CW;
        const y = -CH + R() * CH;
        const r = 16 + R() * 26;
        g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.25)';
        g.beginPath();
        g.moveTo(x, y - r);
        g.lineTo(x + r * 0.8, y - r * 0.1);
        g.lineTo(x + r * 0.2, y + r * 0.7);
        g.lineTo(x - r * 0.7, y + r * 0.2);
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(255,120,160,0.12)';
        g.lineWidth = 1;
        g.stroke();
      }
      // fendas escuras (a luz vem da camada emissiva)
      g.strokeStyle = 'rgba(0,0,0,0.8)';
      g.lineWidth = 4;
      cracks(g, id, 'body');
      break;
    }
  }
  cylShade(g, -CW / 2, CW / 2, -CH, 0, L.style === 'gold' ? 0.8 : 1);
  // luz de cima / sombra em baixo
  g.fillStyle = vgrad(g, -CH, -CH + 24, 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0)');
  g.fillRect(-CW / 2, -CH, CW, 24);
  g.fillStyle = vgrad(g, -26, 0, 'rgba(0,0,0,0)', 'rgba(0,0,0,0.35)');
  g.fillRect(-CW / 2, -26, CW, 26);
  g.restore();

  // ferragens
  const ox = L.style === 'obsidian';
  hmetal(g, -CW / 2, -16, CW, 16, L);
  hmetal(g, -CW / 2, -CH, CW, 11, L);
  for (const sx of [-1, 1]) metal(g, sx * BX - BW / 2, -CH, BW, CH, L);
  if (ox) {
    // arestas ciano finas
    g.strokeStyle = 'rgba(122,247,255,0.55)';
    g.lineWidth = 1.5;
    for (const sx of [-1, 1]) {
      g.beginPath();
      g.moveTo(sx * BX - BW / 2 + 2, -CH + 2);
      g.lineTo(sx * BX - BW / 2 + 2, -2);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(-CW / 2 + 2, -15);
    g.lineTo(CW / 2 - 2, -15);
    g.stroke();
  }
  // rebites / gemas nas faixas
  for (const sx of [-1, 1]) {
    const x = sx * BX;
    if (L.style === 'gold') {
      gem(g, x, -CH / 2 - 6, 7, L.accent);
      rivet(g, x, -CH + 22, 3, L);
      rivet(g, x, -28, 3, L);
    } else if (L.style === 'rune') {
      gem(g, x, -CH / 2 - 6, 7, '#b45cff', 'diamond');
      rivet(g, x, -CH + 22, 3, L);
      rivet(g, x, -28, 3, L);
    } else if (L.style === 'obsidian') {
      // espigões
      for (const y of [-CH + 26, -30]) {
        g.fillStyle = '#2a2638';
        g.strokeStyle = OUT;
        g.lineWidth = 2.5;
        g.beginPath();
        g.moveTo(x - 6, y + 5);
        g.lineTo(x, y - 8);
        g.lineTo(x + 6, y + 5);
        g.closePath();
        g.fill();
        g.stroke();
      }
    } else {
      const n = L.style === 'steel' ? 5 : 3;
      for (let k = 0; k < n; k++) rivet(g, x, -CH + 22 + (k * (CH - 44)) / (n - 1), L.style === 'steel' ? 3.2 : 3.6, L);
    }
  }
  const nr = L.style === 'steel' ? 9 : 6;
  for (let k = 0; k < nr; k++) {
    const x = -CW / 2 + 12 + (k * (CW - 24)) / (nr - 1);
    if (Math.abs(Math.abs(x) - BX) < 16) continue;
    if (!ox) rivet(g, x, -8, 2.6, L);
  }
  // cantoneiras
  if (L.style !== 'wood') {
    for (const sx of [-1, 1]) {
      g.fillStyle = vgrad(g, -34, 0, L.m1, L.m0);
      g.strokeStyle = OUT;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(sx * (CW / 2), -38);
      g.lineTo(sx * (CW / 2), 0);
      g.lineTo(sx * (CW / 2 - 34), 0);
      g.lineTo(sx * (CW / 2 - 34), -12);
      g.lineTo(sx * (CW / 2 - 12), -14);
      g.lineTo(sx * (CW / 2 - 12), -38);
      g.closePath();
      g.fill();
      g.stroke();
    }
  }
  // asas laterais (pegas)
  for (const sx of [-1, 1]) {
    g.strokeStyle = OUT;
    g.lineWidth = 7;
    g.beginPath();
    g.arc(sx * (CW / 2 + 2), -CH / 2, 11, sx > 0 ? -1.3 : 1.84, sx > 0 ? 1.3 : 4.44);
    g.stroke();
    g.strokeStyle = L.m1;
    g.lineWidth = 3.5;
    g.stroke();
  }
  // contorno
  bodyPath(g);
  g.strokeStyle = OUT;
  g.lineWidth = 5;
  g.stroke();
}

function scroll(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, dir: number): void {
  g.beginPath();
  for (let i = 0; i <= 28; i++) {
    const a = (i / 28) * Math.PI * 3.2;
    const rr = r * (1 - i / 34);
    const x = cx + Math.cos(a) * rr * dir;
    const y = cy + Math.sin(a) * rr * 0.7;
    if (i) g.lineTo(x, y);
    else g.moveTo(x, y);
  }
  g.stroke();
}

/** Glifos rúnicos simples (traços) numa fila centrada em (cx, cy). */
function runes(g: CanvasRenderingContext2D, cx: number, cy: number, n: number, sz: number, color: string, lw: number): void {
  const R = rng(4242);
  g.strokeStyle = color;
  g.lineWidth = lw;
  const step = sz * 1.25;
  for (let i = 0; i < n; i++) {
    const x = cx + (i - (n - 1) / 2) * step;
    g.beginPath();
    g.moveTo(x, cy - sz / 2);
    g.lineTo(x, cy + sz / 2);
    const v = Math.floor(R() * 4);
    if (v === 0) {
      g.moveTo(x, cy - sz / 2);
      g.lineTo(x + sz * 0.35, cy - sz * 0.15);
      g.lineTo(x, cy + sz * 0.05);
    } else if (v === 1) {
      g.moveTo(x - sz * 0.35, cy - sz * 0.3);
      g.lineTo(x + sz * 0.35, cy + sz * 0.05);
    } else if (v === 2) {
      g.moveTo(x, cy - sz * 0.1);
      g.lineTo(x + sz * 0.35, cy - sz * 0.45);
      g.moveTo(x, cy - sz * 0.1);
      g.lineTo(x - sz * 0.35, cy - sz * 0.45);
    } else {
      g.moveTo(x - sz * 0.35, cy + sz * 0.2);
      g.lineTo(x, cy - sz * 0.15);
      g.lineTo(x + sz * 0.35, cy + sz * 0.2);
    }
    g.stroke();
  }
}

/** Fendas do baú mítico (sempre as mesmas: semente fixa). */
function cracks(g: CanvasRenderingContext2D, id: ChestId, part: 'body' | 'lid'): void {
  const R = rng(part === 'body' ? 9001 : 7331 + id.length);
  const n = part === 'body' ? 4 : 3;
  for (let k = 0; k < n; k++) {
    let x = part === 'body' ? -CW / 2 + 20 + R() * (CW - 40) : -90 + R() * 180;
    let y = part === 'body' ? -CH + 12 : -LID_H * 0.75 + R() * 20;
    const yEnd = part === 'body' ? -12 - R() * 40 : 0;
    g.beginPath();
    g.moveTo(x, y);
    while (y < yEnd) {
      x += (R() - 0.5) * 22;
      y += 8 + R() * 12;
      g.lineTo(x, Math.min(y, yEnd));
      if (R() < 0.22) {
        g.moveTo(x, y);
        g.lineTo(x + (R() - 0.5) * 30, y + 6 + R() * 10);
        g.moveTo(x, y);
      }
    }
    g.stroke();
  }
}

function drawBodyGlow(g: CanvasRenderingContext2D, L: Look, id: ChestId): void {
  g.globalCompositeOperation = 'lighter';
  if (L.style === 'obsidian') {
    g.save();
    bodyPath(g);
    g.clip();
    g.shadowColor = L.accent;
    g.shadowBlur = 14;
    g.strokeStyle = L.accent;
    g.lineWidth = 3.2;
    cracks(g, id, 'body');
    g.shadowBlur = 0;
    g.strokeStyle = '#ffd0dc';
    g.lineWidth = 1.2;
    cracks(g, id, 'body');
    g.restore();
  } else if (L.style === 'rune') {
    g.shadowColor = L.emit;
    g.shadowBlur = 12;
    runes(g, 0, -CH / 2 + 3, 5, 15, '#e9b6ff', 2.4);
    g.shadowBlur = 0;
    runes(g, 0, -CH / 2 + 3, 5, 15, '#ffffff', 1);
    for (const sx of [-1, 1]) halo(g, sx * BX, -CH / 2 - 6, 18, '#d07aff');
  } else if (L.style === 'gold') {
    for (const sx of [-1, 1]) halo(g, sx * BX, -CH / 2 - 6, 18, '#ff6a85');
  }
}

function halo(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, color);
  gr.addColorStop(1, color + '00');
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

function lidPath(g: CanvasRenderingContext2D): void {
  const w = CW / 2 + 4;
  g.beginPath();
  g.moveTo(-w, 6);
  g.lineTo(-w, -LID_H * 0.36);
  g.bezierCurveTo(-w, -LID_H * 1.1, w, -LID_H * 1.1, w, -LID_H * 0.36);
  g.lineTo(w, 6);
  g.closePath();
}

function drawLid(g: CanvasRenderingContext2D, L: Look, id: ChestId): void {
  const R = rng(id.length * 31 + 7);
  const w = CW / 2 + 4;
  g.save();
  lidPath(g);
  g.fillStyle = vgrad(g, -LID_H, 6, shade(L.b0, 0.12), L.b1);
  g.fill();
  g.clip();
  if (L.style === 'wood') {
    for (let i = 1; i < 4; i++) {
      const yy = -LID_H * 0.85 + i * 17;
      g.strokeStyle = 'rgba(30,12,2,0.5)';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(-w, yy + 10);
      g.quadraticCurveTo(0, yy - 8, w, yy + 10);
      g.stroke();
    }
    g.lineWidth = 1.2;
    for (let k = 0; k < 14; k++) {
      const x = -w + R() * w * 2;
      const y = -LID_H * 0.7 + R() * LID_H * 0.7;
      g.strokeStyle = 'rgba(40,16,4,0.3)';
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 20, y - 3, x + 45, y);
      g.stroke();
    }
  } else if (L.style === 'steel') {
    for (let k = 0; k < 40; k++) {
      const y = -LID_H + R() * LID_H;
      g.strokeStyle = R() < 0.5 ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(-w, y);
      g.lineTo(w, y);
      g.stroke();
    }
  } else if (L.style === 'gold') {
    g.lineWidth = 2.5;
    for (const sx of [-1, 1]) {
      g.strokeStyle = 'rgba(110,60,0,0.6)';
      scroll(g, sx * 36, -LID_H * 0.45, 13, sx);
      g.strokeStyle = 'rgba(255,250,210,0.5)';
      scroll(g, sx * 36 - 0.8, -LID_H * 0.45 - 1, 13, sx);
    }
  } else if (L.style === 'rune') {
    // emblema circular
    g.fillStyle = '#250852';
    g.beginPath();
    g.arc(0, -LID_H * 0.44, 22, 0, 6.283);
    g.fill();
    g.strokeStyle = L.m1;
    g.lineWidth = 3;
    g.stroke();
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(0, -LID_H * 0.44, 15, 0, 6.283);
    g.stroke();
  } else {
    g.strokeStyle = 'rgba(0,0,0,0.8)';
    g.lineWidth = 4;
    cracks(g, id, 'lid');
  }
  cylShade(g, -w, w, -LID_H, 6, L.style === 'gold' ? 0.8 : 1);
  // reflexo especular da cúpula
  const sp = g.createRadialGradient(-w * 0.25, -LID_H * 0.72, 0, -w * 0.25, -LID_H * 0.72, w * 0.7);
  sp.addColorStop(0, `rgba(255,255,255,${L.style === 'wood' ? 0.16 : 0.32})`);
  sp.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sp;
  g.fillRect(-w, -LID_H, w * 2, LID_H);
  // faixas da tampa
  for (const sx of [-1, 1]) metal(g, sx * BX - BW / 2, -LID_H, BW, LID_H + 6, L);
  hmetal(g, -w, -6, w * 2, 12, L);
  g.restore();
  // rebites / gemas na tampa
  for (const sx of [-1, 1]) {
    if (L.style === 'gold') gem(g, sx * BX, -LID_H * 0.45, 5.5, '#3aa0ff');
    else if (L.style === 'rune') gem(g, sx * BX, -LID_H * 0.45, 5.5, '#b45cff', 'diamond');
    else if (L.style !== 'obsidian') {
      rivet(g, sx * BX, -LID_H * 0.62, 3.2, L);
      rivet(g, sx * BX, -LID_H * 0.25, 3.2, L);
    }
  }
  lidPath(g);
  g.strokeStyle = OUT;
  g.lineWidth = 5;
  g.stroke();
  // coroa / espigões no topo
  if (L.style === 'gold') gem(g, 0, -LID_H * 0.83, 8, L.accent);
  if (L.style === 'obsidian') {
    for (let k = -3; k <= 3; k++) {
      const x = k * 26;
      const t = Math.abs(k) / 3.6;
      const y = -LID_H * (0.82 - t * t * 0.4) - 3;
      g.fillStyle = '#211d2e';
      g.strokeStyle = OUT;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x - 7, y + 6);
      g.lineTo(x + k * 1.5, y - 14 + Math.abs(k) * 2);
      g.lineTo(x + 7, y + 6);
      g.closePath();
      g.fill();
      g.stroke();
      g.strokeStyle = 'rgba(122,247,255,0.6)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x - 4, y + 3);
      g.lineTo(x + k * 1.5, y - 11 + Math.abs(k) * 2);
      g.stroke();
    }
  }
  // fechadura (pendurada na tampa)
  lock(g, L);
}

function lock(g: CanvasRenderingContext2D, L: Look): void {
  g.save();
  g.translate(0, 8);
  g.strokeStyle = OUT;
  g.lineWidth = 3.5;
  const plate = L.style === 'wood' || L.style === 'steel' ? L : { ...L, m0: L.style === 'obsidian' ? '#14121c' : L.m0 };
  const gr = g.createLinearGradient(-22, 0, 22, 0);
  gr.addColorStop(0, plate.m0);
  gr.addColorStop(0.4, plate.m1);
  gr.addColorStop(1, plate.m0);
  g.fillStyle = gr;
  g.beginPath();
  switch (L.style) {
    case 'wood':
      g.roundRect(-18, -16, 36, 40, 6);
      break;
    case 'steel':
      g.moveTo(-20, -16);
      g.lineTo(20, -16);
      g.lineTo(20, 10);
      g.quadraticCurveTo(20, 24, 0, 30);
      g.quadraticCurveTo(-20, 24, -20, 10);
      g.closePath();
      break;
    case 'gold':
      g.moveTo(-24, -16);
      g.lineTo(-12, -24);
      g.lineTo(0, -16);
      g.lineTo(12, -24);
      g.lineTo(24, -16);
      g.lineTo(20, 18);
      g.quadraticCurveTo(0, 32, -20, 18);
      g.closePath();
      break;
    case 'rune':
      g.moveTo(0, -24);
      g.lineTo(24, 4);
      g.lineTo(0, 32);
      g.lineTo(-24, 4);
      g.closePath();
      break;
    case 'obsidian':
      g.moveTo(-26, 4);
      g.quadraticCurveTo(0, -24, 26, 4);
      g.quadraticCurveTo(0, 32, -26, 4);
      g.closePath();
      break;
  }
  g.fill();
  g.stroke();
  if (L.style === 'gold') gem(g, 0, 4, 8, L.accent);
  else if (L.style === 'rune') gem(g, 0, 4, 9, '#c77dff', 'diamond');
  else if (L.style === 'obsidian') {
    gem(g, 0, 4, 9, '#ff3d6e');
    g.fillStyle = '#000';
    g.beginPath();
    g.ellipse(0, 4, 2.4, 7, 0, 0, 6.283);
    g.fill();
  } else {
    // buraco da fechadura
    g.fillStyle = OUT;
    g.beginPath();
    g.arc(0, 2, 5, 0, 6.283);
    g.fill();
    g.beginPath();
    g.moveTo(-3, 4);
    g.lineTo(3, 4);
    g.lineTo(4.5, 14);
    g.lineTo(-4.5, 14);
    g.closePath();
    g.fill();
    rivet(g, -11, -9, 2.2, L);
    rivet(g, 11, -9, 2.2, L);
  }
  g.restore();
}

function drawLidGlow(g: CanvasRenderingContext2D, L: Look, id: ChestId): void {
  g.globalCompositeOperation = 'lighter';
  if (L.style === 'obsidian') {
    g.save();
    lidPath(g);
    g.clip();
    g.shadowColor = L.accent;
    g.shadowBlur = 14;
    g.strokeStyle = L.accent;
    g.lineWidth = 3.2;
    cracks(g, id, 'lid');
    g.shadowBlur = 0;
    g.strokeStyle = '#ffd0dc';
    g.lineWidth = 1.2;
    cracks(g, id, 'lid');
    g.restore();
    halo(g, 0, 12, 26, '#ff3d6e');
  } else if (L.style === 'rune') {
    g.shadowColor = L.emit;
    g.shadowBlur = 10;
    g.strokeStyle = '#e9b6ff';
    g.lineWidth = 2.4;
    const cy = -LID_H * 0.44;
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * 6.283 - 1.57;
      g.moveTo(Math.cos(a) * 6, cy + Math.sin(a) * 6);
      g.lineTo(Math.cos(a) * 13, cy + Math.sin(a) * 13);
    }
    g.stroke();
    g.shadowBlur = 0;
    halo(g, 0, cy, 30, '#b45cff');
    halo(g, 0, 12, 24, '#c77dff');
  } else if (L.style === 'gold') {
    halo(g, 0, -LID_H * 0.83, 20, '#ff6a85');
    halo(g, 0, 12, 22, '#ff6a85');
  }
}

function drawLidInside(g: CanvasRenderingContext2D, L: Look): void {
  const w = CW / 2 + 4;
  g.save();
  g.beginPath();
  g.moveTo(-w, 6);
  g.lineTo(-w, -LID_H * 0.36);
  g.bezierCurveTo(-w, -LID_H * 1.1, w, -LID_H * 1.1, w, -LID_H * 0.36);
  g.lineTo(w, 6);
  g.closePath();
  g.fillStyle = vgrad(g, -LID_H, 6, shade(L.lining, 0.15), shade(L.lining, -0.4));
  g.fill();
  g.clip();
  // forro acolchoado
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 2;
  for (let x = -w + 20; x < w; x += 28) {
    g.beginPath();
    g.moveTo(x, -LID_H);
    g.lineTo(x, 6);
    g.stroke();
  }
  cylShade(g, -w, w, -LID_H, 6, 1.2);
  g.restore();
  // aro de madeira/metal
  g.strokeStyle = L.style === 'wood' ? '#6b3a17' : L.m0;
  g.lineWidth = 10;
  g.beginPath();
  g.moveTo(-w + 5, 4);
  g.lineTo(-w + 5, -LID_H * 0.36);
  g.bezierCurveTo(-w + 5, -LID_H * 1.03, w - 5, -LID_H * 1.03, w - 5, -LID_H * 0.36);
  g.lineTo(w - 5, 4);
  g.stroke();
  g.strokeStyle = OUT;
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(-w, 6);
  g.lineTo(-w, -LID_H * 0.36);
  g.bezierCurveTo(-w, -LID_H * 1.1, w, -LID_H * 1.1, w, -LID_H * 0.36);
  g.lineTo(w, 6);
  g.stroke();
}

// ───────────────────────── Ícones SVG (menus) ─────────────────────────

let svgUid = 0;

/** Tier do baú a partir da cor do corpo (assim `chestSvg(body, trim)` continua a funcionar). */
export function chestIdFromColors(body: string): ChestId {
  for (const id of Object.keys(CHESTS) as ChestId[]) if (CHESTS[id].body.toLowerCase() === body.toLowerCase()) return id;
  return 'bronze';
}

/** Ícone SVG de um baú, com o mesmo visual de cada tier. */
export function chestIconSvg(id: ChestId): string {
  const L = LOOKS[id];
  const u = `cx${++svgUid}`;
  const s = L.style;
  const band = (x: number) => `<rect x="${x}" y="9" width="7" height="43" fill="url(#${u}m)" stroke="${OUT}" stroke-width="1.6"/>`;
  const riv = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="1.4" fill="${L.rivet}" stroke="${OUT}" stroke-width=".6"/>`;
  let under = '';
  let deco = '';
  let lockEl = '';
  if (s === 'wood') {
    under = `<path d="M6 36h52M6 44h52M8 17q24-6 48 0" stroke="rgba(40,16,4,.55)" stroke-width="1.2" fill="none"/>`;
    deco = [15.5, 48.5].map((x) => riv(x, 30) + riv(x, 46)).join('');
    lockEl = `<rect x="27" y="22" width="10" height="12" rx="2" fill="url(#${u}m)" stroke="${OUT}" stroke-width="1.6"/><circle cx="32" cy="27" r="1.6" fill="${OUT}"/><path d="M31 28h2l.6 3.5h-3.2z" fill="${OUT}"/>`;
  } else if (s === 'steel') {
    under = `<rect x="22" y="34" width="20" height="13" rx="2" fill="rgba(0,0,0,.18)" stroke="rgba(255,255,255,.4)" stroke-width=".8"/>`;
    deco = [15.5, 48.5].map((x) => riv(x, 30) + riv(x, 38) + riv(x, 46)).join('');
    lockEl = `<path d="M26.5 22h11v7q0 5-5.5 7-5.5-2-5.5-7z" fill="url(#${u}m)" stroke="${OUT}" stroke-width="1.6"/><circle cx="32" cy="27.5" r="1.6" fill="${OUT}"/>`;
  } else if (s === 'gold') {
    deco = [15.5, 48.5].map((x) => `<circle cx="${x}" cy="38" r="2.4" fill="${L.accent}" stroke="${OUT}" stroke-width=".8"/><circle cx="${x - 0.7}" cy="37.2" r=".7" fill="#fff"/>`).join('');
    under = `<path d="M24 41q4-5 8 0t8 0" stroke="rgba(110,60,0,.7)" stroke-width="1.2" fill="none"/>`;
    deco += `<circle cx="32" cy="8.5" r="2.6" fill="${L.accent}" stroke="${OUT}" stroke-width="1"/>`;
    lockEl = `<path d="M25.5 22l3.2-2.6 3.3 2.6 3.3-2.6 3.2 2.6-1 9q-5.5 4-11 0z" fill="url(#${u}m)" stroke="${OUT}" stroke-width="1.6"/><circle cx="32" cy="27" r="2.6" fill="${L.accent}" stroke="${OUT}" stroke-width=".8"/><circle cx="31.2" cy="26.2" r=".8" fill="#fff"/>`;
  } else if (s === 'rune') {
    under = `<path class="cx-glow" d="M23 37v8M23 39l3 2-3 2M30 37v8M28 38l4 3M37 37v8M37 41l3-3M37 41l-3-3" stroke="#f2c8ff" stroke-width="1.2" fill="none"/>`;
    deco = [15.5, 48.5].map((x) => `<path d="M${x} 35.5l2.6 2.6-2.6 2.6-2.6-2.6z" fill="#b45cff" stroke="${OUT}" stroke-width=".7"/>`).join('');
    lockEl = `<path d="M32 19.5l6.5 7-6.5 8-6.5-8z" fill="url(#${u}m)" stroke="${OUT}" stroke-width="1.6"/><path class="cx-glow" d="M32 23.5l3 3.2-3 3.7-3-3.7z" fill="#e9b6ff"/>`;
  } else {
    under = `<path class="cx-glow" d="M20 26l2 6-3 5 2 6M44 25l-2 7 3 4-1 7M30 10l2 5-2 5" stroke="${L.accent}" stroke-width="1.6" fill="none"/>`;
    deco = `<path d="M14 9l2-6 2 6M30 7l2-6 2 6M46 9l2-6 2 6" fill="#211d2e" stroke="${OUT}" stroke-width="1.2"/>`;
    lockEl = `<path d="M25 27q7-9 14 0-7 9-14 0z" fill="#14121c" stroke="${OUT}" stroke-width="1.6"/><circle class="cx-glow" cx="32" cy="27" r="3" fill="${L.accent}"/><ellipse cx="32" cy="27" rx=".9" ry="2.4" fill="#000"/>`;
  }
  const edge = s === 'obsidian' ? `<path d="M6.8 51V25M57.2 51V25" stroke="rgba(122,247,255,.6)" stroke-width="1"/>` : '';
  return `<svg class="chest-ico ch-${id}" viewBox="0 0 64 56" aria-hidden="true">
    <defs>
      <linearGradient id="${u}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${L.b0}"/><stop offset="1" stop-color="${L.b1}"/></linearGradient>
      <linearGradient id="${u}l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(L.b0, 0.18)}"/><stop offset="1" stop-color="${L.b1}"/></linearGradient>
      <linearGradient id="${u}m" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${L.m0}"/><stop offset=".4" stop-color="${L.m1}"/><stop offset="1" stop-color="${L.m0}"/></linearGradient>
      <linearGradient id="${u}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".4"/><stop offset=".25" stop-color="#000" stop-opacity="0"/><stop offset=".75" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></linearGradient>
    </defs>
    <ellipse cx="32" cy="53" rx="26" ry="2.6" fill="rgba(0,0,0,.35)"/>
    <rect x="6" y="24" width="52" height="28" rx="3" fill="url(#${u}b)" stroke="${OUT}" stroke-width="2.4"/>
    <path d="M5 25 Q5 5 32 5 Q59 5 59 25 Z" fill="url(#${u}l)" stroke="${OUT}" stroke-width="2.4"/>
    <path d="M14 8 Q24 5.5 30 6" stroke="rgba(255,255,255,.35)" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    ${under}
    <rect x="6" y="24" width="52" height="28" rx="3" fill="url(#${u}s)"/>
    <rect x="5" y="22.5" width="54" height="4" fill="url(#${u}m)" stroke="${OUT}" stroke-width="1.4"/>
    <rect x="6" y="47" width="52" height="5" fill="url(#${u}m)" stroke="${OUT}" stroke-width="1.4"/>
    ${band(12)}${band(45)}
    ${deco}
    ${edge}
    ${lockEl}
  </svg>`;
}
