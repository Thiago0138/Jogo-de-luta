import { ITEMS } from '../data/items';
import { emptyTally, type Tally } from '../data/missions';
import { maxHp } from '../data/stats';
import { sfx, crowdLevel } from '../audio/sfx';
import { J_HEAD, J_NECK, J_HIP, clamp } from '../render/pose';
import { APRON_X, RING, newRopes, pushRope, updateRopes, type RopeState } from './arena';
import { Fighter, type FighterSpec, type Script, type Yield } from './fighter';
import { PK, Particles, type Banner, type Beam, type Bolt, type PopText, type Proj, type Wave } from './fx';

export type Mode = 'solo' | 'tag' | 'champion';

export interface FightSetup {
  mode: Mode;
  teams: [FighterSpec[], FighterSpec[]];
}

export interface FightReport {
  won: boolean;
  mode: Mode;
  tally: Tally;
  superKO: boolean;
  usedPotions: string[];
  minHp: number;
  duration: number;
  decision: boolean;
}

/** Um frame (para scripts que precisam de correr frame a frame). */
const FRAME = 1e-4;
const GRAV = 2200;
const WALK = 150;

type StrikeKind = 'punch' | 'kick' | 'grapple' | 'aerial' | 'ground' | 'super' | 'assist';

interface StrikeOpts {
  dmg: number;
  reach: number;
  kind: StrikeKind;
  heavy?: boolean;
  kd?: boolean;
  kb?: number;
  launch?: number;
  body?: boolean;
  ground?: boolean;
  unblockable?: boolean;
  color?: string;
  quiet?: boolean;
}

export interface CutIn {
  name: string;
  move: string;
  icon: string;
  color: string;
  team: 0 | 1;
  t: number;
  max: number;
}

const SUPER_COLORS: Record<string, string> = {
  supersoco: '#ffb31a',
  lariat: '#ff6a3d',
  relampago: '#7ad7ff',
  trovao: '#9be8ff',
  tornado: '#b6ffea',
  dragao: '#ff5a00',
  meteoro: '#ff7a1a',
  atomico: '#b6ff3d',
  cosmico: '#9b7aff',
  ira: '#fff2a8',
};

export class Fight {
  mode: Mode;
  fighters: Fighter[] = [];
  teams: [Fighter[], Fighter[]] = [[], []];
  active: [Fighter, Fighter];
  t = 0;
  clock = 99;
  dt = 0;
  timeScale = 1;
  slowT = 0;
  freeze = 0;
  phase: 'intro' | 'fight' | 'finish' | 'end' = 'intro';
  phaseT = 0;
  winner: 0 | 1 | null = null;
  hype = 0.2;
  ropes: RopeState = newRopes();
  parts = new Particles();
  pops: PopText[] = [];
  banners: Banner[] = [];
  bolts: Bolt[] = [];
  beams: Beam[] = [];
  waves: Wave[] = [];
  projs: Proj[] = [];
  cutin: CutIn | null = null;
  shakeT = 0;
  shakeAmp = 0;
  flash = 0;
  flashColor = '#ffffff';
  darken = 0;
  darkenTarget = 0;
  cosmic = 0;
  focus: Fighter | null = null;
  focusT = 0;
  zoomPunch = 0;
  tally: Tally = emptyTally();
  usedPotions: string[] = [];
  superKO = false;
  decision = false;
  onEnd: ((r: FightReport) => void) | null = null;
  private ended = false;

  constructor(setup: FightSetup) {
    this.mode = setup.mode;
    setup.teams.forEach((specs, ti) => {
      specs.forEach((spec, si) => {
        const hp = maxHp(spec.level, spec.stats.vit) * (setup.mode === 'tag' ? 0.5 : 1) * (spec.hpMul ?? 1);
        const f = new Fighter(spec, ti as 0 | 1, ti * 2 + si, Math.round(hp));
        const side = ti === 0 ? -1 : 1;
        if (si === 0) {
          f.x = side * (RING - 30);
          f.facing = ti === 0 ? 1 : -1;
          f.run(this.introWalk(f, side * 210));
        } else {
          f.x = side * APRON_X;
          f.facing = ti === 0 ? 1 : -1;
          f.setState('apron');
          f.play('apron');
        }
        if (f.has('p_bencao')) f.meter = 50;
        this.fighters.push(f);
        this.teams[ti].push(f);
      });
    });
    this.active = [this.teams[0][0], this.teams[1][0]];
    if (this.mode === 'tag') this.clock = 120;
  }

  private *introWalk(f: Fighter, tx: number): Script {
    yield 0.3;
    f.play('walk');
    while (Math.abs(f.x - tx) > 6) {
      f.vx = Math.sign(tx - f.x) * 190;
      yield FRAME;
    }
    f.vx = 0;
    f.play('taunt', 1.3);
    yield 0.9;
    f.play('guard');
  }

  // ───────────────────────── Utilitários ─────────────────────────

  opp(f: Fighter): Fighter {
    return this.active[f.team === 0 ? 1 : 0];
  }

  partner(f: Fighter): Fighter | null {
    return this.teams[f.team].find((p) => p !== f && p.state === 'apron') ?? null;
  }

  spd(f: Fighter): number {
    let s = 1 + f.s.vel * 0.006;
    if (f.has('p_maos')) s += 0.12;
    if (f.speedT > 0) s += 0.25;
    return s;
  }

  scale(f: Fighter): number {
    return f.spec.look.height;
  }

  /** Posição da anca no mundo. */
  hipY(f: Fighter): number {
    if (f.override) return f.override.y;
    return -f.z - f.skel.minY * this.scale(f);
  }

  hipX(f: Fighter): number {
    return f.override ? f.override.x : f.x;
  }

  jx(f: Fighter, j: number): number {
    return this.hipX(f) + f.facing * f.skel.x[j] * this.scale(f);
  }

  jy(f: Fighter, j: number): number {
    return this.hipY(f) + f.skel.y[j] * this.scale(f);
  }

  shake(amp: number, t = 0.25): void {
    this.shakeAmp = Math.max(this.shakeAmp, amp);
    this.shakeT = Math.max(this.shakeT, t);
  }

  pop(text: string, x: number, y: number, color = '#fff', size = 28): void {
    if (this.pops.length > 24) this.pops.shift();
    this.pops.push({ text, x: x + (Math.random() - 0.5) * 20, y, vy: -90, life: 1, max: 1, color, size });
  }

  banner(text: string, sub = '', color = '#ffd23d', life = 1.4, size = 1): void {
    this.banners.push({ text, sub, life, max: life, color, size });
    if (this.banners.length > 3) this.banners.shift();
  }

  addHype(v: number): void {
    this.hype = clamp(this.hype + v, 0, 1);
  }

  slowmo(scale: number, t: number): void {
    this.timeScale = scale;
    this.slowT = t;
  }

  sparks(x: number, y: number, n: number, color: string, speed = 500, kind: PK = PK.Spark): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.6);
      this.parts.spawn(kind, x, y, Math.cos(a) * v, Math.sin(a) * v - 100, 0.25 + Math.random() * 0.3, 2.5, color, 900);
    }
  }

  dust(x: number, n = 8, spread = 60): void {
    for (let i = 0; i < n; i++) {
      this.parts.spawn(PK.Dust, x + (Math.random() - 0.5) * spread, -4, (Math.random() - 0.5) * 260, -Math.random() * 90, 0.6 + Math.random() * 0.4, 10 + Math.random() * 10, '#d8d0e8', 0);
    }
  }

  wave(x: number, y: number, r: number, color: string, life = 0.5): void {
    this.waves.push({ x, y, r: 10, vr: r / life, life, max: life, color });
  }

  // ───────────────────────── Ciclo principal ─────────────────────────

  update(rawDt: number): void {
    if (this.freeze > 0) {
      this.freeze -= rawDt;
      this.updateCamFx(rawDt);
      return;
    }
    if (this.cutin) {
      this.cutin.t += rawDt;
      if (this.cutin.t >= this.cutin.max) this.cutin = null;
      this.updateCamFx(rawDt);
      this.parts.update(rawDt * 0.1);
      return;
    }
    if (this.slowT > 0) {
      this.slowT -= rawDt;
      if (this.slowT <= 0) this.timeScale = 1;
    }
    const dt = rawDt * this.timeScale;
    this.dt = dt;
    this.t += dt;
    this.phaseT += dt;

    if (this.phase === 'intro' && this.phaseT > 0.1 && this.phaseT - dt <= 0.1) {
      this.banner('PREPARAR...', this.mode === 'tag' ? 'TAG TEAM' : this.mode === 'champion' ? 'DESAFIO DO CAMPEÃO' : 'COMBATE', '#ffffff', 1.1);
    }
    if (this.phase === 'intro' && this.phaseT > 1.6) {
      this.phase = 'fight';
      this.phaseT = 0;
      this.banner('LUTEM!', '', '#ffd23d', 1.0, 1.3);
      sfx.bell();
      sfx.cheer(1);
      this.addHype(0.3);
      for (const f of this.active) {
        f.stop();
        f.vx = 0;
        f.setState('idle');
        f.play('guard');
        f.thinkT = 0.2 + Math.random() * 0.4;
      }
    }
    if (this.phase === 'fight') {
      this.clock -= dt;
      if (this.clock <= 0) this.timeUp();
    }
    if (this.phase === 'finish' || this.phase === 'end') {
      if (this.phase === 'end' && !this.ended && this.phaseT > 2.6) this.finish();
    }

    for (const f of this.fighters) this.updateFighter(f, dt);
    if (this.darkenTarget > 0 && !this.fighters.some((f) => f.glow)) this.darkenTarget = 0;
    this.resolveOverlap();
    updateRopes(this.ropes, dt);
    this.hype = Math.max(0.15, this.hype - dt * 0.03);
    crowdLevel(this.hype);
    this.updateFx(dt);
    this.updateCamFx(rawDt);
  }

  private updateCamFx(rawDt: number): void {
    if (this.shakeT > 0) {
      this.shakeT -= rawDt;
      if (this.shakeT <= 0) this.shakeAmp = 0;
    }
    this.flash = Math.max(0, this.flash - rawDt * 3);
    this.darken += (this.darkenTarget - this.darken) * Math.min(1, rawDt * 6);
    this.zoomPunch = Math.max(0, this.zoomPunch - rawDt * 1.5);
    if (this.focusT > 0) {
      this.focusT -= rawDt;
      if (this.focusT <= 0) this.focus = null;
    }
    for (const b of this.banners) b.life -= rawDt;
    this.banners = this.banners.filter((b) => b.life > 0);
  }

  private updateFx(dt: number): void {
    this.parts.update(dt);
    for (const p of this.pops) {
      p.life -= dt;
      p.y += p.vy * dt;
      p.vy *= 0.94;
    }
    this.pops = this.pops.filter((p) => p.life > 0);
    for (const b of this.bolts) b.life -= dt;
    this.bolts = this.bolts.filter((b) => b.life > 0);
    for (const b of this.beams) b.life -= dt;
    this.beams = this.beams.filter((b) => b.life > 0);
    for (const w of this.waves) {
      w.life -= dt;
      w.r += w.vr * dt;
    }
    this.waves = this.waves.filter((w) => w.life > 0);
    for (const p of this.projs) {
      p.life -= dt;
      p.x += p.vx * dt;
      if (Math.random() < 0.8) {
        this.parts.spawn(PK.Ember, p.x - p.dir * 30, p.y + (Math.random() - 0.5) * 40, -p.dir * 100, (Math.random() - 0.5) * 80, 0.5, 24, p.color, -100);
      }
    }
    this.projs = this.projs.filter((p) => p.life > 0);
    if (this.cosmic > 0 && this.darkenTarget === 0) this.cosmic = Math.max(0, this.cosmic - dt * 1.5);
  }

  private updateFighter(f: Fighter, dt: number): void {
    f.stateT += dt;
    if (f.state === 'apron') {
      this.updateApron(f, dt);
      f.animate(dt, this.t);
      return;
    }
    if (f.state === 'out') {
      f.animate(dt, this.t);
      return;
    }
    if (f.furyT > 0) f.furyT -= dt;
    if (f.ironT > 0) f.ironT -= dt;
    if (f.speedT > 0) f.speedT -= dt;
    if (f.diveCd > 0) f.diveCd -= dt;
    if (f.tauntCd > 0) f.tauntCd -= dt;
    if (f.tagCooldown > 0) f.tagCooldown -= dt;
    if (f.comboT > 0) {
      f.comboT -= dt;
      if (f.comboT <= 0) f.combo = 0;
    }
    if (f.has('p_bencao') && f.hp > 0 && f.state !== 'ko') f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.01 * dt);
    if (f.evadeT > 0) {
      f.evadeT -= dt;
      if (f.evadeT <= 0) f.evade = 'none';
    }

    if (f.script) this.runScript(f, dt);
    else if (this.phase === 'fight') {
      switch (f.state) {
        case 'idle':
        case 'act':
          if (f.state === 'act') f.setState('idle');
          this.think(f, dt);
          break;
        case 'hit':
          if (f.stateT > 0.32) {
            f.setState('idle');
            f.play('guard');
          }
          break;
        case 'down':
          f.downT -= dt;
          if (f.downT <= 0 && f.hp > 0) f.run(this.getUp(f));
          break;
      }
    } else if (f.state === 'down') {
      f.downT -= dt;
    }

    // física
    if (!f.override) {
      f.x += f.vx * dt;
      if (f.z > 0 || f.vz > 0) {
        f.vz -= GRAV * dt;
        f.z += f.vz * dt;
        if (f.z <= 0) {
          f.z = 0;
          f.vz = 0;
        }
      }
      if (!f.script && f.state !== 'idle') f.vx *= Math.pow(0.02, dt);
      const lim = RING - 10;
      if (Math.abs(f.x) > lim && !f.noClamp) {
        const side = f.x > 0 ? 1 : 0;
        if (Math.abs(f.vx) > 260) {
          pushRope(this.ropes, side as 0 | 1, f.vx * 0.5);
          if (!f.script) {
            f.vx = -f.vx * 0.55;
            sfx.whoosh();
          }
        }
        f.x = Math.sign(f.x) * lim;
      }
    }
    if (f.spinRate !== 0) f.spinAng += f.spinRate * dt;
    f.animate(dt, this.t, (f.override ? f.override.rot : 0) + f.spinAng);
  }

  private runScript(f: Fighter, dt: number): void {
    const s = this.spd(f);
    if (typeof f.wait === 'number') {
      f.wait -= dt * s;
      if (f.wait > 0) return;
    } else if (!f.wait()) return;
    for (let guard = 0; guard < 50; guard++) {
      const gen = f.script;
      if (!gen) return;
      const r = gen.next();
      if (f.script !== gen) return; // o script foi substituído durante a execução
      if (r.done) {
        f.script = null;
        f.armor = false;
        f.glow = null;
        if (f.state === 'act') {
          f.setState('idle');
          f.play('guard');
        }
        f.thinkT = Math.max(f.thinkT, 0.08);
        return;
      }
      f.wait = r.value as Yield;
      if (typeof f.wait === 'number') {
        if (f.wait > 0) return;
      } else if (!f.wait()) return;
    }
  }

  private resolveOverlap(): void {
    const [a, b] = this.active;
    if (!a || !b) return;
    if (a.state === 'down' || b.state === 'down' || a.override || b.override || a.z > 20 || b.z > 20) return;
    if (a.state === 'ko' || b.state === 'ko' || a.state === 'out' || b.state === 'out') return;
    const min = 46;
    const d = b.x - a.x;
    if (Math.abs(d) < min) {
      const push = (min - Math.abs(d)) / 2;
      const s = d >= 0 ? 1 : -1;
      a.x -= s * push;
      b.x += s * push;
    }
  }

  private timeUp(): void {
    if (this.phase !== 'fight') return;
    const score = (ti: number) => this.teams[ti].reduce((s, f) => s + Math.max(0, f.hp) / f.maxHp, 0);
    const w: 0 | 1 = score(0) >= score(1) ? 0 : 1;
    this.decision = true;
    this.banner('TEMPO!', 'Decisão dos juízes', '#ffffff', 1.6);
    sfx.bell();
    this.declareWinner(w, null);
  }

  // ───────────────────────── Avental (tag team) ─────────────────────────

  private updateApron(f: Fighter, dt: number): void {
    f.face(0);
    if (f.hp < f.maxHp) f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.012 * dt);
    if (f.script) {
      this.runScript(f, dt);
      if (!f.script && f.state === 'apron') f.play('apron', 1, false);
      return;
    }
    if (this.phase !== 'fight') return;
    f.assistCd -= dt;
    const o = this.opp(f);
    if (o && f.assistCd <= 0 && o.state !== 'down' && o.state !== 'ko' && Math.abs(o.x - f.x) < 150 && Math.random() < 0.02) {
      f.assistCd = 9;
      f.run(this.assist(f, o));
      f.state = 'apron';
    }
  }

  private *assist(f: Fighter, o: Fighter): Script {
    f.play('jab', 1.2);
    yield 0.15;
    this.strike(f, o, { dmg: 9, reach: 170, kind: 'assist' });
    yield 0.3;
    f.play('apron');
  }

  // ───────────────────────── IA ─────────────────────────

  private think(f: Fighter, dt: number): void {
    const o = this.opp(f);
    if (!o || o.state === 'ko' || o.state === 'out' || o.state === 'apron') {
      f.vx = 0;
      f.play('guard', 1, false);
      return;
    }
    f.face(o);
    const dist = Math.abs(o.x - f.x);
    f.thinkT -= dt * this.spd(f);
    if (f.thinkT > 0) {
      this.idleMove(f, o, dist);
      return;
    }
    f.thinkT = 0.06 + Math.random() * 0.18;
    f.vx = 0;
    const r = Math.random();

    if (this.tryPotion(f)) return;
    if (this.mode === 'tag' && this.tryTag(f)) return;

    if (f.meter >= 100 && o.state !== 'down' && o.state !== 'thrown' && o.z < 10 && Math.random() < 0.8) {
      const sup = f.spec.supers[Math.floor(Math.random() * f.spec.supers.length)] ?? 's_supersoco';
      f.run(this.superMove(f, o, sup), true);
      return;
    }

    if (o.state === 'down') {
      if (o.downT > 1.4 && f.diveCd <= 0 && r < 0.4 + f.s.esq * 0.004) {
        f.run(this.topRopeDive(f, o));
        return;
      }
      if (f.tauntCd <= 0 && r < 0.6 && f.meter < 100) {
        f.run(this.taunt(f));
        return;
      }
      if (dist < 100) {
        f.run(Math.random() < 0.5 ? this.stomp(f, o) : this.elbowDrop(f, o));
        return;
      }
      f.wantX = o.x - f.facing * 80;
      return;
    }

    if (dist > 250) {
      const behind = f.facing === 1 ? f.x + RING : RING - f.x;
      if (r < 0.2 && behind > 220) f.run(this.ropeRun(f, o));
      else if (r < 0.32 && dist < 330) f.run(this.dropkick(f, o));
      else f.wantX = o.x - f.facing * 80;
      return;
    }
    if (dist > 100) {
      if (r < 0.12) f.run(this.dropkick(f, o));
      else if (r < 0.2 && f.tauntCd <= 0 && f.s.car > 15) f.run(this.taunt(f));
      else f.wantX = o.x - f.facing * (70 + Math.random() * 15);
      return;
    }
    // ao alcance
    const st = f.s;
    const stunned = o.state === 'hit';
    const opts: [number, () => Script][] = [
      [3 + st.vel * 0.04, () => this.combo(f, o)],
      [2 + st.for * 0.03 + (stunned ? 2 : 0), () => this.heavy(f, o)],
      [dist < 85 ? 1.4 + st.agr * 0.05 + (stunned ? 1.5 : 0) : 0, () => this.grapple(f, o)],
      [dist < 85 ? 0.6 + st.agr * 0.02 : 0, () => this.irishWhip(f, o)],
      [0.7, () => this.stepBack(f)],
    ];
    let tot = 0;
    for (const [w] of opts) tot += w;
    let x = Math.random() * tot;
    for (const [w, fn] of opts) {
      x -= w;
      if (x <= 0) {
        f.run(fn());
        return;
      }
    }
  }

  private idleMove(f: Fighter, o: Fighter, dist: number): void {
    if (f.wantX == null) {
      // movimento leve de boxe
      if (dist < 60) f.wantX = f.x - f.facing * 30;
      else {
        f.vx = 0;
        f.play('guard', 1, false);
        return;
      }
    }
    const d = f.wantX - f.x;
    if (Math.abs(d) < 8 || Math.abs(f.x) >= RING - 12 && Math.sign(d) === Math.sign(f.x)) {
      f.wantX = null;
      f.vx = 0;
      f.play('guard', 1, false);
      return;
    }
    const sp = WALK * (0.8 + this.spd(f) * 0.4);
    f.vx = Math.sign(d) * sp;
    f.play(Math.sign(d) === f.facing ? 'walk' : 'walkBack', 1, false);
  }

  // ───────────────────────── Defesa ─────────────────────────

  /** Decide se o defensor esquiva/bloqueia um golpe que vai chegar. */
  private telegraph(att: Fighter, def: Fighter, kind: StrikeKind, high: boolean): void {
    if (def.state !== 'idle' || def.script || def.z > 0 || kind === 'super') return;
    const esq = clamp(0.04 + def.s.esq * 0.0042 - att.s.vel * 0.0012, 0.02, 0.42);
    let blk = clamp(0.06 + def.s.def * 0.0036, 0.03, 0.4);
    if (def.has('p_muralha')) blk += 0.15;
    const r = Math.random();
    if (r < esq) {
      def.evade = 'dodge';
      def.evadeT = 0.5;
      def.run(this.dodge(def, att, high));
    } else if (r < esq + blk && kind !== 'grapple' && kind !== 'aerial') {
      def.evade = 'block';
      def.evadeT = 0.5;
      def.run(this.block(def, att));
    }
  }

  private *dodge(f: Fighter, att: Fighter, high: boolean): Script {
    f.play(high && Math.random() < 0.6 ? 'duck' : 'sway', 1.1);
    f.vx = -f.facing * 40;
    yield 0.4;
    f.vx = 0;
    if (Math.random() < 0.12 + f.s.ctr * 0.006 && att.state !== 'down') {
      yield* this.counter(f, att);
    }
  }

  private *block(f: Fighter, att: Fighter): Script {
    f.play('block');
    yield 0.4;
    if (Math.random() < 0.08 + f.s.ctr * 0.005 && att.state !== 'down') {
      yield* this.counter(f, att);
    }
  }

  private *counter(f: Fighter, o: Fighter): Script {
    f.face(o);
    if (f.spec.isPlayer) this.tally.counters++;
    this.pop('CONTRA!', f.x, this.jy(f, J_HEAD) - 40, '#7ad7ff', 30);
    f.play('hook', 1.4);
    yield 0.2;
    const bonus = f.has('p_muralha') ? 1.4 : 1;
    this.strike(f, o, { dmg: 18 * bonus, reach: 120, kind: 'punch', heavy: true, kb: 160, unblockable: true });
    yield 0.25;
  }

  // ───────────────────────── Golpes ─────────────────────────

  private *combo(f: Fighter, o: Fighter): Script {
    const n = 2 + Math.floor(Math.random() * (2 + f.s.vel / 25));
    const seq: ('jab' | 'cross' | 'hook' | 'body')[] = ['jab', 'cross', 'jab', 'hook', 'body', 'cross'];
    const start = Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const m = seq[(start + i) % seq.length];
      if (Math.abs(o.x - f.x) > 110) {
        f.vx = f.facing * 220;
        yield 0.1;
        f.vx = 0;
      }
      f.face(o);
      f.play(m);
      const hit = m === 'jab' ? 0.14 : m === 'cross' ? 0.18 : m === 'hook' ? 0.23 : 0.2;
      this.telegraph(f, o, 'punch', m !== 'body');
      f.vx = f.facing * 60;
      yield hit;
      f.vx = 0;
      const dmg = m === 'jab' ? 8 : m === 'cross' ? 11 : m === 'hook' ? 15 : 12;
      const landed = this.strike(f, o, { dmg, reach: m === 'jab' || m === 'cross' ? 108 : 96, kind: 'punch', body: m === 'body', kb: m === 'hook' ? 120 : 70 });
      yield m === 'jab' ? 0.12 : 0.2;
      if (!landed || o.state === 'down' || o.state === 'ko') break;
    }
    yield 0.12;
  }

  private *heavy(f: Fighter, o: Fighter): Script {
    const r = Math.random();
    if (r < 0.32) {
      f.play('upper');
      this.telegraph(f, o, 'punch', true);
      yield 0.27;
      this.strike(f, o, { dmg: 22, reach: 95, kind: 'punch', heavy: true, kd: Math.random() < 0.35, launch: 380, kb: 140 });
      yield 0.4;
    } else if (r < 0.55) {
      f.play('hook');
      this.telegraph(f, o, 'punch', true);
      yield 0.23;
      this.strike(f, o, { dmg: 17, reach: 100, kind: 'punch', heavy: true, kb: 200, kd: Math.random() < 0.2 });
      yield 0.3;
    } else if (r < 0.78) {
      f.play('kick');
      this.telegraph(f, o, 'kick', false);
      yield 0.26;
      this.strike(f, o, { dmg: 19, reach: 125, kind: 'kick', heavy: true, kb: 320, body: true, kd: Math.random() < 0.22 });
      yield 0.38;
    } else {
      f.play('body');
      this.telegraph(f, o, 'punch', false);
      yield 0.2;
      this.strike(f, o, { dmg: 14, reach: 95, kind: 'punch', body: true, kb: 90 });
      yield 0.12;
      f.play('upper', 1.2);
      yield 0.22;
      this.strike(f, o, { dmg: 18, reach: 95, kind: 'punch', heavy: true, kd: Math.random() < 0.5, launch: 300, kb: 120 });
      yield 0.35;
    }
  }

  private *stepBack(f: Fighter): Script {
    f.play('walkBack');
    f.vx = -f.facing * 170;
    yield 0.32;
    f.vx = 0;
    f.play('guard');
    yield 0.15;
  }

  private canGrab(o: Fighter): boolean {
    return (o.state === 'idle' || o.state === 'hit' || (o.state === 'act' && !o.armor)) && o.z < 5 && !o.override;
  }

  private *grapple(f: Fighter, o: Fighter): Script {
    f.play('grab');
    this.telegraph(f, o, 'grapple', false);
    f.vx = f.facing * 120;
    yield 0.16;
    f.vx = 0;
    if (Math.abs(o.x - f.x) > 95 || !this.canGrab(o) || o.evade === 'dodge') {
      f.play('guard');
      yield 0.25;
      return;
    }
    // tentativa de fuga
    const escape = clamp(0.1 + (o.s.agr + o.s.esq) * 0.002 - f.s.agr * 0.003, 0.04, 0.35);
    if (Math.random() < escape) {
      o.stop();
      this.pop('ESCAPOU!', o.x, this.jy(o, J_HEAD) - 40, '#5ef0c0', 26);
      o.run(this.pushAway(o, f));
      f.vx = -f.facing * 200;
      yield 0.3;
      f.vx = 0;
      return;
    }
    if (f.spec.isPlayer) this.tally.grapples++;
    const type = Math.random();
    if (type < 0.4) yield* this.suplex(f, o, 1, false);
    else if (type < 0.75) yield* this.bodySlam(f, o, 1);
    else yield* this.ddt(f, o);
  }

  private *pushAway(f: Fighter, o: Fighter): Script {
    f.play('cross', 1.2);
    yield 0.18;
    this.strike(f, o, { dmg: 6, reach: 110, kind: 'punch', kb: 220, quiet: true, unblockable: true });
    yield 0.25;
  }

  private lock(f: Fighter, o: Fighter): void {
    f.holding = o;
    o.stop();
    o.setState('thrown');
    o.evade = 'none';
    o.vx = 0;
    o.vz = 0;
    o.z = 0;
  }

  /** Tween do defensor preso nas mãos do atacante. */
  private *carry(f: Fighter, o: Fighter, dur: number, from: [number, number, number], to: [number, number, number], ease = (t: number) => t): Script {
    let t = 0;
    while (t < dur) {
      t += this.dt * this.spd(f);
      const u = ease(clamp(t / dur, 0, 1));
      const bx = f.x;
      const by = -f.z - 90 * this.scale(f);
      o.override = {
        x: bx + f.facing * (from[0] + (to[0] - from[0]) * u),
        y: by + from[1] + (to[1] - from[1]) * u,
        rot: (from[2] + (to[2] - from[2]) * u) * f.facing,
      };
      yield FRAME;
    }
  }

  private land(o: Fighter, x: number, dmgOwner: Fighter, dmg: number, kind: StrikeKind, big: number): void {
    dmgOwner.holding = null;
    o.override = null;
    o.x = clamp(x, -RING + 20, RING - 20);
    o.z = 0;
    o.facing = (o.x < dmgOwner.x ? 1 : -1) as 1 | -1;
    o.setState('hit');
    this.strike(dmgOwner, o, { dmg, reach: 9999, kind, heavy: true, kd: true, unblockable: true, kb: 0, launch: 90, ground: true });
    this.shake(8 + big * 6, 0.3 + big * 0.1);
    this.dust(o.x, 10 + big * 8, 90);
    this.parts.spawn(PK.Ring, o.x, 0, 0, 0, 0.45, 140 + big * 80, '#ffffff', 0);
    sfx.thud();
    this.addHype(0.1 + big * 0.1);
  }

  private *suplex(f: Fighter, o: Fighter, power: number, atomic: boolean): Script {
    this.lock(f, o);
    o.play('hitBody');
    f.play('lift', 1);
    yield* this.carry(f, o, 0.35, [45, 30, 0], [10, -60, -2.4], (t) => t * t);
    f.play('arch');
    yield* this.carry(f, o, 0.22, [10, -60, -2.4], [-60, 45, -3.6]);
    o.play('lieKO');
    this.land(o, f.x - f.facing * 75, f, 30 * power, 'grapple', atomic ? 3 : 1);
    this.pop(atomic ? 'SUPLEX ATÓMICO!' : 'SUPLEX!', f.x, -230, '#ffb31a', 30);
    yield 0.45;
    f.play('archUp');
    yield 0.6;
  }

  private *bodySlam(f: Fighter, o: Fighter, power: number): Script {
    this.lock(f, o);
    o.play('hitBody');
    f.play('lift', 0.9);
    yield* this.carry(f, o, 0.4, [40, 30, 0], [0, -85, -1.57]);
    yield 0.18;
    f.play('slam');
    yield* this.carry(f, o, 0.16, [0, -85, -1.57], [70, 55, -1.57], (t) => t * t);
    o.play('lieKO');
    this.land(o, f.x + f.facing * 75, f, 26 * power, 'grapple', 1);
    this.pop('SLAM!', f.x, -230, '#ff8a3d', 30);
    yield 0.6;
  }

  private *ddt(f: Fighter, o: Fighter): Script {
    this.lock(f, o);
    o.play('hitBody');
    f.play('grab');
    yield* this.carry(f, o, 0.2, [40, 30, 0], [35, 20, 1.3]);
    f.play('fall');
    f.vx = 0;
    yield* this.carry(f, o, 0.2, [35, 20, 1.3], [40, 60, 2.6], (t) => t * t);
    o.play('lieKO');
    this.land(o, f.x + f.facing * 55, f, 24, 'grapple', 1);
    this.pop('DDT!', f.x, -230, '#ff8a3d', 30);
    this.selfDown(f, 0.5);
  }

  private *irishWhip(f: Fighter, o: Fighter): Script {
    f.play('grab');
    yield 0.14;
    if (Math.abs(o.x - f.x) > 95 || !this.canGrab(o)) {
      f.play('guard');
      yield 0.2;
      return;
    }
    if (f.spec.isPlayer) this.tally.grapples++;
    this.lock(f, o);
    o.setState('act');
    const dir = f.facing;
    f.play('cross', 0.8);
    this.pop('PARA AS CORDAS!', o.x, -220, '#ffffff', 22);
    // o defensor corre para as cordas e volta
    o.run(this.whipped(o, dir));
    yield 0.3;
    f.play('guard');
    f.face(o);
    yield () => o.vx * dir < 0 || o.state !== 'act';
    // espera que esteja perto
    let tries = 0;
    while (o.state === 'act' && Math.abs(o.x - f.x) > 110 && tries++ < 200) yield FRAME;
    if (o.state !== 'act') return;
    const r = Math.random();
    if (r < 0.4) {
      f.play('clothes');
      yield 0.06;
      this.strike(f, o, { dmg: 24, reach: 120, kind: 'punch', heavy: true, kd: true, unblockable: true, kb: 60 });
      this.pop('CLOTHESLINE!', f.x, -230, '#ff6a3d', 28);
      yield 0.4;
    } else if (r < 0.7) {
      f.play('kick');
      yield 0.2;
      this.strike(f, o, { dmg: 22, reach: 140, kind: 'kick', heavy: true, kd: true, unblockable: true, kb: 160 });
      this.pop('BIG BOOT!', f.x, -230, '#ff6a3d', 28);
      yield 0.45;
    } else {
      // spinebuster
      o.stop();
      yield* this.bodySlam(f, o, 1.1);
    }
  }

  private *whipped(o: Fighter, dir: number): Script {
    o.play('run');
    o.facing = dir as 1 | -1;
    o.vx = dir * 520;
    yield () => Math.abs(o.x) >= RING - 12;
    pushRope(this.ropes, o.x > 0 ? 1 : 0, dir * 600);
    sfx.whoosh();
    o.facing = -dir as 1 | -1;
    o.vx = -dir * 520;
    yield 1.4;
    o.vx = 0;
    o.play('guard');
  }

  private *ropeRun(f: Fighter, o: Fighter): Script {
    const away = -f.facing;
    f.facing = away as 1 | -1;
    f.play('run');
    f.vx = away * 480;
    yield () => Math.abs(f.x) >= RING - 14;
    pushRope(this.ropes, f.x > 0 ? 1 : 0, away * 700);
    sfx.whoosh();
    f.facing = -away as 1 | -1;
    f.vx = -away * 560;
    this.addHype(0.05);
    let t = 0;
    while (Math.abs(o.x - f.x) > 120 && t < 1.6) {
      t += this.dt;
      yield FRAME;
    }
    if (o.state === 'down' || o.state === 'ko') {
      f.vx = 0;
      return;
    }
    f.play('clothes');
    this.telegraph(f, o, 'punch', true);
    yield 0.05;
    const landed = this.strike(f, o, { dmg: 26, reach: 120, kind: 'punch', heavy: true, kd: true, kb: 100 });
    if (landed) this.pop('LARIAT!', f.x, -230, '#ff6a3d', 28);
    yield 0.25;
    f.vx = 0;
    f.play('guard');
    yield 0.2;
  }

  private *dropkick(f: Fighter, o: Fighter): Script {
    f.play('run');
    f.vx = f.facing * 380;
    while (Math.abs(o.x - f.x) > 210) yield FRAME;
    f.play('dropkick');
    f.vz = 560;
    f.z = 1;
    f.vx = f.facing * 460;
    this.telegraph(f, o, 'kick', true);
    sfx.whoosh();
    let hit = false;
    while (f.z > 0) {
      if (!hit && Math.abs(o.x - f.x) < 95 && f.z > 10) {
        hit = this.strike(f, o, { dmg: 22, reach: 100, kind: 'kick', heavy: true, kd: Math.random() < 0.7, kb: 380 });
        if (hit) this.pop('DROPKICK!', f.x, -240, '#ffd23d', 28);
        f.vx *= 0.2;
        hit = true;
      }
      yield FRAME;
    }
    f.vx = 0;
    f.play('lie');
    this.dust(f.x, 6);
    sfx.thud();
    this.selfDown(f, 0.45);
  }

  private *stomp(f: Fighter, o: Fighter): Script {
    f.face(o);
    while (Math.abs(o.x - f.x) > 60 && o.state === 'down') {
      f.vx = Math.sign(o.x - f.x) * 160;
      f.play('walk', 1, false);
      yield FRAME;
    }
    f.vx = 0;
    for (let i = 0; i < 2; i++) {
      f.play('stomp');
      yield 0.24;
      this.strike(f, o, { dmg: 8, reach: 90, kind: 'ground', ground: true, kb: 0 });
      yield 0.18;
      if (o.state !== 'down') break;
    }
  }

  private *elbowDrop(f: Fighter, o: Fighter): Script {
    f.face(o);
    f.play('tuck');
    f.vz = 650;
    f.z = 1;
    f.vx = (o.x - f.x) * 1.3;
    yield 0.3;
    f.play('elbow');
    while (f.z > 0) yield FRAME;
    f.vx = 0;
    if (o.state === 'down' && Math.abs(o.x - f.x) < 80) {
      this.strike(f, o, { dmg: 18, reach: 100, kind: 'aerial', ground: true, kb: 0, heavy: true });
      this.pop('COTOVELADA!', f.x, -200, '#ffd23d', 26);
    } else {
      sfx.thud();
      this.pop('FALHOU!', f.x, -180, '#aaaaaa', 24);
      this.damage(f, 8);
    }
    this.dust(f.x, 8);
    this.selfDown(f, 0.35);
  }

  private *topRopeDive(f: Fighter, o: Fighter): Script {
    f.diveCd = 6;
    // escolhe o canto mais próximo atrás de si (para mergulhar na direção do adversário)
    const side = o.x > f.x ? -1 : 1;
    const cornerX = side * (RING - 20);
    f.facing = side as 1 | -1;
    f.play('run');
    while (Math.abs(cornerX - f.x) > 12) {
      f.vx = Math.sign(cornerX - f.x) * 420;
      if (o.state !== 'down') {
        f.vx = 0;
        return;
      }
      yield FRAME;
    }
    f.vx = 0;
    f.x = cornerX;
    f.face(o);
    f.play('perch');
    // sobe ao canto
    const climb = 0.45;
    let t = 0;
    while (t < climb) {
      t += this.dt;
      f.z = (t / climb) * 120;
      yield FRAME;
    }
    f.z = 120;
    this.pop('À CORDA DE CIMA!', f.x, -330, '#ffffff', 22);
    this.addHype(0.2);
    sfx.cheer(0.8);
    this.focus = f;
    this.focusT = 1.3;
    yield 0.35;
    if (o.state !== 'down') {
      f.play('tuck');
      f.vz = 300;
      f.vx = -side * 120;
      while (f.z > 0) yield FRAME;
      f.play('guard');
      return;
    }
    // esquiva rolando?
    const roll = Math.random() < clamp(0.08 + o.s.esq * 0.004, 0.05, 0.35);
    const moon = Math.random() < 0.5;
    const T = 0.7;
    const target = o.x;
    f.vx = (target - f.x) / T;
    f.vz = (0 - 120 + 0.5 * GRAV * T * T) / T;
    f.play(moon ? 'tuck' : 'splash');
    sfx.whoosh();
    if (roll) o.run(this.rollAway(o, f));
    let el = 0;
    while (f.z > 0 || el < 0.1) {
      el += this.dt;
      if (moon) f.spinAng = -Math.min(1, el / T) * Math.PI * 2;
      yield FRAME;
    }
    f.spinAng = 0;
    f.vx = 0;
    f.play('lie');
    if (o.state === 'down' && Math.abs(o.x - f.x) < 90) {
      if (f.spec.isPlayer) this.tally.dives++;
      this.strike(f, o, { dmg: 40, reach: 999, kind: 'aerial', ground: true, heavy: true, kb: 0, unblockable: true });
      this.pop(moon ? 'MOONSAULT!' : 'SPLASH!', f.x, -240, '#ffd23d', 34);
      this.shake(14, 0.4);
      this.slowmo(0.35, 0.35);
      this.addHype(0.35);
      sfx.cheer(1.2);
    } else {
      this.pop('FALHOU!', f.x, -200, '#aaaaaa', 30);
      this.damage(f, 22);
      this.shake(8, 0.3);
      sfx.thud();
    }
    this.dust(f.x, 14, 100);
    this.selfDown(f, 0.9);
  }

  private *rollAway(o: Fighter, f: Fighter): Script {
    yield 0.25;
    const dir = o.x > f.x ? 1 : -1;
    const tx = clamp(o.x + dir * 130, -RING + 30, RING - 30);
    o.play('lie');
    let t = 0;
    const x0 = o.x;
    while (t < 0.35) {
      t += this.dt;
      o.x = x0 + (tx - x0) * (t / 0.35);
      o.pose.rot = 0;
      yield FRAME;
    }
    if (this.phase === 'fight') {
      o.setState('down');
      o.downT = 0.3;
    }
  }

  /** O próprio lutador fica no chão (ex.: depois de um dropkick). */
  private selfDown(f: Fighter, t: number): void {
    f.play('lie');
    if (this.phase !== 'fight') return;
    f.setState('down');
    f.downT = t;
  }

  private *taunt(f: Fighter): Script {
    f.tauntCd = 6;
    f.play('taunt');
    f.setExpr('happy', 1.2);
    sfx.cheer(0.7);
    this.pop(['O PÚBLICO VIBRA!', 'ANDA CÁ!', 'VAMOS!', 'SOU O MAIOR!'][Math.floor(Math.random() * 4)], f.x, -260, '#ff7ae0', 22);
    yield 0.5;
    this.gainMeter(f, 16 * (1 + f.s.car * 0.025));
    this.addHype(0.12);
    yield 0.4;
  }

  private *getUp(f: Fighter): Script {
    f.play('getup', 1.15 + f.s.res * 0.006);
    yield 0.55;
    f.setState('act');
    f.play('guard');
    f.evade = 'none';
  }

  // ───────────────────────── Poções / passivas ─────────────────────────

  private tryPotion(f: Fighter): boolean {
    const belt = f.spec.belt;
    for (let i = 0; i < belt.length; i++) {
      if (f.usedBelt[i]) continue;
      const id = belt[i];
      let use = false;
      switch (id) {
        case 'c_vida':
          use = f.hpRatio < 0.35;
          break;
        case 'c_grande':
          use = f.hpRatio < 0.3;
          break;
        case 'c_energia':
          use = f.meter < 30 && this.t > 12;
          break;
        case 'c_ferro':
          use = f.hpRatio < 0.55 && this.opp(f).meter > 70;
          break;
        case 'c_furia':
          use = this.opp(f).hpRatio < 0.6 && this.t > 8;
          break;
        case 'c_estrelas':
          use = this.t > 15 && f.meter < 50;
          break;
      }
      if (use) {
        f.usedBelt[i] = true;
        f.run(this.drink(f, id));
        return true;
      }
    }
    return false;
  }

  private *drink(f: Fighter, id: string): Script {
    f.play('drink');
    const d = ITEMS[id];
    yield 0.4;
    if (f.spec.isPlayer) {
      this.tally.potions++;
      this.usedPotions.push(id);
    }
    const hx = f.x;
    const hy = this.jy(f, J_HEAD);
    this.pop(`${d.icon} ${d.name}`, hx, hy - 50, '#9be15d', 22);
    sfx.heal();
    switch (id) {
      case 'c_vida':
      case 'c_grande':
        this.heal(f, f.maxHp * (d.power ?? 0.2));
        break;
      case 'c_energia':
        this.gainMeter(f, d.power ?? 60);
        break;
      case 'c_ferro':
        f.ironT = 10;
        break;
      case 'c_furia':
        f.furyT = 10;
        break;
      case 'c_estrelas':
        f.meter = 100;
        f.speedT = 8;
        break;
    }
    for (let i = 0; i < 14; i++) {
      this.parts.spawn(PK.Ember, hx + (Math.random() - 0.5) * 60, hy + 40 + Math.random() * 80, 0, -80 - Math.random() * 80, 0.8, 18, id === 'c_furia' ? '#ff3d3d' : id === 'c_ferro' ? '#4aa8ff' : '#7dff8a', 0);
    }
    yield 0.3;
  }

  heal(f: Fighter, v: number): void {
    f.hp = Math.min(f.maxHp, f.hp + v);
    this.pop('+' + Math.round(v), f.x, this.jy(f, J_HEAD) - 20, '#7dff8a', 26);
  }

  gainMeter(f: Fighter, v: number): void {
    const before = f.meter;
    f.meter = Math.min(100, f.meter + v);
    if (before < 100 && f.meter >= 100) {
      this.pop('SUPER PRONTO!', f.x, this.jy(f, J_HEAD) - 60, '#ffd23d', 24);
      sfx.charge();
    }
  }

  damage(f: Fighter, v: number): void {
    f.hp = Math.max(1, f.hp - v);
  }

  // ───────────────────────── Golpe/dano ─────────────────────────

  private targetable(o: Fighter, ground: boolean): boolean {
    if (this.active[o.team] !== o) return false;
    if (o.state === 'ko' || o.state === 'out' || o.state === 'apron') return false;
    if (o.state === 'down' && !ground) return false;
    return true;
  }

  /** Aplica um golpe. Devolve true se acertou (mesmo bloqueado). */
  strike(att: Fighter, def: Fighter, o: StrikeOpts): boolean {
    if (this.phase !== 'fight') return false;
    if (!this.targetable(def, !!o.ground) && !(o.ground && def.state === 'thrown')) return false;
    const dist = Math.abs(att.x - def.x);
    if (o.reach < 9000 && dist > o.reach) {
      if (!o.quiet) sfx.whoosh();
      return false;
    }
    const dir = def.x >= att.x ? 1 : -1;
    const hx = this.jx(def, o.body ? J_NECK : J_HEAD) - dir * 18;
    const hy = o.ground ? this.jy(def, J_HIP) - 10 : this.jy(def, o.body ? J_NECK : J_HEAD) + (o.body ? 25 : 0);
    if (!o.unblockable && def.evade === 'dodge') {
      sfx.whoosh();
      this.pop('ESQUIVA!', def.x, this.jy(def, J_HEAD) - 50, '#5ef0c0', 24);
      if (def.spec.isPlayer) this.tally.dodges++;
      this.gainMeter(def, 5 * (1 + def.s.car * 0.012));
      return false;
    }
    let dmg = o.dmg * (o.kind === 'super' ? 0.85 : 0.8);
    const isGrapple = o.kind === 'grapple';
    dmg *= isGrapple ? 1 + att.s.agr * 0.022 : 1 + att.s.for * 0.02;
    if (o.kind === 'super') dmg *= 1 + (att.s.for + att.s.agr) * 0.006;
    if (att.furyT > 0) dmg *= 1.35;
    if (att.has('p_furia') && att.hpRatio < 0.3) dmg *= 1.35;
    // crítico
    let critC = 0.04 + att.s.pre * 0.0035;
    if (att.has('p_frio')) critC += 0.1;
    const crit = o.kind !== 'assist' && Math.random() < critC;
    if (crit) dmg *= 1.6;
    // defesa
    dmg *= 1 - Math.min(0.5, def.s.def * 0.0045);
    if (def.has('p_ferro')) dmg *= 0.92;
    if (def.ironT > 0) dmg *= 0.6;
    dmg *= 0.9 + Math.random() * 0.2;

    const blocked = !o.unblockable && def.evade === 'block';
    if (blocked) {
      dmg *= 0.2;
      sfx.block();
      this.sparks(hx, hy, 6, '#9ad7ff', 300);
      this.pop('BLOQUEIO', def.x, this.jy(def, J_HEAD) - 50, '#9ad7ff', 22);
      def.vx = dir * 90;
      def.hp = Math.max(1, def.hp - dmg);
      this.gainMeter(def, 6 * (1 + def.s.car * 0.012));
      return true;
    }

    dmg = Math.max(1, Math.round(dmg));
    def.hp -= dmg;
    def.minHpRatio = Math.min(def.minHpRatio, Math.max(0, def.hp) / def.maxHp);
    def.lastHitBy = att;
    def.flashT = 0.07;
    def.setExpr('hurt', 0.5);
    att.combo++;
    att.comboT = 1.2;
    if (att.combo >= 4 && att.combo % 2 === 0) this.pop(`${att.combo} HITS!`, att.x, -300, '#ff7ae0', 26);

    if (att.spec.isPlayer) {
      this.tally.damage += dmg;
      if (o.kind === 'punch') this.tally.punches++;
    }
    if (att.has('p_vampiro')) att.hp = Math.min(att.maxHp, att.hp + dmg * 0.07);

    // efeitos
    const heavy = !!o.heavy || crit || o.kind === 'super';
    this.pop(String(dmg), hx, hy - 20, crit ? '#ffd23d' : '#ffffff', crit ? 36 : heavy ? 30 : 24);
    if (crit) this.pop('CRÍTICO!', hx, hy - 60, '#ff5a5a', 22);
    this.sparks(hx, hy, heavy ? 16 : 8, o.color ?? (heavy ? '#ffd23d' : '#ffffff'), heavy ? 700 : 450);
    this.parts.spawn(PK.Star, hx, hy, 0, 0, 0.18, heavy ? 46 : 30, '#ffffff', 0);
    if (Math.random() < 0.6) {
      for (let i = 0; i < 4; i++) this.parts.spawn(PK.Sweat, hx, hy, dir * (100 + Math.random() * 200), -150 - Math.random() * 200, 0.6, 2.5, '#bfe6ff', 1400);
    }
    sfx.hit(heavy);
    this.freeze = heavy ? 0.085 : 0.035;
    this.shake(heavy ? 9 : 3.5, heavy ? 0.22 : 0.1);
    if (heavy) this.zoomPunch = 0.06;
    this.addHype(heavy ? 0.06 : 0.015);
    this.gainMeter(att, dmg * 0.38 * (1 + att.s.car * 0.012) * (att.has('p_showman') ? 1.3 : 1));
    this.gainMeter(def, dmg * 0.22);

    // segundo fôlego
    if (def.hp > 0 && def.hpRatio < 0.25 && def.has('p_folego') && !def.usedFolego) {
      def.usedFolego = true;
      this.heal(def, def.maxHp * 0.2);
      this.pop('SEGUNDO FÔLEGO!', def.x, this.jy(def, J_HEAD) - 80, '#7dff8a', 22);
    }

    if (def.hp <= 0) {
      this.handleZero(def, att, o.kind);
      return true;
    }
    if (def.armor) return true;
    if (def.state === 'down') {
      def.downT = Math.max(def.downT, 0.6);
      return true;
    }
    if (def.state === 'thrown' && !o.ground) return true;
    def.stop();
    def.evade = 'none';
    if (o.kd) {
      this.knockDown(def, dir, o.kb ?? 200, o.launch ?? 260);
    } else {
      def.setState('hit');
      def.play(o.body ? 'hitBody' : 'hitHi');
      def.vx = dir * (o.kb ?? 80);
      def.face(att);
    }
    return true;
  }

  knockDown(f: Fighter, dir: number, kb: number, launch: number): void {
    f.stop();
    f.face(f.x - dir);
    f.setState('down');
    f.play('fall');
    f.vx = dir * kb;
    f.vz = launch;
    f.z = Math.max(f.z, 1);
    f.downT = Math.max(0.45, 0.85 + Math.random() * 0.5 - f.s.res * 0.006);
    f.setExpr('hurt', 1.2);
    f.run(this.fallLand(f), false);
    f.state = 'down';
  }

  private *fallLand(f: Fighter): Script {
    yield () => f.z <= 0;
    this.dust(f.x, 8);
    sfx.thud();
    this.shake(5, 0.15);
    if (f.state === 'ko') f.play('lieKO');
    else {
      f.play('lie');
      f.state = 'down';
    }
  }

  private handleZero(def: Fighter, att: Fighter, kind: StrikeKind): void {
    // Fénix (passiva) ou Néctar de Fénix (poção)
    let revive = 0;
    if (def.has('p_fenix') && !def.usedFenix) {
      def.usedFenix = true;
      revive = 0.35;
    } else {
      const ni = def.spec.belt.indexOf('c_fenix');
      if (ni >= 0 && !def.usedBelt[ni]) {
        def.usedBelt[ni] = true;
        revive = 0.4;
        if (def.spec.isPlayer) {
          this.tally.potions++;
          this.usedPotions.push('c_fenix');
        }
      }
    }
    if (revive > 0) {
      def.hp = 1;
      this.knockDown(def, def.x >= att.x ? 1 : -1, 200, 300);
      def.downT = 99;
      def.script = this.rebirth(def, revive);
      return;
    }
    def.hp = 0;
    def.stop();
    this.knockDown(def, def.x >= att.x ? 1 : -1, 260, 420);
    def.state = 'ko';
    def.downT = 99;
    def.setExpr('ko', 999);
    this.slowmo(0.22, 1.1);
    this.focus = def;
    this.focusT = 1.4;
    this.zoomPunch = 0.15;
    this.flash = 0.6;
    this.flashColor = '#ffffff';
    sfx.cheer(1.5);
    this.addHype(1);
    const team = def.team;
    const next = this.teams[team].find((p) => p !== def && p.state === 'apron');
    if (kind === 'super' && att.spec.isPlayer) this.superKO = true;
    if (next && this.phase === 'fight') {
      this.banner('ELIMINADO!', def.spec.name, '#ff5a5a', 1.6);
      def.run(this.eliminate(def, next));
      def.state = 'ko';
    } else {
      this.banner('K.O.!', '', '#ff3d6e', 1.8, 1.5);
      this.declareWinner(att.team, def);
    }
  }

  private *rebirth(f: Fighter, ratio: number): Script {
    yield () => f.z <= 0;
    f.play('lie');
    f.state = 'down';
    yield 0.8;
    const fx = f.x;
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      this.parts.spawn(PK.Ember, fx, -60, Math.cos(a) * 300, Math.sin(a) * 300 - 200, 1, 30, i % 2 ? '#ff7a1a' : '#ffd23d', 0);
    }
    this.wave(fx, -10, 300, '#ff7a1a', 0.6);
    this.flash = 0.6;
    this.flashColor = '#ffb31a';
    sfx.fire();
    sfx.cheer(1.3);
    this.banner('RENASCEU!', 'Fénix', '#ffb31a', 1.4);
    f.hp = f.maxHp * ratio;
    f.setExpr('power', 1.5);
    f.play('getup', 1.3);
    yield 0.6;
    f.state = 'act';
    f.play('guard');
    f.downT = 0;
  }

  private *eliminate(f: Fighter, next: Fighter): Script {
    yield () => f.z <= 0;
    f.play('lieKO');
    yield 1.6;
    // sai do ringue
    f.noClamp = true;
    const side = f.team === 0 ? -1 : 1;
    let t = 0;
    const x0 = f.x;
    while (t < 0.6) {
      t += this.dt;
      f.x = x0 + (side * (APRON_X + 60) - x0) * (t / 0.6);
      yield FRAME;
    }
    f.setState('out');
    this.active[f.team] = next;
    next.stop();
    next.run(this.enterRing(next));
  }

  private *enterRing(f: Fighter): Script {
    f.setState('act');
    f.noClamp = true;
    const side = f.team === 0 ? -1 : 1;
    f.play('tuck');
    f.facing = -side as 1 | -1;
    const tx = side * (RING - 70);
    const T = 0.55;
    f.vx = (tx - f.x) / T;
    f.vz = (0.5 * GRAV * T * T) / T;
    f.z = 1;
    yield () => f.z <= 0;
    f.vx = 0;
    f.x = tx;
    f.noClamp = false;
    this.dust(f.x, 6);
    sfx.thud();
    f.play('taunt', 1.4);
    yield 0.5;
    f.play('guard');
  }

  // ───────────────────────── Tag ─────────────────────────

  private tryTag(f: Fighter): boolean {
    const p = this.partner(f);
    if (!p || f.tagCooldown > 0) return false;
    if (f.hpRatio > 0.42 || p.hpRatio < f.hpRatio + 0.2) return false;
    if (Math.random() > 0.35) return false;
    f.run(this.tagOut(f, p));
    return true;
  }

  private *tagOut(f: Fighter, p: Fighter): Script {
    const side = f.team === 0 ? -1 : 1;
    const cornerX = side * (RING - 15);
    f.facing = side as 1 | -1;
    f.play('run');
    this.pop('VAI FAZER TAG!', f.x, -260, '#ffffff', 20);
    while (Math.abs(f.x - cornerX) > 14) {
      f.vx = Math.sign(cornerX - f.x) * 330;
      yield FRAME;
    }
    f.vx = 0;
    f.x = cornerX;
    f.play('reach');
    p.script = null;
    p.play('reach');
    yield 0.25;
    // TAG!
    this.banner('TAG!', p.spec.name + ' entra!', '#ffd23d', 1.0);
    sfx.slap();
    sfx.cheer(0.9);
    this.addHype(0.25);
    this.sparks(side * (RING + 40), -150, 14, '#ffd23d', 400);
    f.tagCooldown = 10;
    // troca: o ativo sai para o avental e o parceiro entra
    this.active[f.team] = p;
    p.run(this.enterRing(p));
    // salta para fora
    f.noClamp = true;
    f.play('tuck');
    f.vz = 600;
    f.z = 1;
    f.vx = (side * APRON_X - f.x) / 0.55;
    yield () => f.z <= 0;
    f.vx = 0;
    f.x = side * APRON_X;
    f.noClamp = false;
    f.setState('apron');
    f.play('apron');
    f.tagCooldown = 12;
  }

  // ───────────────────────── Fim ─────────────────────────

  private declareWinner(team: 0 | 1, loser: Fighter | null): void {
    if (this.phase === 'finish' || this.phase === 'end') return;
    this.phase = 'finish';
    this.phaseT = 0;
    this.winner = team;
    const w = this.active[team];
    w.stop();
    w.noClamp = false;
    const canPin = loser && Math.abs(loser.x) < RING - 30;
    w.run(canPin ? this.pinScript(w, loser) : this.celebrate(w));
    if (!loser) {
      this.phase = 'end';
      this.phaseT = 0;
    }
  }

  private *pinScript(w: Fighter, l: Fighter): Script {
    w.setState('act');
    yield () => l.z <= 0 && w.z <= 0 && this.slowT <= 0;
    if (w.skel.minY < 40 || w.anim === 'lie' || w.anim === 'fall') {
      w.play('getup', 1.2);
      yield 0.65;
    }
    w.play('guard');
    yield 0.4;
    w.face(l);
    let walkT = 0;
    while (Math.abs(l.x - w.x) > 30 && walkT < 3) {
      walkT += this.dt;
      w.vx = Math.sign(l.x - w.x) * 220;
      w.play('walk', 1, false);
      yield FRAME;
    }
    w.vx = 0;
    w.x = l.x;
    w.play('pin');
    this.focus = l;
    this.focusT = 4;
    w.layer = 2;
    for (let n = 1; n <= 3; n++) {
      yield 0.65;
      this.banner(String(n), '', n === 3 ? '#ff3d6e' : '#ffffff', 0.6, 1.6);
      sfx.slap();
      this.shake(3, 0.1);
    }
    yield 0.3;
    sfx.bell();
    w.layer = 0;
    yield* this.celebrate(w);
  }

  private *celebrate(w: Fighter): Script {
    w.setState('act');
    this.phase = 'end';
    this.phaseT = 0;
    const wt = w.team;
    this.banner(wt === 0 ? 'VITÓRIA!' : 'DERROTA', w.spec.name + ' vence!', wt === 0 ? '#ffd23d' : '#ff5a5a', 2.4, 1.3);
    sfx.cheer(1.6);
    for (let i = 0; i < 120; i++) {
      const colors = ['#ff3d6e', '#ffd23d', '#3aa0ff', '#4cd964', '#b45cff', '#ffffff'];
      this.parts.spawn(PK.Confetti, w.x + (Math.random() - 0.5) * 900, -500 - Math.random() * 300, (Math.random() - 0.5) * 200, Math.random() * 100, 3 + Math.random() * 2, 5, colors[i % colors.length], 140);
    }
    w.play('getup', 1.4);
    yield 0.5;
    w.play('victory');
    w.setExpr('happy', 999);
    w.face(0);
    for (const f of this.teams[wt]) {
      if (f !== w && f.state === 'apron') {
        f.play('victory');
        f.setExpr('happy', 999);
      }
    }
    while (true) yield 10;
  }

  phaseEnded(): boolean {
    return this.ended;
  }

  private finish(): void {
    this.ended = true;
    const me = this.teams[0].find((f) => f.spec.isPlayer) ?? this.teams[0][0];
    const won = this.winner === 0;
    this.tally.fights = 1;
    if (won) {
      this.tally.wins = 1;
      if (this.mode === 'tag') this.tally.tagWins = 1;
      if (this.mode === 'champion') this.tally.championWins = 1;
      if (me.minHpRatio > 0.7 && me.hp / me.maxHp > 0.7) this.tally.perfectWins = 1;
      if (this.usedPotions.length === 0) this.tally.noPotionWins = 1;
      if (me.minHpRatio < 0.15) this.tally.comebackWins = 1;
      if (this.superKO) this.tally.superKOs = 1;
    }
    this.onEnd?.({
      won,
      mode: this.mode,
      tally: this.tally,
      superKO: this.superKO && won,
      usedPotions: this.usedPotions,
      minHp: me.minHpRatio,
      duration: this.t,
      decision: this.decision,
    });
  }

  // ───────────────────────── Supers ─────────────────────────

  private *superMove(f: Fighter, o: Fighter, id: string): Script {
    const d = ITEMS[id];
    const type = d?.vis?.type ?? 'supersoco';
    const power = d?.power ?? 1;
    const color = SUPER_COLORS[type] ?? '#ffd23d';
    f.meter = 0;
    if (f.spec.isPlayer) this.tally.supers++;
    // cut-in cinematográfico
    this.cutin = { name: f.spec.name, move: d?.name ?? 'Super', icon: d?.icon ?? '💥', color, team: f.team, t: 0, max: 1.05 };
    f.play('charge');
    f.glow = color;
    f.setExpr('power', 4);
    this.darkenTarget = 0.55;
    this.focus = f;
    this.focusT = 1;
    sfx.charge();
    this.addHype(0.3);
    yield FRAME;
    try {
      switch (type) {
        case 'lariat':
          yield* this.sLariat(f, o, power, color);
          break;
        case 'relampago':
          yield* this.sRelampago(f, o, power, color);
          break;
        case 'trovao':
          yield* this.sTrovao(f, o, power, color);
          break;
        case 'tornado':
          yield* this.sTornado(f, o, power, color);
          break;
        case 'dragao':
          yield* this.sDragao(f, o, power, color);
          break;
        case 'meteoro':
          yield* this.sMeteoro(f, o, power, color);
          break;
        case 'atomico':
          yield* this.sAtomico(f, o, power, color);
          break;
        case 'cosmico':
          yield* this.sCosmico(f, o, power, color);
          break;
        case 'ira':
          yield* this.sIra(f, o, power, color);
          break;
        default:
          yield* this.sSoco(f, o, power, color);
      }
    } finally {
      this.darkenTarget = 0;
      f.glow = null;
      f.spinAng = 0;
      f.spinRate = 0;
    }
  }

  private superHit(f: Fighter, o: Fighter, dmg: number, color: string, extra: Partial<StrikeOpts> = {}): boolean {
    return this.strike(f, o, { dmg, reach: 9999, kind: 'super', heavy: true, unblockable: true, kd: true, kb: 420, launch: 420, color, ...extra });
  }

  private *dashTo(f: Fighter, o: Fighter, speed: number, stopAt = 80): Generator<Yield, void, unknown> {
    f.face(o);
    let t = 0;
    while (Math.abs(o.x - f.x) > stopAt && t < 1.5) {
      t += this.dt;
      f.vx = Math.sign(o.x - f.x) * speed;
      if (Math.random() < 0.5) this.parts.spawn(PK.Ember, f.x, -80 - Math.random() * 80, -f.facing * 60, 0, 0.3, 26, f.glow ?? '#fff', 0);
      yield FRAME;
    }
    f.vx = 0;
  }

  private *sSoco(f: Fighter, o: Fighter, p: number, c: string): Script {
    yield 0.45;
    f.play('run');
    yield* this.dashTo(f, o, 700, 90);
    f.play('haymakerW');
    yield 0.12;
    f.play('haymaker');
    yield 0.07;
    const x = (f.x + o.x) / 2;
    this.superHit(f, o, 75 * p, c);
    this.wave(x, -120, 260, c);
    this.flash = 0.5;
    this.shake(16, 0.4);
    this.sparks(x, -120, 30, c, 900);
    yield 0.5;
  }

  private *sLariat(f: Fighter, o: Fighter, p: number, c: string): Script {
    yield 0.3;
    const away = -f.facing;
    f.facing = away as 1 | -1;
    f.play('run');
    f.vx = away * 600;
    yield () => Math.abs(f.x) >= RING - 14;
    pushRope(this.ropes, f.x > 0 ? 1 : 0, away * 900);
    f.facing = -away as 1 | -1;
    f.play('clothes');
    yield* this.dashTo(f, o, 800, 70);
    this.superHit(f, o, 80 * p, c, { launch: 600 });
    if (o.state !== 'ko') o.spinRate = -o.facing * 13;
    this.shake(18, 0.4);
    this.flash = 0.4;
    this.sparks(o.x, -150, 30, c, 900);
    yield 0.48;
    o.spinRate = 0;
    o.spinAng = 0;
    yield 0.2;
  }

  private *sRelampago(f: Fighter, o: Fighter, p: number, c: string): Script {
    yield 0.3;
    f.play('run');
    yield* this.dashTo(f, o, 900, 80);
    f.ghost = true;
    for (let i = 0; i < 8; i++) {
      f.play(i % 2 ? 'cross' : 'jab', 2.6);
      yield 0.07;
      this.strike(f, o, { dmg: 9 * p, reach: 9999, kind: 'super', unblockable: true, kb: 30, color: c });
      this.bolts.push({ x: o.x + (Math.random() - 0.5) * 40, y0: -260, y1: -60, life: 0.1, color: c, seed: Math.random() * 999, width: 4 });
      this.freeze = 0.02;
      yield 0.05;
      if (o.state === 'ko') break;
    }
    f.ghost = false;
    if (o.state !== 'ko') {
      f.play('upper', 1.5);
      yield 0.18;
      this.superHit(f, o, 30 * p, c, { launch: 700, kb: 200 });
      this.flash = 0.5;
      this.shake(14, 0.3);
    }
    yield 0.5;
  }

  private *sTrovao(f: Fighter, o: Fighter, p: number, c: string): Script {
    yield 0.35;
    f.play('run');
    yield* this.dashTo(f, o, 700, 75);
    f.play('upper', 1.3);
    yield 0.2;
    this.superHit(f, o, 45 * p, c, { launch: 1100, kb: 60 });
    this.shake(10, 0.2);
    yield () => o.vz <= 0;
    this.bolts.push({ x: o.x, y0: -1400, y1: this.jy(o, J_HIP), life: 0.45, color: c, seed: Math.random() * 999, width: 16 });
    this.flash = 0.9;
    this.flashColor = '#cfefff';
    sfx.zap();
    this.shake(22, 0.45);
    if (o.state !== 'ko') this.strike(f, o, { dmg: 50 * p, reach: 9999, kind: 'super', unblockable: true, kd: true, kb: 0, launch: 0, color: c, ground: true });
    this.sparks(o.x, this.jy(o, J_HIP), 40, c, 1000);
    yield 0.7;
  }

  private *sTornado(f: Fighter, o: Fighter, p: number, c: string): Script {
    yield 0.35;
    f.play('spin');
    let t = 0;
    let hits = 0;
    let next = 0;
    sfx.whoosh();
    while (t < 1.4 && hits < 6) {
      t += this.dt;
      f.facing = (Math.floor(t * 14) % 2 ? 1 : -1) as 1 | -1;
      f.vx = Math.sign(o.x - f.x) * 380;
      if (Math.random() < 0.7) {
        const a = t * 20;
        this.parts.spawn(PK.Smoke, f.x + Math.cos(a) * 70, -100 + Math.sin(a * 0.5) * 80, -Math.sin(a) * 200, -40, 0.4, 16, c, 0);
      }
      next -= this.dt;
      if (Math.abs(o.x - f.x) < 95 && next <= 0) {
        next = 0.16;
        hits++;
        const last = hits === 6;
        this.strike(f, o, { dmg: (last ? 30 : 14) * p, reach: 9999, kind: 'super', unblockable: true, kd: last, kb: last ? 500 : 60, launch: last ? 650 : 0, color: c });
        if (o.state === 'ko') break;
      }
      yield FRAME;
    }
    f.vx = 0;
    f.face(o);
    f.play('guard');
    yield 0.4;
  }

  private *sDragao(f: Fighter, o: Fighter, p: number, c: string): Script {
    yield 0.5;
    f.play('haymaker');
    sfx.fire();
    const dir = f.facing;
    const pr: Proj = { kind: 'dragon', x: f.x + dir * 70, y: this.jy(f, J_NECK) + 10, vx: dir * 900, life: 2, dir, color: c };
    this.projs.push(pr);
    yield () => (o.x - pr.x) * dir < 40 || pr.life <= 0;
    pr.life = 0;
    this.superHit(f, o, 110 * p, c, { launch: 500 });
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      this.parts.spawn(PK.Ember, o.x, -100, Math.cos(a) * 400, Math.sin(a) * 300 - 100, 0.8, 34, i % 2 ? '#ffd000' : '#ff5a00', 0);
    }
    this.wave(o.x, -40, 320, '#ff5a00', 0.6);
    this.flash = 0.6;
    this.flashColor = '#ffb070';
    this.shake(18, 0.45);
    yield 0.7;
  }

  private *sMeteoro(f: Fighter, o: Fighter, p: number, c: string): Script {
    yield 0.4;
    f.play('tuck');
    f.vz = 1900;
    f.z = 1;
    sfx.whoosh();
    yield () => f.vz <= 0;
    // fica fora do ecrã por um instante
    f.vz = 0;
    f.z = 900;
    yield 0.35;
    f.x = o.x - f.facing * 160;
    f.play('splash');
    f.vz = -2600;
    f.vx = f.facing * 420;
    sfx.fire();
    let t = 0;
    while (f.z > 0 && t < 2) {
      t += this.dt;
      for (let i = 0; i < 3; i++) this.parts.spawn(PK.Ember, f.x + (Math.random() - 0.5) * 40, -f.z - 60, (Math.random() - 0.5) * 80, -200, 0.4, 34, i % 2 ? '#ffd000' : c, 0);
      yield FRAME;
    }
    f.vx = 0;
    f.z = 0;
    this.superHit(f, o, 125 * p, c, { launch: 700, kb: 300 });
    this.wave(f.x, 0, 520, c, 0.7);
    this.wave(f.x, 0, 300, '#ffd000', 0.5);
    for (let i = 0; i < 50; i++) {
      const a = -Math.random() * Math.PI;
      this.parts.spawn(i % 3 ? PK.Ember : PK.Shard, f.x, -10, Math.cos(a) * 700, Math.sin(a) * 600, 0.9, i % 3 ? 30 : 6, i % 2 ? '#ffd000' : '#7a4a2a', 1200);
    }
    this.dust(f.x, 20, 200);
    sfx.boom();
    this.flash = 1;
    this.flashColor = '#ffcf8a';
    this.shake(30, 0.7);
    f.play('getup', 1.2);
    yield 0.8;
  }

  private *sAtomico(f: Fighter, o: Fighter, p: number, c: string): Script {
    yield 0.3;
    f.play('run');
    yield* this.dashTo(f, o, 800, 60);
    this.lock(f, o);
    o.play('hitBody');
    f.play('lift');
    yield* this.carry(f, o, 0.25, [45, 30, 0], [10, -60, -1.2]);
    // salta com o adversário
    f.vz = 1300;
    f.z = 1;
    f.play('arch');
    let t = 0;
    while (f.vz > -200) {
      t += this.dt;
      const u = clamp(t / 0.6, 0, 1);
      o.override = { x: f.x + f.facing * (10 - 70 * u), y: -f.z - 150 + 60 * u, rot: (-1.2 - 2.4 * u) * f.facing };
      for (let i = 0; i < 2; i++) this.parts.spawn(PK.Ember, f.x, -f.z - 60, (Math.random() - 0.5) * 100, 100, 0.4, 30, c, 0);
      yield FRAME;
    }
    yield () => f.z <= 0;
    o.play('lieKO');
    o.override = null;
    o.x = clamp(f.x - f.facing * 75, -RING + 20, RING - 20);
    o.setState('hit');
    this.superHit(f, o, 125 * p, c, { launch: 200, kb: 100, ground: true });
    this.wave(o.x, 0, 600, c, 0.8);
    this.wave(o.x, 0, 350, '#ffffff', 0.5);
    this.flash = 1;
    this.flashColor = '#e8ffb0';
    sfx.boom();
    this.shake(30, 0.7);
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2;
      this.parts.spawn(PK.Ember, o.x, -40, Math.cos(a) * 800, Math.sin(a) * 300 - 200, 1, 36, i % 2 ? c : '#ffffff', 0);
    }
    this.pop('SUPLEX ATÓMICO!', f.x, -300, c, 34);
    f.play('archUp');
    yield 0.9;
  }

  private *sCosmico(f: Fighter, o: Fighter, p: number, c: string): Script {
    this.cosmic = 1;
    this.darkenTarget = 0.85;
    yield 0.6;
    f.play('haymakerW');
    yield 0.25;
    f.play('haymaker');
    const dir = f.facing;
    const pr: Proj = { kind: 'fist', x: f.x + dir * 60, y: -130, vx: dir * 1100, life: 2, dir, color: c };
    this.projs.push(pr);
    sfx.charge();
    yield () => (o.x - pr.x) * dir < 60 || pr.life <= 0;
    pr.life = 0;
    this.superHit(f, o, 140 * p, c, { launch: 800, kb: 600 });
    for (let i = 0; i < 50; i++) {
      const a = Math.random() * Math.PI * 2;
      this.parts.spawn(PK.Shard, o.x, -140, Math.cos(a) * 700, Math.sin(a) * 700, 1.2, 7, i % 3 ? '#cfe6ff' : c, 600);
    }
    this.wave(o.x, -140, 700, c, 0.8);
    sfx.boom();
    this.flash = 1;
    this.flashColor = '#d9ccff';
    this.shake(28, 0.6);
    yield 0.7;
    this.cosmic = 0.99;
  }

  private *sIra(f: Fighter, o: Fighter, p: number, c: string): Script {
    f.play('wings');
    f.wings = true;
    yield 0.4;
    let t = 0;
    while (t < 0.5) {
      t += this.dt;
      f.z = (t / 0.5) * 140;
      yield FRAME;
    }
    f.play('rise');
    const beam: Beam = { x: o.x, w: 140, life: 1.3, max: 1.3, color: c };
    this.beams.push(beam);
    sfx.zap();
    this.flash = 0.7;
    this.flashColor = '#fff7d6';
    for (let i = 0; i < 5; i++) {
      beam.x = o.x;
      yield 0.2;
      this.strike(f, o, { dmg: 26 * p, reach: 9999, kind: 'super', unblockable: true, kb: 0, color: c, ground: true });
      this.shake(10, 0.15);
      if (o.state === 'ko') break;
    }
    if (o.state !== 'ko') this.superHit(f, o, 60 * p, c, { launch: 500, ground: true });
    this.wave(o.x, 0, 600, c, 0.8);
    sfx.boom();
    this.flash = 1;
    this.shake(26, 0.6);
    t = 0;
    while (f.z > 0) {
      t += this.dt;
      f.z = Math.max(0, f.z - this.dt * 300);
      yield FRAME;
    }
    f.wings = false;
    yield 0.4;
  }
}

