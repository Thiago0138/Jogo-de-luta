import { ITEMS, ITEM_LIST } from '../data/items';
import { emptyTally, type Tally } from '../data/missions';
import { maxHp } from '../data/stats';
import { sfx, crowdLevel } from '../audio/sfx';
import { HEAD_R, J_BF, J_BH, J_FE, J_FF, J_FH, J_HEAD, J_NECK, J_HIP, J_SH, Skel, clamp, copyPose, newPose, solve, type Pose } from '../render/pose';
import { ANIMS, armIK, headLocal, sample, torsoLocal, type AnimName } from './anims';
import { resolveLook } from '../render/look';
import { baseStats } from '../data/stats';
import {
  APRON_X, BACK_X, BACK_Y, FRONT_X, FRONT_Y, POST_H, RING, ROPE_H, ROPE_LINE_X, newRopes, pushRope, ringShake, ropeHeightAt, ropeHold, updateRopes, type RopeState,
} from './arena';
import { Fighter, type FighterSpec, type Loco, type Script, type Yield } from './fighter';
import { PK, Particles, type Banner, type Beam, type Bolt, type PopText, type Proj, type Wave } from './fx';

export type Mode = 'solo' | 'tag' | 'champion';

export interface FightSetup {
  mode: Mode;
  teams: [FighterSpec[], FighterSpec[]];
  /** Mostrar as entradas dos lutadores antes da luta (por defeito sim). */
  entrances?: boolean;
  /**
   * Montra de entrada (pré-visualização na coleção/loja): só o primeiro lutador da equipa 0
   * faz a entrada; a outra equipa fica escondida e a luta nunca começa.
   */
  showcase?: boolean;
  /**
   * Demonstração de um item (golpe, estilo, super ou passiva) na pré-visualização dos menus:
   * o lutador da equipa 0 repete-o em ciclo no adversário, sem K.O. nem relógio.
   */
  demo?: string;
}

export interface FightReport {
  won: boolean;
  mode: Mode;
  tally: Tally;
  superKO: boolean;
  minHp: number;
  duration: number;
  decision: boolean;
}

/** Um frame (para scripts que precisam de correr frame a frame). */
const FRAME = 1e-4;
const BURST_WORDS = ['POW!', 'BAM!', 'CRACK!', 'BOOM!', 'WHAM!', 'SMASH!', 'KAPOW!'];
const GRAV = 2200;
const WALK = 150;
/** x das cordas laterais à profundidade dos lutadores e alturas das cordas do meio/de cima. */
const ROPE_X = 498;
/** Meia largura do corpo que encosta às cordas. */
const BODY_HALF = 26;
const ROPE_MID = 84;
const ROPE_TOP = 123;
/** Para lá disto (em |x|) um lutador já saiu de cena. */
const OFFSTAGE = 880;
/** Altura do ringue: o chão do pavilhão fica este tanto abaixo do tapete (z negativo). */
const FLOOR_Z = -92;

type Pt = [number, number];
type HandT = ((p: Pose) => Pt) | null;

/**
 * Mãos presas a alvos (IK), com transição suave quando o alvo muda ou é largado.
 * Os alvos são devolvidos em coordenadas locais do esqueleto (ver armIK).
 */
interface Grip {
  set(front: HandT | undefined, back: HandT | undefined): void;
  front: HandT;
  back: HandT;
}

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
  /** Articulação do atacante que acerta (para o impacto aparecer no sítio certo). */
  hitJ?: number;
}

/** Alcance máximo para a frente de uma articulação ao longo de uma animação (cache). */
const reachCache = new Map<string, number>();
const tmpPose = newPose();
const tmpSkel = new Skel();
function reachOf(anim: AnimName, joint: number): number {
  const key = anim + ':' + joint;
  let r = reachCache.get(key);
  if (r != null) return r;
  const a = ANIMS[anim];
  // pose de impacto = primeira pose com chegada "seca" (snap); o golpe acerta nesse instante,
  // por isso o alcance conta-se aí (o máximo da animação pode ser na preparação, ex.: uppercut)
  const hit = a.keys.find((k) => k.t > 0 && k.e);
  r = 0;
  if (hit) {
    sample(a, hit.t, tmpPose);
    solve(tmpPose, tmpSkel);
    r = tmpSkel.x[joint];
  } else {
    const end = Math.min(2, a.keys[a.keys.length - 1].t);
    for (let t = 0; t <= end; t += 0.01) {
      sample(a, t, tmpPose);
      solve(tmpPose, tmpSkel);
      r = Math.max(r, tmpSkel.x[joint]);
    }
  }
  reachCache.set(key, r);
  return r;
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
  /** Figurantes só visuais (árbitro a ir buscar um eliminado): desenhados como lutadores, sem lógica de luta. */
  extras: Fighter[] = [];
  teams: [Fighter[], Fighter[]] = [[], []];
  active: [Fighter, Fighter];
  t = 0;
  clock = 99;
  dt = 0;
  timeScale = 1;
  slowT = 0;
  private slowScale = 1;
  /** Câmara lenta cinematográfica (golpes de assinatura/supers): tempo real restante, duração, escala. */
  private cineT = 0;
  private cineMax = 0;
  private cineScale = 1;
  private lastCine = -99;
  /** Tempo real acumulado (não afetado pela câmara lenta). */
  private rt = 0;
  /** Distância de contacto no fim do último lungeTo (o alvo pode ter mudado de pose entretanto). */
  private lastLunge = 0;
  /** Para onde o defensor fica virado quando a projeção em curso o pousa (ver carry). */
  private slamFacing: 1 | -1 | null = null;
  /** carry() segura só com esta mão (ex.: chokeslam, pela garganta); null = as duas. */
  private carryHand: number | null = null;
  /** Peso 0–1 da câmara lenta em curso (a câmara aproxima-se de cineX/cineY). */
  cineW = 0;
  cineX = 0;
  cineY = -120;
  freeze = 0;
  phase: 'entrance' | 'intro' | 'fight' | 'finish' | 'end' = 'intro';
  private entQueue: Fighter[] = [];
  private entCur: Fighter | null = null;
  private entBeam: Beam | null = null;
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
  bursts: { x: number; y: number; text: string; life: number; max: number; color: string; rot: number }[] = [];
  /** Show de lasers da entrada (segundos restantes) e cor. */
  lasersT = 0;
  /** Faixa com retrato + nome do golpe de assinatura (não pára a luta). */
  moveCall: { name: string; move: string; icon: string; color: string; team: 0 | 1; t: number; max: number } | null = null;
  private lastCallT = -99;
  /** Eventos para o narrador / música. */
  onEvent: ((ev: string, a?: Fighter, b?: Fighter, extra?: string) => void) | null = null;
  /** Dano total que o super em curso ainda pode causar (-1 = sem super). */
  superBudget = -1;
  laserHue = 0;
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
  superKO = false;
  decision = false;
  onEnd: ((r: FightReport) => void) | null = null;
  private ended = false;
  /** Modo montra (ver FightSetup.showcase). */
  readonly showcase: boolean;
  /** Na montra: a entrada terminou. */
  showcaseDone = false;
  /** Item em demonstração (ver FightSetup.demo). */
  readonly demo: string | null;
  /** Na demonstração de passivas os dois lutadores combatem sozinhos. */
  private demoAI = false;

  constructor(setup: FightSetup) {
    this.mode = setup.mode;
    this.demo = setup.demo ?? null;
    this.showcase = !!setup.showcase && !this.demo;
    setup.teams.forEach((specs, ti) => {
      specs.forEach((spec, si) => {
        const hp = maxHp(spec.level, spec.stats.vit) * (setup.mode === 'tag' ? 0.5 : 1) * (spec.hpMul ?? 1);
        const f = new Fighter(spec, ti as 0 | 1, ti * 2 + si, Math.round(hp));
        const side = ti === 0 ? -1 : 1;
        if (si === 0) {
          f.x = side * (RING - 30);
          f.facing = ti === 0 ? 1 : -1;
          if (this.demo) f.x = side * 150;
          else if (setup.entrances === false) f.run(this.introWalk(f, side * 210));
          else f.hidden = true;
        } else {
          if (setup.entrances !== false) f.hidden = true;
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
    if (this.mode === 'tag') this.clock = 180;
    if (this.demo) {
      this.phase = 'fight';
      const [a, b] = this.active;
      const d = ITEMS[this.demo];
      this.demoAI = d?.kind === 'passive';
      a.run(this.demoLoop(a, b, this.demo));
    } else if (this.showcase) {
      this.phase = 'entrance';
      this.entQueue = [this.teams[0][0]];
      // a equipa adversária fica fora de cena durante toda a montra
      for (const f of this.teams[1]) {
        f.hidden = true;
        f.x = 4000;
        f.setState('out');
      }
    } else if (setup.entrances !== false) {
      this.phase = 'entrance';
      // o adversário entra primeiro, o jogador fecha em grande
      this.entQueue = [this.teams[1][0], this.teams[0][0]];
    }
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

  // ───────────────────────── Entradas ─────────────────────────

  private endEntrances(): void {
    this.entCur = null;
    this.phase = 'intro';
    this.phaseT = 0;
    this.darkenTarget = 0;
    this.focus = null;
    this.focusT = 0;
    this.lasersT = 0;
    if (this.entBeam) this.entBeam.life = 0;
    this.entBeam = null;
  }

  /** Salta as entradas (toque no ecrã). */
  skipEntrance(): void {
    if (this.phase !== 'entrance') return;
    this.entQueue = [];
    for (const f of this.fighters) {
      f.stop();
      f.hidden = false;
      f.noClamp = false;
      f.perchSide = -1;
      f.vx = 0;
      f.vz = 0;
      f.z = 0;
      const side = f.team === 0 ? -1 : 1;
      if (this.active[f.team] === f) {
        f.x = side * 210;
        f.setState('idle');
        f.play('guard');
      } else {
        f.x = side * APRON_X;
        f.setState('apron');
        f.play('apron');
      }
      f.facing = (f.team === 0 ? 1 : -1) as 1 | -1;
    }
    this.projs = [];
    this.beams = [];
    this.bolts = [];
    this.cosmic = 0;
    this.stage = null;
    this.lasersT = 0;
    this.endEntrances();
  }

  private *entrance(f: Fighter): Script {
    const d = ITEMS[f.spec.entrance ?? 'e_classica'] ?? ITEMS.e_classica;
    const type = d.vis?.type ?? 'classica';
    const side = f.team === 0 ? -1 : 1;
    f.noClamp = true;
    f.setState('act');
    f.x = side * APRON_X;
    f.facing = -side as 1 | -1;
    f.play('apron');
    this.darkenTarget = 0.62;
    this.focus = f;
    this.focusT = 99;
    const beam: Beam = { x: f.x, w: 80, life: 99, max: 99, color: '#fff3d6' };
    this.entBeam = beam;
    this.beams.push(beam);
    this.stage = { disco: 0, carpet: 0, portal: 0, scan: null, side, flicker: 0 };
    this.emit('entrance', f, undefined, d.name);
    this.banner(f.spec.name.toUpperCase(), `${f.spec.title ? f.spec.title + ' · ' : ''}${d.name}`, f.team === 0 ? '#ffd23d' : '#7ad7ff', 2.8, 0.75);
    sfx.cheer(1);
    this.addHype(0.4);
    const follow = () => {
      beam.x = f.x;
    };
    try {
      switch (type) {
        case 'danca':
          yield* this.entDanca(f, side, beam);
          break;
        case 'fumo':
          yield* this.entFumo(f, side, beam);
          break;
        case 'lasers':
          yield* this.entLasers(f, side, beam);
          break;
        case 'pirotecnia':
          yield* this.entPyro(f, side, beam);
          break;
        case 'fogos':
          yield* this.entFogos(f, side, beam);
          break;
        case 'trovao':
          yield* this.entTrovao(f, side, beam);
          break;
        case 'rei':
          yield* this.entRei(f, side, beam);
          break;
        case 'dragao':
          yield* this.entDragao(f, side, beam);
          break;
        case 'cosmica':
          yield* this.entCosmica(f, side, beam);
          break;
        default:
          yield* this.entClassica(f, side, beam);
      }
    } finally {
      follow();
    }
    f.play('guard');
    f.x = side * 210;
    f.z = 0;
    f.vx = f.vz = 0;
    f.facing = -side as 1 | -1;
    beam.life = 0;
    this.entBeam = null;
    this.stage = null;
    this.lasersT = 0;
    this.darkenTarget = 0.62;
    this.cosmic = Math.min(this.cosmic, 0.99);
    f.noClamp = false;
    for (const p of this.teams[f.team]) {
      if (p !== f) {
        p.hidden = false;
        this.sparks(p.x, -120, 16, '#ffd23d', 400, PK.Star);
      }
    }
    yield 0.3;
  }

  /** Estado visual da entrada em curso (desenhado pela cena). */
  stage: { disco: number; carpet: number; portal: number; scan: number | null; side: number; flicker: number } | null = null;

  /** Caminha até x com a animação dada, a seguir com o holofote. */
  private *walkTo(f: Fighter, x: number, speed: number, beam: Beam | null, anim: AnimName | 'walk' | 'walkBack' | 'run' = 'walk'): Script {
    f.play(anim);
    let t = 0;
    while (Math.abs(f.x - x) > 6 && t < 4) {
      t += this.dt;
      f.vx = Math.sign(x - f.x) * speed;
      if (beam) beam.x = f.x;
      yield FRAME;
    }
    f.vx = 0;
    f.x = x;
  }

  /** Entra pelas cordas: passa por entre a corda do meio (sem salto). */
  private *stepThrough(f: Fighter, side: number, beam: Beam | null): Script {
    // chega às cordas pelo avental, segura-as abertas (do meio para baixo, de cima para cima) e passa por entre elas
    const follow = beam ? () => (beam.x = f.x) : null;
    const g = this.makeGrip(f);
    f.facing = -side as 1 | -1;
    const walk = this.stroll(f, side * (ROPE_X + 45));
    for (let r = walk.next(); !r.done; r = walk.next()) {
      follow?.();
      yield r.value;
    }
    const thr = this.throughRopes(f, side, g);
    for (let r = thr.next(); !r.done; r = thr.next()) {
      follow?.();
      yield r.value;
    }
    f.footLock = false;
    yield* this.walkTo(f, side * (RING - 60), 130, beam);
    f.play('guard');
  }

  /** Salta por cima da corda de cima (pés bem acima dela quando cruza a linha das cordas). */
  private *jumpIn(f: Fighter, side: number, tx: number): Script {
    yield* this.vault(f, tx);
  }

  /** Salto por cima da corda de cima, de fora para dentro ou de dentro para fora do ringue. */
  private *vault(f: Fighter, tx: number): Script {
    f.noClamp = true;
    const sd = (Math.sign(f.x || tx) > 0 ? 1 : 0) as 0 | 1;
    // ganha balanço
    f.play('duck');
    f.vx = 0;
    yield 0.14;
    // altura para os pés passarem por cima da corda de cima (com folga) onde cruzam a linha das cordas
    const x0 = f.x;
    const span = tx - x0;
    const u = span ? clamp((Math.sign(x0) * ROPE_LINE_X - x0) / span, 0.15, 0.85) : 0.5;
    const clear = ROPE_H[2] + 34;
    const H = Math.max(120, clear / (4 * u * (1 - u)));
    const vz0 = Math.sqrt(2 * GRAV * H);
    const T = (2 * vz0) / GRAV;
    f.play('tuck');
    f.vx = span / T;
    f.vz = vz0;
    f.z = Math.max(f.z, 1);
    sfx.whoosh();
    let crossed = false;
    while (f.z > 0) {
      if (!crossed && Math.abs(f.x) < ROPE_LINE_X === Math.abs(x0) > ROPE_LINE_X) {
        crossed = true;
        // a corda de cima vibra com a deslocação de ar / toque dos pés
        pushRope(this.ropes, sd, 14, 2, 120);
      }
      yield FRAME;
    }
    f.vx = 0;
    f.x = tx;
    this.dust(f.x, 8);
    sfx.thud();
  }

  private *pose(f: Fighter, anim: AnimName, dur: number, every: number, fx: (t: number) => void, beam: Beam | null): Script {
    f.play(anim);
    f.setExpr('happy', dur);
    let t = 0;
    let k = 0;
    while (t < dur) {
      t += this.dt;
      k -= this.dt;
      if (beam) beam.x = f.x;
      if (k <= 0) {
        k = every;
        fx(t);
      }
      yield FRAME;
    }
  }

  // 1) Clássica: entra pelas cordas, aponta para o público, braços no ar
  private *entClassica(f: Fighter, side: number, beam: Beam): Script {
    yield 0.4;
    yield* this.stepThrough(f, side, beam);
    yield* this.walkTo(f, side * 210, 150, beam);
    f.facing = -side as 1 | -1;
    yield* this.pose(f, 'point', 1.1, 9, () => sfx.cheer(0.9), beam);
    yield* this.pose(f, 'victory', 1.3, 0.45, () => this.confetti(f.x, 24, ['#ffffff', '#ffd23d', '#ff3d6e']), beam);
  }

  // 2) Dança: bola de espelhos desce, holofotes coloridos, moonwalk até ao centro
  private *entDanca(f: Fighter, side: number, beam: Beam): Script {
    const COLORS = ['#ff3d6e', '#3aa0ff', '#ffd23d', '#4cd964', '#b45cff', '#7af7ff'];
    yield* this.jumpIn(f, side, side * (RING - 70));
    // moonwalk: anda "para trás" mas avança
    f.facing = side as 1 | -1;
    f.play('walkBack');
    let t = 0;
    while (Math.abs(f.x - side * 210) > 6) {
      t += this.dt;
      f.vx = -side * 120;
      if (this.stage) this.stage.disco = Math.min(1, t / 1.2);
      beam.x = f.x;
      beam.color = COLORS[Math.floor(t * 5) % COLORS.length];
      yield FRAME;
    }
    f.vx = 0;
    f.facing = -side as 1 | -1;
    yield* this.pose(f, 'dance', 2.4, 0.12, (u) => {
      beam.color = COLORS[Math.floor(u * 6) % COLORS.length];
      if (this.stage) this.stage.disco = 1;
      for (let i = 0; i < 3; i++) this.parts.spawn(PK.Star, f.x + (Math.random() - 0.5) * 500, -80 - Math.random() * 320, 0, -20, 0.5, 10, COLORS[Math.floor(Math.random() * COLORS.length)], 0);
      if (Math.random() < 0.15) this.confetti(f.x, 10, COLORS);
    }, beam);
  }

  // 3) Fumo: o ringue enche-se de nevoeiro e o lutador sai lá de dentro em silhueta
  private *entFumo(f: Fighter, side: number, beam: Beam): Script {
    f.hidden = true;
    for (const sx of [-1, 1]) for (let i = 0; i < 30; i++) this.parts.spawn(PK.Smoke, sx * FRONT_X, -60, -sx * (200 + Math.random() * 300), -Math.random() * 60, 2.4, 44, i % 2 ? '#e8e4f2' : '#a9a2bd', 0);
    sfx.whoosh();
    sfx.whoosh();
    let t = 0;
    while (t < 1.2) {
      t += this.dt;
      if (Math.random() < 0.9) this.parts.spawn(PK.Smoke, (Math.random() - 0.5) * 900, -4, (Math.random() - 0.5) * 50, -15 - Math.random() * 25, 2.2, 48, '#cdc8dc', 0);
      yield FRAME;
    }
    f.x = 0;
    f.z = 0;
    f.facing = -side as 1 | -1;
    f.hidden = false;
    f.glow = '#ffffff';
    beam.x = 0;
    beam.w = 120;
    f.play('flex');
    this.flash = 0.5;
    this.flashColor = '#ffffff';
    sfx.cheer(1.3);
    yield* this.pose(f, 'flex', 1.2, 0.05, () => this.parts.spawn(PK.Smoke, (Math.random() - 0.5) * 700, -4, 0, -20, 1.8, 44, '#cdc8dc', 0), beam);
    f.glow = null;
    yield* this.walkTo(f, side * 210, 110, beam);
    f.facing = -side as 1 | -1;
    yield* this.pose(f, 'victory', 0.9, 0.3, () => {}, beam);
  }

  // 4) Lasers: apagão total, varrimento laser revela o lutador
  private *entLasers(f: Fighter, side: number, beam: Beam): Script {
    this.darkenTarget = 0.92;
    beam.life = 0;
    f.hidden = true;
    f.x = side * 210;
    f.facing = -side as 1 | -1;
    this.lasersT = 4.6;
    sfx.charge();
    let t = 0;
    while (t < 1.4) {
      t += this.dt;
      if (this.stage) this.stage.scan = -RING + (t / 1.4) * RING * 2;
      if (this.stage && this.stage.scan != null && Math.abs(this.stage.scan - f.x) < 40) f.hidden = false;
      yield FRAME;
    }
    if (this.stage) this.stage.scan = null;
    f.hidden = false;
    beam.life = 99;
    beam.x = f.x;
    beam.color = '#ff2e63';
    this.flash = 0.6;
    this.flashColor = '#ff2e63';
    sfx.boom();
    let beat = 0;
    yield* this.pose(f, 'dance', 2.6, 0.32, () => {
      beat++;
      beam.color = beat % 2 ? '#2ef0ff' : '#ff2e63';
      this.flash = 0.25;
      this.flashColor = beam.color;
      sfx.hit(true);
    }, beam);
  }

  // 5) Pirotecnia: sobe ao canto e o fogo corre os quatro postes
  private *entPyro(f: Fighter, side: number, beam: Beam): Script {
    yield* this.jumpIn(f, side, side * (RING - 70));
    yield* this.walkTo(f, side * (RING - 20), 160, beam);
    yield* this.climbRopes(f, side);
    beam.x = f.x;
    f.facing = -side as 1 | -1;
    f.blendIn(0.2);
    f.play('flex');
    const order: [number, number][] = [[-FRONT_X, FRONT_Y - POST_H], [-BACK_X, BACK_Y - POST_H + 10], [BACK_X, BACK_Y - POST_H + 10], [FRONT_X, FRONT_Y - POST_H]];
    for (const [px, py] of order) {
      this.fireColumn(px, py, 1);
      yield 0.28;
    }
    yield 0.2;
    for (const [px, py] of order) this.fireColumn(px, py, 1.6);
    this.shake(14, 0.5);
    this.flash = 0.6;
    this.flashColor = '#ffb070';
    sfx.boom();
    sfx.cheer(1.4);
    yield* this.pose(f, 'flex', 1.2, 0.3, () => this.fireColumn(order[Math.floor(Math.random() * 4)][0], order[0][1], 0.7), beam);
    // salta do canto para o meio
    this.leaveRopes(f, (side > 0 ? 1 : 0) as 0 | 1);
    f.play('tuck');
    const T = 0.55;
    f.vx = (side * 210 - f.x) / T;
    f.vz = (0.5 * GRAV * T * T - f.z) / T;
    yield () => f.z <= 0;
    f.noClamp = false;
    f.vx = 0;
    this.dust(f.x, 10);
    sfx.thud();
  }

  private fireColumn(px: number, py: number, k: number): void {
    for (let i = 0; i < 22 * k; i++) {
      this.parts.spawn(PK.Ember, px + (Math.random() - 0.5) * 16, py, (Math.random() - 0.5) * 70, -650 * k - Math.random() * 400, 0.55 + Math.random() * 0.3, 30, i % 3 ? '#ff7a1a' : '#ffd000', 600);
    }
    sfx.fire();
  }

  // 6) Fogo de artifício: foguetes a partir do avental e cascata de faíscas das cordas
  private *entFogos(f: Fighter, side: number, beam: Beam): Script {
    const COLORS = ['#ff3d6e', '#3aa0ff', '#ffd23d', '#4cd964', '#b45cff', '#ffffff'];
    yield* this.stepThrough(f, side, beam);
    yield* this.walkTo(f, side * 210, 150, beam);
    f.facing = -side as 1 | -1;
    f.play('point');
    for (let i = 0; i < 6; i++) {
      this.rocket((i % 2 ? 1 : -1) * (FRONT_X - 40 - i * 60), COLORS[i % COLORS.length]);
      yield 0.22;
    }
    yield* this.pose(f, 'point', 2.0, 0.035, (u) => {
      // cascata dourada ao longo da corda de cima
      for (let i = 0; i < 3; i++) this.parts.spawn(PK.Spark, (Math.random() - 0.5) * 2 * FRONT_X, FRONT_Y - ROPE_H[2], 0, 160 + Math.random() * 80, 0.7, 2.2, '#ffe27a', 600);
      if (u % 0.5 < 0.04) this.rocket((Math.random() - 0.5) * 900, COLORS[Math.floor(Math.random() * COLORS.length)]);
    }, beam);
  }

  /** Foguete com rasto que explode no ar passado pouco tempo. */
  private rocket(x: number, color: string): void {
    for (let i = 0; i < 10; i++) this.parts.spawn(PK.Spark, x, FRONT_Y - 20 - i * 30, 0, -900, 0.35 - i * 0.02, 2.5, '#fff6c2', 0);
    sfx.whoosh();
    const ex = x + (Math.random() - 0.5) * 120;
    setTimeout(() => this.burstAt(ex, -380 - Math.random() * 140, color), 380);
  }

  private burstAt(x: number, y: number, color: string): void {
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const v = 240 + Math.random() * 90;
      this.parts.spawn(i % 2 ? PK.Ember : PK.Spark, x, y, Math.cos(a) * v, Math.sin(a) * v, 1 + Math.random() * 0.4, i % 2 ? 14 : 2.5, i % 4 ? color : '#ffffff', 160);
    }
    this.parts.spawn(PK.Star, x, y, 0, 0, 0.3, 80, '#ffffff', 0);
    sfx.boom();
  }

  // 7) Tempestade: luzes a falhar, relâmpagos cada vez mais perto e o lutador aparece no último
  private *entTrovao(f: Fighter, side: number, beam: Beam): Script {
    f.hidden = true;
    beam.life = 0;
    this.darkenTarget = 0.85;
    const xs = [side * 420, -side * 300, side * 120];
    for (const x of xs) {
      if (this.stage) this.stage.flicker = 0.4;
      yield 0.35;
      this.thunder(x);
      yield 0.25;
    }
    f.x = side * 210;
    f.z = 0;
    f.facing = -side as 1 | -1;
    this.bolts.push({ x: f.x, y0: -1400, y1: 0, life: 0.5, color: '#9be8ff', seed: Math.random() * 999, width: 22 });
    this.flash = 1;
    this.flashColor = '#cfefff';
    this.shake(18, 0.5);
    sfx.zap();
    sfx.boom();
    f.hidden = false;
    beam.life = 99;
    beam.color = '#9be8ff';
    beam.x = f.x;
    f.glow = '#9be8ff';
    yield* this.pose(f, 'rise', 1.0, 0.06, () => this.sparks(f.x + (Math.random() - 0.5) * 80, -60 - Math.random() * 120, 3, '#9be8ff', 400), beam);
    f.glow = null;
    yield* this.pose(f, 'flex', 1.1, 0.4, () => this.thunder((Math.random() - 0.5) * 2 * RING), beam);
  }

  // 8) Real: passadeira vermelha, fanfarra, fontes de ouro e confettis dourados
  private *entRei(f: Fighter, side: number, beam: Beam): Script {
    const GOLD = ['#ffd23d', '#ffe680', '#fff6c2', '#e0a800'];
    sfx.levelUp();
    let t = 0;
    while (t < 0.9) {
      t += this.dt;
      if (this.stage) this.stage.carpet = Math.min(1, t / 0.9);
      yield FRAME;
    }
    yield* this.stepThrough(f, side, beam);
    // caminha devagar pela passadeira
    f.play('victory');
    while (Math.abs(f.x - side * 210) > 6) {
      f.vx = -side * 90;
      beam.x = f.x;
      if (Math.random() < 0.5) this.confetti(f.x, 3, GOLD);
      yield FRAME;
    }
    f.vx = 0;
    f.facing = -side as 1 | -1;
    sfx.levelUp();
    yield* this.pose(f, 'victory', 2.0, 0.05, () => {
      for (const sx of [-1, 1]) this.parts.spawn(PK.Ember, sx * (FRONT_X - 20), FRONT_Y - POST_H, (Math.random() - 0.5) * 80, -520 - Math.random() * 180, 0.9, 18, '#ffd23d', 900);
      if (Math.random() < 0.3) this.confetti(f.x, 8, GOLD);
    }, beam);
  }

  // 9) Dragão: sobrevoa a arena duas vezes, cospe fogo no ringue e o lutador sai das chamas
  private *entDragao(f: Fighter, side: number, beam: Beam): Script {
    f.hidden = true;
    beam.life = 0;
    this.projs.push({ kind: 'dragon', x: -side * 1200, y: -460, vx: side * 1500, life: 1.6, dir: side, color: '#ff5a00' });
    sfx.fire();
    yield 1.1;
    this.projs.push({ kind: 'dragon', x: side * 1200, y: -330, vx: -side * 1100, life: 1.9, dir: -side, color: '#ff5a00' });
    sfx.fire();
    let t = 0;
    while (t < 1.4) {
      t += this.dt;
      // labaredas a cair sobre o centro
      for (let i = 0; i < 4; i++) this.parts.spawn(PK.Ember, (Math.random() - 0.5) * 160, -320 + Math.random() * 40, (Math.random() - 0.5) * 200, 500 + Math.random() * 300, 0.6, 30, i % 2 ? '#ffd000' : '#ff5a00', 0);
      yield FRAME;
    }
    f.x = 0;
    f.facing = -side as 1 | -1;
    f.hidden = false;
    this.wave(0, 0, 500, '#ff5a00', 0.8);
    this.flash = 0.6;
    this.flashColor = '#ffb070';
    sfx.boom();
    beam.life = 99;
    beam.color = '#ffb070';
    beam.x = 0;
    yield* this.pose(f, 'rise', 1.0, 0.04, () => this.parts.spawn(PK.Ember, (Math.random() - 0.5) * 200, -10, 0, -300, 0.6, 26, '#ff7a1a', 0), beam);
    yield* this.walkTo(f, side * 210, 140, beam);
    f.facing = -side as 1 | -1;
    yield* this.pose(f, 'point', 0.8, 0.3, () => this.sparks(f.x, -100, 12, '#ff7a1a', 600, PK.Ember), beam);
  }

  // 10) Cósmica: a arena vira espaço, abre-se um portal e o lutador desce devagar
  private *entCosmica(f: Fighter, side: number, beam: Beam): Script {
    f.hidden = true;
    this.cosmic = 1;
    beam.color = '#b9a6ff';
    let t = 0;
    while (t < 1) {
      t += this.dt;
      if (this.stage) this.stage.portal = t;
      yield FRAME;
    }
    f.x = 0;
    f.z = 420;
    f.facing = -side as 1 | -1;
    f.hidden = false;
    f.wings = true;
    f.play('wings');
    beam.x = 0;
    sfx.charge();
    t = 0;
    while (f.z > 0) {
      t += this.dt;
      f.z = Math.max(0, 420 - t * 220);
      f.vz = 0;
      if (Math.random() < 0.7) this.parts.spawn(PK.Star, f.x + (Math.random() - 0.5) * 80, -f.z - 80, 0, 40, 0.8, 10, Math.random() < 0.5 ? '#ffffff' : '#9b7aff', 0);
      if (Math.random() < 0.3) this.parts.spawn(PK.Ember, (Math.random() - 0.5) * 1600, -900, 500, 900, 1.2, 22, Math.random() < 0.5 ? '#9b7aff' : '#7af7ff', 0);
      yield FRAME;
    }
    f.wings = false;
    this.wave(0, 0, 600, '#9b7aff', 0.8);
    this.flash = 0.7;
    this.flashColor = '#d9ccff';
    sfx.boom();
    if (this.stage) this.stage.portal = 0;
    yield* this.walkTo(f, side * 210, 130, beam);
    f.facing = -side as 1 | -1;
    yield* this.pose(f, 'flex', 1.2, 0.08, () => this.parts.spawn(PK.Star, f.x + (Math.random() - 0.5) * 200, -50 - Math.random() * 200, 0, -20, 0.6, 8, '#ffffff', 0), beam);
  }

  private confetti(x: number, n: number, colors: string[]): void {
    for (let i = 0; i < n; i++) {
      this.parts.spawn(PK.Confetti, x + (Math.random() - 0.5) * 700, -700 - Math.random() * 200, (Math.random() - 0.5) * 160, Math.random() * 80, 3, 5, colors[i % colors.length], 140);
    }
  }



  private thunder(x: number): void {
    this.bolts.push({ x, y0: -1400, y1: 0, life: 0.3, color: '#9be8ff', seed: Math.random() * 999, width: 12 });
    this.flash = Math.max(this.flash, 0.5);
    this.flashColor = '#cfefff';
    this.shake(8, 0.2);
    this.sparks(x, -6, 18, '#9be8ff', 600);
    sfx.zap();
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
    return s * (0.72 + 0.28 * (f.stamina / 100));
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
    this.slowScale = scale;
    this.slowT = t;
  }

  /**
   * Câmara lenta cinematográfica à volta do momento-chave de um golpe: entra depressa
   * (~0.1 s), mantém a escala e volta suavemente a 1 nos últimos 40% (`dur` em tempo real).
   * Sem `force`, no máximo uma vez a cada 3 s para as lutas não se arrastarem.
   */
  cinematic(x: number, y: number, scale = 0.3, dur = 0.8, force = false): void {
    if (this.phase !== 'fight') return;
    if (this.cineT > 0) {
      // já há uma em curso (os scripts chamam isto dentro de ciclos): só um super a prolonga,
      // sem recomeçar a entrada
      if (!force || this.cineMax - this.cineT < 0.4) return;
      this.cineT = dur;
      this.cineMax = dur + 0.1;
    } else {
      if (!force && this.rt - this.lastCine < 3) return;
      this.cineT = dur;
      this.cineMax = dur;
    }
    this.lastCine = this.rt;
    this.cineScale = scale;
    this.cineX = x;
    this.cineY = y;
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

  /**
   * Distância entre ancas para o golpe tocar exatamente no alvo:
   * alcance do punho/pé + o quanto a cabeça/peito do alvo sobressai, menos um pouco de "impacto".
   */
  contactDist(f: Fighter, o: Fighter, anim: AnimName, joint: number, body: boolean): number {
    const reach = reachOf(anim, joint) * this.scale(f);
    return reach + this.frontOf(o, f, body) - 7;
  }

  /**
   * Quanto a cabeça (ou o peito) do alvo sobressai da anca na direção do atacante, com a pose atual
   * (um alvo a recuar de um golpe anterior tem a cabeça mais para trás).
   */
  private frontOf(o: Fighter, f: Fighter, body: boolean): number {
    const so = this.scale(o);
    const dir = o.x >= f.x ? 1 : -1;
    const lean = (this.hipX(o) - this.jx(o, body ? J_NECK : J_HEAD)) * dir;
    return clamp(lean + (body ? 20 : HEAD_R) * so, -30 * so, 60 * so);
  }

  /** Ajusta a posição durante a preparação do golpe para chegar à distância de contacto. */
  private *lungeTo(f: Fighter, o: Fighter, dist: number, dur: number, body = false): Script {
    let t = 0;
    const total = Math.max(0.05, dur);
    // a distância acompanha a pose do alvo (ex.: cabeça a recuar depois de um golpe)
    const base = dist - this.frontOf(o, f, body);
    while (t < total) {
      const step = this.dt * this.spd(f);
      t += step;
      if (o.state !== 'ko' && o.state !== 'out') {
        f.face(o);
        const want = o.x - f.facing * (base + this.frontOf(o, f, body));
        const d = want - f.x;
        // velocidade limitada: um passo de boxe, não um teletransporte
        const maxMove = 520 * step;
        f.x += clamp(d * Math.min(1, step / Math.max(0.02, total - t + step)), -maxMove, maxMove);
      }
      yield FRAME;
    }
    this.lastLunge = base + this.frontOf(o, f, body);
  }

  /** Gasta estamina (a Resistência reduz o custo). */
  tire(f: Fighter, n: number): void {
    f.stamina = Math.max(0, f.stamina - n * (1 - Math.min(0.4, f.s.res * 0.004)));
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
    this.rt += rawDt;
    let ts = 1;
    if (this.slowT > 0) {
      this.slowT -= rawDt;
      ts = this.slowScale;
    }
    if (this.cineT > 0) {
      this.cineT = Math.max(0, this.cineT - rawDt);
      const el = this.cineMax - this.cineT;
      const w = Math.min(clamp(el / 0.1, 0, 1), clamp(this.cineT / (this.cineMax * 0.4), 0, 1));
      this.cineW = w * w * (3 - 2 * w);
      ts = Math.min(ts, 1 + (this.cineScale - 1) * this.cineW);
    } else this.cineW = 0;
    this.timeScale = ts;
    const dt = rawDt * this.timeScale;
    this.dt = dt;
    this.t += dt;
    this.phaseT += dt;

    if (this.phase === 'entrance' && (!this.entCur || !this.entCur.script)) {
      const next = this.entQueue.shift();
      if (next) {
        this.entCur = next;
        next.hidden = false;
        next.run(this.entrance(next));
      } else if (this.showcase) {
        // na montra a luta nunca começa: fica parado em pose até a cena recomeçar
        this.showcaseDone = true;
      } else {
        this.endEntrances();
      }
    }
    if (this.phase === 'intro' && this.phaseT > 0.1 && this.phaseT - dt <= 0.1) {
      this.banner('GET READY...', this.mode === 'tag' ? 'TAG TEAM' : this.mode === 'champion' ? 'CHAMPION CHALLENGE' : 'FIGHT', '#ffffff', 1.1);
    }
    if (this.phase === 'intro' && this.phaseT > 1.6) {
      this.phase = 'fight';
      this.phaseT = 0;
      this.banner('FIGHT!', '', '#ffd23d', 1.0, 1.3);
      this.emit('start', this.active[0], this.active[1]);
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
    if (this.phase === 'fight' && !this.demo) {
      this.clock -= dt;
      if (this.clock <= 0) this.timeUp();
    }
    if (this.phase === 'finish' || this.phase === 'end') {
      if (this.phase === 'end' && !this.ended && this.phaseT > 2.6) this.finish();
    }

    for (const f of this.fighters) this.updateFighter(f, dt);
    for (const e of this.extras) this.updateExtra(e, dt);
    if (this.extras.length) this.extras = this.extras.filter((e) => !e.hidden);
    if (this.darkenTarget > 0 && !this.fighters.some((f) => f.glow)) this.darkenTarget = 0;
    this.resolveOverlap();
    this.ropeContacts();
    updateRopes(this.ropes, dt);
    this.hype = Math.max(0.15, this.hype - dt * 0.03);
    crowdLevel(this.hype);
    this.updateFx(dt);
    this.updateCamFx(rawDt);
  }

  emit(ev: string, a?: Fighter, b?: Fighter, extra?: string): void {
    this.onEvent?.(ev, a, b, extra);
  }

  /** Anuncia um golpe de assinatura: faixa grande com retrato e nome. */
  special(f: Fighter, moveId: string, force = false): void {
    const d = ITEMS[moveId];
    if (!d) return;
    f.used(moveId, moveId === 'm_stomp' || moveId === 'm_elbow' ? 6 : 11);
    this.emit('move', f, this.opp(f), d.name);
    if (!force && this.t - this.lastCallT < 3.5) return;
    this.lastCallT = this.t;
    const COLORS: Record<string, string> = { comum: '#ffd23d', incomum: '#5ef08a', raro: '#4ab8ff', epico: '#c77dff', lendario: '#ffb31a', mitico: '#ff4f7b', celestial: '#7af7ff' };
    this.moveCall = { name: f.spec.name, move: d.name, icon: d.icon, color: COLORS[d.rarity] ?? '#ffd23d', team: f.team, t: 0, max: 1.15 };
    this.addHype(0.08);
  }

  private updateCamFx(rawDt: number): void {
    if (this.moveCall) {
      this.moveCall.t += rawDt;
      if (this.moveCall.t >= this.moveCall.max) this.moveCall = null;
    }
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
    for (const b of this.bursts) b.life -= dt;
    this.bursts = this.bursts.filter((b) => b.life > 0);
    if (this.lasersT > 0) this.lasersT -= dt;
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
    f.clockT = this.t;
    if (f.state === 'apron') {
      this.updateApron(f, dt);
      f.animate(dt, this.t);
      return;
    }
    if (f.state === 'out') {
      this.updateExtra(f, dt);
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
    // estamina, atordoamento e tempo no ringue
    const resk = 1 + f.s.res * 0.012;
    const regen = f.script ? 2.5 : f.state === 'idle' ? (f.anim === 'tired' ? 22 : 9) : 4;
    f.stamina = Math.min(100, f.stamina + regen * resk * dt);
    f.daze = Math.max(0, f.daze - 9 * dt);
    if (this.phase === 'fight' && this.active[f.team] === f) f.inRingT += dt;
    if (f.stunT > 0 && f.state === 'hit' && Math.random() < dt * 9) {
      const a = this.t * 6 + Math.random();
      this.parts.spawn(PK.Star, this.jx(f, J_HEAD) + Math.cos(a) * 28, this.jy(f, J_HEAD) - 34 + Math.sin(a) * 8, -Math.sin(a) * 40, 0, 0.45, 9, '#ffe27a', 0);
    }
    if (f.stamina < 25 && f.state !== 'down' && f.state !== 'ko' && Math.random() < dt * 2.5) {
      this.parts.spawn(PK.Sweat, this.jx(f, J_HEAD) + (Math.random() - 0.5) * 30, this.jy(f, J_HEAD) - 10, (Math.random() - 0.5) * 120, -120, 0.5, 2.2, '#bfe6ff', 900);
    }
    // Bênção: 1 de vida a cada 3 s (antes 1%/s era forte demais)
    if (f.has('p_bencao') && f.hp > 0 && f.state !== 'ko') f.hp = Math.min(f.maxHp, f.hp + dt / 3);
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
          if (!this.demo || this.demoAI) this.think(f, dt);
          break;
        case 'hit':
          if (f.stateT > Math.max(0.32, f.stunT)) {
            f.stunT = 0;
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
      const lim = ROPE_LINE_X - BODY_HALF;
      if (f.noClamp && !f.script && this.phase !== 'entrance' && (f.state as string) !== 'apron' && (f.state as string) !== 'out') f.noClamp = false;
      if (Math.abs(f.x) > lim && !f.noClamp && (f.state as string) !== 'apron' && (f.state as string) !== 'out') {
        const side = f.x > 0 ? 1 : 0;
        if (Math.abs(f.vx) > 260) {
          pushRope(this.ropes, side as 0 | 1, Math.abs(f.vx) * 0.75);
          sfx.ropes();
          if (!f.script) {
            f.vx = -f.vx * 0.55;
            sfx.whoosh();
          }
        }
        f.x = Math.sign(f.x) * lim;
      }
    }
    if (f.spinRate !== 0) f.spinAng += f.spinRate * dt;
    // os scripts esperam em tempo "spd" (velocidade/estamina): a animação tem de andar ao mesmo ritmo,
    // senão o impacto do golpe chega antes/depois de o braço/perna estar esticado
    const animK = f.script && f.state === 'act' ? this.spd(f) : 1;
    f.animate(dt * animK, this.t, (f.override ? f.override.rot : 0) + f.spinAng);
  }

  /** Eliminado a sair do ringue / árbitro: só script, deslocação e animação (nada de lógica de luta). */
  private updateExtra(f: Fighter, dt: number): void {
    if (f.script) this.runScript(f, dt, 1);
    // a altura (z) é toda conduzida pelos scripts: < 0 = no chão do pavilhão, fora do ringue
    if (!f.override) f.x += f.vx * dt;
    f.animate(dt, this.t, f.override ? f.override.rot : 0);
  }

  private runScript(f: Fighter, dt: number, s = this.spd(f)): void {
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
    // um lutador a recuar de um golpe (corpo inclinado para trás) deixa o outro chegar mais perto
    const min = 60 * (this.scale(a) + this.scale(b)) * 0.5 * (a.state === 'hit' || b.state === 'hit' ? 0.75 : 1);
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
    this.banner('TIME!', 'Judges\' decision', '#ffffff', 1.6);
    sfx.bell();
    this.declareWinner(w, null);
  }

  // ───────────────────────── Avental (tag team) ─────────────────────────

  private updateApron(f: Fighter, dt: number): void {
    f.face(0);
    if (f.hp < f.maxHp) f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.012 * dt);
    f.stamina = Math.min(100, f.stamina + 25 * dt);
    f.daze = 0;
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
    // ritmo de luta: decide com calma (trocas claras em vez de golpes sem parar)
    f.thinkT = 0.18 + Math.random() * 0.34;
    f.vx = 0;
    const r = Math.random();

    if (this.mode === 'tag' && this.tryTag(f)) return;

    // cansado: afasta-se e recupera o fôlego
    if (f.stamina < 22 && o.state !== 'down' && Math.random() < 0.65) {
      f.run(this.catchBreath(f, o));
      return;
    }
    // clinch quando ambos estão cansados e colados
    if (dist < 85 && f.stamina < 40 && o.stamina < 45 && o.state === 'idle' && !o.script && Math.random() < 0.25) {
      f.run(this.clinch(f, o));
      return;
    }

    if (f.meter >= 100 && o.state !== 'down' && o.state !== 'thrown' && o.z < 10 && Math.random() < 0.8) {
      const sup = f.spec.supers[Math.floor(Math.random() * f.spec.supers.length)] ?? 's_supersoco';
      f.run(this.superMove(f, o, sup), true);
      return;
    }

    if (o.state === 'down') {
      const canDive = f.can('m_splash') || f.can('m_moonsault');
      if (o.downT > 0.8 && f.diveCd <= 0 && r < (canDive ? 0.5 : 0.22) + f.s.esq * 0.004) {
        f.run(this.topRopeDive(f, o));
        return;
      }
      if (f.tauntCd <= 0 && r < 0.6 && f.meter < 100) {
        f.run(this.taunt(f));
        return;
      }
      if (dist < 100 && (f.can('m_stomp') || f.can('m_elbow'))) {
        const elbow = f.can('m_elbow') && (!f.can('m_stomp') || Math.random() < 0.5);
        f.run(elbow ? this.elbowDrop(f, o) : this.stomp(f, o));
        return;
      }
      f.wantX = o.x - f.facing * 95;
      return;
    }

    // os primeiros segundos são para se estudarem e trocarem golpes; os golpes de corrida
    // (cordas, spear, dropkick, cutter) só aparecem com a luta lançada e o adversário já tocado
    const opened = this.phaseT > 9 || o.hp < o.maxHp * 0.85;
    const worn = o.hp < o.maxHp * 0.75 || o.stunT > 0 || o.stamina < 40;
    if (dist > 250) {
      const behind = f.facing === 1 ? f.x + RING : RING - f.x;
      if (opened && worn && r < 0.14 && behind > 220) f.run(f.can('m_lariat') && Math.random() < 0.5 ? this.ropeRun(f, o) : this.reboundCrossbody(f, o));
      else if (opened && worn && r < 0.22 && behind > 120 && f.diveCd <= 0) f.run(this.springboard(f, o));
      else if (opened && worn && r < 0.28 && f.diveCd <= 0 && (o.stunT > 0 || o.stamina < 45)) f.run(this.topRopeDive(f, o, true));
      else if (opened && r < 0.2 && dist < 330 && f.can('m_dropkick')) f.run(this.dropkick(f, o));
      else f.wantX = o.x - f.facing * 95;
      return;
    }
    if (dist > 110) {
      if (opened && r < 0.1 && dist < 260 && o.state === 'idle' && f.can('m_spear')) f.run(this.spear(f, o));
      else if (opened && worn && r < 0.16 && f.diveCd <= 0) f.run(Math.random() < 0.5 ? this.springboard(f, o) : this.reboundCrossbody(f, o));
      else if (opened && r < 0.15 && dist > 130 && f.can('m_dropkick')) f.run(this.dropkick(f, o));
      else if (opened && r < 0.26 && f.can('m_cutter') && o.state === 'idle') f.run(this.cutter(f, o));
      else if (r < 0.32 && f.tauntCd <= 0 && f.s.car > 15) f.run(this.taunt(f));
      else f.wantX = o.x - f.facing * (88 + Math.random() * 12);
      return;
    }
    // ao alcance
    const st = f.s;
    const stunned = o.state === 'hit';
    const close = dist < 90;
    const opts: [number, () => Script][] = [
      [3.2 + st.vel * 0.04, () => this.combo(f, o)],
      [2 + st.for * 0.03 + (stunned ? 2 : 0), () => this.heavy(f, o)],
      [close ? 0.55 + st.agr * 0.03 + (stunned ? 0.8 : 0) : 0, () => this.grapple(f, o)],
      [close && opened && f.can('m_irish') ? 0.35 + st.agr * 0.01 : 0, () => this.irishWhip(f, o)],
      [f.can('m_cutter') && stunned ? 0.6 : 0, () => this.cutter(f, o)],
      [1.7 + (f.stamina < 50 ? 1 : 0), () => this.stepBack(f)],
      [0.7, () => this.feint(f, o)],
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
      // footwork de boxe: entra e sai da distância, nunca fica parado muito tempo
      if (dist < 60) f.wantX = f.x - f.facing * 30;
      else if (o.state !== 'down' && Math.random() < this.dt * 2.2) {
        const step = Math.random() < (dist > 120 ? 0.75 : 0.4) ? 22 + Math.random() * 18 : -(18 + Math.random() * 20);
        f.wantX = clamp(f.x + f.facing * step, -RING + 30, RING - 30);
      } else {
        f.vx = 0;
        f.play(f.stamina < 22 ? 'tired' : 'guard', 1, false);
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
    // nas demonstrações dos menus o golpe mostra-se sempre completo
    if (this.demo) return;
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
    this.pop('COUNTER!', f.x, this.jy(f, J_HEAD) - 40, '#7ad7ff', 30);
    this.emit('counter', f, o);
    f.play('hook', 1.4);
    const cd = this.contactDist(f, o, 'hook', J_FH, false);
    yield* this.lungeTo(f, o, cd, 0.2);
    const bonus = f.has('p_muralha') ? 1.4 : 1;
    this.strike(f, o, { dmg: 18 * bonus, reach: Math.max(cd, this.lastLunge) + 25, kind: 'punch', heavy: true, kb: 160, unblockable: true, hitJ: J_FH });
    yield 0.25;
  }

  // ───────────────────────── Golpes ─────────────────────────

  private *combo(f: Fighter, o: Fighter): Script {
    const n = 2 + Math.floor(Math.random() * (2 + f.s.vel / 25));
    const seq: ('jab' | 'cross' | 'hook' | 'body')[] = ['jab', 'cross', 'jab', 'hook', 'body', 'cross'];
    const start = Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const m = seq[(start + i) % seq.length];
      f.face(o);
      f.play(m);
      this.tire(f, m === 'jab' ? 3 : m === 'cross' ? 4 : m === 'hook' ? 6 : 5);
      const hit = m === 'jab' ? 0.14 : m === 'cross' ? 0.18 : m === 'hook' ? 0.23 : 0.2;
      const joint = m === 'cross' || m === 'body' ? J_BH : J_FH;
      const cd = this.contactDist(f, o, m, joint, m === 'body');
      this.telegraph(f, o, 'punch', m !== 'body');
      yield* this.lungeTo(f, o, cd, hit, m === 'body');
      const dmg = m === 'jab' ? 8 : m === 'cross' ? 11 : m === 'hook' ? 15 : 12;
      const landed = this.strike(f, o, { dmg, reach: Math.max(cd, this.lastLunge) + 22, kind: 'punch', body: m === 'body', kb: m === 'hook' ? 120 : 70, hitJ: joint });
      yield m === 'jab' ? 0.12 : 0.2;
      if (!landed || o.state === 'down' || o.state === 'ko') break;
    }
    yield 0.12;
  }

  private *heavy(f: Fighter, o: Fighter): Script {
    const r = Math.random();
    this.tire(f, 8);
    const st = o.stunT > 0;
    const hitWith = (anim: AnimName, joint: number, body: boolean) => this.contactDist(f, o, anim, joint, body);
    if (r < 0.26) {
      f.play('upper');
      this.telegraph(f, o, 'punch', true);
      const cd = hitWith('upper', J_FH, false);
      yield* this.lungeTo(f, o, cd, 0.27);
      this.strike(f, o, { dmg: 22, reach: Math.max(cd, this.lastLunge) + 22, kind: 'punch', heavy: true, kd: st && Math.random() < 0.4, launch: 380, kb: 140, hitJ: J_FH });
      yield 0.4;
    } else if (r < 0.46) {
      f.play('hook');
      this.telegraph(f, o, 'punch', true);
      const cd = hitWith('hook', J_FH, false);
      yield* this.lungeTo(f, o, cd, 0.23);
      this.strike(f, o, { dmg: 17, reach: Math.max(cd, this.lastLunge) + 22, kind: 'punch', heavy: true, kb: 200, kd: st && Math.random() < 0.45, hitJ: J_FH });
      yield 0.3;
    } else if (r < 0.64) {
      f.play('kick');
      this.telegraph(f, o, 'kick', false);
      const cd = hitWith('kick', J_FF, true);
      yield* this.lungeTo(f, o, cd, 0.26, true);
      this.strike(f, o, { dmg: 19, reach: Math.max(cd, this.lastLunge) + 25, kind: 'kick', heavy: true, kb: 320, body: true, kd: st && Math.random() < 0.5, hitJ: J_FF });
      yield 0.38;
    } else if (r < 0.8 && f.can('m_superkick')) {
      yield* this.superkick(f, o);
    } else {
      f.play('body');
      this.telegraph(f, o, 'punch', false);
      let cd = hitWith('body', J_BH, true);
      yield* this.lungeTo(f, o, cd, 0.2, true);
      this.strike(f, o, { dmg: 14, reach: Math.max(cd, this.lastLunge) + 22, kind: 'punch', body: true, kb: 60, hitJ: J_BH });
      yield 0.12;
      f.play('upper', 1.2);
      cd = hitWith('upper', J_FH, false);
      yield* this.lungeTo(f, o, cd, 0.22);
      this.strike(f, o, { dmg: 18, reach: Math.max(cd, this.lastLunge) + 22, kind: 'punch', heavy: true, kd: st && Math.random() < 0.4, launch: 300, kb: 120, hitJ: J_FH });
      yield 0.35;
    }
  }

  /** Superkick: pontapé alto ao queixo. */
  private *superkick(f: Fighter, o: Fighter): Script {
    const st = o.stunT > 0;
    const hitWith = (anim: AnimName, joint: number, body: boolean) => this.contactDist(f, o, anim, joint, body);
    this.special(f, 'm_superkick');
    f.play('superkick');
    this.tire(f, 4);
    this.telegraph(f, o, 'kick', true);
    const cd = hitWith('superkick', J_FF, false);
    yield* this.lungeTo(f, o, cd, 0.15);
    this.cinematic((f.x + o.x) / 2, -170, 0.3, 0.8);
    yield* this.lungeTo(f, o, cd, 0.09);
    const ok = this.strike(f, o, { dmg: 21, reach: Math.max(cd, this.lastLunge) + 25, kind: 'kick', heavy: true, kb: 260, kd: !!this.demo || Math.random() < (st ? 0.85 : 0.5), launch: 300, hitJ: J_FF });
    if (ok) {
      this.pop('SUPERKICK!', f.x, -250, '#ffd23d', 26);
      this.styleFx(f, 'superkick', this.jx(f, J_FF), this.jy(f, J_FF));
    }
    yield 0.45;
  }

  // ───────────────────────── Demonstração nos menus ─────────────────────────

  /** Repete o item em demonstração: repõe os dois lutadores e executa o golpe/super/passiva. */
  private *demoLoop(a: Fighter, b: Fighter, id: string): Script {
    const d = ITEMS[id];
    if (!d) return;
    const move = d.kind === 'moveStyle' ? ITEM_LIST.find((m) => m.kind === 'move' && m.vis?.type === d.vis?.type)?.id ?? 'm_dropkick' : id;
    for (;;) {
      // repor
      for (const f of [a, b]) {
        f.hp = f.maxHp;
        f.z = 0;
        f.vx = 0;
        f.vz = 0;
        f.spinAng = 0;
        f.noClamp = false;
        f.perchSide = -1;
        f.stunT = 0;
        f.daze = 0;
        f.holding = null;
        f.cds.clear();
        f.usedFenix = false;
        f.usedFolego = false;
      }
      b.stop();
      b.setState('idle');
      b.play('guard');
      a.play('guard');
      a.x = -170;
      b.x = 150;
      a.facing = 1;
      b.facing = -1;
      yield 0.7;
      if (d.kind === 'super') {
        a.meter = 100;
        b.x = a.x + 130;
        yield* this.superMove(a, b, id);
      } else if (d.kind === 'passive') {
        // combate livre: a passiva faz efeito naturalmente
        if (id === 'p_folego' || id === 'p_fenix' || id === 'p_furia') a.hp = Math.round(a.maxHp * 0.24);
        if (id === 'p_showman') a.meter = 0;
        let t = 0;
        while (t < 7) {
          t += this.dt;
          if (b.hp < b.maxHp * 0.35) b.hp = b.maxHp;
          yield FRAME;
        }
        continue;
      } else yield* this.demoMove(a, b, move);
      // espera que assente
      let w = 0;
      while (w < 3 && (b.state === 'thrown' || b.z > 0 || a.z > 0)) {
        w += this.dt;
        yield FRAME;
      }
      yield 1.5;
    }
  }

  private *demoMove(a: Fighter, b: Fighter, move: string): Script {
    const near = (gap: number) => {
      b.x = a.x + gap;
      a.facing = 1;
      b.facing = -1;
    };
    // derruba-o primeiro com um golpe a sério (ninguém se deita sozinho)
    const takeDown = function* (this: Fight): Script {
      near(78);
      a.play('grab');
      yield 0.25;
      if (Math.random() < 0.5) yield* this.bodySlam(a, b, 0.5);
      else yield* this.suplex(a, b, 0.5, false);
      b.downT = Math.max(b.downT, 5);
      a.face(b);
      a.play('guard');
      yield 0.25;
    }.bind(this);
    switch (move) {
      case 'm_stomp':
        yield* takeDown();
        yield* this.stomp(a, b);
        break;
      case 'm_elbow':
        yield* takeDown();
        yield* this.elbowDrop(a, b);
        break;
      case 'm_irish':
        near(80);
        yield* this.irishWhip(a, b);
        break;
      case 'm_lariat':
        a.x = 60;
        b.x = 260;
        a.facing = 1;
        b.facing = -1;
        yield* this.ropeRun(a, b);
        break;
      case 'm_dropkick':
        near(250);
        yield* this.dropkick(a, b);
        break;
      case 'm_spear':
        near(240);
        yield* this.spear(a, b);
        break;
      case 'm_superkick':
        near(150);
        yield* this.superkick(a, b);
        break;
      case 'm_ddt':
      case 'm_powerbomb':
      case 'm_chokeslam':
        near(78);
        a.play('grab');
        yield 0.2;
        if (move === 'm_ddt') yield* this.ddt(a, b);
        else if (move === 'm_powerbomb') yield* this.powerbomb(a, b);
        else yield* this.chokeslam(a, b);
        break;
      case 'm_cutter':
        near(170);
        yield* this.cutter(a, b);
        break;
      case 'm_splash':
      case 'm_moonsault':
        a.x = -60;
        yield* takeDown();
        a.diveCd = 0;
        yield* this.topRopeDive(a, b);
        break;
    }
  }

  /** Spear: placagem a correr, ombro ao abdómen, os dois caem. */
  private *spear(f: Fighter, o: Fighter): Script {
    this.tire(f, 12);
    this.special(f, 'm_spear');
    const sty = f.styleOf('spear');
    f.face(o);
    f.play('run');
    f.vx = f.facing * 300;
    yield 0.18;
    f.play('spear');
    this.telegraph(f, o, 'grapple', false);
    let t = 0;
    // o ombro (inclinado bem para a frente) entra no abdómen dele
    const hitD = Math.max(this.contactDist(f, o, 'spear', J_NECK, true), 64 * (this.scale(f) + this.scale(o)) * 0.5);
    while (Math.abs(o.x - f.x) > hitD && t < 1.2) {
      t += this.dt;
      f.vx = f.facing * 640;
      // câmara lenta mesmo antes do ombro entrar
      if (Math.abs(o.x - f.x) < hitD + 640 * 0.06 && o.state === 'idle') this.cinematic((f.x + o.x) / 2, -110, 0.3, 0.85);
      if (sty && Math.random() < 0.8) this.parts.spawn(PK.Ember, f.x - f.facing * 20, -60 - Math.random() * 50, -f.facing * 120, -40, 0.45, 26, sty.color, 0);
      yield FRAME;
    }
    f.vx = 0;
    if (Math.abs(o.x - f.x) > hitD + 14 || o.evade === 'dodge' || !this.canGrab(o)) {
      // falhou: passa ao lado / tropeça
      f.vx = f.facing * 260;
      yield 0.25;
      f.vx = 0;
      this.selfDown(f, 0.4);
      return;
    }
    this.strike(f, o, { dmg: 24, reach: 9999, kind: 'grapple', heavy: true, kd: true, kb: 380, launch: 160, unblockable: true, body: true, hitJ: J_NECK });
    this.pop('SPEAR!', f.x, -240, '#ff6a3d', 30);
    this.styleFx(f, 'spear', o.x, -90);
    if (f.spec.isPlayer) this.tally.grapples++;
    f.vx = f.facing * 300;
    yield 0.18;
    f.vx = 0;
    this.dust(f.x + f.facing * 40, 12, 90);
    this.selfDown(f, 0.35);
  }

  private *catchBreath(f: Fighter, o: Fighter): Script {
    f.play('walkBack');
    f.vx = -f.facing * 150;
    yield () => Math.abs(o.x - f.x) > 190 || Math.abs(f.x) > RING - 40;
    f.vx = 0;
    f.play('tired');
    if (Math.random() < 0.5) this.pop('RECOVERING...', f.x, this.jy(f, J_HEAD) - 50, '#9ad7ff', 18);
    yield 0.9;
    f.setState('idle');
  }

  private *feint(f: Fighter, o: Fighter): Script {
    f.play('jab', 0.7);
    this.tire(f, 1);
    this.telegraph(f, o, 'punch', true);
    yield 0.08;
    f.play('guard');
    yield 0.18;
    // se o adversário mordeu o isco, ataca já
    if (o.script && o.evade !== 'none' && Math.random() < 0.6) {
      yield 0.18;
      f.play('cross');
      this.tire(f, 4);
      yield 0.18;
      this.strike(f, o, { dmg: 13, reach: 110, kind: 'punch', kb: 90, unblockable: true });
      yield 0.2;
    }
  }

  private *clinch(f: Fighter, o: Fighter): Script {
    o.stop();
    o.setState('act');
    o.script = this.held(o, f);
    f.play('clinch');
    o.play('clinch');
    f.vx = f.facing * 80;
    yield 0.15;
    f.vx = 0;
    this.pop('CLINCH', (f.x + o.x) / 2, -260, '#ffffff', 20);
    for (let i = 0; i < 3; i++) {
      yield 0.35;
      if (o.state !== 'act') return;
      f.play('body', 1.4);
      yield 0.12;
      this.strike(f, o, { dmg: 5, reach: 120, kind: 'punch', body: true, kb: 0, unblockable: true, quiet: true });
      if (o.state !== 'act' && o.state !== 'hit') return;
      o.setState('act');
      o.script = this.held(o, f);
      f.play('clinch');
    }
    yield 0.2;
    f.play('cross', 1.2);
    yield 0.1;
    f.vx = -f.facing * 200;
    o.vx = f.facing * 200;
    yield 0.25;
    f.vx = 0;
  }

  private *held(o: Fighter, f: Fighter): Script {
    o.face(f);
    o.play('clinch');
    yield () => !f.script || f.anim === 'cross';
    o.play('guard');
    yield 0.3;
    o.vx = 0;
  }

  private *stepBack(f: Fighter): Script {
    // sai da distância e estuda o adversário antes de voltar a entrar
    f.play('walkBack');
    f.vx = -f.facing * 190;
    yield 0.38 + Math.random() * 0.2;
    f.vx = 0;
    f.play('guard');
    yield 0.3 + Math.random() * 0.45;
  }

  private canGrab(o: Fighter): boolean {
    return (o.state === 'idle' || o.state === 'hit' || (o.state === 'act' && !o.armor)) && o.z < 5 && !o.override;
  }

  private *grapple(f: Fighter, o: Fighter): Script {
    this.tire(f, 10);
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
      this.pop('ESCAPED!', o.x, this.jy(o, J_HEAD) - 40, '#5ef0c0', 26);
      o.run(this.pushAway(o, f));
      f.vx = -f.facing * 200;
      yield 0.3;
      f.vx = 0;
      return;
    }
    if (f.spec.isPlayer) this.tally.grapples++;
    const type = Math.random();
    const pool: (() => Script)[] = [() => this.suplex(f, o, 1, false), () => this.bodySlam(f, o, 1)];
    if (f.can('m_ddt')) pool.push(() => this.ddt(f, o));
    if (f.can('m_powerbomb')) pool.push(() => this.powerbomb(f, o), () => this.powerbomb(f, o));
    if (f.can('m_chokeslam')) pool.push(() => this.chokeslam(f, o), () => this.chokeslam(f, o));
    void type;
    yield* pool[Math.floor(Math.random() * pool.length)]();
  }

  private *pushAway(f: Fighter, o: Fighter): Script {
    f.play('cross', 1.2);
    yield 0.18;
    this.strike(f, o, { dmg: 6, reach: 110, kind: 'punch', kb: 220, quiet: true, unblockable: true });
    yield 0.25;
  }

  private lock(f: Fighter, o: Fighter): void {
    f.holding = o;
    o.facing = -f.facing as 1 | -1;
    o.stop();
    o.setState('thrown');
    o.evade = 'none';
    o.vx = 0;
    o.vz = 0;
    o.z = 0;
  }

  /** Tween do defensor preso nas mãos do atacante. */
  /**
   * Segura o adversário pelas mãos: a anca dele acompanha o ponto médio das mãos do atacante
   * (a animação do atacante é que o levanta e projeta, por isso o contacto fica sempre certo).
   * Offsets em coordenadas do atacante (x para a frente, y para baixo) e rotação do defensor.
   */
  private *carry(f: Fighter, o: Fighter, dur: number, from: [number, number, number], to: [number, number, number], ease = (t: number) => t, landX?: number): Script {
    let t = 0;
    const k = this.scale(f);
    if (!o.override) {
      // primeira pega: parte de onde o defensor está de facto (sem o "puxar" de repente para as mãos)
      const one = this.carryHand;
      const hx = one != null ? this.jx(f, one) : (this.jx(f, J_FH) + this.jx(f, J_BH)) / 2;
      const hy = one != null ? this.jy(f, one) : (this.jy(f, J_FH) + this.jy(f, J_BH)) / 2;
      from = [((this.hipX(o) - hx) * f.facing) / k, (this.hipY(o) - hy) / k, from[2]];
    }
    // fase final de uma projeção: o corpo vai largando as mãos e acaba deitado no tapete
    // exatamente onde land() o vai pousar (sem teleporte nem rotação extra no impacto)
    let gx = 0;
    let gy = 0;
    let grot = 0;
    if (landX != null) {
      gx = clamp(landX, -RING + 20, RING - 20);
      gy = this.lieHipY(o);
      const endRot = -to[2];
      // de que lado fica a cabeça no fim do movimento → para onde o deitado "olha"
      const sn = Math.sin(endRot);
      const F = (Math.abs(sn) > 0.3 ? -o.facing * Math.sign(sn) : gx < f.x ? 1 : -1) as 1 | -1;
      const base = F === o.facing ? -Math.PI / 2 : Math.PI / 2;
      grot = base + Math.PI * 2 * Math.round((endRot - base) / (Math.PI * 2));
      this.slamFacing = F;
    }
    while (t < dur) {
      t += this.dt * this.spd(f);
      const u = ease(clamp(t / dur, 0, 1));
      const one = this.carryHand;
      const hx = one != null ? this.jx(f, one) : (this.jx(f, J_FH) + this.jx(f, J_BH)) / 2;
      const hy = one != null ? this.jy(f, one) : (this.jy(f, J_FH) + this.jy(f, J_BH)) / 2;
      const x = hx + f.facing * (from[0] + (to[0] - from[0]) * u) * k;
      const y = hy + (from[1] + (to[1] - from[1]) * u) * k;
      const rot = (from[2] + (to[2] - from[2]) * u) * -1;
      if (landX != null) {
        const w = clamp(t / dur, 0, 1) ** 2;
        const r = rot + (grot - rot) * w;
        // nunca atravessa o tapete
        copyPose(tmpPose, o.pose);
        tmpPose.rot = o.pose.rot - (o.override?.rot ?? 0) + r;
        solve(tmpPose, tmpSkel);
        const ny = Math.min(y + (gy - y) * w, -tmpSkel.minY * this.scale(o));
        o.override = { x: x + (gx - x) * w, y: ny, rot: r };
      } else o.override = { x, y, rot };
      yield FRAME;
    }
  }

  /** Altura da anca de um lutador deitado de costas no tapete. */
  private lieHipY(o: Fighter): number {
    sample(ANIMS.lieKO, 0, tmpPose);
    solve(tmpPose, tmpSkel);
    return -tmpSkel.minY * this.scale(o);
  }

  private land(o: Fighter, x: number, dmgOwner: Fighter, dmg: number, kind: StrikeKind, big: number): void {
    dmgOwner.holding = null;
    o.override = null;
    o.x = clamp(x, -RING + 20, RING - 20);
    o.z = 0;
    const nf = this.slamFacing ?? ((o.x < dmgOwner.x ? 1 : -1) as 1 | -1);
    this.slamFacing = null;
    // a pose do ar funde-se com a pose deitada (sem saltos no impacto)
    o.blendIn(0.14, nf !== o.facing);
    o.facing = nf;
    o.setState('hit');
    this.strike(dmgOwner, o, { dmg, reach: 9999, kind, heavy: true, kd: true, unblockable: true, kb: 0, launch: 90, ground: true });
    this.settleLying(o, nf);
    if (o.state === 'down') {
      o.impact = Math.max(o.impact, 0.55 + big * 0.35);
      o.downT = Math.max(o.downT, 1.1 + big * 0.7 - o.s.res * 0.006);
    }
    this.shake(8 + big * 6, 0.3 + big * 0.1);
    this.dust(o.x, 10 + big * 8, 90);
    this.parts.spawn(PK.Ring, o.x, 0, 0, 0, 0.45, 140 + big * 80, '#ffffff', 0);
    sfx.slam(0.85 + big * 0.45);
    ringShake(this.ropes, 0.6 + big * 0.6);
    if (big > 0.5) sfx.oooh(0.8 + big * 0.4);
    this.addHype(0.1 + big * 0.1);
  }

  /** Já está deitado no tapete: só ressalta um pouco (sem voltar a pôr-se de pé para "cair" outra vez). */
  private settleLying(o: Fighter, facing: 1 | -1): void {
    if (o.state !== 'down' && o.state !== 'ko') return;
    o.play(o.state === 'ko' ? 'lieKO' : 'lie');
    o.facing = facing;
    o.vx *= 0.25;
    o.vz = Math.min(o.vz, 140);
  }

  private *suplex(f: Fighter, o: Fighter, power: number, atomic: boolean): Script {
    this.lock(f, o);
    o.play('hitBody');
    f.play('grab', 1.4);
    yield* this.carry(f, o, 0.12, [24, 40, 0], [16, 34, 0.3]);
    f.play('lift', 1);
    // levanta-o de cabeça para baixo por cima da cabeça
    yield* this.carry(f, o, 0.38, [16, 34, 0.3], [-4, 4, 2.9], (t) => t * t * (3 - 2 * t));
    f.play('arch');
    // ponte para trás: as costas dele batem no tapete atrás do atacante
    const lx = f.x - f.facing * 78 * this.scale(f);
    if (atomic) this.cinematic(lx, -60, 0.3, 0.8, true);
    yield* this.carry(f, o, 0.24, [-4, 4, 2.9], [-30, 30, 4.4], (t) => t * t, lx);
    o.play('lieKO');
    this.land(o, lx, f, 30 * power, 'grapple', atomic ? 3 : 1);
    this.pop(atomic ? 'ATOMIC SUPLEX!' : 'SUPLEX!', f.x, -230, '#ffb31a', 30);
    yield 0.45;
    f.play('archUp');
    yield 0.6;
  }

  private *bodySlam(f: Fighter, o: Fighter, power: number): Script {
    this.lock(f, o);
    o.play('hitBody');
    f.play('grab', 1.4);
    yield* this.carry(f, o, 0.12, [24, 40, 0], [18, 30, 0.6]);
    f.play('lift', 0.9);
    // deitado na horizontal por cima da cabeça
    yield* this.carry(f, o, 0.42, [18, 30, 0.6], [6, -6, 1.57], (t) => t * t * (3 - 2 * t));
    yield* this.carry(f, o, 0.18, [6, -6, 1.57], [6, -6, 1.57]);
    f.play('slam');
    const lx = f.x + f.facing * 72 * this.scale(f);
    yield* this.carry(f, o, 0.17, [6, -6, 1.57], [34, 36, 1.57], (t) => t * t, lx);
    o.play('lieKO');
    this.land(o, lx, f, 26 * power, 'grapple', 1);
    this.pop('SLAM!', f.x, -230, '#ff8a3d', 30);
    yield 0.6;
  }

  /** Powerbomb: senta-o nos ombros e esmaga-o de costas à frente. */
  private *powerbomb(f: Fighter, o: Fighter): Script {
    this.special(f, 'm_powerbomb');
    this.lock(f, o);
    o.play('hitBody');
    f.play('grab', 1.4);
    yield* this.carry(f, o, 0.14, [24, 40, 0], [16, 30, -0.9]);
    f.play('lift', 0.85);
    yield* this.carry(f, o, 0.45, [16, 30, -0.9], [4, -12, -2.75], (t) => t * t * (3 - 2 * t));
    yield* this.carry(f, o, 0.22, [4, -12, -2.75], [4, -12, -2.75]);
    f.play('slam', 1.1);
    const lx = f.x + f.facing * 80 * this.scale(f);
    this.cinematic(lx, -60, 0.3, 0.8);
    yield* this.carry(f, o, 0.16, [4, -12, -2.75], [44, 40, -4.5], (t) => t * t, lx);
    o.play('lieKO');
    this.land(o, lx, f, 32, 'grapple', 2);
    this.styleFx(f, 'powerbomb', o.x, 0);
    this.pop('POWERBOMB!', f.x, -240, '#ff3d6e', 32);
    yield 0.7;
  }

  private *ddt(f: Fighter, o: Fighter): Script {
    this.special(f, 'm_ddt');
    this.lock(f, o);
    o.play('hitBody');
    f.play('grab', 1.4);
    // chave de cabeça: dobra-o para a frente
    yield* this.carry(f, o, 0.22, [24, 40, 0], [22, 50, -1.2]);
    f.play('fall');
    const lx = f.x + f.facing * 55 * this.scale(f);
    // cai para trás, a afastar-se: a cabeça dele é que vai ao tapete à sua frente (sem cair em cima dele)
    f.vx = -f.facing * 150;
    this.cinematic(lx, -50, 0.32, 0.7);
    yield* this.carry(f, o, 0.2, [22, 50, -1.2], [20, 70, -2.7], (t) => t * t, lx);
    f.vx = 0;
    o.play('lieKO');
    this.land(o, lx, f, 24, 'grapple', 1);
    this.pop('DDT!', f.x, -230, '#ff8a3d', 30);
    this.selfDown(f, 0.5);
  }

  private *irishWhip(f: Fighter, o: Fighter): Script {
    this.tire(f, 8);
    this.special(f, 'm_irish');
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
    this.pop('INTO THE ROPES!', o.x, -220, '#ffffff', 22);
    // o defensor corre para as cordas e volta
    o.run(this.whipped(o, dir));
    yield 0.3;
    f.play('guard');
    f.face(o);
    yield () => o.vx * dir < 0 || o.state !== 'act';
    // escolhe já o remate para começar o golpe à distância certa (o braço/pé chega quando ele chega)
    const r = Math.random();
    const kind = r < 0.4 ? 'clothes' : r < 0.7 ? 'boot' : 'spine';
    const need = () => (kind === 'boot' ? this.contactDist(f, o, 'kick', J_FF, true) : kind === 'clothes' ? this.contactDist(f, o, 'clothes', J_FH, false) : 72 * this.scale(f));
    const lead = kind === 'boot' ? 0.26 : kind === 'clothes' ? 0.06 : 0;
    let tries = 0;
    while (o.state === 'act' && Math.abs(o.x - f.x) > need() + (Math.abs(o.vx) * lead) / this.spd(f) && (o.x - f.x) * f.facing > 0 && tries++ < 200) yield FRAME;
    if (o.state !== 'act') return;
    if (kind === 'clothes') {
      f.play('clothes');
      yield 0.06;
      this.cinematic((f.x + o.x) / 2, -150, 0.35, 0.6);
      this.strike(f, o, { dmg: 24, reach: 140, kind: 'punch', heavy: true, kd: true, unblockable: true, kb: 60, hitJ: J_FH });
      this.pop('CLOTHESLINE!', f.x, -230, '#ff6a3d', 28);
      yield 0.4;
    } else if (kind === 'boot') {
      f.play('kick');
      yield 0.18;
      this.cinematic((f.x + o.x) / 2, -150, 0.35, 0.6);
      yield 0.08;
      this.strike(f, o, { dmg: 22, reach: 160, kind: 'kick', heavy: true, kd: true, unblockable: true, kb: 160, body: true, hitJ: J_FF });
      this.pop('BIG BOOT!', f.x, -230, '#ff6a3d', 28);
      yield 0.45;
    } else {
      // spinebuster
      o.stop();
      yield* this.bodySlam(f, o, 1.1);
    }
  }

  /**
   * Corre contra as cordas na direção `dir`, afunda-se nelas (as cordas esticam a sério)
   * e ressalta para o lado contrário com mais velocidade.
   */
  /** Sobe pelas cordas de frente para elas (pé na de baixo, na do meio e na de cima) e fica empoleirado. */
  private *climbRopes(f: Fighter, side: number): Script {
    const sd = (side > 0 ? 1 : 0) as 0 | 1;
    f.noClamp = true;
    f.facing = side as 1 | -1;
    f.play('perch');
    f.blendIn(0.15);
    const footX = side * (ROPE_LINE_X - 10);
    for (let j = 0; j < 3; j++) {
      const z0 = f.z;
      const x0 = f.x;
      let t = 0;
      while (t < 0.17) {
        t += this.dt;
        const u = Math.min(1, t / 0.17);
        const e = u * u * (3 - 2 * u);
        f.x = x0 + (footX - x0) * Math.min(1, (j + e) / 2);
        f.z = z0 + (ropeHeightAt(this.ropes, sd, j) - z0) * e;
        f.vz = 0;
        if (j > 0) ropeHold(this.ropes, sd, j - 1, 2, 9 * (1 - e));
        ropeHold(this.ropes, sd, j, 2, 12 * e);
        yield FRAME;
      }
      sfx.ropes();
    }
    f.perchSide = sd;
  }

  /** Salta da corda de cima: ela dispara para cima e fica a vibrar. */
  private leaveRopes(f: Fighter, sd: 0 | 1): void {
    f.perchSide = -1;
    pushRope(this.ropes, sd, 60, 2, 520);
    pushRope(this.ropes, sd, 40, 1, 220);
    sfx.ropes();
  }

  /** Quem se encosta às cordas estica-as à volta do corpo. */
  private ropeContacts(): void {
    for (const f of this.fighters) {
      // se o guião foi interrompido (ex.: atingido), deixa de estar empoleirado
      if (f.perchSide >= 0 && !f.script) {
        f.perchSide = -1;
        f.noClamp = false;
      }
      if (f.perchSide >= 0) {
        // empoleirado: a corda de cima cede e balança debaixo dos pés
        const sd = f.perchSide as 0 | 1;
        const sway = Math.sin(this.t * 9 + f.x) * 3;
        ropeHold(this.ropes, sd, 2, 3, 14 + sway);
        ropeHold(this.ropes, sd, 1, 1, 4);
        f.z = ropeHeightAt(this.ropes, sd, 2);
        f.vz = 0;
        continue;
      }
      if (f.hidden || f.exiting || f.z > 30) continue;
      const ax = Math.abs(f.x);
      if (ax < ROPE_LINE_X - 60 || ax > ROPE_LINE_X + 10) continue;
      const pen = ax + BODY_HALF - ROPE_LINE_X;
      if (pen <= 0) continue;
      const side = (f.x > 0 ? 1 : 0) as 0 | 1;
      // a corda do meio apanha a anca/costas, a de cima os ombros, a de baixo as pernas
      const lean = f.anim === 'ropes' ? 1 : 0.6;
      ropeHold(this.ropes, side, 0, pen * 0.75);
      ropeHold(this.ropes, side, 1, pen * 1.05);
      ropeHold(this.ropes, side, 2, pen * 0.9 * lean);
    }
  }

  private *bounceRopes(f: Fighter, dir: number, speed: number): Script {
    f.facing = dir as 1 | -1;
    f.play('run');
    f.vx = dir * speed;
    f.noClamp = true;
    // corre até encostar mesmo às cordas
    const edge = ROPE_LINE_X - BODY_HALF;
    yield () => Math.abs(f.x) >= edge;
    const side = (f.x > 0 ? 1 : 0) as 0 | 1;
    const x0 = Math.sign(f.x) * edge;
    f.play('ropes');
    sfx.ropes();
    // afunda nas cordas: elas esticam à volta do corpo (contacto em ropeContacts)
    let t = 0;
    const T = 0.24;
    while (t < T) {
      t += this.dt;
      const u = Math.min(1, t / T);
      f.x = x0 + dir * Math.sin(u * Math.PI) * 54;
      f.vx = 0;
      yield FRAME;
    }
    f.x = x0;
    // as cordas devolvem-no com força e ficam a vibrar
    pushRope(this.ropes, side, 520);
    f.facing = -dir as 1 | -1;
    f.play('run');
    f.vx = -dir * speed * 1.25;
    yield () => Math.abs(f.x) < RING - 12;
    f.noClamp = false;
    this.addHype(0.05);
  }

  private *whipped(o: Fighter, dir: number): Script {
    yield* this.bounceRopes(o, dir, 500);
    yield 1.4;
    o.vx = 0;
    o.play('guard');
  }

  private *ropeRun(f: Fighter, o: Fighter): Script {
    this.tire(f, 12);
    this.special(f, 'm_lariat');
    yield* this.bounceRopes(f, -f.facing, 470);
    let t = 0;
    // o braço abre 0.04 s antes do impacto: começa a essa distância (sem atravessar o adversário)
    while (Math.abs(o.x - f.x) > this.contactDist(f, o, 'clothes', J_FH, false) + (Math.abs(f.vx) * 0.04) / this.spd(f) && t < 1.6) {
      t += this.dt;
      yield FRAME;
    }
    if (o.state === 'down' || o.state === 'ko') {
      f.vx = 0;
      return;
    }
    f.play('clothes');
    this.telegraph(f, o, 'punch', true);
    this.cinematic((f.x + o.x) / 2, -150, 0.35, 0.7);
    yield 0.04;
    const landed = this.strike(f, o, { dmg: 26, reach: 140, kind: 'punch', heavy: true, kd: Math.random() < 0.5, kb: 300, hitJ: J_FH });
    if (landed) this.pop('LARIAT!', f.x, -230, '#ff6a3d', 28);
    f.vx *= 0.4;
    yield 0.25;
    f.vx = 0;
    f.play('guard');
    yield 0.2;
  }

  /** Dropkick: 2-3 passos, salto com os dois pés esticados ao peito no ponto mais alto. */
  private *dropkick(f: Fighter, o: Fighter): Script {
    this.tire(f, 14);
    this.special(f, 'm_dropkick');
    f.face(o);
    f.play('run');
    // aproxima-se até à distância de salto
    let t = 0;
    while (Math.abs(o.x - f.x) > 190 && t < 1.2) {
      t += this.dt;
      f.vx = f.facing * 420;
      yield FRAME;
    }
    f.face(o);
    f.play('dropkick');
    // altura do salto para os pés chegarem ao peito dele no ponto mais alto
    const sc = this.scale(f);
    sample(ANIMS.dropkick, 0.3, tmpPose);
    solve(tmpPose, tmpSkel);
    const footY = (tmpSkel.y[J_FF] - tmpSkel.minY) * sc;
    const chest = this.jy(o, J_NECK) + 28 * this.scale(o);
    const zA = clamp(footY - chest, 30, 170);
    const apex = Math.sqrt((2 * zA) / GRAV);
    const reach = tmpSkel.x[J_FF] * sc;
    const travel = Math.max(0, Math.abs(o.x - f.x) - reach - this.frontOf(o, f, true) + 6);
    f.vx = f.facing * (travel / apex);
    f.vz = GRAV * apex;
    f.z = 1;
    this.telegraph(f, o, 'kick', true);
    sfx.whoosh();
    t = 0;
    while (t < apex) {
      t += this.dt;
      if (t > apex - 0.1) this.cinematic((f.x + o.x) / 2, -140, 0.3, 0.8);
      yield FRAME;
    }
    // impacto no ponto mais alto
    const hit = this.strike(f, o, { dmg: 22, reach: reach + 60, kind: 'kick', heavy: true, body: true, kd: !!this.demo || Math.random() < 0.45, kb: 420, hitJ: J_FF });
    if (hit) {
      this.pop('DROPKICK!', f.x, -240, '#ffd23d', 28);
      this.styleFx(f, 'dropkick', this.jx(f, J_FF), this.jy(f, J_FF));
    }
    // ressalta para trás e cai de costas
    f.vx = -f.facing * 140;
    yield () => f.z <= 0;
    f.vx = 0;
    this.dust(f.x, 6);
    sfx.thud();
    // levanta-se de um salto (kip-up)
    f.play('kipup', 1.1);
    yield 0.5;
    f.play('guard');
  }

  /** Cutter: salta, agarra a cabeça e cai de costas a puxá-lo de cara para o tapete. */
  private *cutter(f: Fighter, o: Fighter): Script {
    this.tire(f, 12);
    f.face(o);
    f.play('run');
    let t = 0;
    while (Math.abs(o.x - f.x) > 70 && t < 1) {
      t += this.dt;
      f.vx = f.facing * 380;
      yield FRAME;
    }
    f.vx = 0;
    if (!this.canGrab(o) || Math.abs(o.x - f.x) > 95) return;
    this.special(f, 'm_cutter', true);
    if (f.spec.isPlayer) this.tally.grapples++;
    this.lock(f, o);
    o.play('hitBody');
    f.play('tuck');
    f.vz = 420;
    f.z = 1;
    yield* this.carry(f, o, 0.18, [24, 40, 0], [26, 46, -0.6]);
    f.play('fall');
    const lx = f.x + f.facing * 60 * this.scale(f);
    f.vx = -f.facing * 130;
    this.cinematic(lx, -60, 0.3, 0.75);
    yield* this.carry(f, o, 0.2, [26, 46, -0.6], [30, 70, -1.5], (k) => k * k, lx);
    o.play('lieKO');
    this.land(o, lx, f, 30, 'grapple', 2);
    this.pop('CUTTER!', f.x, -250, '#ff4f7b', 34);
    yield () => f.z <= 0;
    f.vx = 0;
    f.play('lie');
    yield 0.35;
    f.play('kipup', 1.1);
    yield 0.5;
  }

  /** Chokeslam: agarra pelo pescoço, levanta-o bem alto e atira-o de costas. */
  private *chokeslam(f: Fighter, o: Fighter): Script {
    this.special(f, 'm_chokeslam');
    this.lock(f, o);
    o.play('hitHi');
    f.play('reach', 1.3);
    // agarra pela garganta com a mão da frente: o pescoço dele fica na mão
    this.carryHand = J_FH;
    try {
      yield* this.carry(f, o, 0.15, [24, 40, 0], [-18, 56, 0]);
      f.play('rise', 0.8);
      yield* this.carry(f, o, 0.4, [-18, 56, 0], [-14, 52, 0.15], (k) => k * k * (3 - 2 * k));
      yield* this.carry(f, o, 0.2, [-14, 52, 0.15], [-14, 52, 0.15]);
      f.play('slam', 1.2);
      const lx = f.x + f.facing * 70 * this.scale(f);
      this.cinematic(lx, -80, 0.3, 0.8);
      yield* this.carry(f, o, 0.15, [-14, 52, 0.15], [30, 50, 1.57], (k) => k * k, lx);
    } finally {
      this.carryHand = null;
    }
    const lx = clamp(f.x + f.facing * 70 * this.scale(f), -RING + 20, RING - 20);
    o.play('lieKO');
    this.land(o, lx, f, 32, 'grapple', 2);
    this.styleFx(f, 'chokeslam', o.x, 0);
    this.pop('CHOKESLAM!', f.x, -260, '#ff3d6e', 32);
    yield 0.7;
  }

  /** Efeitos extra dos estilos de golpe comprados (só visual). */
  private styleFx(f: Fighter, type: string, x: number, y: number): void {
    const s = f.styleOf(type);
    if (!s) return;
    switch (s.style) {
      case 'raio':
        this.bolts.push({ x, y0: y - 500, y1: y, life: 0.3, color: s.color, seed: Math.random() * 999, width: 9 });
        this.flash = Math.max(this.flash, 0.4);
        this.flashColor = '#cfefff';
        sfx.zap();
        break;
      case 'fogo':
      case 'inferno':
        for (let i = 0; i < 40; i++) {
          const a = -Math.random() * Math.PI;
          this.parts.spawn(PK.Ember, x + (Math.random() - 0.5) * 60, y, Math.cos(a) * 420, Math.sin(a) * 520, 0.8, 30, i % 2 ? '#ffd000' : s.color, 500);
        }
        if (s.style === 'inferno') for (const dx of [-90, 0, 90]) this.sparks(x + dx, -10, 16, '#ff5a00', 900, PK.Ember);
        sfx.fire();
        break;
      case 'ouro':
        this.sparks(x, y, 40, s.color, 700, PK.Star);
        break;
      case 'sismo':
        this.wave(x, 0, 520, s.color, 0.7);
        this.wave(x, 0, 300, '#ffffff', 0.4);
        this.shake(22, 0.5);
        sfx.boom();
        break;
      case 'cosmos':
        this.wave(x, -10, 400, s.color, 0.7);
        for (let i = 0; i < 30; i++) {
          const a = Math.random() * Math.PI * 2;
          this.parts.spawn(PK.Star, x, -40, Math.cos(a) * 400, Math.sin(a) * 300, 0.9, 14, i % 2 ? '#ffffff' : s.color, 200);
        }
        break;
    }
  }

  private *stomp(f: Fighter, o: Fighter): Script {
    f.used('m_stomp', 5);
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
    this.special(f, 'm_elbow');
    f.face(o);
    f.play('tuck');
    f.vz = 650;
    f.z = 1;
    f.vx = (o.x - f.x) * 1.3;
    yield 0.3;
    f.play('elbow');
    while (f.z > 0) {
      if (f.vz < 0 && f.z < 70 && o.state === 'down') this.cinematic(f.x, -40, 0.5, 0.5);
      yield FRAME;
    }
    f.vx = 0;
    if (o.state === 'down' && Math.abs(o.x - f.x) < 80) {
      this.strike(f, o, { dmg: 18, reach: 100, kind: 'aerial', ground: true, kb: 0, heavy: true });
      this.pop('ELBOW DROP!', f.x, -200, '#ffd23d', 26);
    } else {
      sfx.thud();
      this.pop('MISSED!', f.x, -180, '#aaaaaa', 24);
      this.damage(f, 8);
    }
    this.dust(f.x, 8);
    this.selfDown(f, 0.35);
  }

  private *topRopeDive(f: Fighter, o: Fighter, vsStanding = false): Script {
    this.tire(f, 14);
    f.diveCd = 6;
    // escolhe o canto mais próximo atrás de si (para mergulhar na direção do adversário)
    const side = o.x > f.x ? -1 : 1;
    const cornerX = side * (RING - 20);
    // quem está no chão "vende" o golpe: fica lá enquanto o outro sobe ao canto
    if (o.state === 'down' && o.hp > 0) o.downT = Math.max(o.downT, Math.abs(cornerX - f.x) / 420 + 1.5);
    f.facing = side as 1 | -1;
    f.play('run');
    while (Math.abs(cornerX - f.x) > 12) {
      f.vx = Math.sign(cornerX - f.x) * 420;
      if (o.state !== 'down' && !vsStanding) {
        f.vx = 0;
        return;
      }
      yield FRAME;
    }
    f.vx = 0;
    f.x = cornerX;
    const sd = (side > 0 ? 1 : 0) as 0 | 1;
    yield* this.climbRopes(f, side);
    let t = 0;
    // vira-se para o ringue em cima da corda de cima, que cede e balança debaixo dos pés
    f.face(o);
    f.blendIn(0.2);
    this.pop('TO THE TOP ROPE!', f.x, -330, '#ffffff', 22);
    this.emit('climb', f);
    this.addHype(0.2);
    sfx.cheer(0.8);
    this.focus = f;
    this.focusT = 1.3;
    t = 0;
    while (t < 0.55) {
      t += this.dt * this.spd(f);
      yield FRAME;
    }
    this.leaveRopes(f, sd);
    const releaseClamp = () => {
      if (Math.abs(f.x) < RING - 12) f.noClamp = false;
    };
    if (o.state !== 'down') {
      // adversário de pé: voa da corda de cima para cima dele
      if (o.state !== 'ko' && o.hp > 0 && o.z < 20) {
        yield* this.flyingBody(f, o, 150, f.can('m_dropkick') && Math.random() < 0.5 ? 'MISSILE DROPKICK!' : 'FLYING CROSSBODY!', releaseClamp);
        return;
      }
      f.play('tuck');
      f.vz = 300;
      f.vx = -side * 160;
      while (f.z > 0) {
        releaseClamp();
        yield FRAME;
      }
      f.noClamp = false;
      f.play('guard');
      return;
    }
    // esquiva rolando?
    const roll = !this.demo && Math.random() < clamp(0.08 + o.s.esq * 0.004, 0.05, 0.35);
    const moon = f.can('m_moonsault') && (!f.can('m_splash') || Math.random() < 0.55);
    if (moon || f.can('m_splash')) this.special(f, moon ? 'm_moonsault' : 'm_splash', true);
    const msty = moon ? f.styleOf('moonsault') : null;
    // salto alto e poderoso: a corda impulsiona-o bem acima do canto antes de cair sobre o alvo
    const target = o.x;
    const apex = moon ? 175 : 150;
    const vz0 = Math.sqrt(2 * GRAV * apex);
    const land = 16;
    const T = (vz0 + Math.sqrt(vz0 * vz0 + 2 * GRAV * Math.max(0, f.z - land))) / GRAV;
    f.vx = (target - f.x) / T;
    f.vz = vz0;
    f.play(moon ? 'tuck' : 'splash');
    sfx.whoosh();
    sfx.whoosh();
    this.dust(f.x, 6);
    this.addHype(0.1);
    if (roll) o.run(this.rollAway(o, f));
    let el = 0;
    // cai em cima do corpo dele (não atravessa até ao tapete)
    const rest = () => (o.state === 'down' && Math.abs(o.x - f.x) < 90 ? 16 * this.scale(o) : 0);
    while (f.z > rest() || el < 0.1) {
      el += this.dt;
      releaseClamp();
      // câmara lenta no topo do salto e no impacto
      if (Math.abs(f.vz) < 140 && el > 0.15) this.cinematic(f.x, -f.z - 60, 0.45, 0.5);
      if (f.vz < 0 && f.z < 110 && o.state === 'down') this.cinematic(target, -40, 0.3, 0.9, true);
      if (el > 0.05 && Math.random() < 0.6) this.parts.spawn(PK.Star, f.x - f.vx * 0.02, -f.z - 70, 0, 0, 0.3, 7, '#ffffff', 0);
      if (moon) f.spinAng = -Math.min(1, el / T) * Math.PI * 2;
      if (msty && Math.random() < 0.8) this.parts.spawn(PK.Star, f.x, -f.z - 80, 0, 0, 0.5, 10, msty.color, 0);
      yield FRAME;
    }
    f.noClamp = false;
    f.spinAng = 0;
    f.vx = 0;
    if (o.state === 'down' && Math.abs(o.x - f.x) < 90) {
      if (f.spec.isPlayer) this.tally.dives++;
      // estendido por cima dele
      f.play('splash', 2);
      f.z = rest();
      f.vz = 0;
      this.strike(f, o, { dmg: 40, reach: 999, kind: 'aerial', ground: true, heavy: true, kb: 0, unblockable: true });
      this.pop(moon ? 'MOONSAULT!' : 'SPLASH!', f.x, -240, '#ffd23d', 34);
      if (moon) this.styleFx(f, 'moonsault', f.x, -20);
      this.shake(14, 0.4);
      this.addHype(0.35);
      sfx.cheer(1.2);
      this.dust(f.x, 14, 100);
      let h = 0;
      while (h < 0.3) {
        h += this.dt;
        f.z = rest();
        f.vz = 0;
        yield FRAME;
      }
      this.selfDown(f, 0.7);
      return;
    } else {
      f.play('lie');
      this.pop('MISSED!', f.x, -200, '#aaaaaa', 30);
      this.damage(f, 22);
      this.shake(8, 0.3);
      sfx.thud();
    }
    this.dust(f.x, 14, 100);
    this.selfDown(f, 0.9);
  }

  /**
   * Voo de corpo inteiro (crossbody / missile dropkick) contra um adversário de pé:
   * parte da altura atual (corda de cima, corda do meio ou chão), cai em cima dele e derruba os dois.
   */
  private *flyingBody(f: Fighter, o: Fighter, apex: number, name: string, tick?: () => void): Script {
    const kick = name.includes('DROPKICK');
    f.face(o);
    const hitZ = 62 * this.scale(o);
    const vz0 = Math.sqrt(2 * GRAV * apex);
    const T = (vz0 + Math.sqrt(vz0 * vz0 + 2 * GRAV * Math.max(0, f.z - hitZ))) / GRAV;
    const aimX = o.x - f.facing * 26 * this.scale(o);
    f.vx = (aimX - f.x) / T;
    f.vz = vz0;
    f.z = Math.max(f.z, 1);
    f.noClamp = true;
    f.play(kick ? 'dropkick' : 'splash');
    f.flying = true;
    this.telegraph(f, o, kick ? 'kick' : 'punch', true);
    this.addHype(0.15);
    sfx.whoosh();
    sfx.whoosh();
    this.focus = f;
    this.focusT = Math.max(this.focusT, T + 0.4);
    let el = 0;
    while (el < T) {
      el += this.dt;
      tick?.();
      if (Math.abs(f.vz) < 120 && el > 0.12) this.cinematic(f.x, -f.z - 60, 0.4, 0.45);
      if (el > T - 0.12) this.cinematic((f.x + o.x) / 2, -110, 0.3, 0.8);
      if (Math.random() < 0.6) this.parts.spawn(PK.Star, f.x - f.vx * 0.02, -f.z - 70, 0, 0, 0.3, 7, '#ffffff', 0);
      yield FRAME;
    }
    f.flying = false;
    const hit = Math.abs(o.x - f.x) < 120 && o.z < 40 && this.strike(f, o, { dmg: kick ? 26 : 24, reach: 999, kind: 'aerial', heavy: true, body: true, kd: true, kb: 230, launch: 180, hitJ: kick ? J_FF : J_HIP });
    if (hit) {
      if (f.spec.isPlayer) this.tally.dives++;
      this.pop(name, f.x, -250, '#ffd23d', 30);
      this.shake(11, 0.32);
      sfx.cheer(1.1);
      // cai por cima dele
      f.vx = f.facing * 120;
      yield () => f.z <= 0;
      f.noClamp = false;
      f.vx = 0;
      this.dust(f.x, 12, 90);
      f.play('lie');
      this.selfDown(f, 0.45);
      return;
    }
    // falhou: espalha-se no tapete
    yield () => f.z <= 0;
    f.noClamp = false;
    f.vx = 0;
    f.play('lie');
    this.pop('MISSED!', f.x, -200, '#aaaaaa', 28);
    this.damage(f, 14);
    this.shake(8, 0.3);
    sfx.slam(0.9);
    this.dust(f.x, 12, 90);
    this.selfDown(f, 0.9);
  }

  /** Corre às cordas, ressalta e voa de corpo inteiro para cima do adversário. */
  private *reboundCrossbody(f: Fighter, o: Fighter): Script {
    this.tire(f, 12);
    f.diveCd = 5;
    yield* this.bounceRopes(f, -f.facing, 470);
    let t = 0;
    while (Math.abs(o.x - f.x) > 250 && t < 1.4) {
      t += this.dt;
      yield FRAME;
    }
    if (o.state === 'down' || o.state === 'ko' || Math.abs(o.x - f.x) < 110) {
      f.vx = 0;
      f.play('guard');
      return;
    }
    yield* this.flyingBody(f, o, 115, 'FLYING CROSSBODY!');
  }

  /** Springboard: corre às cordas, salta para a do meio e usa-a como trampolim por cima do adversário. */
  private *springboard(f: Fighter, o: Fighter): Script {
    this.tire(f, 14);
    f.diveCd = 5;
    const dir = o.x > f.x ? -1 : 1;
    f.facing = dir as 1 | -1;
    f.play('run');
    f.noClamp = true;
    const edge = ROPE_LINE_X - BODY_HALF;
    let t = 0;
    while (Math.abs(f.x) < edge && t < 1.6) {
      t += this.dt;
      f.vx = dir * 480;
      yield FRAME;
    }
    f.vx = 0;
    const sd = (f.x > 0 ? 1 : 0) as 0 | 1;
    // um salto para cima da corda do meio, que cede debaixo dos pés
    f.play('perch');
    const x0 = f.x;
    const footX = dir * (ROPE_LINE_X - 10);
    t = 0;
    while (t < 0.2) {
      t += this.dt;
      const u = Math.min(1, t / 0.2);
      f.x = x0 + (footX - x0) * u;
      f.z = ropeHeightAt(this.ropes, sd, 1) * u + Math.sin(u * Math.PI) * 30;
      f.vz = 0;
      ropeHold(this.ropes, sd, 1, 2, 22 * u);
      yield FRAME;
    }
    sfx.ropes();
    this.pop('SPRINGBOARD!', f.x, -300, '#ffffff', 22);
    f.face(o);
    yield 0.06;
    pushRope(this.ropes, sd, 70, 1, 600);
    sfx.ropes();
    if (o.state === 'down' || o.state === 'ko') {
      f.vz = 260;
      f.vx = -dir * 150;
      yield () => f.z <= 0;
      f.noClamp = false;
      f.vx = 0;
      f.play('guard');
      return;
    }
    const releaseClamp = () => {
      if (Math.abs(f.x) < RING - 12) f.noClamp = false;
    };
    yield* this.flyingBody(f, o, 130, f.can('m_dropkick') && Math.random() < 0.4 ? 'SPRINGBOARD DROPKICK!' : 'SPRINGBOARD CROSSBODY!', releaseClamp);
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
    this.emit('taunt', f);
    f.play('taunt');
    f.setExpr('happy', 1.2);
    sfx.cheer(0.7);
    this.pop(['THE CROWD GOES WILD!', 'COME ON!', 'LET\'S GO!', 'I\'M THE GREATEST!'][Math.floor(Math.random() * 4)], f.x, -260, '#ff7ae0', 22);
    yield 0.5;
    this.gainMeter(f, 16 * (1 + f.s.car * 0.025));
    this.addHype(0.12);
    yield 0.4;
  }

  private *getUp(f: Fighter): Script {
    const hurt = f.impact;
    f.impact = 0;
    if (hurt > 0.55) {
      // levanta-se a custo, apoiado num joelho, e fica uns instantes zonzo
      const sp = clamp(0.95 - hurt * 0.3, 0.45, 0.9);
      f.play('getup', sp + f.s.res * 0.004);
      f.setExpr('hurt', 1.5);
      yield 0.55 / sp;
      f.play('tired');
      f.blendIn(0.2);
      yield 0.25 + hurt * 0.45;
    } else {
      f.play('getup', 1.15 + f.s.res * 0.006);
      yield 0.55;
    }
    f.setState('act');
    f.play('guard');
    f.blendIn(0.15);
    f.evade = 'none';
  }

  // ───────────────────────── Passivas ─────────────────────────

  heal(f: Fighter, v: number): void {
    f.hp = Math.min(f.maxHp, f.hp + v);
    this.pop('+' + Math.round(v), f.x, this.jy(f, J_HEAD) - 20, '#7dff8a', 26);
  }

  gainMeter(f: Fighter, v: number): void {
    const before = f.meter;
    f.meter = Math.min(100, f.meter + v);
    if (before < 100 && f.meter >= 100) {
      this.pop('SUPER READY!', f.x, this.jy(f, J_HEAD) - 60, '#ffd23d', 24);
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
    if (o.flying) return false;
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
    let hx = this.jx(def, o.body ? J_NECK : J_HEAD) - dir * 18;
    let hy = o.ground ? this.jy(def, J_HIP) - 10 : this.jy(def, o.body ? J_NECK : J_HEAD) + (o.body ? 25 : 0);
    if (o.hitJ != null && !o.ground) {
      hx = this.jx(att, o.hitJ) + dir * 8;
      hy = this.jy(att, o.hitJ);
    }
    if (!o.unblockable && def.evade === 'dodge') {
      sfx.whoosh();
      this.pop('DODGE!', def.x, this.jy(def, J_HEAD) - 50, '#5ef0c0', 24);
      if (def.spec.isPlayer) this.tally.dodges++;
      this.gainMeter(def, 5 * (1 + def.s.car * 0.012));
      return false;
    }
    let dmg = o.dmg * (o.kind === 'super' ? 0.6 : 0.95);
    const isGrapple = o.kind === 'grapple';
    dmg *= isGrapple ? 1 + att.s.agr * 0.022 : 1 + att.s.for * 0.02;
    if (o.kind === 'super') dmg *= 1 + (att.s.for + att.s.agr) * 0.006;
    if (att.furyT > 0) dmg *= 1.35;
    dmg *= 0.72 + 0.28 * (att.stamina / 100);
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
      this.pop('BLOCKED', def.x, this.jy(def, J_HEAD) - 50, '#9ad7ff', 22);
      def.vx = dir * 90;
      def.hp = Math.max(1, def.hp - dmg);
      this.gainMeter(def, 6 * (1 + def.s.car * 0.012));
      return true;
    }

    // os supers têm um orçamento total de dano por utilização (nada de K.O. instantâneo)
    if (o.kind === 'super') {
      dmg = Math.min(dmg, def.maxHp * 0.16);
      if (this.superBudget >= 0) {
        dmg = Math.min(dmg, this.superBudget);
        this.superBudget = Math.max(0, this.superBudget - dmg);
      }
    }
    dmg = Math.max(1, Math.round(dmg));
    def.hp -= dmg;
    def.stamina = Math.max(0, def.stamina - dmg * 0.18);
    def.minHpRatio = Math.min(def.minHpRatio, Math.max(0, def.hp) / def.maxHp);
    def.lastHitBy = att;
    if (o.heavy || o.kind === 'super') def.flashT = 0.06;
    def.setExpr('hurt', 0.5);
    att.combo++;
    att.comboT = 1.2;
    if (att.combo >= 4 && att.combo % 2 === 0) {
      this.pop(`${att.combo} HITS!`, att.x, -300, '#ff7ae0', 26);
      this.emit('combo', att, def, String(att.combo));
    }
    if (def.hp > 0 && def.hp / def.maxHp < 0.25 && (def.hp + dmg) / def.maxHp >= 0.25) this.emit('lowhp', def, att);

    if (att.spec.isPlayer) {
      this.tally.damage += dmg;
      if (o.kind === 'punch') this.tally.punches++;
    }
    if (att.has('p_vampiro')) att.hp = Math.min(att.maxHp, att.hp + dmg * 0.07);

    // efeitos
    const heavy = !!o.heavy || crit || o.kind === 'super';
    // números só nos golpes que contam (menos ruído no ecrã)
    if (heavy || crit || dmg >= 14) this.pop(String(dmg), hx, hy - 20, crit ? '#ffd23d' : '#ffffff', crit ? 34 : 26);
    if (crit) this.pop('CRITICAL!', hx, hy - 60, '#ff5a5a', 22);
    this.sparks(hx, hy, heavy ? 16 : 8, o.color ?? (heavy ? '#ffd23d' : '#ffffff'), heavy ? 700 : 450);
    this.parts.spawn(PK.Star, hx, hy, 0, 0, 0.18, heavy ? 46 : 30, '#ffffff', 0);
    if (Math.random() < 0.6) {
      for (let i = 0; i < 4; i++) this.parts.spawn(PK.Sweat, hx, hy, dir * (100 + Math.random() * 200), -150 - Math.random() * 200, 0.6, 2.5, '#bfe6ff', 1400);
    }
    sfx.punch(heavy ? 1 : o.kind === 'kick' ? 0.75 : 0.55, !!o.body, o.kind === 'kick' ? 'kick' : 'punch');
    if (crit || (heavy && o.kind === 'super')) sfx.oooh(crit ? 0.7 : 1);
    if (heavy && o.kind !== 'assist') {
      this.bursts.push({ x: hx, y: hy - 10, text: BURST_WORDS[Math.floor(Math.random() * BURST_WORDS.length)], life: 0.42, max: 0.42, color: crit ? '#ffd23d' : o.color ?? '#ff5a5a', rot: (Math.random() - 0.5) * 0.5 });
      if (this.bursts.length > 4) this.bursts.shift();
    }
    this.freeze = heavy ? 0.085 : 0.035;
    this.shake(heavy ? 9 : 3.5, heavy ? 0.22 : 0.1);
    if (heavy) this.zoomPunch = 0.06;
    this.addHype(heavy ? 0.06 : 0.015);
    if (o.kind !== 'super') this.gainMeter(att, dmg * 0.2 * (1 + att.s.car * 0.012) * (att.has('p_showman') ? 1.3 : 1));
    if (o.kind !== 'super') this.gainMeter(def, dmg * 0.16);

    // segundo fôlego
    if (def.hp > 0 && def.hpRatio < 0.25 && def.has('p_folego') && !def.usedFolego) {
      def.usedFolego = true;
      this.heal(def, def.maxHp * 0.2);
      this.pop('SECOND WIND!', def.x, this.jy(def, J_HEAD) - 80, '#7dff8a', 22);
    }

    if (def.hp <= 0 && this.demo && !(def.has('p_fenix') && !def.usedFenix)) def.hp = Math.round(def.maxHp * 0.3);
    if (def.hp <= 0) {
      this.handleZero(def, att, o.kind);
      return true;
    }
    // atordoamento acumulado: golpes na cabeça contam mais
    let kd = !!o.kd;
    if (def.stunT > 0 && o.heavy && o.kind !== 'assist' && o.kind !== 'super' && Math.random() < 0.3) kd = true;
    if (!kd && o.kind !== 'assist' && def.state !== 'down' && def.state !== 'thrown') {
      def.daze += dmg * (o.body ? 0.55 : 1.15) * (o.heavy ? 1.2 : 1);
      if (def.daze >= 58 + def.s.res * 0.6 && !def.armor) {
        def.daze = 0;
        def.stop();
        def.evade = 'none';
        def.setState('hit');
        def.play('stun');
        def.stunT = Math.max(0.7, 1.4 - def.s.res * 0.006);
        def.vx = dir * 60;
        def.setExpr('hurt', def.stunT);
        this.pop('DAZED!', def.x, this.jy(def, J_HEAD) - 70, '#ffe27a', 26);
        this.emit('stun', def, att);
        this.addHype(0.12);
        sfx.cheer(0.6);
        return true;
      }
    }
    if (def.armor) return true;
    if (def.state === 'down') {
      // golpes no chão (pisões, mergulhos) deixam-no lá mais tempo
      const extra = clamp((dmg / def.maxHp) * 8, 0.3, 1.6) * (o.kind === 'aerial' ? 1.3 : 1);
      def.impact = Math.max(def.impact, extra * 0.7);
      def.downT = Math.max(def.downT, 0.6 + extra);
      return true;
    }
    if (def.state === 'thrown' && !o.ground) return true;
    def.stop();
    def.evade = 'none';
    if (kd) {
      def.stunT = 0;
      // quanto mais forte o golpe, mais tempo fica no chão
      def.impact = clamp((dmg / def.maxHp) * 7 + (o.heavy ? 0.25 : 0) + (o.kind === 'super' ? 0.6 : 0) + (o.kind === 'grapple' ? 0.35 : 0) + (o.kind === 'aerial' ? 0.45 : 0), 0, 1.6);
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
    this.emit('down', f, f.lastHitBy ?? undefined);
    f.stop();
    f.stunT = 0;
    f.daze = 0;
    f.face(f.x - dir);
    f.setState('down');
    f.play('fall');
    f.vx = dir * kb;
    f.vz = launch;
    f.z = Math.max(f.z, 1);
    f.downT = Math.max(0.35, 0.6 + Math.random() * 0.4 - f.s.res * 0.005) + f.impact * (1.3 - f.s.res * 0.004);
    f.setExpr('hurt', 1.2 + f.impact);
    f.run(this.fallLand(f), false);
    f.state = 'down';
  }

  private *fallLand(f: Fighter): Script {
    yield () => f.z <= 0;
    this.dust(f.x, 8);
    sfx.slam(0.85);
    ringShake(this.ropes, 0.4);
    this.shake(5, 0.15);
    if (f.state === 'ko') f.play('lieKO');
    else {
      f.play('lie');
      f.state = 'down';
    }
  }

  private handleZero(def: Fighter, att: Fighter, kind: StrikeKind): void {
    // Fénix (passiva): renasce uma vez por luta
    let revive = 0;
    if (def.has('p_fenix') && !def.usedFenix) {
      def.usedFenix = true;
      revive = 0.35;
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
      this.banner('ELIMINATED!', def.spec.name, '#ff5a5a', 1.6);
      this.emit('elim', def, att);
      def.run(this.eliminate(def, next, Math.random() < 0.5));
      def.state = 'ko';
    } else {
      this.banner('K.O.!', '', '#ff3d6e', 1.8, 1.5);
      this.emit('ko', def, att);
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
    this.banner('REBORN!', 'Phoenix', '#ffb31a', 1.4);
    this.emit('revive', f);
    f.hp = f.maxHp * ratio;
    f.setExpr('power', 1.5);
    f.play('getup', 1.3);
    yield 0.6;
    f.state = 'act';
    f.play('guard');
    f.downT = 0;
  }

  /**
   * Eliminado no tag team: fica no tapete um momento, o parceiro entra logo (a luta continua)
   * e o eliminado sai do ringue a pé, zonzo, ou levado pelo árbitro. A saída é só visual.
   */
  private *eliminate(f: Fighter, next: Fighter, byRef: boolean): Script {
    yield () => f.z <= 0;
    f.play('lieKO');
    yield 1.6;
    f.vx = 0;
    f.setState('out');
    f.exiting = true;
    f.noClamp = true;
    this.active[f.team] = next;
    next.stop();
    next.run(this.enterRing(next));
    try {
      if (byRef) yield* this.refFetch(f);
      else yield* this.selfExit(f);
    } finally {
      f.exiting = false;
      f.footLock = false;
      f.poseHook = null;
      f.cadence = 1;
      f.hidden = true;
      f.x = Math.sign(f.x || 1) * (OFFSTAGE + 100);
    }
  }

  /** Lado das cordas mais próximas (perto do centro: o canto da própria equipa). */
  private exitSide(f: Fighter): 1 | -1 {
    if (Math.abs(f.x) < 60) return f.team === 0 ? -1 : 1;
    return f.x > 0 ? 1 : -1;
  }

  /** Mundo → coordenadas locais do esqueleto de f. */
  private toLocal(f: Fighter, wx: number, wy: number): Pt {
    const k = this.scale(f);
    return [((wx - this.hipX(f)) * f.facing) / k, (wy - this.hipY(f)) / k];
  }

  /** Ponto local do esqueleto de o (pose atual) → mundo. */
  private toWorld(o: Fighter, l: Pt): Pt {
    const k = this.scale(o);
    return [this.hipX(o) + o.facing * l[0] * k, this.hipY(o) + l[1] * k];
  }

  private makeGrip(f: Fighter): Grip {
    const hands = [true, false].map((front) => ({
      front,
      t: null as HandT,
      w: 0,
      u: 1,
      from: [0, 0] as Pt,
      last: [0, 0] as Pt,
    }));
    const g: Grip = {
      front: null,
      back: null,
      set: (front, back) => {
        [front, back].forEach((nt, i) => {
          if (nt === undefined) return;
          const h = hands[i];
          if (nt && h.w > 0) {
            // parte de onde a mão está agora
            const j = h.front ? J_FH : J_BH;
            h.from = [f.skel.x[j], f.skel.y[j]];
            h.u = 0;
          }
          h.t = nt;
        });
        g.front = hands[0].t;
        g.back = hands[1].t;
      },
    };
    f.poseHook = (p) => {
      const dt = this.dt;
      for (const h of hands) {
        h.w = clamp(h.w + (h.t ? 1 : -1) * dt * 4, 0, 1);
        if (h.w <= 0) continue;
        let tg = h.t ? h.t(p) : h.last;
        h.last = tg;
        if (h.u < 1) {
          h.u = Math.min(1, h.u + dt / 0.3);
          const e = h.u * h.u * (3 - 2 * h.u);
          tg = [h.from[0] + (tg[0] - h.from[0]) * e, h.from[1] + (tg[1] - h.from[1]) * e];
        }
        armIK(p, h.front, tg[0], tg[1], h.w * h.w * (3 - 2 * h.w));
      }
    };
    return g;
  }

  /** Mão na cabeça e a outra nas costelas (zonzo). */
  private readonly onHead: HandT = (p) => {
    const [hx, hy] = headLocal(p);
    return [hx + 3, hy - 13];
  };

  private readonly onRibs: HandT = (p) => torsoLocal(p, 24, 20);

  /** Caminha (pé de apoio fixo no chão) até x. 'walkBack' recua sem se virar. */
  private *stroll(f: Fighter, tx: number, anim: Loco = 'walk', maxT = 14): Script {
    f.footLock = true;
    f.vx = 0;
    const dir = tx > f.x ? 1 : -1;
    // um passo curto para trás não precisa de meia-volta
    if (anim === 'walk' && f.facing !== dir && Math.abs(tx - f.x) < 60) anim = 'walkBack';
    if (anim !== 'walkBack' && f.facing !== dir) {
      f.blendIn(0.3, true);
      f.facing = dir;
    }
    f.play(anim, 1, false);
    let t = 0;
    // pára num momento em que os pés estão juntos (assim a pose seguinte não arrasta o pé de apoio)
    const together = () => Math.abs(f.skel.x[J_FF] - f.skel.x[J_BF]) < 22;
    while ((tx - f.x) * dir > 2 && t < maxT) {
      if ((tx - f.x) * dir < 26 && together()) break;
      t += this.dt;
      yield FRAME;
    }
    while ((f.x - tx) * dir < 14 && !together() && t < maxT) {
      t += this.dt;
      yield FRAME;
    }
  }

  /** Passa entre as cordas laterais do lado `side`, no sentido para onde está virado. */
  private *throughRopes(f: Fighter, side: number, g: Grip): Script {
    f.footLock = true;
    f.vx = 0;
    f.play('ropeStep');
    sfx.ropes();
    f.blendIn(0.25);
    const pf = g.front;
    const pb = g.back;
    const rx = side * ROPE_X;
    let t = 0;
    // enquanto se agacha as pernas ficam como estavam (a meio do passo), sem arrastar os pés;
    // depois seguem a animação
    const legs = [f.pose.fl1, f.pose.fl2, f.pose.bl1, f.pose.bl2];
    const base = f.poseHook;
    f.poseHook = (p) => {
      const u = clamp((t - 0.3) / 0.45, 0, 1);
      const w = 1 - u * u * (3 - 2 * u);
      if (w > 0) {
        p.fl1 += (legs[0] - p.fl1) * w;
        p.fl2 += (legs[1] - p.fl2) * w;
        p.bl1 += (legs[2] - p.bl1) * w;
        p.bl2 += (legs[3] - p.bl2) * w;
      }
      base?.(p);
    };
    let grabbed = false;
    let released = false;
    let pushed = false;
    while (t < 2.5) {
      t += this.dt;
      if (!grabbed && !released && t > 0.1) {
        grabbed = true;
        g.set(
          () => this.toLocal(f, rx + f.facing * 6, -ROPE_MID),
          () => this.toLocal(f, rx - f.facing * 4, -ROPE_TOP),
        );
      }
      const sd = (side > 0 ? 1 : 0) as 0 | 1;
      if (grabbed) {
        // afasta as cordas para passar: carrega na do meio e levanta a de cima
        const open = Math.min(1, (t - 0.1) / 0.35);
        ropeHold(this.ropes, sd, 1, 6 * open, 24 * open, undefined, 0.24);
        ropeHold(this.ropes, sd, 2, 3 * open, -16 * open, undefined, 0.24);
        ropeHold(this.ropes, sd, 0, 2 * open, 6 * open, undefined, 0.24);
      }
      if (!pushed && t > 0.8) {
        pushed = true;
        sfx.whoosh();
      }
      if (grabbed && t > 1.9) {
        grabbed = false;
        released = true;
        g.set(pf, pb);
        // largadas, as cordas voltam ao sítio a vibrar
        pushRope(this.ropes, sd, 40, 1, -260);
        pushRope(this.ropes, sd, 30, 2, 200);
        sfx.ropes();
      }
      yield FRAME;
    }
    f.poseHook = base;
    if (grabbed) g.set(pf, pb);
  }

  /** Salto curto (descer do avental para o chão ou subir para o avental); x e z conduzidos à mão. */
  private *hop(fs: Fighter[], dx: number, z1: number, up: boolean): Script {
    const dur = up ? 0.55 : 0.5;
    const st = fs.map((f) => {
      f.footLock = false;
      f.vx = 0;
      f.play(up ? 'stepUp' : 'hopDown');
      return { f, x0: f.x, z0: f.z };
    });
    // controlo da curva (quadrática) para passar ~14 acima do ponto mais alto
    let t = 0;
    while (t < dur) {
      t += this.dt;
      const u = clamp(t / dur, 0, 1);
      for (const s of st) {
        const pk = Math.max(s.z0, z1) + 14;
        const c = 2 * pk - (s.z0 + z1) / 2;
        s.f.x = s.x0 + dx * (u * u * (3 - 2 * u));
        s.f.z = (1 - u) * (1 - u) * s.z0 + 2 * u * (1 - u) * c + u * u * z1;
        s.f.vz = 0;
      }
      yield FRAME;
    }
    for (const s of st) s.f.z = z1;
    if (!up) sfx.thud();
    yield up ? 0.05 : 0.3;
  }

  /** Levanta-se sozinho, zonzo, e sai do ringue pelo próprio pé. */
  private *selfExit(f: Fighter): Script {
    const side = this.exitSide(f);
    const g = this.makeGrip(f);
    yield 0.1 + Math.random() * 0.5;
    f.setExpr('hurt', 999);
    f.play('groggy', 1.2);
    f.blendIn(0.3);
    yield 4.5 / 1.2;
    f.play('dazed');
    g.set(this.onHead, this.onRibs);
    yield 0.6 + Math.random() * 0.4;
    yield* this.stroll(f, side * (ROPE_X - 45), 'limp');
    yield* this.throughRopes(f, side, g);
    // desce do avental para o chão e vai-se embora
    if ((side * (APRON_X + 6) - f.x) * side > 4) yield* this.stroll(f, side * (APRON_X + 6), 'limp');
    f.play('dazed');
    yield 0.3;
    yield* this.hop([f], side * 46, FLOOR_Z, false);
    f.play('dazed');
    yield 0.4;
    yield* this.stroll(f, side * OFFSTAGE, 'limp');
  }

  private makeReferee(): Fighter {
    const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
    const look = resolveLook(
      {
        skin: Math.floor(Math.random() * 7),
        hair: pick(['h_careca', 'h_curto', 'h_curto', 'h_careca']),
        hairColor: pick(['hc_preto', 'hc_castanho', 'hc_grisalho', 'hc_preto', 'hc_loiro']),
        eyes: 'normal',
        eyeColor: Math.floor(Math.random() * 4),
        brows: pick(['normal', 'grossas']),
        mouth: 'serio',
        beard: pick(['nenhuma', 'nenhuma', 'bigode', 'curta']),
        height: 0.96 + Math.random() * 0.04,
      },
      { outfit: '', gloves: '', mask: null, aura: null },
    );
    // camisa às riscas preto e branco, calças e sapatos pretos, mãos nuas
    look.outfit = { style: 'ref', c1: '#17171c', c2: '#0c0c10', boots: '#111114' };
    look.gloves = { style: 'fita', c1: look.skin, c2: look.skinShade };
    look.mask = null;
    look.aura = null;
    const spec: FighterSpec = { name: 'Referee', level: 1, stats: baseStats(), look, supers: [], passives: [], isPlayer: false };
    const r = new Fighter(spec, 0, 7, 1);
    r.setState('out');
    r.exiting = true;
    r.referee = true;
    r.noClamp = true;
    r.play('guard');
    return r;
  }

  /** O árbitro entra, ajuda o eliminado a levantar-se e leva-o para fora do ringue ao ombro. */
  private *refFetch(f: Fighter): Script {
    const side = this.exitSide(f);
    const g = this.makeGrip(f);
    const r = this.makeReferee();
    const rg = this.makeGrip(r);
    r.x = side * 800;
    r.z = FLOOR_Z;
    r.facing = -side as 1 | -1;
    this.extras.push(r);
    try {
      // sobe para o avental e entra pelas cordas
      r.cadence = 1.25;
      yield* this.stroll(r, side * (APRON_X + 44));
      r.cadence = 1;
      yield* this.hop([r], -side * 50, 0, true);
      r.play('guard');
      yield* this.stroll(r, side * (ROPE_X + 40));
      yield* this.throughRopes(r, side, rg);
      // vai até aos ombros do lutador
      const sx = clamp(this.jx(f, J_SH) + side * 46, -(RING - 12), RING - 12);
      yield* this.stroll(r, sx, (sx - r.x) * r.facing >= 0 ? 'walk' : 'walkBack');
      if (r.facing !== -side) {
        r.blendIn(0.3, true);
        r.facing = -side as 1 | -1;
      }
      r.play('refSquat');
      rg.set(
        () => this.toLocal(r, this.jx(f, J_SH), this.jy(f, J_SH)),
        () => this.toLocal(r, this.jx(f, J_FE), this.jy(f, J_FE)),
      );
      yield 0.8;
      // levanta-o
      f.setExpr('hurt', 999);
      f.play('groggy', 1.6);
      f.at = 1.0;
      f.blendIn(0.35);
      r.play('refLift');
      yield 3.5 / 1.6;
      f.play('dazed');
      rg.set(null, null);
      yield 0.35;
      // ombro a ombro, virados para as cordas
      for (const x of [f, r]) {
        if (x.facing !== side) {
          x.blendIn(0.3, true);
          x.facing = side;
        }
      }
      g.set(this.onHead, this.onRibs);
      r.play('guard');
      yield 0.3;
      const gap = 26;
      const meet = side * (ROPE_X - 110);
      if ((meet - f.x) * side > 10) yield* this.shoulderWalk(f, r, g, rg, side, meet, gap);
      // o árbitro segura as cordas abertas e o lutador passa (por trás dele)
      g.set(this.onHead, this.onRibs);
      rg.set(null, null);
      f.play('dazed');
      yield* this.stroll(r, side * (ROPE_X - 40));
      if (r.facing !== side) {
        r.blendIn(0.3, true);
        r.facing = side as 1 | -1;
      }
      r.play('refHold');
      rg.set(
        () => this.toLocal(r, side * (ROPE_X + 2), -ROPE_MID - 12),
        () => this.toLocal(r, side * (ROPE_X - 4), -ROPE_TOP - 4),
      );
      pushRope(this.ropes, side > 0 ? 1 : 0, 90);
      yield 0.5;
      yield* this.stroll(f, side * (ROPE_X - 45), 'limp');
      yield* this.throughRopes(f, side, g);
      // espera pelo árbitro do lado de fora
      r.script = this.refFollow(r, rg, side);
      r.wait = 0;
      if ((side * (APRON_X + 14) - f.x) * side > 4) yield* this.stroll(f, side * (APRON_X + 14), 'limp');
      f.play('dazed');
      yield () => !r.script;
      // juntos até à beira do avental, descem para o chão e saem
      yield* this.shoulderWalk(f, r, g, rg, side, side * (APRON_X + 30), gap);
      yield* this.hop([f, r], side * 46, FLOOR_Z, false);
      f.play('dazed');
      r.play('guard');
      yield 0.2;
      yield* this.shoulderWalk(f, r, g, rg, side, side * OFFSTAGE, gap);
    } finally {
      r.hidden = true;
      r.exiting = false;
    }
  }

  /** Árbitro: larga as cordas, passa-as e põe-se ao lado do lutador. */
  private *refFollow(r: Fighter, rg: Grip, side: number): Script {
    rg.set(null, null);
    yield 0.3;
    r.play('guard');
    yield* this.throughRopes(r, side, rg);
  }

  /** Os dois a andar juntos: o braço do lutador sobre os ombros do árbitro, que o segura pela cintura. */
  private *shoulderWalk(f: Fighter, r: Fighter, g: Grip, rg: Grip, side: number, tx: number, gap: number): Script {
    for (const x of [f, r]) {
      if (x.facing !== side) {
        x.blendIn(0.3, true);
        x.facing = side as 1 | -1;
      }
    }
    // ajusta a posição do árbitro ao lado do lutador
    const want = f.x + side * gap;
    if (Math.abs(want - r.x) > 6) yield* this.stroll(r, want, (want - r.x) * r.facing >= 0 ? 'walk' : 'walkBack', 3);
    r.play('guard');
    g.set(() => {
      const n = this.toLocal(f, this.jx(r, J_NECK), this.jy(r, J_NECK) + 4 * this.scale(r));
      return n;
    }, this.onRibs);
    rg.set(
      () => this.toLocal(r, this.jx(f, J_FH), this.jy(f, J_FH)),
      () => this.toLocal(r, ...this.toWorld(f, torsoLocal(f.pose, 22, -17))),
    );
    yield 0.45;
    f.footLock = true;
    r.footLock = true;
    f.play('limp', 1, false);
    r.play('walk', 1, false);
    let t = 0;
    while ((tx - f.x) * side > 2 && t < 14) {
      t += this.dt;
      const err = (r.x - f.x) * side - gap;
      const want = clamp(0.58 - err * 0.03, 0.15, 1.2);
      r.cadence += (want - r.cadence) * Math.min(1, this.dt * 4);
      yield FRAME;
    }
    r.cadence = 1;
    r.play('guard');
  }

  private *enterRing(f: Fighter): Script {
    f.setState('act');
    f.inRingT = 0;
    f.tagCooldown = 8;
    f.noClamp = true;
    const side = f.team === 0 ? -1 : 1;
    f.facing = -side as 1 | -1;
    yield* this.vault(f, side * (RING - 70));
    f.noClamp = false;
    f.play('taunt', 1.4);
    yield 0.5;
    f.play('guard');
  }

  // ───────────────────────── Tag ─────────────────────────

  private tryTag(f: Fighter): boolean {
    const p = this.partner(f);
    if (!p || f.tagCooldown > 0) return false;
    const hp = f.hpRatio;
    let chance = 0;
    if (hp < 0.3 && p.hpRatio > hp) chance = 0.85;
    else if (hp < 0.6 && p.hpRatio > hp + 0.12) chance = 0.45;
    else if (f.stamina < 28 && p.stamina > 60) chance = 0.4;
    else if (f.inRingT > 28 && p.hpRatio > 0.4) chance = 0.25;
    if (Math.random() > chance) return false;
    f.run(this.tagOut(f, p));
    return true;
  }

  private *tagOut(f: Fighter, p: Fighter): Script {
    const side = f.team === 0 ? -1 : 1;
    const cornerX = side * (RING - 15);
    f.facing = side as 1 | -1;
    f.play('run');
    this.pop('GOING FOR THE TAG!', f.x, -260, '#ffffff', 20);
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
    this.banner('TAG!', p.spec.name + ' steps in!', '#ffd23d', 1.0);
    this.emit('tag', p, f);
    sfx.slap();
    sfx.cheer(0.9);
    this.addHype(0.25);
    this.sparks(side * (RING + 40), -150, 14, '#ffd23d', 400);
    f.tagCooldown = 10;
    // troca: o ativo sai para o avental e o parceiro entra
    this.active[f.team] = p;
    p.run(this.enterRing(p));
    // salta para fora, por cima da corda de cima
    yield* this.vault(f, side * APRON_X);
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
      this.emit('count', w, l, String(n));
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
    this.banner(wt === 0 ? 'VICTORY!' : 'DEFEAT', w.spec.name + ' wins!', wt === 0 ? '#ffd23d' : '#ff5a5a', 2.4, 1.3);
    this.emit('win', w);
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
      if (me.minHpRatio < 0.15) this.tally.comebackWins = 1;
      if (this.superKO) this.tally.superKOs = 1;
    }
    this.onEnd?.({
      won,
      mode: this.mode,
      tally: this.tally,
      superKO: this.superKO && won,
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
    this.superBudget = o.maxHp * (0.1 + (power - 1) * 0.12);
    // cut-in cinematográfico
    this.cutin = { name: f.spec.name, move: d?.name ?? 'Super', icon: '', color, team: f.team, t: 0, max: 1.25 };
    this.emit('super', f, o, d?.name);
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
      this.superBudget = -1;
      f.glow = null;
      f.spinAng = 0;
      f.spinRate = 0;
    }
  }

  private superHit(f: Fighter, o: Fighter, dmg: number, color: string, extra: Partial<StrikeOpts> = {}): boolean {
    return this.strike(f, o, { dmg, reach: 9999, kind: 'super', heavy: true, unblockable: true, kd: Math.random() < 0.45, kb: 420, launch: 420, color, ...extra });
  }

  /** Corre até ao adversário; com `cine` > 0 entra em câmara lenta a essa distância (antes do impacto). */
  private *dashTo(f: Fighter, o: Fighter, speed: number, stopAt = 80, cine = 0): Generator<Yield, void, unknown> {
    f.face(o);
    let t = 0;
    while (Math.abs(o.x - f.x) > stopAt && t < 1.5) {
      t += this.dt;
      if (cine > 0 && Math.abs(o.x - f.x) < stopAt + cine) this.cinematic((f.x + o.x) / 2, -130, 0.3, 0.9, true);
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
    this.cinematic((f.x + o.x) / 2, -130, 0.3, 0.9, true);
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
    yield* this.bounceRopes(f, away, 600);
    f.facing = -away as 1 | -1;
    f.play('clothes');
    yield* this.dashTo(f, o, 800, 70, 80);
    this.superHit(f, o, 80 * p, c, { launch: 600 });
    // uma volta completa no ar (acaba direito, sem salto de rotação quando pára)
    if (o.state !== 'ko') o.spinRate = (-o.facing * Math.PI * 2 * this.spd(f)) / 0.48;
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
      this.cinematic((f.x + o.x) / 2, -150, 0.3, 0.9, true);
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
    this.superHit(f, o, 45 * p, c, { launch: 1100, kb: 60, kd: true });
    this.shake(10, 0.2);
    yield () => o.vz <= 260 || o.state === 'ko';
    this.cinematic(o.x, this.jy(o, J_HIP), 0.3, 1, true);
    yield () => o.vz <= 0 || o.state === 'ko';
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
      if (hits === 5 && next < 0.08) this.cinematic(o.x, -120, 0.3, 0.9, true);
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
    yield () => (o.x - pr.x) * dir < 260 || pr.life <= 0;
    this.cinematic(o.x, -110, 0.3, 0.9, true);
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
      if (f.z < 520) this.cinematic(o.x, -60, 0.3, 0.9, true);
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
    yield* this.carry(f, o, 0.25, [24, 40, 0], [16, 30, 0.8]);
    // salta com o adversário preso nas mãos e roda-o por cima da cabeça (suplex no ar)
    // salto alto mas dentro do enquadramento
    f.vz = 1050;
    f.z = 1;
    f.play('arch', 0.5);
    const flight = (2 * 1050) / GRAV;
    const k = this.spd(f);
    const trail = () => {
      for (let i = 0; i < 2; i++) this.parts.spawn(PK.Ember, f.x, -f.z - 60, (Math.random() - 0.5) * 100, 100, 0.4, 30, c, 0);
    };
    const up = this.carry(f, o, flight * 0.5 * k, [16, 30, 0.8], [-4, 4, 2.9], (t) => t * t * (3 - 2 * t));
    for (let r = up.next(); !r.done; r = up.next()) {
      trail();
      yield r.value;
    }
    const lx = f.x - f.facing * 78 * this.scale(f);
    this.cinematic(lx, -60, 0.3, 0.9, true);
    const down = this.carry(f, o, flight * 0.47 * k, [-4, 4, 2.9], [-30, 30, 4.4], (t) => t * t, lx);
    for (let r = down.next(); !r.done; r = down.next()) {
      trail();
      yield r.value;
    }
    yield () => f.z <= 0;
    o.play('lieKO');
    f.holding = null;
    o.override = null;
    o.x = clamp(lx, -RING + 20, RING - 20);
    const nf = this.slamFacing ?? ((o.x < f.x ? 1 : -1) as 1 | -1);
    this.slamFacing = null;
    o.blendIn(0.14, nf !== o.facing);
    o.facing = nf;
    o.setState('hit');
    this.superHit(f, o, 125 * p, c, { launch: 200, kb: 100, ground: true, kd: true });
    this.settleLying(o, nf);
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
    this.pop('ATOMIC SUPLEX!', f.x, -300, c, 34);
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
    yield () => (o.x - pr.x) * dir < 320 || pr.life <= 0;
    this.cinematic(o.x, -130, 0.28, 1, true);
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
    if (o.state !== 'ko') {
      this.cinematic(o.x, -100, 0.3, 0.9, true);
      yield 0.08;
      this.superHit(f, o, 60 * p, c, { launch: 500, ground: true });
    }
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

