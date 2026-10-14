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

/** Profundidade (0 = poste de trás, 1 = poste da frente) da linha onde os lutadores estão. */
export const ROPE_U = -BACK_Y / (FRONT_Y - BACK_Y);
/** x das cordas laterais na linha dos lutadores. */
export const ROPE_LINE_X = BACK_X + (FRONT_X - BACK_X) * ROPE_U;
const NODES = 15;

/** Uma corda simulada como fio elástico: deslocamento para fora (d) e para baixo (h) em cada nó. */
export interface RopeLine {
  d: Float32Array;
  vd: Float32Array;
  h: Float32Array;
  vh: Float32Array;
  /** Contactos ativos: deslocamento imposto em cada nó e até quando (tempo). */
  hd: Float32Array;
  hh: Float32Array;
  until: Float32Array;
}

export interface RopeState {
  /** Cordas laterais [lado][corda 0..2] e cordas da frente [corda 0..2]. */
  side: RopeLine[][];
  front: RopeLine[];
  t: number;
}

function line(): RopeLine {
  return {
    d: new Float32Array(NODES), vd: new Float32Array(NODES), h: new Float32Array(NODES), vh: new Float32Array(NODES),
    hd: new Float32Array(NODES), hh: new Float32Array(NODES), until: new Float32Array(NODES),
  };
}

export function newRopes(): RopeState {
  return { side: [[line(), line(), line()], [line(), line(), line()]], front: [line(), line(), line()], t: 0 };
}

const TENSION = 2600;
const DAMP = 2.6;

function stepLine(L: RopeLine, dt: number, now: number): void {
  const n = NODES - 1;
  for (let i = 1; i < n; i++) {
    const ad = TENSION * (L.d[i - 1] + L.d[i + 1] - 2 * L.d[i]) - DAMP * L.vd[i] - 14 * L.d[i];
    const ah = TENSION * (L.h[i - 1] + L.h[i + 1] - 2 * L.h[i]) - DAMP * L.vh[i] - 14 * L.h[i];
    L.vd[i] += ad * dt;
    L.vh[i] += ah * dt;
  }
  for (let i = 1; i < n; i++) {
    L.d[i] += L.vd[i] * dt;
    L.h[i] += L.vh[i] * dt;
    if (L.until[i] > now) {
      // o corpo empurra a corda: fica pelo menos tão deslocada como o contacto
      if (L.hd[i] > 0 && L.d[i] < L.hd[i]) {
        L.d[i] += (L.hd[i] - L.d[i]) * 0.6;
        L.vd[i] = Math.max(0, L.vd[i]) * 0.3;
      }
      if (L.hh[i] !== 0 && Math.abs(L.h[i]) < Math.abs(L.hh[i])) {
        L.h[i] += (L.hh[i] - L.h[i]) * 0.6;
        L.vh[i] *= 0.3;
      }
    }
  }
}

export function updateRopes(r: RopeState, dt: number): void {
  r.t += dt;
  const sub = 4;
  const h = Math.min(dt, 0.05) / sub;
  for (let k = 0; k < sub; k++) {
    for (const side of r.side) for (const L of side) stepLine(L, h, r.t);
    for (const L of r.front) stepLine(L, h, r.t);
  }
}

/**
 * Contacto com uma corda lateral: empurra-a para fora (`out`) e/ou para baixo (`down`) à volta
 * da profundidade `u`, durante `life` segundos (renovar a cada frame enquanto dura).
 */
export function ropeHold(r: RopeState, side: 0 | 1, rope: number, out: number, down = 0, u = ROPE_U, width = 0.2, life = 0.06): void {
  const L = r.side[side][rope];
  for (let i = 1; i < NODES - 1; i++) {
    const k = Math.abs(i / (NODES - 1) - u) / width;
    if (k >= 1) continue;
    const w = Math.cos(k * Math.PI * 0.5);
    const f = w * w;
    if (L.until[i] <= r.t) {
      L.hd[i] = 0;
      L.hh[i] = 0;
    }
    L.hd[i] = Math.max(L.hd[i], out * f);
    if (Math.abs(down * f) > Math.abs(L.hh[i])) L.hh[i] = down * f;
    L.until[i] = r.t + life;
  }
}

/** Impulso numa corda lateral (todas as 3 se `rope` < 0): ela abana e as ondas correm até aos postes. */
export function pushRope(r: RopeState, side: 0 | 1, amount: number, rope = -1, up = 0, u = ROPE_U): void {
  for (let j = 0; j < 3; j++) {
    if (rope >= 0 && j !== rope) continue;
    const L = r.side[side][j];
    const k = rope >= 0 ? 1 : [0.65, 1, 0.85][j];
    for (let i = 1; i < NODES - 1; i++) {
      const x = Math.abs(i / (NODES - 1) - u) / 0.22;
      if (x >= 1) continue;
      const f = Math.cos(x * Math.PI * 0.5);
      L.vd[i] += Math.abs(amount) * k * f;
      L.vh[i] -= up * k * f;
    }
  }
}

/** O ringue estremece (queda forte no tapete): todas as cordas vibram um pouco. */
export function ringShake(r: RopeState, power: number): void {
  const all = [...r.side[0], ...r.side[1], ...r.front];
  for (const L of all) {
    for (let i = 1; i < NODES - 1; i++) {
      const f = Math.sin((i / (NODES - 1)) * Math.PI);
      L.vh[i] += power * (40 + Math.random() * 30) * f;
      L.vd[i] += power * (Math.random() - 0.5) * 30 * f;
    }
  }
}

/** Altura (em ecrã) de uma corda lateral na linha dos lutadores, já com a deformação. */
export function ropeHeightAt(r: RopeState, side: 0 | 1, rope: number): number {
  const L = r.side[side][rope];
  const i = Math.round(ROPE_U * (NODES - 1));
  return ROPE_H[rope] * (0.92 + 0.08 * ROPE_U) - L.h[i];
}

// ───────────────────────── Fundo pré-renderizado ─────────────────────────

let backdrop: HTMLCanvasElement | null = null;
let crowdLayers: HTMLCanvasElement[] = [];
let crowdArms: HTMLCanvasElement | null = null;
let phones: { x: number; y: number; p: number }[] = [];
const BW = 2600;
const BH = 760;

const SHIRTS = ['#e63946', '#f1c40f', '#3498db', '#2ecc71', '#9b59b6', '#ecf0f1', '#e67e22', '#1abc9c', '#ff6fb5', '#34495e'];
const SKINS = ['#f6c9a4', '#e8b083', '#b9774c', '#6e3f28', '#d29466', '#94593a'];

const HAIRS = ['#1b1714', '#3a2a1a', '#5a3418', '#e2b44a', '#b8461b', '#8d8f95', '#101010'];
const CROWD_GROUPS = 3;
const CS = 0.5; // as camadas do público são desenhadas a meia resolução (poupança de memória)

interface Spot {
  x: number;
  y: number;
  s: number;
  light: number;
  g: number;
  i: number;
  r: number;
}

/** Posições de todos os espectadores (determinísticas). */
function crowdSpots(): Spot[] {
  const out: Spot[] = [];
  const rows = 8;
  for (let r = 0; r < rows; r++) {
    const s = 0.62 + r * 0.06;
    const y = 232 + r * 60;
    const light = 0.42 + (r / rows) * 0.58;
    let x = -20 + hash(r * 31) * 30;
    let i = 0;
    while (x < BW + 30) {
      out.push({ x, y: y + (hash(r * 97 + i) - 0.5) * 8, s, light, g: Math.floor(hash(i * 13 + r * 7) * CROWD_GROUPS), i: i + r * 1000, r });
      x += (30 + hash(r * 999 + i) * 14) * s * 1.25;
      i++;
    }
  }
  return out;
}

function personBody(g: CanvasRenderingContext2D, p: Spot): void {
  const h = hash(p.i * 1.7);
  const s = p.s;
  const shirt = SHIRTS[Math.floor(hash(p.i * 3.1) * SHIRTS.length)];
  const skin = SKINS[Math.floor(hash(p.i * 5.3) * SKINS.length)];
  const hair = HAIRS[Math.floor(hash(p.i * 7.7) * HAIRS.length)];
  const x = p.x;
  const y = p.y;
  const wide = 0.85 + hash(p.i * 2.3) * 0.4;
  // tronco com ombros
  g.fillStyle = shirt;
  g.beginPath();
  g.moveTo(x - 19 * s * wide, y + 60 * s);
  g.quadraticCurveTo(x - 20 * s * wide, y + 24 * s, x - 9 * s, y + 20 * s);
  g.lineTo(x + 9 * s, y + 20 * s);
  g.quadraticCurveTo(x + 20 * s * wide, y + 24 * s, x + 19 * s * wide, y + 60 * s);
  g.closePath();
  g.fill();
  // sombra na camisola
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.fillRect(x - 19 * s * wide, y + 42 * s, 38 * s * wide, 18 * s);
  // pescoço e cabeça
  g.fillStyle = skin;
  g.fillRect(x - 4 * s, y + 13 * s, 8 * s, 9 * s);
  g.beginPath();
  g.ellipse(x, y + 4 * s, 10.5 * s, 12 * s, 0, 0, Math.PI * 2);
  g.fill();
  // cabelo / chapéus
  const style = Math.floor(h * 7);
  g.fillStyle = hair;
  switch (style) {
    case 0: // curto
      g.beginPath();
      g.ellipse(x, y - 1 * s, 11 * s, 9 * s, 0, Math.PI, 0);
      g.fill();
      break;
    case 1: // comprido
      g.beginPath();
      g.ellipse(x, y + 2 * s, 12.5 * s, 13 * s, 0, Math.PI * 0.95, Math.PI * 0.05);
      g.fill();
      g.fillRect(x - 12.5 * s, y + 2 * s, 5 * s, 17 * s);
      g.fillRect(x + 7.5 * s, y + 2 * s, 5 * s, 17 * s);
      break;
    case 2: // boné
      g.fillStyle = SHIRTS[Math.floor(hash(p.i * 11) * SHIRTS.length)];
      g.beginPath();
      g.ellipse(x, y - 2 * s, 11 * s, 8 * s, 0, Math.PI, 0);
      g.fill();
      g.fillRect(x - 2 * s, y - 3 * s, 15 * s, 3.5 * s);
      break;
    case 3: // afro
      g.beginPath();
      g.arc(x, y - 3 * s, 14 * s, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = skin;
      g.beginPath();
      g.ellipse(x, y + 6 * s, 9 * s, 10 * s, 0, 0, Math.PI * 2);
      g.fill();
      break;
    case 4: // gorro
      g.fillStyle = SHIRTS[Math.floor(hash(p.i * 13) * SHIRTS.length)];
      g.beginPath();
      g.ellipse(x, y - 2 * s, 11.5 * s, 11 * s, 0, Math.PI, 0);
      g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(x, y - 13 * s, 3 * s, 0, Math.PI * 2);
      g.fill();
      break;
    case 5: // careca com brilho
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.beginPath();
      g.ellipse(x - 3 * s, y - 4 * s, 4 * s, 2.5 * s, -0.4, 0, Math.PI * 2);
      g.fill();
      break;
    default: // apanhado
      g.beginPath();
      g.ellipse(x, y - 1 * s, 11 * s, 9 * s, 0, Math.PI, 0);
      g.fill();
      g.beginPath();
      g.arc(x, y - 10 * s, 5 * s, 0, Math.PI * 2);
      g.fill();
  }
  // óculos de vez em quando
  if (hash(p.i * 17) > 0.85) {
    g.fillStyle = '#111';
    g.fillRect(x - 8 * s, y + 2 * s, 16 * s, 3 * s);
  }
}

function personAccessory(g: CanvasRenderingContext2D, p: Spot, armsUp: boolean): void {
  const s = p.s;
  const x = p.x;
  const y = p.y;
  const shirt = SHIRTS[Math.floor(hash(p.i * 3.1) * SHIRTS.length)];
  const skin = SKINS[Math.floor(hash(p.i * 5.3) * SKINS.length)];
  const k = hash(p.i * 19);
  g.lineCap = 'round';
  if (armsUp) {
    // braços no ar (aparecem mais quando o público está ao rubro)
    g.strokeStyle = shirt;
    g.lineWidth = 7 * s;
    const sp = 6 + hash(p.i * 23) * 8;
    g.beginPath();
    g.moveTo(x - 14 * s, y + 26 * s);
    g.lineTo(x - (18 + sp) * s, y - 22 * s);
    g.moveTo(x + 14 * s, y + 26 * s);
    g.lineTo(x + (18 + sp) * s, y - 24 * s);
    g.stroke();
    g.fillStyle = skin;
    g.beginPath();
    g.arc(x - (18 + sp) * s, y - 25 * s, 4.5 * s, 0, Math.PI * 2);
    g.arc(x + (18 + sp) * s, y - 27 * s, 4.5 * s, 0, Math.PI * 2);
    g.fill();
    return;
  }
  if (k < 0.05) {
    // cartaz
    const words = ['WOW!', 'K.O.!', '10/10', 'LEGEND', 'POWER', '♥ RING', 'GO!', 'CHAMP'];
    g.fillStyle = '#ffffff';
    g.fillRect(x - 28 * s, y - 44 * s, 56 * s, 30 * s);
    g.strokeStyle = '#3a2a1a';
    g.lineWidth = 3 * s;
    g.beginPath();
    g.moveTo(x, y - 14 * s);
    g.lineTo(x, y + 20 * s);
    g.stroke();
    g.fillStyle = SHIRTS[p.i % SHIRTS.length];
    g.font = `bold ${Math.round(12 * s)}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(words[p.i % words.length], x, y - 29 * s);
  } else if (k < 0.09) {
    // dedo de espuma
    g.fillStyle = hash(p.i) > 0.5 ? '#ffd23d' : '#ff3d6e';
    g.beginPath();
    g.roundRect(x + 8 * s, y - 18 * s, 18 * s, 22 * s, 5 * s);
    g.fill();
    g.fillRect(x + 13 * s, y - 40 * s, 8 * s, 24 * s);
  } else if (k < 0.13) {
    // bandeira
    g.strokeStyle = '#cfcfcf';
    g.lineWidth = 2 * s;
    g.beginPath();
    g.moveTo(x - 12 * s, y + 20 * s);
    g.lineTo(x - 12 * s, y - 40 * s);
    g.stroke();
    g.fillStyle = hash(p.i * 3) > 0.5 ? '#ff3b4e' : '#2f7bff';
    g.fillRect(x - 12 * s, y - 40 * s, 26 * s, 16 * s);
  }
}

/** Camada de um grupo do público (meia resolução). */
function makeCrowdLayer(spots: Spot[], group: number, armsUp: boolean): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.round(BW * CS);
  c.height = Math.round(BH * CS);
  const g = c.getContext('2d')!;
  g.scale(CS, CS);
  for (const p of spots) {
    if (armsUp) {
      if (hash(p.i * 29) > 0.45) continue;
    } else if (p.g !== group) continue;
    g.globalAlpha = p.light;
    if (armsUp) personAccessory(g, p, true);
    else {
      personBody(g, p);
      personAccessory(g, p, false);
    }
  }
  g.globalAlpha = 1;
  return softFocus(c);
}

/**
 * Profundidade de campo: o público fica ligeiramente desfocado, menos saturado e mais escuro nas filas de trás,
 * para os lutadores se destacarem (feito uma vez, ao criar as camadas).
 */
function softFocus(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext('2d')!;
  if ('filter' in g) g.filter = 'blur(1.1px) saturate(0.78) brightness(0.92)';
  g.drawImage(src, 0, 0);
  g.filter = 'none';
  g.globalCompositeOperation = 'source-atop';
  const fade = g.createLinearGradient(0, 0, 0, c.height);
  fade.addColorStop(0, 'rgba(10,5,24,0.55)');
  fade.addColorStop(0.55, 'rgba(10,5,24,0.22)');
  fade.addColorStop(1, 'rgba(10,5,24,0.05)');
  g.fillStyle = fade;
  g.fillRect(0, 0, c.width, c.height);
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
  g.fillText('KINGS OF THE RING', BW / 2, 192);
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
  for (let x = 0; x < BW; x += 260) g.fillText('FIGHT!', x + 120, by + 34);
  return c;
}

export function ensureArena(): void {
  if (backdrop) return;
  backdrop = makeBackdrop();
  const spots = crowdSpots();
  crowdLayers = [];
  for (let gi = 0; gi < CROWD_GROUPS; gi++) crowdLayers.push(makeCrowdLayer(spots, gi, false));
  crowdArms = makeCrowdLayer(spots, -1, true);
  phones = spots.filter((p) => hash(p.i * 41) > 0.9).map((p) => ({ x: p.x + 10 * p.s, y: p.y - 6 * p.s, p: hash(p.i * 43) * 10 }));
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
  // cada grupo do público salta com o seu próprio ritmo; os braços sobem com o entusiasmo
  const freq = 3.5 + hype * 6;
  for (let gi = 0; gi < crowdLayers.length; gi++) {
    const b = Math.max(0, Math.sin(t * freq + gi * 2.1)) * (1.5 + hype * 11) * s;
    ctx.drawImage(crowdLayers[gi], x, y - b, dw, dh);
  }
  if (hype > 0.3 && crowdArms) {
    ctx.globalAlpha = Math.min(1, (hype - 0.3) * 2.2);
    ctx.drawImage(crowdArms, x, y - Math.abs(Math.sin(t * freq)) * hype * 9 * s, dw, dh);
    ctx.globalAlpha = 1;
  }

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
  // ecrãs de telemóveis no público
  ctx.fillStyle = '#dff3ff';
  for (const ph of phones) {
    const a = 0.35 + 0.35 * Math.sin(t * 2 + ph.p);
    if (a < 0.1) continue;
    ctx.globalAlpha = a;
    ctx.fillRect(x + ph.x * s, y + ph.y * s, 4 * s, 6 * s);
  }
  ctx.globalAlpha = 1;
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

let skirtGrad: CanvasGradient | null = null;

function rope(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, cx: number, cy: number, color: string) {
  strokeRope(ctx, color, (dy) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1 + dy);
    ctx.quadraticCurveTo(cx, cy + dy, x2, y2 + dy);
  });
}

const ROPE_DARK: Record<string, string> = { '#e63946': '#8e1622', '#f1f1f1': '#9aa0ae', '#2f7bff': '#163f99' };

/** Corda com volume: contorno, cor, lado de baixo na sombra e reflexo do holofote por cima. */
function strokeRope(ctx: CanvasRenderingContext2D, color: string, trace: (dy: number) => void) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  trace(0);
  ctx.lineWidth = 7.5;
  ctx.strokeStyle = '#120a18';
  ctx.stroke();
  ctx.lineWidth = 5;
  ctx.strokeStyle = color;
  ctx.stroke();
  const a = ctx.globalAlpha;
  trace(1.4);
  ctx.lineWidth = 2;
  ctx.strokeStyle = ROPE_DARK[color] ?? '#000';
  ctx.globalAlpha = a * 0.75;
  ctx.stroke();
  trace(-1.3);
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = '#ffffff';
  ctx.globalAlpha = a * 0.65;
  ctx.stroke();
  ctx.globalAlpha = a;
}

/** Desenha uma corda simulada entre dois pontos (só os nós de i0 a i1), com curvas suaves. */
function simRope(
  ctx: CanvasRenderingContext2D, L: RopeLine, x1: number, y1: number, x2: number, y2: number, ox: number, sag: number, color: string, i0 = 0, i1 = NODES - 1,
) {
  const n = NODES - 1;
  const px = (i: number) => x1 + ((x2 - x1) * i) / n + L.d[i] * ox;
  const py = (i: number) => y1 + ((y2 - y1) * i) / n + L.h[i] + Math.sin((i / n) * Math.PI) * sag;
  strokeRope(ctx, color, (dy) => {
    ctx.beginPath();
    ctx.moveTo(px(i0), py(i0) + dy);
    for (let i = i0 + 1; i < i1; i++) {
      const mx = (px(i) + px(i + 1)) / 2;
      const my = (py(i) + py(i + 1)) / 2;
      ctx.quadraticCurveTo(px(i), py(i) + dy, mx, my + dy);
    }
    ctx.lineTo(px(i1), py(i1) + dy);
  });
}

/** Cordas laterais: a parte de trás (até à linha dos lutadores) ou a da frente (por cima deles). */
function sideRopes(ctx: CanvasRenderingContext2D, ropes: RopeState, front: boolean) {
  const split = Math.round(ROPE_U * (NODES - 1));
  for (let side = 0; side < 2; side++) {
    const sx = side ? 1 : -1;
    for (let i = 0; i < 3; i++) {
      const hb = ROPE_H[i] * 0.92;
      const hf = ROPE_H[i];
      simRope(
        ctx, ropes.side[side][i], sx * BACK_X, BACK_Y - hb, sx * FRONT_X, FRONT_Y - hf, sx, 2, ROPE_COLORS[i],
        front ? split : 0, front ? NODES - 1 : split,
      );
    }
  }
}

const ROPE_COLORS = ['#e63946', '#f1f1f1', '#2f7bff'];

const postGrads = new Map<string, CanvasGradient>();
function postGrad(ctx: CanvasRenderingContext2D, x: number, w: number): CanvasGradient {
  const k = `${x}|${w}`;
  let g = postGrads.get(k);
  if (!g) {
    g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    g.addColorStop(0, '#20202b');
    g.addColorStop(0.3, '#6c6f80');
    g.addColorStop(0.45, '#c9ccd6');
    g.addColorStop(0.6, '#5a5d6c');
    g.addColorStop(1, '#16161e');
    postGrads.set(k, g);
  }
  return g;
}

/** Poste metálico com esticadores e almofadas acolchoadas na cor da equipa. */
function post(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, w: number, team: number) {
  ctx.fillStyle = '#0d0a14';
  ctx.fillRect(x - w / 2 - 1.5, y - h - 1.5, w + 3, h + 1.5);
  ctx.fillStyle = postGrad(ctx, x, w);
  ctx.fillRect(x - w / 2, y - h, w, h);
  const c = TEAM_COLORS[team];
  const dark = team === 0 ? '#9c1424' : '#1640a0';
  for (const rh of ROPE_H) {
    // esticador metálico por trás da almofada
    ctx.fillStyle = '#8d909c';
    ctx.fillRect(x - w / 2 - 7, y - rh - 3, w + 14, 6);
    ctx.fillStyle = '#120a18';
    ctx.beginPath();
    ctx.roundRect(x - w / 2 - 5.5, y - rh - 10.5, w + 11, 21, 7);
    ctx.fill();
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.roundRect(x - w / 2 - 4, y - rh - 9, w + 8, 18, 6);
    ctx.fill();
    ctx.fillStyle = dark;
    ctx.fillRect(x - w / 2 - 3, y - rh + 3, w + 6, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.roundRect(x - w / 2 - 1, y - rh - 7, w + 2, 4, 2);
    ctx.fill();
  }
  ctx.fillStyle = '#120a18';
  ctx.fillRect(x - w / 2 - 3.5, y - h - 7.5, w + 7, 10);
  ctx.fillStyle = '#d4d7df';
  ctx.fillRect(x - w / 2 - 2, y - h - 6, w + 4, 7);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillRect(x - w / 2 - 1, y - h - 5, w + 2, 2);
}

let matCanvas: HTMLCanvasElement | null = null;
const MS = 2;

/** Tapete pré-desenhado: lona com textura, luz do holofote ao centro, cantos e bordos na sombra das cordas. */
function makeMat(): HTMLCanvasElement {
  const W = FRONT_X * 2;
  const H = FRONT_Y - BACK_Y;
  const c = document.createElement('canvas');
  c.width = Math.round(W * MS);
  c.height = Math.round(H * MS);
  const g = c.getContext('2d')!;
  g.scale(MS, MS);
  g.translate(FRONT_X, -BACK_Y);
  g.beginPath();
  g.moveTo(-BACK_X, BACK_Y);
  g.lineTo(BACK_X, BACK_Y);
  g.lineTo(FRONT_X, FRONT_Y);
  g.lineTo(-FRONT_X, FRONT_Y);
  g.closePath();
  g.clip();
  const base = g.createLinearGradient(0, BACK_Y, 0, FRONT_Y);
  base.addColorStop(0, '#99a1b6');
  base.addColorStop(0.55, '#d5dbe7');
  base.addColorStop(1, '#eef1f7');
  g.fillStyle = base;
  g.fillRect(-FRONT_X, BACK_Y, W, H);
  // trama da lona
  for (let i = 0; i < 9000; i++) {
    const x = (hash(i * 3 + 1) - 0.5) * W;
    const y = BACK_Y + hash(i * 7 + 2) * H;
    g.fillStyle = hash(i * 11) > 0.5 ? 'rgba(255,255,255,0.22)' : 'rgba(60,70,100,0.07)';
    g.fillRect(x, y, 2.2, 0.6);
  }
  // marcas de uso (pegadas e manchas suaves)
  for (let i = 0; i < 26; i++) {
    const x = (hash(i * 13 + 5) - 0.5) * W * 0.8;
    const y = BACK_Y + 10 + hash(i * 17 + 3) * (H - 20);
    g.fillStyle = 'rgba(70,75,100,0.05)';
    g.beginPath();
    g.ellipse(x, y, 18 + hash(i) * 30, 4 + hash(i * 2) * 5, 0, 0, Math.PI * 2);
    g.fill();
  }
  // costuras
  g.strokeStyle = 'rgba(70,80,110,0.13)';
  g.lineWidth = 1.6;
  g.beginPath();
  for (let i = 1; i < 4; i++) {
    const y = BACK_Y + ((FRONT_Y - BACK_Y) * i) / 4;
    const w = BACK_X + ((FRONT_X - BACK_X) * i) / 4;
    g.moveTo(-w, y);
    g.lineTo(w, y);
  }
  for (let i = -4; i <= 4; i++) {
    g.moveTo(i * (BACK_X / 5), BACK_Y);
    g.lineTo(i * (FRONT_X / 5), FRONT_Y);
  }
  g.stroke();
  // logótipo central
  g.save();
  g.scale(1, 0.24);
  g.globalAlpha = 0.5;
  g.lineWidth = 10;
  g.strokeStyle = '#c4122c';
  g.beginPath();
  g.arc(0, -40, 150, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = 'rgba(196,18,44,0.18)';
  g.fill();
  g.globalAlpha = 0.55;
  g.fillStyle = '#c4122c';
  g.beginPath();
  g.moveTo(-70, 10);
  g.lineTo(-80, -90);
  g.lineTo(-35, -40);
  g.lineTo(0, -110);
  g.lineTo(35, -40);
  g.lineTo(80, -90);
  g.lineTo(70, 10);
  g.closePath();
  g.fill();
  g.restore();
  g.globalAlpha = 1;
  // luz do holofote principal no centro do ringue
  g.save();
  g.scale(1, 0.26);
  const hot = g.createRadialGradient(0, -60, 0, 0, -60, 520);
  hot.addColorStop(0, 'rgba(255,250,235,0.55)');
  hot.addColorStop(0.5, 'rgba(255,248,230,0.18)');
  hot.addColorStop(1, 'rgba(255,248,230,0)');
  g.fillStyle = hot;
  g.fillRect(-FRONT_X, -1200, W, 2400);
  g.restore();
  // sombra das cordas e dos bordos (oclusão junto aos lados)
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const off = 12 + k * 9;
      g.strokeStyle = `rgba(30,25,50,${0.1 - k * 0.022})`;
      g.lineWidth = 6 + k * 3;
      g.beginPath();
      g.moveTo(sx * (BACK_X - off * 0.7), BACK_Y + 2);
      g.lineTo(sx * (FRONT_X - off), FRONT_Y - 4);
      g.stroke();
    }
    const eg = g.createLinearGradient(sx * FRONT_X, 0, sx * (FRONT_X - 90), 0);
    eg.addColorStop(0, 'rgba(20,15,40,0.22)');
    eg.addColorStop(1, 'rgba(20,15,40,0)');
    g.fillStyle = eg;
    g.fillRect(sx > 0 ? FRONT_X - 90 : -FRONT_X, BACK_Y, 90, H);
  }
  const back = g.createLinearGradient(0, BACK_Y, 0, BACK_Y + 34);
  back.addColorStop(0, 'rgba(20,15,40,0.3)');
  back.addColorStop(1, 'rgba(20,15,40,0)');
  g.fillStyle = back;
  g.fillRect(-FRONT_X, BACK_Y, W, 34);
  // bordo vermelho da frente
  g.fillStyle = 'rgba(196,18,44,0.9)';
  g.fillRect(-FRONT_X, FRONT_Y - 7, W, 7);
  g.fillStyle = 'rgba(255,255,255,0.25)';
  g.fillRect(-FRONT_X, FRONT_Y - 7, W, 1.5);
  return c;
}

export function drawRingBack(ctx: CanvasRenderingContext2D, ropes: RopeState): void {
  matCanvas ??= makeMat();
  ctx.drawImage(matCanvas, -FRONT_X, BACK_Y, FRONT_X * 2, FRONT_Y - BACK_Y);

  // postes de trás
  post(ctx, -BACK_X, BACK_Y, POST_H - 10, 14, 0);
  post(ctx, BACK_X, BACK_Y, POST_H - 10, 14, 1);
  // cordas de trás
  for (let i = 0; i < 3; i++) {
    const h = ROPE_H[i] * 0.92;
    rope(ctx, -BACK_X, BACK_Y - h, BACK_X, BACK_Y - h, 0, BACK_Y - h + 3, ROPE_COLORS[i]);
  }
  // cordas laterais: a metade de trás fica atrás dos lutadores
  sideRopes(ctx, ropes, false);
}

export function drawRingFront(ctx: CanvasRenderingContext2D, ropes: RopeState, t = 0, hype = 0.3): void {
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
  // fita de LED animada
  const seg = 26;
  const n = Math.ceil((FRONT_X * 2 + 12) / seg);
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
  ctx.fillRect(-FRONT_X - 6, FRONT_Y + 8, FRONT_X * 2 + 12, 14);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = prevOp;
  ctx.fillStyle = '#c4122c';
  ctx.fillRect(-FRONT_X - 6, FRONT_Y + 104, FRONT_X * 2 + 12, 6);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '44px "Luckiest Guy", Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('KINGS OF THE RING', 0, FRONT_Y + 60);
  ctx.fillStyle = '#ffd23d';
  ctx.font = '26px "Luckiest Guy", Impact, sans-serif';
  ctx.fillText('★', -260, FRONT_Y + 58);
  ctx.fillText('★', 260, FRONT_Y + 58);

  // postes da frente
  post(ctx, -FRONT_X, FRONT_Y, POST_H, 18, 0);
  post(ctx, FRONT_X, FRONT_Y, POST_H, 18, 1);
  // cordas da frente (ligeiramente transparentes para não tapar a ação)
  // metade da frente das cordas laterais: passa por cima de quem se encosta a elas
  sideRopes(ctx, ropes, true);
  ctx.globalAlpha = 0.9;
  for (let i = 0; i < 3; i++) {
    const h = ROPE_H[i];
    simRope(ctx, ropes.front[i], -FRONT_X, FRONT_Y - h, FRONT_X, FRONT_Y - h, 0, 4, ROPE_COLORS[i]);
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
