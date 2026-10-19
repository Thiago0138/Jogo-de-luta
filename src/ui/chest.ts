/**
 * Abertura de baús: o baú cai no ringue, carrega-se com toques (a cada toque treme mais e a luz que
 * vaza pelas frestas denuncia a melhor raridade lá dentro), rebenta com raios de luz e as cartas saem
 * uma a uma com o verso já da cor da raridade. Lendário ou melhor tem um momento de ecrã inteiro.
 * Eventos raros: o baú pode transformar-se no seguinte ("upgrade") ou dar um item extra.
 *
 * Desempenho: o fundo (arena) e a arte dos baús são pré-renderizados; as partículas usam o pool de
 * arrays planos; o RAF pára quando a cena fecha.
 */
import { CHESTS, CHEST_ORDER, CHEST_UPGRADE_CHANCE, LUCKY_BONUS_CHANCE, type ChestId } from '../data/chests';
import { KIND_NAMES, item, type ItemDef } from '../data/items';
import { RARITIES, RARITY_ORDER, type Rarity } from '../data/rarity';
import { sfx, unlockAudio } from '../audio/sfx';
import { S, applyDrops, count, poolFor, rollChestEvents, type ChestDrop } from '../core/state';
import { BACK_Y, setArena, drawBackdrop, drawFloor, drawRingBack, drawRingFront, ensureArena, newRopes } from '../fight/arena';
import { PK, Particles } from '../fight/fx';
import { glowSprite } from '../render/fighter';
import { CH, CW, LID_H, chestSprites, drawSprite, type ChestSprites } from './chestArt';
import { el, esc, fmt, rarityTag } from './dom';
import { itemThumb } from './preview';
import { ico } from './icons';

// ───────────────────────── Utilitários ─────────────────────────

const RAINBOW = ['#ff8af0', '#7af7ff', '#fff6a0', '#8affb0', '#b4a0ff', '#ffb36a'];
const CONFETTI = ['#ff3d6e', '#ffd23d', '#3aa0ff', '#4cd964', '#b45cff', '#ffffff'];
/** Escala do baú no mundo (sobre o zoom da cena). */
const CS = 1.3;
const TAPS = 3;

const tierOf = (r: Rarity) => RARITIES[r].tier;
const hexOf = (r: Rarity) => RARITIES[r].color;
const rarAt = (tier: number): Rarity => RARITY_ORDER[Math.max(0, Math.min(6, tier))];

function buzz(p: number | number[]): void {
  try {
    navigator.vibrate?.(p);
  } catch {
    /* sem vibração */
  }
}

function dropName(d: ChestDrop): string {
  if (d.kind === 'coins') return `${fmt(d.amount)} Coins`;
  if (d.kind === 'gems') return `${fmt(d.amount)} Gems`;
  const it = item(d.id!);
  return d.amount > 1 ? `${it.name} ×${d.amount}` : it.name;
}

function dropIcon(d: ChestDrop): HTMLElement {
  if (d.kind === 'coins' || d.kind === 'gems') return el('div', 'thumb-icon', ico(d.kind === 'coins' ? 'coin' : 'gem'));
  return itemThumb(d.id!);
}

const SPECIAL: Record<number, [string, string]> = {
  4: ['LEGENDARY!', 'cx-b-leg'],
  5: ['MYTHIC!!', 'cx-b-myth'],
  6: ['CELESTIAL!!!', 'cx-b-cel'],
};

// ───────────────────────── Palco (canvas partilhado) ─────────────────────────

class Stage {
  root = el('div', 'chest-root cx');
  canvas = el('canvas', 'chest-canvas');
  ui = el('div', 'chest-ui cx-ui');
  ctx: CanvasRenderingContext2D;
  bg = document.createElement('canvas');
  ropes = newRopes();
  parts = new Particles();
  low = S.settings.quality === 'baixa';
  cap = S.settings.quality === 'baixa' ? 200 : 420;
  W = 0;
  H = 0;
  dpr = 1;
  z = 1;
  floorY = 0;
  portrait = false;
  t = 0;
  shake = 0;
  flash = 0;
  flashColor = '#ffffff';
  dark = 0;
  darkTo = 0;
  rayA = 0;
  rayTo = 0;
  rayColor = '#ffffff';
  rainbow = false;
  /** Centro dos raios em coordenadas de ecrã (CSS px). */
  rayX = 0;
  rayY = 0;
  alive = true;
  private raf = 0;
  private last = 0;
  onFrame: (dt: number) => void = () => {};
  onDraw: (ctx: CanvasRenderingContext2D) => void = () => {};
  onResize: () => void = () => {};

  constructor(extra: string) {
    if (extra) this.root.classList.add(extra);
    this.root.append(this.canvas, this.ui);
    document.body.appendChild(this.root);
    this.ctx = this.canvas.getContext('2d', { alpha: false })!;
    ensureArena('ar_kings');
    window.addEventListener('resize', this.resize);
    this.resize();
  }

  resize = (): void => {
    this.W = this.root.clientWidth || window.innerWidth;
    this.H = this.root.clientHeight || window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.portrait = this.H > this.W;
    this.z = Math.min(this.W / 600, this.H / (this.portrait ? 640 : 560));
    this.floorY = this.H * (this.portrait ? 0.62 : 0.72);
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    this.paintBg();
    this.onResize();
  };

  /** Fundo estático: arena, ringue, holofote e vinheta (desenhado só quando muda o tamanho). */
  private paintBg(): void {
    const { W, H, dpr, z, floorY } = this;
    this.bg.width = this.canvas.width;
    this.bg.height = this.canvas.height;
    const g = this.bg.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    setArena('ar_kings');
    drawBackdrop(g, W, H, 0, z, floorY + BACK_Y * z, 0, 0.6, false);
    g.fillStyle = 'rgba(5,2,12,0.6)';
    g.fillRect(0, 0, W, H);
    g.setTransform(dpr * z, 0, 0, dpr * z, (dpr * W) / 2, dpr * floorY);
    drawFloor(g);
    drawRingBack(g, this.ropes);
    g.globalCompositeOperation = 'lighter';
    const sp = g.createLinearGradient(0, -1000, 0, 0);
    sp.addColorStop(0, 'rgba(255,255,255,0)');
    sp.addColorStop(1, 'rgba(255,240,210,0.3)');
    g.fillStyle = sp;
    g.beginPath();
    g.moveTo(-50, -1300);
    g.lineTo(50, -1300);
    g.lineTo(260, 12);
    g.lineTo(-260, 12);
    g.fill();
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath();
    g.ellipse(0, 6, 200, 34, 0, 0, Math.PI * 2);
    g.fill();
    drawRingFront(g, this.ropes);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // escurece tudo (o baú tem de ser a estrela) com uma vinheta forte
    g.fillStyle = 'rgba(6,3,14,0.38)';
    g.fillRect(0, 0, W, H);
    const v = g.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.25, W / 2, H * 0.55, Math.max(W, H) * 0.7);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.72)');
    g.fillStyle = v;
    g.fillRect(0, 0, W, H);
  }

  start(): void {
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number): void => {
    if (!this.alive) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    this.onFrame(dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 40);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.6);
    this.dark += (this.darkTo - this.dark) * Math.min(1, dt * 5);
    this.rayA += (this.rayTo - this.rayA) * Math.min(1, dt * (this.rayA > this.rayTo ? 1.6 : 8));
    this.parts.update(dt);
    this.draw();
  };

  private draw(): void {
    const { ctx, dpr, W, H } = this;
    const ox = this.shake > 0 ? (Math.random() - 0.5) * this.shake * dpr : 0;
    const oy = this.shake > 0 ? (Math.random() - 0.5) * this.shake * dpr : 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (ox || oy) {
      ctx.fillStyle = '#07040f';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    ctx.drawImage(this.bg, ox, oy);
    if (this.dark > 0.01) {
      ctx.globalAlpha = this.dark;
      ctx.fillStyle = '#04020a';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.globalAlpha = 1;
    }
    if (this.rayA > 0.01) {
      ctx.setTransform(dpr, 0, 0, dpr, ox, oy);
      drawRays(ctx, this.rayX, this.rayY, Math.max(W, H) * 0.9, this.rayA, this.t, this.rayColor, this.rainbow, this.low);
    }
    ctx.setTransform(dpr * this.z, 0, 0, dpr * this.z, (dpr * W) / 2 + ox, dpr * this.floorY + oy);
    this.onDraw(ctx);
    this.parts.draw(ctx);
    if (this.flash > 0.01) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = Math.min(1, this.flash);
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.globalAlpha = 1;
    }
  }

  /** Coordenadas do mundo a partir do ecrã. */
  wx(sx: number): number {
    return (sx - this.W / 2) / this.z;
  }
  wy(sy: number): number {
    return (sy - this.floorY) / this.z;
  }
  sx(wx: number): number {
    return this.W / 2 + wx * this.z;
  }
  sy(wy: number): number {
    return this.floorY + wy * this.z;
  }

  room(): number {
    return this.cap - this.parts.n;
  }

  /** Explosão de estrelas/brasas a partir de (x, y) no mundo. */
  burst(x: number, y: number, n: number, color: string, speed: number, spread = 2.4): void {
    n = Math.min(n, this.room());
    if (this.low) n = n >> 1;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * spread;
      const v = speed * (0.35 + Math.random() * 0.65);
      const star = i % 3 === 0;
      this.parts.spawn(star ? PK.Star : PK.Ember, x, y, Math.cos(a) * v, Math.sin(a) * v, 0.7 + Math.random() * 0.7, star ? 14 : 22, i % 2 ? color : '#ffffff', 700);
    }
  }

  confetti(n: number, x = 0): void {
    n = Math.min(n, this.room());
    if (this.low) n = n >> 1;
    const top = this.wy(-20);
    const half = this.W / this.z / 2;
    for (let i = 0; i < n; i++) {
      this.parts.spawn(PK.Confetti, x + (Math.random() - 0.5) * half * 2, top - Math.random() * 160, (Math.random() - 0.5) * 220, Math.random() * 120, 3.2, 6 + Math.random() * 3, CONFETTI[i % CONFETTI.length], 160);
    }
  }

  ring(x: number, y: number, color: string, size = 420): void {
    if (this.room() > 0) this.parts.spawn(PK.Ring, x, y, 0, 0, 0.6, size, color, 0);
  }

  destroy(): void {
    if (!this.alive) return;
    this.alive = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.root.classList.add('out');
    const r = this.root;
    setTimeout(() => r.remove(), 260);
  }

  banner(text: string, sub: string, cls: string, ms = 1900): void {
    this.ui.querySelector('.cx-banner')?.remove();
    const b = el('div', `cx-banner ${cls}`, `<b>${esc(text)}</b>${sub ? `<span>${sub}</span>` : ''}`);
    this.ui.appendChild(b);
    setTimeout(() => b.remove(), ms);
  }
}

/** Raios de luz a rodar (espaço de ecrã). */
function drawRays(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, a: number, t: number, color: string, rainbow: boolean, low: boolean): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalCompositeOperation = 'lighter';
  const A = Math.min(1, a);
  const n = 16;
  ctx.globalAlpha = A * 0.32;
  for (let i = 0; i < n; i++) {
    const ang = t * 0.35 + (i / n) * Math.PI * 2;
    const w = i % 2 ? 0.05 : 0.085;
    const r = i % 2 ? R * 0.8 : R;
    ctx.fillStyle = rainbow ? RAINBOW[(i + Math.floor(t * 3)) % 6] : color;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(ang - w) * r, Math.sin(ang - w) * r);
    ctx.lineTo(Math.cos(ang + w) * r, Math.sin(ang + w) * r);
    ctx.closePath();
    ctx.fill();
  }
  if (!low) {
    ctx.globalAlpha = A * 0.22;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 10; i++) {
      const ang = -t * 0.22 + (i / 10) * Math.PI * 2 + 0.2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(ang - 0.025) * R * 0.7, Math.sin(ang - 0.025) * R * 0.7);
      ctx.lineTo(Math.cos(ang + 0.025) * R * 0.7, Math.sin(ang + 0.025) * R * 0.7);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.globalAlpha = A;
  const gr = R * 0.55;
  ctx.drawImage(glowSprite(rainbow ? '#ffffff' : color), -gr, -gr, gr * 2, gr * 2);
  ctx.restore();
}

// ───────────────────────── Desenho do baú ─────────────────────────

/** Pose reutilizável (sem alocações por frame). */
interface Pose {
  x: number;
  y: number;
  s: number;
  lid: number;
  wob: number;
  glow: number;
  leak: number;
  leakColor: string;
  cracks: number;
  beams: number;
}

const newPose = (): Pose => ({ x: 0, y: 0, s: CS, lid: 0, wob: 0, glow: 0.5, leak: 0, leakColor: '#ffffff', cracks: 0, beams: 0 });

/** Fendas de luz (3 níveis) e feixes que escapam pela tampa: gerados uma vez por baú aberto. */
class Leaks {
  paths: Path2D[] = [];
  beams = new Float32Array(9 * 4);
  constructor() {
    for (let lvl = 0; lvl < TAPS; lvl++) {
      const p = new Path2D();
      for (let k = 0; k < 2; k++) {
        let x = (Math.random() - 0.5) * (CW - 50);
        let y = -CH + 2;
        p.moveTo(x, y);
        const steps = 3 + Math.floor(Math.random() * 3);
        for (let s = 0; s < steps; s++) {
          x += (Math.random() - 0.5) * 24;
          y += 9 + Math.random() * 12;
          p.lineTo(x, y);
          if (Math.random() < 0.35) {
            p.lineTo(x + (Math.random() - 0.5) * 26, y + 8 + Math.random() * 8);
            p.moveTo(x, y);
          }
        }
      }
      this.paths.push(p);
    }
    for (let i = 0; i < 9; i++) {
      this.beams[i * 4] = (Math.random() - 0.5) * (CW - 30);
      this.beams[i * 4 + 1] = (Math.random() - 0.5) * 1.1;
      this.beams[i * 4 + 2] = 160 + Math.random() * 220;
      this.beams[i * 4 + 3] = 0.04 + Math.random() * 0.05;
    }
  }
}

function drawChest(ctx: CanvasRenderingContext2D, spr: ChestSprites, p: Pose, t: number, leaks: Leaks | null): void {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(p.s, p.s);
  ctx.rotate(p.wob);
  const emit = spr.look.emit;
  // brilho de fundo a respirar
  if (p.glow > 0.01) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, p.glow * (0.75 + Math.sin(t * 2.4) * 0.25));
    ctx.drawImage(glowSprite(p.leak > 0.05 ? p.leakColor : emit), -230, -CH - 170, 460, 300);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  const br = p.lid > 0 ? 0 : Math.sin(t * 2.2) * 0.012;
  ctx.scale(1 - br * 0.5, 1 + br);
  drawSprite(ctx, spr.body);
  ctx.globalCompositeOperation = 'lighter';
  if (spr.bodyGlow) {
    ctx.globalAlpha = 0.55 + Math.sin(t * 3.1) * 0.35;
    drawSprite(ctx, spr.bodyGlow);
  }
  // fendas de luz no corpo
  if (leaks && p.cracks > 0) {
    ctx.strokeStyle = p.leakColor;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const n = Math.min(TAPS, Math.ceil(p.cracks));
    for (let i = 0; i < n; i++) {
      ctx.globalAlpha = Math.min(1, p.cracks - i) * (0.75 + Math.sin(t * 13 + i * 2) * 0.25);
      ctx.lineWidth = 7;
      ctx.stroke(leaks.paths[i]);
    }
    ctx.strokeStyle = '#ffffff';
    for (let i = 0; i < n; i++) {
      ctx.globalAlpha = Math.min(1, p.cracks - i) * 0.9;
      ctx.lineWidth = 2.2;
      ctx.stroke(leaks.paths[i]);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  // boca aberta
  if (p.lid > 0) {
    ctx.fillStyle = '#0b0610';
    ctx.beginPath();
    ctx.ellipse(0, -CH + 2, CW / 2 - 6, 12 * Math.min(1, p.lid * 2), 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, p.lid * 1.5);
    ctx.drawImage(glowSprite(p.leakColor), -190, -CH - 150, 380, 220);
    ctx.drawImage(glowSprite('#ffffff'), -90, -CH - 50, 180, 80);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  // tampa: gira à volta da dobradiça (comprime a face da frente e depois mostra o forro)
  ctx.save();
  ctx.translate(0, -CH);
  const ang = p.lid * 2.05;
  const c = Math.cos(ang);
  ctx.translate(0, -Math.sin(ang) * 10);
  if (c > 0) {
    ctx.scale(1, Math.max(0.02, c));
    drawSprite(ctx, spr.lid);
    if (spr.lidGlow) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55 + Math.sin(t * 3.1 + 1) * 0.35;
      drawSprite(ctx, spr.lidGlow);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  } else {
    ctx.scale(1, Math.min(0.9, -c * 0.9));
    drawSprite(ctx, spr.lidIn);
  }
  ctx.restore();
  // luz a vazar pela fresta + fechadura incandescente + feixes
  if (p.leak > 0.01 && p.lid < 0.05) {
    ctx.globalCompositeOperation = 'lighter';
    const L = p.leak;
    ctx.globalAlpha = Math.min(1, L * 1.2);
    ctx.drawImage(glowSprite(p.leakColor), -CW * 0.75, -CH - 22 * L, CW * 1.5, 44 * L);
    ctx.drawImage(glowSprite('#ffffff'), -CW * 0.45, -CH - 5, CW * 0.9, 10);
    const kr = 30 + L * 70;
    ctx.drawImage(glowSprite(p.leakColor), -kr, -CH + 14 - kr, kr * 2, kr * 2);
    if (leaks && p.beams > 0) {
      ctx.fillStyle = p.leakColor;
      const nb = Math.min(9, Math.ceil(p.beams));
      for (let i = 0; i < nb; i++) {
        const bx = leaks.beams[i * 4];
        const ba = leaks.beams[i * 4 + 1] - Math.PI / 2;
        const bl = leaks.beams[i * 4 + 2] * (0.6 + L * 0.6);
        const bw = leaks.beams[i * 4 + 3];
        ctx.globalAlpha = Math.min(1, p.beams - i) * L * (0.35 + 0.25 * Math.sin(t * 9 + i * 1.7));
        ctx.beginPath();
        ctx.moveTo(bx - 6, -CH);
        ctx.lineTo(bx + Math.cos(ba - bw) * bl, -CH + Math.sin(ba - bw) * bl);
        ctx.lineTo(bx + Math.cos(ba + bw) * bl, -CH + Math.sin(ba + bw) * bl);
        ctx.lineTo(bx + 6, -CH);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

// ───────────────────────── Cartas ─────────────────────────

interface Reveal {
  kind: 'cur' | 'item';
  drop: ChestDrop | null;
  coins: number;
  gems: number;
  tier: number;
  rarity: Rarity;
  bonus: boolean;
}

function cardBack(r: Reveal): string {
  return `<div class="cx-face cx-back"><div class="cx-back-ring"></div><div class="cx-back-mark">${ico(r.kind === 'cur' ? 'coin' : 'star')}</div><div class="cx-back-glint"></div></div>`;
}

function buildCard(r: Reveal, i: number, n: number): HTMLElement {
  const c = el('div', `cx-card r-${r.kind === 'cur' ? 'cur' : r.rarity} t${r.tier}${r.bonus ? ' bonus' : ''}`);
  let front: string;
  if (r.kind === 'cur') {
    front = `<div class="cx-face cx-front"><div class="cx-shine"></div><div class="cx-kind">${i + 1}/${n} · Currency</div>
      <div class="cx-cur">${r.coins ? `<div class="cx-cur-row">${ico('coin')}<b>+${fmt(r.coins)}</b></div>` : ''}${r.gems ? `<div class="cx-cur-row gem">${ico('gem')}<b>+${fmt(r.gems)}</b></div>` : ''}</div>
      <div class="cx-name">${r.coins && r.gems ? 'Coins &amp; Gems' : r.coins ? 'Coins' : 'Gems'}</div></div>`;
  } else {
    const d = r.drop!;
    const it = item(d.id!);
    const owned = count(d.id!);
    const note = d.isNew
      ? '<div class="cx-note new">New for your collection!</div>'
      : `<div class="cx-note dup">Duplicate · you own ×${owned}</div>`;
    front = `<div class="cx-face cx-front"><div class="cx-shine"></div><div class="cx-kind">${r.bonus ? 'Lucky bonus' : `${i + 1}/${n}`} · ${esc(KIND_NAMES[it.kind])}</div>
      <div class="cx-art"></div>
      <div class="cx-name">${esc(dropName(d))}</div>
      ${rarityTag(d.rarity)}
      ${note}
      <p class="cx-desc">${esc(it.desc)}</p></div>`;
  }
  c.innerHTML = `<div class="cx-flip">${cardBack(r)}${front}</div>${r.drop?.isNew ? '<div class="cx-new">NEW!</div>' : r.kind === 'item' ? '<div class="cx-dup">+1</div>' : ''}<div class="cx-tap">tap to continue</div>`;
  if (r.drop && r.kind === 'item') c.querySelector('.cx-art')!.appendChild(dropIcon(r.drop));
  return c;
}

function miniCard(d: ChestDrop, flipped = true): HTMLElement {
  const c = el('div', `cx-mini r-${d.rarity} t${tierOf(d.rarity)}${flipped ? ' flipped' : ''}`);
  const inner = el('div', 'cx-mini-in');
  const back = el('div', 'cx-mini-back', ico('star'));
  const front = el('div', 'cx-mini-front');
  front.appendChild(dropIcon(d));
  front.appendChild(el('div', 'mc-name', esc(dropName(d))));
  inner.append(back, front);
  c.appendChild(inner);
  if (d.isNew) c.appendChild(el('div', 'cx-new sm', 'NEW'));
  return c;
}

function heroCard(d: ChestDrop): HTMLElement {
  const it = d.kind === 'item' ? item(d.id!) : null;
  const h = el('div', `cx-hero r-${d.rarity} t${tierOf(d.rarity)}`);
  h.innerHTML = `<div class="cx-hero-rib">BEST DROP</div><div class="cx-hero-art"></div>
    <div class="cx-hero-name">${esc(dropName(d))}</div>${rarityTag(d.rarity)}
    ${it ? `<div class="cx-hero-kind">${esc(KIND_NAMES[it.kind])}${d.isNew ? ' · <b class="nw">NEW!</b>' : ''}</div>` : ''}`;
  h.querySelector('.cx-hero-art')!.appendChild(dropIcon(d));
  return h;
}

function bestOf(list: ChestDrop[]): ChestDrop {
  let b = list[0];
  for (const d of list) {
    const k = tierOf(d.rarity) - tierOf(b.rarity);
    if (k > 0 || (k === 0 && d.kind === 'item' && (b.kind !== 'item' || (d.isNew && !b.isNew)))) b = d;
  }
  return b;
}

// ───────────────────────── "Pode conter" ─────────────────────────

interface Tease {
  d: ItemDef;
  odds: string;
}

/** Itens mais raros que este baú pode dar, com as probabilidades reais (por baú). */
function teasers(id: ChestId): Tease[] {
  const c = CHESTS[id];
  const sum = Object.values(c.weights).reduce((a, b) => a + (b ?? 0), 0);
  const rs = (Object.keys(c.weights) as Rarity[]).filter((r) => (c.weights[r] ?? 0) > 0 && poolFor(r).length).sort((a, b) => tierOf(b) - tierOf(a)).slice(0, 2);
  const lists = rs.map((r) => {
    const p = (c.weights[r] ?? 0) / sum;
    const P = 1 - Math.pow(1 - p, c.rolls);
    const odds = P >= 0.5 ? 'Very likely' : `1 in ${fmt(Math.max(2, Math.round(1 / P)))} chests`;
    return [...poolFor(r)].sort(() => Math.random() - 0.5).slice(0, 3).map((d): Tease => ({ d, odds }));
  });
  // intercala raridades: topo, segunda, topo...
  const out: Tease[] = [];
  for (let i = 0; i < 3; i++) for (const l of lists) if (l[i]) out.push(l[i]);
  return out;
}

function teaseEl(id: ChestId): { el: HTMLElement; step: () => void } {
  const list = teasers(id);
  const box = el('div', 'cx-tease');
  box.innerHTML = `<div class="cx-tease-h">${ico('sparkle')} Could contain</div><div class="cx-tease-card"></div>
    <div class="cx-tease-egg"></div>`;
  const card = box.querySelector('.cx-tease-card') as HTMLElement;
  const egg = box.querySelector('.cx-tease-egg') as HTMLElement;
  const eggs: string[] = [];
  if (id !== 'mitico') eggs.push(`${ico('bolt')} Lucky upgrade: 1 in ${Math.round(1 / CHEST_UPGRADE_CHANCE)}`);
  eggs.push(`${ico('gift')} Lucky bonus item: 1 in ${Math.round(1 / LUCKY_BONUS_CHANCE)}`);
  let i = 0;
  const step = () => {
    if (list.length) {
      const t = list[i % list.length];
      card.className = `cx-tease-card r-${t.d.rarity}`;
      card.innerHTML = `<div class="cx-tease-art"></div><div class="cx-tease-txt"><b>${esc(t.d.name)}</b>${rarityTag(t.d.rarity)}<small>${t.odds}</small></div>`;
      card.querySelector('.cx-tease-art')!.appendChild(itemThumb(t.d.id));
    }
    egg.innerHTML = eggs[i % eggs.length];
    i++;
  };
  step();
  return { el: box, step };
}

// ───────────────────────── Abrir um baú ─────────────────────────

type Phase = 'drop' | 'charge' | 'transform' | 'prime' | 'burst' | 'reveal' | 'summary';
type CardPhase = 'fly' | 'pulse' | 'flip' | 'shown';

const PULSE = [0.12, 0.2, 0.34, 0.6, 1.15, 1.35, 1.6];

/** Abre um baú no centro do ringue com a animação completa. */
export function openChest(id: ChestId, onDone: () => void): void {
  unlockAudio();
  sfx.warmChest();
  // tudo é decidido (e gravado) logo à partida: fechar a meio não perde nada
  const roll = rollChestEvents(id);
  applyDrops(id, roll.all);
  const fromDef = CHESTS[id];
  const toDef = CHESTS[roll.rolledAs];
  let showId: ChestId = id;

  // cartas: moedas+gemas numa só, depois os itens do pior para o melhor, e o bónus no fim
  const reveals: Reveal[] = [];
  let coins = 0;
  let gems = 0;
  for (const d of roll.drops) {
    if (d.kind === 'coins') coins += d.amount;
    else if (d.kind === 'gems') gems += d.amount;
  }
  if (coins || gems) reveals.push({ kind: 'cur', drop: null, coins, gems, tier: 0, rarity: 'comum', bonus: false });
  for (const d of roll.drops) if (d.kind === 'item') reveals.push({ kind: 'item', drop: d, coins: 0, gems: 0, tier: tierOf(d.rarity), rarity: d.rarity, bonus: false });
  if (roll.bonus) reveals.push({ kind: 'item', drop: roll.bonus, coins: 0, gems: 0, tier: tierOf(roll.bonus.rarity), rarity: roll.bonus.rarity, bonus: true });
  const items = roll.all.filter((d) => d.kind === 'item');
  const best = bestOf(items.length ? items : roll.all);
  const bestTier = Math.max(0, ...roll.drops.filter((d) => d.kind === 'item').map((d) => tierOf(d.rarity)));

  // cor da luz a cada toque: começa baixa e só pode SUBIR até à verdadeira (nunca engana para cima)
  const lo = Math.min(...(Object.keys(toDef.weights) as Rarity[]).filter((r) => (toDef.weights[r] ?? 0) > 0).map(tierOf));
  const hint: number[] = [];
  {
    const h1 = bestTier <= lo ? bestTier : Math.max(lo, bestTier - 1 - Math.floor(Math.random() * 2));
    const h2 = h1 >= bestTier ? bestTier : Math.random() < 0.5 ? h1 : Math.min(bestTier, h1 + 1);
    hint.push(h1, h2, bestTier);
  }

  const st = new Stage('');
  const { ui } = st;
  const leaks = new Leaks();
  const pose = newPose();
  let spr = chestSprites(showId, 1);
  const refreshSprites = () => {
    spr = chestSprites(showId, st.dpr * st.z * CS);
  };
  st.onResize = refreshSprites;
  refreshSprites();

  let phase: Phase = 'drop';
  let pt = 0;
  let y = -1000;
  let vy = 0;
  let bounces = 0;
  let charge = 0;
  let chargeVis = 0;
  let leakTo = 0;
  let wobV = 0;
  let wobA = 0;
  let curHint = -1;
  let leakColor = fromDef.glow;
  let lid = 0;
  let primeDur = 0.3;
  let swapped = false;
  let teaseT = 0;

  // ── interface ──
  const top = el('div', 'cx-top', `<b>${esc(fromDef.name)}</b><span>${esc(fromDef.desc)}</span>`);
  const tease = teaseEl(id);
  const hintEl = el('div', 'cx-hint', `<span class="cx-hint-t">Tap the chest!</span><span class="cx-pips">${'<i></i>'.repeat(TAPS)}</span>`);
  const skipBtn = el('button', 'btn btn-ghost sm cx-skip', `Show all ${ico('skip')}`);
  const cardBox = el('div', 'cx-cardbox');
  const prog = el('div', 'cx-prog', reveals.map(() => '<i></i>').join(''));
  ui.append(top, tease.el, cardBox, skipBtn);
  skipBtn.onclick = (e) => {
    e.stopPropagation();
    sfx.click();
    showSummary(true);
  };

  const setPhase = (p: Phase) => {
    phase = p;
    pt = 0;
  };

  const land = () => {
    y = 0;
    vy = 0;
    setPhase('charge');
    ui.appendChild(hintEl);
    tease.el.classList.add('on');
  };

  const setHint = (tier: number) => {
    if (tier === curHint) return;
    const up = curHint >= 0 && tier > curHint;
    curHint = tier;
    leakColor = hexOf(rarAt(tier));
    hintEl.style.setProperty('--hc', leakColor);
    if (up) {
      // a luz mudou de cor: a raridade escondida é melhor do que parecia!
      sfx.chestUpgradeHint();
      st.flash = 0.35;
      st.flashColor = leakColor;
      st.ring(0, -CH * CS, leakColor, 520);
      st.burst(0, -CH * CS, 26, leakColor, 900);
      buzz(25);
      hintEl.classList.remove('up');
      void hintEl.offsetWidth;
      hintEl.classList.add('up');
    }
  };

  const tap = () => {
    charge++;
    sfx.chestTap(charge - 1);
    buzz(12 + charge * 8);
    wobV += (charge % 2 ? 1 : -1) * (0.9 + charge * 0.5);
    st.shake = 4 + charge * 5;
    leakTo = charge / TAPS;
    setHint(hint[Math.min(TAPS, charge) - 1]);
    st.burst(0, -CH * CS, 8 + charge * 6, leakColor, 600 + charge * 120);
    for (let i = 0; i < 8 && st.room() > 0; i++) st.parts.spawn(PK.Dust, (Math.random() - 0.5) * 260, -4, (Math.random() - 0.5) * 300, -Math.random() * 80, 0.7, 14, '#d8d0e8', 0);
    hintEl.querySelectorAll('.cx-pips i').forEach((p, i) => p.classList.toggle('on', i < charge));
    const ht = hintEl.querySelector('.cx-hint-t') as HTMLElement;
    ht.textContent = charge >= TAPS ? '' : charge === TAPS - 1 ? 'One more!' : 'Again!';
    if (charge === 2 && roll.upgraded && !swapped) {
      setPhase('transform');
      top.classList.add('gone');
      sfx.chestTransform();
      st.rayColor = '#ffd23d';
      st.rainbow = false;
      st.rayTo = 0.7;
      st.rayX = st.sx(0);
      st.rayY = st.sy(-CH * CS * 0.7);
      buzz([30, 40, 30, 40, 60]);
      return;
    }
    if (charge >= TAPS) startPrime();
  };

  const startPrime = () => {
    setPhase('prime');
    hintEl.remove();
    tease.el.classList.remove('on');
    primeDur = bestTier >= 4 ? 1.36 : bestTier >= 3 ? 0.6 : 0.3;
    if (bestTier >= 4) {
      sfx.drumroll();
      st.darkTo = 0.45;
    } else if (bestTier >= 3) sfx.heartbeat();
  };

  const startBurst = () => {
    setPhase('burst');
    sfx.chestBurst(bestTier);
    sfx.creak();
    buzz([40, 30, 70]);
    st.flash = 0.9;
    st.flashColor = '#ffffff';
    st.shake = 18;
    st.rayColor = leakColor;
    st.rainbow = bestTier >= 6;
    st.rayX = st.sx(0);
    st.rayY = st.sy(-CH * CS);
    st.rayA = 1.4;
    st.rayTo = 0.5;
    st.darkTo = 0.25;
    st.burst(0, -CH * CS, 50 + bestTier * 14, leakColor, 1200);
    st.ring(0, -CH * CS, '#ffffff', 600);
    top.classList.add('gone');
  };

  // ── revelação ──
  let idx = -1;
  let card: HTMLElement | null = null;
  let cphase: CardPhase = 'fly';
  let ct = 0;
  let revealedFace = false;

  const nextCard = () => {
    idx++;
    if (idx >= reveals.length) {
      showSummary(false);
      return;
    }
    if (idx === 0) ui.appendChild(prog);
    const r = reveals[idx];
    if (r.bonus) {
      st.banner('LUCKY BONUS!', 'An extra item for you', 'cx-b-bonus', 1600);
      sfx.chestTransform();
      st.confetti(40);
    }
    card?.remove();
    card = buildCard(r, idx, reveals.length - (roll.bonus ? 1 : 0));
    cardBox.appendChild(card);
    cphase = 'fly';
    ct = 0;
    revealedFace = false;
    st.darkTo = r.tier >= 4 ? 0.35 : 0.25;
    st.rayTo = 0.35;
    st.rayColor = hexOf(r.rarity);
    st.rainbow = r.tier >= 6;
    st.rayX = st.W / 2;
    st.rayY = st.H * 0.48;
    sfx.lightWhoosh();
    st.burst(0, -CH * CS, 10 + r.tier * 4, hexOf(r.rarity), 700);
    prog.children[idx]?.classList.add('cur');
  };

  const flip = () => {
    if (!card) return;
    cphase = 'flip';
    ct = 0;
    card.classList.remove('charging');
    card.classList.add('flipped');
    sfx.cardFlip();
  };

  const onFace = () => {
    revealedFace = true;
    const r = reveals[idx];
    const color = hexOf(r.rarity);
    const p = prog.children[idx] as HTMLElement | undefined;
    if (p) {
      p.classList.remove('cur');
      p.classList.add('done');
      p.style.setProperty('--pc', r.kind === 'cur' ? '#ffd23d' : color);
    }
    if (r.kind === 'cur') {
      sfx.coin();
      return;
    }
    sfx.stinger(r.tier);
    const cx = st.wx(st.W / 2);
    const cy = st.wy(st.H * 0.48);
    st.burst(cx, cy, 14 + r.tier * 10, color, 500 + r.tier * 120, 6.28);
    st.rayA = 0.6 + r.tier * 0.12;
    if (r.drop?.isNew) buzz(20);
    if (r.tier >= 4) {
      const [txt, cls] = SPECIAL[Math.min(6, r.tier)];
      st.banner(txt, '', cls, 2200);
      st.darkTo = 0.78;
      st.rayTo = 1.1;
      st.rayA = 1.6;
      st.flash = 0.8;
      st.flashColor = r.tier >= 6 ? '#ffffff' : color;
      st.shake = 14;
      st.confetti(r.tier >= 5 ? 120 : 80, cx);
      st.ring(cx, cy, color, 700);
      buzz(r.tier >= 6 ? [60, 40, 60, 40, 160] : [50, 40, 120]);
      card?.classList.add('special');
    } else if (r.tier >= 3) {
      st.flash = 0.25;
      st.flashColor = color;
      st.ring(cx, cy, color, 480);
    }
  };

  const showSummary = (skipped: boolean) => {
    if (phase === 'summary') return;
    const wasRevealed = idx >= reveals.length - 1 && revealedFace;
    setPhase('summary');
    lid = 1;
    chargeVis = 0;
    leakTo = 0;
    ui.innerHTML = '';
    st.darkTo = 0.5;
    st.rayTo = 0.35;
    st.rayColor = hexOf(best.rarity);
    st.rainbow = tierOf(best.rarity) >= 6;
    if (skipped && !wasRevealed) {
      sfx.chestBurst(bestTier);
      sfx.stinger(tierOf(best.rarity));
      st.flash = 0.6;
      st.rayA = 1.2;
      if (tierOf(best.rarity) >= 4) st.confetti(70);
    }
    const box = el('div', 'cx-sum');
    const showDef = CHESTS[roll.rolledAs];
    const chips: string[] = [];
    if (roll.upgraded) chips.push(`<span class="cx-chip up">${ico('bolt')} Lucky upgrade: ${esc(fromDef.name.replace(/ Chest$/, ''))} → ${esc(showDef.name.replace(/ Chest$/, ''))}</span>`);
    if (roll.bonus) chips.push(`<span class="cx-chip bonus">${ico('gift')} Lucky bonus item</span>`);
    const nNew = items.filter((d) => d.isNew).length;
    box.innerHTML = `<div class="cx-sum-l"></div><div class="cx-sum-r">
      <h2>${esc(showDef.name)}</h2>${chips.length ? `<div class="cx-chips">${chips.join('')}</div>` : ''}
      <div class="cx-totals">${coins ? `<span>${ico('coin')} +${fmt(coins)}</span>` : ''}${gems ? `<span class="gem">${ico('gem')} +${fmt(gems)}</span>` : ''}<span>${ico('chest')} ${items.length} item${items.length === 1 ? '' : 's'}</span>${nNew ? `<span class="nw">${nNew} new</span>` : ''}</div>
      <div class="cx-grid"></div><div class="cx-btns"></div></div>`;
    box.querySelector('.cx-sum-l')!.appendChild(heroCard(best));
    const grid = box.querySelector('.cx-grid') as HTMLElement;
    items.forEach((d, i) => {
      const m = miniCard(d);
      m.style.animationDelay = `${i * 50}ms`;
      if (d === best) m.classList.add('best');
      grid.appendChild(m);
    });
    const btns = box.querySelector('.cx-btns') as HTMLElement;
    const left = S.chests[id] ?? 0;
    const total = chestCount();
    if (left > 0) {
      const again = el('button', 'btn btn-blue', `${ico('chest')} Open another <small>×${left}</small>`);
      again.onclick = () => {
        sfx.click();
        st.destroy();
        openChest(id, onDone);
      };
      btns.appendChild(again);
    }
    if (total > 1) {
      const all = el('button', 'btn btn-ghost', `Open all <small>(${total})</small>`);
      all.onclick = () => {
        sfx.click();
        st.destroy();
        openAllChests(onDone);
      };
      btns.appendChild(all);
    }
    const ok = el('button', 'btn btn-gold', 'Continue');
    ok.onclick = () => {
      sfx.click();
      st.destroy();
      onDone();
    };
    btns.appendChild(ok);
    ui.appendChild(box);
  };

  st.root.onclick = () => {
    switch (phase) {
      case 'drop':
        if (y > -900) land();
        break;
      case 'charge':
        tap();
        break;
      case 'transform':
        if (swapped && pt > 0.7) {
          top.classList.remove('gone');
          st.rayTo = 0;
          setPhase('charge');
        }
        break;
      case 'prime':
        if (pt > 0.25) startBurst();
        break;
      case 'burst':
        if (pt > 0.2) {
          setPhase('reveal');
          nextCard();
        }
        break;
      case 'reveal':
        if (cphase === 'fly' || cphase === 'pulse') flip();
        else if (cphase === 'flip') {
          if (!revealedFace) onFace();
          cphase = 'shown';
          card?.classList.add('done');
        } else {
          sfx.click();
          nextCard();
        }
        break;
    }
  };

  st.onFrame = (dt) => {
    pt += dt;
    // oscilação amortecida do baú (impulso a cada toque)
    wobV += (-wobA * 160 - wobV * 9) * dt;
    wobA += wobV * dt;
    chargeVis += (leakTo - chargeVis) * Math.min(1, dt * 6);
    switch (phase) {
      case 'drop':
        vy += 3000 * dt;
        y += vy * dt;
        if (y >= 0) {
          y = 0;
          if (bounces === 0) {
            sfx.chestLand(1);
            buzz(30);
            st.shake = 14;
            for (let i = 0; i < 22 && st.room() > 0; i++) st.parts.spawn(PK.Dust, (Math.random() - 0.5) * 320, -4, (Math.random() - 0.5) * 520, -Math.random() * 140, 0.9, 18, '#d8d0e8', 0);
            st.ring(0, 0, '#ffffff', 380);
          }
          bounces++;
          if (vy > 400 && bounces < 3) vy = -vy * 0.22;
          else land();
        }
        break;
      case 'charge':
        teaseT += dt;
        if (teaseT > 1.5) {
          teaseT = 0;
          tease.step();
        }
        // pede atenção se o jogador hesitar
        if (pt > 3.5 && charge === 0) hintEl.classList.add('nudge');
        if (Math.random() < 0.08 + charge * 0.12 && st.room() > 0) st.parts.spawn(PK.Ember, (Math.random() - 0.5) * 200, -CH * CS, (Math.random() - 0.5) * 60, -160 - Math.random() * 160, 0.8, 16, charge ? leakColor : fromDef.glow, 0);
        break;
      case 'transform': {
        const k = Math.min(1, pt / 0.38);
        wobA = Math.sin(st.t * 70) * 0.06 * k;
        if (Math.random() < 0.6 && st.room() > 0) {
          const a = Math.random() * 6.28;
          st.parts.spawn(PK.Star, Math.cos(a) * 260, -CH * CS * 0.6 + Math.sin(a) * 180, -Math.cos(a) * 500, -Math.sin(a) * 360, 0.5, 12, '#ffe27a', 0);
        }
        if (!swapped && pt >= 0.38) {
          swapped = true;
          showId = roll.rolledAs;
          refreshSprites();
          st.flash = 1;
          st.flashColor = '#fff6c0';
          st.shake = 16;
          st.burst(0, -CH * CS * 0.6, 70, '#ffd23d', 1300, 6.28);
          st.ring(0, -CH * CS * 0.6, '#ffe27a', 700);
          st.banner('CHEST UPGRADE!', `${esc(fromDef.name.replace(/ Chest$/, ''))} → <b>${esc(toDef.name.replace(/ Chest$/, ''))}</b>`, 'cx-b-up', 2000);
          top.innerHTML = `<b>${esc(toDef.name)}</b><span>${esc(toDef.desc)}</span>`;
          top.classList.add('upgraded');
          tease.el.remove();
        }
        if (pt > 1.6) {
          top.classList.remove('gone');
          wobA = 0;
          st.rayTo = 0;
          setPhase('charge');
        }
        break;
      }
      case 'prime': {
        const k = Math.min(1, pt / primeDur);
        leakTo = 1;
        wobA = Math.sin(st.t * 58) * (0.015 + 0.05 * k);
        st.shake = Math.max(st.shake, 2 + k * 8);
        if (Math.random() < 0.5 && st.room() > 0) st.parts.spawn(PK.Spark, (Math.random() - 0.5) * 240, -CH * CS, (Math.random() - 0.5) * 500, -300 - Math.random() * 500, 0.4, 3, leakColor, 900);
        if (pt >= primeDur) startBurst();
        break;
      }
      case 'burst':
        wobA *= 0.8;
        lid = Math.min(1, lid + dt * 5);
        if (pt > 0.6) {
          setPhase('reveal');
          nextCard();
        }
        break;
      case 'reveal': {
        ct += dt;
        const r = reveals[idx];
        if (!r) break;
        if (cphase === 'fly' && ct > 0.32) {
          cphase = 'pulse';
          ct = 0;
          if (r.tier >= 4) {
            sfx.heartbeat();
            st.darkTo = 0.6;
          }
          if (r.tier >= 3) card?.classList.add('charging');
        } else if (cphase === 'pulse' && ct > (r.kind === 'cur' ? 0.08 : PULSE[r.tier])) flip();
        else if (cphase === 'flip') {
          if (!revealedFace && ct > 0.2) onFace();
          if (ct > 0.45) {
            cphase = 'shown';
            ct = 0;
            card?.classList.add('done');
          }
        } else if (cphase === 'shown' && r.kind === 'cur' && ct > 0.8) nextCard();
        // brilho a subir do baú
        if (Math.random() < 0.15 && st.room() > 0) st.parts.spawn(PK.Ember, (Math.random() - 0.5) * 160, -CH * CS, 0, -220, 0.8, 18, hexOf(r.rarity), 0);
        break;
      }
      case 'summary':
        if (Math.random() < 0.06 && st.room() > 0) st.parts.spawn(PK.Ember, (Math.random() - 0.5) * 200, -CH * CS, 0, -180, 0.9, 16, hexOf(best.rarity), 0);
        break;
    }
    // baú mítico: brasas a flutuar sempre
    if (showId === 'mitico' && Math.random() < 0.25 && st.room() > 0) st.parts.spawn(PK.Ember, (Math.random() - 0.5) * 340, -Math.random() * 180, (Math.random() - 0.5) * 30, -60 - Math.random() * 80, 1.4, 10, Math.random() < 0.5 ? '#ff3d6e' : '#ff9a3d', 0);
    if (curHint >= 6) leakColor = RAINBOW[Math.floor(st.t * 6) % 6];
  };

  st.onDraw = (ctx) => {
    if (phase === 'drop') {
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -1600);
      ctx.lineTo(0, y - (CH + LID_H) * CS);
      ctx.stroke();
    }
    pose.y = y;
    pose.lid = lid;
    pose.wob = wobA + (phase === 'charge' && charge === 0 ? Math.sin(st.t * 3) * 0.012 : 0);
    pose.glow = phase === 'summary' ? 0.4 : 0.45 + chargeVis * 0.6;
    pose.leak = chargeVis;
    pose.leakColor = leakColor;
    pose.cracks = chargeVis * TAPS;
    pose.beams = phase === 'prime' ? 3 + (pt / primeDur) * 6 : chargeVis * 5;
    drawChest(ctx, spr, pose, st.t, leaks);
  };

  st.start();
  sfx.whoosh();
}

// ───────────────────────── Abrir todos ─────────────────────────

/** Quantos baús o jogador tem por abrir. */
export function chestCount(): number {
  return CHEST_ORDER.reduce((n, id) => n + (S.chests[id] ?? 0), 0);
}

/** Abre todos os baús de uma vez: rebentam juntos e as cartas viram em cascata (repetidos agrupados). */
export function openAllChests(onDone: () => void): void {
  unlockAudio();
  sfx.warmChest();
  const merged = new Map<string, ChestDrop>();
  const types: { id: ChestId; n: number; best: number }[] = [];
  let opened = 0;
  let coins = 0;
  let gems = 0;
  let upgrades = 0;
  let bonuses = 0;
  for (const id of CHEST_ORDER) {
    let n = 0;
    let bt = 0;
    while (S.chests[id] > 0) {
      const r = rollChestEvents(id);
      applyDrops(id, r.all);
      opened++;
      n++;
      if (r.upgraded) upgrades++;
      if (r.bonus) bonuses++;
      for (const d of r.all) {
        if (d.kind === 'coins') coins += d.amount;
        else if (d.kind === 'gems') gems += d.amount;
        else bt = Math.max(bt, tierOf(d.rarity));
        const k = d.kind === 'item' ? d.id! : d.kind;
        const m = merged.get(k);
        if (m) {
          m.amount += d.amount;
          m.isNew = m.isNew || d.isNew;
        } else merged.set(k, { ...d });
      }
    }
    if (n) types.push({ id, n, best: bt });
  }
  if (!opened) return onDone();
  const items = [...merged.values()].filter((d) => d.kind === 'item').sort((a, b) => tierOf(b.rarity) - tierOf(a.rarity) || (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
  const best = items.length ? items[0] : [...merged.values()][0];
  const bestTier = tierOf(best.rarity);

  const st = new Stage('all-open');
  const { ui } = st;
  const k = types.length;
  const scale = k <= 1 ? CS : k === 2 ? 1.15 : k === 3 ? 0.95 : k === 4 ? 0.78 : 0.66;
  const spacing = CW * scale * 1.12;
  const poses = types.map((t, i) => {
    const p = newPose();
    p.s = scale;
    p.x = (i - (k - 1) / 2) * spacing;
    p.y = -900 - i * 260;
    p.leakColor = hexOf(rarAt(t.best));
    return p;
  });
  const vys = new Float32Array(k);
  const landed = new Uint8Array(k);
  const sprs = types.map((t) => chestSprites(t.id, 1));
  const leaks = types.map(() => new Leaks());
  st.onResize = () => types.forEach((t, i) => (sprs[i] = chestSprites(t.id, st.dpr * st.z * scale)));
  st.onResize();

  type P = 'drop' | 'charge' | 'burst' | 'grid' | 'done';
  let phase: P = 'drop';
  let pt = 0;
  let lid = 0;
  let leak = 0;
  let taps = 0;
  const setPhase = (p: P) => {
    phase = p;
    pt = 0;
  };

  const top = el('div', 'cx-top', `<b>Opening ${opened} chests!</b><span>${types.map((t) => `${esc(CHESTS[t.id].name.replace(/ Chest$/, ''))} ×${t.n}`).join(' · ')}</span>`);
  const skipBtn = el('button', 'btn btn-ghost sm cx-skip', `Show all ${ico('skip')}`);
  ui.append(top, skipBtn);

  // grelha (cartas viradas para baixo, com a cor da raridade no verso)
  let minis: HTMLElement[] = [];
  let order: number[] = [];
  let flipped = 0;
  let gridT = 0;
  let hero: HTMLElement | null = null;
  let heroShown = false;
  let box: HTMLElement | null = null;

  const buildGrid = () => {
    ui.innerHTML = '';
    box = el('div', 'cx-sum all');
    const chips: string[] = [];
    if (upgrades) chips.push(`<span class="cx-chip up">${ico('bolt')} ${upgrades} lucky upgrade${upgrades > 1 ? 's' : ''}</span>`);
    if (bonuses) chips.push(`<span class="cx-chip bonus">${ico('gift')} ${bonuses} lucky bonus item${bonuses > 1 ? 's' : ''}</span>`);
    const nNew = items.filter((d) => d.isNew).length;
    box.innerHTML = `<div class="cx-sum-l"></div><div class="cx-sum-r">
      <h2>${opened} chests opened!</h2>${chips.length ? `<div class="cx-chips">${chips.join('')}</div>` : ''}
      <div class="cx-totals">${coins ? `<span>${ico('coin')} +${fmt(coins)}</span>` : ''}${gems ? `<span class="gem">${ico('gem')} +${fmt(gems)}</span>` : ''}<span>${ico('chest')} ${items.length} item${items.length === 1 ? '' : 's'}</span>${nNew ? `<span class="nw">${nNew} new</span>` : ''}</div>
      <div class="cx-grid"></div><div class="cx-btns"></div></div>`;
    hero = heroCard(best);
    hero.classList.add('hidden');
    box.querySelector('.cx-sum-l')!.appendChild(hero);
    const grid = box.querySelector('.cx-grid') as HTMLElement;
    minis = items.map((d) => {
      const m = miniCard(d, false);
      grid.appendChild(m);
      return m;
    });
    // vira do pior para o melhor (o melhor fica para o fim)
    order = minis.map((_, i) => minis.length - 1 - i);
    const ok = el('button', 'btn btn-gold', 'Continue');
    ok.onclick = (e) => {
      e.stopPropagation();
      sfx.click();
      st.destroy();
      onDone();
    };
    box.querySelector('.cx-btns')!.appendChild(ok);
    ui.appendChild(box);
  };

  const showHero = () => {
    if (heroShown || !hero) return;
    heroShown = true;
    hero.classList.remove('hidden');
    sfx.stinger(bestTier);
    st.rayColor = hexOf(best.rarity);
    st.rainbow = bestTier >= 6;
    const r = hero.getBoundingClientRect();
    st.rayX = r.left + r.width / 2;
    st.rayY = r.top + r.height / 2;
    st.rayA = 1.3;
    st.rayTo = 0.5;
    const wx = st.wx(st.rayX);
    const wy = st.wy(st.rayY);
    st.burst(wx, wy, 30 + bestTier * 10, hexOf(best.rarity), 700, 6.28);
    if (bestTier >= 4) {
      const [txt, cls] = SPECIAL[Math.min(6, bestTier)];
      st.banner(txt, '', cls, 2000);
      st.flash = 0.7;
      st.flashColor = bestTier >= 6 ? '#ffffff' : hexOf(best.rarity);
      st.shake = 12;
      st.confetti(100, wx);
      st.darkTo = 0.7;
      buzz([50, 40, 120]);
    } else st.darkTo = 0.55;
    phase = 'done';
  };

  const flipAll = () => {
    for (const m of minis) m.classList.add('flipped');
    flipped = minis.length;
  };

  const startBurst = () => {
    setPhase('burst');
    top.classList.add('gone');
    sfx.chestBurst(bestTier);
    sfx.creak();
    buzz([40, 30, 80]);
    st.flash = 1;
    st.shake = 20;
    st.rayColor = hexOf(rarAt(Math.min(5, bestTier)));
    st.rainbow = bestTier >= 6;
    st.rayX = st.W / 2;
    st.rayY = st.sy(-CH * scale);
    st.rayA = 1.5;
    st.rayTo = 0.45;
    for (let i = 0; i < k; i++) st.burst(poses[i].x, -CH * scale, 30, poses[i].leakColor, 1100);
  };

  skipBtn.onclick = (e) => {
    e.stopPropagation();
    sfx.click();
    if (phase === 'drop' || phase === 'charge') startBurst();
    lid = 1;
    if (!box) buildGrid();
    setPhase('grid');
    flipAll();
    showHero();
  };

  st.root.onclick = () => {
    if (phase === 'drop' || phase === 'charge') {
      for (let i = 0; i < k; i++) poses[i].y = 0;
      landed.fill(1);
      startBurst();
    } else if (phase === 'burst') {
      if (pt > 0.15) {
        buildGrid();
        setPhase('grid');
      }
    } else if (phase === 'grid') {
      flipAll();
      showHero();
    }
  };

  st.onFrame = (dt) => {
    pt += dt;
    switch (phase) {
      case 'drop': {
        let all = true;
        for (let i = 0; i < k; i++) {
          if (landed[i]) continue;
          all = false;
          vys[i] += 3200 * dt;
          poses[i].y += vys[i] * dt;
          if (poses[i].y >= 0) {
            poses[i].y = 0;
            if (vys[i] > 500) {
              sfx.chestLand(0.8);
              st.shake = 10;
              for (let j = 0; j < 10 && st.room() > 0; j++) st.parts.spawn(PK.Dust, poses[i].x + (Math.random() - 0.5) * 200, -4, (Math.random() - 0.5) * 400, -Math.random() * 100, 0.8, 14, '#d8d0e8', 0);
              vys[i] = -vys[i] * 0.2;
            } else landed[i] = 1;
          }
        }
        if (all) setPhase('charge');
        break;
      }
      case 'charge': {
        // três "batidas" automáticas a carregar, cada vez mais fortes
        const want = Math.min(3, Math.floor(pt / 0.32) + 1);
        while (taps < want) {
          sfx.chestTap(taps);
          taps++;
          st.shake = 4 + taps * 4;
          buzz(15);
          for (let i = 0; i < k; i++) st.burst(poses[i].x, -CH * scale, 6, poses[i].leakColor, 600);
        }
        leak = Math.min(1, pt / 0.9);
        for (let i = 0; i < k; i++) poses[i].wob = Math.sin(st.t * (40 + i * 7)) * (0.02 + leak * 0.05);
        if (pt > 1.05) startBurst();
        break;
      }
      case 'burst':
        lid = Math.min(1, lid + dt * 5);
        for (let i = 0; i < k; i++) poses[i].wob *= 0.85;
        if (pt > 0.75) {
          buildGrid();
          setPhase('grid');
        }
        break;
      case 'grid': {
        gridT += dt;
        const step = minis.length > 24 ? 0.04 : minis.length > 12 ? 0.06 : 0.09;
        while (gridT > step && flipped < order.length) {
          gridT -= step;
          const m = minis[order[flipped]];
          m.classList.add('flipped');
          if (flipped % (minis.length > 24 ? 3 : 1) === 0) sfx.tick(flipped);
          flipped++;
        }
        if (flipped >= order.length && gridT > 0.35) showHero();
        break;
      }
    }
    if (phase !== 'drop' && Math.random() < 0.12 && st.room() > 0) {
      const i = Math.floor(Math.random() * k);
      st.parts.spawn(PK.Ember, poses[i].x + (Math.random() - 0.5) * 120 * scale, -CH * scale, 0, -200, 0.8, 14, poses[i].leakColor, 0);
    }
  };

  st.onDraw = (ctx) => {
    ctx.font = '900 34px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < k; i++) {
      const p = poses[i];
      p.lid = lid;
      p.leak = phase === 'charge' ? leak : 0;
      p.cracks = p.leak * TAPS;
      p.beams = p.leak * 6;
      p.glow = 0.45 + p.leak * 0.5;
      drawChest(ctx, sprs[i], p, st.t + i, leaks[i]);
      if (types[i].n > 1 && phase !== 'grid' && phase !== 'done') {
        const lx = p.x + CW * scale * 0.38;
        const ly = p.y - (CH + LID_H) * scale - 6;
        ctx.lineWidth = 7;
        ctx.strokeStyle = '#140a1c';
        ctx.strokeText(`×${types[i].n}`, lx, ly);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`×${types[i].n}`, lx, ly);
      }
    }
  };

  st.start();
  sfx.whoosh();
}
