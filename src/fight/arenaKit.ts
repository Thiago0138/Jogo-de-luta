import { glowSprite } from '../render/fighter';

/**
 * Peças comuns a todas as arenas: geometria do ringue (a jogabilidade depende dela — não mexer),
 * utilitários de desenho em estilo cartoon e sprites de luz partilhados.
 */

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

/** Tamanho do fundo pré-renderizado (em unidades do fundo). */
export const BW = 2600;
export const BH = 760;
/** Contorno escuro do estilo cartoon. */
export const OUT = '#160d24';

/** Camada pré-renderizada de uma faixa vertical do fundo (só guarda as linhas de BH que têm conteúdo). */
export interface Layer {
  c: HTMLCanvasElement;
  y0: number;
  h: number;
}

export function mk(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return [c, c.getContext('2d')!];
}

export function darken(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${Math.round(((n >> 16) & 255) * k)},${Math.round(((n >> 8) & 255) * k)},${Math.round((n & 255) * k)})`;
}

export function pick<T>(a: T[], v: number): T {
  return a[Math.floor(v * a.length) % a.length];
}

/** Preenche o caminho atual e contorna-o com o traço escuro do estilo cartoon. */
export function inked(g: CanvasRenderingContext2D, fill: string | CanvasGradient | CanvasPattern, lw: number, out = OUT): void {
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = lw;
  g.strokeStyle = out;
  g.stroke();
}

export function crownPath(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
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

export function starPath(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
}

/** Neblina cumulativa: tudo o que já está desenhado na camada fica um pouco mais "longe". */
export function hazeFill(g: CanvasRenderingContext2D, a: number, rgb = '30,16,58'): void {
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = `rgba(${rgb},${a})`;
  g.fillRect(0, 0, g.canvas.width, g.canvas.height);
  g.restore();
}

export function makeLayer(y0: number, y1: number, cs: number, filter: string, draw: (g: CanvasRenderingContext2D) => void): Layer {
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

// ── atmosfera: fachos de luz volumétricos, reflexo de lente, vinheta centrada no ringue ──

let shaftBase: HTMLCanvasElement | null = null;
const shaftCache = new Map<string, HTMLCanvasElement>();
/** Facho de luz (trapézio suave, estreito em cima), tingido e guardado em cache. */
export function shaftSprite(color: string): HTMLCanvasElement {
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
export function streakSprite(): HTMLCanvasElement {
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

export const VIG = 'rgba(4,2,10,0.6)';
const vigCache = new Map<string, HTMLCanvasElement>();
/** Vinheta radial (rgb = cor da penumbra, a = opacidade máxima). */
export function makeVignette(rgb = '4,2,10', a = 0.6): HTMLCanvasElement {
  const key = rgb + '|' + a;
  const hit = vigCache.get(key);
  if (hit) return hit;
  const [c, g] = mk(256, 256);
  const rg = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  rg.addColorStop(0, `rgba(${rgb},0)`);
  rg.addColorStop(0.42, `rgba(${rgb},0)`);
  rg.addColorStop(0.78, `rgba(${rgb},${a * 0.6})`);
  rg.addColorStop(1, `rgba(${rgb},${a})`);
  g.fillStyle = rg;
  g.fillRect(0, 0, 256, 256);
  vigCache.set(key, c);
  return c;
}

export function shaft(ctx: CanvasRenderingContext2D, spr: HTMLCanvasElement, ox: number, oy: number, ang: number, len: number, wBottom: number, a: number): void {
  ctx.save();
  ctx.translate(ox, oy);
  ctx.rotate(ang);
  ctx.globalAlpha = a;
  ctx.drawImage(spr, -wBottom / 2, 0, wBottom, len);
  ctx.restore();
}

/** Brilho aditivo (sprite radial) centrado em (x, y). */
export function glow(g: CanvasRenderingContext2D, color: string, x: number, y: number, rx: number, ry: number, a: number): void {
  const op = g.globalCompositeOperation;
  const ga = g.globalAlpha;
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = a;
  g.drawImage(glowSprite(color), x - rx, y - ry, rx * 2, ry * 2);
  g.globalAlpha = ga;
  g.globalCompositeOperation = op;
}

/** Texto cartoon com contorno grosso. */
export function inkText(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string | CanvasGradient, lw = size * 0.2, out = OUT, maxW?: number): void {
  g.font = `${size}px "Luckiest Guy", Impact, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = lw;
  g.strokeStyle = out;
  g.strokeText(text, x, y, maxW);
  g.fillStyle = fill;
  g.fillText(text, x, y, maxW);
}

/** Gradiente linear vertical a partir de [posição, cor]. */
export function vgrad(g: CanvasRenderingContext2D, y0: number, y1: number, stops: [number, string][]): CanvasGradient {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  for (const [p, c] of stops) gr.addColorStop(p, c);
  return gr;
}

/** Tapete pré-desenhado: devolve o canvas e o contexto já recortado ao trapézio do tapete, em coordenadas do mundo. */
export const MAT_SCALE = 2;
export function matShell(): [HTMLCanvasElement, CanvasRenderingContext2D, number, number] {
  const W = FRONT_X * 2;
  const H = FRONT_Y - BACK_Y;
  const [c, g] = mk(W * MAT_SCALE, H * MAT_SCALE);
  g.scale(MAT_SCALE, MAT_SCALE);
  g.translate(FRONT_X, -BACK_Y);
  g.beginPath();
  g.moveTo(-BACK_X, BACK_Y);
  g.lineTo(BACK_X, BACK_Y);
  g.lineTo(FRONT_X, FRONT_Y);
  g.lineTo(-FRONT_X, FRONT_Y);
  g.closePath();
  g.clip();
  return [c, g, W, H];
}

/** Escala horizontal do tapete à profundidade y (0 = trás, 1 = frente) — para desenhar em perspetiva. */
export function matW(y: number): number {
  const u = (y - BACK_Y) / (FRONT_Y - BACK_Y);
  return BACK_X + (FRONT_X - BACK_X) * u;
}

/** Acabamento comum do tapete: trama, sombra das cordas e dos bordos, luz do holofote. */
export function matFinish(g: CanvasRenderingContext2D, o: { weave?: [string, string]; hot?: string; hotA?: number; shade?: string; edge?: string; edgeHi?: string; noHot?: boolean }): void {
  const W = FRONT_X * 2;
  const H = FRONT_Y - BACK_Y;
  const [wa, wb] = o.weave ?? ['rgba(255,255,255,0.22)', 'rgba(60,70,100,0.07)'];
  for (let i = 0; i < 9000; i++) {
    const x = (hashK(i * 3 + 1) - 0.5) * W;
    const y = BACK_Y + hashK(i * 7 + 2) * H;
    g.fillStyle = hashK(i * 11) > 0.5 ? wa : wb;
    g.fillRect(x, y, 2.2, 0.6);
  }
  const shade = o.shade ?? '20,15,40';
  if (!o.noHot) {
    g.save();
    g.scale(1, 0.26);
    const hot = g.createRadialGradient(0, -60, 0, 0, -60, 520);
    const hc = o.hot ?? '255,250,235';
    const a = o.hotA ?? 0.55;
    hot.addColorStop(0, `rgba(${hc},${a})`);
    hot.addColorStop(0.5, `rgba(${hc},${a * 0.33})`);
    hot.addColorStop(1, `rgba(${hc},0)`);
    g.fillStyle = hot;
    g.fillRect(-FRONT_X, -1200, W, 2400);
    g.restore();
  }
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const off = 12 + k * 9;
      g.strokeStyle = `rgba(${shade},${0.1 - k * 0.022})`;
      g.lineWidth = 6 + k * 3;
      g.beginPath();
      g.moveTo(sx * (BACK_X - off * 0.7), BACK_Y + 2);
      g.lineTo(sx * (FRONT_X - off), FRONT_Y - 4);
      g.stroke();
    }
    const eg = g.createLinearGradient(sx * FRONT_X, 0, sx * (FRONT_X - 90), 0);
    eg.addColorStop(0, `rgba(${shade},0.22)`);
    eg.addColorStop(1, `rgba(${shade},0)`);
    g.fillStyle = eg;
    g.fillRect(sx > 0 ? FRONT_X - 90 : -FRONT_X, BACK_Y, 90, H);
  }
  const back = g.createLinearGradient(0, BACK_Y, 0, BACK_Y + 34);
  back.addColorStop(0, `rgba(${shade},0.3)`);
  back.addColorStop(1, `rgba(${shade},0)`);
  g.fillStyle = back;
  g.fillRect(-FRONT_X, BACK_Y, W, 34);
  if (o.edge) {
    g.fillStyle = o.edge;
    g.fillRect(-FRONT_X, FRONT_Y - 7, W, 7);
    g.fillStyle = o.edgeHi ?? 'rgba(255,255,255,0.25)';
    g.fillRect(-FRONT_X, FRONT_Y - 7, W, 1.5);
  }
}

function hashK(i: number): number {
  const x = Math.sin(i * 91.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Desenha no tapete (achatado em perspetiva) — `fn` desenha num plano visto de cima, centrado em (0, cy). */
export function onMat(g: CanvasRenderingContext2D, cy: number, sy: number, fn: () => void): void {
  g.save();
  g.translate(0, cy);
  g.scale(1, sy);
  fn();
  g.restore();
}

// ───────────────────────── Tema de arena ─────────────────────────

/** Postes e esticadores. */
export interface PostStyle {
  /** Gradiente horizontal do poste [posição, cor]. */
  stops: [number, string][];
  /** Almofadas dos esticadores [canto vermelho, canto azul] e o seu lado escuro. */
  pads: [string, string];
  padDark: [string, string];
  /** Esticador metálico por trás da almofada. */
  buckle: string;
  cap: string;
  /** Brilho aditivo nas almofadas (arenas néon). */
  glow?: [string, string];
}

/** Tudo o que distingue uma arena. As funções de desenho correm no espaço indicado. */
export interface ArenaTheme {
  ropes: [string, string, string];
  ropeDark: [string, string, string];
  /** Brilho aditivo à volta das cordas (cordas de néon). */
  ropeGlow?: [string, string, string];
  post: PostStyle;
  /** Pré-renderiza as camadas estáticas (chamado uma vez, antes da primeira luta nesta arena). */
  prepare(): void;
  /** Fundo, em espaço de ecrã. `horizonY` = linha do fundo do ringue no ecrã. */
  backdrop(ctx: CanvasRenderingContext2D, w: number, h: number, camX: number, zoom: number, horizonY: number, t: number, hype: number, low: boolean): void;
  /** Tapete (canvas pré-renderizado de matShell). */
  mat(): HTMLCanvasElement;
  /** Luzes animadas sobre o tapete (espaço do mundo, antes dos lutadores). */
  matFx?(ctx: CanvasRenderingContext2D, t: number, hype: number, low: boolean): void;
  /** Saia do ringue (canvas pré-renderizado SKIRT_W × SKIRT_H, escala SKIRT_S). */
  skirt(): HTMLCanvasElement;
  /** Animação por cima da saia (espaço do mundo, origem no centro da frente do tapete). */
  skirtFx?(ctx: CanvasRenderingContext2D, t: number, hype: number, low: boolean): void;
  /** Degraus de aço nos cantos. */
  steps?: boolean;
  /** Chão à volta do ringue (espaço do mundo). */
  floor(ctx: CanvasRenderingContext2D, t: number): void;
  /** Primeiro plano (espaço do mundo, por cima do ringue). */
  foreground(ctx: CanvasRenderingContext2D, camX: number, t: number, hype: number, low: boolean): void;
  /** Efeitos de ambiente por cima de tudo (espaço de ecrã): chuva, areia, pétalas... */
  overlay?(ctx: CanvasRenderingContext2D, w: number, h: number, camX: number, zoom: number, t: number, hype: number, low: boolean): void;
  /** Tons usados pela cena: neblina, poças de luz sobre os lutadores e escurecimento do fundo. */
  haze: string;
  pool: string;
  tint: string;
  /** Centro (em x do fundo) a mostrar nas miniaturas. */
  previewX?: number;
  /** Contraluz dos lutadores [equipa 0, equipa 1] (opcional). */
  rim?: [string, string];
}

export const SKIRT_W = FRONT_X * 2 + 12;
export const SKIRT_H = 112;
export const SKIRT_S = 2;

/** Canvas da saia já com a origem no centro do topo. */
export function skirtShell(): [HTMLCanvasElement, CanvasRenderingContext2D, number] {
  const [c, g] = mk(SKIRT_W * SKIRT_S, SKIRT_H * SKIRT_S);
  g.scale(SKIRT_S, SKIRT_S);
  g.translate(SKIRT_W / 2, 0);
  return [c, g, -SKIRT_W / 2];
}

/** Sombra nas pontas da saia (volume). */
export function skirtEdges(g: CanvasRenderingContext2D, a = 0.5): void {
  const L = -SKIRT_W / 2;
  const edge = g.createLinearGradient(L, 0, -L, 0);
  edge.addColorStop(0, `rgba(0,0,0,${a})`);
  edge.addColorStop(0.1, 'rgba(0,0,0,0)');
  edge.addColorStop(0.9, 'rgba(0,0,0,0)');
  edge.addColorStop(1, `rgba(0,0,0,${a})`);
  g.fillStyle = edge;
  g.fillRect(L, 0, SKIRT_W, SKIRT_H);
}

/** Posição/escala do fundo no ecrã (igual em todas as arenas, para a paralaxe bater certo). */
export function backdropRect(w: number, camX: number, zoom: number, horizonY: number): { x: number; y: number; s: number; dw: number; dh: number } {
  const s = zoom * 0.95;
  const dw = BW * s;
  const dh = BH * s;
  return { x: w / 2 - dw / 2 - camX * zoom * 0.45, y: horizonY - dh + 40 * s, s, dw, dh };
}

/** Queda de luz centrada no ringue: o que está longe do ringue fica na penumbra. */
export function ringVignette(ctx: CanvasRenderingContext2D, w: number, camX: number, zoom: number, horizonY: number, rx0 = 1350, ry0 = 720, rgb = '4,2,10', a = 0.6): void {
  const vig = makeVignette(rgb, a);
  const vcx = w / 2 - camX * zoom;
  const vcy = horizonY - 30 * zoom;
  const rx = rx0 * zoom;
  const ry = ry0 * zoom;
  ctx.drawImage(vig, vcx - rx, vcy - ry, rx * 2, ry * 2);
  ctx.fillStyle = `rgba(${rgb},${a})`;
  if (vcy - ry > 0) ctx.fillRect(0, 0, w, vcy - ry);
  if (vcx - rx > 0) ctx.fillRect(0, Math.max(0, vcy - ry), vcx - rx, ry * 2);
  if (vcx + rx < w) ctx.fillRect(vcx + rx, Math.max(0, vcy - ry), w - vcx - rx, ry * 2);
}

/** Chama cartoon animada (tochas, braseiros). `s` = escala, base em (x, y). */
export function flame(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, seed: number, low = false): void {
  const f1 = Math.sin(t * 11 + seed * 7.1) * 0.5 + Math.sin(t * 17 + seed * 3.3) * 0.5;
  const f2 = Math.sin(t * 9 + seed * 5.7);
  const layers: [string, number, number][] = [
    ['#ff4d1a', 1, 1],
    ['#ff9a1f', 0.72, 0.8],
    ['#ffe27a', 0.42, 0.55],
  ];
  if (!low) {
    const op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5 + 0.12 * f2;
    ctx.drawImage(glowSprite('#ff8a2a'), x - 60 * s, y - 80 * s, 120 * s, 110 * s);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = op;
  }
  for (const [c, k, hk] of layers) {
    const w = 13 * s * k;
    const h = (40 + f1 * 6) * s * hk;
    const lean = (f2 * 5 + Math.sin(t * 5 + seed) * 3) * s * k;
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.bezierCurveTo(x - w * 1.25, y - h * 0.45, x - w * 0.2 + lean * 0.4, y - h * 0.7, x + lean, y - h);
    ctx.bezierCurveTo(x + w * 0.3 + lean * 0.4, y - h * 0.6, x + w * 1.25, y - h * 0.45, x + w, y);
    ctx.quadraticCurveTo(x, y + w * 0.6, x - w, y);
    ctx.fillStyle = c;
    ctx.fill();
    if (k === 1) {
      ctx.lineWidth = 1.6 * s;
      ctx.strokeStyle = 'rgba(90,20,10,0.8)';
      ctx.stroke();
    }
  }
}
