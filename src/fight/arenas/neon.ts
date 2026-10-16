import { glowSprite } from '../../render/fighter';
import { hash } from '../fx';
import {
  BACK_X, BACK_Y, BH, BW, FRONT_X, FRONT_Y, SKIRT_H, SKIRT_W, backdropRect, inked, makeLayer, matFinish, matShell, matW, mk, onMat, ringVignette, shaft,
  shaftSprite, skirtEdges, skirtShell, streakSprite, vgrad, type ArenaTheme, type Layer,
} from '../arenaKit';
import { buildCrowd, drawCrowd, drawCrowdLights, type Crowd } from '../crowd';

/**
 * Neon Rooftop — o ringue no telhado de um arranha-céus numa megacidade à noite: arranha-céus
 * com janelas acesas, letreiros de néon, ecrã gigante, carros voadores, chuva e o holofote de
 * um helicóptero da polícia a varrer o ringue.
 */

const INK = '#07040f';
const PINK = '#ff3fbf';
const CYAN = '#3af0ff';
const VIOLET = '#a05aff';
const AMBER = '#ffb347';
const PARAPET = 676;
const BILL = { x: 1880, y: 330, w: 300, h: 170 };

// ───────────────────────── fundo ─────────────────────────

/** Brilho de néon pré-renderizado. */
function neonGlow(g: CanvasRenderingContext2D, color: string, x: number, y: number, rx: number, ry: number, a: number): void {
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = a;
  g.drawImage(glowSprite(color), x - rx, y - ry, rx * 2, ry * 2);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}

/** Texto em tubo de néon: halo largo, tubo colorido e núcleo branco. */
function neonText(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, vertical = false): void {
  g.font = `${size}px "Luckiest Guy", Impact, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const chars = vertical ? text.split('') : [text];
  chars.forEach((ch, i) => {
    const yy = vertical ? y + i * size * 0.95 : y;
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.35;
    g.lineWidth = size * 0.35;
    g.strokeStyle = color;
    g.lineJoin = 'round';
    g.strokeText(ch, x, yy);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.lineWidth = size * 0.12;
    g.strokeStyle = color;
    g.strokeText(ch, x, yy);
    g.lineWidth = size * 0.04;
    g.strokeStyle = '#ffffff';
    g.strokeText(ch, x, yy);
  });
}

function windows(g: CanvasRenderingContext2D, x: number, top: number, w: number, base: number, cw: number, ch: number, seed: number, lit: number, cols: string[]): void {
  for (let yy = top + 10; yy < base - ch; yy += ch * 1.9) {
    for (let xx = x + 6; xx < x + w - cw - 4; xx += cw * 1.8) {
      const h = hash(seed + xx * 0.37 + yy * 1.31);
      if (h > lit) continue;
      g.fillStyle = cols[Math.floor(hash(h * 91 + seed) * cols.length)];
      g.globalAlpha = 0.45 + hash(h * 13) * 0.55;
      g.fillRect(xx, yy, cw, ch);
    }
  }
  g.globalAlpha = 1;
}

let antennas: { x: number; y: number; p: number }[] = [];

function skyline(g: CanvasRenderingContext2D): void {
  g.fillStyle = vgrad(g, 0, PARAPET, [
    [0, '#05030f'],
    [0.35, '#160830'],
    [0.62, '#33104e'],
    [0.82, '#6e1a68'],
    [1, '#b02a6a'],
  ]);
  g.fillRect(0, 0, BW, BH);
  // estrelas por entre o smog
  for (let i = 0; i < 70; i++) {
    g.globalAlpha = 0.25 + hash(i * 7.1) * 0.4;
    g.fillStyle = '#e8dcff';
    g.fillRect(hash(i * 5.7) * BW, hash(i * 3.3) * 260, 2, 2);
  }
  g.globalAlpha = 1;
  // lua cor-de-rosa atrás das nuvens
  neonGlow(g, '#ff7ad9', 1650, 300, 300, 260, 0.35);
  g.fillStyle = vgrad(g, 230, 370, [[0, '#ffe0f4'], [1, '#ff9ad8']]);
  g.beginPath();
  g.arc(1650, 300, 70, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(220,120,200,0.45)';
  for (const [cx, cy, r] of [[1625, 285, 14], [1675, 320, 10], [1660, 270, 7]]) {
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
  }
  for (const [cx, cy, cw] of [[1600, 330, 260], [1760, 290, 200], [600, 250, 420], [2300, 220, 300]] as const) {
    g.fillStyle = 'rgba(40,12,70,0.85)';
    g.beginPath();
    g.ellipse(cx, cy, cw / 2, 12, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,120,210,0.35)';
    g.beginPath();
    g.ellipse(cx, cy - 6, cw * 0.4, 4, 0, 0, Math.PI * 2);
    g.fill();
  }
  // camada 1: torres distantes, enevoadas
  antennas = [];
  for (let x = -20, i = 0; x < BW; i++) {
    const w = 50 + hash(i * 3.7) * 90;
    const top = 330 + hash(i * 1.9) * 220;
    g.fillStyle = '#2a1048';
    g.fillRect(x, top, w, PARAPET - top);
    windows(g, x, top, w, PARAPET, 3, 4, i * 7, 0.35, ['#ffb0e0', '#9fe8ff', '#ffd9a0']);
    if (hash(i * 5.3) > 0.6) {
      g.fillStyle = '#2a1048';
      g.fillRect(x + w / 2 - 1.5, top - 40, 3, 40);
      antennas.push({ x: x + w / 2, y: top - 40, p: hash(i) * 6 });
    }
    x += w + 4 + hash(i * 9.1) * 20;
  }
  g.fillStyle = 'rgba(176,42,106,0.35)';
  g.fillRect(0, 0, BW, BH);
  // camada 2: arranha-céus do meio, com néones
  const mids: [number, number, number][] = [
    [120, 300, 170], [330, 380, 140], [520, 250, 190], [760, 400, 120], [930, 330, 150], [1120, 430, 110], [1270, 360, 130],
    [1460, 410, 120], [1620, 300, 150], [2230, 280, 170], [2440, 360, 160],
  ];
  mids.forEach(([x, top, w], i) => {
    const bg = g.createLinearGradient(x, 0, x + w, 0);
    bg.addColorStop(0, '#1a0c34');
    bg.addColorStop(0.7, '#120826');
    bg.addColorStop(1, '#0a0518');
    g.fillStyle = bg;
    g.fillRect(x, top, w, PARAPET - top);
    // topo escalonado e antena
    g.fillRect(x + w * 0.2, top - 26, w * 0.6, 26);
    g.fillRect(x + w * 0.45, top - 70, 4, 44);
    antennas.push({ x: x + w * 0.45 + 2, y: top - 70, p: i * 1.3 });
    windows(g, x, top, w, PARAPET, 6, 8, i * 31 + 5, 0.42, ['#ffe9a8', '#9fe8ff', '#ffc0f0', '#ffffff']);
    // fita de néon no topo
    const nc = [PINK, CYAN, VIOLET, AMBER][i % 4];
    g.fillStyle = nc;
    g.fillRect(x, top - 2, w, 3);
    neonGlow(g, nc, x + w / 2, top, w * 0.7, 30, 0.35);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    g.fillRect(x, top, 3, PARAPET - top);
  });
  // letreiros verticais
  const signs: [number, number, string, string][] = [
    [300, 420, 'HOTEL', PINK], [700, 330, 'RAMEN', CYAN], [1080, 470, 'BAR', AMBER], [1560, 430, '24H', VIOLET], [2380, 400, 'K.O.', PINK],
  ];
  for (const [sx, sy, txt, col] of signs) {
    const h = txt.length * 30 + 16;
    g.beginPath();
    g.roundRect(sx - 22, sy - 22, 44, h, 6);
    inked(g, '#0b0618', 3, INK);
    neonText(g, txt, sx, sy, 28, col, true);
  }
  // ecrã gigante (o conteúdo anima por frame)
  g.beginPath();
  g.rect(BILL.x - 14, BILL.y - 14, BILL.w + 28, BILL.h + 28);
  inked(g, '#141024', 4, INK);
  g.fillStyle = '#26203a';
  g.fillRect(BILL.x + BILL.w / 2 - 30, BILL.y + BILL.h + 14, 60, PARAPET - BILL.y - BILL.h - 14);
  // pontes de luz entre torres e passagens
  g.strokeStyle = 'rgba(58,240,255,0.5)';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(690, 520);
  g.lineTo(930, 540);
  g.moveTo(1400, 560);
  g.lineTo(1620, 545);
  g.stroke();
  // camada 3: torres de perto nos lados (molduras escuras com letreiros gigantes)
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? 0 : BW - 330;
    g.fillStyle = vgrad(g, 100, PARAPET, [[0, '#0e0820'], [1, '#07040f']]);
    g.fillRect(x0, 120, 330, PARAPET);
    windows(g, x0, 140, 330, PARAPET, 10, 12, side * 77, 0.32, ['#ffe9a8', '#9fe8ff', '#ffc0f0']);
    g.fillStyle = side < 0 ? PINK : CYAN;
    g.fillRect(side < 0 ? 326 : BW - 330, 120, 4, PARAPET);
    neonGlow(g, side < 0 ? PINK : CYAN, side < 0 ? 328 : BW - 328, 400, 60, 300, 0.5);
  }
  neonText(g, 'FIGHT', 165, 260, 70, CYAN);
  neonText(g, 'CLUB', 165, 340, 70, PINK);
  neonText(g, 'NEO', BW - 165, 280, 90, AMBER);
  // smog iluminado pela cidade no horizonte
  neonGlow(g, '#ff4fa8', BW / 2, PARAPET - 30, BW * 0.6, 120, 0.35);
}

let backdrop: HTMLCanvasElement | null = null;
let crowd: Crowd | null = null;
let roof: Layer | null = null;

/** Muro do telhado, com tubo de néon, depósito de água, caixas de ar condicionado e a porta da escada. */
function makeRoof(): Layer {
  return makeLayer(500, BH, 0.6, '', (g) => {
    // depósito de água em andaimes
    const tx = 560;
    g.strokeStyle = '#1a1428';
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(tx - 60, PARAPET);
    g.lineTo(tx - 50, 600);
    g.moveTo(tx + 60, PARAPET);
    g.lineTo(tx + 50, 600);
    g.moveTo(tx - 55, 640);
    g.lineTo(tx + 55, 610);
    g.stroke();
    g.beginPath();
    g.roundRect(tx - 72, 510, 144, 96, 10);
    inked(g, vgrad(g, 510, 606, [[0, '#4a3a5a'], [1, '#221a30']]), 4, INK);
    g.beginPath();
    g.moveTo(tx - 80, 512);
    g.lineTo(tx, 470);
    g.lineTo(tx + 80, 512);
    g.closePath();
    inked(g, '#2e2440', 4, INK);
    g.strokeStyle = 'rgba(255,63,191,0.6)';
    g.lineWidth = 2;
    for (let yy = 530; yy < 600; yy += 18) {
      g.beginPath();
      g.moveTo(tx - 70, yy);
      g.lineTo(tx + 70, yy);
      g.stroke();
    }
    // casota da escada com porta acesa
    const dx = 2010;
    g.beginPath();
    g.rect(dx - 90, 570, 180, 110);
    inked(g, '#1e1830', 4, INK);
    g.fillStyle = '#ffd9a0';
    g.fillRect(dx - 26, 600, 52, 80);
    neonGlow(g, '#ffb347', dx, 650, 80, 70, 0.6);
    g.fillStyle = '#ff3b4e';
    g.fillRect(dx - 30, 586, 60, 10);
    g.font = '9px "Luckiest Guy", Impact, sans-serif';
    g.textAlign = 'center';
    g.fillStyle = '#ffffff';
    g.fillText('EXIT', dx, 592);
    // muro (parapeito)
    g.beginPath();
    g.rect(-10, PARAPET, BW + 20, 100);
    inked(g, vgrad(g, PARAPET, BH, [[0, '#3a3450'], [0.15, '#262036'], [1, '#100c1a']]), 4, INK);
    g.fillStyle = 'rgba(255,255,255,0.06)';
    for (let x = 0; x < BW; x += 140) g.fillRect(x, PARAPET + 6, 2, 80);
    // grafíti no muro
    const tags: [number, string, string][] = [[300, 'KOTR', PINK], [900, 'RUMBLE', CYAN], [1500, 'NEO', VIOLET], [2250, 'K.O.', AMBER]];
    for (const [gx, txt, col] of tags) {
      g.font = '38px "Luckiest Guy", Impact, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 7;
      g.strokeStyle = '#0a0612';
      g.save();
      g.translate(gx, PARAPET + 44);
      g.rotate(-0.05);
      g.strokeText(txt, 0, 0);
      g.fillStyle = col;
      g.globalAlpha = 0.85;
      g.fillText(txt, 0, 0);
      g.restore();
    }
    // caixas de ar condicionado e tubos à frente do muro
    for (const ax of [760, 1180, 1420, 1760]) {
      g.beginPath();
      g.rect(ax - 46, PARAPET + 6, 92, 70);
      inked(g, vgrad(g, PARAPET, PARAPET + 76, [[0, '#5a5470'], [1, '#2a2438']]), 3, INK);
      g.beginPath();
      g.arc(ax, PARAPET + 40, 24, 0, Math.PI * 2);
      inked(g, '#16121f', 2.5, INK);
      g.strokeStyle = '#4a4560';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(ax - 20, PARAPET + 40);
      g.lineTo(ax + 20, PARAPET + 40);
      g.moveTo(ax, PARAPET + 20);
      g.lineTo(ax, PARAPET + 60);
      g.stroke();
    }
    // tubo de néon no topo do muro
    g.fillStyle = CYAN;
    g.fillRect(0, PARAPET - 2, BW, 4);
    g.fillStyle = '#ffffff';
    g.fillRect(0, PARAPET - 1, BW, 1.2);
  });
}

function prepare(): void {
  if (backdrop) return;
  const [c, g] = mk(BW, BH);
  skyline(g);
  backdrop = c;
  crowd = buildCrowd({
    rows: [6, 7],
    blocked: (x) => !((x > 640 && x < 1060) || (x > 1520 && x < 1900)),
    shirts: ['#16121f', '#222831', '#ff3fbf', '#3af0ff', '#a05aff', '#34495e', '#ffe14d', '#e63946', '#2f7bff', '#ffffff'],
    haze: '18,6,46',
  });
  roof = makeRoof();
}

/** Carros voadores: pontos de luz com rasto. */
function cars(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number): void {
  const lanes = [380, 450, 520, 300, 560, 410];
  const cols = ['#ffffff', '#ff6fd0', '#7ff6ff', '#ffd27a', '#ffffff', '#ff6fd0'];
  ctx.lineCap = 'round';
  for (let i = 0; i < lanes.length; i++) {
    const dir = i % 2 ? 1 : -1;
    const sp = 120 + hash(i * 3.3) * 160;
    const p = ((t * sp + i * 700) % (BW + 400)) - 200;
    const cx = dir > 0 ? p : BW - p;
    const cy = lanes[i] + Math.sin(t * 0.8 + i) * 6;
    const px = x + cx * s;
    const py = y + cy * s;
    const len = 60 * s;
    const gr = ctx.createLinearGradient(px, py, px - dir * len, py);
    gr.addColorStop(0, cols[i]);
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = gr;
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - dir * len, py);
    ctx.stroke();
    ctx.globalAlpha = 0.8;
    ctx.drawImage(glowSprite(cols[i] === '#ffffff' ? '#cfe8ff' : cols[i]), px - 10 * s, py - 10 * s, 20 * s, 20 * s);
    ctx.globalAlpha = 1;
  }
}

function billboard(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number): void {
  const bx = x + BILL.x * s;
  const by = y + BILL.y * s;
  const bw = BILL.w * s;
  const bh = BILL.h * s;
  const k = Math.floor(t / 4) % 3;
  const gr = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
  const hue = (t * 20) % 360;
  gr.addColorStop(0, `hsl(${hue} 90% 30%)`);
  gr.addColorStop(1, `hsl(${(hue + 80) % 360} 90% 45%)`);
  ctx.fillStyle = gr;
  ctx.fillRect(bx, by, bw, bh);
  ctx.save();
  ctx.beginPath();
  ctx.rect(bx, by, bw, bh);
  ctx.clip();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const words = ['KINGS OF THE RING', 'TONIGHT: ROOFTOP RUMBLE', 'DRINK VOLT ⚡'];
  const fs = 34 * s;
  ctx.font = `${fs}px "Luckiest Guy", Impact, sans-serif`;
  const scroll = bw - ((t * 90 * s) % (bw + 520 * s));
  ctx.lineWidth = 6 * s;
  ctx.strokeStyle = '#0a0612';
  ctx.strokeText(words[k], bx + scroll + 240 * s, by + bh * 0.55);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(words[k], bx + scroll + 240 * s, by + bh * 0.55);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  for (let yy = 0; yy < bh; yy += 3 * s) ctx.fillRect(bx, by + yy, bw, s);
  ctx.restore();
  const op = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.3;
  ctx.drawImage(glowSprite('#c060ff'), bx - bw * 0.4, by - bh * 0.4, bw * 1.8, bh * 1.8);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = op;
}

let flashT = -10;
function drawBack(ctx: CanvasRenderingContext2D, w: number, h: number, camX: number, zoom: number, horizonY: number, t: number, hype: number, low: boolean): void {
  prepare();
  const { x, y, s, dw, dh } = backdropRect(w, camX, zoom, horizonY);
  ctx.fillStyle = '#05030f';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(backdrop!, x, y, dw, dh);
  billboard(ctx, x, y, s, t);
  cars(ctx, x, y, s, t);
  // luzes vermelhas das antenas a piscar
  const op = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  const red = glowSprite('#ff3040');
  for (const a of antennas) {
    const on = Math.sin(t * 2.2 + a.p) > 0.3;
    if (!on) continue;
    ctx.globalAlpha = 0.9;
    ctx.drawImage(red, x + a.x * s - 8 * s, y + a.y * s - 8 * s, 16 * s, 16 * s);
  }
  // letreiro que tremeluz
  const fl = hash(Math.floor(t * 12)) > 0.15 || Math.sin(t * 0.5) > -0.6;
  if (fl) {
    ctx.globalAlpha = 0.35;
    ctx.drawImage(glowSprite(CYAN), x + 640 * s, y + 280 * s, 120 * s, 220 * s);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = op;
  drawCrowd(ctx, crowd!, x, y, s, dw, t, hype);
  ctx.drawImage(roof!.c, x, y + roof!.y0 * s, dw, roof!.h * s);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.45 + 0.1 * Math.sin(t * 3);
  ctx.drawImage(glowSprite(CYAN), x, y + (PARAPET - 30) * s, dw, 60 * s);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = op;
  ringVignette(ctx, w, camX, zoom, horizonY, 1500, 820, '4,2,14', 0.55);
  drawCrowdLights(ctx, crowd!, x, y, s, t, low);
  // relâmpago de vez em quando
  const k = Math.floor(t / 7);
  if (hash(k * 3.1) > 0.45) {
    const lt = t - k * 7 - hash(k * 5.7) * 4;
    if (lt > 0 && lt < 0.5) flashT = t - lt;
  }
  const fa = t - flashT;
  if (fa >= 0 && fa < 0.5) {
    const a = (fa < 0.08 || (fa > 0.16 && fa < 0.24) ? 0.35 : 0.1) * (1 - fa * 1.6);
    if (a > 0) {
      ctx.fillStyle = `rgba(200,190,255,${a})`;
      ctx.fillRect(0, 0, w, horizonY);
    }
  }
  if (!low) {
    // holofote do helicóptero da polícia, vindo de cima
    ctx.globalCompositeOperation = 'lighter';
    const vcx = w / 2 - camX * zoom;
    const hx = vcx + Math.sin(t * 0.21) * w * 0.5;
    const tx = vcx + Math.sin(t * 0.33) * 260 * zoom;
    const ty = horizonY + 60 * zoom;
    const dx = tx - hx;
    const dy = ty + 60;
    shaft(ctx, shaftSprite('#dfe9ff'), hx, -60, Math.atan2(-dx, dy), Math.hypot(dx, dy) * 1.1, 300 * zoom, 0.16 + hype * 0.05);
    const blink = Math.sin(t * 8) > 0.6;
    ctx.globalAlpha = blink ? 0.9 : 0.25;
    ctx.drawImage(glowSprite('#ff3040'), hx - 40, -30, 30, 30);
    ctx.globalAlpha = blink ? 0.25 : 0.9;
    ctx.drawImage(glowSprite('#3070ff'), hx + 10, -30, 30, 30);
    ctx.globalAlpha = 0.5;
    ctx.drawImage(streakSprite(), hx - 120, -16, 240, 10);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = op;
  }
}

// ───────────────────────── ringue ─────────────────────────

function makeMat(): HTMLCanvasElement {
  const [c, g, W, H] = matShell();
  g.fillStyle = vgrad(g, BACK_Y, FRONT_Y, [[0, '#14101f'], [0.6, '#221c33'], [1, '#2c2540']]);
  g.fillRect(-FRONT_X, BACK_Y, W, H);
  // grelha de néon em perspetiva
  g.strokeStyle = 'rgba(58,240,255,0.22)';
  g.lineWidth = 1.4;
  g.beginPath();
  for (let i = -8; i <= 8; i++) {
    g.moveTo(i * (BACK_X / 8.5), BACK_Y);
    g.lineTo(i * (FRONT_X / 8.5), FRONT_Y);
  }
  for (let k = 1; k < 8; k++) {
    const u = (k / 8) ** 1.25;
    const y = BACK_Y + (FRONT_Y - BACK_Y) * u;
    g.moveTo(-matW(y), y);
    g.lineTo(matW(y), y);
  }
  g.stroke();
  // reflexos molhados das luzes da cidade (riscas verticais suaves)
  g.globalCompositeOperation = 'lighter';
  const refl: [number, string][] = [[-380, PINK], [-160, CYAN], [60, VIOLET], [250, PINK], [420, CYAN]];
  for (const [rx, col] of refl) {
    const rg = g.createLinearGradient(0, BACK_Y, 0, FRONT_Y);
    rg.addColorStop(0, col + '55');
    rg.addColorStop(1, col + '00');
    g.fillStyle = rg;
    g.fillRect(rx - 14, BACK_Y, 28, H);
  }
  g.globalCompositeOperation = 'source-over';
  // poças
  for (let i = 0; i < 14; i++) {
    const x = (hash(i * 13 + 5) - 0.5) * W * 0.85;
    const y = BACK_Y + 10 + hash(i * 17 + 3) * (H - 20);
    g.fillStyle = 'rgba(120,200,255,0.08)';
    g.beginPath();
    g.ellipse(x, y, 26 + hash(i) * 40, 3 + hash(i * 2) * 4, 0, 0, Math.PI * 2);
    g.fill();
  }
  // logótipo central: círculo de néon com raio e coroa
  onMat(g, -14, 0.25, () => {
    g.globalCompositeOperation = 'lighter';
    for (const [lw, a] of [[40, 0.12], [20, 0.25], [8, 0.9]] as const) {
      g.lineWidth = lw;
      g.strokeStyle = PINK;
      g.globalAlpha = a;
      g.beginPath();
      g.arc(0, 0, 180, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = CYAN;
      g.beginPath();
      g.arc(0, 0, 150, 0, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.lineWidth = 3;
    g.strokeStyle = '#ffffff';
    g.beginPath();
    g.arc(0, 0, 180, 0, Math.PI * 2);
    g.moveTo(150, 0);
    g.arc(0, 0, 150, 0, Math.PI * 2);
    g.stroke();
  });
  onMat(g, -16, 0.34, () => {
    g.globalCompositeOperation = 'lighter';
    g.lineJoin = 'round';
    const bolt = () => {
      g.beginPath();
      g.moveTo(20, -110);
      g.lineTo(-50, 10);
      g.lineTo(-4, 10);
      g.lineTo(-24, 110);
      g.lineTo(54, -20);
      g.lineTo(8, -20);
      g.closePath();
    };
    for (const [lw, a] of [[30, 0.15], [14, 0.35]] as const) {
      bolt();
      g.lineWidth = lw;
      g.globalAlpha = a;
      g.strokeStyle = AMBER;
      g.stroke();
    }
    g.globalAlpha = 0.85;
    bolt();
    g.fillStyle = '#ffd27a';
    g.fill();
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    bolt();
    g.lineWidth = 4;
    g.strokeStyle = '#fff6d8';
    g.stroke();
  });
  // linhas de néon junto às cordas (cor da equipa)
  for (const sx of [-1, 1]) {
    const col = sx < 0 ? '#ff3b6e' : '#3b8bff';
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = col;
    g.lineWidth = 10;
    g.globalAlpha = 0.25;
    g.beginPath();
    g.moveTo(sx * (BACK_X - 30), BACK_Y + 8);
    g.lineTo(sx * (FRONT_X - 42), FRONT_Y - 14);
    g.stroke();
    g.lineWidth = 3;
    g.globalAlpha = 0.9;
    g.stroke();
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }
  matFinish(g, {
    weave: ['rgba(160,140,220,0.08)', 'rgba(0,0,0,0.15)'],
    hot: '200,220,255',
    hotA: 0.32,
    shade: '0,0,10',
    edge: PINK,
    edgeHi: 'rgba(255,255,255,0.8)',
  });
  return c;
}

/** Holofote do helicóptero a passear no tapete e salpicos de chuva. */
function matFx(ctx: CanvasRenderingContext2D, t: number, hype: number, low: boolean): void {
  const op = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  const px = Math.sin(t * 0.33) * 260;
  ctx.globalAlpha = 0.28 + hype * 0.08;
  ctx.drawImage(glowSprite('#dfe9ff'), px - 200, -50, 400, 90);
  ctx.globalAlpha = 0.22;
  ctx.drawImage(glowSprite(PINK), -BACK_X - 60, BACK_Y - 30, 260, 80);
  ctx.drawImage(glowSprite(CYAN), BACK_X - 200, BACK_Y - 30, 260, 80);
  if (!low) {
    ctx.strokeStyle = '#bfe6ff';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 22; i++) {
      const k = Math.floor(t * 3 + i * 0.37);
      const ph = (((t * 3 + i * 0.37) % 1) + 1) % 1;
      const sx = (hash(k * 7 + i) - 0.5) * 2 * (BACK_X - 30);
      const sy = BACK_Y + 8 + hash(k * 3 + i * 5) * (FRONT_Y - BACK_Y - 16);
      ctx.globalAlpha = (1 - ph) * 0.6;
      ctx.beginPath();
      ctx.ellipse(sx, sy, 3 + ph * 12, 1 + ph * 3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = op;
}

let skirtC: HTMLCanvasElement | null = null;
function makeSkirt(): HTMLCanvasElement {
  const [c, g, L] = skirtShell();
  g.fillStyle = vgrad(g, 0, SKIRT_H, [[0, '#1c1830'], [0.5, '#0e0b1a'], [1, '#05040a']]);
  g.fillRect(L, 0, SKIRT_W, SKIRT_H);
  // painéis com chapa perfurada
  for (let x = L; x < -L; x += 104) {
    g.strokeStyle = 'rgba(160,140,255,0.16)';
    g.lineWidth = 1.5;
    g.strokeRect(x + 4, 26, 96, 68);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let yy = 32; yy < 90; yy += 6) for (let xx = x + 10; xx < x + 96; xx += 6) g.fillRect(xx, yy, 1.6, 1.6);
  }
  // letreiro em néon (o brilho pulsa por frame)
  g.fillStyle = 'rgba(0,0,0,0.6)';
  g.beginPath();
  g.roundRect(-250, 32, 500, 58, 12);
  g.fill();
  neonText(g, 'NEON ROOFTOP', 0, 62, 40, PINK);
  for (const side of [-1, 1]) {
    const mx = side * 380;
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.5;
    g.lineWidth = 10;
    g.strokeStyle = side < 0 ? '#ff3b6e' : '#3b8bff';
    g.beginPath();
    g.arc(mx, 60, 26, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.lineWidth = 3;
    g.strokeStyle = '#ffffff';
    g.stroke();
    neonText(g, side < 0 ? 'R' : 'B', mx, 62, 26, side < 0 ? '#ff3b6e' : '#3b8bff');
  }
  // canal de LED em cima e em baixo
  g.fillStyle = '#05040a';
  g.fillRect(L, 6, SKIRT_W, 14);
  g.fillRect(L, 98, SKIRT_W, 10);
  g.fillStyle = 'rgba(255,255,255,0.3)';
  g.fillRect(L, 0, SKIRT_W, 1.5);
  g.fillStyle = '#2a2440';
  g.fillRect(L, 0, SKIRT_W, 6);
  skirtEdges(g, 0.6);
  return c;
}

function skirtFx(ctx: CanvasRenderingContext2D, t: number, hype: number): void {
  const op = ctx.globalCompositeOperation;
  // barra de varrimento (scanner) cor-de-rosa / ciano
  const seg = 20;
  const n = Math.ceil(SKIRT_W / seg);
  const head = (t * (14 + hype * 20)) % (n * 2);
  for (let i = 0; i < n; i++) {
    const d = Math.min(Math.abs(i - head), Math.abs(i - (n * 2 - head)));
    const k = Math.max(0, 1 - d / 9);
    ctx.fillStyle = k > 0.05 ? (i % 2 ? PINK : CYAN) : '#2a1838';
    ctx.globalAlpha = 0.35 + k * 0.65;
    ctx.fillRect(-SKIRT_W / 2 + i * seg + 2, FRONT_Y + 10, seg - 4, 6);
    ctx.fillRect(-SKIRT_W / 2 + (n - i - 1) * seg + 2, FRONT_Y + 100, seg - 4, 4);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.18 + 0.12 * Math.sin(t * 4) * Math.sin(t * 1.3) + hype * 0.1;
  ctx.drawImage(glowSprite(PINK), -330, FRONT_Y + 20, 660, 84);
  ctx.globalAlpha = 0.25 + hype * 0.15;
  ctx.drawImage(glowSprite(CYAN), -FRONT_X, FRONT_Y - 14, FRONT_X * 2, 30);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = op;
}

let floorC: HTMLCanvasElement | null = null;
let groundG: CanvasGradient | null = null;
function makeFloor(): HTMLCanvasElement {
  const [c, g] = mk(1600, 300);
  g.scale(0.5, 0.5);
  g.translate(1600, 0);
  g.fillStyle = vgrad(g, 0, 600, [[0, '#1a1628'], [1, '#07050c']]);
  g.fillRect(-1600, 0, 3200, 600);
  // heliporto
  g.strokeStyle = 'rgba(255,214,90,0.7)';
  g.lineWidth = 14;
  g.beginPath();
  g.ellipse(0, 260, 560, 200, 0, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = 'rgba(255,214,90,0.7)';
  g.fillRect(-120, 150, 40, 200);
  g.fillRect(80, 150, 40, 200);
  g.fillRect(-80, 230, 160, 40);
  // poças a refletir néon
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i++) {
    const x = (hash(i * 3.1) - 0.5) * 2800;
    const y = 60 + hash(i * 5.3) * 420;
    g.globalAlpha = 0.35;
    g.drawImage(glowSprite(i % 2 ? PINK : CYAN), x - 160, y - 30, 320, 60);
  }
  g.globalAlpha = 0.3;
  g.drawImage(glowSprite('#7b5cff'), -900, -150, 1800, 330);
  return c;
}

function drawFloor(ctx: CanvasRenderingContext2D): void {
  floorC ??= makeFloor();
  groundG ??= (() => {
    const gr = ctx.createLinearGradient(0, BACK_Y + 10, 0, FRONT_Y + 160);
    gr.addColorStop(0, '#221c34');
    gr.addColorStop(1, '#0c0916');
    return gr;
  })();
  ctx.fillStyle = groundG;
  ctx.fillRect(-3000, BACK_Y + 10, 6000, FRONT_Y + 160 - BACK_Y);
  ctx.fillStyle = '#07050c';
  ctx.fillRect(-3000, FRONT_Y + 160, 6000, 600);
  ctx.drawImage(floorC, -1600, FRONT_Y + 110, 3200, 600);
}

let fgC: HTMLCanvasElement | null = null;
const FW = 3200;
const FH = 420;
/** Primeiro plano: grade do telhado, antenas e condutas em contraluz. */
function makeFg(): HTMLCanvasElement {
  const [c, g] = mk(FW / 2, FH / 2);
  g.scale(0.5, 0.5);
  const body = '#07040f';
  g.fillStyle = body;
  g.strokeStyle = body;
  // grade
  g.lineWidth = 10;
  g.beginPath();
  g.moveTo(0, 210);
  g.lineTo(FW, 210);
  g.moveTo(0, 300);
  g.lineTo(FW, 300);
  g.stroke();
  g.lineWidth = 7;
  g.beginPath();
  for (let x = 0; x < FW; x += 60) {
    g.moveTo(x, 210);
    g.lineTo(x, FH);
  }
  g.stroke();
  g.strokeStyle = 'rgba(58,240,255,0.55)';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, 205);
  g.lineTo(FW, 205);
  g.stroke();
  // condutas e antenas (nos lados)
  for (const x of [260, 520, FW - 300, FW - 560]) {
    g.fillStyle = body;
    g.beginPath();
    g.roundRect(x - 60, 120, 120, FH, 14);
    g.fill();
    g.strokeStyle = 'rgba(255,63,191,0.55)';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(x - 56, 130);
    g.lineTo(x - 56, FH);
    g.stroke();
  }
  return c;
}

function drawFg(ctx: CanvasRenderingContext2D, camX: number): void {
  fgC ??= makeFg();
  ctx.drawImage(fgC, -FW / 2 + camX * 0.25, FRONT_Y + 60, FW, FH);
}

// ───────────────────────── chuva ─────────────────────────

function overlay(ctx: CanvasRenderingContext2D, w: number, h: number, camX: number, zoom: number, t: number, _hype: number, low: boolean): void {
  const n = low ? 40 : 130;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#bcd8ff';
  const slant = 0.18;
  for (let i = 0; i < n; i++) {
    const sp = 900 + hash(i * 3.7) * 600;
    const near = hash(i * 9.9);
    const len = (14 + near * 26) * Math.max(0.6, zoom);
    const py = ((t * sp + hash(i * 1.3) * 4000) % (h + 100)) - 50;
    const px = ((hash(i * 5.1) * (w + 200) - py * slant - camX * zoom * (0.2 + near * 0.4)) % (w + 200) + w + 200) % (w + 200) - 100;
    ctx.globalAlpha = 0.12 + near * 0.28;
    ctx.lineWidth = 0.8 + near * 1.4;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - len * slant, py + len);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // a cidade tinge as margens do ecrã
  if (!low) {
    const op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.1;
    ctx.drawImage(glowSprite(PINK), -w * 0.3, h * 0.1, w * 0.5, h);
    ctx.drawImage(glowSprite(CYAN), w * 0.8, h * 0.1, w * 0.5, h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = op;
  }
}

export const NEON: ArenaTheme = {
  ropes: [PINK, '#e8ecff', CYAN],
  ropeDark: ['#8a1068', '#8a8fb8', '#108a9a'],
  ropeGlow: [PINK, VIOLET, CYAN],
  post: {
    stops: [[0, '#05040a'], [0.3, '#2a2638'], [0.45, '#8a86a0'], [0.6, '#24202f'], [1, '#05040a']],
    pads: ['#ff2e63', '#2e7bff'],
    padDark: ['#8a0a30', '#0a3a9a'],
    buckle: '#4a4560',
    cap: '#3af0ff',
    glow: ['#ff2e63', '#2e7bff'],
  },
  prepare,
  backdrop: drawBack,
  mat: makeMat,
  matFx,
  skirt: () => (skirtC ??= makeSkirt()),
  skirtFx,
  floor: drawFloor,
  foreground: drawFg,
  overlay,
  haze: '#5a2aa0',
  pool: '#e6eeff',
  tint: 'rgba(6,2,20,0.24)',
};
