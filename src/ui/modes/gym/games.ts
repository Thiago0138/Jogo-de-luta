import { sfx } from '../../../audio/sfx';
import { Cam } from '../../../render/paint';
import { J_FH, J_BH, type Pose } from '../../../render/pose';
import type { AnimName } from '../../../fight/anims';
import type { StationId } from '../../../core/gymStore';
import { FX, Rig, drawBarbell, drawHeavyBag, drawPad, drawSpeedBag, gymBackdrop, outlined, rr, shadow } from './kit';

export type Verdict = 'perfect' | 'good' | 'miss';

const VCOL: Record<Verdict, string> = { perfect: '#ffd23d', good: '#5ef0c0', miss: '#ff5a7a' };
const VTXT: Record<Verdict, string> = { perfect: 'PERFECT!', good: 'GOOD', miss: 'MISS' };

/** Base comum dos mini-jogos (pontuação, combo, efeitos, lutador). */
export abstract class MiniGame {
  abstract readonly id: StationId;
  W = 800;
  H = 380;
  dpr = 1;
  floorY = 300;
  sc = 1;
  /** Tempo de jogo desde o "GO". */
  t = 0;
  /** Aceita toques (falso na contagem e no fim). */
  live = false;
  dur = 25;
  fx = new FX();
  rig = new Rig();
  score = 0;
  combo = 0;
  maxCombo = 0;
  perfect = 0;
  good = 0;
  miss = 0;
  /** Momentos (tempo real) do último bónus de combo, para o HUD pulsar. */
  comboPulse = 0;

  resize(W: number, H: number, dpr: number): void {
    this.W = W;
    this.H = H;
    this.dpr = dpr;
    this.floorY = Math.round(H * 0.8);
    this.sc = Rig.scaleFor(H * 0.5);
    this.layout();
  }

  protected layout(): void {}

  /** Progresso 0..1 do tempo (para acelerar a dificuldade). */
  get prog(): number {
    return Math.min(1, this.t / this.dur);
  }

  /** Regista um resultado: pontos, combo, texto e sons. Devolve os pontos ganhos. */
  protected judge(v: Verdict, base: number, x: number, y: number, label?: string): number {
    let pts = 0;
    if (v === 'miss') {
      if (this.combo >= 5) this.fx.pop('COMBO LOST', x, y - 34, '#ff9fb4', 18);
      this.combo = 0;
      this.miss++;
    } else {
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      if (v === 'perfect') this.perfect++;
      else this.good++;
      const mult = 1 + Math.min(this.combo, 30) * (v === 'perfect' ? 0.05 : 0.025);
      pts = Math.round(base * mult);
      this.score += pts;
      if (this.combo > 0 && this.combo % 10 === 0) {
        this.comboPulse = 1;
        this.fx.pop(`${this.combo} COMBO!`, this.W / 2, this.H * 0.3, '#ff7ae0', 34);
        sfx.reveal(Math.min(4, this.combo / 10));
      }
    }
    this.fx.pop(label ?? VTXT[v], x, y, VCOL[v], v === 'perfect' ? 30 : 24);
    return pts;
  }

  abstract update(dt: number, now: number): void;
  abstract draw(ctx: CanvasRenderingContext2D, now: number): void;
  down(_x: number, _y: number): void {}
  up(_x: number, _y: number): void {}
  /** Texto curto de ajuda mostrado na contagem. */
  abstract readonly hint: string;

  protected backdrop(ctx: CanvasRenderingContext2D): void {
    ctx.drawImage(gymBackdrop(this.W, this.H, this.floorY, this.dpr), 0, 0, this.W, this.H);
  }
}

const PUNCH_HIT: Partial<Record<AnimName, number>> = { jab: 0.15, cross: 0.19, hook: 0.24, upper: 0.28 };

interface Pending {
  at: number;
  fn: () => void;
}

// ───────────────────────── 1. Saco pesado ─────────────────────────

export class HeavyBagGame extends MiniGame {
  readonly id = 'bag' as const;
  readonly hint = 'Tap when the marker is in the GOLD zone!';
  private fx0 = 0;
  private bagX = 0;
  private ang = 0;
  private angV = 0;
  private squash = 0;
  private hitGlow = 0;
  private phase = Math.random();
  private zc = 0.5;
  private lock = 0;
  private seq = 0;
  private pend: Pending[] = [];

  protected layout(): void {
    this.fx0 = this.W * 0.4;
    this.bagX = this.fx0 + 80 * this.sc;
  }

  private speed(): number {
    return 0.55 + this.prog * 0.45 + Math.min(this.combo, 20) * 0.012;
  }
  private zoneW(): [number, number] {
    const k = Math.min(1, this.combo / 20);
    return [0.045 - k * 0.015, 0.12 - k * 0.04];
  }
  private marker(): number {
    const p = this.phase % 2;
    return p < 1 ? p : 2 - p;
  }

  update(dt: number, now: number): void {
    this.phase += dt * this.speed();
    // pêndulo
    const k = 14;
    this.angV += (-k * this.ang - this.angV * 1.6) * dt;
    this.ang += this.angV * dt;
    this.squash = Math.max(0, this.squash - dt * 5);
    this.hitGlow = Math.max(0, this.hitGlow - dt * 4);
    this.lock -= dt;
    for (const p of this.pend) if ((p.at -= dt) <= 0) p.fn();
    this.pend = this.pend.filter((p) => p.at > 0);
    this.rig.update(dt, now);
    this.fx.update(dt);
  }

  down(): void {
    if (!this.live || this.lock > 0) return;
    const m = this.marker();
    const d = Math.abs(m - this.zc);
    const [pw, gw] = this.zoneW();
    const v: Verdict = d <= pw ? 'perfect' : d <= gw ? 'good' : 'miss';
    const hy = this.floorY - 140 * this.sc;
    if (v === 'miss') {
      this.lock = 0.35;
      this.rig.play('jab', 0.04);
      sfx.whoosh();
      this.judge('miss', 0, this.bagX, hy - 40);
      this.rig.face('hurt', 0.4);
      return;
    }
    this.lock = 0.16;
    const moves: AnimName[] = v === 'perfect' ? ['cross', 'hook', 'upper', 'cross'] : ['jab', 'jab'];
    const a = moves[this.seq++ % moves.length];
    const hit = PUNCH_HIT[a] ?? 0.15;
    const lead = 0.06;
    this.rig.play(a, hit - lead);
    if (v === 'perfect') this.rig.face('angry', 0.5);
    this.pend.push({
      at: lead,
      fn: () => {
        const p = v === 'perfect';
        this.angV += p ? 1.25 : 0.7;
        this.squash = 1;
        this.hitGlow = p ? 1 : 0.5;
        sfx.punch(p ? 1 : 0.6, true);
        const bx = this.bagX - 26 * this.sc + this.ang * 120 * this.sc;
        this.fx.kick(p ? 9 : 4, p ? 0.6 : 0, '#fff');
        this.fx.burst(bx, hy, p ? 14 : 7, p ? '#ffd23d' : '#ffffff', p ? 320 : 200, 'spark', 0, 3);
        this.fx.spray(bx, hy, p ? 8 : 4, Math.PI + 0.4, 'rgba(180,220,255,0.9)', 240);
        if (p) this.fx.ring(bx, hy, '#ffd23d', 26);
      },
    });
    this.judge(v, v === 'perfect' ? 100 : 50, this.bagX, hy - 50);
    // nova zona
    let z = this.zc;
    while (Math.abs(z - this.zc) < 0.22) z = 0.15 + Math.random() * 0.7;
    this.zc = z;
  }

  draw(ctx: CanvasRenderingContext2D, now: number): void {
    const { W, H, floorY, sc } = this;
    this.backdrop(ctx);
    ctx.save();
    ctx.translate(this.fx.sx, this.fx.sy);
    // viga
    ctx.fillStyle = '#2a1a40';
    ctx.fillRect(this.bagX - 90 * sc, 0, 180 * sc, H * 0.035);
    shadow(ctx, this.bagX + this.ang * 150 * sc, floorY + 4, 34 * sc);
    shadow(ctx, this.fx0, floorY + 4, 46 * sc);
    this.rig.draw(ctx, this.fx0, floorY, sc, 1, now);
    const bagTop = floorY - 205 * sc;
    drawHeavyBag(ctx, this.bagX, H * 0.03, bagTop - H * 0.03, 56 * sc, 175 * sc, this.ang * 0.9, this.squash, this.hitGlow);
    this.fx.draw(ctx);
    ctx.restore();
    // medidor
    const mw = Math.min(460, W * 0.56);
    const mx = W / 2 - mw / 2;
    const my = H - 34;
    const mh = 22;
    ctx.fillStyle = 'rgba(10,6,20,0.85)';
    rr(ctx, mx - 6, my - 6, mw + 12, mh + 12, 12);
    ctx.fill();
    ctx.fillStyle = '#2e2346';
    rr(ctx, mx, my, mw, mh, 8);
    ctx.fill();
    const [pw, gw] = this.zoneW();
    ctx.fillStyle = '#2fbf8f';
    ctx.fillRect(mx + (this.zc - gw) * mw, my, gw * 2 * mw, mh);
    ctx.fillStyle = '#ffd23d';
    ctx.fillRect(mx + (this.zc - pw) * mw, my, pw * 2 * mw, mh);
    const m = this.marker();
    const px = mx + m * mw;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#140a1c';
    ctx.lineWidth = 3;
    rr(ctx, px - 5, my - 8, 10, mh + 16, 4);
    ctx.fill();
    ctx.stroke();
    this.fx.drawFlash(ctx, W, H);
  }
}

// ───────────────────────── 2. Saco rápido ─────────────────────────

interface Beat {
  at: number;
  done: boolean;
}

export class SpeedBagGame extends MiniGame {
  readonly id = 'speed' as const;
  readonly hint = 'Tap when the ring closes on the bag!';
  private fx0 = 0;
  private bx = 0;
  private by = 0;
  private br = 14;
  private ang = 0;
  private angV = 0;
  private glow = 0;
  private beats: Beat[] = [];
  private nextAt = 1.0;
  private alt = 0;
  private readonly lead = 1.0;

  protected layout(): void {
    this.fx0 = this.W * 0.4;
    this.br = 15 * this.sc;
    this.bx = this.fx0 + 86 * this.sc;
    this.by = this.floorY - 175 * this.sc - this.br * 0.3;
  }

  private interval(): number {
    return Math.max(0.36, 0.7 - this.prog * 0.2 - Math.min(this.combo, 25) * 0.006);
  }

  update(dt: number, now: number): void {
    if (this.live) {
      // agenda as batidas com antecedência para os anéis aparecerem a tempo
      while (this.nextAt < this.t + this.lead && this.nextAt < this.dur) {
        this.beats.push({ at: this.nextAt, done: false });
        const iv = this.interval();
        this.nextAt += this.prog > 0.4 && Math.random() < 0.18 ? iv * 0.5 : iv;
      }
      for (const b of this.beats) {
        if (!b.done && this.t - b.at > 0.16) {
          b.done = true;
          this.judge('miss', 0, this.bx + 90 * this.sc, this.by + 10);
        }
      }
      this.beats = this.beats.filter((b) => !b.done || this.t - b.at < 0.3);
    }
    this.angV += (-260 * this.ang - this.angV * 7) * dt;
    this.ang += this.angV * dt;
    this.glow = Math.max(0, this.glow - dt * 5);
    this.rig.update(dt, now);
    this.fx.update(dt);
  }

  /** Força o "t" a começar antes da primeira batida (chamado pelo motor no GO). */
  down(): void {
    if (!this.live) return;
    let best: Beat | null = null;
    for (const b of this.beats) if (!b.done && (!best || Math.abs(b.at - this.t) < Math.abs(best.at - this.t))) best = b;
    const d = best ? Math.abs(best.at - this.t) : 9;
    if (!best || d > 0.24) {
      this.rig.play('jab', 0.1);
      this.judge('miss', 0, this.bx + 90 * this.sc, this.by + 10, 'EARLY');
      return;
    }
    best.done = true;
    const v: Verdict = d <= 0.065 ? 'perfect' : d <= 0.16 ? 'good' : 'miss';
    const a: AnimName = this.alt++ % 2 ? 'cross' : 'jab';
    this.rig.play(a, (PUNCH_HIT[a] ?? 0.15) - 0.02);
    if (v !== 'miss') {
      this.angV += (v === 'perfect' ? 26 : 16) * (Math.random() < 0.5 ? 1 : -1);
      this.glow = v === 'perfect' ? 1 : 0.5;
      sfx.punch(v === 'perfect' ? 0.5 : 0.35, false);
      setTimeout(() => sfx.block(), 70);
      const hy = this.by + this.br * 1.3;
      this.fx.burst(this.bx, hy, v === 'perfect' ? 10 : 5, v === 'perfect' ? '#ffd23d' : '#fff', 240, 'spark', 0, 2.5);
      if (v === 'perfect') {
        this.fx.ring(this.bx, hy, '#ffd23d', this.br * 1.3);
        this.fx.kick(3);
      }
    }
    this.judge(v, v === 'perfect' ? 100 : v === 'good' ? 50 : 0, this.bx + 90 * this.sc, this.by + 10);
  }

  draw(ctx: CanvasRenderingContext2D, now: number): void {
    const { W, H, floorY, sc } = this;
    this.backdrop(ctx);
    ctx.save();
    ctx.translate(this.fx.sx, this.fx.sy);
    shadow(ctx, this.fx0, floorY + 4, 46 * sc);
    this.rig.draw(ctx, this.fx0, floorY, sc, 1, now);
    drawSpeedBag(ctx, this.bx, this.by, this.br, this.ang, this.glow, 1);
    // anéis a fechar
    const cy = this.by + this.br * 1.3;
    for (const b of this.beats) {
      if (b.done) continue;
      const u = (b.at - this.t) / this.lead;
      if (u > 1 || u < -0.2) continue;
      const r = this.br * 1.2 + Math.max(0, u) * 110 * sc;
      const near = Math.abs(b.at - this.t) < 0.065;
      ctx.globalAlpha = Math.min(1, (1 - u) * 2.5);
      ctx.strokeStyle = near ? '#ffd23d' : '#c9b8ff';
      ctx.lineWidth = near ? 6 : 4;
      ctx.beginPath();
      ctx.arc(this.bx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // alvo
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.bx, cy, this.br * 1.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    this.fx.draw(ctx);
    ctx.restore();
    // pista de ritmo (barra de batidas)
    const mw = Math.min(420, W * 0.5);
    const mx = W / 2 - mw / 2;
    const my = H - 30;
    ctx.fillStyle = 'rgba(10,6,20,0.85)';
    rr(ctx, mx - 6, my - 12, mw + 12, 24, 12);
    ctx.fill();
    const hitX = mx + 26;
    ctx.fillStyle = '#ffd23d';
    ctx.beginPath();
    ctx.arc(hitX, my, 9, 0, Math.PI * 2);
    ctx.fill();
    for (const b of this.beats) {
      if (b.done) continue;
      const x = hitX + (b.at - this.t) * (mw - 40);
      if (x > mx + mw) continue;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x, my, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    this.fx.drawFlash(ctx, W, H);
  }
}

// ───────────────────────── 3. Prensa (levantamento) ─────────────────────────

const cam = new Cam();
const YAW = 1.3;

export class PressGame extends MiniGame {
  readonly id = 'press' as const;
  readonly hint = 'HOLD to power up · RELEASE in the green zone!';
  private fx0 = 0;
  private holding = false;
  private v = 0;
  /** Elevação da barra 0 (peito) .. 1 (braços esticados). */
  private lift = 0;
  private liftT = -1;
  private fail = 0;
  private zc = 0.65;
  private zw = 0.11;
  private reps = 0;
  private lock = 0;
  private trem = 0;

  constructor() {
    super();
    this.rig.idle = 'guard';
    this.rig.post = (p: Pose, t: number) => this.pose(p, t);
  }

  protected layout(): void {
    this.fx0 = this.W * 0.42;
  }

  private pose(p: Pose, t: number): void {
    const l = this.lift;
    const shake = this.trem * Math.sin(t * 70) * 0.05;
    // braços: do peito (rack) até cima da cabeça
    p.fa1 = 0.5 + l * 2.35 + shake;
    p.fa2 = 1.9 - l * 1.75;
    p.ba1 = p.fa1;
    p.ba2 = p.fa2;
    p.lean = 0.02 - l * 0.08;
    p.head = -0.1 - this.v * 0.15;
    const squat = this.holding ? this.v * 6 : 0;
    p.dy = squat + Math.sin(t * 4) * 0.8;
    p.fl1 = 0.3 + squat * 0.02;
    p.fl2 = -0.2 - squat * 0.04;
    p.bl1 = -0.3 - squat * 0.02;
    p.bl2 = -0.15 - squat * 0.04;
    p.rot = 0;
    p.dx = 0;
  }

  private rate(): number {
    return 0.45 + Math.min(this.reps, 18) * 0.035 + this.prog * 0.2;
  }

  update(dt: number, now: number): void {
    this.lock -= dt;
    if (this.holding && this.live && this.lock <= 0) {
      this.v += this.rate() * (0.55 + this.v) * dt;
      this.trem = Math.max(0, this.v - 0.4) * 2;
      if (this.v >= 1) this.failRep('TOO HEAVY!');
    } else if (!this.holding) {
      this.v = Math.max(0, this.v - dt * 2.5);
      this.trem = Math.max(0, this.trem - dt * 3);
    }
    // animação de uma repetição
    if (this.liftT >= 0) {
      this.liftT += dt;
      const T = this.liftT;
      this.lift = T < 0.22 ? 1 - Math.pow(1 - T / 0.22, 3) : T < 0.5 ? 1 : T < 0.75 ? 1 - (T - 0.5) / 0.25 : 0;
      if (T >= 0.75) this.liftT = -1;
    } else if (this.fail > 0) {
      this.fail -= dt;
      this.lift = -Math.sin(Math.max(0, this.fail) * 18) * 0.04 * this.fail;
    } else this.lift = this.holding ? this.v * 0.12 : 0;
    this.rig.update(dt, now);
    this.fx.update(dt);
  }

  private failRep(msg: string): void {
    this.holding = false;
    this.v = 0;
    this.trem = 0;
    this.fail = 0.5;
    this.lock = 0.45;
    sfx.slam(0.5);
    this.fx.kick(7, 0.4, '#ff3d6e');
    this.rig.face('hurt', 0.6);
    this.judge('miss', 0, this.fx0, this.floorY - 260 * this.sc, msg);
  }

  down(): void {
    if (!this.live || this.lock > 0 || this.liftT >= 0) return;
    this.holding = true;
    this.v = 0;
    this.rig.face('angry', 30);
    sfx.charge();
  }

  up(): void {
    if (!this.holding) return;
    this.holding = false;
    if (!this.live) return;
    const d = Math.abs(this.v - this.zc);
    if (d > this.zw) {
      this.failRep(this.v < this.zc ? 'TOO WEAK!' : 'TOO MUCH!');
      return;
    }
    const v: Verdict = d <= this.zw * 0.35 ? 'perfect' : 'good';
    this.reps++;
    this.liftT = 0;
    this.lock = 0.6;
    this.trem = 0;
    this.rig.face(v === 'perfect' ? 'power' : 'happy', 0.8);
    sfx.whoosh();
    setTimeout(() => sfx.stamp(), 120);
    const y = this.floorY - 250 * this.sc;
    this.fx.kick(v === 'perfect' ? 6 : 3);
    this.fx.burst(this.fx0, y, v === 'perfect' ? 16 : 8, v === 'perfect' ? '#ffd23d' : '#5ef0c0', 260, 'star', 400, 4);
    this.fx.spray(this.fx0, this.floorY - 200 * this.sc, 6, -Math.PI / 2, 'rgba(180,220,255,0.9)', 220);
    this.judge(v, v === 'perfect' ? 180 : 100, this.fx0, y - 20, v === 'perfect' ? 'PERFECT REP!' : 'GOOD REP');
    // próxima zona: mais alta e estreita
    const k = Math.min(1, this.reps / 14);
    this.zw = 0.11 - k * 0.045;
    this.zc = 0.45 + Math.random() * (0.38 + k * 0.08);
    this.v = 0;
  }

  draw(ctx: CanvasRenderingContext2D, now: number): void {
    const { W, H, floorY, sc } = this;
    this.backdrop(ctx);
    ctx.save();
    ctx.translate(this.fx.sx, this.fx.sy);
    // estrado
    ctx.fillStyle = '#3a2a24';
    ctx.strokeStyle = '#140a1c';
    ctx.lineWidth = 3;
    rr(ctx, this.fx0 - 120 * sc, floorY - 4, 240 * sc, 14, 4);
    ctx.fill();
    ctx.stroke();
    shadow(ctx, this.fx0, floorY + 2, 60 * sc);
    this.rig.draw(ctx, this.fx0, floorY, sc, 1, now, YAW);
    // barra nas mãos (vista 3D: projetar as mãos)
    const r = this.rig;
    const k = r.look.height * sc;
    cam.set(YAW, 0.1);
    const hf = cam.w(r.skel.x[J_FH], r.skel.y[J_FH], 12);
    const hb = cam.w(r.skel.x[J_BH], r.skel.y[J_BH], -12);
    const ox = this.fx0;
    const oy = floorY - r.baseMinY * k;
    const x1 = ox + hf[0] * k, y1 = oy + hf[1] * k;
    const x2 = ox + hb[0] * k, y2 = oy + hb[1] * k;
    const cx = (x1 + x2) / 2;
    const cyy = (y1 + y2) / 2;
    drawBarbell(ctx, cx, cyy, 210 * sc, 22 * sc, Math.atan2(y2 - y1, x2 - x1) * 0.3 + this.trem * Math.sin(now * 60) * 0.02);
    this.fx.draw(ctx);
    ctx.restore();
    // medidor vertical
    const gh = H * 0.56;
    const gw = 30;
    const gx = Math.min(W - 70, this.fx0 + 190 * sc);
    const gy = H * 0.2;
    ctx.fillStyle = 'rgba(10,6,20,0.85)';
    rr(ctx, gx - 8, gy - 8, gw + 16, gh + 16, 14);
    ctx.fill();
    ctx.fillStyle = '#2e2346';
    rr(ctx, gx, gy, gw, gh, 9);
    ctx.fill();
    const Y = (v: number) => gy + gh * (1 - v);
    ctx.fillStyle = '#2fbf8f';
    ctx.fillRect(gx, Y(this.zc + this.zw), gw, this.zw * 2 * gh);
    ctx.fillStyle = '#ffd23d';
    ctx.fillRect(gx, Y(this.zc + this.zw * 0.35), gw, this.zw * 0.7 * gh);
    ctx.fillStyle = 'rgba(255,61,110,0.55)';
    ctx.fillRect(gx, gy, gw, gh * 0.04);
    // enchimento
    const fill = this.v;
    const g = ctx.createLinearGradient(0, gy + gh, 0, gy);
    g.addColorStop(0, '#4aa8ff');
    g.addColorStop(0.6, '#c77dff');
    g.addColorStop(1, '#ff3d6e');
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = g;
    rr(ctx, gx + 4, Y(fill), gw - 8, gh * fill, 6);
    ctx.fill();
    ctx.globalAlpha = 1;
    // agulha
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#140a1c';
    ctx.lineWidth = 3;
    rr(ctx, gx - 8, Y(fill) - 4, gw + 16, 8, 3);
    ctx.fill();
    ctx.stroke();
    outlined(ctx, `${this.reps}`, gx + gw / 2, gy + gh + 30, 26, '#fff');
    outlined(ctx, 'REPS', gx + gw / 2, gy + gh + 52, 13, '#a99fc4');
    if (this.live && !this.holding && this.liftT < 0 && this.lock <= 0) {
      const a = 0.5 + Math.sin(now * 6) * 0.3;
      ctx.globalAlpha = a;
      outlined(ctx, 'HOLD', this.fx0, H - 26, 22, '#fff');
      ctx.globalAlpha = 1;
    }
    this.fx.drawFlash(ctx, W, H);
  }
}

// ───────────────────────── 4. Reflexos ─────────────────────────

interface PadObj {
  side: -1 | 1;
  /** Distância (px) ao centro do lutador. */
  d: number;
  speed: number;
  y: number;
  done: boolean;
  spin: number;
  color: string;
}

export class ReflexGame extends MiniGame {
  readonly id = 'reflex' as const;
  readonly hint = 'Tap the SIDE a pad comes from when it hits the ring!';
  private fx0 = 0;
  private R = 80;
  private pads: PadObj[] = [];
  private nextAt = 0.6;
  private facing: 1 | -1 = 1;
  private tapFlash: [number, number] = [0, 0];

  protected layout(): void {
    this.fx0 = this.W / 2;
    this.R = 88 * this.sc;
  }

  private headY(): number {
    return this.floorY - 150 * this.sc;
  }

  update(dt: number, now: number): void {
    if (this.live) {
      if (this.t >= this.nextAt && this.t < this.dur - 0.6) {
        const both = this.prog > 0.45 && Math.random() < 0.2;
        const side: -1 | 1 = Math.random() < 0.5 ? -1 : 1;
        this.spawn(side);
        if (both) this.spawn(-side as -1 | 1, 0.15);
        this.nextAt = this.t + Math.max(0.42, 1.05 - this.prog * 0.5 - Math.min(this.combo, 20) * 0.008) * (0.8 + Math.random() * 0.45);
      }
      for (const p of this.pads) {
        if (p.done) continue;
        p.d -= p.speed * dt;
        p.spin += dt * 6;
        if (p.d < 26 * this.sc) {
          p.done = true;
          this.facing = p.side;
          this.rig.play('hitHi');
          this.rig.face('hurt', 0.5);
          this.rig.flash = 0.12;
          sfx.punch(0.45, false);
          this.fx.kick(8, 0.5, '#ff3d6e');
          this.fx.burst(this.fx0 + p.side * 20 * this.sc, p.y, 8, '#ff5a7a', 200, 'dot', 300, 4);
          this.judge('miss', 0, this.fx0, p.y - 70, 'OUCH!');
        }
      }
      this.pads = this.pads.filter((p) => !p.done);
    }
    this.tapFlash[0] = Math.max(0, this.tapFlash[0] - dt * 4);
    this.tapFlash[1] = Math.max(0, this.tapFlash[1] - dt * 4);
    this.rig.update(dt, now);
    this.fx.update(dt);
  }

  private spawn(side: -1 | 1, delay = 0): void {
    const speed = (this.W * 0.42) * (0.75 + this.prog * 0.55) * (0.9 + Math.random() * 0.2);
    const hy = this.headY();
    this.pads.push({
      side,
      d: this.W / 2 + 40 + delay * speed,
      speed,
      y: hy + (Math.random() < 0.5 ? -10 : 30) * this.sc,
      done: false,
      spin: 0,
      color: side < 0 ? '#3aa0ff' : '#ff3d6e',
    });
  }

  down(x: number): void {
    if (!this.live) return;
    const side: -1 | 1 = x < this.W / 2 ? -1 : 1;
    this.tapFlash[side < 0 ? 0 : 1] = 1;
    this.facing = side;
    let best: PadObj | null = null;
    for (const p of this.pads) if (!p.done && p.side === side && (!best || p.d < best.d)) best = p;
    const a: AnimName = Math.random() < 0.5 ? 'jab' : 'cross';
    this.rig.play(a, (PUNCH_HIT[a] ?? 0.15) - 0.03);
    const tt = best ? (best.d - this.R) / best.speed : 9;
    if (!best || tt > 0.2) {
      sfx.whoosh();
      this.judge('miss', 0, this.fx0 + side * this.R, this.headY() - 60, 'EARLY');
      return;
    }
    best.done = true;
    const v: Verdict = Math.abs(tt) <= 0.07 ? 'perfect' : 'good';
    const px = this.fx0 + side * best.d;
    sfx.punch(v === 'perfect' ? 0.9 : 0.6, false);
    this.fx.burst(px, best.y, v === 'perfect' ? 16 : 9, best.color, 300, 'spark', 0, 3);
    this.fx.burst(px, best.y, 6, '#fff', 160, 'dot', 300, 4);
    if (v === 'perfect') {
      this.fx.ring(px, best.y, '#ffd23d', 26);
      this.fx.kick(5);
    }
    this.rig.face(v === 'perfect' ? 'happy' : 'normal', 0.4);
    this.judge(v, v === 'perfect' ? 100 : 55, px, best.y - 46);
  }

  draw(ctx: CanvasRenderingContext2D, now: number): void {
    const { W, H, floorY, sc } = this;
    this.backdrop(ctx);
    // zonas de toque
    for (const s of [-1, 1] as const) {
      const f = this.tapFlash[s < 0 ? 0 : 1];
      const x0 = s < 0 ? 0 : W / 2;
      const g = ctx.createLinearGradient(s < 0 ? 0 : W, 0, W / 2, 0);
      g.addColorStop(0, `rgba(${s < 0 ? '58,160,255' : '255,61,110'},${0.1 + f * 0.25})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x0, 0, W / 2, H);
      ctx.globalAlpha = 0.55 + f * 0.45;
      outlined(ctx, s < 0 ? '◀ TAP' : 'TAP ▶', s < 0 ? 64 : W - 64, H - 30, 22, s < 0 ? '#8ccfff' : '#ff8aa8');
      ctx.globalAlpha = 1;
    }
    ctx.save();
    ctx.translate(this.fx.sx, this.fx.sy);
    shadow(ctx, this.fx0, floorY + 4, 46 * sc);
    this.rig.draw(ctx, this.fx0, floorY, sc, this.facing, now);
    // anel de alcance
    const hy = this.headY() + 10 * sc;
    for (const s of [-1, 1]) {
      const near = this.pads.some((p) => !p.done && p.side === s && Math.abs((p.d - this.R) / p.speed) < 0.07);
      ctx.strokeStyle = near ? '#ffd23d' : 'rgba(255,255,255,0.45)';
      ctx.lineWidth = near ? 6 : 3;
      ctx.beginPath();
      if (s > 0) ctx.arc(this.fx0, hy, this.R, -0.55, 0.55);
      else ctx.arc(this.fx0, hy, this.R, Math.PI - 0.55, Math.PI + 0.55);
      ctx.stroke();
    }
    for (const p of this.pads) {
      const x = this.fx0 + p.side * p.d;
      // rasto
      ctx.globalAlpha = 0.2;
      drawPad(ctx, x + p.side * 18, p.y, 15 * sc, p.color, p.spin);
      ctx.globalAlpha = 1;
      drawPad(ctx, x, p.y, 17 * sc, p.color, p.spin);
    }
    this.fx.draw(ctx);
    ctx.restore();
    this.fx.drawFlash(ctx, W, H);
  }
}

export function makeGame(id: StationId): MiniGame {
  switch (id) {
    case 'bag':
      return new HeavyBagGame();
    case 'speed':
      return new SpeedBagGame();
    case 'press':
      return new PressGame();
    case 'reflex':
      return new ReflexGame();
  }
}
