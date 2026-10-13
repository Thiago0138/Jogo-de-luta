import { glowSprite } from '../render/fighter';

/** Tipos de partícula. */
export const PK = {
  Spark: 0,
  Dust: 1,
  Sweat: 2,
  Star: 3,
  Confetti: 4,
  Ember: 5,
  Shard: 6,
  Ring: 7,
  Smoke: 8,
} as const;
export type PK = (typeof PK)[keyof typeof PK];

const MAX = 700;

/** Pool de partículas em arrays planos (sem alocações por frame). */
export class Particles {
  n = 0;
  kind = new Uint8Array(MAX);
  x = new Float32Array(MAX);
  y = new Float32Array(MAX);
  vx = new Float32Array(MAX);
  vy = new Float32Array(MAX);
  life = new Float32Array(MAX);
  max = new Float32Array(MAX);
  size = new Float32Array(MAX);
  rot = new Float32Array(MAX);
  grav = new Float32Array(MAX);
  color: string[] = new Array(MAX).fill('#fff');

  spawn(k: PK, x: number, y: number, vx: number, vy: number, life: number, size: number, color: string, grav = 0): void {
    if (this.n >= MAX) return;
    const i = this.n++;
    this.kind[i] = k;
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.life[i] = life;
    this.max[i] = life;
    this.size[i] = size;
    this.rot[i] = Math.random() * 6.28;
    this.grav[i] = grav;
    this.color[i] = color;
  }

  update(dt: number): void {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const j = --this.n;
        this.kind[i] = this.kind[j];
        this.x[i] = this.x[j];
        this.y[i] = this.y[j];
        this.vx[i] = this.vx[j];
        this.vy[i] = this.vy[j];
        this.life[i] = this.life[j];
        this.max[i] = this.max[j];
        this.size[i] = this.size[j];
        this.rot[i] = this.rot[j];
        this.grav[i] = this.grav[j];
        this.color[i] = this.color[j];
        continue;
      }
      this.vy[i] += this.grav[i] * dt;
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      const k = this.kind[i];
      if (k === PK.Confetti) {
        this.vx[i] *= 0.985;
        this.vy[i] = Math.min(this.vy[i], 120);
        this.rot[i] += dt * 8;
      } else if (k === PK.Dust || k === PK.Smoke) {
        this.vx[i] *= 0.95;
        this.vy[i] *= 0.95;
      } else if (k === PK.Shard) this.rot[i] += dt * 10;
      // chão
      if (this.y[i] > 0 && this.grav[i] > 0 && k !== PK.Confetti) {
        this.y[i] = 0;
        this.vy[i] *= -0.35;
        this.vx[i] *= 0.6;
      }
      i++;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const prev = ctx.globalCompositeOperation;
    for (let i = 0; i < this.n; i++) {
      const k = this.kind[i];
      const a = this.life[i] / this.max[i];
      const x = this.x[i];
      const y = this.y[i];
      const s = this.size[i];
      switch (k) {
        case PK.Spark: {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = a;
          ctx.strokeStyle = this.color[i];
          ctx.lineWidth = s * a + 0.5;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - this.vx[i] * 0.03, y - this.vy[i] * 0.03);
          ctx.stroke();
          break;
        }
        case PK.Ember: {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = a;
          const r = s * (0.4 + a * 0.6);
          ctx.drawImage(glowSprite(this.color[i]), x - r, y - r, r * 2, r * 2);
          break;
        }
        case PK.Dust:
        case PK.Smoke: {
          ctx.globalCompositeOperation = prev;
          ctx.globalAlpha = a * (k === PK.Smoke ? 0.5 : 0.35);
          ctx.fillStyle = this.color[i];
          ctx.beginPath();
          ctx.arc(x, y, s * (1.6 - a * 0.6), 0, 6.283);
          ctx.fill();
          break;
        }
        case PK.Sweat: {
          ctx.globalCompositeOperation = prev;
          ctx.globalAlpha = a;
          ctx.fillStyle = this.color[i];
          ctx.beginPath();
          ctx.arc(x, y, s, 0, 6.283);
          ctx.fill();
          break;
        }
        case PK.Star: {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = a;
          ctx.fillStyle = this.color[i];
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(this.rot[i] + (1 - a) * 4);
          ctx.beginPath();
          for (let j = 0; j < 8; j++) {
            const r = j % 2 ? s * 0.35 : s;
            const ang = (j * Math.PI) / 4;
            ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
          }
          ctx.fill();
          ctx.restore();
          break;
        }
        case PK.Confetti:
        case PK.Shard: {
          ctx.globalCompositeOperation = prev;
          ctx.globalAlpha = Math.min(1, a * 3);
          ctx.fillStyle = this.color[i];
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(this.rot[i]);
          ctx.scale(1, Math.cos(this.rot[i] * 1.7));
          ctx.fillRect(-s, -s * 0.5, s * 2, s);
          ctx.restore();
          break;
        }
        case PK.Ring: {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = a;
          ctx.strokeStyle = this.color[i];
          ctx.lineWidth = 6 * a + 1;
          const r = s * (1 - a) + 10;
          ctx.beginPath();
          ctx.ellipse(x, y, r, r * 0.3, 0, 0, 6.283);
          ctx.stroke();
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = prev;
  }
}

export interface PopText {
  text: string;
  x: number;
  y: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

/** Texto grande do locutor no centro do ecrã. */
export interface Banner {
  text: string;
  sub: string;
  life: number;
  max: number;
  color: string;
  size: number;
}

export interface Bolt {
  x: number;
  y0: number;
  y1: number;
  life: number;
  color: string;
  seed: number;
  width: number;
}

export interface Beam {
  x: number;
  w: number;
  life: number;
  max: number;
  color: string;
}

export interface Wave {
  x: number;
  y: number;
  r: number;
  vr: number;
  life: number;
  max: number;
  color: string;
}

/** Projétil visual (ex.: dragão de fogo, punho cósmico). */
export interface Proj {
  kind: 'dragon' | 'fist';
  x: number;
  y: number;
  vx: number;
  life: number;
  dir: number;
  color: string;
}

export function hash(i: number): number {
  const x = Math.sin(i * 91.7) * 43758.5453;
  return x - Math.floor(x);
}

export function drawBolt(ctx: CanvasRenderingContext2D, b: Bolt): void {
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  const steps = 10;
  const seed = b.seed + Math.floor(b.life * 30);
  for (let pass = 0; pass < 2; pass++) {
    ctx.beginPath();
    let x = b.x;
    ctx.moveTo(x, b.y0);
    for (let i = 1; i <= steps; i++) {
      x = b.x + (hash(seed + i) - 0.5) * 60 * (i < steps ? 1 : 0);
      ctx.lineTo(x, b.y0 + ((b.y1 - b.y0) * i) / steps);
    }
    ctx.globalAlpha = Math.min(1, b.life * 5);
    ctx.lineWidth = pass ? b.width * 0.35 : b.width;
    ctx.strokeStyle = pass ? '#ffffff' : b.color;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = prev;
}
