import type { Stats } from '../data/stats';
import { ITEMS } from '../data/items';
import type { Look } from '../render/look';
import { J_BF, J_FF, POSE_KEYS, Skel, copyPose, easeInOut, newPose, solve, type Pose } from '../render/pose';
import type { Expr } from '../render/fighter';
import { ANIMS, limp, locomotion, sample, type AnimName } from './anims';

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
  /** Provocações ao público equipadas (ids de item 'taunt'). */
  taunts?: string[];
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

/** Animações procedimentais de marcha. */
export type Loco = 'walk' | 'run' | 'walkBack' | 'limp';

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

  anim: AnimName | Loco = 'guard';
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
  /** Força da última queda (0 = leve, 1+ = brutal): quanto maior, mais demora a levantar-se. */
  impact = 0;
  /** Golpe de assinatura em curso (s) e a sua cor: dá destaque extra ao impacto. */
  sigT = 0;
  sigColor: string | null = null;
  /** Em pleno voo de um golpe aéreo (crossbody, springboard): os golpes normais não o apanham. */
  flying = false;
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
  /**
   * A sair do ringue depois de eliminado (tag team) ou árbitro: só visual, ninguém lhe bate
   * nem colide com ele; a cena desenha-o normalmente (não esbatido como os 'out').
   */
  exiting = false;
  /** Em cima da corda de cima deste lado (0/1), ou -1. As cordas cedem debaixo dos pés. */
  perchSide = -1;
  referee = false;
  /**
   * Pé de apoio preso ao chão: a anca avança pelo que as pernas fazem (sem deslizar no tapete).
   * Usado ao caminhar/passar as cordas na saída do ringue.
   */
  footLock = false;
  private lockFoot = -1;
  private lockX = 0;
  private lockFacing = 1;
  private prevFX = 0;
  private prevBX = 0;
  /** Multiplicador da cadência da marcha (para dois a andarem juntos). */
  cadence = 1;
  /** Ajuste final da pose antes de resolver o esqueleto (ex.: mãos presas a outro corpo). */
  poseHook: ((p: Pose) => void) | null = null;
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

  play(a: AnimName | Loco, speed = 1, restart = true): void {
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
    this.flying = false;
    // um script interrompido (ex.: atingido a ressaltar nas cordas) não pode deixá-lo solto fora do ringue
    this.noClamp = false;
    this.armor = false;
    this.glow = null;
    // um script interrompido não pode deixar a mão "colada" (ex.: provocação a meio)
    this.poseHook = null;
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

  /** Mantém o pé mais baixo (o de apoio) parado no mundo, deslocando a anca. */
  private plantFoot(): void {
    const sk = this.skel;
    const k = this.spec.look.height;
    let foot = this.lockFoot;
    const vf = sk.x[J_FF] - this.prevFX;
    const vb = sk.x[J_BF] - this.prevBX;
    this.prevFX = sk.x[J_FF];
    this.prevBX = sk.x[J_BF];
    if (foot < 0 || this.lockFacing !== this.facing) foot = sk.y[J_FF] >= sk.y[J_BF] ? J_FF : J_BF;
    else {
      const other = foot === J_FF ? J_BF : J_FF;
      const dy = sk.y[other] - sk.y[foot];
      // o pé que ainda vai a meio do passo (a andar no sentido contrário ao de apoio) só assenta
      // no fim do passo, senão a anca recuaria
      const vp = foot === J_FF ? vf : vb;
      const vo = foot === J_FF ? vb : vf;
      const dir = this.anim === 'walkBack' ? -1 : 1;
      const swinging = vo * dir > 0.25 && vp * dir < 0.05;
      if (dy > 0.6 && (!swinging || dy > 6)) foot = other;
    }
    const fx = this.x + this.facing * sk.x[foot] * k;
    if (foot === this.lockFoot && this.lockFacing === this.facing) this.x += this.lockX - fx;
    else {
      this.lockFoot = foot;
      this.lockX = fx;
      this.lockFacing = this.facing;
    }
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
    if (this.anim === 'limp') {
      // ritmo irregular: o passo na perna magoada é mais curto
      this.phase += dt * 6.4 * this.cadence * (1 - 0.28 * Math.cos(this.phase));
      limp(this.pose, this.phase);
    } else if (this.anim === 'walk' || this.anim === 'run' || this.anim === 'walkBack') {
      this.phase += dt * (this.anim === 'run' ? 15 : 9) * this.cadence;
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
    if (this.poseHook) this.poseHook(this.pose);
    solve(this.pose, this.skel);
    if (this.footLock && !this.override) this.plantFoot();
    else this.lockFoot = -1;
    if (this.flashT > 0) this.flashT -= dt;
    if (this.exprT > 0) {
      this.exprT -= dt;
      if (this.exprT <= 0) this.expr = 'normal';
    }
  }
}
