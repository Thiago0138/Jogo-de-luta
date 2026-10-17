import { ANIMS, sample, type AnimName } from '../../../fight/anims';
import { drawFighter, type Expr } from '../../../render/fighter';
import { drawFighter3D } from '../../../render/turntable';
import { resolveLook, type Look } from '../../../render/look';
import { Skel, newPose, solve, type Pose } from '../../../render/pose';
import { S } from '../../../core/state';

export const FONT = '"Luckiest Guy", Impact, system-ui, sans-serif';

// ───────────────────────── Lutador animado ─────────────────────────

/** O lutador do jogador, animado com as animações das lutas. */
export class Rig {
  look: Look = resolveLook(S.appearance, S.loadout);
  pose: Pose = newPose();
  skel = new Skel();
  anim: AnimName = 'guard';
  idle: AnimName = 'guard';
  at = 0;
  expr: Expr = 'normal';
  private exprT = 0;
  flash = 0;
  /** Ajustes à pose depois da animação (ex.: levantar a barra). */
  post: ((p: Pose, t: number) => void) | null = null;
  readonly baseMinY: number;

  constructor() {
    const p = newPose();
    sample(ANIMS.guard, 0, p);
    this.baseMinY = solve(p, new Skel()).minY;
  }

  play(a: AnimName, from = 0): void {
    this.anim = a;
    this.at = from;
  }

  face(e: Expr, dur = 0.6): void {
    this.expr = e;
    this.exprT = dur;
  }

  update(dt: number, t: number): void {
    this.at += dt;
    if (this.exprT > 0) {
      this.exprT -= dt;
      if (this.exprT <= 0) this.expr = 'normal';
    }
    if (this.flash > 0) this.flash -= dt;
    const A = ANIMS[this.anim];
    const end = A.keys[A.keys.length - 1].t;
    if (!A.loop && this.at > Math.min(end, 3)) {
      this.anim = this.idle;
      this.at = 0;
    }
    sample(ANIMS[this.anim], this.at, this.pose);
    if (this.anim === 'guard') this.pose.dy += Math.sin(t * 5) * 1.5;
    this.post?.(this.pose, t);
    solve(this.pose, this.skel);
  }

  /** Escala que dá ao lutador cerca de `px` de altura. */
  static scaleFor(px: number): number {
    return px / 205;
  }

  /** Desenha com os pés em (x, floorY). */
  draw(ctx: CanvasRenderingContext2D, x: number, floorY: number, scale: number, facing: 1 | -1, t: number, yaw: number | null = null): void {
    const k = this.look.height;
    ctx.save();
    ctx.translate(x, floorY - this.baseMinY * scale * k);
    ctx.scale(scale * k * (yaw == null ? facing : 1), scale * k);
    const o = { t, expr: this.expr, flash: this.flash > 0, glow: null, rim: '#a98bff' };
    if (yaw == null) drawFighter(ctx, this.look, this.skel, o);
    else drawFighter3D(ctx, this.look, this.skel, yaw, o);
    ctx.restore();
  }

  /** Posição no ecrã de uma articulação (vista de perfil). */
  joint(j: number, x: number, floorY: number, scale: number, facing: 1 | -1): [number, number] {
    const k = this.look.height * scale;
    return [x + this.skel.x[j] * k * facing, floorY - this.baseMinY * k + this.skel.y[j] * k];
  }
}

// ───────────────────────── Efeitos ─────────────────────────

interface Part {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  kind: 'dot' | 'spark' | 'ring' | 'star' | 'sweat';
  g: number;
}

interface Pop {
  text: string;
  x: number;
  y: number;
  life: number;
  color: string;
  size: number;
}

/** Partículas, textos a flutuar, tremor e clarão — partilhados pelos mini-jogos. */
export class FX {
  parts: Part[] = [];
  pops: Pop[] = [];
  shake = 0;
  flash = 0;
  flashColor = '#fff';
  sx = 0;
  sy = 0;

  burst(x: number, y: number, n: number, color: string, speed = 220, kind: Part['kind'] = 'dot', g = 500, size = 4): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.75);
      const life = 0.35 + Math.random() * 0.4;
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.25, life, max: life, size: size * (0.6 + Math.random() * 0.8), color, kind, g });
    }
    if (this.parts.length > 260) this.parts.splice(0, this.parts.length - 260);
  }

  /** Jato direcional (ex.: suor a saltar para trás). */
  spray(x: number, y: number, n: number, dir: number, color: string, speed = 260, kind: Part['kind'] = 'sweat'): void {
    for (let i = 0; i < n; i++) {
      const a = dir + (Math.random() - 0.5) * 1.1;
      const v = speed * (0.4 + Math.random() * 0.7);
      const life = 0.4 + Math.random() * 0.35;
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, size: 3 + Math.random() * 2.5, color, kind, g: 700 });
    }
  }

  ring(x: number, y: number, color: string, size = 30): void {
    this.parts.push({ x, y, vx: 0, vy: 0, life: 0.35, max: 0.35, size, color, kind: 'ring', g: 0 });
  }

  pop(text: string, x: number, y: number, color: string, size = 30): void {
    this.pops.push({ text, x, y, life: 0.9, color, size });
    if (this.pops.length > 6) this.pops.shift();
  }

  kick(shake: number, flash = 0, color = '#fff'): void {
    this.shake = Math.max(this.shake, shake);
    if (flash > this.flash) {
      this.flash = flash;
      this.flashColor = color;
    }
  }

  update(dt: number): void {
    for (const p of this.parts) {
      p.life -= dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - dt * 1.5;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const p of this.pops) {
      p.life -= dt;
      p.y -= dt * 46;
    }
    this.pops = this.pops.filter((p) => p.life > 0);
    this.shake = Math.max(0, this.shake - dt * 40);
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.sx = (Math.random() - 0.5) * this.shake * 2;
    this.sy = (Math.random() - 0.5) * this.shake * 2;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.parts) {
      const u = p.life / p.max;
      ctx.globalAlpha = Math.min(1, u * 1.6);
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      if (p.kind === 'ring') {
        ctx.lineWidth = 4 * u + 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.9 - u), 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === 'spark') {
        ctx.lineWidth = p.size * 0.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
        ctx.stroke();
      } else if (p.kind === 'star') {
        star(ctx, p.x, p.y, p.size * 1.4, p.life * 6);
        ctx.fill();
      } else if (p.kind === 'sweat') {
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size * 0.6, p.size, Math.atan2(p.vy, p.vx) + Math.PI / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + u * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    for (const p of this.pops) {
      const age = 0.9 - p.life;
      const sc = age < 0.12 ? 0.6 + (age / 0.12) * 0.6 : 1.2 - Math.min(0.2, (age - 0.12) * 1.2);
      ctx.globalAlpha = Math.min(1, p.life * 3);
      outlined(ctx, p.text, p.x, p.y, p.size * sc, p.color);
    }
    ctx.globalAlpha = 1;
  }

  drawFlash(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    if (this.flash <= 0) return;
    ctx.globalAlpha = this.flash * 0.35;
    ctx.fillStyle = this.flashColor;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
}

// ───────────────────────── Desenho ─────────────────────────

export function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot = 0): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
}

/** Texto em estilo "jogo": letra grossa com contorno escuro e sombra. */
export function outlined(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center'): void {
  ctx.font = `${Math.round(size)}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size * 0.2);
  ctx.strokeStyle = '#140a1c';
  ctx.fillStyle = '#140a1c';
  ctx.fillText(text, x, y + size * 0.1);
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

const bgCache = new Map<string, HTMLCanvasElement>();

/** Fundo do ginásio (parede de tijolo, janelas com luz, tapete). Em cache por tamanho. */
export function gymBackdrop(W: number, H: number, floorY: number, dpr: number): HTMLCanvasElement {
  const key = `${W}x${H}x${floorY}x${dpr}`;
  const hit = bgCache.get(key);
  if (hit) return hit;
  if (bgCache.size > 6) bgCache.clear();
  const c = document.createElement('canvas');
  c.width = Math.round(W * dpr);
  c.height = Math.round(H * dpr);
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);
  // parede
  const g = ctx.createLinearGradient(0, 0, 0, floorY);
  g.addColorStop(0, '#1c1036');
  g.addColorStop(1, '#3a1d5c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, floorY);
  // tijolos
  const bh = Math.max(12, H / 26);
  const bw = bh * 2.6;
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = 1.5;
  for (let y = 0, row = 0; y < floorY; y += bh, row++) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
    for (let x = (row % 2) * (bw / 2); x < W; x += bw) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + bh);
      ctx.stroke();
    }
  }
  // tijolos mais claros aqui e ali
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 40; i++) {
    const row = Math.floor(rnd() * (floorY / bh));
    const x = Math.floor(rnd() * (W / bw)) * bw + (row % 2) * (bw / 2);
    ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.12)';
    ctx.fillRect(x + 1, row * bh + 1, bw - 2, bh - 2);
  }
  // janelas com feixes de luz
  for (const fx of [0.22, 0.78]) {
    const wx = W * fx;
    const ww = Math.min(110, W * 0.12);
    const wy = H * 0.08;
    const wh = floorY * 0.36;
    ctx.fillStyle = '#0d0820';
    rr(ctx, wx - ww / 2 - 4, wy - 4, ww + 8, wh + 8, 6);
    ctx.fill();
    const wg = ctx.createLinearGradient(0, wy, 0, wy + wh);
    wg.addColorStop(0, '#6b5cff');
    wg.addColorStop(1, '#2a1f6e');
    ctx.fillStyle = wg;
    ctx.fillRect(wx - ww / 2, wy, ww, wh);
    ctx.strokeStyle = '#0d0820';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.lineTo(wx, wy + wh);
    ctx.moveTo(wx - ww / 2, wy + wh / 2);
    ctx.lineTo(wx + ww / 2, wy + wh / 2);
    ctx.stroke();
    const beam = ctx.createLinearGradient(0, wy, 0, floorY);
    beam.addColorStop(0, 'rgba(160,140,255,0.16)');
    beam.addColorStop(1, 'rgba(160,140,255,0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(wx - ww / 2, wy + wh);
    ctx.lineTo(wx + ww / 2, wy + wh);
    ctx.lineTo(wx + ww * 1.4, floorY);
    ctx.lineTo(wx - ww * 0.2, floorY);
    ctx.closePath();
    ctx.fill();
  }
  // faixa de cor na parede
  ctx.fillStyle = 'rgba(255,210,61,0.12)';
  ctx.fillRect(0, floorY - H * 0.12, W, H * 0.025);
  ctx.fillStyle = 'rgba(255,61,110,0.12)';
  ctx.fillRect(0, floorY - H * 0.085, W, H * 0.012);
  // rodapé
  ctx.fillStyle = '#140a24';
  ctx.fillRect(0, floorY - 6, W, 6);
  // chão: tapete de borracha
  const fg = ctx.createLinearGradient(0, floorY, 0, H);
  fg.addColorStop(0, '#2b2238');
  fg.addColorStop(1, '#150f1f');
  ctx.fillStyle = fg;
  ctx.fillRect(0, floorY, W, H - floorY);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  const tiles = 9;
  for (let i = -tiles; i <= tiles * 2; i++) {
    const x0 = (i / tiles) * W;
    ctx.beginPath();
    ctx.moveTo(x0, floorY);
    ctx.lineTo(W / 2 + (x0 - W / 2) * 1.8, H);
    ctx.stroke();
  }
  for (const f of [0.3, 0.65]) {
    const y = floorY + (H - floorY) * f;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  // vinheta
  const v = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.3, W / 2, H * 0.55, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  bgCache.set(key, c);
  return c;
}

/** Sombra elíptica no chão. */
export function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y, w, w * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ───────────────────────── Equipamento ─────────────────────────

/** Saco pesado pendurado em (px, py); `ang` = balanço; `len` = corrente+saco. */
export function drawHeavyBag(ctx: CanvasRenderingContext2D, px: number, py: number, chain: number, bw: number, bh: number, ang: number, squash = 0, hit = 0): void {
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(-ang);
  // corrente
  ctx.strokeStyle = '#8c8aa0';
  ctx.lineWidth = Math.max(2, bw * 0.06);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, chain - bw * 0.25);
  ctx.moveTo(0, chain - bw * 0.25);
  ctx.lineTo(-bw * 0.4, chain + 2);
  ctx.moveTo(0, chain - bw * 0.25);
  ctx.lineTo(bw * 0.4, chain + 2);
  ctx.stroke();
  ctx.translate(0, chain);
  const w = bw * (1 + squash * 0.12);
  const h = bh * (1 - squash * 0.05);
  // corpo do saco
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, '#5a1424');
  g.addColorStop(0.35, '#d23048');
  g.addColorStop(0.55, '#ff5470');
  g.addColorStop(1, '#4a0f1c');
  ctx.fillStyle = g;
  ctx.strokeStyle = '#140a1c';
  ctx.lineWidth = 3;
  rr(ctx, -w / 2, 0, w, h, w * 0.42);
  ctx.fill();
  ctx.stroke();
  // faixas
  ctx.fillStyle = '#1b1028';
  ctx.fillRect(-w / 2 + 1.5, h * 0.12, w - 3, h * 0.07);
  ctx.fillRect(-w / 2 + 1.5, h * 0.8, w - 3, h * 0.07);
  // logótipo
  ctx.fillStyle = '#ffd23d';
  star(ctx, 0, h * 0.47, w * 0.2, 0);
  ctx.fill();
  if (hit > 0) {
    ctx.globalAlpha = hit * 0.6;
    ctx.fillStyle = '#fff';
    rr(ctx, -w / 2, 0, w, h, w * 0.42);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** Plataforma + saco rápido. (x,y) = ponto onde o saco está preso. */
export function drawSpeedBag(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, hit = 0, side: 1 | -1 = 1): void {
  // tábua
  ctx.fillStyle = '#5b3a1e';
  ctx.strokeStyle = '#140a1c';
  ctx.lineWidth = 3;
  rr(ctx, x - r * 3.2, y - r * 0.55, r * 6.4, r * 0.55, r * 0.15);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(x - r * 3.1, y - r * 0.5, r * 6.2, r * 0.14);
  // suporte à parede
  ctx.fillStyle = '#3a2a4c';
  ctx.fillRect(x + side * r * 2.6 - r * 0.25, y - r * 3.2, r * 0.5, r * 2.7);
  // saco (gota)
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.fillStyle = '#ddd';
  ctx.fillRect(-r * 0.12, 0, r * 0.24, r * 0.35);
  const g = ctx.createRadialGradient(-r * 0.3, r * 1.2, r * 0.1, 0, r * 1.4, r * 1.2);
  g.addColorStop(0, '#ffe680');
  g.addColorStop(0.5, '#ffb31a');
  g.addColorStop(1, '#b06a00');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, r * 0.3);
  ctx.bezierCurveTo(r * 0.5, r * 0.3, r * 1.0, r * 0.9, r * 0.85, r * 1.55);
  ctx.bezierCurveTo(r * 0.7, r * 2.1, -r * 0.7, r * 2.1, -r * 0.85, r * 1.55);
  ctx.bezierCurveTo(-r * 1.0, r * 0.9, -r * 0.5, r * 0.3, 0, r * 0.3);
  ctx.fill();
  ctx.stroke();
  if (hit > 0) {
    ctx.globalAlpha = hit * 0.7;
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** Barra com discos, vista de frente (horizontal). `w` = comprimento da barra. */
export function drawBarbell(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, pr: number, tilt = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.strokeStyle = '#140a1c';
  ctx.lineWidth = pr * 0.32 + 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.lineTo(w / 2, 0);
  ctx.stroke();
  ctx.strokeStyle = '#c9c6d8';
  ctx.lineWidth = pr * 0.32;
  ctx.stroke();
  for (const s of [-1, 1]) {
    const px = (s * w) / 2 - s * pr * 0.55;
    for (let i = 0; i < 2; i++) {
      const ox = px - s * i * pr * 0.42;
      const hh = pr * (i ? 1.55 : 2);
      ctx.fillStyle = i ? '#2a6fd1' : '#d23048';
      ctx.strokeStyle = '#140a1c';
      ctx.lineWidth = 2.5;
      rr(ctx, ox - pr * 0.2, -hh / 2, pr * 0.4, hh, pr * 0.12);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Manopla de foco (alvo redondo) — usada nos reflexos. */
export function drawPad(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, rot = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.strokeStyle = '#140a1c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 1.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.35, -r * 0.5, r * 0.25, r * 0.14, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
