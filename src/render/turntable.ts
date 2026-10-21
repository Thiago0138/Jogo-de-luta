import { shade } from '../data/appearance';
import type { Vis } from '../data/items';
import { drawAura } from './aura';
import { bodyPieces, chestDecal, headPieces, hidesHair, hidesMask, matPattern } from './costume';
import { eye, hairBack as hairBackGame, hairColors, outfitC1, type DrawOpts, type Expr } from './fighter';
import { drawBootTo, drawGlove } from './gloves';
import type { Look } from './look';
import {
  ARM_L, ARM_U, C, Cam, DL, LEG_L, LEG_U, OC, OW, PS, TAU, capsule, ell, glowSprite, hash, limb, proj3D, seg, sheet,
  sphereRegion, spherePt, spike, tube, viewDir, type Proj, type V3,
} from './paint';
import {
  HEAD_R, J_BE, J_BF, J_BH, J_BK, J_FE, J_FF, J_FH, J_FK, J_HEAD, J_HIP, J_NECK, J_SH, Skel,
} from './pose';

/**
 * Lutador em 3D (projeção ortográfica) para a rotação de 360° nos menus.
 * Usa o mesmo esqueleto das lutas, acrescenta profundidade aos membros e desenha o tronco
 * como uma superfície, a cabeça como uma esfera com a cara mapeada e o cabelo como calota.
 * yaw 0 = perfil a olhar para a direita; π/2 = de frente; π = perfil para a esquerda; -π/2 = de costas.
 */

const R = HEAD_R;
const PITCH = 0.1;

// secções do tronco: altura u, meia-largura a (lateral), meia-espessura b, avanço c
const SEC: [number, number, number, number][] = [
  [-15, 16, 12, 0],
  [-7, 21, 15, -1.5],
  [3, 21, 15, 0],
  [15, 19.5, 14, 1],
  [28, 23, 16, 2.5],
  [40, 27, 18, 4],
  [49, 29.5, 15.5, 2.5],
  [55, 26, 12, 0],
  [60, 14, 9.5, -1],
];
const NPHI = 24;

const cam = new Cam();
const ps = new Skel();
const dl = new DL();

type Pt = [number, number, number];

let torsoSil: Path2D | null = null;

function sec(u: number): [number, number, number] {
  for (let i = 0; i < SEC.length - 1; i++) {
    const a = SEC[i];
    const b = SEC[i + 1];
    if (u <= b[0] || i === SEC.length - 2) {
      const k = Math.max(0, Math.min(1, (u - a[0]) / (b[0] - a[0])));
      const e = k * k * (3 - 2 * k);
      return [a[1] + (b[1] - a[1]) * e, a[2] + (b[2] - a[2]) * e, a[3] + (b[3] - a[3]) * e];
    }
  }
  return [SEC[0][1], SEC[0][2], SEC[0][3]];
}

export function drawFighter3D(ctx: CanvasRenderingContext2D, L: Look, s: Skel, yaw: number, o: DrawOpts): void {
  if (o.rim && !o.flash) {
    PS.F = true;
    PS.SIL = o.rim;
    ctx.save();
    ctx.translate(-2.6, -2.2);
    body3D(ctx, L, s, yaw, o);
    ctx.restore();
    PS.SIL = null;
  }
  PS.F = o.flash;
  body3D(ctx, L, s, yaw, o);
  PS.F = false;
}

function body3D(ctx: CanvasRenderingContext2D, L: Look, s: Skel, yaw: number, o: DrawOpts) {
  const t = o.t;
  cam.set(yaw, PITCH);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const X = s.x;
  const Y = s.y;
  const out = L.outfit;
  const style = out.style ?? 'trunks';
  const suit = style === 'none';

  // articulações com profundidade
  const J = (j: number, z: number): Pt => cam.w(X[j], Y[j], z);
  const fsh = J(J_SH, 23), fel = J(J_FE, 22), fha = J(J_FH, 12);
  const bsh = J(J_SH, -23), bel = J(J_BE, -22), bha = J(J_BH, -12);
  const fhip = cam.w(X[J_HIP] + 3, Y[J_HIP], 9), fkn = J(J_FK, 10), fft = J(J_FF, 11);
  const bhip = cam.w(X[J_HIP] - 3, Y[J_HIP], -9), bkn = J(J_BK, -10), bft = J(J_BF, -11);
  const head = J(J_HEAD, 0);
  const neck = J(J_NECK, 0);
  const shc = J(J_SH, 0);

  // esqueleto projetado (para a aura)
  for (let j = 0; j < 12; j++) {
    const p = cam.w(X[j], Y[j], 0);
    ps.x[j] = p[0];
    ps.y[j] = p[1];
  }
  ps.torsoA = s.torsoA;
  if (L.aura && !PS.F) drawAura(ctx, L.aura, ps, t, false);

  const T = proj3D(cam, [X[J_SH], Y[J_SH], 0], s.torsoA);
  const Hp = proj3D(cam, [X[J_HIP], Y[J_HIP], 0], s.torsoA);
  if (out.back || out.tail || out.shoulders) bodyPieces(dl, ctx, out, T, Hp, t, false);

  const skinB = shade(L.body, -0.12);
  const legC = style === 'gi' ? outfitC1(out, t) : style === 'armor' ? out.boots ?? '#222' : L.body;
  const boots = out.boots ?? '#222';
  const sleeve = style === 'gi' && !out.suit ? outfitC1(out, t) : null;
  const deco = (base: number) =>
    out.mat ? (M: (t: number, s: number) => [number, number], len: number, i: number) => matPattern(ctx, out, M, len, t, base + i) : undefined;

  const arm = (sh: Pt, el: Pt, ha: Pt, front: boolean) => () => {
    const col = front ? L.body : skinB;
    const bare = !sleeve && (style === 'trunks' || style === 'singlet' || style === 'none');
    const soft = bare && torsoSil && !PS.F ? { over: torsoSil, color: shade(L.bodyShade, -0.25) } : undefined;
    limb(ctx, sh[0], sh[1], el[0], el[1], ha[0], ha[1], ARM_U, ARM_L, col, front ? L.bodyShade : shade(L.bodyShade, -0.12), deco(front ? 7 : 1), soft);
    // ombro fundido com o tronco (sem o "anel" de boneco articulado)
    if (torsoSil && !PS.F && !sleeve && (style === 'trunks' || style === 'singlet' || style === 'none')) {
      ctx.save();
      ctx.clip(torsoSil);
      const k = Math.max(0.5, 1 - (OW * 0.6) / ARM_U[1]);
      const ex = sh[0] + (el[0] - sh[0]) * 0.4;
      const ey = sh[1] + (el[1] - sh[1]) * 0.4;
      ctx.beginPath();
      capsule(ctx, sh[0], sh[1], ex, ey, [ARM_U[0], ARM_U[1], ARM_U[1]], k);
      ctx.arc(sh[0], sh[1], ARM_U[0] * k + 2, 0, TAU);
      ctx.fillStyle = C(col);
      ctx.fill();
      ctx.restore();
    }
    if (sleeve) seg(ctx, sh[0], sh[1], sh[0] + (el[0] - sh[0]) * 0.8, sh[1] + (el[1] - sh[1]) * 0.8, 23, front ? sleeve : shade(sleeve, -0.12));
    if (style === 'armor' && !out.shoulders) ell(ctx, { p: (x, y, z) => [sh[0] + x, sh[1] + y, z] }, 0, 0, 0, 12, 12, 12, out.c3 ?? out.c2 ?? '#aaa');
    drawGlove(ctx, L.gloves, ha[0], ha[1], Math.atan2(ha[0] - el[0], ha[1] - el[1]), t, col, !front);
  };
  const leg = (hp: Pt, kn: Pt, ft: Pt, front: boolean, j: number) => () => {
    const col = front ? legC : shade(legC, -0.12);
    limb(ctx, hp[0], hp[1], kn[0], kn[1], ft[0], ft[1], LEG_U, LEG_L, col, legC === L.body ? L.bodyShade : shade(col, -0.3), legC === L.body ? deco(front ? 5 : 3) : undefined);
    if (!suit && style !== 'gi') {
      // perna dos calções
      const tc = style === 'jacket' ? out.c2 ?? '#fff' : outfitC1(out, t);
      const k = 0.42;
      ctx.beginPath();
      const mx = hp[0] + (kn[0] - hp[0]) * k;
      const my = hp[1] + (kn[1] - hp[1]) * k;
      ctx.lineCap = 'round';
      seg(ctx, hp[0], hp[1] - 4, mx, my, 30, tc);
      if (!PS.F) {
        ctx.globalAlpha = 0.3;
        seg(ctx, hp[0] + 3, hp[1] - 2, mx + 3, my, 18, shade(tc, -0.45), false);
        ctx.globalAlpha = 1;
      }
    }
    if ((style === 'trunks' || style === 'singlet') && !out.suit) {
      const kx = kn[0], ky = kn[1];
      const pc = front ? out.c2 ?? '#ffffff' : shade(out.c2 ?? '#ffffff', -0.12);
      const k0x = kx + (hp[0] - kx) * 0.15, k0y = ky + (hp[1] - ky) * 0.15;
      const k1x = kx + (ft[0] - kx) * 0.18, k1y = ky + (ft[1] - ky) * 0.18;
      seg(ctx, k0x, k0y, k1x, k1y, 21, pc);
      if (!PS.F) {
        ctx.globalAlpha = 0.35;
        seg(ctx, k0x + 4, k0y, k1x + 4, k1y, 11, shade(pc, -0.45), false);
        ctx.globalAlpha = 0.5;
        seg(ctx, k0x - 4, k0y + 2, k1x - 4, k1y - 2, 3, '#ffffff', false);
        ctx.globalAlpha = 1;
      }
    }
    const fa = j === J_FF ? s.flL : s.blL;
    const toe = cam.w(X[j] + Math.cos(fa) * 16, Y[j] - Math.sin(fa) * 16, front ? 12 : -12);
    drawBootTo(ctx, kn[0], kn[1], ft[0], ft[1], toe[0], toe[1], Math.atan2(-(toe[1] - ft[1]), toe[0] - ft[0]), front ? boots : shade(boots, -0.12), out.mat);
  };

  const mid = (...p: Pt[]) => p.reduce((a, b) => a + b[2], 0) / p.length;
  dl.add(mid(bsh, bel, bha), arm(bsh, bel, bha, false));
  dl.add(mid(fsh, fel, fha), arm(fsh, fel, fha, true));
  dl.add(mid(bhip, bkn, bft) - 2, leg(bhip, bkn, bft, false, J_BF));
  dl.add(mid(fhip, fkn, fft) - 2, leg(fhip, fkn, fft, true, J_FF));
  torsoSil = null;
  dl.add(0, () => {
    const nx1 = head[0] * 0.45 + neck[0] * 0.55;
    const ny1 = head[1] * 0.45 + neck[1] * 0.55;
    seg(ctx, shc[0], shc[1], nx1, ny1, 19, suit && out.head !== 'astro' ? L.body : L.skin);
    if (!PS.F) {
      // sombra do maxilar no pescoço
      ctx.globalAlpha = 0.55;
      seg(ctx, nx1, ny1 + 1, nx1 + (shc[0] - nx1) * 0.35, ny1 + 1 + (shc[1] - ny1) * 0.35, 15, suit && out.head !== 'astro' ? L.bodyShade : L.skinShade, false);
      ctx.globalAlpha = 1;
    }
    torso3D(ctx, L, s, t);
  });
  dl.add(Math.max(head[2], 0) + 1, () => head3D(ctx, L, s, o.expr, t));
  dl.flush();
}

// ───────────────────────── Tronco ─────────────────────────

function torso3D(ctx: CanvasRenderingContext2D, L: Look, s: Skel, t: number) {
  const o = L.outfit;
  const style = o.style ?? 'trunks';
  const a = s.torsoA;
  const ux = Math.sin(a), uy = -Math.cos(a);
  const fx = Math.cos(a), fy = Math.sin(a);
  const hx = s.x[J_HIP], hy = s.y[J_HIP];
  const v = [cam.w(fx, fy, 0)[2], cam.w(0, 0, 1)[2]]; // componente de vista da frente e do lado
  const P = (u: number, phi: number, k = 1): V3 => {
    const [sa, sb, sc] = sec(u);
    const f = sc + sb * Math.cos(phi) * k;
    const z = sa * Math.sin(phi) * k;
    return cam.w(hx + ux * u + fx * f, hy + uy * u + fy * f, z);
  };
  const nd = (u: number, phi: number) => {
    const [sa, sb] = sec(u);
    const nx = Math.cos(phi) / sb;
    const nz = Math.sin(phi) / sa;
    const l = Math.hypot(nx, nz);
    return (nx * v[0] + nz * v[1]) / l;
  };
  const nX = (u: number, phi: number) => {
    const [sa, sb] = sec(u);
    const nx = Math.cos(phi) / sb;
    const nz = Math.sin(phi) / sa;
    const l = Math.hypot(nx, nz);
    const w = cam.w(fx * nx / l, fy * nx / l, nz / l);
    return w[0];
  };
  const U0 = -15;
  const U1 = 60;
  const NU = 10;
  const us: number[] = [];
  for (let i = 0; i <= NU; i++) us.push(U0 + ((U1 - U0) * i) / NU);

  // silhueta
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (const u of us) {
    let mn = Infinity, mx = -Infinity, my1 = 0, my2 = 0;
    for (let j = 0; j < 32; j++) {
      const p = P(u, (j / 32) * TAU);
      if (p[0] < mn) { mn = p[0]; my1 = p[1]; }
      if (p[0] > mx) { mx = p[0]; my2 = p[1]; }
    }
    left.push([mn, my1]);
    right.push([mx, my2]);
  }
  ctx.beginPath();
  right.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  for (let i = left.length - 1; i >= 0; i--) ctx.lineTo(left[i][0], left[i][1]);
  ctx.closePath();
  // guarda a silhueta do tronco para fundir os ombros (os braços da frente desenham-se depois)
  const sil = new Path2D();
  right.forEach((p, i) => (i ? sil.lineTo(p[0], p[1]) : sil.moveTo(p[0], p[1])));
  for (let i = left.length - 1; i >= 0; i--) sil.lineTo(left[i][0], left[i][1]);
  sil.closePath();
  torsoSil = sil;
  ctx.lineWidth = OW;
  ctx.strokeStyle = OC();
  ctx.stroke();
  ctx.fillStyle = C(L.body);
  ctx.fill();

  // material de cada pedaço da superfície
  const c1 = outfitC1(o, t);
  const c2 = o.c2 ?? '#fff';
  const c3 = o.c3 ?? c2;
  const bellyMat = o.mat === 'dino' || o.mat === 'shark' || o.mat === 'dragon' || o.mat === 'feather';
  const beltMat = o.mat === 'astro' || o.mat === 'metal' || o.mat === 'cosmic' || o.mat === 'feather' || o.mat === 'gold';
  const mat = (u: number, phi: number): string => {
    const cf = Math.cos(phi);
    const sf = Math.abs(Math.sin(phi));
    switch (style) {
      case 'trunks':
        if (u < 9) return c1;
        if (u < 13) return c2;
        return L.body;
      case 'singlet':
        if (u < 9) return c1;
        if (u < 36 + cf * 2) return c1;
        if (u < 57 && sf > 0.36 && sf < 0.64) return c1;
        return L.body;
      case 'gi':
        if (u > 7 && u < 13) return c2;
        if (cf > 0.5 && u > 24 && sf < (u - 24) / 70 + 0.05) return L.skin;
        return c1;
      case 'jacket':
        if (u < 9) return c2;
        if (cf > 0.72 && u > 10 && sf < 0.42) return L.body;
        return c1;
      case 'armor':
        if (u > 9 && u < 13) return c3;
        if (cf > 0.3 && u > 20 && u < 47) return cf > 0.42 && u > 22 && u < 45 ? c2 : c3;
        return c1;
      default:
        if (beltMat && u > 8 && u < 13) return o.mat === 'astro' ? '#cfd6e2' : o.mat === 'metal' ? '#59627a' : o.mat === 'gold' ? (o.cape ?? '#5b1fa8') : '#ffd23d';
        if (bellyMat && cf > 0.45 && u > -6 && u < 48) return c2;
        return L.body;
    }
  };
  const shadeCache = new Map<string, string>();
  const sh = (c: string) => {
    let r = shadeCache.get(c);
    if (!r) {
      r = shade(c, -0.22);
      shadeCache.set(c, r);
    }
    return r;
  };
  const coreB = shade(L.bodyShade, -0.14);
  const sh2 = (c: string) => {
    const k = c + '#2';
    let r = shadeCache.get(k);
    if (!r) {
      r = shade(c, -0.34);
      shadeCache.set(k, r);
    }
    return r;
  };
  ctx.lineWidth = 1;
  for (let i = 0; i < NU; i++) {
    for (let j = 0; j < NPHI; j++) {
      const p0 = (j / NPHI) * TAU;
      const p1 = ((j + 1) / NPHI) * TAU;
      const um = (us[i] + us[i + 1]) / 2;
      const pm = (p0 + p1) / 2;
      if (nd(um, pm) < -0.12) continue;
      let col = mat(um, pm);
      if (col === L.body && o.anim === 'cosmic') col = c1;
      const lx = nX(um, pm);
      const fill = C(lx > 0.3 ? (col === L.body ? (lx > 0.78 ? coreB : L.bodyShade) : lx > 0.78 ? sh2(col) : sh(col)) : col);
      const a1 = P(us[i], p0), b1 = P(us[i], p1), c4 = P(us[i + 1], p1), d1 = P(us[i + 1], p0);
      ctx.beginPath();
      ctx.moveTo(a1[0], a1[1]);
      ctx.lineTo(b1[0], b1[1]);
      ctx.lineTo(c4[0], c4[1]);
      ctx.lineTo(d1[0], d1[1]);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.strokeStyle = fill;
      ctx.fill();
      ctx.stroke();
    }
  }
  if (PS.F) return;

  // linhas na superfície (só a parte virada para quem vê)
  const sline = (pts: [number, number][], w: number, col: string, alpha = 1) => {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    let on = false;
    for (const [u, phi] of pts) {
      if (nd(u, phi) < 0.08) {
        on = false;
        continue;
      }
      const p = P(u, phi, 1.01);
      if (on) ctx.lineTo(p[0], p[1]);
      else ctx.moveTo(p[0], p[1]);
      on = true;
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  };
  const arc = (u: number, p0: number, p1: number, n = 10, du = 0): [number, number][] => {
    const r: [number, number][] = [];
    for (let k = 0; k <= n; k++) {
      const q = k / n;
      r.push([u + du * Math.sin(q * Math.PI), p0 + (p1 - p0) * q]);
    }
    return r;
  };
  const bare = !(style === 'gi' || style === 'armor' || style === 'jacket' || style === 'none');
  if (bare) {
    // peitorais, abdominais e coluna
    for (const sd of [-1, 1]) {
      sline(arc(38.5, sd * 0.1, sd * 1.0, 8, -4), 5, L.bodyShade, 0.4);
      sline(arc(40, sd * 0.08, sd * 1.05, 8, -4), 2.6, L.bodyShade, 0.85);
      sline([[42, sd * 1.15], [36, sd * 1.25], [30, sd * 1.2]], 1.8, L.bodyShade, 0.45);
    }
    sline([[23, -0.62], [14, -0.4]], 1.8, L.bodyShade, 0.45);
    sline([[23, 0.62], [14, 0.4]], 1.8, L.bodyShade, 0.45);
    // brilho de suor no peito e nos abdominais
    ctx.fillStyle = '#ffffff';
    for (const [u, phi, r] of [[46, -0.45, 6], [46, 0.45, 6], [25, -0.16, 2.4], [25, 0.16, 2.4]] as const) {
      const d = nd(u, phi);
      if (d < 0.3) continue;
      const p = P(u, phi, 1.01);
      ctx.globalAlpha = 0.24 * d;
      ctx.beginPath();
      ctx.ellipse(p[0], p[1], r * d, r * 0.45, -0.3, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    sline([[34, 0], [12, 0]], 2, L.bodyShade, 0.55);
    for (const u of [28, 21]) sline(arc(u, -0.32, 0.32, 4), 2, L.bodyShade, 0.5);
    sline([[50, Math.PI], [14, Math.PI]], 2.2, L.bodyShade, 0.5);
    for (const sd of [-1, 1]) sline(arc(46, Math.PI + sd * 0.25, Math.PI + sd * 1.0, 6, -6), 2, L.bodyShade, 0.45);
  }
  if (style === 'singlet' && o.pattern === 'stars') {
    ctx.fillStyle = c2;
    for (const [u, phi, r] of [[22, 0.2, 6], [12, -0.5, 4], [18, Math.PI, 6]] as const) {
      if (nd(u, phi) < 0.1) continue;
      const p = P(u, phi, 1.01);
      star(ctx, p[0], p[1], r * Math.max(0.4, nd(u, phi)));
    }
  } else if (o.pattern === 'stripe' && style === 'singlet') {
    sline(arc(34, -Math.PI, Math.PI, 24), 4, c2);
  } else if (o.pattern === 'lightning') {
    sline([[46, Math.PI + 0.6], [32, Math.PI + 0.2], [32, Math.PI + 0.5], [16, Math.PI + 0.1]], 3, c2);
  } else if (o.pattern === 'lacquer') {
    for (let i = 0; i < 4; i++) sline(arc(16 + i * 6, -Math.PI, Math.PI, 24), 2, c3);
  } else if (o.pattern === 'muscle') {
    for (const sd of [-1, 1]) sline(arc(38, sd * 0.06, sd * 0.7, 6, -3), 2, shade(c2, -0.4));
    sline([[34, 0], [24, 0]], 2, shade(c2, -0.4));
  } else if (o.pattern === 'royal') {
    sline(arc(34, -0.6, 0.6, 10, 5), 1.6, '#fff8d0');
    if (nd(34, 0) > 0.1) {
      const p = P(34, 0, 1.02);
      ctx.fillStyle = o.gem ?? '#d6202f';
      ctx.beginPath();
      ctx.arc(p[0], p[1], 4 * Math.max(0.4, nd(34, 0)), 0, TAU);
      ctx.fill();
    }
  } else if (o.pattern === 'spots') {
    ctx.fillStyle = c2;
    for (let i = 0; i < 8; i++) {
      const u = -10 + (i % 4) * 5;
      const phi = (i / 8) * TAU;
      if (nd(u, phi) < 0.1) continue;
      const p = P(u, phi, 1.01);
      ctx.beginPath();
      ctx.ellipse(p[0], p[1], 2.8, 1.8, i, 0, TAU);
      ctx.fill();
    }
  } else if (o.pattern === 'stripe' && style === 'trunks') {
    for (const sd of [-1, 1]) sline([[-2, sd * 1.2], [-14, sd * 1.3]], 3.5, c2);
  }
  if (style === 'trunks' && !o.suit) {
    ctx.setLineDash([2.2, 2]);
    sline(arc(9.8, -Math.PI, Math.PI, 30), 0.9, shade(c2.length === 7 ? c2 : '#ffffff', -0.4), 0.8);
    sline(arc(12.2, -Math.PI, Math.PI, 30), 0.9, shade(c2.length === 7 ? c2 : '#ffffff', -0.4), 0.8);
    ctx.setLineDash([]);
  }
  if (o.mat) {
    // material do fato, preso ao corpo (frente e costas)
    for (const base of [0, Math.PI]) {
      matPattern(ctx, o, (tt, ss) => {
        const u = -10 + tt * 64;
        const phi = base + ss * 1.45;
        if (nd(u, phi) < 0.1) return [NaN, NaN];
        const p = P(u, phi, 1.01);
        return [p[0], p[1]];
      }, 62, t, base ? 8 : 7);
    }
  }
  if (o.chest && nd(40, 0) > 0.12) {
    const c = P(40, 0, 1.02);
    const r = P(40, 0.1, 1.02);
    const up = P(41, 0, 1.02);
    const k = 0.62;
    const rx = (r[0] - c[0]) * 10 * k / (sec(40)[0] * 0.1 + 1e-6) * 0.1 * 10;
    void rx;
    // vetores unitários da superfície no ecrã (lateral e para cima)
    const sa = sec(40)[0];
    const lat: V3 = [(r[0] - c[0]) / (sa * 0.1), (r[1] - c[1]) / (sa * 0.1), 0];
    const upv: V3 = [up[0] - c[0], up[1] - c[1], 0];
    chestDecal(ctx, o, c[0], c[1], lat[0] * k, lat[1] * k, -upv[0] * k, -upv[1] * k, t);
  }
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

// ───────────────────────── Cabeça ─────────────────────────

const HAIRLINE: [number, number][] = [
  [0, -0.52], [0.7, -0.38], [1.0, -0.22], [1.12, 0.1], [1.3, 0.14], [1.45, -0.12], [1.8, -0.06], [2.4, 0.24], [Math.PI, 0.42],
];

function hairline(lon: number, low: number): number {
  let a = Math.abs(((lon + Math.PI) % TAU + TAU) % TAU - Math.PI);
  a = Math.min(a, Math.PI);
  for (let i = 0; i < HAIRLINE.length - 1; i++) {
    const p = HAIRLINE[i];
    const q = HAIRLINE[i + 1];
    if (a <= q[0]) {
      const k = (a - p[0]) / (q[0] - p[0]);
      const last = i === HAIRLINE.length - 2 ? low : q[1];
      return p[1] + (last - p[1]) * k;
    }
  }
  return low;
}

function head3D(ctx: CanvasRenderingContext2D, L: Look, s: Skel, expr: Expr, t: number) {
  const H = proj3D(cam, [s.x[J_HEAD], s.y[J_HEAD], 0], s.headA);
  const o = L.outfit;
  const hc = L.hairColor;
  const [c1, c2] = hairColors(hc, t);
  const style = L.hair.style ?? 'curto';
  const noHair = hidesHair(o);
  const mask = hidesMask(o) ? null : L.mask;
  const masked = mask?.style === 'luchador';
  const D0 = H.p(0, 0, 0)[2];
  const v = viewDir(H);
  const longHair = style === 'longo' || style === 'rabo' || style === 'trancas' || style === 'mullet' || style === 'cometa';
  const showHair = !noHair && (!masked || longHair);

  // cabelo/peças que ficam atrás da cabeça
  if (o.head) headPieces(ctx, o, H, t, 'back');
  if (showHair) hair3D(ctx, H, style, c1, c2, t, 'back', masked);
  const skin = masked ? C(mask!.c1 ?? '#22f') : L.skin;
  // orelhas
  for (const sd of [-1, 1]) {
    const e = H.p(-1, 5, sd * (R - 1));
    if (e[2] < D0) ear(ctx, H, sd, L);
  }
  // crânio + maxilar
  const c = H.p(0, 0, 0);
  ctx.beginPath();
  ctx.arc(c[0], c[1], R, 0, TAU);
  ctx.lineWidth = OW;
  ctx.strokeStyle = OC();
  ctx.stroke();
  // maxilar mais largo e queixo marcado: a cabeça deixa de ser uma bola
  ell(ctx, H, 7, 14, 0, 20.5, 18, 20, skin, { line: OW, shade: null, hi: false });
  ell(ctx, H, 15, 24, 0, 11, 10.5, 12, skin, { line: OW, shade: null, hi: false });
  ctx.beginPath();
  ctx.arc(c[0], c[1], R, 0, TAU);
  ctx.fillStyle = C(skin);
  ctx.fill();
  // as duas formas fundem-se sem contorno por dentro
  ell(ctx, H, 7, 14, 0, 19, 16.5, 18.5, skin, { line: 0, shade: null, hi: false });
  ell(ctx, H, 15, 24, 0, 9.6, 9.2, 10.6, skin, { line: 0, shade: null, hi: false });
  if (!PS.F) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(c[0], c[1], R, 0, TAU);
    ctx.clip();
    ctx.fillStyle = masked ? shade(mask!.c1 ?? '#22f', -0.3) : L.skinShade;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(c[0] + R * 1.25, c[1] + 4, R * 0.95, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(c[0] - 9, c[1] - 15, 8, 4, -0.5, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  for (const sd of [-1, 1]) {
    const e = H.p(-1, 5, sd * (R - 1));
    if (e[2] >= D0) ear(ctx, H, sd, L);
  }
  if ((o.mat === 'lava' || o.mat === 'ice' || o.mat === 'cosmic' || o.mat === 'gold' || o.mat === 'storm') && !PS.F) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(c[0], c[1], R, 0, TAU);
    ctx.clip();
    matPattern(ctx, o, (tt, ss) => [c[0] - 26 + tt * 52, c[1] + ss * 24], 40, t, 11);
    ctx.restore();
  }
  if (o.head) headPieces(ctx, o, H, t, 'skin');
  if (mask) mask3D(ctx, H, mask, 'skin', L, t);
  const capHair = style !== 'careca' && style !== 'moicano' && style !== 'afro' && style !== 'samurai' && !longHair && style !== 'cometa' && style !== 'chamas' && style !== 'coroa' && style !== 'topete';
  if (showHair && !masked && capHair && !PS.F) {
    const low = longHair || style === 'cometa' ? 0.55 : 0.42;
    sphereRegion(ctx, H, R + 0.3, 0, -Math.PI, Math.PI, (l) => hairline(l, low) - 0.02, (l) => hairline(l, low) + 0.13, L.skinShade, { line: 0, alpha: 0.5, n: 32, m: 2 });
  }
  face3D(ctx, H, L, expr, t, C(c1), v, !!mask);
  if (mask) mask3D(ctx, H, mask, 'front', L, t);
  if (showHair && !masked) hair3D(ctx, H, style, c1, c2, t, 'front', false);
  else if (showHair && masked) hair3D(ctx, H, style, c1, c2, t, 'front', true);
  if (o.head) headPieces(ctx, o, H, t, 'front');
}

function ear(ctx: CanvasRenderingContext2D, H: Proj, sd: number, L: Look) {
  ell(ctx, H, -1, 5, sd * (R - 1), 5.5, 7.5, 3.2, L.skin, { line: 2.4, shade: L.skinShade, hi: false });
  if (!PS.F) ell(ctx, H, -0.5, 5.5, sd * (R + 0.4), 2.6, 4, 1.5, L.skinShade, { line: 0, shade: null, hi: false, alpha: 0.75 });
}

function face3D(ctx: CanvasRenderingContext2D, H: Proj, L: Look, expr: Expr, t: number, hairC: string, v: V3, masked: boolean) {
  const skin = C(L.skin);
  const power = expr === 'power';
  const fwd = H.p(1, 0, 0)[0] - H.p(0, 0, 0)[0];
  // bochechas
  if (!PS.F && !masked) {
    for (const sd of [-1, 1]) {
      const p = spherePt(H, R, 0, sd * 0.62, 0.22);
      if (p[3] < 0.15) continue;
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#ff5a6a';
      ctx.beginPath();
      ctx.ellipse(p[0], p[1], 5 * p[3], 3.4, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  // barba (por baixo da boca)
  if (L.beard !== 'nenhuma' && !masked) beard3D(ctx, H, L.beard, hairC);
  // olhos
  const blink = expr === 'normal' && t % 3.7 < 0.11;
  for (const sd of [-1, 1]) {
    const p = spherePt(H, R, 0, sd * 0.37, -0.04, 0.5);
    if (p[3] < 0.08) continue;
    const k = Math.max(0.22, Math.pow(p[3], 0.75));
    if (blink) {
      ctx.strokeStyle = OC();
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(p[0] - 5 * k, p[1]);
      ctx.lineTo(p[0] + 5 * k, p[1]);
      ctx.stroke();
      continue;
    }
    ctx.save();
    ctx.translate(p[0], p[1]);
    ctx.scale(fwd < 0 ? -k : k, 1);
    eye(ctx, 0, 0, 5, L, expr, skin, power);
    ctx.restore();
  }
  // sobrancelhas
  if (L.brows !== 'nenhuma' && expr !== 'ko' && !masked) {
    const thick = L.brows === 'grossas' ? 4.5 : L.brows === 'finas' ? 1.8 : 3;
    const ang = L.brows === 'zangadas' || expr === 'angry' || expr === 'power' ? 0.11 : expr === 'hurt' ? -0.1 : 0.01;
    const by = L.eyes === 'grandes' ? -0.44 : -0.36;
    ctx.lineCap = 'round';
    ctx.lineWidth = thick;
    ctx.strokeStyle = hairC;
    for (const sd of [-1, 1]) {
      const a = spherePt(H, R, 0, sd * 0.17, by + ang, 0.5);
      const b = spherePt(H, R, 0, sd * 0.56, by - ang * 0.6, 0.5);
      if (a[3] < 0.1 || b[3] < 0.05) continue;
      const mx = (a[0] + b[0]) / 2;
      const my = (a[1] + b[1]) / 2 - 1.2;
      ctx.lineWidth = thick;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(mx, my);
      ctx.stroke();
      ctx.lineWidth = thick * 0.6;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
  }
  // nariz (bola com volume, sai do perfil)
  const n = spherePt(H, R, 0, 0, 0.2);
  if (n[3] > -0.25) {
    const d = [Math.cos(0.2), Math.sin(0.2)];
    ell(ctx, H, d[0] * (R + 1), d[1] * (R + 1), 0, 4.6, 5.4, 4.4, L.skin, { line: 1.8, shade: L.skinShade });
    if (!PS.F) {
      // narinas
      ctx.fillStyle = shade(L.skinShade, -0.4);
      ctx.globalAlpha = 0.75;
      for (const sd of [-1, 1]) {
        const q = spherePt(H, R, 0, sd * 0.09, 0.39, 3.2);
        if (q[3] < 0.2) continue;
        ctx.beginPath();
        ctx.ellipse(q[0], q[1], 1.5 * q[3], 0.9, 0, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }
  // boca
  const mouth = expr === 'hurt' || expr === 'ko' ? 'ai' : expr === 'angry' || expr === 'power' ? 'dentes' : expr === 'happy' ? 'grito' : L.mouth;
  const curve = (pts: [number, number][], w = 2.2) => {
    ctx.lineWidth = w;
    ctx.strokeStyle = OC();
    ctx.beginPath();
    let on = false;
    for (const [lon, lat] of pts) {
      const p = spherePt(H, R, 0, lon, lat, 0.4);
      if (p[3] < 0.06) {
        on = false;
        continue;
      }
      if (on) ctx.lineTo(p[0], p[1]);
      else ctx.moveTo(p[0], p[1]);
      on = true;
    }
    ctx.stroke();
  };
  const row = (f: (q: number) => [number, number], n = 8) => {
    const r: [number, number][] = [];
    for (let i = 0; i <= n; i++) r.push(f(i / n));
    return r;
  };
  switch (mouth) {
    case 'sorriso':
      curve(row((q) => [-0.27 + q * 0.54, 0.5 + Math.sin(q * Math.PI) * 0.07]));
      break;
    case 'serio':
      curve(row((q) => [-0.25 + q * 0.5, 0.55]));
      break;
    case 'maroto':
      curve(row((q) => [-0.27 + q * 0.54, 0.56 - q * q * 0.1]));
      break;
    case 'dentes':
      sphereRegion(ctx, H, R + 0.4, 0, -0.26, 0.26, () => 0.5, () => 0.63, '#fbf7ee', { line: 2.2, n: 8, m: 2 });
      curve(row((q) => [-0.25 + q * 0.5, 0.565]), 1.3);
      if (!PS.F) {
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        for (const lon of [-0.15, -0.05, 0.05, 0.15]) {
          const a = spherePt(H, R, 0, lon, 0.51, 0.5);
          const b = spherePt(H, R, 0, lon, 0.62, 0.5);
          if (a[3] < 0.1) continue;
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      break;
    case 'grito':
      sphereRegion(ctx, H, R + 0.4, 0, -0.22, 0.22, (l) => 0.48 + Math.abs(l) * 0.15, (l) => 0.74 - Math.abs(l) * 0.6, '#4a0f1c', { line: 2.2, n: 10, m: 3 });
      sphereRegion(ctx, H, R + 0.5, 0, -0.17, 0.17, (l) => 0.5 + Math.abs(l) * 0.15, () => 0.55, '#fbf7ee', { line: 0, n: 8, m: 1 });
      sphereRegion(ctx, H, R + 0.5, 0, -0.11, 0.11, () => 0.65, (l) => 0.71 - Math.abs(l) * 0.5, '#ff6a7a', { line: 0, n: 6, m: 1 });
      break;
    case 'ai':
      curve([[-0.25, 0.58], [-0.12, 0.52], [0, 0.58], [0.12, 0.52], [0.25, 0.58]]);
      break;
  }
  if (!PS.F && !masked && (mouth === 'sorriso' || mouth === 'serio' || mouth === 'maroto')) {
    // lábio inferior (sombra suave por baixo da boca)
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1.7;
    ctx.strokeStyle = L.skinShade;
    ctx.beginPath();
    let on = false;
    for (let i = 0; i <= 6; i++) {
      const p = spherePt(H, R, 0, -0.13 + i * 0.043, 0.66 + Math.sin((i / 6) * Math.PI) * 0.02, 0.3);
      if (p[3] < 0.06) {
        on = false;
        continue;
      }
      if (on) ctx.lineTo(p[0], p[1]);
      else ctx.moveTo(p[0], p[1]);
      on = true;
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  void v;
}

function beard3D(ctx: CanvasRenderingContext2D, H: Proj, beard: string, col: string) {
  const Hs: Proj = { p: (x, y, z) => H.p(x + 3, y + 3, z) };
  switch (beard) {
    case 'curta':
      // barba de 3 dias: tom bem visível + pontos de pelo
      sphereRegion(ctx, Hs, R + 1.5, 0, -1.35, 1.35, (l) => 0.18 + (1 - Math.abs(l) / 1.35) * 0.18, () => 0.98, col, { alpha: 0.62, line: 0, n: 20, m: 4 });
      if (!PS.F) {
        ctx.fillStyle = col.length === 7 && col[0] === '#' ? shade(col, -0.35) : col;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        for (let i = 0; i < 60; i++) {
          const p = spherePt(Hs, R + 1.8, 0, (hash(i * 3.1) - 0.5) * 2.4, 0.42 + hash(i * 7.3 + 1) * 0.5);
          if (p[3] < 0.15) continue;
          ctx.rect(p[0], p[1], 1.4, 1.4);
        }
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      break;
    case 'grande':
      sphereRegion(ctx, Hs, R + 2.5, 0, -1.45, 1.45, (l) => 0.12 + (1 - Math.abs(l) / 1.45) * 0.3, () => 1.12, col, { line: 2, n: 22, m: 4 });
      if (!PS.F) {
        // madeixas da barba
        const dark = col.length === 7 && col[0] === '#' ? shade(col, -0.4) : col;
        ctx.strokeStyle = dark;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.65;
        for (let k = 0; k < 9; k++) {
          const lon = -1.2 + k * 0.3;
          ctx.beginPath();
          let on = false;
          for (let i = 0; i <= 4; i++) {
            const q = i / 4;
            const p = spherePt(Hs, R + 2.6, 0, lon * (1 - q * 0.25), 0.3 + (1 - Math.abs(lon) / 1.45) * 0.25 + q * 0.5);
            if (p[3] < 0.1) {
              on = false;
              continue;
            }
            if (on) ctx.lineTo(p[0], p[1]);
            else ctx.moveTo(p[0], p[1]);
            on = true;
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      break;
    case 'bigode':
      sphereRegion(ctx, H, R + 1.5, 0, -0.5, 0.5, (l) => 0.33 + Math.abs(l) * 0.12, (l) => 0.47 + Math.abs(l) * 0.2, col, { line: 2, n: 12, m: 3 });
      break;
    case 'cavanhaque':
      sphereRegion(ctx, H, R + 1.5, 0, -0.42, 0.42, (l) => 0.34 + Math.abs(l) * 0.12, (l) => 0.46 + Math.abs(l) * 0.16, col, { line: 2, n: 10, m: 3 });
      sphereRegion(ctx, Hs, R + 2, 0, -0.32, 0.32, () => 0.66, (l) => 1.12 - Math.abs(l) * 0.9, col, { line: 2, n: 8, m: 4 });
      break;
  }
}

/** Polilinha sobre a esfera da cabeça (lon, lat), saltando os troços virados para trás. */
function sphLine(ctx: CanvasRenderingContext2D, H: Proj, r: number, pts: [number, number][], minF = 0.05) {
  let on = false;
  for (const [lon, lat] of pts) {
    const p = spherePt(H, r, 0, lon, lat);
    if (p[3] < minF) {
      on = false;
      continue;
    }
    if (on) ctx.lineTo(p[0], p[1]);
    else ctx.moveTo(p[0], p[1]);
    on = true;
  }
}

/** Polígono plano sobre a esfera (só se o centro estiver virado para quem vê). */
function sphPoly(ctx: CanvasRenderingContext2D, H: Proj, r: number, pts: [number, number][], fill: string, line = 1.5, minF = 0.15): boolean {
  let cl = 0;
  let ct = 0;
  for (const [lon, lat] of pts) {
    cl += lon;
    ct += lat;
  }
  if (spherePt(H, r, 0, cl / pts.length, ct / pts.length)[3] < minF) return false;
  ctx.beginPath();
  pts.forEach(([lon, lat], i) => {
    const p = spherePt(H, r, 0, lon, lat);
    if (i) ctx.lineTo(p[0], p[1]);
    else ctx.moveTo(p[0], p[1]);
  });
  ctx.closePath();
  ctx.fillStyle = C(fill);
  ctx.fill();
  if (line > 0) {
    ctx.lineWidth = line;
    ctx.strokeStyle = OC();
    ctx.stroke();
  }
  return true;
}

/** Brilho aditivo (fora do passe de silhueta). */
function addGlow(ctx: CanvasRenderingContext2D, f: () => void) {
  if (PS.F) return;
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  f();
  ctx.globalCompositeOperation = prev;
  ctx.globalAlpha = 1;
}

function mask3D(ctx: CanvasRenderingContext2D, H: Proj, m: Vis, phase: 'skin' | 'front', L: Look, t: number) {
  const c1 = m.c1 ?? '#2222ff';
  const c2 = m.c2 ?? '#ffffff';
  const sq = (x: number) => x * x;
  switch (m.style) {
    case 'luchador':
      if (phase === 'skin') {
        // painéis laterais a contrastar
        for (const sd of [-1, 1]) {
          sphereRegion(ctx, H, R + 0.3, 0, sd * 1.75 - 0.16, sd * 1.75 + 0.16, () => -1.2, () => 0.95, c2, { line: 1.5, n: 4, m: 8 });
        }
        // debruns dos olhos em chama
        for (const sd of [-1, 1]) {
          const c = sd * 0.37;
          sphereRegion(ctx, H, R + 0.3, 0, c - 0.3, c + 0.3,
            (l) => -0.36 + sq((l - c) / 0.3) * 0.16 - (sd * (l - c) > 0 ? sd * (l - c) * 0.35 : 0),
            (l) => 0.18 - sq((l - c) / 0.3) * 0.15, c2, { line: 1.5, n: 10, m: 3 });
        }
        // boca: debrum + abertura
        sphereRegion(ctx, H, R + 0.3, 0, -0.36, 0.36, (l) => 0.38 + Math.abs(l) * 0.2, (l) => 0.78 - Math.abs(l) * 0.3, c2, { line: 1.5, n: 10, m: 3 });
        sphereRegion(ctx, H, R + 0.4, 0, -0.3, 0.3, (l) => 0.44 + Math.abs(l) * 0.2, (l) => 0.72 - Math.abs(l) * 0.3, L.skin, { line: 1.5, n: 8, m: 3 });
        // risca central (frente e nuca)
        sphereRegion(ctx, H, R + 0.3, 0, -0.07, 0.07, () => -1.45, () => -0.8, c2, { line: 0, n: 2, m: 6 });
        sphereRegion(ctx, H, R + 0.3, 0, Math.PI - 0.07, Math.PI + 0.07, () => -1.45, () => -0.1, c2, { line: 0, n: 2, m: 6 });
        // emblema em losango na testa
        sphPoly(ctx, H, R + 0.5, [[0, -0.82], [0.14, -0.62], [0, -0.42], [-0.14, -0.62]], c2, 1.5);
        if (!PS.F) {
          const e = spherePt(H, R + 0.6, 0, 0, -0.62);
          if (e[3] > 0.15) {
            ctx.fillStyle = c1;
            ctx.beginPath();
            ctx.arc(e[0], e[1], 2, 0, TAU);
            ctx.fill();
          }
          // pesponto ao lado da risca
          ctx.setLineDash([1.8, 2.2]);
          ctx.strokeStyle = shade(c1, -0.5);
          ctx.lineWidth = 0.9;
          ctx.beginPath();
          for (const sd of [-1, 1]) {
            const pts: [number, number][] = [];
            for (let i = 0; i <= 8; i++) pts.push([sd * 0.11, -1.45 + i * 0.08]);
            sphLine(ctx, H, R + 0.4, pts);
            const back: [number, number][] = [];
            for (let i = 0; i <= 10; i++) back.push([Math.PI + sd * 0.11, -1.45 + i * 0.13]);
            sphLine(ctx, H, R + 0.4, back);
          }
          ctx.stroke();
          ctx.setLineDash([]);
          // atacadores na nuca
          ctx.strokeStyle = c2;
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          for (let i = 0; i < 3; i++) {
            const a = -0.05 + i * 0.22;
            for (const [l0, l1] of [[-0.12, 0.12], [0.12, -0.12]]) {
              const p = spherePt(H, R + 0.5, 0, Math.PI + l0, a);
              const q = spherePt(H, R + 0.5, 0, Math.PI + l1, a + 0.18);
              if (p[3] < 0.1 || q[3] < 0.1) continue;
              ctx.moveTo(p[0], p[1]);
              ctx.lineTo(q[0], q[1]);
            }
          }
          ctx.stroke();
        }
      } else if (!PS.F) {
        // brilho de vinil envernizado
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        sphLine(ctx, H, R + 0.6, [[-0.9, -0.95], [-0.6, -1.0], [-0.3, -1.02], [0, -1.0], [0.25, -0.95]], 0.25);
        ctx.stroke();
        const d = spherePt(H, R + 0.6, 0, 0.35, -0.85);
        if (d[3] > 0.2) {
          ctx.globalAlpha = 0.85;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.ellipse(d[0], d[1], 2.6, 1.3, -0.5, 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      break;
    case 'caveira':
      if (phase === 'front') {
        sphereRegion(ctx, H, R + 0.4, 0, -1.0, 1.0, () => -0.5, () => 0.8, c1, { line: 0, n: 16, m: 5, alpha: PS.F ? undefined : 0.94 });
        if (PS.F) break;
        // sombra do osso nas faces
        sphereRegion(ctx, H, R + 0.5, 0, -1.0, 1.0, () => 0.25, () => 0.8, '#7a8090', { line: 0, n: 12, m: 3, alpha: 0.25 });
        // órbitas fundas: contorno do olho + fundo negro
        for (const sd of [-1, 1]) {
          const c = sd * 0.37;
          sphereRegion(ctx, H, R + 0.6, 0, c - 0.24, c + 0.24, (l) => -0.3 + sq((l - c) / 0.24) * 0.12, (l) => 0.18 - sq((l - c) / 0.24) * 0.1, c2, { line: 0, n: 8, m: 3 });
          sphereRegion(ctx, H, R + 0.7, 0, c - 0.13, c + 0.13, (l) => -0.18 + sq((l - c) / 0.13) * 0.08, (l) => 0.08 - sq((l - c) / 0.13) * 0.06, '#000000', { line: 0, n: 6, m: 2 });
        }
        // nariz em coração invertido
        sphPoly(ctx, H, R + 0.7, [[0, 0.17], [0.09, 0.24], [0.05, 0.33], [0, 0.29], [-0.05, 0.33], [-0.09, 0.24]], c2, 0);
        // dentes + fendas
        ctx.strokeStyle = c2;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        sphLine(ctx, H, R + 0.8, [[-0.3, 0.56], [-0.15, 0.58], [0, 0.585], [0.15, 0.58], [0.3, 0.56]], 0.1);
        for (let i = 0; i <= 5; i++) {
          const a = spherePt(H, R, 0, -0.25 + i * 0.1, 0.48, 0.8);
          const b = spherePt(H, R, 0, -0.25 + i * 0.1, 0.66, 0.8);
          if (a[3] < 0.1) continue;
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
        }
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.beginPath();
        sphLine(ctx, H, R + 0.8, [[-0.1, -0.52], [-0.06, -0.38], [-0.12, -0.3]]);
        sphLine(ctx, H, R + 0.8, [[-0.06, -0.38], [0.04, -0.36]]);
        ctx.stroke();
        // brilho do osso
        const hl = spherePt(H, R + 0.8, 0, 0.2, -0.42);
        if (hl[3] > 0.2) {
          ctx.globalAlpha = 0.55;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.ellipse(hl[0], hl[1], 5, 1.8, -0.3, 0, TAU);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        addGlow(ctx, () => {
          const p = 0.75 + Math.sin(t * 4) * 0.25;
          for (const sd of [-1, 1]) {
            const e = spherePt(H, R, 0, sd * 0.37, -0.04, 1);
            if (e[3] < 0.1) continue;
            ctx.globalAlpha = p;
            ctx.drawImage(glowSprite('#ff3030'), e[0] - 7, e[1] - 7, 14, 14);
            ctx.fillStyle = '#ffd0c0';
            ctx.beginPath();
            ctx.arc(e[0], e[1], 1.5, 0, TAU);
            ctx.fill();
          }
        });
      }
      break;
    case 'demonio':
      if (phase === 'front') {
        // meia-máscara oni lacada (com sobrancelhas esculpidas)
        sphereRegion(ctx, H, R + 0.6, 0, -1.15, 1.15, (l) => -0.36 - Math.abs(l) * 0.05 - Math.abs(Math.sin(l * 2.7)) * 0.08, (l) => 0.12 - Math.abs(l) * 0.05 + (Math.abs(l) < 0.15 ? 0.08 : 0), c1, { line: 2.5, n: 18, m: 2 });
        if (!PS.F) {
          sphereRegion(ctx, H, R + 0.8, 0, -1.1, 1.1, () => 0.0, (l) => 0.1 - Math.abs(l) * 0.05, shade(c1, -0.45), { line: 0, n: 12, m: 2, alpha: 0.5 });
          // laca: brilho por cima
          ctx.strokeStyle = '#ffffff';
          ctx.globalAlpha = 0.5;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          sphLine(ctx, H, R + 0.9, [[-0.6, -0.36], [-0.4, -0.42], [-0.2, -0.4]], 0.2);
          sphLine(ctx, H, R + 0.9, [[0.15, -0.4], [0.35, -0.43], [0.6, -0.36]], 0.2);
          ctx.stroke();
          // filigrana dourada
          ctx.globalAlpha = 0.9;
          ctx.strokeStyle = c2;
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          sphLine(ctx, H, R + 0.9, [[0, -0.4], [0, -0.2], [0, 0.0], [0, 0.15]]);
          for (const sd of [-1, 1]) sphLine(ctx, H, R + 0.9, [[sd * 0.85, 0.06], [sd * 0.75, -0.08], [sd * 0.65, 0.04]]);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        // chifres estriados
        for (const sd of [-1, 1]) {
          const pts = [[8, -22, sd * 12], [10, -40, sd * 16], [18, -50, sd * 22]];
          if (H.p(pts[0][0], pts[0][1], pts[0][2])[2] <= H.p(0, 0, 0)[2] - 8) continue;
          tube(ctx, H, pts, [5, 3, 0.6], '#f2e6d0', '#b8a888', 3);
          if (!PS.F) {
            ctx.strokeStyle = '#8a7a60';
            ctx.lineWidth = 1.1;
            ctx.beginPath();
            for (let i = 1; i <= 4; i++) {
              const k = i / 5;
              const seg2 = k < 0.5 ? 0 : 1;
              const u = k < 0.5 ? k * 2 : (k - 0.5) * 2;
              const a = pts[seg2];
              const b = pts[seg2 + 1];
              const x = a[0] + (b[0] - a[0]) * u;
              const y = a[1] + (b[1] - a[1]) * u;
              const z = a[2] + (b[2] - a[2]) * u;
              const w = 4.5 * (1 - k * 0.8);
              const p = H.p(x - w, y, z);
              const q = H.p(x + w, y - 1.5, z);
              ctx.moveTo(p[0], p[1]);
              ctx.lineTo(q[0], q[1]);
            }
            ctx.stroke();
          }
        }
        // olhos em brasa
        for (const sd of [-1, 1]) {
          const c = sd * 0.37;
          sphereRegion(ctx, H, R + 1, 0, c - 0.17, c + 0.17, (l) => -0.12 + sq((l - c) / 0.17) * 0.07 - sd * (l - c) * 0.15, (l) => -0.02 - sq((l - c) / 0.17) * 0.04, c2, { line: 0, n: 6, m: 2 });
        }
        addGlow(ctx, () => {
          const fl = 0.8 + Math.sin(t * 6) * 0.15 + Math.sin(t * 17) * 0.05;
          for (const sd of [-1, 1]) {
            const e = spherePt(H, R, 0, sd * 0.37, -0.06, 1);
            if (e[3] < 0.1) continue;
            ctx.globalAlpha = 0.6 * fl;
            ctx.drawImage(glowSprite(c2), e[0] - 8, e[1] - 8, 16, 16);
            for (let i = 0; i < 2; i++) {
              const ph = (t * 0.9 + i * 0.5 + (sd > 0 ? 0.25 : 0)) % 1;
              const s = 7 - ph * 4;
              ctx.globalAlpha = 0.45 * fl * (1 - ph);
              ctx.drawImage(glowSprite(c2), e[0] + Math.sin(t * 3 + i) * 2 - s / 2, e[1] - 5 - ph * 20 - s / 2, s, s);
            }
          }
        });
      }
      break;
    case 'mascarada': {
      // meia-máscara de baile dourada: pintada por baixo dos olhos (que ficam por cima), pedras e penas de lado
      const top = (l: number) => -0.44 - Math.abs(l) * 0.16 + 0.12 * Math.exp(-sq(l / 0.14));
      const bot = (l: number) => 0.17 - Math.abs(l) * 0.03 - 0.15 * Math.exp(-sq(l / 0.17));
      if (phase === 'skin') {
        sphereRegion(ctx, H, R + 0.6, 0, -1.2, 1.2, top, bot, c1, { line: 2.2, n: 24, m: 4 });
        if (!PS.F) {
          sphereRegion(ctx, H, R + 0.7, 0, -1.1, 1.1, (l) => top(l) + 0.04, (l) => top(l) + 0.12, shade(c1, 0.45), { line: 0, n: 20, m: 2, alpha: 0.8 });
          sphereRegion(ctx, H, R + 0.7, 0, -1.15, 1.15, (l) => bot(l) - 0.06, bot, shade(c1, -0.35), { line: 0, n: 20, m: 2, alpha: 0.7 });
          // debrum violeta à volta dos olhos
          for (const sd of [-1, 1]) {
            const c = sd * 0.37;
            sphereRegion(ctx, H, R + 0.8, 0, c - 0.27, c + 0.27, (l) => -0.2 + sq((l - c) / 0.27) * 0.14, (l) => 0.11 - sq((l - c) / 0.27) * 0.12, c2, { line: 1.2, n: 10, m: 3 });
          }
        }
        break;
      }
      // pedra em losango sobre o nariz e lágrimas debaixo dos olhos
      sphPoly(ctx, H, R + 1.2, [[0, -0.42], [0.08, -0.32], [0, -0.22], [-0.08, -0.32]], c2, 1.3);
      for (const sd of [-1, 1]) {
        const p = spherePt(H, R + 1, 0, sd * 0.4, 0.17);
        if (p[3] < 0.15) continue;
        ctx.fillStyle = C(c2);
        ctx.beginPath();
        ctx.arc(p[0], p[1], 1.7, 0, TAU);
        ctx.fill();
      }
      // penas num dos lados (a subir para trás)
      const sd = 1;
      const lon = sd * 1.18;
      const lat = -0.42;
      const bx = Math.cos(lat) * Math.cos(lon) * (R + 1);
      const by = Math.sin(lat) * (R + 1);
      const bz = Math.cos(lat) * Math.sin(lon) * (R + 1);
      for (let i = 0; i < 3; i++) {
        const a = -2.0 - i * 0.32 + Math.sin(t * 2.2 + i) * 0.05;
        const len = 30 - i * 4;
        const cx = bx + Math.cos(a) * len * 0.5;
        const cy = by + Math.sin(a) * len * 0.5;
        ell(ctx, H, cx, cy, bz + 2, len * 0.5, 4.6, 2.5, i === 1 ? shade(c2, 0.25) : c2, { rot: a, line: 2 });
      }
      ell(ctx, H, bx, by, bz, 3.2, 3.2, 3.2, c1, { line: 1.8 });
      addGlow(ctx, () => {
        const p = spherePt(H, R + 1.5, 0, 0, -0.32);
        if (p[3] < 0.2) return;
        ctx.globalAlpha = 0.6 + Math.sin(t * 4) * 0.3;
        ctx.drawImage(glowSprite(c2), p[0] - 7, p[1] - 7, 14, 14);
      });
      break;
    }
    case 'cyber':
      if (phase === 'front') {
        // armação + vidro escuro com linhas de varrimento, feixe e reflexo
        sphereRegion(ctx, H, R + 1.2, 0, -1.1, 1.1, () => -0.3, () => 0.14, c1, { line: 2.5, n: 16, m: 2 });
        sphereRegion(ctx, H, R + 1.5, 0, -0.95, 0.95, () => -0.2, () => 0.06, PS.F ? c2 : shade(c2, -0.62), { line: 1.2, n: 14, m: 2 });
        // módulos laterais com LED
        for (const sd of [-1, 1]) {
          const p = spherePt(H, R + 2, 0, sd * 1.2, -0.08);
          if (p[3] < -0.2) continue;
          ell(ctx, H, Math.cos(sd * 1.2) * (R + 2), -2, Math.sin(sd * 1.2) * (R + 2), 4, 7, 4, shade(c1, 0.25), { line: 2 });
          if (!PS.F && p[3] > 0.05) {
            ctx.fillStyle = Math.floor(t * 3) % 3 ? c2 : '#ff4a3d';
            ctx.beginPath();
            ctx.arc(p[0], p[1] - 2, 1.4, 0, TAU);
            ctx.fill();
          }
        }
        if (!PS.F) {
          // linhas de varrimento
          ctx.strokeStyle = c2;
          ctx.lineWidth = 0.7;
          ctx.globalAlpha = 0.3;
          ctx.beginPath();
          for (let k = 0; k < 4; k++) {
            const lat = -0.17 + k * 0.06;
            const pts: [number, number][] = [];
            for (let i = 0; i <= 8; i++) pts.push([-0.9 + i * 0.225, lat]);
            sphLine(ctx, H, R + 1.6, pts);
          }
          ctx.stroke();
          ctx.globalAlpha = 1;
          // reflexo diagonal
          sphereRegion(ctx, H, R + 1.7, 0, 0.3, 0.42, () => -0.19, () => 0.05, '#ffffff', { line: 0, n: 2, m: 2, alpha: 0.35 });
          // friso de luz na armação
          ctx.strokeStyle = 'rgba(255,255,255,0.45)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          const top: [number, number][] = [];
          for (let i = 0; i <= 10; i++) top.push([-1.0 + i * 0.2, -0.27]);
          sphLine(ctx, H, R + 1.4, top);
          ctx.stroke();
        }
        addGlow(ctx, () => {
          // olhos-alvo e feixe que percorre o visor
          ctx.fillStyle = c2;
          for (const sd of [-1, 1]) {
            const e = spherePt(H, R + 1.7, 0, sd * 0.37, -0.07);
            if (e[3] < 0.05) continue;
            ctx.globalAlpha = 0.8 + Math.sin(t * 8) * 0.2;
            ctx.fillRect(e[0] - 3 * e[3], e[1] - 1, 6 * e[3], 2);
          }
          const k = Math.sin(t * 2.6) * 0.85;
          const p = spherePt(H, R + 1.7, 0, k, -0.07);
          if (p[3] > 0) {
            ctx.globalAlpha = 0.95;
            ctx.drawImage(glowSprite(c2), p[0] - 10, p[1] - 10, 20, 20);
            const a = spherePt(H, R + 1.7, 0, k, -0.19);
            const b = spherePt(H, R + 1.7, 0, k, 0.05);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(a[0], a[1]);
            ctx.lineTo(b[0], b[1]);
            ctx.stroke();
          }
        });
      }
      break;
  }
}

/** Desenha em coordenadas da cabeça do jogo 2D (x para a frente, y para baixo), seguindo a cabeça 3D. */
function local2D(ctx: CanvasRenderingContext2D, H: Proj, f: () => void) {
  const o = H.p(0, 0, 0);
  const up = H.p(0, -1, 0);
  const ux = up[0] - o[0];
  const uy = up[1] - o[1];
  const fw = H.p(1, 0, 0);
  // "para a frente" no ecrã: perpendicular a "cima", para o lado para onde a cara aponta
  const side = (fw[0] - o[0]) * -uy + (fw[1] - o[1]) * ux >= 0 ? 1 : -1;
  ctx.save();
  ctx.transform(-uy * side, ux * side, -ux, -uy, o[0], o[1]);
  f();
  ctx.restore();
}

// ───────────────────────── Cabelo em 3D ─────────────────────────

function hair3D(ctx: CanvasRenderingContext2D, H: Proj, style: string, c1: string, c2: string, t: number, phase: 'back' | 'front', masked: boolean) {
  const D0 = H.p(0, 0, 0)[2];
  const behind = (x: number, y: number, z: number) => H.p(x, y, z)[2] < D0;
  const when = (x: number, y: number, z: number, f: () => void) => {
    if (behind(x, y, z) === (phase === 'back')) f();
  };
  const longs = style === 'longo' || style === 'rabo' || style === 'trancas' || style === 'mullet';
  const low = longs || style === 'cometa' ? 0.55 : 0.42;
  // penteados puxados para trás: testa à mostra, sem a franja do corte curto
  const swept = longs || style === 'samurai' || style === 'cometa' || style === 'chamas' || style === 'coroa' || style === 'topete';
  const hl = (l: number) => hairline(l, low) - (swept ? 0.42 * Math.pow(Math.max(0, Math.cos(l)), 1.5) : 0);
  const cap = () => sphereRegion(ctx, H, R + 2.5, 0, -Math.PI, Math.PI, () => -Math.PI / 2 + 0.001, hl, c1, { line: 3, n: 48, m: 12, top: false });
  const shine = () => {
    if (PS.F) return;
    const p = spherePt(H, R + 3, 0, -0.4, -1.0);
    if (p[3] < 0.05) return;
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = c2;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    let on = false;
    for (let i = 0; i <= 6; i++) {
      const q = spherePt(H, R + 2.6, 0, -0.9 + i * 0.25, -0.95 + Math.sin(i) * 0.05);
      if (q[3] < 0.1) {
        on = false;
        continue;
      }
      if (on) ctx.lineTo(q[0], q[1]);
      else ctx.moveTo(q[0], q[1]);
      on = true;
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  // partes de trás (cortina, rabo, tranças, afro, etc.)
  const backParts = () => {
  if (style === 'longo' || style === 'mullet') {
    const len = style === 'longo' ? 50 : 32;
    for (const half of [0, 1]) {
      const a0 = half ? Math.PI : 1.15;
      const a1 = half ? TAU - 1.15 : Math.PI;
      const am = (a0 + a1) / 2;
      when(Math.cos(am) * R, 12, Math.sin(am) * R, () => {
        const grid: number[][][] = [];
        for (let i = 0; i <= 3; i++) {
          const row: number[][] = [];
          const k = i / 3;
          for (let j = 0; j <= 5; j++) {
            const a = a0 + ((a1 - a0) * j) / 5;
            // a cortina nasce no alto da cabeça (colada à calota) e cai até aos ombros: sem degrau entre as duas
            const y0 = -R * 0.62;
            const y = y0 + k * (len - 2 - y0);
            const base = y < 0 ? Math.sqrt(Math.max(0, (R + 3) * (R + 3) - y * y)) : R + 3;
            const rr = base + k * 4;
            const sw = Math.sin(t * 3 + j) * 2 * k;
            row.push([Math.cos(a) * rr - k * 4 + sw, y, Math.sin(a) * rr]);
          }
          grid.push(row);
        }
        sheet(ctx, H, grid, c1, shade(c1, -0.25), 3.5);
      });
    }
  }
  if (style === 'rabo') {
    const sw = Math.sin(t * 4) * 6;
    when(-30, 0, 0, () => {
      tube(ctx, H, [[-22, -16, 0], [-40, -8 + sw * 0.3, sw * 0.4], [-44, 14, sw], [-38, 32, sw * 1.3]], [7, 6.5, 5, 2.5], c1, shade(c1, -0.3), 3);
      ell(ctx, H, -25, -14, 0, 4, 4, 4, c2, { line: 2 });
    });
  }
  if (style === 'trancas') {
    for (let i = 0; i < 4; i++) {
      const z = -15 + i * 10;
      const sw = Math.sin(t * 4 + i) * 4;
      when(-26, 10, z, () => {
        tube(ctx, H, [[-18 - Math.abs(z) * 0.2, -14 + Math.abs(z) * 0.2, z * 1.05], [-30, 8, z * 1.2], [-28 + sw, 34, z * 1.25]], [4.5, 4, 3.5], i % 2 ? c2 : c1, undefined, 3);
        ell(ctx, H, -28 + sw, 36, z * 1.25, 3.5, 3.5, 3.5, '#ffd23d', { line: 2 });
      });
    }
  }
  if (style === 'afro') {
    when(-6, -10, 0, () => ell(ctx, H, -6, -10, 0, 37, 37, 37, c1, { line: 3 }));
  }
  if (style === 'samurai') {
    when(-12, -34, 0, () => {
      ell(ctx, H, -12, -34, 0, 7, 10, 7, c1, { line: 3, rot: -0.5 });
      ell(ctx, H, -10, -27, 0, 4, 3, 5, '#d22', { line: 1.5, shade: null, hi: false });
    });
  }
  if ((style === 'espetado' || style === 'super' || style === 'chamas') && phase === 'back') {
    // exatamente o mesmo desenho do jogo (espinhos em sol / labaredas), alinhado com a cabeça em 3D
    local2D(ctx, H, () => hairBackGame(ctx, style, c1, c2, t));
  }
  if (style === 'cometa') {
    when(-60, -10, 0, () => {
      if (PS.F) return;
      const prev = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 6; i >= 0; i--) {
        const k = i / 6;
        const p = H.p(-18 - k * 70, -14 + Math.sin(t * 5 - k * 4) * 8 * k + k * 10, 0);
        ctx.globalAlpha = 0.85 - k * 0.6;
        ctx.fillStyle = i % 2 ? c2 : c1;
        ctx.beginPath();
        ctx.arc(p[0], p[1], 16 - k * 9, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = prev;
    });
  }
  };
  // de costas, a cortina/rabo ficam à frente da calota: desenham-se DEPOIS dela (senão a borda da calota
  // aparece por cima, como uma peça solta)
  if (phase === 'back' || masked) {
    backParts();
    return;
  }
  const early = style === 'careca' || style === 'moicano' || style === 'afro';
  if (early) backParts();


  // frente: calota e volumes
  switch (style) {
    case 'careca':
      if (!PS.F) {
        const p = spherePt(H, R, 0, -0.3, -1.05);
        if (p[3] > 0) {
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.ellipse(p[0], p[1], 9, 4, -0.3, 0, TAU);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      return;
    case 'moicano': {
      // crista: espinhos ao longo do meio da cabeça, com volume visto de qualquer lado
      sphereRegion(ctx, H, R + 1, 0, -Math.PI, Math.PI, () => -Math.PI / 2 + 0.001, (l) => -1.25 + Math.abs(Math.sin(l)) * -0.2, c1, { line: 0, n: 30, m: 2, alpha: 0.35 });
      const items: { d: number; f: () => void }[] = [];
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * 1.08 + (i / 6) * Math.PI * 0.72;
        const r2 = 40 + (i % 2) * 5;
        const b = [Math.cos(a) * (R - 2), Math.sin(a) * (R - 2), 0];
        const tp = [Math.cos(a + 0.12) * r2, Math.sin(a + 0.12) * r2, 0];
        items.push({ d: H.p(tp[0], tp[1], 0)[2], f: () => spike(ctx, H, b[0], b[1], 0, tp[0], tp[1], 0, 8, i % 2 ? c1 : shade(c1, 0.08), 3) });
      }
      items.sort((p, q) => p.d - q.d).forEach((it) => it.f());
      return;
    }
    case 'afro':
      for (let i = 0; i < 5; i++) {
        const lon = -0.9 + i * 0.45;
        const p = [Math.cos(-0.6) * Math.cos(lon) * (R + 2), Math.sin(-0.6) * (R + 2) - 2, Math.cos(-0.6) * Math.sin(lon) * (R + 2)];
        if (!behind(p[0], p[1], p[2])) ell(ctx, H, p[0], p[1], p[2], 11, 11, 11, c1, { line: 3 });
      }
      return;
  }
  cap();
  if (!early) {
    // a cortina/rabo/tranças que estão à frente desenham-se agora; depois a calota é preenchida outra vez
    // SEM contorno, para que calota e cortina sejam uma só massa de cabelo (sem linha a separá-las)
    backParts();
    if (longs || style === 'cometa') sphereRegion(ctx, H, R + 2.5, 0, -Math.PI, Math.PI, () => -Math.PI / 2 + 0.001, hl, c1, { line: 0, n: 48, m: 12, top: false });
  }
  if (!PS.F) {
    const dark = c1.length === 7 && c1[0] === '#' ? shade(c1, -0.42) : c1;
    // madeixas (suaves: cada penteado mantém a sua forma, sem uma "franja" comum a todos)
    ctx.strokeStyle = dark;
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = swept ? 0.3 : 0.4;
    ctx.lineCap = 'round';
    for (let k = 0; k < 14; k++) {
      const lon = -Math.PI + (k / 14) * TAU + 0.15;
      const end = hl(lon) - 0.06;
      ctx.beginPath();
      let on = false;
      for (let i = 0; i <= 5; i++) {
        const q = i / 5;
        const lat = -1.35 + (end + 1.35) * q;
        const p = spherePt(H, R + 2.7, 0, lon + Math.sin(q * 2) * 0.12, lat);
        if (p[3] < 0.12) {
          on = false;
          continue;
        }
        if (on) ctx.lineTo(p[0], p[1]);
        else ctx.moveTo(p[0], p[1]);
        on = true;
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  shine();
  if ((style === 'longo' || style === 'mullet' || style === 'trancas') && !PS.F) {
    // risca ao meio
    ctx.strokeStyle = c1.length === 7 && c1[0] === '#' ? shade(c1, -0.5) : c1;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    let on = false;
    for (let i = 0; i <= 8; i++) {
      const q = spherePt(H, R + 2.8, 0, 0, hl(0) - 0.05 - i * 0.12);
      if (q[3] < 0.1) {
        on = false;
        continue;
      }
      if (on) ctx.lineTo(q[0], q[1]);
      else ctx.moveTo(q[0], q[1]);
      on = true;
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (style === 'topete') {
    when(14, -30, 0, () => ell(ctx, H, 12, -31, 0, 21, 11, 18, c1, { line: 3, rot: -0.3 }));
    if (behind(14, -30, 0)) ell(ctx, H, 12, -31, 0, 21, 11, 18, c1, { line: 3, rot: -0.3 });
  }
  if (style === 'samurai') ell(ctx, H, -12, -34, 0, 7, 10, 7, c1, { line: 3, rot: -0.5 });
  if (style === 'coroa') {
    const c = H.p(-2, -48 + Math.sin(t * 2) * 2, 0);
    if (!PS.F) {
      const prev = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.6 + Math.sin(t * 4) * 0.2;
      ctx.drawImage(glowSprite('#ffe27a'), c[0] - 40, c[1] - 25, 80, 50);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = prev;
    }
    ctx.beginPath();
    ctx.ellipse(c[0], c[1], 22, 6, 0, 0, TAU);
    ctx.lineWidth = 6;
    ctx.strokeStyle = OC();
    ctx.stroke();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = PS.F ? '#fff' : '#ffe27a';
    ctx.stroke();
  }
}
