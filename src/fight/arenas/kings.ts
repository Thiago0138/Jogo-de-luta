import { glowSprite } from '../../render/fighter';
import { hash } from '../fx';
import {
  BACK_X, BACK_Y, BW, BH, FRONT_X, FRONT_Y, OUT, SKIRT_H, SKIRT_W, TEAM_COLORS, backdropRect, crownPath, hazeFill, inked, makeLayer, matFinish, matShell,
  matW, mk, onMat, pick, ringVignette, shaft, shaftSprite, skirtShell, starPath, streakSprite, vgrad, type ArenaTheme, type Layer,
} from '../arenaKit';
import { buildCrowd, drawCrowd, drawCrowdLights, type Crowd } from '../crowd';

/** Kings Arena — o pavilhão original: bancadas cheias, ecrã gigante, treliça de luzes e palco de entrada. */

const SHIRTS = [
  '#e63946', '#f1c40f', '#3498db', '#2ecc71', '#9b59b6', '#ecf0f1', '#e67e22', '#1abc9c', '#ff6fb5', '#34495e', '#2f7bff', '#222831', '#f5f0e1', '#c0392b',
];
const SKINS = ['#f6c9a4', '#e8b083', '#b9774c', '#6e3f28', '#d29466', '#94593a'];
/** Entrada dos lutadores (palco + rampa) e corredores das bancadas, em coordenadas do fundo. */
const STAGE_X = 820;
const STAGE_HW = 132;
const AISLES = [380, 1090, 1530, 2230];
const TRUSS_LIGHTS: number[] = [];
for (let x = 140; x < BW; x += 165) TRUSS_LIGHTS.push(x);

// ── estrutura estática da arena ──

function drawRafters(g: CanvasRenderingContext2D): void {
  g.strokeStyle = '#18122b';
  g.lineWidth = 12;
  g.beginPath();
  g.moveTo(0, 12);
  g.lineTo(BW, 12);
  g.moveTo(0, 44);
  g.lineTo(BW, 44);
  g.stroke();
  g.lineWidth = 4;
  g.beginPath();
  for (let x = 0; x < BW; x += 110) {
    g.moveTo(x, 12);
    g.lineTo(x + 55, 44);
    g.lineTo(x + 110, 12);
  }
  g.stroke();
  g.strokeStyle = 'rgba(150,120,230,0.16)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(0, 7);
  g.lineTo(BW, 7);
  g.moveTo(0, 39);
  g.lineTo(BW, 39);
  g.stroke();
}

function drawUpperTier(g: CanvasRenderingContext2D): void {
  const [c, u] = mk(BW, 110);
  u.translate(0, -120);
  for (let r = 0; r < 3; r++) {
    const s = 0.3 + r * 0.06;
    const y = 150 + r * 22;
    for (let x = hash(r * 5) * 20, i = 0; x < BW; x += 22 * s * 1.6 + hash(i + r * 77) * 8, i++) {
      u.fillStyle = pick(SHIRTS, hash(i * 3.3 + r));
      u.beginPath();
      u.ellipse(x, y + 22 * s, 16 * s, 12 * s, 0, Math.PI, 0);
      u.fill();
      u.fillStyle = pick(SKINS, hash(i * 1.9 + r));
      u.beginPath();
      u.arc(x, y + 4 * s, 9 * s, 0, Math.PI * 2);
      u.fill();
    }
    hazeFill(u, 0.3);
  }
  hazeFill(u, 0.35);
  u.globalCompositeOperation = 'source-over';
  u.fillStyle = '#e8f4ff';
  for (let i = 0; i < 60; i++) u.fillRect(hash(i * 13.1) * BW, 150 + hash(i * 3.7) * 60, 2, 3);
  g.drawImage(c, 0, 120);
  // fachada da bancada superior com fita de LED
  g.fillStyle = '#0b0714';
  g.fillRect(0, 214, BW, 16);
  g.fillStyle = 'rgba(255,79,216,0.55)';
  g.font = '11px "Luckiest Guy", Impact, sans-serif';
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  for (let x = 6; x < BW; x += 230) g.fillText('★ KINGS OF THE RING ★ FIGHT NIGHT', x, 223);
  g.fillStyle = 'rgba(255,255,255,0.08)';
  g.fillRect(0, 214, BW, 1.5);
}

function drawBanners(g: CanvasRenderingContext2D): void {
  const cols = ['#c4122c', '#1a4fc4', '#d9a21b', '#6b2fb3'];
  const xs = [150, 420, 650, 1950, 2180, 2450];
  xs.forEach((bx, k) => {
    const col = cols[k % cols.length];
    const top = 26;
    const h = 118 + (k % 2) * 16;
    g.fillStyle = '#4a4560';
    g.fillRect(bx - 40, top - 4, 80, 6);
    g.beginPath();
    g.moveTo(bx - 34, top);
    g.lineTo(bx + 34, top);
    g.lineTo(bx + 34, top + h);
    g.lineTo(bx, top + h - 18);
    g.lineTo(bx - 34, top + h);
    g.closePath();
    inked(g, col, 3);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(bx + 6, top + 2, 27, h - 20);
    g.strokeStyle = '#ffd23d';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(bx - 28, top + 8);
    g.lineTo(bx - 28, top + h - 14);
    g.moveTo(bx + 28, top + 8);
    g.lineTo(bx + 28, top + h - 14);
    g.stroke();
    crownPath(g, bx, top + 46, 34, 22);
    inked(g, '#ffd23d', 2.5);
    g.fillStyle = '#ffffff';
    g.font = '13px "Luckiest Guy", Impact, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('CHAMPS', bx, top + 66);
    g.fillText(String(2019 + k), bx, top + 82);
  });
  // escurece (estão longe e fora dos holofotes)
  g.fillStyle = 'rgba(10,5,24,0.35)';
  for (const bx of xs) g.fillRect(bx - 38, 18, 76, 140);
}

function drawTruss(g: CanvasRenderingContext2D): void {
  const metal = g.createLinearGradient(0, 56, 0, 86);
  metal.addColorStop(0, '#5b5474');
  metal.addColorStop(0.5, '#2b2440');
  metal.addColorStop(1, '#17122a');
  g.strokeStyle = metal;
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(0, 60);
  g.lineTo(BW, 60);
  g.moveTo(0, 84);
  g.lineTo(BW, 84);
  g.stroke();
  g.lineWidth = 2.5;
  g.beginPath();
  for (let x = 0; x < BW; x += 36) {
    g.moveTo(x, 60);
    g.lineTo(x + 18, 84);
    g.lineTo(x + 36, 60);
  }
  g.stroke();
  g.strokeStyle = 'rgba(210,200,255,0.25)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(0, 58);
  g.lineTo(BW, 58);
  g.moveTo(0, 82);
  g.lineTo(BW, 82);
  g.stroke();
  const tints = ['#fff4d6', '#ffd0f0', '#fff4d6', '#cfe6ff'];
  TRUSS_LIGHTS.forEach((x, k) => {
    g.beginPath();
    g.roundRect(x - 12, 84, 24, 20, 4);
    inked(g, '#2a2438', 2.5);
    g.fillStyle = '#141020';
    g.fillRect(x - 15, 86, 3, 12);
    g.fillRect(x + 12, 86, 3, 12);
    g.beginPath();
    g.ellipse(x, 104, 10, 4.5, 0, 0, Math.PI * 2);
    inked(g, tints[k % 4], 2);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.7;
    g.drawImage(glowSprite(tints[k % 4]), x - 34, 76, 68, 60);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  });
}

function drawJumbotron(g: CanvasRenderingContext2D): void {
  const jx = BW / 2;
  const jw = 540;
  const jh = 118;
  const jy = 100;
  g.strokeStyle = '#3d3656';
  g.lineWidth = 3;
  g.beginPath();
  for (const ox of [-220, -80, 80, 220]) {
    g.moveTo(jx + ox, 84);
    g.lineTo(jx + ox, jy - 8);
  }
  g.stroke();
  // ecrãs laterais (uma cor por equipa)
  for (const side of [-1, 1]) {
    const cx = jx + side * (jw / 2 + 92);
    g.beginPath();
    g.roundRect(cx - 66, jy + 10, 132, 92, 8);
    inked(g, '#1e1a2c', 3);
    const sg = g.createLinearGradient(0, jy + 16, 0, jy + 96);
    sg.addColorStop(0, side < 0 ? '#ff5468' : '#4a8cff');
    sg.addColorStop(1, side < 0 ? '#5c0816' : '#0c2466');
    g.fillStyle = sg;
    g.fillRect(cx - 58, jy + 18, 116, 76);
    g.fillStyle = '#ffffff';
    g.font = '20px "Luckiest Guy", Impact, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(side < 0 ? 'RED' : 'BLUE', cx, jy + 72);
    crownPath(g, cx, jy + 52, 34, 20);
    inked(g, '#ffd23d', 2);
  }
  // moldura metálica
  const fr = g.createLinearGradient(0, jy - 10, 0, jy + jh + 14);
  fr.addColorStop(0, '#5c5677');
  fr.addColorStop(0.15, '#2a2540');
  fr.addColorStop(1, '#0f0c18');
  g.beginPath();
  g.roundRect(jx - jw / 2 - 14, jy - 10, jw + 28, jh + 30, 12);
  inked(g, fr, 4);
  // ecrã
  const sg = g.createLinearGradient(jx - jw / 2, jy, jx + jw / 2, jy + jh);
  sg.addColorStop(0, '#2a0b4a');
  sg.addColorStop(0.5, '#a3123a');
  sg.addColorStop(1, '#ff8a00');
  g.fillStyle = sg;
  g.fillRect(jx - jw / 2, jy, jw, jh);
  g.save();
  g.beginPath();
  g.rect(jx - jw / 2, jy, jw, jh);
  g.clip();
  g.fillStyle = 'rgba(255,255,255,0.07)';
  for (let k = 0; k < 12; k++) {
    const a0 = (k / 12) * Math.PI * 2;
    g.beginPath();
    g.moveTo(jx, jy + 46);
    g.lineTo(jx + Math.cos(a0) * 600, jy + 46 + Math.sin(a0) * 600);
    g.lineTo(jx + Math.cos(a0 + 0.22) * 600, jy + 46 + Math.sin(a0 + 0.22) * 600);
    g.closePath();
    g.fill();
  }
  crownPath(g, jx, jy + 46, 64, 32);
  inked(g, '#ffd23d', 4);
  g.font = '44px "Luckiest Guy", Impact, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = 8;
  g.strokeStyle = OUT;
  g.strokeText('KINGS OF THE RING', jx, jy + 76);
  g.fillStyle = '#ffffff';
  g.fillText('KINGS OF THE RING', jx, jy + 76);
  g.font = '15px "Luckiest Guy", Impact, sans-serif';
  g.fillStyle = '#ffd23d';
  g.fillText('FIGHT NIGHT  •  LIVE', jx, jy + 104);
  g.fillStyle = 'rgba(0,0,0,0.16)';
  for (let yy = jy; yy < jy + jh; yy += 3) g.fillRect(jx - jw / 2, yy, jw, 1);
  g.fillStyle = 'rgba(255,255,255,0.07)';
  g.beginPath();
  g.moveTo(jx - jw / 2, jy);
  g.lineTo(jx - jw / 2 + 200, jy);
  g.lineTo(jx - jw / 2 + 80, jy + jh);
  g.lineTo(jx - jw / 2, jy + jh);
  g.closePath();
  g.fill();
  g.restore();
  // fita de LED por baixo
  for (let k = 0; k < 54; k++) {
    g.fillStyle = `hsl(${(k * 13) % 360} 90% 60%)`;
    g.fillRect(jx - jw / 2 - 8 + k * ((jw + 16) / 54), jy + jh + 8, (jw + 16) / 54 - 3, 5);
  }
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.3;
  g.drawImage(glowSprite('#ff5a8a'), jx - 420, jy - 90, 840, 320);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}

function drawStands(g: CanvasRenderingContext2D): void {
  for (let r = 0; r < 8; r++) {
    const yb = 232 + r * 60 + 36;
    g.fillStyle = `rgba(140,100,230,${0.03 + r * 0.006})`;
    g.fillRect(0, yb, BW, 16);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillRect(0, yb + 16, BW, 5);
  }
  // corredores com escadas e corrimão
  for (const a of AISLES) {
    g.fillStyle = '#120a20';
    g.fillRect(a - 22, 230, 44, 450);
    for (let y = 240; y < 680; y += 30) {
      g.fillStyle = 'rgba(255,255,255,0.05)';
      g.fillRect(a - 22, y, 44, 3);
      g.fillStyle = '#ffb347';
      g.fillRect(a - 18, y + 1, 3, 2);
      g.fillRect(a + 15, y + 1, 3, 2);
    }
    g.strokeStyle = '#4c4766';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(a, 236);
    g.lineTo(a, 680);
    g.stroke();
  }
}

/** Palco e rampa de entrada (do lado esquerdo das bancadas). */
function drawStage(g: CanvasRenderingContext2D): void {
  const sx = STAGE_X;
  const top = 236;
  const bottom = 680;
  // paredes do túnel
  g.fillStyle = '#0c0717';
  g.fillRect(sx - 122, top + 120, 244, bottom - top - 120);
  // torres de treliça
  for (const side of [-1, 1]) {
    const tx = sx + side * 128;
    g.fillStyle = '#1d1830';
    g.fillRect(tx - 8, top - 16, 16, bottom - top + 16);
    g.strokeStyle = '#3c3558';
    g.lineWidth = 2;
    g.beginPath();
    for (let y = top - 16; y < bottom; y += 20) {
      g.moveTo(tx - 8, y);
      g.lineTo(tx + 8, y + 20);
      g.moveTo(tx + 8, y);
      g.lineTo(tx - 8, y + 20);
    }
    g.stroke();
    g.strokeStyle = OUT;
    g.strokeRect(tx - 8, top - 16, 16, bottom - top + 16);
  }
  g.fillStyle = '#1d1830';
  g.fillRect(sx - 136, top - 20, 272, 12);
  // ecrã LED do palco
  g.beginPath();
  g.roundRect(sx - 114, top, 228, 116, 6);
  inked(g, '#0d0a16', 3);
  const lg = g.createLinearGradient(0, top + 6, 0, top + 110);
  lg.addColorStop(0, '#3b0a6e');
  lg.addColorStop(1, '#e0145a');
  g.fillStyle = lg;
  g.fillRect(sx - 108, top + 6, 216, 104);
  crownPath(g, sx, top + 58, 72, 36);
  inked(g, '#ffd23d', 4);
  g.font = '30px "Luckiest Guy", Impact, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 6;
  g.strokeStyle = OUT;
  g.strokeText('KOTR', sx, top + 86);
  g.fillStyle = '#ffffff';
  g.fillText('KOTR', sx, top + 86);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  for (let y = top + 6; y < top + 110; y += 3) g.fillRect(sx - 108, y, 216, 1);
  // abertura do túnel com fumo iluminado
  const ay = top + 160;
  const tb = 600;
  g.beginPath();
  g.moveTo(sx - 64, tb);
  g.lineTo(sx - 64, ay + 30);
  g.quadraticCurveTo(sx - 64, ay, sx - 34, ay);
  g.lineTo(sx + 34, ay);
  g.quadraticCurveTo(sx + 64, ay, sx + 64, ay + 30);
  g.lineTo(sx + 64, tb);
  g.closePath();
  const tg = g.createRadialGradient(sx, tb - 20, 10, sx, tb - 40, 200);
  tg.addColorStop(0, '#e6d6ff');
  tg.addColorStop(0.35, '#8a5ad6');
  tg.addColorStop(1, '#1a0f30');
  g.fillStyle = tg;
  g.fill();
  g.strokeStyle = '#ff4fd8';
  g.lineWidth = 4;
  g.stroke();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.45;
  g.drawImage(glowSprite('#ff4fd8'), sx - 120, ay - 50, 240, 220);
  g.drawImage(glowSprite('#ffffff'), sx - 90, tb - 70, 180, 110);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  // rampa até à barreira
  g.beginPath();
  g.moveTo(sx - 64, tb);
  g.lineTo(sx + 64, tb);
  g.lineTo(sx + 112, bottom + 10);
  g.lineTo(sx - 112, bottom + 10);
  g.closePath();
  const rg = g.createLinearGradient(0, tb, 0, bottom);
  rg.addColorStop(0, '#2a2140');
  rg.addColorStop(1, '#141022');
  inked(g, rg, 3);
  g.beginPath();
  g.moveTo(sx - 20, tb);
  g.lineTo(sx + 20, tb);
  g.lineTo(sx + 38, bottom + 10);
  g.lineTo(sx - 38, bottom + 10);
  g.closePath();
  g.fillStyle = '#8e1622';
  g.fill();
  g.strokeStyle = '#3ad8ff';
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(sx - 64, tb);
  g.lineTo(sx - 112, bottom + 10);
  g.moveTo(sx + 64, tb);
  g.lineTo(sx + 112, bottom + 10);
  g.stroke();
  for (const side of [-1, 1]) {
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.6;
    g.drawImage(glowSprite('#3ad8ff'), sx + side * 88 - 30, bottom - 70, 60, 90);
    g.drawImage(glowSprite('#fff4d6'), sx + side * 128 - 26, top - 40, 52, 52);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }
}

function makeBackdrop(): HTMLCanvasElement {
  const [c, g] = mk(BW, BH);
  const bg = g.createLinearGradient(0, 0, 0, BH);
  bg.addColorStop(0, '#04020a');
  bg.addColorStop(0.3, '#120a24');
  bg.addColorStop(0.7, '#1d1034');
  bg.addColorStop(1, '#26153d');
  g.fillStyle = bg;
  g.fillRect(0, 0, BW, BH);
  // bloom quente atrás do ringue (as bancadas apanham a luz que transborda do ringue)
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.32;
  g.drawImage(glowSprite('#6a2fb0'), BW / 2 - 1150, 160, 2300, 900);
  g.globalAlpha = 0.16;
  g.drawImage(glowSprite('#ff7a3d'), BW / 2 - 650, 400, 1300, 520);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  drawRafters(g);
  drawUpperTier(g);
  drawBanners(g);
  drawTruss(g);
  drawJumbotron(g);
  drawStands(g);
  drawStage(g);
  return c;
}

/** Barreira das bancadas + mesa dos comentadores (à frente do público, desenhada por cima das camadas). */
function makeBarrier(): Layer {
  return makeLayer(630, BH, 0.6, '', (g) => {
    const by = 676;
    const labels = ['FIGHT!', 'KOTR ♛', 'LIVE'];
    const cols = ['#c4122c', '#1a3b9c', '#1b1428'];
    for (let x = -40, k = 0; x < BW; x += 150, k++) {
      if (Math.abs(x + 75 - STAGE_X) < 125) continue;
      g.beginPath();
      g.roundRect(x + 4, by + 10, 142, 70, 6);
      inked(g, cols[k % 3], 3);
      g.fillStyle = 'rgba(255,255,255,0.14)';
      g.fillRect(x + 10, by + 14, 130, 4);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(x + 6, by + 56, 138, 22);
      g.font = '24px "Luckiest Guy", Impact, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineJoin = 'round';
      g.lineWidth = 5;
      g.strokeStyle = OUT;
      g.strokeText(labels[k % 3], x + 75, by + 42);
      g.fillStyle = k % 3 === 2 ? '#ffd23d' : '#ffffff';
      g.fillText(labels[k % 3], x + 75, by + 42);
      // poste e grampo metálico
      g.fillStyle = '#9a9db0';
      g.fillRect(x - 3, by - 2, 6, 84);
      g.strokeStyle = OUT;
      g.lineWidth = 2;
      g.strokeRect(x - 3, by - 2, 6, 84);
    }
    // corrimão de cima (aberto na rampa)
    const rail = g.createLinearGradient(0, by - 4, 0, by + 8);
    rail.addColorStop(0, '#e6e8f0');
    rail.addColorStop(0.5, '#8d909c');
    rail.addColorStop(1, '#3a3c48');
    for (const [a, b] of [[0, STAGE_X - 118], [STAGE_X + 118, BW]]) {
      g.beginPath();
      g.rect(a, by - 4, b - a, 10);
      inked(g, rail, 2);
    }
    // mesa dos comentadores, junto ao ringue (lado direito)
    const ax = BW / 2 + 640;
    for (const ox of [-56, 56]) {
      const hx = ax + ox;
      g.beginPath();
      g.moveTo(hx - 30, 720);
      g.quadraticCurveTo(hx - 30, 680, hx - 10, 678);
      g.lineTo(hx + 10, 678);
      g.quadraticCurveTo(hx + 30, 680, hx + 30, 720);
      g.closePath();
      inked(g, '#1d1a2a', 3);
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.moveTo(hx - 5, 679);
      g.lineTo(hx, 692);
      g.lineTo(hx + 5, 679);
      g.fill();
      g.beginPath();
      g.arc(hx, 662, 13, 0, Math.PI * 2);
      inked(g, pick(SKINS, hash(ox)), 3);
      g.beginPath();
      g.arc(hx, 660, 15, Math.PI * 1.05, Math.PI * 1.95);
      g.strokeStyle = '#2a2a33';
      g.lineWidth = 3.5;
      g.stroke();
      g.fillStyle = '#2a2a33';
      g.fillRect(hx - 17, 657, 6, 10);
      g.fillRect(hx + 11, 657, 6, 10);
      g.beginPath();
      g.moveTo(hx + 14, 664);
      g.quadraticCurveTo(hx + 12, 672, hx + 4, 670);
      g.stroke();
      // monitor (visto de trás) com luz azul na cara
      g.beginPath();
      g.rect(hx - 20, 690, 40, 26);
      inked(g, '#141220', 2.5);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.35;
      g.drawImage(glowSprite('#6fb6ff'), hx - 30, 640, 60, 60);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }
    g.beginPath();
    g.rect(ax - 130, 712, 260, 10);
    inked(g, '#2d2840', 2.5);
    const tf = g.createLinearGradient(0, 722, 0, 760);
    tf.addColorStop(0, '#221a38');
    tf.addColorStop(1, '#0d0918');
    g.beginPath();
    g.rect(ax - 124, 722, 248, 38);
    inked(g, tf, 3);
    g.strokeStyle = '#e63946';
    g.lineWidth = 2;
    g.strokeRect(ax - 116, 727, 232, 28);
    g.font = '18px "Luckiest Guy", Impact, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#ffd23d';
    g.fillText('KOTR  •  TV', ax, 742);
  });
}


// ───────────────────────── fundo em ecrã ─────────────────────────

let backdrop: HTMLCanvasElement | null = null;
let crowd: Crowd | null = null;
let barrier: Layer | null = null;
const BEAM_COLS = ['#ff5a96', '#5aa8ff', '#ffdc78', '#a05aff'];

function prepare(): void {
  if (backdrop) return;
  backdrop = makeBackdrop();
  crowd = buildCrowd({ rows: [0, 7], blocked: (x, r) => Math.abs(x - STAGE_X) < STAGE_HW + 14 || AISLES.some((a) => Math.abs(x - a) < 20 + 10 * (0.62 + r * 0.06)) });
  barrier = makeBarrier();
}

function drawBack(ctx: CanvasRenderingContext2D, w: number, h: number, camX: number, zoom: number, horizonY: number, t: number, hype: number, low: boolean): void {
  prepare();
  const R = backdropRect(w, camX, zoom, horizonY);
  const { x, y, s, dw, dh } = R;
  ctx.fillStyle = '#04020a';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(backdrop!, x, y, dw, dh);
  drawCrowd(ctx, crowd!, x, y, s, dw, t, hype);
  ctx.drawImage(barrier!.c, x, y + barrier!.y0 * s, dw, barrier!.h * s);
  // fita de LED animada no topo da barreira (persegue-se ao ritmo do público)
  const by = y + 671 * s;
  const seg = 22 * s;
  const n = Math.ceil(dw / seg);
  const i0 = Math.max(0, Math.floor(-x / seg));
  const i1 = Math.min(n, Math.ceil((w - x) / seg));
  const sp = t * (40 + hype * 120);
  for (let i = i0; i < i1; i++) {
    const bx = x + i * seg;
    const sx = (bx - x) / s;
    if (Math.abs(sx - STAGE_X) < 118) continue;
    const k = 0.5 + 0.5 * Math.sin(i * 0.45 - sp * 0.1);
    ctx.fillStyle = `hsl(${(330 + k * 60 + (i % 2) * 20) % 360} 95% ${45 + k * 30}%)`;
    ctx.fillRect(bx + 1, by, seg - 2, 4 * s);
  }
  ringVignette(ctx, w, camX, zoom, horizonY);

  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  // brilho da fita de LED nas primeiras filas
  ctx.globalAlpha = 0.18 + hype * 0.12;
  ctx.drawImage(glowSprite('#ff4fa8'), x + dw * 0.2, by - 40 * s, dw * 0.6, 70 * s);
  // flashes de câmaras
  const nFlash = low ? 2 : 6;
  for (let i = 0; i < nFlash; i++) {
    const k = Math.floor(t * (1.5 + hype * 4) + i * 0.37);
    if (hash(k * 7 + i) > 0.25 + (1 - hype) * 0.4) continue;
    const fx = x + hash(k * 3 + i * 11) * dw;
    const fy = y + (250 + hash(k * 5 + i) * 400) * s;
    const a = 1 - ((t * (1.5 + hype * 4) + i * 0.37) % 1);
    ctx.globalAlpha = a * a;
    const r = 40 * s;
    ctx.drawImage(glowSprite('#ffffff'), fx - r, fy - r, r * 2, r * 2);
    if (!low && a > 0.6) {
      ctx.globalAlpha = (a - 0.6) * 1.5;
      ctx.drawImage(streakSprite(), fx - 70 * s, fy - 3 * s, 140 * s, 6 * s);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = prev;
  drawCrowdLights(ctx, crowd!, x, y, s, t, low);
  ctx.globalCompositeOperation = 'lighter';
  if (!low) {
    const vcx = w / 2 - camX * zoom;
    // fachos de luz volumétricos da treliça até ao ringue
    const tx = vcx;
    const ty = horizonY + 70 * zoom;
    const warm = shaftSprite('#fff1d0');
    for (let i = 0; i < TRUSS_LIGHTS.length; i++) {
      const lx = x + TRUSS_LIGHTS[i] * s;
      if (i % 2 || lx < -w * 0.5 || lx > w * 1.5) continue;
      const ly = y + 104 * s;
      const dx = tx + (i % 4 ? 160 : -160) * zoom - lx;
      const dy = ty - ly;
      const len = Math.hypot(dx, dy);
      const fl = 0.9 + 0.1 * Math.sin(t * 7 + i * 1.3);
      shaft(ctx, warm, lx, ly, Math.atan2(-dx, dy), len * 1.05, 260 * zoom, (0.09 + hype * 0.07) * fl);
    }
    // holofotes móveis coloridos
    for (let i = 0; i < 4; i++) {
      const ang = Math.sin(t * 0.35 + i * 1.7) * 0.35;
      const bx = w * (0.12 + i * 0.25);
      shaft(ctx, shaftSprite(BEAM_COLS[i]), bx, -10, ang, h * 1.25, w * 0.26, 0.3 + hype * 0.2);
      ctx.globalAlpha = 0.5 + hype * 0.3;
      ctx.drawImage(glowSprite(BEAM_COLS[i]), bx - 50, -50, 100, 90);
    }
    // reflexos de lente nas luzes da treliça (quando estão no ecrã)
    const sp2 = streakSprite();
    const gl = glowSprite('#fff4d6');
    for (let i = 0; i < TRUSS_LIGHTS.length; i++) {
      const lx = x + TRUSS_LIGHTS[i] * s;
      const ly = y + 104 * s;
      if (ly < -40 || lx < -60 || lx > w + 60) continue;
      const fl = 0.75 + 0.25 * Math.sin(t * 3.1 + i * 2.7);
      ctx.globalAlpha = 0.55 * fl;
      const r = 46 * s;
      ctx.drawImage(gl, lx - r, ly - r, r * 2, r * 2);
      ctx.globalAlpha = 0.35 * fl;
      ctx.drawImage(sp2, lx - 200 * s, ly - 6 * s, 400 * s, 12 * s);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = prev;
}

// ───────────────────────── tapete ─────────────────────────

/** Tapete: lona branca, logótipo dourado ao centro, faixa interior e cantos com a cor da equipa. */
function makeMat(): HTMLCanvasElement {
  const [c, g, W, H] = matShell();
  g.fillStyle = vgrad(g, BACK_Y, FRONT_Y, [[0, '#99a1b6'], [0.55, '#d5dbe7'], [1, '#eef1f7']]);
  g.fillRect(-FRONT_X, BACK_Y, W, H);
  // marcas de uso (pegadas e manchas suaves)
  for (let i = 0; i < 26; i++) {
    const x = (hash(i * 13 + 5) - 0.5) * W * 0.8;
    const y = BACK_Y + 10 + hash(i * 17 + 3) * (H - 20);
    g.fillStyle = 'rgba(70,75,100,0.05)';
    g.beginPath();
    g.ellipse(x, y, 18 + hash(i) * 30, 4 + hash(i * 2) * 5, 0, 0, Math.PI * 2);
    g.fill();
  }
  // faixa interior (a 26 unidades das cordas), vermelha à esquerda e azul à direita
  for (const sx of [-1, 1]) {
    g.strokeStyle = sx < 0 ? 'rgba(214,30,56,0.55)' : 'rgba(40,100,230,0.55)';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(sx * (BACK_X - 30), BACK_Y + 8);
    g.lineTo(sx * (FRONT_X - 40), FRONT_Y - 14);
    g.stroke();
  }
  g.strokeStyle = 'rgba(30,25,60,0.25)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(-(BACK_X - 30), BACK_Y + 8);
  g.lineTo(BACK_X - 30, BACK_Y + 8);
  g.moveTo(-(FRONT_X - 40), FRONT_Y - 14);
  g.lineTo(FRONT_X - 40, FRONT_Y - 14);
  g.stroke();
  // costuras
  g.strokeStyle = 'rgba(70,80,110,0.1)';
  g.lineWidth = 1.4;
  g.beginPath();
  for (let i = -4; i <= 4; i++) {
    g.moveTo(i * (BACK_X / 5), BACK_Y);
    g.lineTo(i * (FRONT_X / 5), FRONT_Y);
  }
  g.stroke();
  // logótipo central: medalhão com coroa e texto à volta (achatado em perspetiva)
  onMat(g, -14, 0.24, () => {
    g.fillStyle = 'rgba(30,20,60,0.12)';
    g.beginPath();
    g.ellipse(0, 14, 196, 196, 0, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 22;
    g.strokeStyle = 'rgba(176,16,40,0.62)';
    g.beginPath();
    g.arc(0, 0, 178, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 5;
    g.strokeStyle = 'rgba(214,160,30,0.75)';
    g.beginPath();
    g.arc(0, 0, 192, 0, Math.PI * 2);
    g.moveTo(164, 0);
    g.arc(0, 0, 164, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.font = '30px "Luckiest Guy", Impact, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const txt = '★ KINGS OF THE RING ★ FIGHT NIGHT ';
    for (let k = 0; k < txt.length; k++) {
      const a = (k / txt.length) * Math.PI * 2 - Math.PI / 2;
      g.save();
      g.translate(Math.cos(a) * 178, Math.sin(a) * 178);
      g.rotate(a + Math.PI / 2);
      g.fillText(txt[k], 0, 1);
      g.restore();
    }
    const disc = g.createRadialGradient(-30, -40, 10, 0, 0, 160);
    disc.addColorStop(0, 'rgba(60,40,120,0.55)');
    disc.addColorStop(1, 'rgba(20,12,48,0.6)');
    g.fillStyle = disc;
    g.beginPath();
    g.arc(0, 0, 158, 0, Math.PI * 2);
    g.fill();
  });
  // a coroa fica "de pé" (menos achatada) para se ler bem
  onMat(g, -16, 0.32, () => {
    const gold = g.createLinearGradient(0, -90, 0, 30);
    gold.addColorStop(0, '#fff3b0');
    gold.addColorStop(0.5, '#f2b52c');
    gold.addColorStop(1, '#a86a10');
    crownPath(g, 0, 34, 170, 108);
    g.globalAlpha = 0.85;
    g.lineJoin = 'round';
    inked(g, gold, 9);
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(214,30,56,0.85)';
    for (const [jx, jy] of [[-48, 4], [0, -10], [48, 4]]) {
      g.beginPath();
      g.arc(jx, jy, 9, 0, Math.PI * 2);
      g.fill();
    }
  });
  // estrelas nos quatro cantos
  for (const [sx, sy] of [[-1, BACK_Y + 22], [1, BACK_Y + 22], [-1, FRONT_Y - 28], [1, FRONT_Y - 28]] as const) {
    onMat(g, sy, 0.3, () => {
      starPath(g, sx * (matW(sy) - 78), 0, 26);
      g.fillStyle = sx < 0 ? 'rgba(214,30,56,0.5)' : 'rgba(40,100,230,0.5)';
      g.fill();
    });
  }
  matFinish(g, { edge: 'rgba(196,18,44,0.92)' });
  // letreiro no bordo da frente
  g.font = '6px "Luckiest Guy", Impact, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(255,240,200,0.85)';
  for (let x = -FRONT_X + 60; x < FRONT_X; x += 160) g.fillText('KINGS OF THE RING  ♛', x, FRONT_Y - 3.2);
  return c;
}

/** Holofotes coloridos que varrem o tapete e brilho dos cantos (vermelho / azul). */
function matFx(ctx: CanvasRenderingContext2D, t: number, hype: number, low: boolean): void {
  if (low) return;
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.22;
  ctx.drawImage(glowSprite('#ff3050'), -BACK_X - 120, BACK_Y - 30, 300, 90);
  ctx.drawImage(glowSprite('#3070ff'), BACK_X - 180, BACK_Y - 30, 300, 90);
  ctx.globalAlpha = 0.16;
  ctx.drawImage(glowSprite('#ff3050'), -FRONT_X - 120, FRONT_Y - 70, 320, 110);
  ctx.drawImage(glowSprite('#3070ff'), FRONT_X - 200, FRONT_Y - 70, 320, 110);
  for (let i = 0; i < 2; i++) {
    const px = Math.sin(t * (0.37 + i * 0.11) + i * 2.3) * 330;
    const py = -18 + Math.sin(t * 0.5 + i * 1.7) * 30;
    ctx.globalAlpha = 0.13 + hype * 0.1;
    ctx.drawImage(glowSprite(i ? '#5aa8ff' : '#ff5a96'), px - 150, py - 34, 300, 68);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = prev;
}

// ───────────────────────── saia e LED ─────────────────────────

let skirtC: HTMLCanvasElement | null = null;
/** Saia acolhoada do ringue: painéis almofadados, medalhões, letreiro e rodapé (sem a fita de LED, que é animada). */
function makeSkirt(): HTMLCanvasElement {
  const [c, g, L] = skirtShell();
  const base = g.createLinearGradient(0, 0, 0, SKIRT_H);
  base.addColorStop(0, '#251a40');
  base.addColorStop(0.6, '#130d22');
  base.addColorStop(1, '#0a0712');
  g.fillStyle = base;
  g.fillRect(L, 0, SKIRT_W, SKIRT_H);
  // painéis almofadados
  const n = 10;
  const pw = SKIRT_W / n;
  const pad = g.createLinearGradient(0, 24, 0, 96);
  pad.addColorStop(0, '#33275a');
  pad.addColorStop(0.45, '#1e1636');
  pad.addColorStop(1, '#100b1e');
  for (let k = 0; k < n; k++) {
    const px = L + k * pw;
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(px - 1.5, 22, 3, 76);
    g.fillStyle = pad;
    g.beginPath();
    g.roundRect(px + 3, 25, pw - 6, 70, 10);
    g.fill();
    g.fillStyle = 'rgba(190,160,255,0.13)';
    g.beginPath();
    g.roundRect(px + 9, 28, pw - 18, 6, 3);
    g.fill();
    // capitonê (botões) e costura em losango
    g.strokeStyle = 'rgba(0,0,0,0.28)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(px + 6, 60);
    g.lineTo(px + pw / 2, 30);
    g.lineTo(px + pw - 6, 60);
    g.lineTo(px + pw / 2, 90);
    g.closePath();
    g.stroke();
    for (const [bx, by] of [[px + pw / 2, 30], [px + pw / 2, 90], [px + 6, 60], [px + pw - 6, 60], [px + pw / 2, 60]]) {
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.beginPath();
      g.arc(bx, by, 1.8, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(200,180,255,0.25)';
      g.fillRect(bx - 0.8, by - 1.8, 1.6, 0.8);
    }
  }
  // medalhões com a coroa (vermelho à esquerda, azul à direita)
  for (const side of [-1, 1]) {
    const mx = side * 372;
    const my = 60;
    const gold = g.createRadialGradient(mx - 8, my - 10, 2, mx, my, 32);
    gold.addColorStop(0, '#fff2b0');
    gold.addColorStop(0.6, '#f0b62e');
    gold.addColorStop(1, '#9a5e12');
    g.beginPath();
    g.arc(mx, my, 31, 0, Math.PI * 2);
    inked(g, gold, 4);
    g.beginPath();
    g.arc(mx, my, 24, 0, Math.PI * 2);
    inked(g, '#1a1030', 2.5);
    g.strokeStyle = TEAM_COLORS[side < 0 ? 0 : 1];
    g.lineWidth = 3;
    g.beginPath();
    g.arc(mx, my, 20, 0, Math.PI * 2);
    g.stroke();
    crownPath(g, mx, my + 9, 26, 18);
    inked(g, '#ffd23d', 2);
  }
  // letreiro central
  g.beginPath();
  g.roundRect(-252, 34, 504, 54, 14);
  g.fillStyle = 'rgba(6,3,14,0.6)';
  g.fill();
  g.strokeStyle = 'rgba(255,210,61,0.55)';
  g.lineWidth = 2;
  g.stroke();
  g.font = '44px "Luckiest Guy", Impact, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = 9;
  g.strokeStyle = OUT;
  g.strokeText('KINGS OF THE RING', 0, 63);
  const tg = g.createLinearGradient(0, 44, 0, 80);
  tg.addColorStop(0, '#fffbe6');
  tg.addColorStop(0.5, '#ffe07a');
  tg.addColorStop(1, '#f29b1d');
  g.fillStyle = tg;
  g.fillText('KINGS OF THE RING', 0, 63);
  for (const sx of [-272, 272]) {
    starPath(g, sx, 61, 11);
    inked(g, '#ffd23d', 2.5);
  }
  // bordo superior do apron (vermelho almofadado) e canal da fita de LED
  const top = g.createLinearGradient(0, 0, 0, 8);
  top.addColorStop(0, '#ff5a6c');
  top.addColorStop(1, '#9c0f22');
  g.fillStyle = top;
  g.fillRect(L, 0, SKIRT_W, 8);
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.fillRect(L, 0, SKIRT_W, 1.2);
  g.fillStyle = '#07050c';
  g.fillRect(L, 8, SKIRT_W, 14);
  g.fillStyle = 'rgba(0,0,0,0.5)';
  g.fillRect(L, 22, SKIRT_W, 3);
  // rodapé
  g.fillStyle = '#0b0812';
  g.fillRect(L, 96, SKIRT_W, 8);
  const bot = g.createLinearGradient(0, 104, 0, 110);
  bot.addColorStop(0, '#e01a36');
  bot.addColorStop(1, '#7a0c1a');
  g.fillStyle = bot;
  g.fillRect(L, 104, SKIRT_W, 6);
  g.fillStyle = '#000';
  g.fillRect(L, 110, SKIRT_W, 2);
  // volume: as pontas da saia ficam na sombra
  const edge = g.createLinearGradient(L, 0, -L, 0);
  edge.addColorStop(0, 'rgba(0,0,0,0.5)');
  edge.addColorStop(0.1, 'rgba(0,0,0,0)');
  edge.addColorStop(0.9, 'rgba(0,0,0,0)');
  edge.addColorStop(1, 'rgba(0,0,0,0.5)');
  g.fillStyle = edge;
  g.fillRect(L, 0, SKIRT_W, SKIRT_H);
  // luz quente do holofote a cair no centro da saia
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.14;
  g.drawImage(glowSprite('#ffe6c0'), -360, -60, 720, 160);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  return c;
}

function skirtFx(ctx: CanvasRenderingContext2D, t: number, hype: number): void {
  // fita de LED animada
  const seg = 26;
  const n = Math.ceil(SKIRT_W / seg);
  const prevOp = ctx.globalCompositeOperation;
  for (let i = 0; i < n; i++) {
    const x = -FRONT_X - 6 + i * seg;
    const h = (i * 14 + t * (60 + hype * 160)) % 360;
    ctx.fillStyle = `hsl(${h} 95% ${50 + hype * 15}%)`;
    ctx.fillRect(x + 2, FRONT_Y + 12, seg - 4, 6);
  }
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.25 + hype * 0.25;
  ctx.fillStyle = '#ff7ad9';
  ctx.fillRect(-FRONT_X - 6, FRONT_Y + 8, SKIRT_W, 14);
  // o LED ilumina o bordo do tapete
  ctx.globalAlpha = 0.2 + hype * 0.15;
  ctx.drawImage(glowSprite('#ff7ad9'), -FRONT_X, FRONT_Y - 14, FRONT_X * 2, 30);
  // reflexo que varre o letreiro de vez em quando
  const gx = ((t * 260) % 2600) - 1300;
  if (Math.abs(gx) < SKIRT_W / 2) {
    ctx.globalAlpha = 0.12;
    ctx.drawImage(glowSprite('#ffffff'), gx - 70, FRONT_Y + 24, 140, 76);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = prevOp;
}

// ───────────────────────── primeiro plano e chão ─────────────────────────

let fgA: HTMLCanvasElement | null = null;
let fgB: HTMLCanvasElement | null = null;
let fgRail: HTMLCanvasElement | null = null;
const FW = 3200;
const FH = 420;

function makeForeground(odd: boolean): HTMLCanvasElement {
  const [c, g] = mk(FW / 2, FH / 2);
  g.scale(0.5, 0.5);
  const body = odd ? '#140c24' : '#1c1131';
  const rim = odd ? 'rgba(120,190,255,0.5)' : 'rgba(255,140,220,0.5)';
  g.lineCap = 'round';
  for (let i = 0, x = 20; x < FW; i++, x += 70 + hash(i * 5) * 40) {
    if ((i % 2 === 1) !== odd) continue;
    const y = 120 + hash(i * 3 + 1) * 40;
    const r = 34 + hash(i * 7) * 12;
    const kind = Math.floor(hash(i * 9.7) * 7);
    const wide = 1.7 + hash(i * 4.1) * 0.5;
    g.fillStyle = body;
    // braço no ar (telemóvel, dedo de espuma ou cartaz)
    const up = hash(i * 11);
    if (up > 0.7) {
      const px = x + (hash(i) - 0.5) * 40;
      g.strokeStyle = body;
      g.lineWidth = 15;
      g.beginPath();
      g.moveTo(x + r * 0.8, y + r * 1.4);
      g.lineTo(px + 10, y - r * 1.3);
      g.stroke();
      if (up > 0.9) {
        // dedo de espuma em contraluz
        g.beginPath();
        g.roundRect(px - 8, y - r * 1.9, 38, 40, 10);
        g.roundRect(px + 3, y - r * 1.9 - 46, 16, 54, 8);
        g.fill();
        g.strokeStyle = rim;
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(px + 4, y - r * 1.9 - 38);
        g.lineTo(px + 4, y - r * 1.9 - 4);
        g.stroke();
      } else if (up > 0.8) {
        // cartaz visto por trás com luz a passar no bordo
        g.fillStyle = '#2a1d24';
        g.fillRect(px - 50, y - r * 2.6, 110, 62);
        g.strokeStyle = 'rgba(255,230,190,0.45)';
        g.lineWidth = 3;
        g.strokeRect(px - 50, y - r * 2.6, 110, 62);
        g.fillStyle = body;
      } else {
        g.fillStyle = '#1a1430';
        g.fillRect(px - 6, y - r * 2.2, 34, 56);
        g.fillStyle = 'rgba(190,220,255,0.85)';
        g.fillRect(px - 2, y - r * 2.2 + 4, 26, 46);
        g.fillStyle = body;
      }
    }
    // ombros
    g.beginPath();
    g.ellipse(x, y + r * 2.3, r * wide, r * 1.5, 0, Math.PI, 0);
    g.lineTo(x + r * wide, FH);
    g.lineTo(x - r * wide, FH);
    g.fill();
    // cabeça e cabelo/chapéu
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    if (kind === 0) g.arc(x, y - r * 0.2, r * 1.3, 0, Math.PI * 2); // afro
    else if (kind === 1) g.arc(x, y - r * 1.05, r * 0.42, 0, Math.PI * 2); // carrapito
    else if (kind === 2) g.ellipse(x + r * 0.7, y - r * 0.35, r * 0.85, r * 0.18, 0, 0, Math.PI * 2); // pala do boné
    else if (kind === 3) g.ellipse(x - r * 0.9, y + r * 0.4, r * 0.3, r * 0.65, 0.3, 0, Math.PI * 2); // rabo de cavalo
    else if (kind === 4) g.ellipse(x, y - r * 0.55, r * 1.55, r * 0.22, 0, 0, Math.PI * 2); // chapéu
    g.fill();
    // luz de recorte (vem do ringue, por cima)
    g.strokeStyle = rim;
    g.lineWidth = 4;
    g.beginPath();
    const rr = kind === 0 ? r * 1.3 : r;
    g.arc(x, y - (kind === 0 ? r * 0.2 : 0), rr - 2, Math.PI * 1.15, Math.PI * 1.8);
    g.stroke();
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(x, y + r * 2.3, r * wide - 2, r * 1.5 - 2, 0, Math.PI * 1.15, Math.PI * 1.45);
    g.stroke();
  }
  return c;
}

/** Barreira à volta do ringue (entre o ringue e a primeira fila). */
function makeRail(): HTMLCanvasElement {
  const [c, g] = mk(FW / 2, 30);
  g.scale(0.5, 0.5);
  const labels = ['FIGHT!', 'KOTR ♛', 'LIVE'];
  const cols = ['#8e1622', '#16307e', '#16101f'];
  for (let x = 0, k = 0; x < FW; x += 200, k++) {
    g.fillStyle = cols[k % 3];
    g.fillRect(x + 3, 10, 194, 50);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(x + 3, 12, 194, 3);
    g.font = '26px "Luckiest Guy", Impact, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.fillText(labels[k % 3], x + 100, 37);
    g.fillStyle = '#6d7080';
    g.fillRect(x - 3, 0, 6, 60);
  }
  const rail = g.createLinearGradient(0, 0, 0, 10);
  rail.addColorStop(0, '#c9ccd6');
  rail.addColorStop(1, '#3a3c48');
  g.fillStyle = rail;
  g.fillRect(0, 0, FW, 10);
  return c;
}

/** Fila de espectadores em silhueta à frente do ringue (dá profundidade). */
function drawFg(ctx: CanvasRenderingContext2D, camX: number, t: number, hype: number): void {
  if (!fgA) {
    fgA = makeForeground(false);
    fgB = makeForeground(true);
    fgRail = makeRail();
  }
  ctx.drawImage(fgRail!, -FW / 2 + camX * 0.12, FRONT_Y + 128, FW, 60);
  const par = camX * 0.25;
  const y0 = FRONT_Y + 30;
  const b1 = Math.abs(Math.sin(t * (5 + hype * 5))) * hype * 16;
  const b2 = Math.abs(Math.sin(t * (5 + hype * 5) + 1.3)) * hype * 16;
  ctx.drawImage(fgB!, -FW / 2 + par, y0 - b2 + 18, FW, FH);
  ctx.drawImage(fgA!, -FW / 2 + par + 35, y0 - b1, FW, FH);
}

let floorC: HTMLCanvasElement | null = null;
/** Chão à volta do ringue: tapete de proteção, cabos e a luz que transborda do ringue. */
function makeFloor(): HTMLCanvasElement {
  const [c, g] = mk(1600, 300);
  g.scale(0.5, 0.5);
  g.translate(1600, 0);
  const base = g.createLinearGradient(0, 0, 0, 600);
  base.addColorStop(0, '#171126');
  base.addColorStop(0.4, '#0b0814');
  base.addColorStop(1, '#07050c');
  g.fillStyle = base;
  g.fillRect(-1600, 0, 3200, 600);
  g.fillStyle = '#10162a';
  g.fillRect(-680, 0, 1360, 200);
  g.fillStyle = 'rgba(90,140,255,0.25)';
  g.fillRect(-680, 198, 1360, 3);
  g.strokeStyle = '#05040a';
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(-900, 30);
  g.bezierCurveTo(-700, 120, -800, 220, -600, 320);
  g.moveTo(820, 10);
  g.bezierCurveTo(700, 140, 900, 260, 760, 400);
  g.stroke();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.3;
  g.drawImage(glowSprite('#7b5cff'), -900, -150, 1800, 330);
  g.globalAlpha = 0.18;
  g.drawImage(glowSprite('#ff7ad9'), -600, -60, 1200, 140);
  return c;
}

function drawFloor(ctx: CanvasRenderingContext2D): void {
  floorC ??= makeFloor();
  ctx.fillStyle = '#07050c';
  ctx.fillRect(-3000, FRONT_Y + 110, 6000, 600);
  ctx.drawImage(floorC, -1600, FRONT_Y + 110, 3200, 600);
}

// ───────────────────────── partículas de luz ─────────────────────────

/** Poeira a brilhar nos holofotes, por cima de tudo. */
function overlay(ctx: CanvasRenderingContext2D, w: number, h: number, _camX: number, _zoom: number, t: number, hype: number, low: boolean): void {
  if (low) return;
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  const g = glowSprite('#fff4d6');
  for (let i = 0; i < 26; i++) {
    const sp = 6 + hash(i * 3.1) * 14;
    const px = (hash(i * 7.7) * w * 1.2 + Math.sin(t * 0.3 + i) * 30) % (w * 1.2) - w * 0.1;
    const py = h - (((t * sp + hash(i * 5.3) * h) % (h * 1.1)));
    const r = 2 + hash(i * 9.1) * 3;
    ctx.globalAlpha = (0.18 + 0.2 * Math.sin(t * 2 + i)) * (0.6 + hype * 0.4);
    if (ctx.globalAlpha <= 0.02) continue;
    ctx.drawImage(g, px - r * 2, py - r * 2, r * 4, r * 4);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = prev;
}

export const KINGS: ArenaTheme = {
  ropes: ['#e63946', '#f1f1f1', '#2f7bff'],
  ropeDark: ['#8e1622', '#9aa0ae', '#163f99'],
  post: {
    stops: [[0, '#20202b'], [0.3, '#6c6f80'], [0.45, '#c9ccd6'], [0.6, '#5a5d6c'], [1, '#16161e']],
    pads: [TEAM_COLORS[0], TEAM_COLORS[1]],
    padDark: ['#9c1424', '#1640a0'],
    buckle: '#8d909c',
    cap: '#d4d7df',
  },
  prepare,
  backdrop: drawBack,
  mat: makeMat,
  matFx,
  skirt: () => (skirtC ??= makeSkirt()),
  skirtFx,
  steps: true,
  floor: drawFloor,
  foreground: drawFg,
  overlay,
  haze: '#8f7ad6',
  pool: '#fff1cf',
  tint: 'rgba(8,4,18,0.28)',
};
