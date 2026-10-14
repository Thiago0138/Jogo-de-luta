import type { Stats } from '../data/stats';
import { ITEMS } from '../data/items';
import type { Look } from '../render/look';
import { POSE_KEYS, Skel, copyPose, easeInOut, newPose, solve, type Pose } from '../render/pose';
import type { Expr } from '../render/fighter';
import { ANIMS, locomotion, sample, type AnimName } from './anims';

export interface FighterSpec {
  name: string;
  level: number;
  stats: Stats;
  look: Look;
  supers: string[];
  passives: string[];
  isPlayer: boolean;
  /** Título exibido (ex.: "Campeão"). */
  title?: string;
  /** Multiplicador de vida (adversários de iniciação). */
  hpMul?: number;
  /** Entrada no ringue (id do item). */
  entrance?: string;
  /** Golpes de assinatura (ids de itens 'move'). */
  moves?: string[];
  /** Estilos visuais de golpe. */
  styles?: string[];
}

export type FState =
  | 'idle'
  | 'act'
  | 'hit'
  | 'down'
  | 'thrown'
  | 'apron'
  | 'out'
  | 'ko'
  | 'victory';

/** Valor que um script pode devolver: segundos a esperar, ou condição a verificar a cada frame. */
export type Yield = number | (() => boolean);
export type Script = Generator<Yield, void, unknown>;

export class Fighter {
  spec: FighterSpec;
  team: 0 | 1;
  slot: number;
  x = 0;
  z = 0;
  vx = 0;
  vz = 0;
  facing: 1 | -1 = 1;
  hp: number;
  maxHp: number;
  meter = 0;
  state: FState = 'idle';
  stateT = 0;

  anim: AnimName | 'walk' | 'run' | 'walkBack' = 'guard';
  at = 0;
  animSpeed = 1;
  phase = 0;
  pose: Pose = newPose();
  skel = new Skel();
  /** Rotação/posição sobrepostas (para ser projetado por outro lutador). */
  override: { x: number; y: number; rot: number } | null = null;
  /** Transição suave a partir da última pose desenhada (ver blendIn). */
  private blendFrom = newPose();
  private blendT = 0;
  private blendMax = 0;

  expr: Expr = 'normal';
  exprT = 0;
  flashT = 0;
  glow: string | null = null;
  layer = 0;

  script: Script | null = null;
  wait: Yield = 0;
  armor = false;
  thinkT = 0.6;
  /** Reação já decidida para o próximo golpe recebido. */
  evade: 'none' | 'dodge' | 'block' = 'none';
  evadeT = 0;
  downT = 0;
  lastHitBy: Fighter | null = null;
  combo = 0;
  comboT = 0;

  // buffs e usos únicos
  furyT = 0;
  ironT = 0;
  speedT = 0;
  usedFolego = false;
  usedFenix = false;
  usedNectar = false;
  minHpRatio = 1;
  /** Estamina 0–100: gasta com golpes, recupera ao respirar. */
  stamina = 100;
  /** Acumulado de dano à cabeça; ao passar o limite o lutador fica atordoado. */
  daze = 0;
  stunT = 0;
  /** Tempo seguido dentro do ringue (tag team). */
  inRingT = 0;
  /** Invisível (ainda não fez a entrada). */
  hidden = false;
  wantX: number | null = null;
  /** Fora das cordas (não limitar ao ringue). */
  noClamp = false;
  spinAng = 0;
  spinRate = 0;
  ghost = false;
  wings = false;
  /** Adversário agarrado (para o libertar se este lutador for interrompido). */
  holding: Fighter | null = null;
  tagCooldown = 0;
  assistCd = 3;
  diveCd = 0;
  tauntCd = 0;

  constructor(spec: FighterSpec, team: 0 | 1, slot: number, hp: number) {
    this.spec = spec;
    this.team = team;
    this.slot = slot;
    this.hp = hp;
    this.maxHp = hp;
  }

  get s(): Stats {
    return this.spec.stats;
  }

  has(passive: string): boolean {
    return this.spec.passives.includes(passive);
  }

  /** Momento a partir do qual cada golpe de assinatura pode voltar a ser usado. */
  cds = new Map<string, number>();
  /** Relógio da luta (atualizado pelo motor) para os cooldowns. */
  clockT = 0;

  /** Sabe fazer o golpe de assinatura e já recuperou dele? */
  can(move: string): boolean {
    return !!this.spec.moves?.includes(move) && (this.cds.get(move) ?? 0) <= this.clockT;
  }

  /** Marca o golpe como usado (cooldown em segundos). */
  used(move: string, cd = 9): void {
    this.cds.set(move, this.clockT + cd);
  }

  /** Estilo visual ativo para um tipo de golpe (ex.: 'fogo' no spear). */
  styleOf(type: string): { style: string; color: string } | null {
    for (const id of this.spec.styles ?? []) {
      const d = ITEMS[id];
      if (d?.vis?.type === type) return { style: d.vis.style ?? '', color: d.vis.c1 ?? '#fff' };
    }
    return null;
  }

  play(a: AnimName | 'walk' | 'run' | 'walkBack', speed = 1, restart = true): void {
    if (!restart && this.anim === a) return;
    // pequena transição para não haver saltos de pose entre animações
    // (se já houver uma transição em curso, continua a partir dela)
    if (this.blendT <= 0) this.blendIn(0.07);
    this.anim = a;
    this.at = 0;
    this.animSpeed = speed;
  }

  setState(s: FState): void {
    this.state = s;
    this.stateT = 0;
  }

  face(target: Fighter | number): void {
    const tx = typeof target === 'number' ? target : target.x;
    if (Math.abs(tx - this.x) > 4) this.facing = tx > this.x ? 1 : -1;
  }

  setExpr(e: Expr, t: number): void {
    this.expr = e;
    this.exprT = t;
  }

  run(script: Script, armor = false): void {
    this.script = script;
    this.wait = 0;
    this.armor = armor;
    this.setState('act');
  }

  stop(): void {
    this.script = null;
    this.wait = 0;
    this.armor = false;
    this.glow = null;
    this.override = null;
    this.ghost = false;
    this.wings = false;
    this.spinAng = 0;
    this.spinRate = 0;
    this.wantX = null;
    const h = this.holding;
    this.holding = null;
    if (h && h.state === 'thrown') {
      h.override = null;
      h.z = 0;
      h.state = 'down';
      h.stateT = 0;
      h.downT = 0.5;
      h.play('lie');
    }
  }

  /**
   * Funde suavemente, durante `dur` segundos, a pose desenhada agora com as animações seguintes.
   * `mirror`: a pose atual é espelhada (para quando o lutador vai mudar de lado já a seguir).
   */
  blendIn(dur: number, mirror = false): void {
    copyPose(this.blendFrom, this.pose);
    if (mirror) for (const k of POSE_KEYS) if (k !== 'dy') this.blendFrom[k] = -this.blendFrom[k];
    this.blendT = this.blendMax = dur;
  }

  get hpRatio(): number {
    return this.hp / this.maxHp;
  }

  get grounded(): boolean {
    return this.z <= 0.01;
  }

  /** Atualiza a pose (animação) e o esqueleto. */
  animate(dt: number, t: number, extraRot = 0): void {
    this.at += dt * this.animSpeed;
    if (this.anim === 'walk' || this.anim === 'run' || this.anim === 'walkBack') {
      this.phase += dt * (this.anim === 'run' ? 15 : 9);
      locomotion(this.pose, this.phase, this.anim === 'run', this.anim === 'walkBack');
    } else {
      sample(ANIMS[this.anim], this.at, this.pose);
      if (this.anim === 'guard') {
        // respiração/balanço de boxe
        this.pose.dy += Math.sin(t * 6 + this.slot) * 1.5;
      }
    }
    if (this.blendT > 0) {
      const b = this.blendFrom;
      // roda pelo caminho mais curto (a rotação de uma projeção pode ter dado voltas)
      const tw = Math.PI * 2;
      b.rot -= tw * Math.round((b.rot - this.pose.rot - extraRot) / tw);
      const u = easeInOut(1 - this.blendT / this.blendMax);
      for (const k of POSE_KEYS) this.pose[k] = b[k] + (this.pose[k] + (k === 'rot' ? extraRot : 0) - b[k]) * u - (k === 'rot' ? extraRot : 0);
      this.blendT -= dt;
    }
    if (extraRot !== 0) this.pose.rot += extraRot;
    solve(this.pose, this.skel);
    if (this.flashT > 0) this.flashT -= dt;
    if (this.exprT > 0) {
      this.exprT -= dt;
      if (this.exprT <= 0) this.expr = 'normal';
    }
  }
}
