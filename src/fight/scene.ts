import { drawFighter, glowSprite } from '../render/fighter';
import { HEAD_R, J_BH, J_FF, J_FH, J_HEAD } from '../render/pose';
import { setVolume, sfx, startCrowd, stopCrowd } from '../audio/sfx';
import { S, commit } from '../core/state';
import { APRON_X, BACK_Y, FRONT_X, TEAM_COLORS, drawBackdrop, drawFloor, drawForeground, drawRingBack, drawRingFront, ensureArena } from './arena';
import { Fight, type FightReport, type FightSetup } from './engine';
import type { Fighter } from './fighter';
import { drawBolt, hash } from './fx';
import { Announcer } from '../audio/announcer';
import { music } from '../audio/music';
import { ANIMS, sample } from './anims';
import { Skel, newPose, solve } from '../render/pose';
import { ico } from '../ui/icons';
import { esc } from '../ui/dom';
import { openSettings } from '../ui/screens/settings';

export interface SceneOpts {
  speed: 1 | 2;
  quality: 'alta' | 'baixa';
  onEnd: (r: FightReport) => void;
  onSpeed?: (s: 1 | 2) => void;
  onEvent?: (ev: string) => void;
}

const FONT = '"Luckiest Guy", Impact, sans-serif';

interface HudSide {
  root: HTMLElement;
  hp: HTMLElement;
  trail: HTMLElement;
  meter: HTMLElement;
  stam: HTMLElement;
  hpText: HTMLElement;
  name: HTMLElement;
  bench: HTMLElement | null;
  benchHp: HTMLElement | null;
  last: { hp: number; trail: number; meter: number; full: boolean; who: Fighter | null; bench: number; stam: number };
}

export class FightScene {
  fight: Fight;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private root: HTMLElement;
  private raf = 0;
  private last = 0;
  /** Pausa (definições abertas a meio da luta). */
  private paused = false;
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
  private announcer!: Announcer;
  private skipping = false;
  private capEl: HTMLElement | null = null;
  private capT = 0;
  private portraitSkel = new Skel();
  private portraitPose = newPose();
  private halftone: CanvasPattern | null = null;
  private hudHidden = false;
  /** Rastos dos punhos/pés (posições recentes no mundo). */
  private smear = new Map<Fighter, Float32Array>();
  private letter = 0;
  /** Peso suavizado da câmara lenta (zoom/enquadramento). */
  private cineS = 0;
  /** Montra de entrada (pré-visualização): sem HUD, narrador, música nem público. */
  private showcase: boolean;
  private setup: FightSetup;
  private showcaseT = 0;
  private seen = false;
  private onResize = () => this.resize();
  private onVis = () => {
    if (!document.hidden) this.last = performance.now();
  };

  constructor(container: HTMLElement, setup: FightSetup, opts: SceneOpts) {
    this.opts = opts;
    this.speed = opts.speed;
    this.low = opts.quality === 'baixa';
    this.setup = setup;
    this.showcase = !!setup.showcase;
    ensureArena();
    this.announcer = new Announcer(this.showcase ? false : S.settings.announcer, S.settings.announcerVol, (text, prio) => this.caption(text, prio));
    this.fight = this.newFight();
    this.root = document.createElement('div');
    this.root.className = 'fight-root' + (this.showcase ? ' showcase' : '');
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'fight-canvas';
    this.root.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d', { alpha: false })!;
    if (!this.showcase) this.buildHud(setup.mode === 'tag');
    container.appendChild(this.root);
    this.resize();
    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVis);
    if (!this.showcase) {
      startCrowd();
      music.play('fight');
    }
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  private newFight(): Fight {
    const fight = new Fight(this.setup);
    fight.onEvent = (ev, a, b, x) => {
      if (!this.skipping && !this.showcase) this.announcer.event(ev, a?.spec.name, b?.spec.name, x);
      this.opts.onEvent?.(ev);
    };
    fight.onEnd = (r) => {
      this.announcer.stop();
      stopCrowd();
      setTimeout(() => !this.destroyed && this.opts.onEnd(r), 400);
    };
    return fight;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVis);
    this.announcer.stop();
    if (!this.showcase) {
      stopCrowd();
      music.play('menu');
    }
    this.root.remove();
  }

  private resize(): void {
    // tamanho de layout (não afetado por transformações, ex.: animação de abertura do modal)
    this.W = Math.max(1, this.root.clientWidth);
    this.H = Math.max(1, this.root.clientHeight);
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
        <div class="hud-stam"><i></i></div>
        ${tag ? '<div class="hud-bench"><span></span><div class="bench-bar"><i></i></div></div>' : ''}`;
      hud.appendChild(el);
      return {
        root: el,
        hp: el.querySelector('.hp') as HTMLElement,
        trail: el.querySelector('.trail') as HTMLElement,
        meter: el.querySelector('.hud-meter i') as HTMLElement,
        stam: el.querySelector('.hud-stam i') as HTMLElement,
        hpText: el.querySelector('.hp-text') as HTMLElement,
        name: el.querySelector('.hud-name b') as HTMLElement,
        bench: el.querySelector('.hud-bench span') as HTMLElement | null,
        benchHp: el.querySelector('.bench-bar i') as HTMLElement | null,
        last: { hp: -1, trail: -1, meter: -1, full: false, who: null, bench: -1, stam: -1 },
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
    ctr.innerHTML = `<label class="fight-vol" aria-label="Volume">${ico('speaker')}<input type="range" min="0" max="100" value="${Math.round(S.settings.volume * 100)}"/></label><button class="btn-ghost mic${S.settings.announcer ? '' : ' off'}" aria-label="Narrador" title="Narrador">${ico('mic')}</button><button class="btn-ghost cfg" aria-label="Definições" title="Definições">${ico('gear')}</button><button class="btn-ghost sp">${this.speed}x</button><button class="btn-ghost skip">Saltar ${ico('skip')}</button>`;
    const vol = ctr.querySelector('.fight-vol input') as HTMLInputElement;
    vol.oninput = () => {
      S.settings.volume = Number(vol.value) / 100;
      setVolume(S.settings.volume);
    };
    vol.onchange = () => commit();
    const mic = ctr.querySelector('.mic') as HTMLButtonElement;
    mic.onclick = () => {
      S.settings.announcer = !S.settings.announcer;
      this.announcer.setEnabled(S.settings.announcer);
      mic.classList.toggle('off', !S.settings.announcer);
      if (!S.settings.announcer && this.capEl) this.capEl.classList.remove('on');
      commit();
      sfx.click();
    };
    (ctr.querySelector('.cfg') as HTMLButtonElement).onclick = () => {
      sfx.click();
      // a luta fica em pausa enquanto as definições estão abertas
      this.paused = true;
      openSettings(() => {
        this.paused = false;
        this.last = performance.now();
        this.announcer.setEnabled(S.settings.announcer);
        mic.classList.toggle('off', !S.settings.announcer);
        setVolume(S.settings.volume);
        vol.value = String(Math.round(S.settings.volume * 100));
      });
    };
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
    const hint = document.createElement('div');
    hint.className = 'ent-hint';
    hint.textContent = 'Toca para saltar a entrada';
    this.root.appendChild(hint);
    this.canvas.addEventListener('pointerdown', () => {
      if (this.fight.phase === 'entrance') {
        sfx.click();
        this.fight.skipEntrance();
      }
    });
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
      const st = Math.round(f.stamina / 5) / 20;
      if (st !== L.stam) {
        L.stam = st;
        h.stam.style.transform = `scaleX(${st})`;
        h.stam.parentElement!.classList.toggle('low', st < 0.25);
      }
      if (h.bench && h.benchHp) {
        const other = F.teams[ti].find((p) => p !== f);
        const b = other ? (other.state === 'out' ? -2 : Math.round((other.hp / other.maxHp) * 100)) : -2;
        if (b !== L.bench && other) {
          L.bench = b;
          h.bench.innerHTML = ico(other.state === 'out' ? 'close' : 'tag') + ' ' + esc(other.spec.name);
          h.benchHp.style.transform = `scaleX(${Math.max(0, b) / 100})`;
          h.bench.parentElement!.classList.toggle('out', other.state === 'out');
        }
      }
    }
    const ent = F.phase === 'entrance';
    if (ent !== this.hudHidden) {
      this.hudHidden = ent;
      this.root.classList.toggle('entrance', ent);
    }
    const c = String(Math.max(0, Math.ceil(F.clock)));
    if (this.clockEl.textContent !== c) this.clockEl.textContent = c;
  }

  // ───────────────────────── Ciclo ─────────────────────────

  private loop = (now: number) => {
    if (this.destroyed) return;
    // a montra liberta-se sozinha quando o seu contentor sai do documento (ex.: modal fechado)
    if (this.showcase) {
      if (this.root.isConnected) this.seen = true;
      else if (this.seen) {
        this.destroy();
        return;
      }
    }
    this.raf = requestAnimationFrame(this.loop);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1;
    if (this.showcase && this.fight.showcaseDone) {
      // pausa curta em pose e recomeça a entrada
      this.showcaseT += dt;
      if (this.showcaseT > 1.6) {
        this.showcaseT = 0;
        this.smear.clear();
        this.fight = this.newFight();
      }
    }
    // adapta a qualidade se o dispositivo estiver a sofrer
    if (!this.low && this.frames < 240) {
      this.frames++;
      if (dt > 0.026) this.slowFrames++;
      if (this.frames === 240 && this.slowFrames > 90) {
        this.low = true;
        this.resize();
      }
    }
    if (this.paused) {
      this.render(0);
      return;
    }
    const step = dt * this.speed;
    // sub-passos para estabilidade a 2x
    const n = step > 0.034 ? 2 : 1;
    for (let i = 0; i < n; i++) this.fight.update(step / n);
    this.render(dt);
    if (this.showcase) return;
    this.updateHud();
    this.announcer.volume = S.settings.announcerVol;
    this.announcer.tick(dt, this.fight.phase === 'fight');
    music.setIntensity(this.fight.hype);
    if (this.capEl && this.capT > 0) {
      this.capT -= dt;
      if (this.capT <= 0) this.capEl.classList.remove('on');
    }
  };

  private caption(text: string, prio: number): void {
    if (!this.capEl) {
      this.capEl = document.createElement('div');
      this.capEl.className = 'fight-caption';
      this.root.appendChild(this.capEl);
    }
    this.capEl.innerHTML = `<span>${ico('mic')}</span><b></b>`;
    (this.capEl.querySelector('b') as HTMLElement).textContent = text;
    this.capEl.classList.toggle('hot', prio >= 6);
    this.capEl.classList.remove('on');
    void this.capEl.offsetWidth;
    this.capEl.classList.add('on');
    this.capT = 1.6 + text.length * 0.045;
  }

  private skip(): void {
    const F = this.fight;
    let guard = 0;
    sfx.setMuted(true);
    this.skipping = true;
    this.announcer.stop();
    while (!F.phaseEnded() && guard++ < 20000) F.update(1 / 30);
    this.skipping = false;
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
      desired = F.phase === 'entrance' ? (portrait ? 560 : 900) : portrait ? 390 : 680;
    } else {
      tx = (a.x + b.x) / 2;
      const d = Math.abs(a.x - b.x);
      desired = portrait ? Math.min(900, Math.max(410, d + 260)) : Math.min(1300, Math.max(780, d + 520));
    }
    // câmara lenta: aproxima-se do ponto de impacto
    const k = 1 - Math.pow(0.002, dt);
    this.cineS += (F.cineW - this.cineS) * k;
    const cw = this.cineS;
    if (cw > 0.001) {
      tx += (F.cineX - tx) * cw * 0.85;
      desired *= 1 - 0.3 * cw;
    }
    const zx = this.W / desired;
    const zy = this.H / (portrait ? 820 : 640) * (1 + 0.3 * cw);
    const z = Math.min(zx, zy) * (1 + F.zoomPunch);
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
    // na câmara lenta o chão desce um pouco para o golpe ficar no centro do ecrã
    const floorY = H * ((portrait ? 0.64 : 0.72) + 0.06 * this.cineS);
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

    this.drawHaze(ctx, W, H, F.t);
    if (F.lasersT > 0) this.drawLasers(ctx, W, H, F.t, F.lasersT);

    // espaço do mundo
    ctx.setTransform(this.dpr * z, 0, 0, this.dpr * z, this.dpr * (W / 2 - this.camX * z + shx), this.dpr * (floorY + shy));
    drawFloor(ctx);
    drawRingBack(ctx, F.ropes);

    if (F.stage) this.drawStageBack(ctx, F.stage, F.t);

    // poças de luz dos holofotes sobre os lutadores
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.22 + F.hype * 0.12;
    for (const f of F.active) {
      if (f.hidden) continue;
      const hx = F.hipX(f);
      ctx.drawImage(glowSprite('#fff1cf'), hx - 170, -60, 340, 110);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // sombras suaves de contacto
    const shadow = glowSprite('#000000');
    const all = F.extras.length ? F.fighters.concat(F.extras) : F.fighters;
    for (const f of all) {
      if ((f.state === 'out' && !f.exiting) || f.hidden || f.z < -5) continue;
      const s = Math.max(0.3, 1 - f.z / 400);
      const lying = f.state === 'down' || f.state === 'ko' || (f.exiting && Math.abs(f.pose.rot) > 1);
      ctx.globalAlpha = 0.7 * s;
      const w = (lying ? 190 : 120) * s;
      ctx.drawImage(shadow, F.hipX(f) - w / 2 + (lying ? -f.facing * 30 : 0), -12 * s, w, 26 * s);
    }
    ctx.globalAlpha = 1;

    for (const b of F.beams) this.drawBeam(ctx, b.x, b.w, b.life / b.max, b.color);

    // lutadores ordenados
    const list = all.slice().sort((p, q) => this.order(p) - this.order(q));
    for (const f of list) {
      if (f.hidden) continue;
      this.drawSmear(ctx, f);
      this.drawF(ctx, f);
    }

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
    if (F.stage && F.stage.scan != null) this.drawScan(ctx, F.stage.scan, F.t);
    for (const b of F.bursts) this.drawBurst(ctx, b.x, b.y, b.text, b.color, b.life / b.max, b.rot, z);

    drawRingFront(ctx, F.ropes, F.t, F.hype);
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
    if (F.stage && F.stage.flicker > 0) {
      F.stage.flicker = Math.max(0, F.stage.flicker - dt);
      if (Math.random() < 0.5) {
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(0, 0, W, H);
      }
    }
    this.drawVignette(ctx, W, H);
    const lt = F.phase === 'entrance' || F.cutin ? 1 : this.cineS * 0.7;
    this.letter += (lt - this.letter) * Math.min(1, dt * 6);
    if (this.letter > 0.01) {
      const bh = H * 0.085 * this.letter;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, bh);
      ctx.fillRect(0, H - bh, W, bh);
    }
    for (const b of F.banners) this.drawBanner(ctx, b.text, b.sub, b.color, b.life, b.max, b.size, W, H);
    if (F.moveCall && !F.cutin) this.drawMoveCall(ctx, W, H);
    if (F.cutin) this.drawCutIn(ctx, W, H);
  }

  private drawHaze(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
    if (this.low) return;
    ctx.globalCompositeOperation = 'lighter';
    const g = glowSprite('#8f7ad6');
    for (let i = 0; i < 4; i++) {
      const x = ((t * (8 + i * 5) + i * W * 0.37) % (W * 1.6)) - W * 0.3;
      const y = H * (0.25 + i * 0.12);
      ctx.globalAlpha = 0.07;
      ctx.drawImage(g, x - W * 0.35, y - H * 0.15, W * 0.7, H * 0.3);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawLasers(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, left: number): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const a = Math.min(1, left * 2);
    const cols = ['#ff2e63', '#2ef0ff', '#3dff6e', '#b45cff'];
    for (let i = 0; i < 8; i++) {
      const fromLeft = i % 2 === 0;
      const ox = fromLeft ? W * 0.05 : W * 0.95;
      const ang = Math.PI / 2 + (fromLeft ? -1 : 1) * (0.25 + 0.45 * (0.5 + 0.5 * Math.sin(t * 2.2 + i * 0.9)));
      const ex = ox + Math.cos(ang) * H * 1.4;
      const ey = Math.sin(ang) * H * 1.4;
      const c = cols[i % cols.length];
      ctx.strokeStyle = c;
      ctx.globalAlpha = 0.18 * a;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(ox, 0);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.globalAlpha = 0.9 * a;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  private static SMEAR_ANIMS = new Set(['jab', 'cross', 'hook', 'upper', 'body', 'haymaker', 'kick', 'clothes']);
  private drawSmear(ctx: CanvasRenderingContext2D, f: Fighter): void {
    const F = this.fight;
    let buf = this.smear.get(f);
    if (!buf) {
      buf = new Float32Array(30).fill(NaN);
      this.smear.set(f, buf);
    }
    // desloca o histórico (5 amostras × 3 pontos × 2 coordenadas)
    buf.copyWithin(6, 0, 24);
    const pts = [J_FH, J_BH, J_FF];
    for (let k = 0; k < 3; k++) {
      buf[k * 2] = F.jx(f, pts[k]);
      buf[k * 2 + 1] = F.jy(f, pts[k]);
    }
    if (!FightScene.SMEAR_ANIMS.has(f.anim) || f.state === 'hit') return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      for (let i = 0; i < 4; i++) {
        const x1 = buf[i * 6 + k * 2];
        const y1 = buf[i * 6 + k * 2 + 1];
        const x2 = buf[(i + 1) * 6 + k * 2];
        const y2 = buf[(i + 1) * 6 + k * 2 + 1];
        if (Number.isNaN(x2)) break;
        const d = Math.hypot(x2 - x1, y2 - y1);
        if (d < 7) continue;
        ctx.globalAlpha = 0.32 * (1 - i / 4);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 20 * (1 - i / 5);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawBurst(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string, a: number, rot: number, z: number): void {
    const age = 1 - a;
    const sc = (age < 0.25 ? 0.5 + (age / 0.25) * 0.7 : 1.2 - (age - 0.25) * 0.3) / Math.max(0.6, z);
    ctx.save();
    ctx.translate(x, y - 40);
    ctx.rotate(rot);
    ctx.scale(sc, sc);
    ctx.globalAlpha = Math.min(1, a * 3);
    ctx.beginPath();
    const n = 12;
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 ? 26 : 50 + (i % 4 === 0 ? 8 : 0);
      const ang = (i / (n * 2)) * Math.PI * 2;
      ctx.lineTo(Math.cos(ang) * r * 1.25, Math.sin(ang) * r * 0.85);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#140a1c';
    ctx.stroke();
    ctx.font = `30px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 7;
    ctx.strokeText(text, 0, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, 0, 2);
    ctx.restore();
  }

  /** Cenografia das entradas: passadeira, bola de espelhos, portal. */
  private drawStageBack(ctx: CanvasRenderingContext2D, st: { disco: number; carpet: number; portal: number; side: number }, t: number): void {
    if (st.carpet > 0) {
      const x0 = st.side * (FRONT_X - 10);
      const x1 = x0 - st.side * (FRONT_X + 30) * st.carpet;
      ctx.fillStyle = '#b3121f';
      ctx.beginPath();
      ctx.moveTo(x0, -22);
      ctx.lineTo(x1, -22);
      ctx.lineTo(x1, 20);
      ctx.lineTo(x0, 20);
      ctx.fill();
      ctx.fillStyle = '#ffd23d';
      ctx.fillRect(Math.min(x0, x1), -24, Math.abs(x1 - x0), 4);
      ctx.fillRect(Math.min(x0, x1), 18, Math.abs(x1 - x0), 4);
      // rolo da passadeira
      ctx.fillStyle = '#8a0d18';
      ctx.beginPath();
      ctx.ellipse(x1, -1, 9, 23, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (st.disco > 0) {
      const y = -760 + st.disco * 300;
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -1400);
      ctx.lineTo(0, y - 40);
      ctx.stroke();
      ctx.save();
      ctx.translate(0, y);
      ctx.beginPath();
      ctx.arc(0, 0, 40, 0, Math.PI * 2);
      ctx.save();
      ctx.clip();
      for (let gy = -40; gy < 40; gy += 9) {
        for (let gx = -40; gx < 40; gx += 9) {
          const k = hash(Math.floor(gx / 9 + t * 4) * 31 + gy);
          ctx.fillStyle = k > 0.8 ? '#ffffff' : k > 0.5 ? '#c9d2e3' : '#7d879c';
          ctx.fillRect(gx + 1, gy + 1, 7.5, 7.5);
        }
      }
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(glowSprite('#ffffff'), -90, -90, 180, 180);
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
      // reflexos a girar pelo ringue e pelo público
      ctx.globalCompositeOperation = 'lighter';
      const cols = ['#ff3d6e', '#3aa0ff', '#ffd23d', '#4cd964', '#b45cff'];
      for (let i = 0; i < 14; i++) {
        const a = t * 1.3 + i * 0.9;
        const x = Math.cos(a) * (200 + (i % 4) * 140);
        const yy = -40 - ((i * 53) % 420) + Math.sin(a * 1.7) * 20;
        ctx.globalAlpha = 0.5 * st.disco;
        ctx.drawImage(glowSprite(cols[i % cols.length]), x - 26, yy - 14, 52, 28);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    if (st.portal > 0) {
      const k = Math.min(1, st.portal);
      ctx.save();
      ctx.translate(0, -560);
      ctx.scale(k, k);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(glowSprite('#9b7aff'), -260, -150, 520, 300);
      for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = i % 2 ? '#7af7ff' : '#b9a6ff';
        ctx.lineWidth = 6 - i;
        ctx.beginPath();
        ctx.ellipse(0, 0, 150 - i * 22, 52 - i * 8, Math.sin(t * 2 + i) * 0.1, t * (2 + i), t * (2 + i) + Math.PI * 1.6);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#0b0420';
      ctx.beginPath();
      ctx.ellipse(0, 0, 80, 26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawScan(ctx: CanvasRenderingContext2D, x: number, t: number): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5;
    ctx.drawImage(glowSprite('#ff2e63'), x - 60, -700, 120, 760);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = Math.floor(t * 20) % 2 ? '#ff2e63' : '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, -900);
    ctx.lineTo(x, 30);
    ctx.stroke();
    ctx.restore();
  }

  private order(f: Fighter): number {
    // a sair do ringue (eliminado / árbitro): atrás de quem está a lutar; o árbitro à frente de quem leva
    if (f.exiting) return f.referee ? -1.5 : -1.6;
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
    const opts = { t: F.t + f.slot * 1.3, expr: f.expr, flash: f.flashT > 0, glow: f.glow, low: this.low, rim: this.low ? null : f.referee ? '#dfe6ff' : f.team === 0 ? '#ff6f93' : '#6fbaff' };
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
    if (f.state === 'out' && !f.exiting) ctx.globalAlpha = 0.55;
    drawFighter(ctx, f.spec.look, f.skel, opts);
    ctx.restore();
    // marcador de equipa por cima da cabeça do jogador
    if (f.spec.isPlayer && f.state !== 'out' && F.phase !== 'end' && !F.showcase) {
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

  /** Desenha um lutador em pose de cartaz (para as faixas de golpe/super). */
  private drawPortrait(ctx: CanvasRenderingContext2D, f: Fighter, anim: 'flex' | 'point' | 'charge' | 'haymaker', x: number, y: number, scale: number, dir: number, glow: string | null): void {
    sample(ANIMS[anim], Math.min(0.7, this.fight.t % 1.2 + 0.3), this.portraitPose);
    solve(this.portraitPose, this.portraitSkel);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale * dir, scale);
    drawFighter(ctx, f.spec.look, this.portraitSkel, { t: this.fight.t, expr: 'power', flash: false, glow, rim: f.team === 0 ? '#ff6f93' : '#6fbaff' });
    ctx.restore();
  }

  private getHalftone(ctx: CanvasRenderingContext2D): CanvasPattern | null {
    if (this.halftone) return this.halftone;
    const c = document.createElement('canvas');
    c.width = c.height = 14;
    const g = c.getContext('2d')!;
    g.fillStyle = 'rgba(255,255,255,0.16)';
    g.beginPath();
    g.arc(7, 7, 3.2, 0, Math.PI * 2);
    g.fill();
    this.halftone = ctx.createPattern(c, 'repeat');
    return this.halftone;
  }

  private fighterByCall(name: string, team: 0 | 1): Fighter {
    return this.fight.fighters.find((x) => x.spec.name === name && x.team === team) ?? this.fight.active[team];
  }

  /** Faixa de golpe de assinatura: retrato + nome em grande, sem parar a luta. */
  private drawMoveCall(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    const c = this.fight.moveCall!;
    const u = c.t / c.max;
    const dir = c.team === 0 ? 1 : -1;
    const inK = Math.min(1, c.t / 0.16);
    const outK = u > 0.8 ? (u - 0.8) / 0.2 : 0;
    const off = (1 - this.easeBack(inK)) * W * 0.9 + outK * outK * W;
    const bandH = Math.min(H * 0.17, 130);
    const y = H * 0.24;
    ctx.save();
    ctx.translate(-dir * off, 0);
    // faixa inclinada
    ctx.beginPath();
    ctx.moveTo(0, y - bandH / 2 + 14 * dir);
    ctx.lineTo(W, y - bandH / 2 - 14 * dir);
    ctx.lineTo(W, y + bandH / 2 - 14 * dir);
    ctx.lineTo(0, y + bandH / 2 + 14 * dir);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, W, 0);
    const team = TEAM_COLORS[c.team];
    if (dir === 1) {
      g.addColorStop(0, team);
      g.addColorStop(0.45, '#160a26');
      g.addColorStop(1, 'rgba(22,10,38,0.2)');
    } else {
      g.addColorStop(0, 'rgba(22,10,38,0.2)');
      g.addColorStop(0.55, '#160a26');
      g.addColorStop(1, team);
    }
    ctx.globalAlpha = 0.93;
    ctx.fillStyle = g;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.clip();
    const pat = this.getHalftone(ctx);
    if (pat) {
      ctx.fillStyle = pat;
      ctx.fillRect(0, y - bandH, W, bandH * 2);
    }
    ctx.restore();
    // bordas brilhantes
    ctx.strokeStyle = c.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, y - bandH / 2 + 14 * dir);
    ctx.lineTo(W, y - bandH / 2 - 14 * dir);
    ctx.moveTo(0, y + bandH / 2 + 14 * dir);
    ctx.lineTo(W, y + bandH / 2 - 14 * dir);
    ctx.stroke();
    // retrato (a cabeça sai da faixa)
    const f = this.fighterByCall(c.name, c.team);
    const ps = bandH / 120;
    const px = dir === 1 ? W * 0.16 : W * 0.84;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y - bandH * 1.6, W, bandH * 1.6 + bandH / 2 - 4);
    ctx.clip();
    this.drawPortrait(ctx, f, 'point', px, y + bandH * 0.98, ps, dir, c.color);
    ctx.restore();
    // textos
    const fs = Math.min(bandH * 0.42, W * 0.075);
    const tx = dir === 1 ? W * 0.33 : W * 0.67;
    ctx.textAlign = dir === 1 ? 'left' : 'right';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.font = `${Math.round(fs * 0.42)}px ${FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#140a1c';
    ctx.strokeText(c.name.toUpperCase(), tx, y - fs * 0.62);
    ctx.fillText(c.name.toUpperCase(), tx, y - fs * 0.62);
    const pop = 1 + Math.max(0, 0.35 - c.t) * 1.6;
    ctx.save();
    ctx.translate(tx, y + fs * 0.18);
    ctx.scale(pop, pop);
    ctx.font = `${Math.round(fs)}px ${FONT}`;
    ctx.lineWidth = fs * 0.2;
    const label = `${c.move.toUpperCase()}!`;
    ctx.strokeText(label, 0, 0);
    const tg = ctx.createLinearGradient(0, -fs / 2, 0, fs / 2);
    tg.addColorStop(0, '#ffffff');
    tg.addColorStop(0.55, c.color);
    tg.addColorStop(1, c.color);
    ctx.fillStyle = tg;
    ctx.fillText(label, 0, 0);
    ctx.restore();
    ctx.restore();
  }

  private easeBack(t: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  /** Cut-in do super: ecrã escurece, faixa enorme com retrato a sair da moldura e nome gigante. */
  private drawCutIn(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    const c = this.fight.cutin!;
    const u = c.t / c.max;
    const dir = c.team === 0 ? 1 : -1;
    const inK = Math.min(1, c.t / 0.2);
    const outK = u > 0.85 ? (u - 0.85) / 0.15 : 0;
    const off = (1 - this.easeBack(inK)) * W + outK * outK * W * 1.2;
    const bandH = Math.min(H * 0.36, 260);
    const y = H * 0.46;
    ctx.save();
    ctx.globalAlpha = 0.6 * (1 - outK);
    ctx.fillStyle = '#05020c';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    // raios de fundo na cor do super
    ctx.save();
    ctx.translate(W / 2, y);
    ctx.rotate(this.fight.t * 0.6);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.18 * (1 - outK);
    ctx.fillStyle = c.color;
    for (let i = 0; i < 16; i++) {
      ctx.rotate((Math.PI * 2) / 16);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.max(W, H), -40);
      ctx.lineTo(Math.max(W, H), 40);
      ctx.fill();
    }
    ctx.restore();
    ctx.translate(-dir * off, 0);
    // faixa
    const top = y - bandH / 2;
    ctx.beginPath();
    ctx.moveTo(0, top + 36 * dir);
    ctx.lineTo(W, top - 36 * dir);
    ctx.lineTo(W, top + bandH - 36 * dir);
    ctx.lineTo(0, top + bandH + 36 * dir);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, dir === 1 ? TEAM_COLORS[c.team] : c.color);
    g.addColorStop(0.5, '#120724');
    g.addColorStop(1, dir === 1 ? c.color : TEAM_COLORS[c.team]);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    const pat = this.getHalftone(ctx);
    if (pat) {
      ctx.fillStyle = pat;
      ctx.fillRect(0, top - 60, W, bandH + 120);
    }
    // linhas de velocidade
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 22; i++) {
      const ly = top + hash(i) * bandH;
      const lx = ((hash(i + 3) * W + c.t * 2600 * dir) % (W + 300)) - 150;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx - 200 * dir, ly + 10);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, top + 36 * dir);
    ctx.lineTo(W, top - 36 * dir);
    ctx.moveTo(0, top + bandH + 36 * dir);
    ctx.lineTo(W, top + bandH - 36 * dir);
    ctx.stroke();
    // retrato grande: a cabeça e o punho saem por cima da faixa
    const f = this.fighterByCall(c.name, c.team);
    const ps = bandH / 150;
    const px = dir === 1 ? W * 0.2 : W * 0.8;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, top + bandH - 6 + 30);
    ctx.clip();
    this.drawPortrait(ctx, f, 'charge', px, top + bandH * 1.12, ps, dir, c.color);
    ctx.restore();
    // textos
    const fs = Math.min(bandH * 0.3, W * 0.085);
    const tx = dir === 1 ? W * 0.4 : W * 0.6;
    ctx.textAlign = dir === 1 ? 'left' : 'right';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    // etiqueta SUPER
    ctx.font = `${Math.round(fs * 0.45)}px ${FONT}`;
    const tag = 'SUPER ATAQUE';
    const tw = ctx.measureText(tag).width + 18;
    ctx.fillStyle = c.color;
    const tagX = dir === 1 ? tx : tx - tw;
    ctx.fillRect(tagX, y - fs * 1.25, tw, fs * 0.6);
    ctx.fillStyle = '#140a1c';
    ctx.fillText(tag, tx + (dir === 1 ? 9 : -9), y - fs * 0.95);
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#140a1c';
    ctx.font = `${Math.round(fs * 0.5)}px ${FONT}`;
    ctx.strokeText(c.name.toUpperCase(), tx, y - fs * 0.35);
    ctx.fillText(c.name.toUpperCase(), tx, y - fs * 0.35);
    const pop = 1 + Math.max(0, 0.4 - c.t) * 1.8;
    ctx.save();
    ctx.translate(tx, y + fs * 0.55);
    ctx.scale(pop, pop);
    ctx.rotate(-0.04 * dir);
    ctx.font = `${Math.round(fs * 1.15)}px ${FONT}`;
    ctx.lineWidth = fs * 0.24;
    ctx.strokeText(c.move.toUpperCase(), 0, 0);
    const tg = ctx.createLinearGradient(0, -fs * 0.6, 0, fs * 0.6);
    tg.addColorStop(0, '#ffffff');
    tg.addColorStop(0.5, c.color);
    tg.addColorStop(1, c.color);
    ctx.fillStyle = tg;
    ctx.fillText(c.move.toUpperCase(), 0, 0);
    ctx.restore();
    ctx.restore();
  }
}
