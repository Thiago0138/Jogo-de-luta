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

export interface RopeState {
  /** Deformação das cordas laterais (esquerda/direita) e velocidade da mola. */
  bulge: [number, number];
  vel: [number, number];
  /** Deformação da corda da frente por cima do lutador que entra/sai. */
}

export function newRopes(): RopeState {
  return { bulge: [0, 0], vel: [0, 0] };
}

export function updateRopes(r: RopeState, dt: number): void {
  for (let i = 0; i < 2; i++) {
    const a = -r.bulge[i] * 260 - r.vel[i] * 9;
    r.vel[i] += a * dt;
    r.bulge[i] += r.vel[i] * dt;
  }
}

export function pushRope(r: RopeState, side: 0 | 1, amount: number): void {
  r.vel[side] += amount;
}

// ───────────────────────── Fundo pré-renderizado ─────────────────────────

let backdrop: HTMLCanvasElement | null = null;
let crowdA: HTMLCanvasElement | null = null;
let crowdB: HTMLCanvasElement | null = null;
const BW = 2600;
const BH = 760;

const SHIRTS = ['#e63946', '#f1c40f', '#3498db', '#2ecc71', '#9b59b6', '#ecf0f1', '#e67e22', '#1abc9c', '#ff6fb5', '#34495e'];
const SKINS = ['#f6c9a4', '#e8b083', '#b9774c', '#6e3f28', '#d29466', '#94593a'];

function makeCrowd(rowsOdd: boolean): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = BW;
  c.height = BH;
  const g = c.getContext('2d')!;
  const rows = 7;
  for (let r = 0; r < rows; r++) {
    if ((r % 2 === 1) !== rowsOdd) continue;
    const y = 240 + r * 64;
    const light = 0.35 + (r / rows) * 0.65;
    const step = 34 - r * 0.5;
    for (let x = -10, i = 0; x < BW + 20; x += step + hash(r * 999 + i) * 10, i++) {
      const h = hash(r * 77 + i * 13);
      const jitter = (hash(i * 3 + r) - 0.5) * 10;
      g.globalAlpha = light;
      // ombros/camisola
      g.fillStyle = SHIRTS[Math.floor(h * SHIRTS.length)];
      g.beginPath();
      g.ellipse(x, y + 34 + jitter, 18, 22, 0, Math.PI, 0);
      g.fill();
      // cabeça
      g.fillStyle = SKINS[Math.floor(hash(i + r * 5) * SKINS.length)];
      g.beginPath();
      g.arc(x, y + 6 + jitter, 10.5, 0, Math.PI * 2);
      g.fill();
      // cabelo / boné
      g.fillStyle = h > 0.7 ? SHIRTS[Math.floor(hash(i * 7) * SHIRTS.length)] : '#1a1410';
      g.beginPath();
      g.arc(x, y + 3 + jitter, 10.5, Math.PI, 0);
      g.fill();
      // braços no ar para alguns
      if (h > 0.82) {
        g.strokeStyle = g.fillStyle;
        g.lineWidth = 6;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(x - 14, y + 26 + jitter);
        g.lineTo(x - 22, y - 16 + jitter);
        g.moveTo(x + 14, y + 26 + jitter);
        g.lineTo(x + 20, y - 18 + jitter);
        g.stroke();
      }
      // cartazes
      if (h < 0.035) {
        g.globalAlpha = light;
        g.fillStyle = '#fff';
        g.fillRect(x - 26, y - 38 + jitter, 52, 30);
        g.fillStyle = SHIRTS[i % SHIRTS.length];
        g.font = 'bold 13px sans-serif';
        g.textAlign = 'center';
        g.fillText(['UAU!', 'KO!', '10/10', 'LENDA', 'FORÇA'][i % 5], x, y - 18 + jitter);
      }
    }
  }
  g.globalAlpha = 1;
  return c;
}

function makeBackdrop(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = BW;
  c.height = BH;
  const g = c.getContext('2d')!;
  const bg = g.createLinearGradient(0, 0, 0, BH);
  bg.addColorStop(0, '#07040f');
  bg.addColorStop(0.45, '#1a0f33');
  bg.addColorStop(1, '#2a1640');
  g.fillStyle = bg;
  g.fillRect(0, 0, BW, BH);
  // bancadas
  for (let r = 0; r < 8; r++) {
    g.fillStyle = `rgba(255,255,255,${0.02 + r * 0.006})`;
    g.fillRect(0, 250 + r * 64, BW, 3);
  }
  // treliça de luzes
  g.strokeStyle = '#2b2440';
  g.lineWidth = 8;
  g.beginPath();
  g.moveTo(0, 60);
  g.lineTo(BW, 60);
  g.moveTo(0, 84);
  g.lineTo(BW, 84);
  g.stroke();
  g.lineWidth = 3;
  for (let x = 0; x < BW; x += 40) {
    g.beginPath();
    g.moveTo(x, 60);
    g.lineTo(x + 20, 84);
    g.lineTo(x + 40, 60);
    g.stroke();
  }
  for (let x = 120; x < BW; x += 180) {
    g.fillStyle = '#3b3352';
    g.fillRect(x - 12, 84, 24, 18);
    g.drawImage(glowSprite('#fff4d6'), x - 30, 80, 60, 60);
  }
  // ecrã gigante
  const sx = BW / 2 - 230;
  g.fillStyle = '#0b0b14';
  g.fillRect(sx - 10, 110, 480, 150);
  const sg = g.createLinearGradient(sx, 120, sx + 460, 250);
  sg.addColorStop(0, '#3a0d5c');
  sg.addColorStop(0.5, '#a3123a');
  sg.addColorStop(1, '#ff8a00');
  g.fillStyle = sg;
  g.fillRect(sx, 120, 460, 130);
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '64px "Luckiest Guy", Impact, sans-serif';
  g.fillText('REIS DO RINGUE', BW / 2, 192);
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.35;
  g.drawImage(glowSprite('#ff5a8a'), sx - 120, 40, 700, 300);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  // barreiras de proteção
  const by = BH - 80;
  g.fillStyle = '#111018';
  g.fillRect(0, by, BW, 80);
  g.fillStyle = '#e63946';
  for (let x = 0; x < BW; x += 260) {
    g.fillRect(x + 20, by + 18, 200, 30);
  }
  g.fillStyle = '#fff';
  g.font = '22px "Luckiest Guy", Impact, sans-serif';
  for (let x = 0; x < BW; x += 260) g.fillText('LUTA!', x + 120, by + 34);
  return c;
}

export function ensureArena(): void {
  if (backdrop) return;
  backdrop = makeBackdrop();
  crowdA = makeCrowd(false);
  crowdB = makeCrowd(true);
}

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
  ctx.fillStyle = '#07040f';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(backdrop!, x, y, dw, dh);
  const bounce = Math.abs(Math.sin(t * (4 + hype * 6))) * (2 + hype * 9) * s;
  ctx.drawImage(crowdA!, x, y - bounce, dw, dh);
  ctx.drawImage(crowdB!, x, y - (hype > 0.3 ? Math.abs(Math.sin(t * 7 + 1.5)) * hype * 10 * s : 0), dw, dh);

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
  // holofotes
  if (!low) {
    const beams = 4;
    for (let i = 0; i < beams; i++) {
      const ang = Math.sin(t * 0.35 + i * 1.7) * 0.35;
      const bx = w * (0.12 + i * 0.25);
      ctx.save();
      ctx.translate(bx, 0);
      ctx.rotate(ang);
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      const col = ['rgba(255,80,140,', 'rgba(80,160,255,', 'rgba(255,220,120,', 'rgba(160,90,255,'][i];
      grad.addColorStop(0, col + (0.22 + hype * 0.15) + ')');
      grad.addColorStop(1, col + '0)');
      ctx.fillStyle = grad;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(10, 0);
      ctx.lineTo(w * 0.12, h);
      ctx.lineTo(-w * 0.12, h);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = prev;
}

// ───────────────────────── Ringue (espaço do mundo) ─────────────────────────

let matGrad: CanvasGradient | null = null;
let skirtGrad: CanvasGradient | null = null;

function rope(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, cx: number, cy: number, color: string) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(cx, cy, x2, y2);
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#120a18';
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.stroke();
}

const ROPE_COLORS = ['#e63946', '#f1f1f1', '#2f7bff'];

function post(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, w: number, team: number) {
  ctx.fillStyle = '#1b1b24';
  ctx.fillRect(x - w / 2, y - h, w, h);
  ctx.fillStyle = '#3a3a4a';
  ctx.fillRect(x - w / 2, y - h, w * 0.35, h);
  // almofadas dos cantos
  for (const rh of ROPE_H) {
    ctx.fillStyle = TEAM_COLORS[team];
    ctx.beginPath();
    ctx.roundRect(x - w / 2 - 4, y - rh - 9, w + 8, 18, 5);
    ctx.fill();
  }
  ctx.fillStyle = '#c0c4cc';
  ctx.fillRect(x - w / 2 - 2, y - h - 6, w + 4, 8);
}

export function drawRingBack(ctx: CanvasRenderingContext2D, ropes: RopeState): void {
  // tapete
  if (!matGrad) {
    matGrad = ctx.createLinearGradient(0, BACK_Y, 0, FRONT_Y);
    matGrad.addColorStop(0, '#9aa3b8');
    matGrad.addColorStop(1, '#e3e8f2');
  }
  ctx.fillStyle = matGrad;
  ctx.beginPath();
  ctx.moveTo(-BACK_X, BACK_Y);
  ctx.lineTo(BACK_X, BACK_Y);
  ctx.lineTo(FRONT_X, FRONT_Y);
  ctx.lineTo(-FRONT_X, FRONT_Y);
  ctx.closePath();
  ctx.fill();
  // logótipo central do tapete
  ctx.save();
  ctx.scale(1, 0.24);
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#c4122c';
  ctx.beginPath();
  ctx.arc(0, -40, 150, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(196,18,44,0.18)';
  ctx.fill();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#c4122c';
  ctx.beginPath();
  ctx.moveTo(-70, 10);
  ctx.lineTo(-80, -90);
  ctx.lineTo(-35, -40);
  ctx.lineTo(0, -110);
  ctx.lineTo(35, -40);
  ctx.lineTo(80, -90);
  ctx.lineTo(70, 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;

  // postes de trás
  post(ctx, -BACK_X, BACK_Y, POST_H - 10, 14, 0);
  post(ctx, BACK_X, BACK_Y, POST_H - 10, 14, 1);
  // cordas de trás
  for (let i = 0; i < 3; i++) {
    const h = ROPE_H[i] * 0.92;
    rope(ctx, -BACK_X, BACK_Y - h, BACK_X, BACK_Y - h, 0, BACK_Y - h + 3, ROPE_COLORS[i]);
  }
  // cordas laterais (com deformação quando alguém bate nelas)
  for (let side = 0; side < 2; side++) {
    const sx = side ? 1 : -1;
    const b = ropes.bulge[side] * sx;
    for (let i = 0; i < 3; i++) {
      const hb = ROPE_H[i] * 0.92;
      const hf = ROPE_H[i];
      const x1 = sx * BACK_X;
      const y1 = BACK_Y - hb;
      const x2 = sx * FRONT_X;
      const y2 = FRONT_Y - hf;
      rope(ctx, x1, y1, x2, y2, (x1 + x2) / 2 + b * (1 - i * 0.15), (y1 + y2) / 2, ROPE_COLORS[i]);
    }
  }
}

export function drawRingFront(ctx: CanvasRenderingContext2D, ropes: RopeState): void {
  // saia do ringue
  if (!skirtGrad) {
    skirtGrad = ctx.createLinearGradient(0, FRONT_Y, 0, FRONT_Y + 110);
    skirtGrad.addColorStop(0, '#1d1430');
    skirtGrad.addColorStop(1, '#0c0814');
  }
  ctx.fillStyle = skirtGrad;
  ctx.fillRect(-FRONT_X - 6, FRONT_Y, FRONT_X * 2 + 12, 120);
  ctx.fillStyle = '#c4122c';
  ctx.fillRect(-FRONT_X - 6, FRONT_Y, FRONT_X * 2 + 12, 8);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '44px "Luckiest Guy", Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('REIS DO RINGUE', 0, FRONT_Y + 60);
  ctx.fillStyle = '#ffd23d';
  ctx.font = '26px "Luckiest Guy", Impact, sans-serif';
  ctx.fillText('★', -260, FRONT_Y + 58);
  ctx.fillText('★', 260, FRONT_Y + 58);

  // postes da frente
  post(ctx, -FRONT_X, FRONT_Y, POST_H, 18, 0);
  post(ctx, FRONT_X, FRONT_Y, POST_H, 18, 1);
  // cordas da frente (ligeiramente transparentes para não tapar a ação)
  ctx.globalAlpha = 0.9;
  for (let i = 0; i < 3; i++) {
    const h = ROPE_H[i];
    const sag = 4 + Math.abs(ropes.bulge[0] + ropes.bulge[1]) * 0.05;
    rope(ctx, -FRONT_X, FRONT_Y - h, FRONT_X, FRONT_Y - h, 0, FRONT_Y - h + sag, ROPE_COLORS[i]);
  }
  ctx.globalAlpha = 1;
}

// ───────────────────────── Público em primeiro plano ─────────────────────────

let fgA: HTMLCanvasElement | null = null;
let fgB: HTMLCanvasElement | null = null;
const FW = 3200;
const FH = 420;

function makeForeground(odd: boolean): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = FW / 2;
  c.height = FH / 2;
  const g = c.getContext('2d')!;
  g.scale(0.5, 0.5);
  for (let i = 0, x = 20; x < FW; i++, x += 70 + hash(i * 5) * 40) {
    if ((i % 2 === 1) !== odd) continue;
    const y = 120 + hash(i * 3 + 1) * 40;
    const r = 36 + hash(i * 7) * 10;
    // ombros
    g.fillStyle = odd ? '#150d26' : '#1d1233';
    g.beginPath();
    g.ellipse(x, y + r * 2.3, r * 1.9, r * 1.5, 0, Math.PI, 0);
    g.lineTo(x + r * 1.9, FH);
    g.lineTo(x - r * 1.9, FH);
    g.fill();
    // cabeça
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    // luz de recorte
    g.strokeStyle = 'rgba(180,140,255,0.45)';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(x, y, r - 2, Math.PI * 1.1, Math.PI * 1.75);
    g.stroke();
    // telemóveis no ar
    if (hash(i * 11) > 0.72) {
      const px = x + (hash(i) - 0.5) * 40;
      g.strokeStyle = odd ? '#150d26' : '#1d1233';
      g.lineWidth = 14;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x + r * 0.8, y + r * 1.4);
      g.lineTo(px + 10, y - r * 1.3);
      g.stroke();
      g.fillStyle = '#1a1430';
      g.fillRect(px - 6, y - r * 2.2, 34, 56);
      g.fillStyle = 'rgba(190,220,255,0.85)';
      g.fillRect(px - 2, y - r * 2.2 + 4, 26, 46);
    }
  }
  return c;
}

/** Fila de espectadores em silhueta à frente do ringue (dá profundidade). */
export function drawForeground(ctx: CanvasRenderingContext2D, camX: number, t: number, hype: number): void {
  if (!fgA) {
    fgA = makeForeground(false);
    fgB = makeForeground(true);
  }
  const par = camX * 0.25;
  const y0 = FRONT_Y + 30;
  const b1 = Math.abs(Math.sin(t * (5 + hype * 5))) * hype * 16;
  const b2 = Math.abs(Math.sin(t * (5 + hype * 5) + 1.3)) * hype * 16;
  ctx.drawImage(fgB!, -FW / 2 + par, y0 - b2 + 18, FW, FH);
  ctx.drawImage(fgA!, -FW / 2 + par + 35, y0 - b1, FW, FH);
}

/** Chão fora do ringue (à frente da saia). */
export function drawFloor(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#0a0710';
  ctx.fillRect(-3000, FRONT_Y + 110, 6000, 600);
}
