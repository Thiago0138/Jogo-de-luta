import { ANIMS, sample, type AnimName } from '../fight/anims';
import { drawFighter, glowSprite, type Expr } from '../render/fighter';
import type { Look } from '../render/look';
import { Skel, newPose, solve } from '../render/pose';
import { item } from '../data/items';
import { RARITIES } from '../data/rarity';
import { S } from '../core/state';
import { resolveLook } from '../render/look';

/**
 * Pré-visualização animada de um lutador. Todas as instâncias partilham um único
 * requestAnimationFrame e só desenham quando estão visíveis.
 */
export class Preview {
  canvas: HTMLCanvasElement;
  look: Look;
  anim: AnimName = 'guard';
  at = 0;
  expr: Expr = 'normal';
  facing: 1 | -1 = 1;
  /** Fração da altura onde ficam os pés (0..1). */
  floor = 0.92;
  zoom = 1;
  focusHead = false;
  stage = true;
  visible = true;
  private pose = newPose();
  private skel = new Skel();
  private ctx: CanvasRenderingContext2D;
  private obs: IntersectionObserver;
  private idleT = 0;

  constructor(look: Look, opts: { stage?: boolean; focusHead?: boolean; zoom?: number } = {}) {
    this.look = look;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'preview';
    this.ctx = this.canvas.getContext('2d')!;
    this.stage = opts.stage ?? true;
    this.focusHead = opts.focusHead ?? false;
    this.zoom = opts.zoom ?? 1;
    this.obs = new IntersectionObserver((es) => {
      for (const e of es) this.visible = e.isIntersecting;
    });
    this.obs.observe(this.canvas);
    active.add(this);
    ensureLoop();
  }

  play(a: AnimName, expr: Expr = 'normal'): void {
    this.anim = a;
    this.at = 0;
    this.expr = expr;
  }

  destroy(): void {
    active.delete(this);
    this.obs.disconnect();
  }

  draw(dt: number, t: number): void {
    if (!this.canvas.isConnected) {
      this.destroy();
      return;
    }
    if (!this.visible) return;
    const c = this.canvas;
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(w * dpr);
    const H = Math.round(h * dpr);
    if (c.width !== W || c.height !== H) {
      c.width = W;
      c.height = H;
    }
    this.at += dt;
    const a = ANIMS[this.anim];
    const end = a.keys[a.keys.length - 1].t;
    if (!a.loop && this.at > end + 0.6) {
      this.play('guard');
    }
    // provocação ocasional
    this.idleT += dt;
    if (this.anim === 'guard' && this.idleT > 6) {
      this.idleT = 0;
      this.play('taunt', 'happy');
    }
    sample(a, this.at, this.pose);
    if (this.anim === 'guard') this.pose.dy += Math.sin(t * 5) * 1.5;
    solve(this.pose, this.skel);
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const k = this.look.height;
    let scale: number;
    let hipX: number;
    let hipY: number;
    if (this.focusHead) {
      scale = (H / 120) * this.zoom;
      hipX = W / 2 - this.skel.x[2] * scale * this.facing;
      hipY = H * 0.55 - this.skel.y[2] * scale;
    } else {
      scale = (H / 270) * this.zoom;
      hipX = W / 2;
      hipY = H * this.floor - this.skel.minY * scale * k;
    }
    if (this.stage && !this.focusHead) {
      const fy = H * this.floor;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35;
      ctx.drawImage(glowSprite('#7a5cff'), W / 2 - W * 0.45, fy - H * 0.12, W * 0.9, H * 0.24);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(W / 2, fy, 52 * scale, 10 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.translate(hipX, hipY);
    ctx.scale(scale * k * this.facing, scale * k);
    drawFighter(ctx, this.look, this.skel, { t, expr: this.expr, flash: false, glow: null });
  }
}

const active = new Set<Preview>();
let running = false;
let lastT = 0;

function ensureLoop(): void {
  if (running) return;
  running = true;
  lastT = performance.now();
  const tick = (now: number) => {
    if (!active.size) {
      running = false;
      return;
    }
    const dt = Math.min(0.1, (now - lastT) / 1000);
    lastT = now;
    if (!document.hidden) for (const p of active) p.draw(dt, now / 1000);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ───────────────────────── Miniaturas estáticas ─────────────────────────

const thumbCache = new Map<string, HTMLCanvasElement>();
const TS = 192;

/** Miniatura de um item de aparência/equipamento, desenhada sobre o lutador do jogador. */
export function itemThumb(id: string): HTMLElement {
  const d = item(id);
  const visual = ['hair', 'hairColor', 'outfit', 'gloves', 'mask', 'aura'].includes(d.kind);
  if (!visual) {
    const span = document.createElement('div');
    span.className = 'thumb-icon';
    span.textContent = d.icon;
    return span;
  }
  const key = `${id}|${S.appearance.skin}|${S.appearance.hair}|${S.appearance.hairColor}|${S.appearance.eyes}|${S.appearance.beard}`;
  let src = thumbCache.get(key);
  if (!src) {
    src = renderThumb(id);
    thumbCache.set(key, src);
  }
  const c = document.createElement('canvas');
  c.width = TS;
  c.height = TS;
  c.className = 'thumb';
  c.getContext('2d')!.drawImage(src, 0, 0);
  return c;
}

function renderThumb(id: string): HTMLCanvasElement {
  const d = item(id);
  const app = { ...S.appearance };
  const lo = { outfit: 'o_classico', gloves: 'g_vermelhas', mask: null as string | null, aura: null as string | null };
  if (d.kind === 'hair') app.hair = id;
  if (d.kind === 'hairColor') app.hairColor = id;
  if (d.kind === 'outfit') lo.outfit = id;
  if (d.kind === 'gloves') lo.gloves = id;
  if (d.kind === 'mask') lo.mask = id;
  if (d.kind === 'aura') lo.aura = id;
  const look = resolveLook(app, lo);
  const c = document.createElement('canvas');
  c.width = TS;
  c.height = TS;
  const ctx = c.getContext('2d')!;
  const pose = newPose();
  sample(ANIMS.guard, 0, pose);
  const sk = solve(pose, new Skel());
  const head = d.kind === 'hair' || d.kind === 'hairColor' || d.kind === 'mask';
  const glove = d.kind === 'gloves';
  let scale: number;
  let hx: number;
  let hy: number;
  if (head) {
    scale = TS / 95;
    hx = TS / 2 - sk.x[2] * scale - 4;
    hy = TS * 0.6 - sk.y[2] * scale;
  } else if (glove) {
    scale = TS / 80;
    hx = TS / 2 - sk.x[5] * scale;
    hy = TS * 0.5 - sk.y[5] * scale;
  } else {
    scale = TS / 250;
    hx = TS / 2;
    hy = TS * 0.95 - sk.minY * scale;
  }
  const rc = RARITIES[d.rarity];
  ctx.globalAlpha = 0.5;
  ctx.drawImage(glowSprite(rc.color.length === 7 ? rc.color : '#ffffff'), 0, 0, TS, TS);
  ctx.globalAlpha = 1;
  ctx.translate(hx, hy);
  ctx.scale(scale, scale);
  drawFighter(ctx, look, sk, { t: 1.3, expr: 'normal', flash: false, glow: null });
  return c;
}

export function clearThumbs(): void {
  thumbCache.clear();
}
