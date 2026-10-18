import { ANIMS, sample, type AnimName } from '../fight/anims';
import { drawFighter, glowSprite, type Expr } from '../render/fighter';
import { resolveLook, type Look } from '../render/look';
import { Skel, newPose, solve } from '../render/pose';
import { flame } from '../render/costume';
import { item, type ItemDef } from '../data/items';
import { RARITIES } from '../data/rarity';
import { DEFAULT_APPEARANCE } from '../data/appearance';
import { S } from '../core/state';

/**
 * Miniaturas ilustradas dos itens que não são roupa: golpes (o teu lutador a aplicar o golpe
 * num adversário), supers (pose de poder com o efeito do super), estilos de golpe e entradas.
 */

const TAU = Math.PI * 2;
const K = 0.36;

let opp: Look | null = null;
function oppLook(): Look {
  opp ??= resolveLook(
    { ...DEFAULT_APPEARANCE, skin: 5, hair: 'h_careca', hairColor: 'hc_preto', mouth: 'serio', beard: 'curta' },
    { outfit: 'o_azul', gloves: 'g_azuis', mask: null, aura: null },
  );
  return opp;
}

function meLook(): Look {
  return resolveLook(S.appearance, { ...S.loadout, aura: null });
}

interface PoseOpts {
  rot?: number;
  dy?: number;
  face?: 1 | -1;
  expr?: Expr;
  k?: number;
}

/** Desenha um lutador numa pose: `x` no ecrã, `gy` = linha do chão. */
function pose(ctx: CanvasRenderingContext2D, L: Look, anim: AnimName, at: number, x: number, gy: number, o: PoseOpts = {}) {
  const p = newPose();
  sample(ANIMS[anim], at, p);
  p.rot += o.rot ?? 0;
  const s = solve(p, new Skel());
  const k = o.k ?? K;
  ctx.save();
  ctx.translate(x, gy - s.minY * k + (o.dy ?? 0));
  ctx.scale(k * (o.face ?? 1), k);
  drawFighter(ctx, L, s, { t: 1.2, expr: o.expr ?? 'normal', flash: false, glow: null, rim: null });
  ctx.restore();
}

/** Aproxima a câmara à volta de (x, y). */
function zoom(ctx: CanvasRenderingContext2D, x: number, y: number, k: number) {
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.translate(-x, -y);
}

function add(ctx: CanvasRenderingContext2D, f: () => void) {
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  f();
  ctx.globalCompositeOperation = prev;
  ctx.globalAlpha = 1;
}

function hash(i: number) {
  const x = Math.sin(i * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

/** Fundo comum: gradiente com a cor da raridade e tapete do ringue. */
function ringBack(ctx: CanvasRenderingContext2D, W: number, H: number, col: string, gy: number) {
  const g = ctx.createRadialGradient(W / 2, H * 0.45, 4, W / 2, H * 0.45, W * 0.75);
  g.addColorStop(0, col + 'cc');
  g.addColorStop(0.55, '#1c1838');
  g.addColorStop(1, '#0c0a1a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // cordas
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  for (const y of [0.42, 0.52, 0.62]) {
    ctx.beginPath();
    ctx.moveTo(0, H * y);
    ctx.lineTo(W, H * y);
    ctx.stroke();
  }
  // tapete
  const m = ctx.createLinearGradient(0, gy, 0, H);
  m.addColorStop(0, '#e9edf5');
  m.addColorStop(1, '#a9b2c6');
  ctx.fillStyle = m;
  ctx.fillRect(0, gy, W, H - gy);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, gy, W, 3);
}

function shadow(ctx: CanvasRenderingContext2D, x: number, gy: number, w = 30) {
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(x, gy + 2, w, 5, 0, 0, TAU);
  ctx.fill();
}

function speedLines(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, n: number, col = '#ffffff') {
  ctx.strokeStyle = col;
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const o = (i - n / 2) * 7;
    ctx.globalAlpha = 0.35 + hash(i) * 0.4;
    ctx.lineWidth = 2 + hash(i + 3) * 2;
    ctx.beginPath();
    ctx.moveTo(x0, y0 + o);
    ctx.lineTo(x1 - hash(i + 7) * 20, y1 + o);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function impact(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col = '#ffd23d') {
  add(ctx, () => {
    ctx.globalAlpha = 0.9;
    ctx.drawImage(glowSprite(col), x - r * 1.6, y - r * 1.6, r * 3.2, r * 3.2);
  });
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = '#fff6c0';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#1a1220';
  ctx.stroke();
}

function bolt(ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number, seed: number, col = '#bfe9ff', w = 3) {
  const pts: [number, number][] = [[x, y0]];
  let cx = x;
  const n = 7;
  for (let i = 1; i <= n; i++) {
    cx += (hash(seed + i) - 0.5) * 26;
    pts.push([cx, y0 + ((y1 - y0) * i) / n]);
  }
  add(ctx, () => {
    for (const [lw, c, a] of [[w * 4, col, 0.35], [w, '#ffffff', 1]] as const) {
      ctx.globalAlpha = a;
      ctx.strokeStyle = c;
      ctx.lineWidth = lw;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.stroke();
    }
  });
}

// ───────────────────────── Golpes ─────────────────────────

type Scene = (ctx: CanvasRenderingContext2D, W: number, H: number, gy: number, me: Look, op: Look) => [number, number] | void;

const MOVES: Record<string, Scene> = {
  stomp: (c, W, _H, gy, me, op) => {
    pose(c, op, 'lie', 0.9, W * 0.6, gy, { face: -1, expr: 'hurt' });
    pose(c, me, 'stomp', 0.25, W * 0.4, gy, { expr: 'angry' });
    return [W * 0.5, gy - 12];
  },
  dropkick: (c, W, _H, gy, me, op) => {
    pose(c, op, 'hitHi', 0.3, W * 0.72, gy, { face: -1, expr: 'hurt' });
    speedLines(c, W * 0.05, gy - 70, W * 0.3, gy - 70, 5);
    pose(c, me, 'dropkick', 0.3, W * 0.38, gy, { dy: -40, expr: 'angry' });
    return [W * 0.62, gy - 78];
  },
  elbow: (c, W, _H, gy, me, op) => {
    pose(c, op, 'lie', 0.9, W * 0.55, gy, { face: -1, expr: 'hurt' });
    pose(c, me, 'elbow', 0.3, W * 0.48, gy, { dy: -50, expr: 'angry' });
    speedLines(c, W * 0.48, gy - 150, W * 0.48, gy - 120, 1);
    return [W * 0.5, gy - 22];
  },
  irish: (c, W, _H, gy, me, op) => {
    speedLines(c, W, gy - 75, W * 0.75, gy - 75, 5);
    pose(c, op, 'hitHi', 0.3, W * 0.66, gy, { face: -1, rot: -0.35, expr: 'hurt' });
    pose(c, me, 'clothes', 0.5, W * 0.36, gy, { expr: 'angry' });
    return [W * 0.6, gy - 92];
  },
  lariat: (c, W, _H, gy, me, op) => {
    pose(c, op, 'fall', 0.2, W * 0.7, gy, { face: -1, expr: 'hurt' });
    speedLines(c, 0, gy - 80, W * 0.25, gy - 80, 6, '#ffb36a');
    pose(c, me, 'clothes', 0.5, W * 0.4, gy, { expr: 'angry' });
    return [W * 0.62, gy - 88];
  },
  spear: (c, W, _H, gy, me, op) => {
    pose(c, op, 'hitBody', 0.3, W * 0.66, gy, { face: -1, rot: -0.25, expr: 'hurt' });
    speedLines(c, 0, gy - 50, W * 0.3, gy - 50, 6);
    pose(c, me, 'spear', 0.5, W * 0.36, gy, { expr: 'angry' });
    return [W * 0.58, gy - 55];
  },
  superkick: (c, W, _H, gy, me, op) => {
    pose(c, op, 'hitHi', 0.3, W * 0.72, gy, { face: -1, rot: -0.2, expr: 'hurt' });
    pose(c, me, 'superkick', 0.24, W * 0.36, gy, { expr: 'angry' });
    return [W * 0.62, gy - 98];
  },
  ddt: (c, W, _H, gy, me, op) => {
    pose(c, op, 'hitBody', 0.3, W * 0.56, gy, { face: -1, rot: 1.25, dy: -8, expr: 'hurt' });
    pose(c, me, 'fall', 0.15, W * 0.42, gy, { rot: -0.5, expr: 'angry' });
    return [W * 0.55, gy - 6];
  },
  powerbomb: (c, W, _H, gy, me, op) => {
    pose(c, me, 'lift', 0.3, W * 0.48, gy, { expr: 'angry' });
    pose(c, op, 'tuck', 0.5, W * 0.52, gy, { face: -1, rot: Math.PI * 0.85, dy: -92, expr: 'hurt' });
  },
  splash: (c, W, _H, gy, me, op) => {
    pose(c, op, 'lie', 0.9, W * 0.52, gy, { face: -1, expr: 'hurt' });
    pose(c, me, 'splash', 0.3, W * 0.5, gy, { dy: -62, expr: 'angry' });
    speedLines(c, W * 0.5, gy - 170, W * 0.5, gy - 140, 3);
  },
  moonsault: (c, W, _H, gy, me, op) => {
    pose(c, op, 'lie', 0.9, W * 0.55, gy, { face: -1, expr: 'hurt' });
    c.strokeStyle = 'rgba(255,255,255,0.6)';
    c.lineWidth = 4;
    c.beginPath();
    c.arc(W * 0.48, gy - 100, 46, Math.PI * 0.9, Math.PI * 1.95);
    c.stroke();
    pose(c, me, 'tuck', 0.5, W * 0.48, gy, { rot: -2.4, dy: -80, expr: 'angry' });
  },
  chokeslam: (c, W, _H, gy, me, op) => {
    pose(c, me, 'reach', 0.3, W * 0.36, gy, { expr: 'angry' });
    pose(c, op, 'hitHi', 0.3, W * 0.6, gy, { face: -1, dy: -58, expr: 'hurt' });
    return [W * 0.5, gy - 150];
  },
  cutter: (c, W, _H, gy, me, op) => {
    pose(c, op, 'hitHi', 0.3, W * 0.58, gy, { face: -1, rot: 0.9, expr: 'hurt' });
    speedLines(c, 0, gy - 30, W * 0.25, gy - 50, 4);
    pose(c, me, 'fall', 0.2, W * 0.42, gy, { rot: -0.9, dy: -10, expr: 'angry' });
    return [W * 0.56, gy - 40];
  },
};

// ───────────────────────── Supers ─────────────────────────

const SUPER_COL: Record<string, string> = {
  supersoco: '#ffd23d', lariat: '#ff8a3d', relampago: '#ffe45c', trovao: '#7ad7ff', tornado: '#9be8ff',
  dragao: '#ff5a1a', meteoro: '#ff7a1a', atomico: '#7dff6a', cosmico: '#b05cff', ira: '#fff3a0',
};

function superScene(c: CanvasRenderingContext2D, W: number, H: number, type: string, me: Look, t: number) {
  const col = SUPER_COL[type] ?? '#ffd23d';
  const g = c.createRadialGradient(W / 2, H * 0.5, 4, W / 2, H * 0.5, W * 0.8);
  g.addColorStop(0, col + 'aa');
  g.addColorStop(0.5, '#1b1033');
  g.addColorStop(1, '#07050f');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  // raios de fundo
  add(c, () => {
    c.globalAlpha = 0.18;
    c.fillStyle = col;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      c.beginPath();
      c.moveTo(W / 2, H * 0.5);
      c.lineTo(W / 2 + Math.cos(a) * W, H * 0.5 + Math.sin(a) * W);
      c.lineTo(W / 2 + Math.cos(a + 0.18) * W, H * 0.5 + Math.sin(a + 0.18) * W);
      c.fill();
    }
  });
  const gy = H * 0.9;
  const cx = W / 2;
  zoom(c, cx, gy, 1.3);
  switch (type) {
    case 'supersoco':
      pose(c, me, 'haymaker', 0.12, cx - 24, gy, { expr: 'power' });
      impact(c, cx + 36, gy - 98, 26);
      break;
    case 'lariat':
      speedLines(c, 0, gy - 90, W * 0.4, gy - 90, 7, col);
      pose(c, me, 'clothes', 0.5, cx - 6, gy, { expr: 'power' });
      break;
    case 'relampago':
      for (let i = 0; i < 3; i++) {
        c.globalAlpha = 0.25 + i * 0.25;
        pose(c, me, i % 2 ? 'cross' : 'jab', 0.15, cx - 30 + i * 10, gy, { expr: 'power' });
      }
      c.globalAlpha = 1;
      bolt(c, cx + 40, 10, gy - 100, 3, col);
      bolt(c, cx - 50, 20, gy - 60, 9, col);
      break;
    case 'trovao':
      bolt(c, cx + 26, -10, gy - 140, 5, col, 4);
      pose(c, me, 'upper', 0.28, cx - 10, gy, { expr: 'power' });
      impact(c, cx + 26, gy - 150, 16, col);
      break;
    case 'tornado':
      add(c, () => {
        c.strokeStyle = col;
        for (let i = 0; i < 6; i++) {
          c.globalAlpha = 0.5;
          c.lineWidth = 3;
          c.beginPath();
          c.ellipse(cx, gy - 20 - i * 26, 30 + i * 9, 8 + i * 2, 0, 0, TAU);
          c.stroke();
        }
      });
      pose(c, me, 'spin', 0.5, cx, gy, { expr: 'power', dy: -20 });
      break;
    case 'dragao': {
      pose(c, me, 'haymaker', 0.12, cx - 40, gy, { expr: 'power' });
      add(c, () => {
        for (let i = 0; i < 9; i++) {
          const k = i / 8;
          const x = cx + 4 + k * 70;
          const y = gy - 100 - Math.sin(k * Math.PI * 1.5) * 34;
          c.globalAlpha = 0.9;
          c.drawImage(glowSprite(i % 2 ? '#ff5a1a' : '#ffb000'), x - 22 + k * 4, y - 22, 44 - k * 10, 44 - k * 10);
        }
        c.globalAlpha = 1;
        flame(c, cx + 80, gy - 128, 1, -0.3, 34, 12, '#ff5a1a', '#ffe14a', t, 2);
      });
      // cabeça de dragão estilizada
      c.fillStyle = '#ff3a1a';
      c.strokeStyle = '#1a1220';
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(cx + 64, gy - 132);
      c.lineTo(cx + 92, gy - 124);
      c.lineTo(cx + 74, gy - 112);
      c.lineTo(cx + 90, gy - 104);
      c.lineTo(cx + 58, gy - 106);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = '#fff3a0';
      c.beginPath();
      c.arc(cx + 70, gy - 122, 2.5, 0, TAU);
      c.fill();
      break;
    }
    case 'meteoro':
      add(c, () => {
        for (let i = 0; i < 8; i++) {
          c.globalAlpha = 0.8 - i * 0.08;
          c.drawImage(glowSprite(i % 2 ? '#ff7a1a' : '#ffd23d'), cx + 20 + i * 12 - 26, gy - 120 - i * 14 - 26, 52, 52);
        }
      });
      pose(c, me, 'splash', 0.3, cx - 6, gy, { rot: 0.7, dy: -50, expr: 'power' });
      impact(c, cx - 30, gy - 8, 16, '#ff7a1a');
      break;
    case 'atomico':
      add(c, () => {
        c.strokeStyle = col;
        c.lineWidth = 2.5;
        for (let i = 0; i < 3; i++) {
          c.globalAlpha = 0.75;
          c.beginPath();
          c.ellipse(cx, gy - 90, 70, 22, (i * Math.PI) / 3, 0, TAU);
          c.stroke();
        }
        c.globalAlpha = 0.9;
        c.drawImage(glowSprite(col), cx - 30, gy - 120, 60, 60);
      });
      pose(c, me, 'arch', 0.3, cx, gy, { expr: 'power' });
      break;
    case 'cosmico':
      add(c, () => {
        for (let i = 0; i < 120; i++) {
          const r = (i / 120) * 80;
          const a = r * 0.09 + (i % 2) * Math.PI;
          c.globalAlpha = 0.8;
          c.fillStyle = i % 4 ? '#e8dcff' : '#7af7ff';
          c.fillRect(cx + 34 + Math.cos(a) * r, gy - 100 + Math.sin(a) * r * 0.45, 1.8, 1.8);
        }
        c.drawImage(glowSprite(col), cx + 4, gy - 130, 60, 60);
      });
      pose(c, me, 'haymaker', 0.12, cx - 34, gy, { expr: 'power' });
      break;
    case 'ira':
      add(c, () => {
        const b = c.createLinearGradient(cx - 30, 0, cx + 30, 0);
        b.addColorStop(0, 'rgba(255,243,160,0)');
        b.addColorStop(0.5, 'rgba(255,250,220,0.85)');
        b.addColorStop(1, 'rgba(255,243,160,0)');
        c.fillStyle = b;
        c.fillRect(cx - 30, 0, 60, gy);
      });
      pose(c, me, 'wings', 0.3, cx, gy, { expr: 'power' });
      for (const sd of [-1, 1]) {
        c.fillStyle = '#fffdf2';
        c.strokeStyle = '#1a1220';
        c.lineWidth = 2.5;
        c.beginPath();
        c.moveTo(cx + sd * 10, gy - 110);
        c.quadraticCurveTo(cx + sd * 70, gy - 170, cx + sd * 90, gy - 120);
        c.quadraticCurveTo(cx + sd * 66, gy - 112, cx + sd * 74, gy - 92);
        c.quadraticCurveTo(cx + sd * 46, gy - 96, cx + sd * 10, gy - 96);
        c.closePath();
        c.fill();
        c.stroke();
      }
      break;
    default:
      pose(c, me, 'charge', 0.3, cx, gy, { expr: 'power' });
  }
}

// ───────────────────────── Entradas ─────────────────────────

const ENT_POSE: Record<string, [AnimName, number]> = {
  victory: ['victory', 0.5], dance: ['dance', 0.3], flex: ['flex', 0.6], point: ['point', 0.6],
};

function entranceScene(c: CanvasRenderingContext2D, W: number, H: number, d: ItemDef, me: Look, t: number) {
  const type = d.vis?.type ?? 'classica';
  const gy = H * 0.86;
  const cx = W / 2;
  const bg = c.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#07050f');
  bg.addColorStop(1, '#1d1636');
  c.fillStyle = bg;
  c.fillRect(0, 0, W, H);
  // plataforma / rampa
  c.fillStyle = '#2a2440';
  c.fillRect(0, gy, W, H - gy);
  const back = () => {
    switch (type) {
      case 'classica':
        add(c, () => {
          c.globalAlpha = 0.35;
          c.fillStyle = '#fff6d0';
          c.beginPath();
          c.moveTo(cx - 8, 0);
          c.lineTo(cx + 8, 0);
          c.lineTo(cx + 55, gy);
          c.lineTo(cx - 55, gy);
          c.fill();
        });
        break;
      case 'danca':
        add(c, () => {
          for (let i = 0; i < 26; i++) {
            c.globalAlpha = 0.8;
            c.fillStyle = ['#ff3df0', '#3df0ff', '#ffe45c', '#7dff6a'][i % 4];
            c.beginPath();
            c.arc(hash(i) * W, hash(i + 4) * gy, 2.5, 0, TAU);
            c.fill();
          }
        });
        c.fillStyle = '#c9d2de';
        c.beginPath();
        c.arc(cx, 26, 16, 0, TAU);
        c.fill();
        c.strokeStyle = '#59627a';
        c.lineWidth = 1;
        for (let i = -2; i <= 2; i++) {
          c.beginPath();
          c.moveTo(cx - 16, 26 + i * 6);
          c.lineTo(cx + 16, 26 + i * 6);
          c.moveTo(cx + i * 6, 10);
          c.lineTo(cx + i * 6, 42);
          c.stroke();
        }
        break;
      case 'lasers':
        add(c, () => {
          c.lineWidth = 3;
          ['#ff2a4a', '#3df0ff', '#7dff6a', '#ff3df0'].forEach((col, i) => {
            c.strokeStyle = col;
            c.globalAlpha = 0.8;
            c.beginPath();
            c.moveTo(i % 2 ? 0 : W, 10 + i * 8);
            c.lineTo(cx + (i - 1.5) * 30, gy);
            c.stroke();
          });
        });
        break;
      case 'pirotecnia':
        add(c, () => {
          for (const x of [W * 0.12, W * 0.88]) for (let i = 0; i < 3; i++) flame(c, x + (i - 1) * 6, gy, 0, -1, 90 + i * 14, 12, '#ff5a00', '#ffd000', t, i + x);
        });
        break;
      case 'fogos':
        add(c, () => {
          [[0.22, 0.2, '#ff3d6e'], [0.78, 0.16, '#3df0ff'], [0.55, 0.08, '#ffe45c']].forEach(([fx, fy, col], j) => {
            for (let i = 0; i < 14; i++) {
              const a = (i / 14) * TAU;
              c.strokeStyle = col as string;
              c.globalAlpha = 0.9;
              c.lineWidth = 2;
              c.beginPath();
              const x0 = W * (fx as number);
              const y0 = H * (fy as number) + 10;
              c.moveTo(x0 + Math.cos(a) * 6, y0 + Math.sin(a) * 6);
              c.lineTo(x0 + Math.cos(a) * (20 + j * 3), y0 + Math.sin(a) * (20 + j * 3));
              c.stroke();
            }
          });
        });
        break;
      case 'trovao':
        c.fillStyle = '#27324d';
        for (let i = 0; i < 5; i++) {
          c.beginPath();
          c.ellipse(i * W * 0.25, 14, 40, 18, 0, 0, TAU);
          c.fill();
        }
        bolt(c, W * 0.18, 20, gy, 11);
        bolt(c, W * 0.84, 20, gy, 17);
        break;
      case 'rei': {
        c.fillStyle = '#b3121f';
        c.beginPath();
        c.moveTo(cx - 26, gy);
        c.lineTo(cx + 26, gy);
        c.lineTo(cx + 60, H);
        c.lineTo(cx - 60, H);
        c.fill();
        for (let i = 0; i < 40; i++) {
          c.fillStyle = i % 3 ? '#ffd23d' : '#fff3b0';
          c.save();
          c.translate(hash(i) * W, hash(i + 9) * gy);
          c.rotate(hash(i + 3) * 6);
          c.fillRect(-3, -1.5, 6, 3);
          c.restore();
        }
        break;
      }
      case 'coroacao': {
        add(c, () => {
          c.globalAlpha = 0.8;
          c.drawImage(glowSprite('#ffd23d'), cx - 60, 10, 120, 90);
        });
        // coroa de ouro a descer
        c.fillStyle = '#ffd23d';
        c.strokeStyle = '#6a3c00';
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(cx - 30, 70);
        c.lineTo(cx - 30, 38);
        c.lineTo(cx - 15, 54);
        c.lineTo(cx, 28);
        c.lineTo(cx + 15, 54);
        c.lineTo(cx + 30, 38);
        c.lineTo(cx + 30, 70);
        c.closePath();
        c.fill();
        c.stroke();
        c.fillStyle = '#b05cff';
        for (const dx of [-16, 0, 16]) {
          c.beginPath();
          c.arc(cx + dx, 62, 4, 0, TAU);
          c.fill();
        }
        for (let i = 0; i < 40; i++) {
          c.fillStyle = i % 2 ? '#ffd23d' : '#b05cff';
          c.save();
          c.translate(hash(i) * W, hash(i + 9) * gy);
          c.rotate(hash(i + 3) * 6);
          c.fillRect(-3, -1.5, 6, 3);
          c.restore();
        }
        break;
      }
      case 'dragao':
        add(c, () => {
          for (let i = 0; i < 10; i++) {
            const k = i / 9;
            c.globalAlpha = 0.85;
            c.drawImage(glowSprite(i % 2 ? '#ff5a1a' : '#ffb000'), W * (0.05 + k * 0.85) - 18, 30 + Math.sin(k * 6) * 14 - 18, 36, 36);
          }
        });
        c.fillStyle = '#3a0a08';
        c.beginPath();
        c.moveTo(W * 0.92, 24);
        c.lineTo(W * 1.02, 14);
        c.lineTo(W * 0.98, 34);
        c.closePath();
        c.fill();
        break;
      case 'cosmica':
        add(c, () => {
          for (let i = 0; i < 60; i++) {
            c.globalAlpha = 0.5 + hash(i) * 0.5;
            c.fillStyle = '#ffffff';
            c.fillRect(hash(i) * W, hash(i + 5) * gy, 1.5, 1.5);
          }
          c.globalAlpha = 0.9;
          c.drawImage(glowSprite('#b05cff'), cx - 70, gy - 170, 140, 140);
        });
        c.strokeStyle = '#7af7ff';
        c.lineWidth = 5;
        c.beginPath();
        c.ellipse(cx, gy - 100, 48, 62, 0, 0, TAU);
        c.stroke();
        break;
    }
  };
  back();
  const [an, at] = ENT_POSE[d.vis?.style ?? 'victory'] ?? ENT_POSE.victory;
  shadow(c, cx, gy, 40);
  pose(c, me, an, at, cx, gy, { expr: 'happy', k: 0.6 });
  if (type === 'fumo') {
    for (let i = 0; i < 12; i++) {
      c.globalAlpha = 0.75;
      c.fillStyle = i % 2 ? '#d9dde6' : '#b9bfcc';
      c.beginPath();
      c.arc(hash(i) * W, gy - hash(i + 2) * 40, 16 + hash(i + 7) * 14, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
  }
}

// ───────────────────────── API ─────────────────────────

const cache = new Map<string, HTMLCanvasElement>();

/** Miniatura ilustrada (ou null se o item não tiver uma). */
export function specialThumb(id: string, size: number): HTMLCanvasElement | null {
  const d = item(id);
  if (!['move', 'moveStyle', 'super', 'entrance'].includes(d.kind)) return null;
  const a = S.appearance;
  const key = `${id}|${size}|${a.skin}|${a.hair}|${a.hairColor}|${a.beard}|${S.loadout.outfit}|${S.loadout.gloves}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const W = 220;
  const H = 220;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.scale(size / W, size / H);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const me = meLook();
  const op = oppLook();
  const col = RARITIES[d.rarity].color.length === 7 ? RARITIES[d.rarity].color : '#a98bff';
  if (d.kind === 'move' || d.kind === 'moveStyle') {
    const gy = H * 0.86;
    ringBack(ctx, W, H, col, gy);
    const f = MOVES[d.vis?.type ?? ''] ?? MOVES.dropkick;
    ctx.save();
    zoom(ctx, W / 2, gy, 1.4);
    shadow(ctx, W * 0.42, gy);
    shadow(ctx, W * 0.66, gy);
    const hit = f(ctx, W, H, gy, me, op);
    if (hit) impact(ctx, hit[0], hit[1], d.kind === 'moveStyle' ? 18 : 13, d.kind === 'moveStyle' ? d.vis?.c1 ?? '#ffd23d' : '#ffd23d');
    if (d.kind === 'moveStyle') {
      const sc = d.vis?.c1 ?? '#ffd23d';
      add(ctx, () => {
        ctx.globalAlpha = 0.55;
        ctx.drawImage(glowSprite(sc), 0, H * 0.1, W, H * 0.8);
        for (let i = 0; i < 18; i++) {
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = i % 2 ? sc : '#ffffff';
          ctx.fillRect(hash(i) * W, hash(i + 3) * gy, 3, 3);
        }
      });
      if (d.vis?.style === 'raio') bolt(ctx, W * 0.6, 0, gy - 60, 21, sc);
    }
    ctx.restore();
  } else if (d.kind === 'super') {
    ctx.save();
    superScene(ctx, W, H, d.vis?.type ?? '', me, 1.2);
    ctx.restore();
  }
  else entranceScene(ctx, W, H, d, me, 1.2);
  ctx.setTransform(size / W, 0, 0, size / H, 0, 0);
  // vinheta
  const v = ctx.createRadialGradient(W / 2, H / 2, W * 0.35, W / 2, H / 2, W * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  cache.set(key, c);
  return c;
}
