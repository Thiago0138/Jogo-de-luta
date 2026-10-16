import { glowSprite } from '../../render/fighter';
import { hash } from '../fx';
import {
  BACK_X, BACK_Y, BH, BW, FRONT_X, FRONT_Y, SKIRT_H, SKIRT_W, backdropRect, flame, inkText, inked, makeLayer, matFinish, matShell, matW, mk, onMat,
  ringVignette, shaft, shaftSprite, skirtEdges, skirtShell, streakSprite, vgrad, type ArenaTheme, type Layer,
} from '../arenaKit';
import { buildCrowd, drawCrowd, drawCrowdLights, type Crowd } from '../crowd';

/**
 * Pharaoh's Sands — um ringue no meio do deserto ao pôr do sol: pirâmides, esfinge, ruínas,
 * dunas, braseiros a arder e areia a voar. Camadas estáticas pré-renderizadas; por frame só
 * correm a ondulação do calor, as chamas, as aves e a areia.
 */

const INK = '#3a1426';
const SUN_X = 1480;
const SUN_Y = 548;
const HORIZON = 612;
/** Bancadas de pedra (com público) só dos lados, para se ver o horizonte atrás do ringue. */
const OPEN_L = 980;
const OPEN_R = 1640;
const BRAZIERS = [300, 640, 1000, 1620, 1960, 2300];

// ───────────────────────── fundo ─────────────────────────

function sky(g: CanvasRenderingContext2D): void {
  g.fillStyle = vgrad(g, 0, HORIZON + 20, [
    [0, '#1b0b3a'],
    [0.3, '#4a1a5e'],
    [0.55, '#a8346a'],
    [0.75, '#ec6a4a'],
    [0.9, '#ffa94d'],
    [1, '#ffd88a'],
  ]);
  g.fillRect(0, 0, BW, BH);
  // estrelas a aparecer no topo
  for (let i = 0; i < 140; i++) {
    const y = hash(i * 3.3) * 300;
    g.globalAlpha = (1 - y / 300) * (0.4 + hash(i * 7.1) * 0.6);
    g.fillStyle = '#fff4e0';
    g.fillRect(hash(i * 5.7) * BW, y, 2, 2);
  }
  g.globalAlpha = 1;
  // sol gigante com halo
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.55;
  g.drawImage(glowSprite('#ff7a3a'), SUN_X - 900, SUN_Y - 420, 1800, 760);
  g.globalAlpha = 0.6;
  g.drawImage(glowSprite('#ffc06a'), SUN_X - 360, SUN_Y - 300, 720, 560);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  const sg = g.createLinearGradient(0, SUN_Y - 120, 0, SUN_Y + 120);
  sg.addColorStop(0, '#fff8d0');
  sg.addColorStop(0.5, '#ffd36a');
  sg.addColorStop(1, '#ff8a3a');
  g.fillStyle = sg;
  g.beginPath();
  g.arc(SUN_X, SUN_Y, 122, 0, Math.PI * 2);
  g.fill();
  // riscas do sol (estilo cartaz de cinema) na metade de baixo
  g.save();
  g.beginPath();
  g.arc(SUN_X, SUN_Y, 122, 0, Math.PI * 2);
  g.clip();
  for (let k = 0; k < 6; k++) {
    const yy = SUN_Y + 20 + k * 17;
    g.fillStyle = 'rgba(236,90,74,0.85)';
    g.fillRect(SUN_X - 130, yy, 260, 3 + k * 1.6);
  }
  g.restore();
  // nuvens compridas, iluminadas por baixo
  const clouds: [number, number, number, number][] = [
    [380, 360, 520, 18], [1150, 330, 640, 14], [1900, 380, 560, 20], [820, 440, 420, 12], [2250, 300, 380, 12], [1550, 420, 380, 10], [150, 470, 300, 10],
  ];
  for (const [cx, cy, cw, ch] of clouds) {
    g.fillStyle = 'rgba(120,40,100,0.75)';
    g.beginPath();
    g.ellipse(cx, cy, cw / 2, ch, 0, 0, Math.PI * 2);
    g.ellipse(cx - cw * 0.18, cy - ch * 0.7, cw * 0.22, ch * 0.9, 0, 0, Math.PI * 2);
    g.ellipse(cx + cw * 0.15, cy - ch * 0.5, cw * 0.18, ch * 0.8, 0, 0, Math.PI * 2);
    g.fill();
    const near = 1 - Math.min(1, Math.abs(cx - SUN_X) / 1300);
    g.fillStyle = `rgba(255,${150 + near * 70},${90 + near * 40},${0.55 + near * 0.35})`;
    g.beginPath();
    g.ellipse(cx, cy + ch * 0.45, cw * 0.46, ch * 0.45, 0, 0, Math.PI * 2);
    g.fill();
  }
}

/** Mesetas distantes (silhueta violeta). */
function mesas(g: CanvasRenderingContext2D): void {
  g.fillStyle = '#8a3a68';
  g.beginPath();
  g.moveTo(0, HORIZON + 10);
  let x = 0;
  let i = 0;
  while (x < BW) {
    const w = 120 + hash(i * 3.1) * 220;
    const h = hash(i * 7.3) > 0.55 ? 30 + hash(i * 1.7) * 50 : 6 + hash(i) * 10;
    g.lineTo(x + 20, HORIZON - h);
    g.lineTo(x + w - 20, HORIZON - h);
    g.lineTo(x + w, HORIZON);
    x += w;
    i++;
  }
  g.lineTo(BW, HORIZON + 10);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(255,170,110,0.25)';
  g.fillRect(0, HORIZON - 4, BW, 14);
}

function pyramid(g: CanvasRenderingContext2D, px: number, hw: number, apex: number, base: number, haze: number): void {
  const lit = px < SUN_X ? 1 : -1;
  const rx = px + lit * hw * 0.22;
  // face iluminada (do lado do sol) e face na sombra
  g.beginPath();
  g.moveTo(px, apex);
  g.lineTo(rx, base);
  g.lineTo(px + lit * hw, base);
  g.closePath();
  g.fillStyle = vgrad(g, apex, base, [[0, '#ffd08a'], [1, '#e08a4e']]);
  g.fill();
  g.beginPath();
  g.moveTo(px, apex);
  g.lineTo(rx, base);
  g.lineTo(px - lit * hw, base);
  g.closePath();
  g.fillStyle = vgrad(g, apex, base, [[0, '#a8466a'], [1, '#7a2e52']]);
  g.fill();
  // fiadas de pedra
  g.save();
  g.beginPath();
  g.moveTo(px, apex);
  g.lineTo(px + hw, base);
  g.lineTo(px - hw, base);
  g.closePath();
  g.clip();
  g.strokeStyle = 'rgba(70,20,40,0.22)';
  g.lineWidth = 1.5;
  g.beginPath();
  for (let y = apex + 14; y < base; y += 13) {
    g.moveTo(px - hw, y);
    g.lineTo(px + hw, y);
  }
  g.stroke();
  g.strokeStyle = 'rgba(255,230,170,0.22)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(px, apex);
  g.lineTo(rx, base);
  g.stroke();
  g.restore();
  // ponta dourada
  const tip = (base - apex) * 0.1;
  g.beginPath();
  g.moveTo(px, apex);
  g.lineTo(px + hw * (tip / (base - apex)), apex + tip);
  g.lineTo(px - hw * (tip / (base - apex)), apex + tip);
  g.closePath();
  g.fillStyle = '#ffe48a';
  g.fill();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.5;
  g.drawImage(glowSprite('#ffd27a'), px - 30, apex - 26, 60, 50);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  // contorno e neblina (as mais longe ficam mais cor-do-céu)
  g.beginPath();
  g.moveTo(px, apex);
  g.lineTo(px + hw, base);
  g.lineTo(px - hw, base);
  g.closePath();
  g.lineWidth = 2.5;
  g.strokeStyle = 'rgba(58,20,38,0.7)';
  g.lineJoin = 'round';
  g.stroke();
  if (haze > 0) {
    g.fillStyle = `rgba(214,96,110,${haze})`;
    g.fill();
  }
}

/** Faixa de duna com crista iluminada e encosta na sombra. */
function dune(g: CanvasRenderingContext2D, y: number, amp: number, seed: number, lit: string, dark: string, crest: string): void {
  const pts: [number, number][] = [];
  for (let x = -40; x <= BW + 40; x += 40) {
    const yy = y - amp * (0.55 * Math.sin(x * 0.0042 + seed) + 0.3 * Math.sin(x * 0.011 + seed * 2.3) + 0.15 * Math.sin(x * 0.023 + seed * 4.1));
    pts.push([x, yy]);
  }
  const trace = () => {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2;
      const my = (pts[i][1] + pts[i + 1][1]) / 2;
      g.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    g.lineTo(BW + 40, BH + 10);
    g.lineTo(-40, BH + 10);
    g.closePath();
  };
  trace();
  g.fillStyle = vgrad(g, y - amp, y + 120, [[0, lit], [1, dark]]);
  g.fill();
  // encostas na sombra: do lado contrário ao sol, cada lomba tem uma sombra em cunha
  g.save();
  trace();
  g.clip();
  for (let i = 1; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const slopeAway = x0 < SUN_X ? y1 > y0 : y1 < y0;
    if (!slopeAway) continue;
    g.fillStyle = 'rgba(110,30,60,0.22)';
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.lineTo(x1 + (x0 < SUN_X ? 30 : -30), y1 + 90);
    g.lineTo(x0, y0 + 90);
    g.closePath();
    g.fill();
  }
  // ondulações do vento
  g.strokeStyle = 'rgba(120,40,50,0.18)';
  g.lineWidth = 1.5;
  for (let k = 0; k < 40; k++) {
    const rx = hash(seed * 31 + k) * BW;
    const ry = y + 18 + hash(seed * 17 + k * 3) * 60;
    g.beginPath();
    g.moveTo(rx - 40, ry);
    g.quadraticCurveTo(rx, ry - 4, rx + 40, ry);
    g.stroke();
  }
  g.restore();
  trace();
  g.lineWidth = 2.5;
  g.strokeStyle = INK;
  g.globalAlpha = 0.55;
  g.stroke();
  g.globalAlpha = 1;
  // brilho da crista
  g.strokeStyle = crest;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1] + 2);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    g.quadraticCurveTo(pts[i][0], pts[i][1] + 2, mx, my + 2);
  }
  g.stroke();
}

function sphinx(g: CanvasRenderingContext2D, x: number, y: number, k: number): void {
  g.save();
  g.translate(x, y);
  g.scale(k, k);
  g.lineJoin = 'round';
  const stone = vgrad(g, -140, 0, [[0, '#f2b872'], [1, '#c9784a']]);
  const shade = '#9a4a4e';
  // corpo deitado (a olhar para o ringue, à esquerda)
  g.beginPath();
  g.moveTo(-30, 0);
  g.lineTo(-30, -62);
  g.quadraticCurveTo(10, -80, 120, -70);
  g.quadraticCurveTo(190, -64, 200, -30);
  g.lineTo(206, 0);
  g.closePath();
  inked(g, stone, 3, INK);
  g.fillStyle = 'rgba(120,40,60,0.28)';
  g.fillRect(-30, -22, 236, 22);
  // patas
  g.beginPath();
  g.roundRect(-130, -24, 130, 24, 8);
  inked(g, stone, 3, INK);
  g.fillStyle = shade;
  g.globalAlpha = 0.35;
  g.fillRect(-128, -8, 126, 7);
  g.globalAlpha = 1;
  // peito e cabeça com o nemes às riscas
  g.beginPath();
  g.moveTo(-58, -20);
  g.lineTo(-62, -110);
  g.quadraticCurveTo(-46, -160, -4, -160);
  g.quadraticCurveTo(34, -160, 44, -110);
  g.lineTo(40, -20);
  g.closePath();
  inked(g, '#e9b04a', 3, INK);
  g.save();
  g.clip();
  g.fillStyle = '#2f5fa8';
  for (let yy = -156; yy < -20; yy += 16) g.fillRect(-70, yy, 120, 7);
  g.fillStyle = 'rgba(80,20,50,0.3)';
  g.fillRect(14, -165, 40, 150);
  g.restore();
  // cara
  g.beginPath();
  g.roundRect(-36, -146, 50, 62, 14);
  inked(g, stone, 2.5, INK);
  g.fillStyle = 'rgba(120,40,60,0.3)';
  g.fillRect(-2, -146, 16, 62);
  g.fillStyle = INK;
  g.fillRect(-28, -124, 12, 4);
  g.fillRect(-6, -124, 12, 4);
  g.fillRect(-14, -100, 14, 3);
  g.beginPath();
  g.roundRect(-14, -86, 12, 22, 4);
  inked(g, '#c58a3a', 2, INK);
  g.restore();
}

function column(g: CanvasRenderingContext2D, x: number, top: number, base: number, w: number, broken: boolean): void {
  g.lineJoin = 'round';
  const lit = x < SUN_X ? 1 : -1;
  const cg = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  cg.addColorStop(0, lit > 0 ? '#9a4a4e' : '#f4c27e');
  cg.addColorStop(0.5, '#e09a5c');
  cg.addColorStop(1, lit > 0 ? '#f4c27e' : '#9a4a4e');
  g.beginPath();
  if (broken) {
    g.moveTo(x - w / 2, base);
    g.lineTo(x - w / 2, top + 14);
    g.lineTo(x - w / 4, top + 4);
    g.lineTo(x - 2, top + 18);
    g.lineTo(x + w / 5, top);
    g.lineTo(x + w / 2, top + 22);
    g.lineTo(x + w / 2, base);
  } else g.rect(x - w / 2, top, w, base - top);
  inked(g, cg, 3, INK);
  // estrias e hieróglifos
  g.strokeStyle = 'rgba(90,30,40,0.3)';
  g.lineWidth = 1.5;
  g.beginPath();
  for (let k = -2; k <= 2; k++) {
    g.moveTo(x + k * w * 0.18, top + 24);
    g.lineTo(x + k * w * 0.18, base - 12);
  }
  g.stroke();
  g.fillStyle = 'rgba(70,20,40,0.35)';
  for (let yy = top + 40; yy < base - 30; yy += 22) {
    const k = Math.floor(hash(x + yy) * 4);
    if (k === 0) g.fillRect(x - 6, yy, 12, 3);
    else if (k === 1) {
      g.beginPath();
      g.arc(x, yy + 3, 5, 0, Math.PI * 2);
      g.fill();
    } else if (k === 2) g.fillRect(x - 2, yy - 4, 4, 12);
    else {
      g.beginPath();
      g.moveTo(x - 6, yy + 6);
      g.lineTo(x, yy - 4);
      g.lineTo(x + 6, yy + 6);
      g.fill();
    }
  }
  // base e capitel em flor de lótus
  g.beginPath();
  g.rect(x - w / 2 - 8, base - 14, w + 16, 14);
  inked(g, '#d48a54', 2.5, INK);
  if (!broken) {
    g.beginPath();
    g.moveTo(x - w / 2, top);
    g.quadraticCurveTo(x - w * 0.9, top - 20, x - w * 0.8, top - 32);
    g.lineTo(x + w * 0.8, top - 32);
    g.quadraticCurveTo(x + w * 0.9, top - 20, x + w / 2, top);
    g.closePath();
    inked(g, '#eab070', 2.5, INK);
    g.fillStyle = '#2f9a8c';
    g.fillRect(x - w * 0.6, top - 20, w * 1.2, 4);
    g.beginPath();
    g.rect(x - w * 0.85, top - 42, w * 1.7, 10);
    inked(g, '#d48a54', 2.5, INK);
  }
}

function obelisk(g: CanvasRenderingContext2D, x: number, top: number, base: number, w: number): void {
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(x - w / 2, base);
  g.lineTo(x - w * 0.36, top + 30);
  g.lineTo(x, top);
  g.lineTo(x + w * 0.36, top + 30);
  g.lineTo(x + w / 2, base);
  g.closePath();
  const og = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  og.addColorStop(0, '#a04a56');
  og.addColorStop(0.45, '#c26a5a');
  og.addColorStop(0.55, '#f0b070');
  og.addColorStop(1, '#ffd08a');
  inked(g, og, 3, INK);
  g.beginPath();
  g.moveTo(x - w * 0.36, top + 30);
  g.lineTo(x, top);
  g.lineTo(x + w * 0.36, top + 30);
  g.closePath();
  g.fillStyle = '#ffe48a';
  g.fill();
  g.fillStyle = 'rgba(70,20,40,0.4)';
  for (let yy = top + 50; yy < base - 20; yy += 18) {
    g.fillRect(x - 4, yy, 8, 3);
    if (hash(yy) > 0.5) g.fillRect(x - 1.5, yy + 5, 3, 7);
  }
}

/** Bancadas escavadas na pedra (com o público por cima). */
function bleachers(g: CanvasRenderingContext2D, x0: number, x1: number): void {
  for (let r = 0; r < 4; r++) {
    const y = 548 + r * 46;
    g.beginPath();
    g.rect(x0, y, x1 - x0, 50);
    inked(g, vgrad(g, y, y + 50, [[0, '#e4a064'], [0.25, '#c87a4c'], [1, '#8a3e46']]), 2.5, INK);
    g.fillStyle = 'rgba(255,220,160,0.35)';
    g.fillRect(x0, y + 2, x1 - x0, 3);
    g.strokeStyle = 'rgba(70,20,40,0.3)';
    g.lineWidth = 1.5;
    g.beginPath();
    for (let x = x0 + ((r * 37) % 60); x < x1; x += 60 + hash(x + r) * 30) {
      g.moveTo(x, y + 6);
      g.lineTo(x, y + 48);
    }
    g.stroke();
  }
  // pilares nas pontas das bancadas
  for (const px of [x0, x1]) {
    g.beginPath();
    g.rect(px - 18, 500, 36, 210);
    inked(g, vgrad(g, 500, 710, [[0, '#f0b070'], [1, '#9a4a4e']]), 3, INK);
    g.beginPath();
    g.rect(px - 26, 490, 52, 14);
    inked(g, '#e09a5c', 2.5, INK);
  }
}

/** Faixas de pano penduradas entre colunas. */
function banner(g: CanvasRenderingContext2D, x: number, top: number, w: number, h: number, col: string): void {
  g.beginPath();
  g.moveTo(x - w / 2, top);
  g.lineTo(x + w / 2, top);
  g.lineTo(x + w / 2, top + h);
  g.lineTo(x, top + h - 16);
  g.lineTo(x - w / 2, top + h);
  g.closePath();
  inked(g, col, 2.5, INK);
  g.fillStyle = 'rgba(0,0,0,0.22)';
  g.fillRect(x + 4, top + 2, w / 2 - 6, h - 18);
  g.strokeStyle = '#ffd36a';
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(x - w / 2 + 6, top + 6);
  g.lineTo(x - w / 2 + 6, top + h - 10);
  g.moveTo(x + w / 2 - 6, top + 6);
  g.lineTo(x + w / 2 - 6, top + h - 10);
  g.stroke();
  eye(g, x, top + h * 0.42, w * 0.32);
}

/** Olho de Hórus estilizado. */
function eye(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.strokeStyle = '#ffd36a';
  g.lineWidth = r * 0.16;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x - r, y);
  g.quadraticCurveTo(x, y - r * 0.8, x + r, y);
  g.quadraticCurveTo(x, y + r * 0.6, x - r, y);
  g.moveTo(x - r * 0.9, y - r * 0.55);
  g.quadraticCurveTo(x, y - r * 1.15, x + r * 0.9, y - r * 0.5);
  g.moveTo(x - r * 0.15, y + r * 0.35);
  g.lineTo(x - r * 0.35, y + r * 1.0);
  g.moveTo(x + r * 0.35, y + r * 0.3);
  g.quadraticCurveTo(x + r * 0.5, y + r * 1.0, x + r * 0.95, y + r * 0.8);
  g.stroke();
  g.fillStyle = '#ffd36a';
  g.beginPath();
  g.arc(x, y - r * 0.05, r * 0.28, 0, Math.PI * 2);
  g.fill();
}

let backdrop: HTMLCanvasElement | null = null;
let crowd: Crowd | null = null;
let wall: Layer | null = null;

function makeBackdrop(): HTMLCanvasElement {
  const [c, g] = mk(BW, BH);
  sky(g);
  mesas(g);
  pyramid(g, 2280, 170, 430, HORIZON + 6, 0.32);
  pyramid(g, 1080, 150, 452, HORIZON + 8, 0.28);
  pyramid(g, 760, 270, 300, HORIZON + 14, 0.12);
  pyramid(g, 2010, 230, 360, HORIZON + 14, 0.14);
  dune(g, HORIZON + 8, 16, 1.3, '#d0705a', '#a24a52', 'rgba(255,190,140,0.6)');
  obelisk(g, 1180, 360, 660, 46);
  sphinx(g, 1740, 668, 0.95);
  dune(g, 668, 18, 4.2, '#ea9a5c', '#b65a4a', 'rgba(255,220,160,0.8)');
  // ruínas: colunas (algumas partidas) com faixas penduradas
  column(g, 420, 380, 700, 46, false);
  column(g, 560, 410, 700, 46, false);
  column(g, 700, 520, 700, 44, true);
  g.beginPath();
  g.rect(380, 330, 222, 18);
  inked(g, '#d48a54', 3, INK);
  banner(g, 490, 348, 66, 120, '#b8202e');
  column(g, 1910, 500, 700, 44, true);
  column(g, 2060, 410, 700, 46, false);
  column(g, 2200, 380, 700, 46, false);
  g.beginPath();
  g.rect(2020, 330, 222, 18);
  inked(g, '#d48a54', 3, INK);
  banner(g, 2130, 348, 66, 120, '#1f4fa8');
  bleachers(g, 60, OPEN_L - 70);
  bleachers(g, OPEN_R + 70, BW - 60);
  // a areia aquece a base das bancadas (luz do sol rasante)
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.22;
  g.drawImage(glowSprite('#ff9a4a'), SUN_X - 1100, HORIZON - 200, 2200, 400);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  return c;
}

/** Muro de pedra à volta do ringue (com braseiros), à frente do público. */
function makeWall(): Layer {
  return makeLayer(640, BH, 0.6, '', (g) => {
    const by = 682;
    g.beginPath();
    g.rect(-10, by, BW + 20, 90);
    inked(g, vgrad(g, by, by + 80, [[0, '#e8a868'], [0.2, '#c87a4c'], [1, '#6a2a3a']]), 3, INK);
    // blocos de pedra
    g.strokeStyle = 'rgba(70,20,40,0.35)';
    g.lineWidth = 2;
    g.beginPath();
    for (let row = 0; row < 3; row++) {
      const yy = by + 8 + row * 26;
      g.moveTo(0, yy);
      g.lineTo(BW, yy);
      for (let x = (row % 2) * 60; x < BW; x += 120) {
        g.moveTo(x, yy);
        g.lineTo(x, yy + 26);
      }
    }
    g.stroke();
    // friso de hieróglifos dourados
    g.fillStyle = '#1f3f7a';
    g.fillRect(0, by + 36, BW, 22);
    g.fillStyle = '#ffd36a';
    for (let x = 10, k = 0; x < BW; x += 34, k++) {
      const t = k % 5;
      if (t === 0) eyeMini(g, x + 12, by + 47);
      else if (t === 1) g.fillRect(x + 8, by + 40, 6, 14);
      else if (t === 2) {
        g.beginPath();
        g.moveTo(x + 4, by + 54);
        g.lineTo(x + 12, by + 40);
        g.lineTo(x + 20, by + 54);
        g.fill();
      } else if (t === 3) {
        g.beginPath();
        g.arc(x + 12, by + 47, 6, 0, Math.PI * 2);
        g.fill();
      } else {
        g.fillRect(x + 4, by + 44, 16, 3);
        g.fillRect(x + 10, by + 40, 3, 14);
      }
    }
    g.fillStyle = 'rgba(255,230,170,0.5)';
    g.fillRect(0, by + 1, BW, 3);
    // braseiros (as chamas animam por frame)
    for (const bx of BRAZIERS) {
      g.beginPath();
      g.moveTo(bx - 10, by + 2);
      g.lineTo(bx - 16, by - 38);
      g.lineTo(bx + 16, by - 38);
      g.lineTo(bx + 10, by + 2);
      g.closePath();
      inked(g, '#4a2a1a', 2.5, INK);
      g.beginPath();
      g.moveTo(bx - 34, by - 62);
      g.quadraticCurveTo(bx, by - 30, bx + 34, by - 62);
      g.closePath();
      inked(g, vgrad(g, by - 62, by - 40, [[0, '#ffd36a'], [1, '#9a5a1a']]), 2.5, INK);
      g.fillStyle = '#ff7a2a';
      g.beginPath();
      g.ellipse(bx, by - 61, 30, 5, 0, 0, Math.PI * 2);
      g.fill();
    }
  });
}

function eyeMini(g: CanvasRenderingContext2D, x: number, y: number): void {
  g.beginPath();
  g.ellipse(x, y, 9, 4, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#1f3f7a';
  g.beginPath();
  g.arc(x, y, 2.4, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#ffd36a';
  g.fillRect(x - 1, y + 3, 2, 6);
}

function prepare(): void {
  if (backdrop) return;
  backdrop = makeBackdrop();
  crowd = buildCrowd({
    rows: [5, 7],
    blocked: (x) => (x > OPEN_L - 90 && x < OPEN_R + 90) || x < 70 || x > BW - 70,
    shirts: ['#f3e6c8', '#c0392b', '#2f6fa8', '#e6a23c', '#3d8b6e', '#7a4a8c', '#f5f0e1', '#d35400', '#1b4f72', '#ffffff', '#e8d5b0', '#16a085'],
    haze: '90,30,50',
  });
  wall = makeWall();
}

/** Aves a planar no céu do fim de tarde. */
function birds(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number): void {
  ctx.strokeStyle = 'rgba(40,10,30,0.8)';
  ctx.lineWidth = Math.max(1, 2.4 * s);
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const a = t * (0.12 + i * 0.03) + i * 1.9;
    const cx = 1300 + Math.cos(a) * (300 + i * 90) + i * 120;
    const cy = 330 + i * 30 + Math.sin(a * 1.3) * 30;
    const fl = Math.sin(t * 6 + i * 2) * 4;
    const k = (8 + i * 2) * s;
    const bx = x + cx * s;
    const by = y + cy * s;
    ctx.beginPath();
    ctx.moveTo(bx - k, by - fl * s);
    ctx.quadraticCurveTo(bx - k * 0.4, by - k * 0.5, bx, by);
    ctx.quadraticCurveTo(bx + k * 0.4, by - k * 0.5, bx + k, by - fl * s);
    ctx.stroke();
  }
}

function drawBack(ctx: CanvasRenderingContext2D, w: number, h: number, camX: number, zoom: number, horizonY: number, t: number, hype: number, low: boolean): void {
  prepare();
  const { x, y, s, dw, dh } = backdropRect(w, camX, zoom, horizonY);
  ctx.fillStyle = '#1b0b3a';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(backdrop!, x, y, dw, dh);
  if (!low) {
    // ar quente a ondular por cima do horizonte
    const y0 = HORIZON - 70;
    const step = 7;
    for (let yy = y0; yy < HORIZON + 50; yy += step) {
      const k = 1 - Math.abs(yy - HORIZON) / 120;
      const off = Math.sin(t * 3.2 + yy * 0.21) * 2.2 * k * s;
      ctx.drawImage(backdrop!, 0, yy, BW, step, x + off, y + yy * s, dw, step * s + 0.5);
    }
  }
  birds(ctx, x, y, s, t);
  drawCrowd(ctx, crowd!, x, y, s, dw, t, hype);
  ctx.drawImage(wall!.c, x, y + wall!.y0 * s, dw, wall!.h * s);
  for (let i = 0; i < BRAZIERS.length; i++) {
    const bx = x + BRAZIERS[i] * s;
    if (bx < -80 || bx > w + 80) continue;
    flame(ctx, bx, y + 618 * s, 1.15 * s, t, i * 1.7, low);
  }
  ringVignette(ctx, w, camX, zoom, horizonY, 1500, 800, '30,6,24', 0.5);
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  // o sol pulsa e espalha luz sobre o ringue
  const sx = x + SUN_X * s;
  const sy = y + SUN_Y * s;
  ctx.globalAlpha = 0.14 + 0.04 * Math.sin(t * 0.7);
  ctx.drawImage(glowSprite('#ffb060'), sx - 520 * s, sy - 300 * s, 1040 * s, 560 * s);
  if (!low) {
    ctx.globalAlpha = 0.35;
    ctx.drawImage(streakSprite(), sx - 700 * s, sy - 8 * s, 1400 * s, 16 * s);
    // raios de sol (fachos) a sair do sol
    const sp = shaftSprite('#ffc27a');
    for (let i = 0; i < 5; i++) {
      const a = -1.2 + i * 0.6 + Math.sin(t * 0.15 + i) * 0.05;
      shaft(ctx, sp, sx, sy, a + Math.PI, 900 * s, 220 * s, 0.06 + 0.02 * Math.sin(t * 0.5 + i * 2));
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = prev;
  drawCrowdLights(ctx, crowd!, x, y, s, t, low);
}

// ───────────────────────── ringue ─────────────────────────

/** Sol alado (símbolo egípcio) visto de cima. */
function wingedSun(g: CanvasRenderingContext2D): void {
  // asas: filas de penas
  for (const sx of [-1, 1]) {
    for (let row = 0; row < 3; row++) {
      const len = 300 - row * 70;
      const yy = -20 + row * 26;
      g.beginPath();
      g.moveTo(sx * 60, yy - 18);
      g.quadraticCurveTo(sx * (60 + len * 0.6), yy - 40 + row * 6, sx * (60 + len), yy - 10);
      g.lineTo(sx * (60 + len - 20), yy + 16);
      for (let k = 6; k >= 0; k--) {
        const fx = sx * (60 + (len - 20) * (k / 6));
        g.lineTo(fx, yy + 16 - (k % 2) * 4);
      }
      g.closePath();
      g.fillStyle = row === 0 ? 'rgba(31,63,140,0.7)' : row === 1 ? 'rgba(46,154,140,0.7)' : 'rgba(214,150,40,0.75)';
      g.fill();
      g.lineWidth = 5;
      g.strokeStyle = 'rgba(70,24,40,0.55)';
      g.stroke();
    }
  }
  // disco solar com as serpentes
  const gd = g.createRadialGradient(-20, -30, 10, 0, 0, 80);
  gd.addColorStop(0, 'rgba(255,240,170,0.95)');
  gd.addColorStop(0.6, 'rgba(240,120,40,0.9)');
  gd.addColorStop(1, 'rgba(180,40,40,0.9)');
  g.beginPath();
  g.arc(0, 0, 76, 0, Math.PI * 2);
  g.fillStyle = gd;
  g.fill();
  g.lineWidth = 8;
  g.strokeStyle = 'rgba(214,160,40,0.9)';
  g.stroke();
  g.lineWidth = 5;
  g.strokeStyle = 'rgba(70,24,40,0.6)';
  g.beginPath();
  g.arc(0, 0, 82, 0, Math.PI * 2);
  g.stroke();
}

function makeMat(): HTMLCanvasElement {
  const [c, g, W, H] = matShell();
  g.fillStyle = vgrad(g, BACK_Y, FRONT_Y, [[0, '#c49468'], [0.5, '#e8c896'], [1, '#f6e2b8']]);
  g.fillRect(-FRONT_X, BACK_Y, W, H);
  // areia levada pelo vento a acumular-se no tapete
  for (let i = 0; i < 60; i++) {
    const x = (hash(i * 13 + 5) - 0.5) * W * 0.95;
    const y = BACK_Y + 6 + hash(i * 17 + 3) * (H - 12);
    g.fillStyle = `rgba(190,120,60,${0.05 + hash(i * 3) * 0.06})`;
    g.beginPath();
    g.ellipse(x, y, 20 + hash(i) * 50, 3 + hash(i * 2) * 5, 0, 0, Math.PI * 2);
    g.fill();
  }
  // faixa de pedra azul-lápis com friso dourado (à volta, por dentro das cordas)
  const band = (y: number, hw0: number, hw1: number, th: number) => {
    g.fillStyle = 'rgba(31,63,122,0.62)';
    g.beginPath();
    g.moveTo(-hw0, y);
    g.lineTo(hw0, y);
    g.lineTo(hw1, y + th);
    g.lineTo(-hw1, y + th);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(232,180,60,0.85)';
    g.lineWidth = 1.6;
    g.beginPath();
    const n = 46;
    for (let k = 0; k <= n; k++) {
      const u = k / n;
      const xx = -hw0 + u * hw0 * 2;
      g.lineTo(xx * (1 + (hw1 / hw0 - 1) * ((k % 2) * 1)), y + (k % 2 ? th - 2 : 2));
    }
    g.stroke();
  };
  band(BACK_Y + 6, BACK_X - 24, matW(BACK_Y + 14) - 24, 8);
  band(FRONT_Y - 26, matW(FRONT_Y - 26) - 40, matW(FRONT_Y - 14) - 40, 12);
  for (const sx of [-1, 1]) {
    g.strokeStyle = 'rgba(31,63,122,0.55)';
    g.lineWidth = 9;
    g.beginPath();
    g.moveTo(sx * (BACK_X - 30), BACK_Y + 12);
    g.lineTo(sx * (FRONT_X - 46), FRONT_Y - 18);
    g.stroke();
    g.strokeStyle = 'rgba(232,180,60,0.8)';
    g.lineWidth = 2;
    g.stroke();
  }
  // escaravelhos nos cantos com a cor da equipa
  for (const [sx, sy] of [[-1, BACK_Y + 26], [1, BACK_Y + 26], [-1, FRONT_Y - 40], [1, FRONT_Y - 40]] as const) {
    onMat(g, sy, 0.3, () => {
      const cx = sx * (matW(sy) - 92);
      g.fillStyle = sx < 0 ? 'rgba(200,40,40,0.6)' : 'rgba(40,90,200,0.6)';
      g.beginPath();
      g.ellipse(cx, 0, 26, 32, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(232,180,60,0.85)';
      g.lineWidth = 4;
      g.stroke();
      g.beginPath();
      g.moveTo(cx, -30);
      g.lineTo(cx, 30);
      g.moveTo(cx - 26, -6);
      g.lineTo(cx - 46, -18);
      g.moveTo(cx + 26, -6);
      g.lineTo(cx + 46, -18);
      g.stroke();
    });
  }
  onMat(g, -16, 0.26, () => wingedSun(g));
  matFinish(g, {
    weave: ['rgba(255,240,200,0.25)', 'rgba(140,80,40,0.08)'],
    hot: '255,220,160',
    hotA: 0.45,
    shade: '90,40,30',
    edge: 'rgba(31,63,122,0.95)',
    edgeHi: 'rgba(255,210,110,0.6)',
  });
  g.fillStyle = 'rgba(255,215,110,0.95)';
  for (let x = -FRONT_X + 20; x < FRONT_X; x += 28) {
    g.beginPath();
    g.moveTo(x, FRONT_Y - 1.5);
    g.lineTo(x + 7, FRONT_Y - 5.5);
    g.lineTo(x + 14, FRONT_Y - 1.5);
    g.fill();
  }
  return c;
}

/** Luz quente do pôr do sol a entrar pela direita e brilho dos braseiros nos cantos. */
function matFx(ctx: CanvasRenderingContext2D, t: number, hype: number, low: boolean): void {
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.16;
  ctx.drawImage(glowSprite('#ff9a4a'), 0, BACK_Y - 40, 700, 150);
  if (!low) {
    for (const sx of [-1, 1]) {
      const f = 0.85 + 0.15 * Math.sin(t * 13 + sx * 3) * Math.sin(t * 7.3 + sx);
      ctx.globalAlpha = (0.22 + hype * 0.08) * f;
      ctx.drawImage(glowSprite('#ff7a2a'), sx * FRONT_X - 180, FRONT_Y - 80, 360, 120);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = prev;
}

let skirtC: HTMLCanvasElement | null = null;
function makeSkirt(): HTMLCanvasElement {
  const [c, g, L] = skirtShell();
  // blocos de arenito
  g.fillStyle = vgrad(g, 0, SKIRT_H, [[0, '#e0a064'], [0.5, '#b86a46'], [1, '#6a2a34']]);
  g.fillRect(L, 0, SKIRT_W, SKIRT_H);
  g.strokeStyle = 'rgba(60,16,30,0.45)';
  g.lineWidth = 1.6;
  g.beginPath();
  for (let row = 0; row < 4; row++) {
    const y = 22 + row * 22;
    g.moveTo(L, y);
    g.lineTo(-L, y);
    for (let x = L + (row % 2) * 45; x < -L; x += 90) {
      g.moveTo(x, y);
      g.lineTo(x, y + 22);
    }
  }
  g.stroke();
  for (let i = 0; i < 160; i++) {
    g.fillStyle = hash(i * 3) > 0.5 ? 'rgba(255,220,170,0.18)' : 'rgba(70,20,30,0.15)';
    g.fillRect(L + hash(i * 7) * SKIRT_W, 22 + hash(i * 11) * 84, 3 + hash(i) * 6, 1.5);
  }
  // friso de hieróglifos em lápis-lazúli e ouro
  g.fillStyle = '#1f3f7a';
  g.fillRect(L, 8, SKIRT_W, 14);
  g.fillStyle = '#ffd36a';
  for (let x = L + 8, k = 0; x < -L; x += 22, k++) {
    if (k % 3 === 0) {
      g.beginPath();
      g.moveTo(x, 19);
      g.lineTo(x + 7, 11);
      g.lineTo(x + 14, 19);
      g.fill();
    } else if (k % 3 === 1) g.fillRect(x + 5, 10, 4, 10);
    else {
      g.beginPath();
      g.arc(x + 7, 15, 4, 0, Math.PI * 2);
      g.fill();
    }
  }
  // placa central em lápis com letras de ouro
  g.beginPath();
  g.moveTo(-262, 30);
  g.lineTo(262, 30);
  g.lineTo(282, 62);
  g.lineTo(262, 94);
  g.lineTo(-262, 94);
  g.lineTo(-282, 62);
  g.closePath();
  inked(g, vgrad(g, 30, 94, [[0, '#2a56a8'], [1, '#132a5e']]), 4);
  g.strokeStyle = '#ffd36a';
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(-254, 36);
  g.lineTo(254, 36);
  g.lineTo(272, 62);
  g.lineTo(254, 88);
  g.lineTo(-254, 88);
  g.lineTo(-272, 62);
  g.closePath();
  g.stroke();
  inkText(g, "PHARAOH'S SANDS", 0, 64, 40, vgrad(g, 44, 82, [[0, '#fffbe0'], [0.5, '#ffd36a'], [1, '#e08a1a']]), 8);
  // medalhões: olho de Hórus (vermelho à esquerda, azul à direita)
  for (const side of [-1, 1]) {
    const mx = side * 380;
    g.beginPath();
    g.arc(mx, 62, 30, 0, Math.PI * 2);
    inked(g, vgrad(g, 32, 92, [[0, '#fff2b0'], [0.6, '#f0b62e'], [1, '#9a5e12']]), 4);
    g.beginPath();
    g.arc(mx, 62, 22, 0, Math.PI * 2);
    inked(g, side < 0 ? '#a81c26' : '#1f4fa8', 2.5);
    eye(g, mx, 60, 14);
  }
  // rodapé
  g.fillStyle = '#3a1420';
  g.fillRect(L, 100, SKIRT_W, 12);
  g.fillStyle = '#ffd36a';
  g.fillRect(L, 100, SKIRT_W, 2.5);
  g.fillStyle = 'rgba(255,230,170,0.5)';
  g.fillRect(L, 0, SKIRT_W, 2);
  skirtEdges(g);
  return c;
}

/** Luz dos braseiros a tremeluzir na saia e um reflexo dourado a varrer o letreiro. */
function skirtFx(ctx: CanvasRenderingContext2D, t: number, _hype: number, low: boolean): void {
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  for (const sx of [-1, 1]) {
    const f = 0.8 + 0.2 * Math.sin(t * 12 + sx * 2) * Math.sin(t * 5.7 + sx);
    ctx.globalAlpha = 0.28 * f;
    ctx.drawImage(glowSprite('#ff7a2a'), sx * (FRONT_X - 40) - 160, FRONT_Y - 10, 320, 140);
  }
  if (!low) {
    const gx = ((t * 220) % 2400) - 1200;
    if (Math.abs(gx) < 300) {
      ctx.globalAlpha = 0.3;
      ctx.drawImage(glowSprite('#ffe9a0'), gx - 40, FRONT_Y + 30, 80, 66);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = prev;
}

let floorC: HTMLCanvasElement | null = null;
let groundG: CanvasGradient | null = null;
function makeFloor(): HTMLCanvasElement {
  const [c, g] = mk(1600, 300);
  g.scale(0.5, 0.5);
  g.translate(1600, 0);
  g.fillStyle = vgrad(g, 0, 600, [[0, '#c87a4c'], [0.5, '#8a3e3a'], [1, '#3a1420']]);
  g.fillRect(-1600, 0, 3200, 600);
  // ondulações da areia
  g.strokeStyle = 'rgba(255,200,140,0.22)';
  g.lineWidth = 3;
  for (let i = 0; i < 80; i++) {
    const x = (hash(i * 3.1) - 0.5) * 3200;
    const y = 30 + hash(i * 5.3) * 520;
    g.beginPath();
    g.moveTo(x - 80, y);
    g.quadraticCurveTo(x, y - 10, x + 80, y);
    g.stroke();
  }
  // tapete persa de entrada à frente do ringue
  g.beginPath();
  g.rect(-500, 20, 1000, 150);
  inked(g, '#8e1622', 4);
  g.strokeStyle = '#ffd36a';
  g.lineWidth = 5;
  g.strokeRect(-484, 34, 968, 122);
  g.strokeStyle = '#1f3f7a';
  g.lineWidth = 10;
  g.strokeRect(-460, 52, 920, 86);
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.35;
  g.drawImage(glowSprite('#ff8a3a'), -1000, -140, 2000, 330);
  return c;
}

function drawFloor(ctx: CanvasRenderingContext2D): void {
  floorC ??= makeFloor();
  groundG ??= (() => {
    const gr = ctx.createLinearGradient(0, BACK_Y + 10, 0, FRONT_Y + 200);
    gr.addColorStop(0, '#b4684a');
    gr.addColorStop(0.5, '#c87a4c');
    gr.addColorStop(1, '#5a2232');
    return gr;
  })();
  ctx.fillStyle = groundG;
  ctx.fillRect(-3000, BACK_Y + 10, 6000, FRONT_Y + 200 - BACK_Y);
  ctx.fillStyle = '#3a1420';
  ctx.fillRect(-3000, FRONT_Y + 200, 6000, 600);
  ctx.drawImage(floorC, -1600, FRONT_Y + 110, 3200, 600);
}

let fgC: HTMLCanvasElement | null = null;
const FW = 3200;
const FH = 420;
/** Primeiro plano: pedras, colunas tombadas e ânforas em contraluz. */
function makeFg(): HTMLCanvasElement {
  const [c, g] = mk(FW / 2, FH / 2);
  g.scale(0.5, 0.5);
  const body = '#2a0e1e';
  const rim = 'rgba(255,170,90,0.65)';
  for (let i = 0, x = 40; x < FW; i++, x += 160 + hash(i * 5) * 160) {
    if (Math.abs(x - FW / 2) < 520) continue;
    const kind = Math.floor(hash(i * 9.7) * 3);
    const y = 150 + hash(i * 3 + 1) * 50;
    g.fillStyle = body;
    g.beginPath();
    if (kind === 0) {
      // rocha
      g.moveTo(x - 90, FH);
      g.lineTo(x - 70, y + 20);
      g.lineTo(x - 20, y - 10);
      g.lineTo(x + 40, y);
      g.lineTo(x + 90, y + 40);
      g.lineTo(x + 110, FH);
    } else if (kind === 1) {
      // tambor de coluna tombado
      g.ellipse(x, y + 70, 70, 60, 0, 0, Math.PI * 2);
      g.rect(x - 160, y + 10, 160, 120);
    } else {
      // ânfora
      g.ellipse(x, y + 60, 40, 60, 0, 0, Math.PI * 2);
      g.rect(x - 14, y - 20, 28, 40);
      g.rect(x - 26, y - 26, 52, 10);
      g.rect(x - 60, y + 110, 120, FH);
    }
    g.fill();
    g.strokeStyle = rim;
    g.lineWidth = 4;
    g.beginPath();
    if (kind === 0) {
      g.moveTo(x - 70, y + 20);
      g.lineTo(x - 20, y - 10);
      g.lineTo(x + 40, y);
    } else if (kind === 1) g.arc(x, y + 70, 66, Math.PI * 1.1, Math.PI * 1.7);
    else g.arc(x, y + 60, 36, Math.PI * 1.1, Math.PI * 1.6);
    g.stroke();
  }
  // areia em primeiro plano
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(0, FH);
  for (let x = 0; x <= FW; x += 100) g.lineTo(x, 300 + Math.sin(x * 0.004) * 30 + hash(x) * 10);
  g.lineTo(FW, FH);
  g.fill();
  return c;
}

function drawFg(ctx: CanvasRenderingContext2D, camX: number): void {
  fgC ??= makeFg();
  ctx.drawImage(fgC, -FW / 2 + camX * 0.25, FRONT_Y + 40, FW, FH);
}

// ───────────────────────── areia a voar ─────────────────────────

function overlay(ctx: CanvasRenderingContext2D, w: number, h: number, camX: number, zoom: number, t: number, hype: number, low: boolean): void {
  const gust = 0.55 + 0.45 * Math.sin(t * 0.37) * Math.sin(t * 0.11 + 1);
  const prev = ctx.globalCompositeOperation;
  // nuvens de poeira baixas
  ctx.globalCompositeOperation = 'lighter';
  const dust = glowSprite('#ffb878');
  const nd = low ? 2 : 4;
  for (let i = 0; i < nd; i++) {
    const sp = 60 + i * 25;
    const px = w + 300 - ((t * sp * (0.7 + gust * 0.6) + i * 523 + camX * zoom * 0.3) % (w + 600));
    ctx.globalAlpha = 0.07 + gust * 0.05;
    ctx.drawImage(dust, px - w * 0.3, h * (0.55 + i * 0.1) - h * 0.15, w * 0.6, h * 0.3);
  }
  ctx.globalCompositeOperation = prev;
  // grãos de areia levados pelo vento
  const n = low ? 30 : 90;
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const sp = 380 + hash(i * 3.7) * 500;
    const life = (t * sp * (0.6 + gust * 0.7) + hash(i * 1.3) * 5000 + camX * zoom * 0.8) % (w + 200);
    const px = w + 100 - life;
    const py = h * (0.2 + hash(i * 5.1) * 0.85) + Math.sin(t * 2 + i) * 8 + life * 0.06;
    const len = (10 + hash(i * 2.2) * 26) * (0.6 + gust);
    ctx.globalAlpha = (0.25 + hash(i * 8.8) * 0.4) * (0.5 + gust * 0.5);
    ctx.strokeStyle = i % 3 ? '#ffd9a0' : '#e8a060';
    ctx.lineWidth = 1 + hash(i * 6.6) * 1.6;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + len, py - len * 0.08);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = prev;
}

export const DESERT: ArenaTheme = {
  ropes: ['#c4302b', '#e8b23a', '#1aa9a0'],
  ropeDark: ['#7a1414', '#9a6a10', '#0c5f5a'],
  post: {
    stops: [[0, '#4a2a10'], [0.3, '#c8913f'], [0.45, '#ffe6a8'], [0.6, '#b07a30'], [1, '#3a220e']],
    pads: ['#d23a2c', '#1f6fd0'],
    padDark: ['#8a1a14', '#123f86'],
    buckle: '#e8b23a',
    cap: '#ffd77a',
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
  haze: '#b86a48',
  previewX: 1230,
  pool: '#fff0c8',
  tint: 'rgba(40,8,24,0.16)',
};
