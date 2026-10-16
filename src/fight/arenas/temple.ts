import { glowSprite } from '../../render/fighter';
import { hash } from '../fx';
import {
  BACK_X, BACK_Y, BH, BW, FRONT_X, FRONT_Y, SKIRT_H, SKIRT_W, backdropRect, inkText, inked, makeLayer, matFinish, matShell, matW, mk, onMat,
  ringVignette, skirtEdges, skirtShell, streakSprite, vgrad, type ArenaTheme, type Layer,
} from '../arenaKit';

/**
 * Sakura Temple — um templo na montanha numa noite de lua cheia: pagode vermelho, torii,
 * cerejeiras em flor, lanternas de papel e de pedra, pirilampos e pétalas a cair no ringue.
 */

const INK = '#120a1e';
const MOON_X = 980;
const MOON_Y = 360;
const WALL = 684;
const LANTERNS_STONE = [250, 760, 1060, 1540, 1840, 2350];
const PINKS = ['#ffd3e6', '#ffb3d2', '#ff8fbf', '#f774ab'];

// ───────────────────────── fundo ─────────────────────────

function sky(g: CanvasRenderingContext2D): void {
  g.fillStyle = vgrad(g, 0, WALL, [
    [0, '#05061a'],
    [0.4, '#111a4a'],
    [0.75, '#26357a'],
    [1, '#4a5aa0'],
  ]);
  g.fillRect(0, 0, BW, BH);
  for (let i = 0; i < 260; i++) {
    const y = hash(i * 3.3) * 520;
    g.globalAlpha = (0.3 + hash(i * 7.1) * 0.7) * (1 - y / 700);
    g.fillStyle = hash(i * 2.1) > 0.8 ? '#ffd6ec' : '#eef2ff';
    const r = hash(i * 9.3) > 0.92 ? 2.6 : 1.6;
    g.fillRect(hash(i * 5.7) * BW, y, r, r);
  }
  g.globalAlpha = 1;
  // lua cheia enorme com halo
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.45;
  g.drawImage(glowSprite('#9fb4ff'), MOON_X - 600, MOON_Y - 500, 1200, 1000);
  g.globalAlpha = 0.5;
  g.drawImage(glowSprite('#fff6dc'), MOON_X - 280, MOON_Y - 280, 560, 560);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  const mg = g.createRadialGradient(MOON_X - 40, MOON_Y - 50, 20, MOON_X, MOON_Y, 150);
  mg.addColorStop(0, '#fffdf2');
  mg.addColorStop(0.7, '#fff0c8');
  mg.addColorStop(1, '#f2d9a0');
  g.fillStyle = mg;
  g.beginPath();
  g.arc(MOON_X, MOON_Y, 150, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(214,180,120,0.35)';
  for (const [cx, cy, r] of [[-50, -30, 28], [40, 30, 22], [10, -70, 14], [-30, 60, 18], [70, -20, 12]]) {
    g.beginPath();
    g.arc(MOON_X + cx, MOON_Y + cy, r, 0, Math.PI * 2);
    g.fill();
  }
  // nuvens em espiral (estilo japonês) a cruzar a lua
  const cloud = (cx: number, cy: number, w: number) => {
    g.fillStyle = 'rgba(30,40,100,0.85)';
    g.beginPath();
    g.roundRect(cx - w / 2, cy - 9, w, 18, 9);
    g.fill();
    g.strokeStyle = 'rgba(180,200,255,0.55)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(cx - w / 2 + 10, cy - 8);
    g.lineTo(cx + w / 2 - 10, cy - 8);
    g.stroke();
    for (const ex of [cx - w / 2, cx + w / 2]) {
      g.beginPath();
      g.arc(ex, cy, 9, 0, Math.PI * 2);
      g.fillStyle = 'rgba(30,40,100,0.85)';
      g.fill();
      g.beginPath();
      g.arc(ex, cy, 5, 0, Math.PI * 1.5);
      g.stroke();
    }
  };
  cloud(MOON_X - 40, MOON_Y + 50, 260);
  cloud(MOON_X + 120, MOON_Y - 40, 180);
  cloud(1700, 250, 300);
  cloud(400, 300, 240);
  cloud(2200, 420, 220);
}

function mountains(g: CanvasRenderingContext2D): void {
  // monte com neve, ao longe
  g.beginPath();
  g.moveTo(1150, 640);
  g.lineTo(1640, 330);
  g.quadraticCurveTo(1700, 300, 1760, 330);
  g.lineTo(2300, 640);
  g.closePath();
  g.fillStyle = vgrad(g, 300, 640, [[0, '#4a5aa8'], [1, '#2a3270']]);
  g.fill();
  g.beginPath();
  g.moveTo(1560, 382);
  g.lineTo(1640, 330);
  g.quadraticCurveTo(1700, 300, 1760, 330);
  g.lineTo(1840, 382);
  for (let k = 0; k <= 6; k++) g.lineTo(1840 - k * 46.6, 382 + (k % 2 ? 18 : 4));
  g.closePath();
  g.fillStyle = '#e8eeff';
  g.fill();
  g.fillStyle = 'rgba(150,170,255,0.5)';
  g.beginPath();
  g.moveTo(1700, 312);
  g.lineTo(1760, 330);
  g.lineTo(1840, 382);
  g.lineTo(1760, 392);
  g.closePath();
  g.fill();
  // colinas mais perto
  g.fillStyle = '#1c2458';
  g.beginPath();
  g.moveTo(0, 660);
  for (let x = 0; x <= BW; x += 50) g.lineTo(x, 560 + Math.sin(x * 0.003 + 1) * 40 + Math.sin(x * 0.011) * 14);
  g.lineTo(BW, 700);
  g.lineTo(0, 700);
  g.closePath();
  g.fill();
  // neblina ao luar
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.3;
  g.drawImage(glowSprite('#6a7ad0'), -200, 520, BW + 400, 200);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}

/** Telhado curvo de templo (beiral levantado nas pontas). */
function roof(g: CanvasRenderingContext2D, cx: number, y: number, hw: number, h: number): void {
  g.beginPath();
  g.moveTo(cx - hw - 16, y - 10);
  g.quadraticCurveTo(cx - hw * 0.7, y, cx - hw * 0.55, y - h * 0.65);
  g.lineTo(cx + hw * 0.55, y - h * 0.65);
  g.quadraticCurveTo(cx + hw * 0.7, y, cx + hw + 16, y - 10);
  g.lineTo(cx + hw * 0.9, y + 8);
  g.lineTo(cx - hw * 0.9, y + 8);
  g.closePath();
  inked(g, vgrad(g, y - h, y + 8, [[0, '#3a3a5e'], [1, '#1a1a30']]), 3, INK);
  g.strokeStyle = 'rgba(160,180,255,0.3)';
  g.lineWidth = 1.5;
  g.beginPath();
  for (let k = -6; k <= 6; k++) {
    g.moveTo(cx + k * hw * 0.09, y - h * 0.6);
    g.lineTo(cx + k * hw * 0.14, y + 4);
  }
  g.stroke();
  g.fillStyle = '#d8b040';
  g.fillRect(cx - hw * 0.9, y + 4, hw * 1.8, 3);
}

function pagoda(g: CanvasRenderingContext2D, x: number, base: number): void {
  const tiers = 5;
  let y = base;
  let hw = 120;
  for (let i = 0; i < tiers; i++) {
    const bh = 62 - i * 4;
    g.beginPath();
    g.rect(x - hw * 0.62, y - bh, hw * 1.24, bh);
    inked(g, vgrad(g, y - bh, y, [[0, '#d8202a'], [1, '#8a0e16']]), 3, INK);
    // janelas acesas
    for (let k = -1; k <= 1; k++) {
      g.fillStyle = '#ffd890';
      g.fillRect(x + k * hw * 0.36 - 8, y - bh + 14, 16, bh - 26);
      g.fillStyle = 'rgba(120,40,20,0.6)';
      g.fillRect(x + k * hw * 0.36 - 1, y - bh + 14, 2, bh - 26);
    }
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.35;
    g.drawImage(glowSprite('#ffb060'), x - hw, y - bh - 20, hw * 2, bh + 40);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    y -= bh;
    roof(g, x, y, hw, 36);
    y -= 22;
    hw *= 0.82;
  }
  // ponta (sorin)
  g.fillStyle = '#d8b040';
  g.fillRect(x - 3, y - 90, 6, 90);
  for (let k = 0; k < 6; k++) {
    g.beginPath();
    g.ellipse(x, y - 14 - k * 12, 10, 3, 0, 0, Math.PI * 2);
    g.fill();
  }
}

function torii(g: CanvasRenderingContext2D, x: number, top: number, base: number, hw: number): void {
  const red = vgrad(g, top, base, [[0, '#ff4a3a'], [1, '#a8101a']]);
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.moveTo(x + sx * hw * 0.62 - 14, base);
    g.lineTo(x + sx * hw * 0.58 - 11, top + 40);
    g.lineTo(x + sx * hw * 0.58 + 11, top + 40);
    g.lineTo(x + sx * hw * 0.62 + 14, base);
    g.closePath();
    inked(g, red, 3.5, INK);
    g.beginPath();
    g.rect(x + sx * hw * 0.62 - 18, base - 22, 36, 22);
    inked(g, '#1a1220', 3, INK);
  }
  // kasagi (trave de cima, curva) e nuki
  g.beginPath();
  g.moveTo(x - hw - 30, top - 6);
  g.quadraticCurveTo(x, top + 18, x + hw + 30, top - 6);
  g.lineTo(x + hw + 18, top + 18);
  g.quadraticCurveTo(x, top + 36, x - hw - 18, top + 18);
  g.closePath();
  inked(g, '#1a1220', 3.5, INK);
  g.beginPath();
  g.moveTo(x - hw - 14, top + 18);
  g.quadraticCurveTo(x, top + 36, x + hw + 14, top + 18);
  g.lineTo(x + hw + 10, top + 34);
  g.quadraticCurveTo(x, top + 50, x - hw - 10, top + 34);
  g.closePath();
  inked(g, red, 3, INK);
  g.beginPath();
  g.rect(x - hw * 0.8, top + 78, hw * 1.6, 20);
  inked(g, red, 3, INK);
  g.beginPath();
  g.rect(x - 14, top + 44, 28, 34);
  inked(g, '#1a1220', 2.5, INK);
  g.fillStyle = '#d8b040';
  g.fillRect(x - 8, top + 52, 16, 18);
}

/** Salão do templo atrás do ringue, com janelas de papel iluminadas. */
function hall(g: CanvasRenderingContext2D, x0: number, x1: number): void {
  const top = 590;
  g.beginPath();
  g.rect(x0, top, x1 - x0, WALL - top + 10);
  inked(g, vgrad(g, top, WALL, [[0, '#5a2a2a'], [1, '#2a1018']]), 3, INK);
  for (let x = x0 + 20; x < x1 - 50; x += 78) {
    g.fillStyle = vgrad(g, top + 14, WALL - 8, [[0, '#fff0c8'], [1, '#ffb868']]);
    g.fillRect(x, top + 16, 58, WALL - top - 26);
    g.strokeStyle = 'rgba(90,40,20,0.55)';
    g.lineWidth = 1.5;
    g.beginPath();
    for (let k = 1; k < 3; k++) {
      g.moveTo(x + (58 * k) / 3, top + 16);
      g.lineTo(x + (58 * k) / 3, WALL - 10);
    }
    for (let yy = top + 30; yy < WALL - 10; yy += 16) {
      g.moveTo(x, yy);
      g.lineTo(x + 58, yy);
    }
    g.stroke();
    g.fillStyle = '#5a2a2a';
    g.fillRect(x - 10, top + 10, 8, WALL - top);
  }
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.4;
  g.drawImage(glowSprite('#ffb060'), x0 - 100, top - 80, x1 - x0 + 200, 220);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  const cx = (x0 + x1) / 2;
  const hw = (x1 - x0) / 2;
  g.beginPath();
  g.moveTo(x0 - 60, top + 4);
  g.quadraticCurveTo(x0 + 40, top - 4, x0 + 80, top - 70);
  g.lineTo(x1 - 80, top - 70);
  g.quadraticCurveTo(x1 - 40, top - 4, x1 + 60, top + 4);
  g.lineTo(x1 + 30, top + 18);
  g.lineTo(x0 - 30, top + 18);
  g.closePath();
  inked(g, vgrad(g, top - 70, top + 18, [[0, '#3a3a5e'], [1, '#16162a']]), 3, INK);
  g.strokeStyle = 'rgba(160,180,255,0.28)';
  g.lineWidth = 1.5;
  g.beginPath();
  for (let k = -20; k <= 20; k++) {
    g.moveTo(cx + k * hw * 0.042, top - 66);
    g.lineTo(cx + k * hw * 0.05, top + 14);
  }
  g.stroke();
  g.fillStyle = '#d8b040';
  g.fillRect(x0 - 30, top + 14, x1 - x0 + 60, 3);
  // telhado de cima, mais pequeno
  roof(g, cx, top - 70, hw * 0.45, 50);
}

/** Copa de cerejeira: muitos círculos cor-de-rosa com sombra cel e contorno exterior. */
function sakura(g: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number, lean: number): void {
  // tronco e ramos
  g.lineCap = 'round';
  g.strokeStyle = INK;
  g.lineWidth = 26;
  g.beginPath();
  g.moveTo(x - lean * 30, WALL + 20);
  g.quadraticCurveTo(x - lean * 10, y + r * 0.8, x, y + r * 0.2);
  g.stroke();
  g.strokeStyle = '#3a2030';
  g.lineWidth = 18;
  g.stroke();
  g.lineWidth = 9;
  g.beginPath();
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k - 2) * 0.55 + lean * 0.2;
    g.moveTo(x, y + r * 0.25);
    g.quadraticCurveTo(x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.2, x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.55);
  }
  g.stroke();
  const blobs: [number, number, number][] = [];
  for (let i = 0; i < 46; i++) {
    const a = hash(seed + i * 3.1) * Math.PI * 2;
    const d = Math.sqrt(hash(seed + i * 7.7)) * r;
    blobs.push([x + Math.cos(a) * d * 1.25, y + Math.sin(a) * d * 0.7, r * (0.22 + hash(seed + i * 1.9) * 0.18)]);
  }
  // contorno exterior
  g.fillStyle = INK;
  for (const [bx, by, br] of blobs) {
    g.beginPath();
    g.arc(bx, by, br + 3, 0, Math.PI * 2);
    g.fill();
  }
  // camadas de cor (sombra em baixo, luz da lua em cima)
  const layers: [string, number][] = [['#c2457e', 0], ['#ef7aaf', -0.12], ['#ffb0d0', -0.3], ['#ffe2ef', -0.48]];
  layers.forEach(([col, dy], li) => {
    g.fillStyle = col;
    for (const [bx, by, br] of blobs) {
      const k = 1 - li * 0.2;
      if (li > 1 && hash(bx * 0.13 + li) > 0.6) continue;
      g.beginPath();
      g.arc(bx - br * 0.12 * li, by + br * dy, br * k, 0, Math.PI * 2);
      g.fill();
    }
  });
  // florzinhas soltas
  for (let i = 0; i < 40; i++) {
    const a = hash(seed * 3 + i) * Math.PI * 2;
    const d = hash(seed * 5 + i) * r * 1.1;
    g.fillStyle = PINKS[i % 4];
    g.beginPath();
    g.arc(x + Math.cos(a) * d * 1.25, y + Math.sin(a) * d * 0.7, 3, 0, Math.PI * 2);
    g.fill();
  }
}

/** Lanterna de pedra (tōrō); a luz acende por frame. */
function stoneLantern(g: CanvasRenderingContext2D, x: number, base: number, k: number): void {
  g.save();
  g.translate(x, base);
  g.scale(k, k);
  const st = vgrad(g, -120, 0, [[0, '#9aa0c0'], [1, '#4a4e70']]);
  g.beginPath();
  g.rect(-26, -14, 52, 14);
  inked(g, st, 2.5, INK);
  g.beginPath();
  g.rect(-9, -64, 18, 50);
  inked(g, st, 2.5, INK);
  g.beginPath();
  g.rect(-24, -74, 48, 10);
  inked(g, st, 2.5, INK);
  g.beginPath();
  g.rect(-18, -104, 36, 30);
  inked(g, '#3a3e5a', 2.5, INK);
  g.fillStyle = '#ffd890';
  g.fillRect(-10, -98, 20, 18);
  g.beginPath();
  g.moveTo(-34, -104);
  g.quadraticCurveTo(0, -118, 34, -104);
  g.lineTo(0, -132);
  g.closePath();
  inked(g, st, 2.5, INK);
  g.beginPath();
  g.arc(0, -136, 6, 0, Math.PI * 2);
  inked(g, st, 2, INK);
  g.restore();
}

let backdrop: HTMLCanvasElement | null = null;
let fence: Layer | null = null;

function makeBackdrop(): HTMLCanvasElement {
  const [c, g] = mk(BW, BH);
  sky(g);
  mountains(g);
  pagoda(g, 2080, 690);
  hall(g, 760, 1820);
  torii(g, 470, 380, 700, 190);
  sakura(g, 180, 420, 210, 3, 1);
  sakura(g, 2440, 400, 220, 11, -1);
  sakura(g, 1960, 560, 120, 17, -1);
  sakura(g, 640, 560, 130, 23, 1);
  return c;
}

/** Muro baixo de pedra com cerca de madeira vermelha (à frente do fundo). */
function makeFence(): Layer {
  return makeLayer(520, BH, 0.6, '', (g) => {
    g.beginPath();
    g.rect(-10, WALL, BW + 20, 90);
    inked(g, vgrad(g, WALL, BH, [[0, '#6a6e90'], [0.2, '#44486a'], [1, '#1a1c30']]), 3, INK);
    g.strokeStyle = 'rgba(10,10,30,0.4)';
    g.lineWidth = 2;
    g.beginPath();
    for (let row = 0; row < 3; row++) {
      const yy = WALL + 6 + row * 24;
      for (let x = (row % 2) * 40; x < BW; x += 80) {
        g.moveTo(x, yy);
        g.lineTo(x, yy + 24);
      }
      g.moveTo(0, yy + 24);
      g.lineTo(BW, yy + 24);
    }
    g.stroke();
    g.fillStyle = 'rgba(200,210,255,0.35)';
    g.fillRect(0, WALL + 1, BW, 3);
    // cerca vermelha (tamagaki)
    for (let x = 20; x < BW; x += 60) {
      g.beginPath();
      g.rect(x - 5, WALL - 46, 10, 48);
      inked(g, '#c8202a', 2, INK);
      g.fillStyle = '#1a1220';
      g.fillRect(x - 6, WALL - 50, 12, 6);
    }
    g.beginPath();
    g.rect(0, WALL - 36, BW, 7);
    inked(g, '#a8101a', 2, INK);
    for (const lx of LANTERNS_STONE) stoneLantern(g, lx, WALL + 4, 0.95);
    // corda sagrada (shimenawa) com papéis em zigue-zague
    g.strokeStyle = '#e8d8a0';
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(0, WALL - 20);
    g.lineTo(BW, WALL - 20);
    g.stroke();
    g.strokeStyle = 'rgba(120,90,40,0.6)';
    g.lineWidth = 1.5;
    g.beginPath();
    for (let x = 0; x < BW; x += 10) {
      g.moveTo(x, WALL - 24);
      g.lineTo(x + 6, WALL - 16);
    }
    g.stroke();
    g.fillStyle = '#ffffff';
    for (let x = 30; x < BW; x += 140) {
      g.beginPath();
      g.moveTo(x, WALL - 17);
      g.lineTo(x + 8, WALL - 17);
      g.lineTo(x + 4, WALL - 8);
      g.lineTo(x + 12, WALL - 8);
      g.lineTo(x + 6, WALL + 4);
      g.lineTo(x - 2, WALL + 4);
      g.lineTo(x + 2, WALL - 6);
      g.lineTo(x - 4, WALL - 6);
      g.closePath();
      g.fill();
    }
  });
}

function prepare(): void {
  if (backdrop) return;
  backdrop = makeBackdrop();
  fence = makeFence();
}

/** Lanternas de papel penduradas num fio entre o torii e o pagode (balançam ao vento). */
function paperLanterns(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, low: boolean): void {
  const x0 = 600;
  const x1 = 1980;
  const n = 14;
  const sag = 70;
  const yA = 470;
  const yB = 500;
  ctx.strokeStyle = '#120a1e';
  ctx.lineWidth = Math.max(1, 2 * s);
  ctx.beginPath();
  ctx.moveTo(x + x0 * s, y + yA * s);
  ctx.quadraticCurveTo(x + ((x0 + x1) / 2) * s, y + (yA + sag * 2) * s, x + x1 * s, y + yB * s);
  ctx.stroke();
  const op = ctx.globalCompositeOperation;
  for (let i = 1; i < n; i++) {
    const u = i / n;
    const lx = x0 + (x1 - x0) * u;
    const ly = (1 - u) * (1 - u) * yA + 2 * u * (1 - u) * (yA + sag * 2) + u * u * yB;
    const sw = Math.sin(t * 1.6 + i * 0.7) * 0.12;
    const px = x + lx * s;
    const py = y + ly * s;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(sw);
    const w = 15 * s;
    const h = 22 * s;
    ctx.fillStyle = '#120a1e';
    ctx.fillRect(-1 * s, 0, 2 * s, 6 * s);
    ctx.beginPath();
    ctx.ellipse(0, 6 * s + h / 2, w + 1.5 * s, h / 2 + 1.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    const red = i % 3 === 1 ? '#fff0c8' : '#e8322a';
    ctx.fillStyle = red;
    ctx.beginPath();
    ctx.ellipse(0, 6 * s + h / 2, w, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,230,160,0.55)';
    ctx.beginPath();
    ctx.ellipse(-w * 0.25, 6 * s + h / 2, w * 0.4, h * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#120a1e';
    ctx.fillRect(-w * 0.6, 5 * s, w * 1.2, 2.5 * s);
    ctx.fillRect(-w * 0.6, 4.5 * s + h, w * 1.2, 2.5 * s);
    ctx.restore();
    if (!low) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.4 + 0.1 * Math.sin(t * 9 + i * 2.3);
      ctx.drawImage(glowSprite('#ff8a4a'), px - 40 * s, py - 24 * s, 80 * s, 80 * s);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = op;
    }
  }
}

function fireflies(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, n: number): void {
  const op = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  const gs = glowSprite('#d8ff8a');
  for (let i = 0; i < n; i++) {
    const bx = hash(i * 3.7) * BW + Math.sin(t * (0.3 + hash(i) * 0.4) + i) * 60;
    const by = 520 + hash(i * 5.1) * 180 + Math.sin(t * (0.5 + hash(i * 2) * 0.5) + i * 2) * 30;
    const a = Math.max(0, Math.sin(t * (1.2 + hash(i * 9) * 1.5) + i * 4));
    if (a < 0.05) continue;
    ctx.globalAlpha = a * 0.9;
    const r = 10 * s;
    ctx.drawImage(gs, x + bx * s - r, y + by * s - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = op;
}

function drawBack(ctx: CanvasRenderingContext2D, w: number, h: number, camX: number, zoom: number, horizonY: number, t: number, hype: number, low: boolean): void {
  prepare();
  const { x, y, s, dw, dh } = backdropRect(w, camX, zoom, horizonY);
  ctx.fillStyle = '#05061a';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(backdrop!, x, y, dw, dh);
  const op = ctx.globalCompositeOperation;
  // estrela cadente de vez em quando
  const k = Math.floor(t / 6);
  const st = t - k * 6;
  if (!low && hash(k * 1.7) > 0.4 && st < 0.8) {
    const sx = x + (300 + hash(k * 3.3) * 2000) * s + st * 500 * s;
    const sy = y + (80 + hash(k * 5.9) * 200) * s + st * 180 * s;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 1 - st / 0.8;
    ctx.strokeStyle = '#eef2ff';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx - 120 * s, sy - 43 * s);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = op;
  }
  // neblina a deslizar no vale
  if (!low) {
    ctx.globalCompositeOperation = 'lighter';
    const mist = glowSprite('#8090e0');
    for (let i = 0; i < 3; i++) {
      const mx = ((t * (10 + i * 6) + i * 900) % (BW + 1200)) - 600;
      ctx.globalAlpha = 0.12;
      ctx.drawImage(mist, x + (mx - 500) * s, y + (560 + i * 30) * s, 1000 * s, 140 * s);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = op;
  }
  paperLanterns(ctx, x, y, s, t, low);
  fireflies(ctx, x, y, s, t, low ? 10 : 28);
  ctx.drawImage(fence!.c, x, y + fence!.y0 * s, dw, fence!.h * s);
  // lanternas de pedra acesas (tremeluzem)
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < LANTERNS_STONE.length; i++) {
    const lx = x + LANTERNS_STONE[i] * s;
    if (lx < -100 || lx > w + 100) continue;
    const ly = y + (WALL + 4 - 85) * s;
    ctx.globalAlpha = 0.55 + 0.15 * Math.sin(t * 8 + i * 1.9) * Math.sin(t * 3.1 + i);
    ctx.drawImage(glowSprite('#ffb060'), lx - 60 * s, ly - 50 * s, 120 * s, 100 * s);
  }
  // luar sobre o ringue
  ctx.globalAlpha = 0.16 + 0.03 * Math.sin(t * 0.6);
  const mx = x + MOON_X * s;
  const my = y + MOON_Y * s;
  ctx.drawImage(glowSprite('#cfd8ff'), mx - 500 * s, my - 400 * s, 1000 * s, 800 * s);
  if (!low) {
    ctx.globalAlpha = 0.2;
    ctx.drawImage(streakSprite(), mx - 600 * s, my - 6 * s, 1200 * s, 12 * s);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = op;
  ringVignette(ctx, w, camX, zoom, horizonY, 1500, 820, '2,3,16', 0.55);
  void hype;
}

// ───────────────────────── ringue ─────────────────────────

/** Flor de cerejeira de 5 pétalas (brasão). */
function blossom(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, line: string, lw: number): void {
  g.beginPath();
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k * Math.PI * 2) / 5;
    const px = x + Math.cos(a) * r * 0.55;
    const py = y + Math.sin(a) * r * 0.55;
    g.moveTo(x, y);
    g.quadraticCurveTo(px + Math.cos(a - 0.9) * r * 0.6, py + Math.sin(a - 0.9) * r * 0.6, x + Math.cos(a - 0.12) * r, y + Math.sin(a - 0.12) * r);
    g.lineTo(x + Math.cos(a) * r * 0.86, y + Math.sin(a) * r * 0.86);
    g.lineTo(x + Math.cos(a + 0.12) * r, y + Math.sin(a + 0.12) * r);
    g.quadraticCurveTo(px + Math.cos(a + 0.9) * r * 0.6, py + Math.sin(a + 0.9) * r * 0.6, x, y);
  }
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = lw;
  g.strokeStyle = line;
  g.stroke();
}

function makeMat(): HTMLCanvasElement {
  const [c, g, W, H] = matShell();
  g.fillStyle = vgrad(g, BACK_Y, FRONT_Y, [[0, '#a8a070'], [0.55, '#d8d09a'], [1, '#ece4b8']]);
  g.fillRect(-FRONT_X, BACK_Y, W, H);
  // palha entrançada do tatami
  for (let i = 0; i < 2600; i++) {
    const y = BACK_Y + hash(i * 7 + 2) * H;
    const x = (hash(i * 3 + 1) - 0.5) * matW(y) * 2;
    g.fillStyle = hash(i * 11) > 0.5 ? 'rgba(255,255,220,0.25)' : 'rgba(110,100,50,0.12)';
    g.fillRect(x, y, 0.8, 3);
  }
  // bordas de pano dos tatamis (verde escuro com friso dourado)
  const seam = (x0: number, y0: number, x1: number, y1: number) => {
    g.strokeStyle = 'rgba(30,50,40,0.75)';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
    g.strokeStyle = 'rgba(216,176,64,0.7)';
    g.lineWidth = 1;
    g.stroke();
  };
  const ym = (BACK_Y + FRONT_Y) / 2;
  seam(-matW(ym), ym, matW(ym), ym);
  for (const u of [-0.66, -0.33, 0.33, 0.66]) {
    seam(u * BACK_X, BACK_Y, u * matW(ym), ym);
    seam((u + (u > 0 ? -0.16 : 0.16)) * matW(ym), ym, (u + (u > 0 ? -0.16 : 0.16)) * FRONT_X, FRONT_Y);
  }
  for (const sx of [-1, 1]) seam(sx * (BACK_X - 28), BACK_Y + 6, sx * (FRONT_X - 40), FRONT_Y - 12);
  seam(-(BACK_X - 28), BACK_Y + 6, BACK_X - 28, BACK_Y + 6);
  seam(-(FRONT_X - 40), FRONT_Y - 12, FRONT_X - 40, FRONT_Y - 12);
  // pétalas caídas no tapete
  for (let i = 0; i < 70; i++) {
    const y = BACK_Y + 4 + hash(i * 17 + 3) * (H - 8);
    const x = (hash(i * 13 + 5) - 0.5) * matW(y) * 1.9;
    g.fillStyle = PINKS[i % 4];
    g.beginPath();
    g.ellipse(x, y, 3 + hash(i) * 2, 1.4, hash(i * 3) * 3, 0, Math.PI * 2);
    g.fill();
  }
  // grande círculo vermelho com a flor de cerejeira dourada
  onMat(g, -14, 0.25, () => {
    g.fillStyle = 'rgba(200,24,36,0.78)';
    g.beginPath();
    g.arc(0, 0, 170, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = 'rgba(216,176,64,0.9)';
    g.beginPath();
    g.arc(0, 0, 182, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 3;
    g.beginPath();
    g.arc(0, 0, 192, 0, Math.PI * 2);
    g.stroke();
    // ondas (seigaiha) em anel
    g.strokeStyle = 'rgba(255,230,200,0.35)';
    g.lineWidth = 3;
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      g.beginPath();
      g.arc(Math.cos(a) * 150, Math.sin(a) * 150, 14, a + Math.PI * 0.5, a + Math.PI * 1.5);
      g.stroke();
    }
  });
  onMat(g, -15, 0.32, () => {
    blossom(g, 0, 0, 104, 'rgba(255,240,245,0.92)', 'rgba(216,176,64,0.95)', 7);
    g.fillStyle = 'rgba(216,176,64,0.95)';
    g.beginPath();
    g.arc(0, 0, 18, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(200,40,80,0.6)';
    g.lineWidth = 3;
    g.beginPath();
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k * Math.PI * 2) / 5;
      g.moveTo(Math.cos(a) * 20, Math.sin(a) * 20);
      g.lineTo(Math.cos(a) * 52, Math.sin(a) * 52);
    }
    g.stroke();
  });
  // brasões dos cantos (cor da equipa)
  for (const [sx, sy] of [[-1, BACK_Y + 24], [1, BACK_Y + 24], [-1, FRONT_Y - 32], [1, FRONT_Y - 32]] as const) {
    onMat(g, sy, 0.3, () => blossom(g, sx * (matW(sy) - 86), 0, 30, sx < 0 ? 'rgba(200,30,40,0.55)' : 'rgba(40,80,200,0.55)', 'rgba(216,176,64,0.8)', 3));
  }
  matFinish(g, {
    weave: ['rgba(255,255,230,0.12)', 'rgba(90,80,40,0.05)'],
    hot: '240,240,255',
    hotA: 0.38,
    shade: '20,20,50',
    edge: 'rgba(30,50,40,0.95)',
    edgeHi: 'rgba(216,176,64,0.9)',
  });
  return c;
}

/** Luz fria do luar e luz quente das lanternas no tapete. */
function matFx(ctx: CanvasRenderingContext2D, t: number, _hype: number, low: boolean): void {
  const op = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.14;
  ctx.drawImage(glowSprite('#9fb4ff'), -700, BACK_Y - 40, 900, 160);
  if (!low) {
    for (const sx of [-1, 1]) {
      ctx.globalAlpha = 0.18 + 0.05 * Math.sin(t * 7 + sx * 2) * Math.sin(t * 2.9 + sx);
      ctx.drawImage(glowSprite('#ff9a50'), sx * FRONT_X - 160, FRONT_Y - 70, 320, 100);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = op;
}

let skirtC: HTMLCanvasElement | null = null;
function makeSkirt(): HTMLCanvasElement {
  const [c, g, L] = skirtShell();
  // tábuas de madeira escura lacada
  g.fillStyle = vgrad(g, 0, SKIRT_H, [[0, '#3a1a1e'], [0.5, '#24101a'], [1, '#100810']]);
  g.fillRect(L, 0, SKIRT_W, SKIRT_H);
  for (let x = L; x < -L; x += 36) {
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(x, 20, 2, 80);
    g.fillStyle = 'rgba(255,200,180,0.06)';
    g.fillRect(x + 3, 20, 6, 80);
  }
  // faixa vermelha com ondas douradas
  g.fillStyle = '#a8101a';
  g.fillRect(L, 6, SKIRT_W, 14);
  g.strokeStyle = 'rgba(216,176,64,0.8)';
  g.lineWidth = 1.5;
  for (let x = L; x < -L; x += 16) {
    g.beginPath();
    g.arc(x + 8, 20, 7, Math.PI, 0);
    g.stroke();
  }
  // estandarte de papel ao centro
  g.beginPath();
  g.roundRect(-256, 28, 512, 66, 4);
  inked(g, vgrad(g, 28, 94, [[0, '#fffaf0'], [1, '#e8dcc8']]), 4);
  g.fillStyle = '#c8202a';
  g.beginPath();
  g.arc(-210, 61, 20, 0, Math.PI * 2);
  g.arc(210, 61, 20, 0, Math.PI * 2);
  g.fill();
  blossom(g, -210, 61, 14, '#ffe2ef', '#d8b040', 1.5);
  blossom(g, 210, 61, 14, '#ffe2ef', '#d8b040', 1.5);
  inkText(g, 'SAKURA TEMPLE', 0, 63, 38, '#1a1220', 2, '#1a1220');
  // brasões dourados (vermelho à esquerda, azul à direita)
  for (const side of [-1, 1]) {
    const mx = side * 384;
    g.beginPath();
    g.arc(mx, 60, 30, 0, Math.PI * 2);
    inked(g, vgrad(g, 30, 90, [[0, '#fff2b0'], [0.6, '#e8b040'], [1, '#8a5a10']]), 4);
    g.beginPath();
    g.arc(mx, 60, 23, 0, Math.PI * 2);
    inked(g, side < 0 ? '#a8101a' : '#1f3f9a', 2.5);
    blossom(g, mx, 60, 17, '#ffe2ef', '#d8b040', 1.5);
  }
  // borlas penduradas
  for (const tx of [-300, 300]) {
    g.strokeStyle = '#d8b040';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(tx, 20);
    g.lineTo(tx, 46);
    g.stroke();
    g.fillStyle = '#c8202a';
    g.beginPath();
    g.moveTo(tx - 6, 46);
    g.lineTo(tx + 6, 46);
    g.lineTo(tx + 9, 80);
    g.lineTo(tx - 9, 80);
    g.closePath();
    g.fill();
  }
  g.fillStyle = '#1a0c10';
  g.fillRect(L, 100, SKIRT_W, 12);
  g.fillStyle = '#d8b040';
  g.fillRect(L, 100, SKIRT_W, 2);
  g.fillStyle = 'rgba(255,220,200,0.35)';
  g.fillRect(L, 0, SKIRT_W, 2);
  skirtEdges(g);
  return c;
}

function skirtFx(ctx: CanvasRenderingContext2D, t: number): void {
  const op = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  for (const sx of [-1, 1]) {
    ctx.globalAlpha = 0.22 + 0.06 * Math.sin(t * 8 + sx * 3);
    ctx.drawImage(glowSprite('#ff9a50'), sx * (FRONT_X - 30) - 150, FRONT_Y - 10, 300, 130);
  }
  ctx.globalAlpha = 0.1;
  ctx.drawImage(glowSprite('#cfd8ff'), -400, FRONT_Y - 20, 800, 80);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = op;
}

let floorC: HTMLCanvasElement | null = null;
let groundG: CanvasGradient | null = null;
function makeFloor(): HTMLCanvasElement {
  const [c, g] = mk(1600, 300);
  g.scale(0.5, 0.5);
  g.translate(1600, 0);
  g.fillStyle = vgrad(g, 0, 600, [[0, '#4a4e6a'], [1, '#14142a']]);
  g.fillRect(-1600, 0, 3200, 600);
  // gravilha penteada (jardim zen)
  g.strokeStyle = 'rgba(200,210,255,0.16)';
  g.lineWidth = 3;
  for (let k = 0; k < 14; k++) {
    g.beginPath();
    g.moveTo(-1600, 20 + k * 40);
    for (let x = -1600; x <= 1600; x += 80) g.lineTo(x, 20 + k * 40 + Math.sin(x * 0.004 + k * 0.3) * 8);
    g.stroke();
  }
  // pedras de passagem
  for (let i = 0; i < 6; i++) {
    const x = -500 + i * 200;
    const y = 120 + (i % 2) * 40;
    g.beginPath();
    g.ellipse(x, y, 70, 30, 0, 0, Math.PI * 2);
    inked(g, '#6a6e90', 4, INK);
    g.fillStyle = 'rgba(200,210,255,0.25)';
    g.beginPath();
    g.ellipse(x - 10, y - 8, 40, 12, 0, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 90; i++) {
    g.fillStyle = PINKS[i % 4];
    g.beginPath();
    g.ellipse((hash(i * 3.1) - 0.5) * 3000, hash(i * 5.3) * 560, 6, 3, hash(i) * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.25;
  g.drawImage(glowSprite('#ff9a50'), -1000, -150, 2000, 330);
  return c;
}

function drawFloor(ctx: CanvasRenderingContext2D): void {
  floorC ??= makeFloor();
  groundG ??= (() => {
    const gr = ctx.createLinearGradient(0, BACK_Y + 10, 0, FRONT_Y + 160);
    gr.addColorStop(0, '#383c5c');
    gr.addColorStop(1, '#1a1a30');
    return gr;
  })();
  ctx.fillStyle = groundG;
  ctx.fillRect(-3000, BACK_Y + 10, 6000, FRONT_Y + 160 - BACK_Y);
  ctx.fillStyle = '#14142a';
  ctx.fillRect(-3000, FRONT_Y + 160, 6000, 600);
  ctx.drawImage(floorC, -1600, FRONT_Y + 110, 3200, 600);
}

let fgC: HTMLCanvasElement | null = null;
const FW = 3200;
const FH = 420;
/** Primeiro plano: arbustos e lanternas de pedra em silhueta, com flores. */
function makeFg(): HTMLCanvasElement {
  const [c, g] = mk(FW / 2, FH / 2);
  g.scale(0.5, 0.5);
  const body = '#0a0818';
  for (let i = 0, x = 30; x < FW; i++, x += 120 + hash(i * 5) * 120) {
    if (Math.abs(x - FW / 2) < 480) continue;
    const y = 170 + hash(i * 3 + 1) * 60;
    const r = 60 + hash(i * 7) * 40;
    g.fillStyle = body;
    g.beginPath();
    for (let k = 0; k < 5; k++) g.arc(x + (k - 2) * r * 0.5, y + Math.abs(k - 2) * 14, r * 0.6, 0, Math.PI * 2);
    g.rect(x - r * 1.5, y, r * 3, FH);
    g.fill();
    g.strokeStyle = 'rgba(160,180,255,0.45)';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(x, y, r * 0.6 - 2, Math.PI * 1.15, Math.PI * 1.8);
    g.stroke();
    for (let k = 0; k < 9; k++) {
      g.fillStyle = PINKS[k % 4];
      g.beginPath();
      g.arc(x + (hash(i * 9 + k) - 0.5) * r * 2.4, y + hash(i * 4 + k) * 60 - 20, 5, 0, Math.PI * 2);
      g.fill();
    }
  }
  return c;
}

function drawFg(ctx: CanvasRenderingContext2D, camX: number): void {
  fgC ??= makeFg();
  ctx.drawImage(fgC, -FW / 2 + camX * 0.25, FRONT_Y + 40, FW, FH);
}

// ───────────────────────── pétalas ─────────────────────────

const petalC: HTMLCanvasElement[] = [];
function petalSprite(i: number): HTMLCanvasElement {
  if (!petalC.length) {
    for (const col of PINKS) {
      const [c, g] = mk(24, 24);
      g.translate(12, 12);
      g.beginPath();
      g.moveTo(0, -9);
      g.bezierCurveTo(8, -6, 8, 6, 0, 9);
      g.bezierCurveTo(-8, 6, -8, -6, 0, -9);
      g.fillStyle = col;
      g.fill();
      g.lineWidth = 1.2;
      g.strokeStyle = 'rgba(120,20,60,0.6)';
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.beginPath();
      g.ellipse(-2, -2, 2, 4, 0.3, 0, Math.PI * 2);
      g.fill();
      petalC.push(c);
    }
  }
  return petalC[i % petalC.length];
}

function overlay(ctx: CanvasRenderingContext2D, w: number, h: number, camX: number, zoom: number, t: number, hype: number, low: boolean): void {
  const n = low ? 18 : 46;
  for (let i = 0; i < n; i++) {
    const near = hash(i * 9.9);
    const sp = 30 + near * 50;
    const py = ((t * sp + hash(i * 1.3) * 2000) % (h + 80)) - 40;
    const sway = Math.sin(t * (0.8 + hash(i * 2) * 0.8) + i) * 40;
    const px = ((((hash(i * 5.1) * (w + 200) + t * (25 + hype * 30) + sway - camX * zoom * (0.2 + near * 0.5)) % (w + 200)) + w + 200) % (w + 200)) - 100;
    const sz = (10 + near * 14) * Math.max(0.7, zoom);
    const rot = t * (1 + hash(i * 3) * 2) + i;
    const flip = Math.abs(Math.cos(t * 1.7 + i));
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rot);
    ctx.scale(1, 0.35 + flip * 0.65);
    ctx.globalAlpha = 0.65 + near * 0.35;
    ctx.drawImage(petalSprite(i), -sz / 2, -sz / 2, sz, sz);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

export const TEMPLE: ArenaTheme = {
  ropes: ['#c8202a', '#f0e6c8', '#c8202a'],
  ropeDark: ['#6a0a10', '#a89a70', '#6a0a10'],
  post: {
    stops: [[0, '#2a0406'], [0.3, '#a8141c'], [0.45, '#ff6a5a'], [0.6, '#8a0e16'], [1, '#1a0204']],
    pads: ['#e0303a', '#2f5fc8'],
    padDark: ['#7a0a10', '#14307a'],
    buckle: '#d8b040',
    cap: '#e8c050',
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
  haze: '#5a68b8',
  previewX: 1200,
  pool: '#fff0f4',
  tint: 'rgba(4,6,24,0.22)',
};
