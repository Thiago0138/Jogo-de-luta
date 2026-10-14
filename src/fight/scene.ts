import { drawFighter, glowSprite } from '../render/fighter';
import { HEAD_R, J_HEAD } from '../render/pose';
import { setVolume, sfx, startCrowd, stopCrowd } from '../audio/sfx';
import { S, commit } from '../core/state';
import { APRON_X, BACK_Y, TEAM_COLORS, drawBackdrop, drawFloor, drawForeground, drawRingBack, drawRingFront, ensureArena } from './arena';
import { Fight, type FightReport, type FightSetup } from './engine';
import type { Fighter } from './fighter';
import { drawBolt, hash } from './fx';

export interface SceneOpts {
  speed: 1 | 2;
  quality: 'alta' | 'baixa';
  onEnd: (r: FightReport) => void;
  onSpeed?: (s: 1 | 2) => void;
}

const FONT = '"Luckiest Guy", Impact, sans-serif';

interface HudSide {
  root: HTMLElement;
  hp: HTMLElement;
  trail: HTMLElement;
  meter: HTMLElement;
  hpText: HTMLElement;
  name: HTMLElement;
  bench: HTMLElement | null;
  benchHp: HTMLElement | null;
  last: { hp: number; trail: number; meter: number; full: boolean; who: Fighter | null; bench: number };
}

export class FightScene {
  fight: Fight;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private root: HTMLElement;
  private raf = 0;
  private last = 0;
  private W = 0;
  private H = 0;
  private dpr = 1;
  private camX = 0;
  private zoom = 0.6;
  private speed: 1 | 2;
  private low: boolean;
  private hud: HudSide[] = [];
  private clockEl!: HTMLElement;
  private frames = 0;
  private slowFrames = 0;
  private destroyed = false;
  private opts: SceneOpts;
  private trails = [1, 1];
  private onResize = () => this.resize();
  private onVis = () => {
    if (!document.hidden) this.last = performance.now();
  };

  constructor(container: HTMLElement, setup: FightSetup, opts: SceneOpts) {
    this.opts = opts;
    this.speed = opts.speed;
    this.low = opts.quality === 'baixa';
    ensureArena();
    this.fight = new Fight(setup);
    this.fight.onEnd = (r) => {
      stopCrowd();
      setTimeout(() => !this.destroyed && opts.onEnd(r), 400);
    };
    this.root = document.createElement('div');
    this.root.className = 'fight-root';
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'fight-canvas';
    this.root.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d', { alpha: false })!;
    this.buildHud(setup.mode === 'tag');
    container.appendChild(this.root);
    this.resize();
    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVis);
    startCrowd();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVis);
    stopCrowd();
    this.root.remove();
  }

  private resize(): void {
    const r = this.root.getBoundingClientRect();
    this.W = Math.max(1, r.width);
    this.H = Math.max(1, r.height);
    this.dpr = this.low ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
  }

  // ───────────────────────── HUD (DOM) ─────────────────────────

  private buildHud(tag: boolean): void {
    const hud = document.createElement('div');
    hud.className = 'fight-hud';
    const mk = (team: 0 | 1) => {
      const f = this.fight.teams[team][0];
      const el = document.createElement('div');
      el.className = `hud-side t${team}`;
      el.innerHTML = `
        <div class="hud-name"><span class="hud-lvl">${f.spec.level}</span><b></b></div>
        <div class="hud-bar"><i class="trail"></i><i class="hp"></i><span class="hp-text"></span></div>
        <div class="hud-meter"><i></i><span>SUPER</span></div>
        ${tag ? '<div class="hud-bench"><span></span><div class="bench-bar"><i></i></div></div>' : ''}`;
      hud.appendChild(el);
      return {
        root: el,
        hp: el.querySelector('.hp') as HTMLElement,
        trail: el.querySelector('.trail') as HTMLElement,
        meter: el.querySelector('.hud-meter i') as HTMLElement,
        hpText: el.querySelector('.hp-text') as HTMLElement,
        name: el.querySelector('.hud-name b') as HTMLElement,
        bench: el.querySelector('.hud-bench span') as HTMLElement | null,
        benchHp: el.querySelector('.bench-bar i') as HTMLElement | null,
        last: { hp: -1, trail: -1, meter: -1, full: false, who: null, bench: -1 },
      };
    };
    this.hud.push(mk(0));
    this.clockEl = document.createElement('div');
    this.clockEl.className = 'hud-clock';
    hud.appendChild(this.clockEl);
    this.hud.push(mk(1));
    this.root.appendChild(hud);

    const ctr = document.createElement('div');
    ctr.className = 'fight-ctrl';
    ctr.innerHTML = `<label class="fight-vol" aria-label="Volume">🔊<input type="range" min="0" max="100" value="${Math.round(S.settings.volume * 100)}"/></label><button class="btn-ghost sp">${this.speed}x</button><button class="btn-ghost skip">Saltar ⏭</button>`;
    const vol = ctr.querySelector('.fight-vol input') as HTMLInputElement;
    vol.oninput = () => {
      S.settings.volume = Number(vol.value) / 100;
      setVolume(S.settings.volume);
    };
    vol.onchange = () => commit();
    const sp = ctr.querySelector('.sp') as HTMLButtonElement;
    sp.onclick = () => {
      this.speed = this.speed === 1 ? 2 : 1;
      sp.textContent = this.speed + 'x';
      this.opts.onSpeed?.(this.speed);
      sfx.click();
    };
    (ctr.querySelector('.skip') as HTMLButtonElement).onclick = () => {
      sfx.click();
      this.skip();
    };
    this.root.appendChild(ctr);
  }

  private updateHud(): void {
    const F = this.fight;
    for (let ti = 0; ti < 2; ti++) {
      const h = this.hud[ti];
      const f = F.active[ti];
      const L = h.last;
      if (L.who !== f) {
        L.who = f;
        h.name.textContent = f.spec.name;
        (h.root.querySelector('.hud-lvl') as HTMLElement).textContent = String(f.spec.level);
      }
      const hp = Math.max(0, f.hp / f.maxHp);
      const hpR = Math.round(hp * 500) / 500;
      if (hpR !== L.hp) {
        L.hp = hpR;
        h.hp.style.transform = `scaleX(${hpR})`;
        h.hp.classList.toggle('low', hp < 0.3);
        h.hpText.textContent = String(Math.ceil(Math.max(0, f.hp)));
      }
      // barra de dano atrasada
      const tr = this.trails[ti];
      this.trails[ti] = tr > hp ? Math.max(hp, tr - 0.008) : hp;
      const trR = Math.round(this.trails[ti] * 500) / 500;
      if (trR !== L.trail) {
        L.trail = trR;
        h.trail.style.transform = `scaleX(${trR})`;
      }
      const m = Math.round(f.meter) / 100;
      if (m !== L.meter) {
        L.meter = m;
        h.meter.style.transform = `scaleX(${m})`;
        const full = m >= 1;
        if (full !== L.full) {
          L.full = full;
          h.root.classList.toggle('full', full);
        }
      }
      if (h.bench && h.benchHp) {
        const other = F.teams[ti].find((p) => p !== f);
        const b = other ? (other.state === 'out' ? -2 : Math.round((other.hp / other.maxHp) * 100)) : -2;
        if (b !== L.bench && other) {
          L.bench = b;
          h.bench.textContent = (other.state === 'out' ? '✖ ' : '🤝 ') + other.spec.name;
          h.benchHp.style.transform = `scaleX(${Math.max(0, b) / 100})`;
          h.bench.parentElement!.classList.toggle('out', other.state === 'out');
        }
      }
    }
    const c = String(Math.max(0, Math.ceil(F.clock)));
    if (this.clockEl.textContent !== c) this.clockEl.textContent = c;
  }

  // ───────────────────────── Ciclo ─────────────────────────

  private loop = (now: number) => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.loop);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1;
    // adapta a qualidade se o dispositivo estiver a sofrer
    if (!this.low && this.frames < 240) {
      this.frames++;
      if (dt > 0.026) this.slowFrames++;
      if (this.frames === 240 && this.slowFrames > 90) {
        this.low = true;
        this.resize();
      }
    }
    const step = dt * this.speed;
    // sub-passos para estabilidade a 2x
    const n = step > 0.034 ? 2 : 1;
    for (let i = 0; i < n; i++) this.fight.update(step / n);
    this.render(dt);
    this.updateHud();
  };

  private skip(): void {
    const F = this.fight;
    let guard = 0;
    sfx.setMuted(true);
    while (!F.phaseEnded() && guard++ < 20000) F.update(1 / 30);
    sfx.setMuted(false);
  }

  // ───────────────────────── Render ─────────────────────────

  private camera(dt: number): void {
    const F = this.fight;
    const [a, b] = F.active;
    let tx: number;
    let desired: number;
    const portrait = this.H > this.W;
    if (F.focus) {
      tx = F.focus.x;
      desired = portrait ? 390 : 680;
    } else {
      tx = (a.x + b.x) / 2;
      const d = Math.abs(a.x - b.x);
      desired = portrait ? Math.min(900, Math.max(410, d + 260)) : Math.min(1300, Math.max(780, d + 520));
    }
    const zx = this.W / desired;
    const zy = this.H / (portrait ? 820 : 640);
    const z = Math.min(zx, zy) * (1 + F.zoomPunch);
    const k = 1 - Math.pow(0.002, dt);
    this.zoom += (z - this.zoom) * k;
    this.camX += (tx - this.camX) * k;
    const half = this.W / 2 / this.zoom;
    const lim = APRON_X + 120;
    if (half < lim) this.camX = Math.max(-lim + half, Math.min(lim - half, this.camX));
    else this.camX = 0;
  }

  private render(dt: number): void {
    const F = this.fight;
    const ctx = this.ctx;
    const W = this.W;
    const H = this.H;
    this.camera(dt);
    const z = this.zoom;
    const portrait = H > W;
    const floorY = H * (portrait ? 0.64 : 0.72);
    let shx = 0;
    let shy = 0;
    if (F.shakeT > 0) {
      shx = (Math.random() - 0.5) * F.shakeAmp * 2 * z * 1.5;
      shy = (Math.random() - 0.5) * F.shakeAmp * 2 * z * 1.5;
    }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    drawBackdrop(ctx, W, H, this.camX, z, floorY + BACK_Y * z + shy, F.t, F.hype, this.low);

    // profundidade: o público fica ligeiramente mais escuro que a ação
    ctx.fillStyle = 'rgba(8,4,18,0.28)';
    ctx.fillRect(0, 0, W, H);
    if (F.cosmic > 0.01) this.drawCosmic(ctx, F.cosmic, F.t);
    if (F.darken > 0.01) {
      ctx.fillStyle = `rgba(5,2,12,${F.darken})`;
      ctx.fillRect(0, 0, W, H);
    }

    // espaço do mundo
    ctx.setTransform(this.dpr * z, 0, 0, this.dpr * z, this.dpr * (W / 2 - this.camX * z + shx), this.dpr * (floorY + shy));
    drawFloor(ctx);
    drawRingBack(ctx, F.ropes);

    // poças de luz dos holofotes sobre os lutadores
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.22 + F.hype * 0.12;
    for (const f of F.active) {
      const hx = F.hipX(f);
      ctx.drawImage(glowSprite('#fff1cf'), hx - 170, -60, 340, 110);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // sombras
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    for (const f of F.fighters) {
      if (f.state === 'out') continue;
      const s = Math.max(0.3, 1 - f.z / 400);
      ctx.beginPath();
      ctx.ellipse(F.hipX(f), 2, 44 * s, 9 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const b of F.beams) this.drawBeam(ctx, b.x, b.w, b.life / b.max, b.color);

    // lutadores ordenados
    const list = F.fighters.slice().sort((p, q) => this.order(p) - this.order(q));
    for (const f of list) this.drawF(ctx, f);

    for (const p of F.projs) this.drawProj(ctx, p.kind, p.x, p.y, p.dir, p.color, F.t);
    for (const w of F.waves) {
      const a = w.life / w.max;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a;
      ctx.strokeStyle = w.color;
      ctx.lineWidth = 14 * a + 2;
      ctx.beginPath();
      ctx.ellipse(w.x, w.y, w.r, w.r * 0.28, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    F.parts.draw(ctx);
    for (const b of F.bolts) drawBolt(ctx, b);

    drawRingFront(ctx, F.ropes);
    drawForeground(ctx, this.camX, F.t, F.hype);

    // textos flutuantes
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const ts = 1 / Math.max(0.45, z);
    for (const p of F.pops) {
      const a = Math.min(1, p.life * 3);
      const sc = (1 + Math.max(0, p.life - 0.85) * 3) * ts * 0.85;
      ctx.globalAlpha = a;
      ctx.font = `${Math.round(p.size * sc)}px ${FONT}`;
      ctx.lineWidth = 6 * sc;
      ctx.strokeStyle = '#140a1c';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;

    // espaço de ecrã
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (F.flash > 0) {
      ctx.globalAlpha = Math.min(1, F.flash) * 0.8;
      ctx.fillStyle = F.flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    this.drawVignette(ctx, W, H);
    for (const b of F.banners) this.drawBanner(ctx, b.text, b.sub, b.color, b.life, b.max, b.size, W, H);
    if (F.cutin) this.drawCutIn(ctx, W, H);
  }

  private order(f: Fighter): number {
    if (f.state === 'out') return -3;
    if (f.state === 'apron') return -2;
    if (f.state === 'down' || f.state === 'ko') return -1 + f.layer;
    if (f.override) return 1;
    return f.layer + (f.script ? 0.5 : 0);
  }

  private drawF(ctx: CanvasRenderingContext2D, f: Fighter): void {
    const F = this.fight;
    const k = F.scale(f);
    const x = F.hipX(f);
    const y = F.hipY(f);
    const opts = { t: F.t + f.slot * 1.3, expr: f.expr, flash: f.flashT > 0, glow: f.glow, low: this.low };
    if (f.ghost) {
      for (let g = 2; g >= 1; g--) {
        ctx.save();
        ctx.globalAlpha = 0.18 * g;
        ctx.translate(x - f.facing * g * 26, y);
        ctx.scale(k * f.facing, k);
        drawFighter(ctx, f.spec.look, f.skel, { ...opts, glow: null });
        ctx.restore();
      }
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k * f.facing, k);
    if (f.wings) this.drawWings(ctx, F.t, f.skel.x[J_HEAD], f.skel.y[J_HEAD]);
    if (f.state === 'out') ctx.globalAlpha = 0.55;
    drawFighter(ctx, f.spec.look, f.skel, opts);
    ctx.restore();
    // marcador de equipa por cima da cabeça do jogador
    if (f.spec.isPlayer && f.state !== 'out' && F.phase !== 'end') {
      const hx = F.jx(f, J_HEAD);
      const hy = F.jy(f, J_HEAD) - HEAD_R * k - 34;
      ctx.fillStyle = TEAM_COLORS[0];
      ctx.beginPath();
      ctx.moveTo(hx - 9, hy - 8);
      ctx.lineTo(hx + 9, hy - 8);
      ctx.lineTo(hx, hy + 4);
      ctx.closePath();
      ctx.fill();
    }
  }

  private drawWings(ctx: CanvasRenderingContext2D, t: number, hx: number, hy: number): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const flap = Math.sin(t * 6) * 0.15;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(hx - 20, hy + 60);
      ctx.rotate(side * (0.5 + flap) - 0.2);
      for (let i = 0; i < 6; i++) {
        ctx.globalAlpha = 0.5 - i * 0.05;
        ctx.fillStyle = i % 2 ? '#fff2a8' : '#ffffff';
        ctx.beginPath();
        ctx.ellipse(side * (30 + i * 18), -40 - i * 14, 16, 60 - i * 5, side * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 0.8;
    ctx.drawImage(glowSprite('#fff2a8'), hx - 140, hy - 120, 280, 280);
    ctx.restore();
  }

  private drawBeam(ctx: CanvasRenderingContext2D, x: number, w: number, a: number, color: string): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const flick = 0.8 + Math.sin(this.fight.t * 40) * 0.2;
    ctx.globalAlpha = Math.min(1, a * 2) * flick;
    const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
    g.addColorStop(0, color + '00');
    g.addColorStop(0.35, color + 'aa');
    g.addColorStop(0.5, '#ffffff');
    g.addColorStop(0.65, color + 'aa');
    g.addColorStop(1, color + '00');
    ctx.fillStyle = g;
    ctx.fillRect(x - w, -2000, w * 2, 2000);
    ctx.drawImage(glowSprite(color), x - w * 2, -w, w * 4, w * 2);
    ctx.restore();
  }

  private drawProj(ctx: CanvasRenderingContext2D, kind: string, x: number, y: number, dir: number, color: string, t: number): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (kind === 'dragon') {
      // corpo de serpente de fogo
      for (let i = 14; i >= 0; i--) {
        const px = x - dir * i * 22;
        const py = y + Math.sin(t * 14 - i * 0.6) * 22;
        const r = 34 - i * 1.6;
        ctx.globalAlpha = 0.9 - i * 0.04;
        ctx.drawImage(glowSprite(i % 2 ? '#ffd000' : color), px - r * 1.4, py - r * 1.4, r * 2.8, r * 2.8);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      // cabeça
      ctx.translate(x, y + Math.sin(t * 14) * 22);
      ctx.scale(dir, 1);
      ctx.fillStyle = '#ff6a00';
      ctx.strokeStyle = '#5a1000';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-30, -26);
      ctx.quadraticCurveTo(20, -40, 60, -8);
      ctx.lineTo(40, 4);
      ctx.lineTo(62, 14);
      ctx.quadraticCurveTo(10, 36, -30, 22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff6a0';
      ctx.beginPath();
      ctx.arc(22, -14, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd000';
      ctx.beginPath();
      ctx.moveTo(-20, -24);
      ctx.lineTo(-40, -56);
      ctx.lineTo(-4, -30);
      ctx.fill();
    } else {
      ctx.globalAlpha = 0.85;
      ctx.drawImage(glowSprite(color), x - 140, y - 140, 280, 280);
      ctx.translate(x, y);
      ctx.scale(dir, 1);
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = '#dcd2ff';
      ctx.beginPath();
      ctx.ellipse(0, 0, 70, 58, 0, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.ellipse(52, -36 + i * 24, 24, 13, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 10; i++) {
        ctx.fillRect(-50 + hash(i) * 100, -40 + hash(i + 7) * 80, 3, 3);
      }
    }
    ctx.restore();
  }

  private drawCosmic(ctx: CanvasRenderingContext2D, a: number, t: number): void {
    ctx.globalAlpha = a * 0.9;
    ctx.fillStyle = '#0b0420';
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 90; i++) {
      const x = ((hash(i) * this.W + t * (10 + hash(i + 3) * 40)) % this.W);
      const y = hash(i + 11) * this.H;
      const s = 1 + hash(i + 5) * 2.5;
      ctx.globalAlpha = a * (0.4 + Math.sin(t * 4 + i) * 0.4);
      ctx.fillStyle = i % 5 ? '#ffffff' : '#9b7aff';
      ctx.fillRect(x, y, s, s);
    }
    ctx.globalAlpha = a * 0.5;
    ctx.drawImage(glowSprite('#7a5cff'), this.W * 0.2, this.H * 0.05, this.W * 0.6, this.H * 0.5);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  private vignette: CanvasGradient | null = null;
  private vigKey = '';
  private drawVignette(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    const key = W + 'x' + H;
    if (!this.vignette || this.vigKey !== key) {
      this.vigKey = key;
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.55)');
      this.vignette = g;
    }
    ctx.fillStyle = this.vignette;
    ctx.fillRect(0, 0, W, H);
  }

  private drawBanner(ctx: CanvasRenderingContext2D, text: string, sub: string, color: string, life: number, max: number, size: number, W: number, H: number): void {
    const age = max - life;
    const pop = age < 0.18 ? 1.6 - (age / 0.18) * 0.6 : 1;
    const a = Math.min(1, life * 4);
    const base = Math.min(W, H * 1.4) * 0.14 * size;
    const fs = base * pop;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const y = H * 0.36;
    ctx.translate(W / 2, y);
    ctx.rotate(-0.05);
    ctx.font = `${Math.round(fs)}px ${FONT}`;
    ctx.lineWidth = fs * 0.16;
    ctx.strokeStyle = '#140a1c';
    ctx.strokeText(text, 0, 0);
    const g = ctx.createLinearGradient(0, -fs / 2, 0, fs / 2);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, color);
    g.addColorStop(1, color);
    ctx.fillStyle = g;
    ctx.fillText(text, 0, 0);
    if (sub) {
      const ss = Math.max(14, base * 0.28);
      ctx.font = `${Math.round(ss)}px ${FONT}`;
      ctx.lineWidth = ss * 0.25;
      ctx.strokeText(sub, 0, fs * 0.62);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(sub, 0, fs * 0.62);
    }
    ctx.restore();
  }

  private drawCutIn(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    const c = this.fight.cutin!;
    const u = c.t / c.max;
    const slide = u < 0.15 ? 1 - u / 0.15 : u > 0.85 ? -(u - 0.85) / 0.15 : 0;
    const dir = c.team === 0 ? 1 : -1;
    const bandH = Math.min(H * 0.32, 220);
    const y = H * 0.42;
    ctx.save();
    ctx.globalAlpha = 0.55 * (1 - Math.abs(slide));
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.translate(-slide * dir * W, 0);
    // faixa diagonal
    ctx.beginPath();
    ctx.moveTo(0, y - bandH / 2 + 30);
    ctx.lineTo(W, y - bandH / 2 - 30);
    ctx.lineTo(W, y + bandH / 2 - 30);
    ctx.lineTo(0, y + bandH / 2 + 30);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, TEAM_COLORS[c.team]);
    g.addColorStop(0.6, '#140a1c');
    g.addColorStop(1, c.color);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    // linhas de velocidade
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 18; i++) {
      const ly = y - bandH / 2 + hash(i) * bandH;
      const lx = ((hash(i + 3) * W + c.t * 2400 * dir) % (W + 200)) - 100;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx - 160 * dir, ly + 8);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    // retrato do lutador
    const f = this.fight.fighters.find((x) => x.spec.name === c.name && x.team === c.team) ?? this.fight.active[c.team];
    const ps = bandH / 95;
    const px = dir === 1 ? W * 0.22 : W * 0.78;
    ctx.translate(px, y + bandH * 0.95);
    ctx.scale(ps * dir, ps);
    drawFighter(ctx, f.spec.look, f.skel, { t: this.fight.t, expr: 'power', flash: false, glow: c.color });
    ctx.restore();
    // textos
    ctx.textAlign = dir === 1 ? 'left' : 'right';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const tx = dir === 1 ? W * 0.42 : W * 0.58;
    const fs = Math.min(bandH * 0.32, W * 0.075);
    ctx.font = `${Math.round(fs * 0.55)}px ${FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#140a1c';
    ctx.strokeText(c.name, tx, y - fs * 0.7);
    ctx.fillText(c.name, tx, y - fs * 0.7);
    ctx.font = `${Math.round(fs)}px ${FONT}`;
    ctx.lineWidth = fs * 0.18;
    ctx.strokeText(`${c.icon} ${c.move.toUpperCase()}`, tx, y + fs * 0.25);
    ctx.fillStyle = c.color;
    ctx.fillText(`${c.icon} ${c.move.toUpperCase()}`, tx, y + fs * 0.25);
    ctx.restore();
  }
}
