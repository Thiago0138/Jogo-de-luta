import { glowSprite } from '../render/fighter';
import { hash } from './fx';
import { BW, OUT, darken, hazeFill, inked, makeLayer, pick, crownPath, starPath, type Layer } from './arenaKit';

/**
 * Público cartoon pré-renderizado (camadas por grupo que saltam com ritmos diferentes, braços no ar
 * com o entusiasmo, telemóveis e pulseiras luminosas). Partilhado pelas arenas que têm público.
 */

let SHIRTS = [
  '#e63946', '#f1c40f', '#3498db', '#2ecc71', '#9b59b6', '#ecf0f1', '#e67e22', '#1abc9c', '#ff6fb5', '#34495e', '#2f7bff', '#222831', '#f5f0e1', '#c0392b',
];
const SKINS = ['#f6c9a4', '#e8b083', '#b9774c', '#6e3f28', '#d29466', '#94593a'];
const HAIRS = ['#1b1714', '#3a2a1a', '#5a3418', '#e2b44a', '#b8461b', '#8d8f95', '#101010'];
const PRINTS = ['#ffffff', '#ffd23d', '#16121f', '#ff3b4e', '#2f7bff'];
const HATS = ['#e63946', '#2f7bff', '#16121f', '#f1c40f', '#2ecc71', '#ffffff', '#ff6fb5'];
const NEON = ['#39ff88', '#ff4fd8', '#3ad8ff', '#ffe14d'];
const SIGN_BG = ['#ffffff', '#ffe14d', '#ff9ccf', '#9fe8ff', '#ffffff'];
const SIGN_INK = ['#e63946', '#2f7bff', '#16121f', '#9b2fd6'];
const WORDS = ['WOW!', 'K.O.!', '10/10', 'LEGEND', 'POWER', 'GO!', 'CHAMP', 'BOOM', 'HYPE!', 'HI MOM', 'GOAT', 'SLAM!', 'KING ♛', 'RING ♥'];
const DEF_SHIRTS = SHIRTS;
export const CROWD_GROUPS = 3;

interface Spot {
  x: number;
  y: number;
  s: number;
  g: number;
  i: number;
  r: number;
}

export interface CrowdCfg {
  /** Filas a preencher (0 = a mais distante, 7 = a mais próxima). */
  rows: [number, number];
  /** Lugares vazios (palco, corredores, ruínas...). */
  blocked?: (x: number, r: number) => boolean;
  /** Paleta de roupa (por defeito, cores de claque). */
  shirts?: string[];
  /** Cor da neblina (r,g,b). */
  haze?: string;
  /** Cor da luz de recorte nas cabeças (vinda do ringue); opcional. */
  y0?: number;
}

/** Posições de todos os espectadores (determinísticas). Os grupos são blocos de vizinhos que saltam juntos. */
function crowdSpots(cfg: CrowdCfg): Spot[] {
  const out: Spot[] = [];
  const [r0, r1] = cfg.rows;
  for (let r = r0; r <= r1; r++) {
    const s = 0.62 + r * 0.06;
    const y = 232 + r * 60;
    let x = -20 + hash(r * 31) * 30;
    let i = 0;
    while (x < BW + 30) {
      if (!cfg.blocked?.(x, r)) {
        const blk = Math.floor((x + hash(r * 13) * 170) / 170);
        out.push({ x, y: y + (hash(r * 97 + i) - 0.5) * 8, s, g: Math.floor(hash(blk * 7.3 + r * 1.1) * CROWD_GROUPS), i: i + r * 1000, r });
      }
      x += (30 + hash(r * 999 + i) * 14) * s * 1.25;
      i++;
    }
  }
  return out;
}

/** Altura da cabeça de cada pessoa (há gente mais alta e mais baixa). */
function headY(p: Spot): number {
  return p.y + (hash(p.i * 4.9) - 0.5) * 7 * p.s;
}

function hairBack(g: CanvasRenderingContext2D, style: number, x: number, y: number, s: number, hair: string, sd: number): void {
  const lw = 1.8 * s;
  g.beginPath();
  if (style === 1) g.roundRect(x - 12.6 * s, y - 7 * s, 25.2 * s, 29 * s, 10 * s);
  else if (style === 3) g.arc(x, y - 2 * s, 15 * s, 0, Math.PI * 2);
  else if (style === 6) g.arc(x, y - 11 * s, 5.5 * s, 0, Math.PI * 2);
  else if (style === 8) g.ellipse(x + sd * 11 * s, y + 9 * s, 4.5 * s, 9 * s, sd * 0.4, 0, Math.PI * 2);
  else return;
  inked(g, hair, lw);
}

function hairFront(g: CanvasRenderingContext2D, p: Spot, style: number, x: number, y: number, s: number, hair: string, look: number): void {
  const lw = 1.8 * s;
  const hat = pick(HATS, hash(p.i * 11.3));
  const cap = () => {
    g.beginPath();
    g.ellipse(x, y + 0.5 * s, 11.2 * s, 10 * s, 0, Math.PI, 0);
    g.quadraticCurveTo(x + 4 * s, y - 2 * s, x - 2 * s, y + 1.5 * s);
    g.closePath();
    inked(g, hair, lw);
  };
  switch (style) {
    case 0:
    case 1:
    case 6:
    case 8:
      cap();
      break;
    case 2: // boné com pala para o ringue
      g.beginPath();
      g.ellipse(x + Math.sign(look) * 8 * s, y - 0.5 * s, 9 * s, 2.6 * s, 0, 0, Math.PI * 2);
      inked(g, darken(hat === '#ffffff' ? '#d8d8d8' : hat, 0.75), lw);
      g.beginPath();
      g.ellipse(x, y - 1 * s, 11.4 * s, 10 * s, 0, Math.PI, 0);
      g.closePath();
      inked(g, hat, lw);
      g.fillStyle = hat === '#ffffff' ? '#e63946' : '#ffffff';
      g.beginPath();
      g.arc(x, y - 5.5 * s, 2.3 * s, 0, Math.PI * 2);
      g.fill();
      break;
    case 3: // afro: linha do cabelo
      g.fillStyle = hair;
      g.beginPath();
      g.ellipse(x, y - 1 * s, 10.4 * s, 7.5 * s, 0, Math.PI, 0);
      g.fill();
      break;
    case 4: // gorro com pompom
      g.beginPath();
      g.ellipse(x, y - 1 * s, 11.8 * s, 12 * s, 0, Math.PI, 0);
      g.closePath();
      inked(g, hat, lw);
      g.beginPath();
      g.roundRect(x - 12.2 * s, y - 4 * s, 24.4 * s, 5.4 * s, 2 * s);
      inked(g, darken(hat === '#ffffff' ? '#cccccc' : hat, 0.7), lw);
      g.beginPath();
      g.arc(x, y - 14 * s, 3.4 * s, 0, Math.PI * 2);
      inked(g, '#ffffff', lw * 0.8);
      break;
    case 5: // careca com brilho
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath();
      g.ellipse(x - 3 * s, y - 3.5 * s, 4 * s, 2.3 * s, -0.4, 0, Math.PI * 2);
      g.fill();
      break;
    case 7: { // crista colorida
      g.beginPath();
      g.moveTo(x - 4 * s, y - 4 * s);
      for (let k = 0; k <= 4; k++) {
        const px = x - 4 * s + k * 2 * s;
        g.lineTo(px - 1.5 * s, y - (12 + (k % 2) * 4) * s - (k === 2 ? 3 * s : 0));
        g.lineTo(px + 1 * s, y - 7 * s);
      }
      g.lineTo(x + 4 * s, y - 4 * s);
      g.closePath();
      inked(g, pick(NEON, hash(p.i * 3.7)), lw);
      break;
    }
    case 9: // chapéu de cowboy
      g.beginPath();
      g.ellipse(x, y - 2 * s, 17 * s, 3.8 * s, 0, 0, Math.PI * 2);
      inked(g, '#8a5a2b', lw);
      g.beginPath();
      g.roundRect(x - 8.5 * s, y - 14 * s, 17 * s, 12 * s, 4 * s);
      inked(g, '#9c6a35', lw);
      g.fillStyle = '#3a2412';
      g.fillRect(x - 8 * s, y - 5.5 * s, 16 * s, 2.6 * s);
      break;
    case 10: // coroa de papel (somos os reis do ringue!)
      cap();
      crownPath(g, x, y - 4 * s, 18 * s, 11 * s);
      inked(g, '#ffd23d', lw);
      g.fillStyle = '#e63946';
      g.beginPath();
      g.arc(x, y - 7 * s, 1.6 * s, 0, Math.PI * 2);
      g.fill();
      break;
    case 11: // fita na testa
      cap();
      g.beginPath();
      g.rect(x - 10.8 * s, y - 2.5 * s, 21.6 * s, 3.6 * s);
      inked(g, hash(p.i * 2.9) > 0.5 ? '#ff3b4e' : '#2f7bff', lw * 0.7);
      break;
    default: { // caracóis
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = Math.PI + (k / 5) * Math.PI;
        const cx = x + Math.cos(a) * 9.5 * s;
        const cy = y + Math.sin(a) * 8.5 * s;
        g.moveTo(cx + 4.2 * s, cy);
        g.arc(cx, cy, 4.2 * s, 0, Math.PI * 2);
      }
      inked(g, hair, lw * 0.8);
    }
  }
}

function personBody(g: CanvasRenderingContext2D, p: Spot): void {
  const s = p.s;
  const x = p.x;
  const y = headY(p);
  const shirt = pick(SHIRTS, hash(p.i * 3.1));
  const skin = pick(SKINS, hash(p.i * 5.3));
  const hair = pick(HAIRS, hash(p.i * 7.7));
  const wide = 0.8 + hash(p.i * 2.3) * 0.5;
  const heavy = wide > 1.15 ? 2.5 * s : 0;
  const lw = 2.1 * s;
  const style = Math.floor(hash(p.i * 1.7) * 13);
  // a luz vem do ringue (centro): sombra do lado de fora; todos olham para o ringue
  const sd = x < BW / 2 ? -1 : 1;
  const look = -sd * 1.5 * s * (0.4 + hash(p.i * 8.3) * 0.6);
  hairBack(g, style, x, y, s, hair, sd);
  // tronco
  const sw = 19 * s * wide;
  const torso = () => {
    g.beginPath();
    g.moveTo(x - sw - heavy, y + 64 * s);
    g.quadraticCurveTo(x - sw - 1 * s, y + 23 * s, x - 8 * s, y + 18.5 * s);
    g.lineTo(x + 8 * s, y + 18.5 * s);
    g.quadraticCurveTo(x + sw + 1 * s, y + 23 * s, x + sw + heavy, y + 64 * s);
    g.closePath();
  };
  torso();
  g.save();
  g.fillStyle = shirt;
  g.fill();
  g.clip();
  let pc = pick(PRINTS, hash(p.i * 7.9));
  if (pc === shirt) pc = '#16121f';
  const pt = Math.floor(hash(p.i * 6.7) * 7);
  g.fillStyle = pc;
  if (pt === 1) {
    g.fillRect(x - 30 * s, y + 31 * s, 60 * s, 4 * s);
    g.fillRect(x - 30 * s, y + 41 * s, 60 * s, 4 * s);
  } else if (pt === 2) {
    starPath(g, x, y + 36 * s, 6.5 * s);
    g.fill();
  } else if (pt === 3) {
    g.font = `${(13 * s).toFixed(1)}px "Luckiest Guy", Impact, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(1 + (p.i % 99)), x, y + 38 * s);
  } else if (pt === 4) {
    g.fillStyle = hash(p.i * 9.9) > 0.5 ? '#ff3b4e' : '#2f7bff';
    g.fillRect(x, y + 15 * s, 40 * s, 52 * s);
  } else if (pt === 5) {
    g.fillRect(x - 6 * s, y + 18 * s, 12 * s, 3 * s);
    g.fillRect(x - 40 * s, y + 18 * s, 80 * s, 2.4 * s);
  } else if (pt === 6) {
    // capuz e cordões
    g.fillStyle = darken(shirt, 0.72);
    g.beginPath();
    g.ellipse(x, y + 20 * s, 13 * s, 5 * s, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = pc;
    g.lineWidth = 1.4 * s;
    g.beginPath();
    g.moveTo(x - 3 * s, y + 22 * s);
    g.lineTo(x - 3 * s, y + 32 * s);
    g.moveTo(x + 3 * s, y + 22 * s);
    g.lineTo(x + 3 * s, y + 32 * s);
    g.stroke();
  }
  // sombreamento cel: lado de fora e base
  g.fillStyle = 'rgba(16,4,40,0.28)';
  g.fillRect(sd > 0 ? x + 5 * s : x - sw - heavy - 5 * s, y + 16 * s, sw + heavy, 50 * s);
  g.fillStyle = 'rgba(16,4,40,0.22)';
  g.fillRect(x - 40 * s, y + 48 * s, 80 * s, 20 * s);
  g.fillStyle = 'rgba(255,255,255,0.2)';
  g.fillRect(x - sw * 0.6, y + 19.5 * s, sw * 1.2, 2.2 * s);
  g.restore();
  torso();
  g.lineWidth = lw;
  g.strokeStyle = OUT;
  g.lineJoin = 'round';
  g.stroke();
  // pescoço
  g.fillStyle = darken(skin, 0.78);
  g.fillRect(x - 3.8 * s, y + 12 * s, 7.6 * s, 8 * s);
  // orelhas
  g.beginPath();
  g.ellipse(x - 10.4 * s, y + 5 * s, 2.4 * s, 3.2 * s, 0, 0, Math.PI * 2);
  g.ellipse(x + 10.4 * s, y + 5 * s, 2.4 * s, 3.2 * s, 0, 0, Math.PI * 2);
  inked(g, skin, lw * 0.8);
  // cabeça com sombra em crescente
  g.fillStyle = darken(skin, 0.76);
  g.beginPath();
  g.ellipse(x, y + 4 * s, 10.5 * s, 12 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = skin;
  g.beginPath();
  g.ellipse(x - sd * 1.8 * s, y + 3 * s, 8.7 * s, 11 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(x, y + 4 * s, 10.5 * s, 12 * s, 0, 0, Math.PI * 2);
  g.lineWidth = lw;
  g.strokeStyle = OUT;
  g.stroke();
  // barba
  if (hash(p.i * 12.7) > 0.84) {
    g.fillStyle = hair;
    g.beginPath();
    g.ellipse(x, y + 8.5 * s, 9.6 * s, 7.4 * s, 0, 0.02 * Math.PI, 0.98 * Math.PI);
    g.fill();
  }
  // cara: olhos, sobrancelhas e boca bem legíveis à distância
  const ex = x + look;
  g.fillStyle = OUT;
  g.beginPath();
  g.ellipse(ex - 3.6 * s, y + 4.6 * s, 1.35 * s, 1.75 * s, 0, 0, Math.PI * 2);
  g.ellipse(ex + 3.6 * s, y + 4.6 * s, 1.35 * s, 1.75 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = OUT;
  g.lineWidth = 1.3 * s;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(ex - 6 * s, y + 0.8 * s);
  g.lineTo(ex - 1.8 * s, y - 0.4 * s);
  g.moveTo(ex + 6 * s, y + 0.8 * s);
  g.lineTo(ex + 1.8 * s, y - 0.4 * s);
  g.stroke();
  const mx = x + look * 0.6;
  const expr = hash(p.i * 9.1);
  if (expr < 0.45) {
    // a gritar
    g.fillStyle = '#4a0f1c';
    g.beginPath();
    g.ellipse(mx, y + 10.4 * s, 2.9 * s, 2.7 * s, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#e8566a';
    g.beginPath();
    g.ellipse(mx, y + 11.8 * s, 1.7 * s, 1 * s, 0, 0, Math.PI * 2);
    g.fill();
  } else if (expr < 0.78) {
    g.beginPath();
    g.arc(mx, y + 7.6 * s, 3.6 * s, 0.18 * Math.PI, 0.82 * Math.PI);
    g.stroke();
  } else {
    g.beginPath();
    g.moveTo(mx - 3.8 * s, y + 8.4 * s);
    g.quadraticCurveTo(mx, y + 14.5 * s, mx + 3.8 * s, y + 8.4 * s);
    g.closePath();
    inked(g, '#ffffff', 1.1 * s);
  }
  // pinturas de guerra nas bochechas
  if (hash(p.i * 14.3) > 0.9) {
    g.fillStyle = hash(p.i * 2.9) > 0.5 ? '#ff3b4e' : '#2f7bff';
    g.fillRect(x - 8.5 * s, y + 7 * s, 3.6 * s, 1.6 * s);
    g.fillRect(x + 4.9 * s, y + 7 * s, 3.6 * s, 1.6 * s);
  }
  // óculos de sol
  if (hash(p.i * 17) > 0.87) {
    g.fillStyle = '#0d0b14';
    g.beginPath();
    g.roundRect(ex - 7.4 * s, y + 2.4 * s, 6.4 * s, 4.4 * s, 1.6 * s);
    g.roundRect(ex + 1 * s, y + 2.4 * s, 6.4 * s, 4.4 * s, 1.6 * s);
    g.fill();
    g.fillRect(ex - 1.2 * s, y + 3 * s, 2.4 * s, 1.1 * s);
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.fillRect(ex - 6.4 * s, y + 3.2 * s, 2 * s, 1 * s);
  }
  hairFront(g, p, style, x, y, s, hair, look);
}

/** Adereços estáticos: cartazes, dedos de espuma, bandeiras, cachecóis, pipocas. */
function personAccessory(g: CanvasRenderingContext2D, p: Spot): void {
  const s = p.s;
  const x = p.x;
  const y = headY(p);
  const k = hash(p.i * 19);
  const team = hash(p.i * 3) > 0.5 ? '#ff3b4e' : '#2f7bff';
  const lw = 2 * s;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  if (k < 0.04 + p.r * 0.006) {
    g.strokeStyle = '#6b4a2a';
    g.lineWidth = 3 * s;
    g.beginPath();
    g.moveTo(x, y - 20 * s);
    g.lineTo(x, y + 26 * s);
    g.stroke();
    g.beginPath();
    g.roundRect(x - 28 * s, y - 50 * s, 56 * s, 30 * s, 3 * s);
    inked(g, pick(SIGN_BG, hash(p.i * 5.1)), lw);
    g.fillStyle = pick(SIGN_INK, hash(p.i * 6.1));
    g.font = `${(15 * s).toFixed(1)}px "Luckiest Guy", Impact, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(WORDS[p.i % WORDS.length], x, y - 34 * s, 50 * s);
  } else if (k < 0.1) {
    // dedo de espuma
    g.beginPath();
    g.roundRect(x + 7 * s, y - 14 * s, 20 * s, 23 * s, 6 * s);
    g.roundRect(x + 12 * s, y - 40 * s, 8.5 * s, 30 * s, 4 * s);
    inked(g, pick(['#ffd23d', '#ff3d6e', '#39d98a', '#3ad8ff'], hash(p.i * 2.1)), lw);
    g.fillStyle = OUT;
    g.font = `${(8 * s).toFixed(1)}px "Luckiest Guy", Impact, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('#1', x + 17 * s, y - 2 * s);
  } else if (k < 0.13) {
    // bandeira a ondular
    const px = x - 13 * s;
    const top = y - 42 * s;
    g.strokeStyle = '#cfcfcf';
    g.lineWidth = 2.2 * s;
    g.beginPath();
    g.moveTo(px, y + 22 * s);
    g.lineTo(px, top);
    g.stroke();
    g.beginPath();
    g.moveTo(px, top);
    g.quadraticCurveTo(px + 14 * s, top - 5 * s, px + 30 * s, top);
    g.lineTo(px + 30 * s, top + 18 * s);
    g.quadraticCurveTo(px + 14 * s, top + 13 * s, px, top + 18 * s);
    g.closePath();
    inked(g, team, lw);
    g.fillStyle = '#ffffff';
    starPath(g, px + 15 * s, top + 8 * s, 4.5 * s);
    g.fill();
  } else if (k < 0.17) {
    // cachecol da equipa
    g.beginPath();
    g.roundRect(x - 12 * s, y + 16 * s, 24 * s, 6 * s, 3 * s);
    g.rect(x + 3 * s, y + 18 * s, 6 * s, 22 * s);
    inked(g, team, lw * 0.8);
    g.fillStyle = '#ffffff';
    g.fillRect(x + 3.6 * s, y + 28 * s, 4.8 * s, 3 * s);
  } else if (k < 0.2) {
    // pipocas
    const bx = x + 7 * s;
    const by = y + 33 * s;
    g.fillStyle = '#fff3c4';
    g.beginPath();
    for (let j = 0; j < 4; j++) {
      g.moveTo(bx + (2 + j * 2.4) * s, by);
      g.arc(bx + (2 + j * 2.4) * s, by, 2.3 * s, 0, Math.PI * 2);
    }
    g.fill();
    g.beginPath();
    g.moveTo(bx, by);
    g.lineTo(bx + 11 * s, by);
    g.lineTo(bx + 9.5 * s, by + 13 * s);
    g.lineTo(bx + 1.5 * s, by + 13 * s);
    g.closePath();
    inked(g, '#ffffff', lw * 0.8);
    g.fillStyle = '#e63946';
    g.fillRect(bx + 2.8 * s, by + 1 * s, 1.8 * s, 11 * s);
    g.fillRect(bx + 6.6 * s, by + 1 * s, 1.8 * s, 11 * s);
  }
}

/** Braço cartoon: contorno, pele, manga da camisola e mão. */
function arm(g: CanvasRenderingContext2D, s: number, sx: number, sy: number, hx: number, hy: number, shirt: string, skin: string): void {
  const ex = (sx + hx) / 2 + (hx > sx ? 4 : -4) * s;
  const ey = (sy + hy) / 2 + 2 * s;
  g.beginPath();
  g.moveTo(sx, sy);
  g.lineTo(ex, ey);
  g.lineTo(hx, hy);
  g.strokeStyle = OUT;
  g.lineWidth = 8.8 * s;
  g.stroke();
  g.strokeStyle = skin;
  g.lineWidth = 6 * s;
  g.stroke();
  g.beginPath();
  g.moveTo(sx, sy);
  g.lineTo(sx + (ex - sx) * 0.85, sy + (ey - sy) * 0.85);
  g.strokeStyle = shirt;
  g.lineWidth = 6.6 * s;
  g.stroke();
  g.beginPath();
  g.arc(hx, hy, 4.4 * s, 0, Math.PI * 2);
  inked(g, skin, 1.8 * s);
}

/** Braços no ar (aparecem por grupos quando o público está ao rubro): punhos, palmas, luzes, telemóveis, cartazes. */
function personArms(g: CanvasRenderingContext2D, p: Spot): void {
  const s = p.s;
  const x = p.x;
  const y = headY(p);
  const shirt = pick(SHIRTS, hash(p.i * 3.1));
  const skin = pick(SKINS, hash(p.i * 5.3));
  const type = Math.floor(hash(p.i * 31) * 7);
  const sp = (4 + hash(p.i * 23) * 8) * s;
  const lx = x - 13 * s;
  const rx = x + 13 * s;
  const sy = y + 26 * s;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  if (type === 1) {
    // palmas por cima da cabeça
    arm(g, s, lx, sy, x - 3.5 * s, y - 30 * s, shirt, skin);
    arm(g, s, rx, sy, x + 3.5 * s, y - 31 * s, shirt, skin);
  } else if (type === 2) {
    arm(g, s, rx, sy, x + 17 * s, y - 32 * s, shirt, skin);
  } else if (type === 6) {
    // cartaz levantado bem alto
    arm(g, s, lx, sy, x - 15 * s, y - 26 * s, shirt, skin);
    arm(g, s, rx, sy, x + 15 * s, y - 26 * s, shirt, skin);
    g.beginPath();
    g.roundRect(x - 31 * s, y - 60 * s, 62 * s, 32 * s, 3 * s);
    inked(g, pick(SIGN_BG, hash(p.i * 4.1)), 2 * s);
    g.fillStyle = pick(SIGN_INK, hash(p.i * 8.1));
    g.font = `${(16 * s).toFixed(1)}px "Luckiest Guy", Impact, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(WORDS[(p.i * 7) % WORDS.length], x, y - 43 * s, 56 * s);
  } else {
    const hlx = x - 18 * s - sp;
    const hrx = x + 18 * s + sp;
    const hy = y - 25 * s;
    arm(g, s, lx, sy, hlx, hy, shirt, skin);
    arm(g, s, rx, sy, hrx, hy - 2 * s, shirt, skin);
    if (type === 3) {
      // pulseira luminosa (o brilho anima por frame)
      const c = pick(NEON, hash(p.i * 37));
      g.beginPath();
      g.moveTo(hrx, hy - 3 * s);
      g.lineTo(hrx + 3 * s, hy - 19 * s);
      g.strokeStyle = OUT;
      g.lineWidth = 5.4 * s;
      g.stroke();
      g.strokeStyle = c;
      g.lineWidth = 3.2 * s;
      g.stroke();
      g.strokeStyle = '#ffffff';
      g.lineWidth = 1.1 * s;
      g.stroke();
      sticks.push({ x: hrx + 1.5 * s, y: hy - 11 * s, s, g: p.g, c, p: hash(p.i * 41) * 6 });
    } else if (type === 4) {
      g.beginPath();
      g.roundRect(hrx - 9 * s, hy - 14 * s, 18 * s, 18 * s, 5 * s);
      g.roundRect(hrx - 4 * s, hy - 36 * s, 8 * s, 26 * s, 4 * s);
      inked(g, pick(['#ffd23d', '#ff3d6e', '#39d98a'], hash(p.i * 2.7)), 2 * s);
    } else if (type === 5) {
      g.beginPath();
      g.roundRect(hlx - 4 * s, hy - 15 * s, 9 * s, 14 * s, 2 * s);
      inked(g, '#1a1430', 1.6 * s);
      g.fillStyle = '#dff3ff';
      g.fillRect(hlx - 2.6 * s, hy - 13.4 * s, 6.2 * s, 10.6 * s);
    }
  }
}

let HZ = '30,16,58';
/** Desenha as filas [r0, r1] de um grupo, com neblina a crescer para trás. */
function drawRows(g: CanvasRenderingContext2D, spots: Spot[], group: number, r0: number, r1: number, haze: number, arms: boolean): void {
  for (let r = r0; r <= r1; r++) {
    for (const p of spots) {
      if (p.r !== r || p.g !== group) continue;
      if (arms) {
        if (hash(p.i * 29) < 0.44 + p.r * 0.03) personArms(g, p);
      } else {
        personBody(g, p);
        personAccessory(g, p);
      }
    }
    hazeFill(g, r < 5 ? haze : haze * 0.55, HZ);
  }
}

let sticks: { x: number; y: number; s: number; g: number; c: string; p: number }[] = [];

export interface Crowd {
  back: Layer[];
  front: Layer[];
  arms: Layer[];
  sticks: { x: number; y: number; s: number; g: number; c: string; p: number }[];
  phones: { x: number; y: number; p: number }[];
}

/** Pré-renderiza um público completo (pode demorar ~100 ms: fazer uma vez por arena). */
export function buildCrowd(cfg: CrowdCfg): Crowd {
  const spots = crowdSpots(cfg);
  SHIRTS = cfg.shirts ?? DEF_SHIRTS;
  HZ = cfg.haze ?? '30,16,58';
  sticks = [];
  const back: Layer[] = [];
  const front: Layer[] = [];
  const arms: Layer[] = [];
  const [r0, r1] = cfg.rows;
  const yTop = 186 + r0 * 60;
  for (let gi = 0; gi < CROWD_GROUPS; gi++) {
    // filas de trás: mais pequenas, enevoadas e desfocadas
    if (r0 <= 4) back.push(makeLayer(Math.max(150, yTop), 545, 0.55, 'blur(0.8px) saturate(0.72)', (g) => drawRows(g, spots, gi, r0, Math.min(4, r1), 0.19, false)));
    // filas da frente (plano médio): mais nítidas e com mais resolução
    if (r1 >= 5) front.push(makeLayer(470, 700, 0.8, 'saturate(0.86)', (g) => drawRows(g, spots, gi, Math.max(5, r0), r1, 0.19, false)));
    arms.push(makeLayer(Math.max(110, yTop - 40), 700, 0.6, 'blur(0.4px) saturate(0.82)', (g) => drawRows(g, spots, gi, r0, r1, 0.17, true)));
  }
  const phones = spots.filter((p) => hash(p.i * 41) > 0.9).map((p) => ({ x: p.x + 9 * p.s, y: headY(p) + 30 * p.s, p: hash(p.i * 43) * 10 }));
  SHIRTS = DEF_SHIRTS;
  return { back, front, arms, sticks, phones };
}

function drawLayer(ctx: CanvasRenderingContext2D, L: Layer, x: number, y: number, s: number, dw: number, b: number): void {
  ctx.drawImage(L.c, x, y + L.y0 * s - b, dw, L.h * s);
}

const armsA = [0, 0, 0];
const bounce = [0, 0, 0];

/** Desenha o público (no espaço de ecrã do fundo: origem x,y e escala s). */
export function drawCrowd(ctx: CanvasRenderingContext2D, C: Crowd, x: number, y: number, s: number, dw: number, t: number, hype: number): void {
  // cada grupo do público salta com o seu próprio ritmo; os braços sobem por grupos com o entusiasmo
  const freq = 3.5 + hype * 6;
  for (let gi = 0; gi < CROWD_GROUPS; gi++) {
    bounce[gi] = Math.max(0, Math.sin(t * freq + gi * 2.1)) * (1.5 + hype * 11) * s;
    const thr = 0.22 + gi * 0.13;
    armsA[gi] = Math.max(0, Math.min(1, (hype - thr + 0.12 * Math.sin(t * 0.8 + gi * 2.4)) * 5));
  }
  for (let gi = 0; gi < C.back.length; gi++) drawLayer(ctx, C.back[gi], x, y, s, dw, bounce[gi]);
  for (let gi = 0; gi < C.front.length; gi++) drawLayer(ctx, C.front[gi], x, y, s, dw, bounce[gi]);
  for (let gi = 0; gi < C.arms.length; gi++) {
    if (armsA[gi] < 0.02) continue;
    ctx.globalAlpha = armsA[gi];
    const pump = Math.abs(Math.sin(t * freq * 0.5 + gi)) * hype * 4 * s;
    drawLayer(ctx, C.arms[gi], x, y, s, dw, bounce[gi] + pump);
  }
  ctx.globalAlpha = 1;
}

/** Luzes do público por cima de tudo: telemóveis e pulseiras luminosas. */
export function drawCrowdLights(ctx: CanvasRenderingContext2D, C: Crowd, x: number, y: number, s: number, t: number, low: boolean): void {
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = '#dff3ff';
  for (const ph of C.phones) {
    const a = 0.35 + 0.35 * Math.sin(t * 2 + ph.p);
    if (a < 0.1) continue;
    ctx.globalAlpha = a;
    ctx.fillRect(x + ph.x * s, y + ph.y * s, 4 * s, 6 * s);
  }
  if (!low) {
    for (const st of C.sticks) {
      const a = armsA[st.g];
      if (a < 0.05) continue;
      ctx.globalAlpha = a * (0.55 + 0.35 * Math.sin(t * 5 + st.p));
      const r = 16 * st.s * s;
      ctx.drawImage(glowSprite(st.c), x + st.x * s - r, y + st.y * s - r - bounce[st.g], r * 2, r * 2);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = prev;
}
