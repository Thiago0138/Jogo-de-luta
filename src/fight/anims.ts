import { FA, P, TORSO, UA, easeInOut, easeOut, lerpPose, type Pose } from '../render/pose';

export interface Key {
  t: number;
  p: Pose;
  /** Easing de chegada a esta pose. */
  e?: (t: number) => number;
}

export interface Anim {
  keys: Key[];
  loop?: boolean;
}

const lin = (t: number) => t;
const snap = (t: number) => 1 - Math.pow(1 - t, 3);

// ───────────── Poses base ─────────────
export const GUARD = P({});
const GUARD_B = P({ dy: 3, lean: 0.12, fa1: 0.88, ba1: 1.02, fa2: 1.7 });

const JAB_W = P({ lean: 0.02, fa1: 0.5, fa2: 2.6, ba1: 0.9, ba2: 2.3 });
const JAB = P({ lean: 0.22, fa1: 1.45, fa2: 0.05, ba1: 0.95, ba2: 2.3, fl1: 0.45, bl1: -0.4 });
const CROSS_W = P({ lean: -0.05, ba1: 0.6, ba2: 2.4, fa1: 0.8, fa2: 2.3 });
const CROSS = P({ lean: 0.35, ba1: 1.5, ba2: 0.0, fa1: 0.4, fa2: 2.4, fl1: 0.5, bl1: -0.5, bl2: -0.1 });
const HOOK_W = P({ lean: -0.1, fa1: 0.9, fa2: 1.6, head: -0.1 });
const HOOK = P({ lean: 0.35, fa1: 1.55, fa2: 1.15, head: 0.1, fl1: 0.45, bl1: -0.45 });
const UPPER_W = P({ dy: 12, lean: 0.35, fa1: 0.2, fa2: 1.6, fl2: -0.8, bl2: -0.6, fl1: 0.6 });
const UPPER = P({ dy: -6, lean: -0.15, fa1: 2.6, fa2: 0.45, head: -0.2, fl1: 0.3, bl1: -0.2 });
const BODY_W = P({ dy: 14, lean: 0.4, ba1: 0.4, ba2: 2.2, fl2: -0.9, bl2: -0.6, fl1: 0.7 });
const BODY = P({ dy: 14, lean: 0.55, ba1: 1.1, ba2: 0.2, fa1: 0.6, fa2: 2.5, fl2: -0.9, bl2: -0.6, fl1: 0.7 });
const KICK_W = P({ lean: -0.2, fl1: 1.3, fl2: -1.6, bl1: -0.1, fa1: 0.4, ba1: -0.3, ba2: 1.2 });
const KICK = P({ lean: -0.35, fl1: 1.6, fl2: 0, bl1: -0.05, bl2: 0, fa1: 0.0, fa2: 1.8, ba1: -0.6, ba2: 0.6, head: 0.15 });

const HIT_HI = P({ lean: -0.4, head: -0.55, fa1: 0.1, fa2: 1.0, ba1: -0.3, ba2: 0.6, fl1: 0.3, bl1: -0.35, dx: -6 });
const HIT_BODY = P({ lean: 0.6, head: 0.3, fa1: 0.4, fa2: 1.9, ba1: 0.5, ba2: 1.8, fl2: -0.5, bl2: -0.4, dy: 6 });
const BLOCK = P({ lean: 0.15, head: 0.25, fa1: 1.05, fa2: 2.55, ba1: 1.1, ba2: 2.45, dy: 4, fl2: -0.4 });
const SWAY = P({ lean: -0.5, head: -0.25, dx: -14, fa1: 0.4, fa2: 2.5, ba1: 0.6, ba2: 2.4, fl1: 0.5, bl1: -0.1, bl2: -0.5 });
const DUCK = P({ dy: 22, lean: 0.75, head: -0.3, fl1: 0.9, fl2: -1.6, bl1: -0.1, bl2: -1.3, fa1: 0.9, fa2: 2.4, ba1: 1.0, ba2: 2.3 });

const LIE = P({ rot: -1.57, lean: 0, head: 0.2, fa1: 2.3, fa2: 0.3, ba1: 1.6, ba2: 0.4, fl1: 0.25, fl2: -0.35, bl1: -0.1, bl2: -0.1 });
const LIE2 = P({ rot: -1.57, lean: 0.02, head: 0.35, fa1: 2.5, fa2: 0.5, ba1: 1.5, ba2: 0.6, fl1: 0.4, fl2: -0.6, bl1: -0.05, bl2: -0.05 });
const FALL = P({ rot: -0.9, lean: -0.3, head: -0.4, fa1: 2.0, fa2: 0.4, ba1: 1.6, ba2: 0.3, fl1: 0.6, fl2: -0.3, bl1: 0.2 });
const SIT = P({ rot: -0.25, lean: -0.25, dy: 40, fl1: 1.5, fl2: -1.7, bl1: 1.4, bl2: -1.9, fa1: -0.6, fa2: 0.3, ba1: -0.7, ba2: 0.2, head: 0.3 });
const KNEEL = P({ dy: 30, lean: 0.4, fl1: 1.5, fl2: -1.5, bl1: -0.4, bl2: -1.5, fa1: 0.9, fa2: 0.5, ba1: 0.8, ba2: 0.4 });

const GRAB = P({ lean: 0.35, fa1: 1.35, fa2: 0.5, ba1: 1.25, ba2: 0.7, fl1: 0.5, bl1: -0.45 });
const LIFT = P({ lean: -0.45, head: -0.3, fa1: 2.9, fa2: 0.1, ba1: 2.8, ba2: 0.2, fl1: 0.3, bl1: -0.3, dy: 2 });
const ARCH = P({ lean: -1.2, head: -0.5, fa1: 2.9, fa2: 0.2, ba1: 2.8, ba2: 0.2, fl1: 0.6, fl2: -0.9, bl1: 0.3, bl2: -0.8, dy: 18 });
const SLAM_DOWN = P({ lean: 0.7, head: 0.3, fa1: 1.3, fa2: 0.2, ba1: 1.2, ba2: 0.3, fl1: 0.7, fl2: -0.8, bl1: -0.4, bl2: -0.4, dy: 14 });

const TAUNT1 = P({ lean: -0.12, head: -0.25, fa1: 2.4, fa2: 2.0, ba1: 2.3, ba2: 2.0 });
const TAUNT2 = P({ lean: -0.18, head: -0.35, fa1: 2.6, fa2: 1.6, ba1: 2.5, ba2: 1.7, dy: -3 });
// "six seven": mãos com as palmas para cima à altura da cintura, a subir e descer alternadas (como uma balança)
const SIX_A = P({ lean: -0.04, head: -0.12, fa1: 0.62, fa2: 1.72, ba1: 0.22, ba2: 0.95, fl1: 0.28, bl1: -0.28, dy: 1 });
const SIX_B = P({ lean: -0.04, head: 0.05, fa1: 0.22, fa2: 0.95, ba1: 0.62, ba2: 1.72, fl1: 0.28, bl1: -0.28, dy: 3 });
// a farmar aura: queixo levantado, olhar de lado, postura relaxada (a mão no maxilar vai por poseHook)
const AURA = P({ lean: -0.12, head: -0.32, fa1: 0.8, fa2: 2.4, ba1: 0.25, ba2: 0.35, fl1: 0.3, bl1: -0.3 });
// mão em concha na orelha: "não vos oiço!"
const EAR = P({ lean: -0.18, head: 0.2, fa1: 1.0, fa2: 2.6, ba1: 0.3, ba2: 0.5, fl1: 0.3, bl1: -0.3, dy: 2 });
// tapar o cinto imaginário / apontar para a cintura: campeão
const BELT = P({ lean: -0.1, head: -0.4, fa1: 0.55, fa2: 0.9, ba1: 0.5, ba2: 0.9, fl1: 0.4, bl1: -0.4, dy: -2 });
// danças: "The Floss" (braços esticados a balançar para os lados, anca para o lado oposto)
const FLOSS_A = P({ lean: 0.02, head: 0.08, fa1: 0.62, fa2: 0.12, ba1: -0.5, ba2: 0.12, fl1: 0.22, bl1: -0.22, dx: -7, dy: 2 });
const FLOSS_B = P({ lean: 0.02, head: -0.08, fa1: -0.5, fa2: 0.12, ba1: 0.62, ba2: 0.12, fl1: 0.22, bl1: -0.22, dx: 7, dy: 2 });
// "Running Man": passos no sítio (um joelho sobe enquanto o outro pé desliza para trás), braços a bombear
const RUN_A = P({ lean: 0.08, head: 0.05, fa1: 1.2, fa2: 1.9, ba1: 0.2, ba2: 1.4, fl1: 1.2, fl2: -1.5, bl1: -0.35, bl2: -0.2, dy: 2 });
const RUN_B = P({ lean: 0.08, head: -0.05, fa1: 0.2, fa2: 1.4, ba1: 1.2, ba2: 1.9, fl1: -0.35, fl2: -0.2, bl1: 1.2, bl2: -1.5, dy: 2 });
// "Disco Fever": braço ao céu na diagonal, depois ao chão do outro lado (pose de Travolta)
const DISCO_UP = P({ lean: -0.12, head: -0.35, fa1: 2.6, fa2: 0.1, ba1: 0.5, ba2: 1.6, fl1: 0.35, bl1: -0.35, dx: -4 });
const DISCO_DN = P({ lean: 0.18, head: 0.25, fa1: -0.5, fa2: 0.15, ba1: 0.5, ba2: 1.6, fl1: 0.35, bl1: -0.35, dx: 4, dy: 4 });
// "The Robot": ângulos rectos, movimentos secos e pausas
const ROBOT_A = P({ lean: 0, head: 0.25, fa1: 1.57, fa2: 1.57, ba1: 0.05, ba2: 1.57, fl1: 0.18, bl1: -0.18 });
const ROBOT_B = P({ lean: 0, head: -0.25, fa1: 0.05, fa2: 1.57, ba1: 1.57, ba2: 1.57, fl1: 0.18, bl1: -0.18, dy: 3 });
const ROBOT_C = P({ lean: 0.05, head: 0, fa1: 1.57, fa2: 0.05, ba1: 1.57, ba2: 0.05, fl1: 0.3, bl1: -0.1, dy: 6 });
const VICTORY = P({ lean: -0.1, head: -0.3, fa1: 2.95, fa2: 0.15, ba1: 2.8, ba2: 0.2, fl1: 0.2, bl1: -0.2 });
const VICTORY2 = P({ lean: -0.15, head: -0.35, fa1: 2.75, fa2: 0.5, ba1: 3.0, ba2: 0.1, fl1: 0.25, bl1: -0.2, dy: -4 });

const CHARGE = P({ dy: 14, lean: -0.15, head: -0.3, fa1: 1.8, fa2: 0.6, ba1: 1.9, ba2: 0.4, fl1: 0.7, fl2: -0.9, bl1: -0.6, bl2: -0.5 });
const HAYMAKER_W = P({ lean: -0.3, ba1: -0.4, ba2: 1.8, fa1: 0.7, fa2: 2.2, fl1: 0.5, bl1: -0.3, dx: -6 });
const HAYMAKER = P({ lean: 0.5, ba1: 1.6, ba2: -0.05, fa1: 0.3, fa2: 2.2, fl1: 0.8, fl2: -0.3, bl1: -0.6, bl2: -0.2, dx: 10 });

const CLOTHES = P({ lean: 0.2, fa1: 1.6, fa2: 0.0, ba1: -0.4, ba2: 1.0 });
// corpo esticado na horizontal, pernas juntas para a frente (ligeiramente para cima)
const DROPKICK = P({ rot: -1.35, lean: 0, fl1: 0.42, fl2: 0.02, bl1: 0.3, bl2: 0.05, fa1: -0.5, fa2: 1.2, ba1: -0.8, ba2: 1.0, head: 0.55 });
const TUCK = P({ lean: 0.6, fl1: 1.8, fl2: -2.2, bl1: 1.6, bl2: -2.1, fa1: 1.3, fa2: 1.4, ba1: 1.2, ba2: 1.5, head: 0.3 });
const SPLASH = P({ rot: 1.45, lean: 0, fa1: 2.8, fa2: 0.2, ba1: 2.7, ba2: 0.3, fl1: 0.1, bl1: -0.1, head: -0.5 });
const ELBOW = P({ rot: 1.3, fa1: 1.6, fa2: 2.6, ba1: 1.2, ba2: 1.5, fl1: 0.4, bl1: -0.3, head: -0.2 });
// agachado em cima da corda: as DUAS pernas iguais, para os dois pés assentarem na corda (nenhum a flutuar)
const PERCH = P({ dy: 30, lean: 0.38, fl1: 1.15, fl2: -1.75, bl1: 1.05, bl2: -1.65, fa1: 0.4, fa2: 1.1, ba1: 1.9, ba2: 0.5 });
// joelho bem alto, braço de trás a equilibrar; depois o tacão desce com o peso do corpo todo
const STOMP_UP = P({ lean: -0.15, fl1: 1.75, fl2: -2.0, fa1: 1.2, fa2: 1.9, ba1: -0.35, ba2: 1.2 });
const STOMP = P({ dy: 6, lean: 0.32, fl1: 0.85, fl2: -0.05, fa1: 0.2, fa2: 1.6, ba1: 0.9, ba2: 1.0 });
// pisão final: braços no ar a puxar pelo público, joelho ao peito
const STOMP_WIND = P({ lean: -0.25, fl1: 1.85, fl2: -2.1, fa1: 2.9, fa2: 0.3, ba1: 2.7, ba2: 0.4, head: 0.25 });
const PIN = P({ rot: 1.5, lean: 0.1, fa1: 1.2, fa2: 0.6, ba1: 1.4, ba2: 0.4, fl1: 0.2, fl2: -0.8, bl1: -0.4, bl2: -0.4, head: -0.4 });
const REACH = P({ lean: 0.4, fa1: 2.0, fa2: 0.05, ba1: 0.6, ba2: 2.0, fl1: 0.5, bl1: -0.5 });
const APRON = P({ lean: 0.08, fa1: 1.75, fa2: 0.45, ba1: 0.2, ba2: 0.3 });
const SPIN = P({ lean: 0.05, fa1: 1.57, fa2: 0, ba1: -1.57, ba2: 0, fl1: 0.3, bl1: -0.3 });
const WINGS = P({ dy: -6, lean: -0.25, head: -0.4, fa1: 2.4, fa2: 0.2, ba1: 2.2, ba2: 0.3, fl1: 0.15, bl1: -0.15, fl2: -0.2 });
const RISE = P({ lean: -0.1, head: -0.2, fa1: 2.8, fa2: 0.6, ba1: 0.4, ba2: 0.3, fl1: 0.1, fl2: -0.1, bl1: -0.4, bl2: -0.9 });
const STUN1 = P({ lean: -0.15, head: 0.35, fa1: 0.2, fa2: 0.7, ba1: 0.1, ba2: 0.6, dx: -4 });
const STUN2 = P({ lean: 0.2, head: -0.35, fa1: 0.25, fa2: 0.6, ba1: 0.2, ba2: 0.5, dx: 4 });

const DANCE1 = P({ lean: -0.1, head: -0.3, fa1: 2.7, fa2: 0.4, ba1: 0.4, ba2: 1.8, fl1: 0.5, fl2: -0.6, bl1: -0.3, dy: 4 });
const DANCE2 = P({ lean: 0.15, head: 0.2, fa1: 0.4, fa2: 1.8, ba1: 2.7, ba2: 0.4, fl1: -0.1, bl1: 0.3, bl2: -0.6, dy: 4 });
const DANCE3 = P({ lean: 0, head: -0.1, fa1: 1.6, fa2: -0.3, ba1: 1.5, ba2: 0.3, fl1: 0.2, bl1: -0.2, dy: -4 });
const FLEX = P({ lean: -0.05, head: -0.25, fa1: 1.9, fa2: 2.3, ba1: 1.75, ba2: 2.3, fl1: 0.35, bl1: -0.35, dy: 2 });
const FLEX2 = P({ lean: -0.12, head: -0.35, fa1: 2.1, fa2: 2.1, ba1: 1.95, ba2: 2.1, fl1: 0.35, bl1: -0.35, dy: 4 });
// de pé em cima da corda de cima: pés juntos (a corda é uma linha), a fazer músculo
const PERCH_FLEX = P({ ...FLEX, lean: -0.05, fl1: 0.08, fl2: -0.12, bl1: -0.06, bl2: -0.1, dy: 4 });
const PERCH_FLEX2 = P({ ...FLEX2, lean: -0.1, fl1: 0.08, fl2: -0.14, bl1: -0.06, bl2: -0.12, dy: 6 });
const POINT = P({ lean: -0.15, head: -0.45, fa1: 2.9, fa2: 0.05, ba1: 0.7, ba2: 1.6, fl1: 0.25, bl1: -0.25 });
const TIRED = P({ lean: 0.55, head: -0.2, dy: 10, fa1: 0.55, fa2: 0.7, ba1: 0.45, ba2: 0.6, fl1: 0.45, fl2: -0.7, bl1: -0.25, bl2: -0.5 });
const TIRED2 = P({ lean: 0.62, head: -0.1, dy: 13, fa1: 0.6, fa2: 0.6, ba1: 0.5, ba2: 0.55, fl1: 0.45, fl2: -0.75, bl1: -0.25, bl2: -0.55 });
const CLINCH = P({ lean: 0.55, head: 0.3, fa1: 1.5, fa2: 1.2, ba1: 1.4, ba2: 1.3, fl1: 0.5, bl1: -0.6, bl2: -0.2 });

// superkick: joelho ao peito (câmara), depois o corpo inclina-se para trás e a sola sobe ao queixo
const SKICK_W = P({ lean: 0.05, head: 0.1, fl1: 1.55, fl2: -2.0, bl1: -0.05, bl2: -0.15, fa1: 0.7, fa2: 1.7, ba1: -0.3, ba2: 1.3, dy: 2 });
const SKICK = P({ lean: -0.85, head: 0.45, fl1: 2.6, fl2: -0.05, bl1: 0.2, bl2: -0.1, fa1: -0.3, fa2: 0.8, ba1: -1.0, ba2: 0.6, dy: 2 });
const SKICK_R = P({ lean: -0.35, head: 0.2, fl1: 1.1, fl2: -1.4, bl1: 0.1, bl2: -0.15, fa1: 0.3, fa2: 1.3, ba1: -0.4, ba2: 1.0 });
// spear: baixo, ombro à frente à altura do abdómen dele
const SPEAR = P({ lean: 1.38, head: 0.2, fa1: 0.95, fa2: 0.5, ba1: 0.85, ba2: 0.6, fl1: 0.85, fl2: -1.0, bl1: -0.95, bl2: -0.45, dy: 26 });

// ── agarrões: poses do atacante e da vítima para cada fase (o motor prende-os pelas articulações) ──
// chave de cabeça à frente: o braço da frente enrola-se à volta da cabeça dele, a outra mão nas costas
const FACELOCK = P({ lean: 0.45, head: 0.15, fa1: 1.05, fa2: 1.95, ba1: 1.25, ba2: 0.8, fl1: 0.5, fl2: -0.35, bl1: -0.5, bl2: -0.3, dy: 6 });
// vítima dobrada pela cintura, braços pendurados
const BENT = P({ lean: 0.95, head: 0.3, fa1: -0.7, fa2: 0.3, ba1: -0.85, ba2: 0.25, fl1: 0.3, fl2: -0.35, bl1: -0.15, bl2: -0.25, dy: 6 });
const BENT_DEEP = P({ lean: 1.55, head: 0.25, fa1: -1.2, fa2: 0.2, ba1: -1.35, ba2: 0.2, fl1: 0.35, fl2: -0.5, bl1: -0.1, bl2: -0.45, dy: 10 });
// corpo hirto no ar (suplex / projeções)
const STIFF = P({ lean: 0.05, head: 0.25, fa1: 0.35, fa2: 0.4, ba1: -0.25, ba2: 0.35, fl1: 0.12, fl2: -0.05, bl1: -0.05, bl2: -0.05 });
// cai de costas com a cabeça dele presa debaixo do braço (DDT / cutter)
const DDT_FALL = P({ rot: -1.35, lean: 0.3, head: 0.45, fa1: -0.15, fa2: 0.45, ba1: 1.1, ba2: 1.0, fl1: 0.8, fl2: -0.45, bl1: 0.45, bl2: -0.35 });
const CUT_JUMP = P({ lean: 0.25, head: 0.1, fa1: 1.25, fa2: 1.9, ba1: 0.6, ba2: 1.2, fl1: 1.2, fl2: -1.5, bl1: 0.7, bl2: -1.4 });
// powerbomb
const PB_GRAB = P({ lean: 0.95, head: 0.35, fa1: 0.45, fa2: 0.5, ba1: 0.4, ba2: 0.6, fl1: 0.65, fl2: -0.8, bl1: -0.45, bl2: -0.6, dy: 14 });
const PB_HOLD = P({ lean: -0.12, head: 0.1, fa1: 0.9, fa2: 2.3, ba1: 0.8, ba2: 2.35, fl1: 0.42, fl2: -0.3, bl1: -0.42, bl2: -0.25, dy: 5 });
const PB_SLAM = P({ lean: 0.7, head: 0.3, fa1: 1.35, fa2: 0.25, ba1: 1.25, ba2: 0.35, fl1: 1.2, fl2: -1.85, bl1: 0.75, bl2: -1.95, dy: 4 });
// sentado nos ombros dele, de frente, pernas por cima dos ombros
const SEATED = P({ lean: -0.15, head: 0.15, fa1: 2.5, fa2: 0.9, ba1: 2.1, ba2: 1.1, fl1: 1.6, fl2: -1.45, bl1: 1.45, bl2: -1.55 });
// chokeslam
const CHOKE_GRAB = P({ lean: 0.12, head: 0.05, fa1: 1.62, fa2: 0.12, ba1: 0.9, ba2: 1.4, fl1: 0.45, fl2: -0.2, bl1: -0.4, bl2: -0.2 });
const CHOKE_LIFT = P({ lean: -0.32, head: -0.3, fa1: 2.85, fa2: 0.05, ba1: 1.75, ba2: 0.9, fl1: 0.4, fl2: -0.15, bl1: -0.5, bl2: -0.2, dy: -5 });
const CHOKE_SLAM = P({ lean: 0.75, head: 0.3, fa1: 1.15, fa2: 0.05, ba1: 0.55, ba2: 0.9, fl1: 0.85, fl2: -1.1, bl1: -0.45, bl2: -0.7, dy: 18 });
// pendurado pelo pescoço: mãos no pulso dele, pernas a espernear
const HANG = P({ lean: 0.08, head: -0.45, fa1: 2.65, fa2: 0.55, ba1: 2.4, ba2: 0.75, fl1: 0.55, fl2: -0.95, bl1: 0.05, bl2: -0.45 });
const HANG2 = P({ lean: 0.04, head: -0.4, fa1: 2.55, fa2: 0.65, ba1: 2.5, ba2: 0.65, fl1: 0.15, fl2: -0.4, bl1: 0.45, bl2: -0.95 });
// de barriga para baixo (por cima do adversário depois de um spear/splash, ou a falhar um mergulho)
const PRONE = P({ rot: 1.52, lean: 0.05, head: -0.45, fa1: 1.25, fa2: 0.9, ba1: 1.5, ba2: 0.6, fl1: 0.12, fl2: -0.3, bl1: -0.15, bl2: -0.2 });
const PUSH_UP = P({ rot: 0.75, lean: 0.55, head: -0.3, dy: 22, fa1: 0.6, fa2: 0.3, ba1: 0.7, ba2: 0.3, fl1: 1.35, fl2: -1.75, bl1: 0.4, bl2: -1.7 });
// moonsault: costas arqueadas, braços para trás por cima da cabeça
const MOON = P({ lean: -0.4, head: -0.45, fa1: 2.85, fa2: 0.25, ba1: 2.7, ba2: 0.3, fl1: 0.35, fl2: -0.7, bl1: 0.15, bl2: -0.6 });
// a apontar para o céu (chama o raio)
const CALL = P({ lean: -0.2, head: -0.5, fa1: 3.0, fa2: 0.05, ba1: 0.5, ba2: 1.4, fl1: 0.3, bl1: -0.3 });

const ROPES = P({ lean: -0.5, head: -0.25, fa1: -0.7, fa2: 1.3, ba1: -0.9, ba2: 1.1, fl1: 0.45, fl2: -0.6, bl1: -0.25, bl2: -0.2, dy: 4 });
const KIPUP = P({ rot: -1.2, lean: 0.2, fl1: 1.9, fl2: -1.6, bl1: 1.7, bl2: -1.7, fa1: 2.7, fa2: 1.8, ba1: 2.6, ba2: 1.8, head: 0.3 });


// ───────────── Saída do ringue (tag team): levantar-se zonzo, passar as cordas, árbitro ─────────────
const G_STIR = P({ rot: -1.5, lean: 0.05, head: 0.45, fa1: 2.9, fa2: 1.9, ba1: 1.4, ba2: 0.5, fl1: 0.5, fl2: -0.9, bl1: -0.05, bl2: -0.1 });
const G_SIT = P({ rot: -0.3, lean: -0.15, dy: 40, head: 0.75, fl1: 1.45, fl2: -1.5, bl1: 1.3, bl2: -1.7, fa1: -0.5, fa2: 0.25, ba1: -0.75, ba2: 0.2 });
const G_SIT2 = P({ rot: -0.2, lean: 0.05, dy: 40, head: 0.4, fl1: 1.5, fl2: -1.6, bl1: 1.35, bl2: -1.8, fa1: 2.4, fa2: 2.3, ba1: -0.7, ba2: 0.2 });
const G_KNEEL = P({ dy: 30, lean: 0.6, head: 0.55, fl1: 1.5, fl2: -1.5, bl1: -0.4, bl2: -1.5, fa1: 0.95, fa2: 0.25, ba1: 0.45, ba2: 0.35 });
const G_KNEEL2 = P({ dy: 32, lean: 0.5, head: 0.25, fl1: 1.45, fl2: -1.45, bl1: -0.45, bl2: -1.5, fa1: 0.9, fa2: 0.3, ba1: 0.4, ba2: 0.4 });
const G_HUNCH = P({ dy: 16, lean: 0.8, head: 0.3, fl1: 0.5, fl2: -0.75, bl1: -0.3, bl2: -0.65, fa1: 0.55, fa2: 0.2, ba1: 0.5, ba2: 0.25 });
const DAZED = P({ lean: 0.3, head: 0.4, fa1: 2.75, fa2: 2.2, ba1: 0.35, ba2: 1.9, fl1: 0.22, fl2: -0.25, bl1: -0.2, bl2: -0.35, dx: -2 });
const DAZED2 = P({ lean: 0.22, head: 0.2, fa1: 2.7, fa2: 2.3, ba1: 0.3, ba2: 1.95, fl1: 0.2, fl2: -0.2, bl1: -0.24, bl2: -0.3, dx: 3 });
// passar entre as cordas: agacha-se, passa a perna da frente por cima da corda do meio,
// apoia-a do outro lado, transfere o peso e traz a perna de trás
const R_DUCK = P({ lean: 0.85, head: -0.45, fa1: 1.4, fa2: 0.4, ba1: 1.9, ba2: 0.5, fl1: 0.3, fl2: -0.45, bl1: -0.3, bl2: -0.35 });
const R_LEG = P({ lean: 1.0, head: -0.5, fa1: 1.4, fa2: 0.4, ba1: 1.9, ba2: 0.5, fl1: 1.5, fl2: -1.35, bl1: -0.28, bl2: -0.2 });
const R_PLANT = P({ lean: 0.9, head: -0.4, fa1: 1.3, fa2: 0.5, ba1: 1.8, ba2: 0.5, fl1: 0.62, fl2: 0, bl1: -0.6, bl2: -0.12 });
const R_SHIFT = P({ lean: 0.6, head: -0.3, fa1: 1.0, fa2: 0.6, ba1: 1.5, ba2: 0.6, fl1: 0.02, fl2: -0.15, bl1: -0.5, bl2: -1.6 });
const R_TRAIL = P({ lean: 0.35, head: -0.15, fa1: 0.8, fa2: 1.0, ba1: 1.0, ba2: 0.9, fl1: -0.05, fl2: -0.12, bl1: 1.0, bl2: -1.35 });
const R_DONE = P({ lean: 0.18, fl1: -0.08, fl2: -0.1, bl1: 0.12, bl2: -0.15 });
// descer do avental para o chão / subir do chão para o avental
const HOP_DOWN = P({ lean: 0.35, head: 0.3, fl1: 0.9, fl2: -1.0, bl1: 0.3, bl2: -1.2, fa1: 1.6, fa2: 0.8, ba1: 1.2, ba2: 0.6 });
const HOP_LAND = P({ dy: 14, lean: 0.7, head: 0.4, fl1: 0.75, fl2: -1.2, bl1: -0.2, bl2: -1.0, fa1: 0.7, fa2: 0.4, ba1: 0.5, ba2: 0.4 });
const STEP_UP = P({ lean: 0.4, head: -0.2, fl1: 1.6, fl2: -1.7, bl1: -0.35, bl2: -0.2, fa1: 1.3, fa2: 0.5, ba1: 0.4, ba2: 0.6 });
// árbitro
const REF_SQUAT = P({ lean: 1.05, head: 0.1, fl1: 1.05, fl2: -1.96, bl1: 0.9, bl2: -2.02, fa1: 1.1, fa2: 0.3, ba1: 1.0, ba2: 0.3 });
const REF_HALF = P({ lean: 0.7, head: 0, fl1: 0.65, fl2: -1.15, bl1: 0.45, bl2: -1.15, fa1: 1.0, fa2: 0.5, ba1: 0.9, ba2: 0.5 });
const REF_UP = P({ lean: 0.22, head: 0.05, fl1: 0.22, fl2: -0.2, bl1: -0.22, bl2: -0.15, fa1: 0.9, fa2: 0.8, ba1: 0.8, ba2: 0.7 });
const REF_HOLD = P({ lean: 0.12, head: 0.1, fl1: 1.05, fl2: -1.05, bl1: -0.12, bl2: -0.1, fa1: 1.7, fa2: 0.5, ba1: 0.9, ba2: 0.4 });

function A(keys: [number, Pose, ((t: number) => number)?][], loop = false): Anim {
  return { keys: keys.map(([t, p, e]) => ({ t, p, e })), loop };
}

export const ANIMS = {
  guard: A([[0, GUARD], [0.45, GUARD_B], [0.9, GUARD]], true),
  jab: A([[0, GUARD], [0.08, JAB_W], [0.15, JAB, snap], [0.24, JAB], [0.4, GUARD]]),
  cross: A([[0, GUARD], [0.1, CROSS_W], [0.19, CROSS, snap], [0.3, CROSS], [0.5, GUARD]]),
  hook: A([[0, GUARD], [0.14, HOOK_W], [0.24, HOOK, snap], [0.36, HOOK], [0.58, GUARD]]),
  upper: A([[0, GUARD], [0.18, UPPER_W], [0.28, UPPER, snap], [0.44, UPPER], [0.7, GUARD]]),
  body: A([[0, GUARD], [0.12, BODY_W], [0.21, BODY, snap], [0.32, BODY], [0.52, GUARD]]),
  kick: A([[0, GUARD], [0.16, KICK_W], [0.27, KICK, snap], [0.42, KICK], [0.66, GUARD]]),
  hitHi: A([[0, HIT_HI, snap], [0.3, HIT_HI], [0.45, GUARD]]),
  hitBody: A([[0, HIT_BODY, snap], [0.3, HIT_BODY], [0.45, GUARD]]),
  block: A([[0, BLOCK, snap], [0.3, BLOCK], [0.42, GUARD]]),
  sway: A([[0, GUARD], [0.08, SWAY, snap], [0.3, SWAY], [0.46, GUARD]]),
  duck: A([[0, GUARD], [0.08, DUCK, snap], [0.3, DUCK], [0.46, GUARD]]),
  fall: A([[0, HIT_HI], [0.18, FALL], [0.36, LIE, easeOut], [0.5, LIE2, easeOut]]),
  lie: A([[0, LIE2], [0.6, LIE], [1.2, LIE2]], true),
  getup: A([[0, LIE2], [0.28, SIT], [0.52, KNEEL], [0.78, GUARD]]),
  grab: A([[0, GUARD], [0.15, GRAB, snap], [10, GRAB]]),
  lift: A([[0, GRAB], [0.3, LIFT, easeInOut], [10, LIFT]]),
  arch: A([[0, LIFT], [0.25, ARCH, easeIn2()], [10, ARCH]]),
  slam: A([[0, LIFT], [0.18, SLAM_DOWN, easeIn2()], [0.6, SLAM_DOWN], [0.9, GUARD]]),
  archUp: A([[0, ARCH], [0.4, KNEEL], [0.7, GUARD]]),
  taunt: A([[0, GUARD], [0.2, TAUNT1], [0.45, TAUNT2], [0.7, TAUNT1], [0.95, TAUNT2], [1.25, GUARD]]),
  sixSeven: A([[0, GUARD], [0.18, SIX_A], [0.42, SIX_B], [0.66, SIX_A], [0.9, SIX_B], [1.14, SIX_A], [1.38, SIX_B], [1.62, GUARD]]),
  shuffle: A([[0, GUARD], [0.15, RUN_A, easeOut], [0.38, RUN_B], [0.61, RUN_A], [0.84, RUN_B], [1.07, RUN_A], [1.3, RUN_B], [1.53, GUARD]]),
  disco: A([[0, GUARD], [0.2, DISCO_UP, snap], [0.55, DISCO_DN, easeInOut], [0.9, DISCO_UP, easeInOut], [1.25, DISCO_DN, easeInOut], [1.6, DISCO_UP, easeInOut], [1.9, GUARD]]),
  floss: A([[0, GUARD], [0.14, FLOSS_A, easeOut], [0.3, FLOSS_B], [0.46, FLOSS_A], [0.62, FLOSS_B], [0.78, FLOSS_A], [0.94, FLOSS_B], [1.1, FLOSS_A], [1.26, FLOSS_B], [1.42, FLOSS_A], [1.62, GUARD]]),
  robot: A([[0, GUARD], [0.08, ROBOT_A, snap], [0.4, ROBOT_A], [0.48, ROBOT_B, snap], [0.8, ROBOT_B], [0.88, ROBOT_C, snap], [1.2, ROBOT_C], [1.28, ROBOT_A, snap], [1.6, ROBOT_A], [1.75, GUARD]]),
  auraFarm: A([[0, GUARD], [0.3, AURA, easeOut], [1.9, AURA], [2.2, GUARD]]),
  earCup: A([[0, GUARD], [0.25, EAR, easeOut], [0.7, P({ ...EAR, lean: -0.25, head: 0.28 })], [1.1, EAR], [1.4, GUARD]]),
  belt: A([[0, GUARD], [0.25, BELT, easeOut], [0.6, P({ ...BELT, dy: -5, head: -0.5 })], [1.0, BELT], [1.3, GUARD]]),
  victory: A([[0, VICTORY], [0.5, VICTORY2], [1.0, VICTORY]], true),
  charge: A([[0, GUARD], [0.2, CHARGE, snap], [10, CHARGE]]),
  haymakerW: A([[0, CHARGE], [0.12, HAYMAKER_W], [10, HAYMAKER_W]]),
  haymaker: A([[0, HAYMAKER_W], [0.08, HAYMAKER, snap], [0.4, HAYMAKER], [0.65, GUARD]]),
  clothes: A([[0, CLOTHES, snap], [10, CLOTHES]]),
  dropkick: A([[0, TUCK], [0.15, DROPKICK, snap], [10, DROPKICK]]),
  tuck: A([[0, TUCK, snap], [10, TUCK]]),
  splash: A([[0, TUCK], [0.2, SPLASH, easeOut], [10, SPLASH]]),
  elbow: A([[0, GUARD], [0.2, ELBOW, easeOut], [10, ELBOW]]),
  perch: A([[0, PERCH], [0.6, P({ ...PERCH, ba1: 2.2, head: -0.3 })], [1.2, PERCH]], true),
  stomp: A([[0, GUARD], [0.18, STOMP_UP, easeOut], [0.25, STOMP, snap], [0.42, STOMP], [0.62, GUARD]]),
  bigStomp: A([[0, GUARD], [0.35, STOMP_WIND, easeOut], [0.55, STOMP_WIND], [0.62, STOMP, snap], [0.85, STOMP], [1.1, GUARD]]),
  pin: A([[0, PIN, easeOut], [10, PIN]]),
  reach: A([[0, GUARD], [0.18, REACH, snap], [10, REACH]]),
  apron: A([[0, APRON], [0.8, P({ ...APRON, dy: 2, head: 0.1 })], [1.6, APRON]], true),
  spin: A([[0, SPIN], [10, SPIN]]),
  wings: A([[0, GUARD], [0.3, WINGS, easeOut], [10, WINGS]]),
  rise: A([[0, CHARGE], [0.2, RISE, snap], [10, RISE]]),
  stun: A([[0, STUN1], [0.45, STUN2], [0.9, STUN1]], true),
  lieKO: A([[0, LIE2], [10, LIE2]]),
  superkick: A([[0, GUARD], [0.16, SKICK_W], [0.25, SKICK, snap], [0.4, SKICK], [0.55, SKICK_R], [0.75, GUARD]]),
  spear: A([[0, SPEAR, snap], [10, SPEAR]]),
  facelock: A([[0, GRAB], [0.12, FACELOCK, easeOut], [10, FACELOCK]]),
  bent: A([[0, BENT], [10, BENT]]),
  bentDeep: A([[0, BENT_DEEP], [10, BENT_DEEP]]),
  stiff: A([[0, STIFF], [10, STIFF]]),
  ddtFall: A([[0, FACELOCK], [0.22, DDT_FALL, (t: number) => t * t], [10, DDT_FALL]]),
  cutJump: A([[0, CUT_JUMP, snap], [10, CUT_JUMP]]),
  pbGrab: A([[0, GRAB], [0.14, PB_GRAB, easeOut], [10, PB_GRAB]]),
  pbHold: A([[0, PB_GRAB], [0.4, PB_HOLD, easeInOut], [0.7, P({ ...PB_HOLD, dy: 8 })], [1.0, PB_HOLD], [10, PB_HOLD]]),
  pbSlam: A([[0, PB_HOLD], [0.16, PB_SLAM, (t: number) => t * t], [0.6, PB_SLAM], [0.95, GUARD]]),
  seated: A([[0, SEATED], [0.25, P({ ...SEATED, fa1: 2.2, ba1: 2.4 })], [0.5, SEATED]], true),
  chokeGrab: A([[0, GUARD], [0.12, CHOKE_GRAB, snap], [10, CHOKE_GRAB]]),
  chokeLift: A([[0, CHOKE_GRAB], [0.38, CHOKE_LIFT, easeInOut], [10, CHOKE_LIFT]]),
  chokeSlam: A([[0, CHOKE_LIFT], [0.15, CHOKE_SLAM, (t: number) => t * t], [0.6, CHOKE_SLAM], [0.95, GUARD]]),
  hang: A([[0, HANG], [0.16, HANG2], [0.32, HANG]], true),
  prone: A([[0, PRONE], [10, PRONE]]),
  proneUp: A([[0, PRONE], [0.25, PUSH_UP], [0.5, KNEEL], [0.75, GUARD]]),
  moonArch: A([[0, PERCH], [0.12, MOON, easeOut], [10, MOON]]),
  call: A([[0, GUARD], [0.15, CALL, snap], [10, CALL]]),
  ropes: A([[0, ROPES, snap], [10, ROPES]]),
  kipup: A([[0, P({ ...KIPUP, rot: -1.57 })], [0.12, KIPUP], [0.3, P({ dy: 18, lean: 0.3, fl1: 0.9, fl2: -1.4, bl1: -0.3, bl2: -1.3 })], [0.45, GUARD, easeOut]]),
  dance: A([[0, DANCE1], [0.3, DANCE3], [0.6, DANCE2], [0.9, DANCE3], [1.2, DANCE1]], true),
  flex: A([[0, GUARD], [0.25, FLEX, snap], [0.8, FLEX2], [1.3, FLEX]], true),
  perchFlex: A([[0, PERCH_FLEX], [0.5, PERCH_FLEX2], [1.0, PERCH_FLEX]], true),
  point: A([[0, GUARD], [0.25, POINT, snap], [0.9, P({ ...POINT, head: -0.6, dy: -3 })], [1.5, POINT]], true),
  tired: A([[0, TIRED], [0.45, TIRED2], [0.9, TIRED]], true),
  clinch: A([[0, GUARD], [0.15, CLINCH, snap], [10, CLINCH]]),
  /** Levanta-se a custo depois de um K.O. (rola, senta-se, ajoelha-se e fica de pé zonzo). */
  groggy: A([[0, LIE2], [0.6, G_STIR], [1.3, G_SIT], [1.85, G_SIT2], [2.55, G_KNEEL], [3.05, G_KNEEL2], [3.75, G_HUNCH], [4.5, DAZED]]),
  dazed: A([[0, DAZED], [0.7, DAZED2], [1.4, DAZED]], true),
  /** Passa entre as cordas (a anca avança pelo pé apoiado: ver Fighter.footLock). */
  ropeStep: A([[0, GUARD], [0.35, R_DUCK], [0.8, R_LEG], [1.2, R_PLANT], [1.7, R_SHIFT], [2.1, R_TRAIL], [2.5, R_DONE]]),
  hopDown: A([[0, DAZED], [0.18, HOP_DOWN], [0.42, HOP_LAND, easeOut], [0.8, DAZED]]),
  stepUp: A([[0, GUARD], [0.18, STEP_UP], [0.42, R_DONE], [0.6, GUARD]]),
  refSquat: A([[0, GUARD], [0.45, REF_SQUAT], [10, REF_SQUAT]]),
  refLift: A([[0, REF_SQUAT], [0.8, REF_SQUAT], [1.5, REF_HALF], [2.2, REF_UP]]),
  refHold: A([[0, GUARD], [0.35, REF_HOLD], [10, REF_HOLD]]),
} satisfies Record<string, Anim>;

function easeIn2() {
  return (t: number) => t * t * t;
}

export type AnimName = keyof typeof ANIMS;

export function animDuration(a: Anim): number {
  return a.keys[a.keys.length - 1].t;
}

/** Amostra uma animação no tempo t (segundos) para dentro de `out`. */
export function sample(a: Anim, t: number, out: Pose): Pose {
  const k = a.keys;
  const end = k[k.length - 1].t;
  if (a.loop && end > 0) t = t % end;
  if (t <= k[0].t) return lerpPose(out, k[0].p, k[0].p, 0);
  for (let i = 1; i < k.length; i++) {
    if (t <= k[i].t) {
      const span = k[i].t - k[i - 1].t;
      const u = span > 0 ? (t - k[i - 1].t) / span : 1;
      return lerpPose(out, k[i - 1].p, k[i].p, (k[i].e ?? easeInOut)(u));
    }
  }
  return lerpPose(out, k[k.length - 1].p, k[k.length - 1].p, 0);
}

/** Ciclo de marcha/corrida procedimental. */
export function locomotion(out: Pose, phase: number, run: boolean, back: boolean): Pose {
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  const amp = run ? 0.85 : 0.42;
  const dir = back ? -1 : 1;
  out.lean = run ? 0.35 : 0.1;
  out.head = run ? -0.2 : 0;
  out.fl1 = 0.05 + s * amp * dir;
  out.fl2 = -0.25 - Math.max(0, c) * (run ? 1.4 : 0.6);
  out.bl1 = 0.05 - s * amp * dir;
  out.bl2 = -0.25 - Math.max(0, -c) * (run ? 1.4 : 0.6);
  if (run) {
    out.fa1 = 0.3 - s * 0.9;
    out.fa2 = 1.6;
    out.ba1 = 0.3 + s * 0.9;
    out.ba2 = 1.6;
  } else {
    out.fa1 = 0.8 + s * 0.08;
    out.fa2 = 1.6;
    out.ba1 = 0.95 - s * 0.08;
    out.ba2 = 1.55;
  }
  out.rot = 0;
  out.dx = 0;
  out.dy = -Math.abs(c) * (run ? 6 : 3);
  return out;
}

/**
 * Passo coxo e zonzo (a sair do ringue depois de um K.O.): tronco curvado, cabeça a pender,
 * a perna de trás (magoada) dobra mais no apoio. Os braços ficam a cargo do chamador (IK).
 */
export function limp(out: Pose, phase: number): Pose {
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  const amp = 0.36;
  out.lean = 0.34 + Math.sin(phase * 2) * 0.05;
  out.head = 0.38 + Math.sin(phase * 0.5) * 0.14;
  out.fl1 = 0.04 + s * amp;
  out.fl2 = -0.25 - Math.max(0, c) * 0.62;
  out.bl1 = 0.04 - s * amp * 0.8;
  out.bl2 = -0.25 - Math.max(0, -c) * 0.5;
  out.fa1 = 2.75;
  out.fa2 = 2.2;
  out.ba1 = 0.35;
  out.ba2 = 1.9;
  out.rot = 0;
  out.dx = Math.sin(phase) * 2;
  out.dy = 0;
  return out;
}

/**
 * IK de dois ossos para um braço: põe a mão em (tx, ty), coordenadas locais do esqueleto
 * (anca na origem, x para a frente, y para baixo — as mesmas de Skel depois de solve).
 * `w` funde com a pose atual (0 = não mexe, 1 = mão exatamente no alvo, se alcançar).
 */
export function armIK(p: Pose, front: boolean, tx: number, ty: number, w = 1): void {
  if (w <= 0) return;
  // desfaz dx/dy e rot (solve aplica-os depois de montar o esqueleto)
  let x = tx - p.dx;
  let y = ty - p.dy;
  if (p.rot !== 0) {
    const c = Math.cos(-p.rot);
    const n = Math.sin(-p.rot);
    const xx = x * c - y * n;
    y = x * n + y * c;
    x = xx;
  }
  const la = p.lean;
  const sx = Math.sin(la) * (TORSO - 8);
  const sy = -Math.cos(la) * (TORSO - 8);
  const dx = x - sx;
  const dy = y - sy;
  const d = Math.min(UA + FA - 0.5, Math.max(Math.abs(UA - FA) + 2, Math.hypot(dx, dy)));
  const phi = Math.atan2(dx, dy);
  const al = Math.acos(Math.max(-1, Math.min(1, (UA * UA + d * d - FA * FA) / (2 * UA * d))));
  const be = Math.acos(Math.max(-1, Math.min(1, (UA * UA + FA * FA - d * d) / (2 * UA * FA))));
  let a1 = phi - al - la;
  const a2 = Math.PI - be;
  const k1 = front ? 'fa1' : 'ba1';
  const k2 = front ? 'fa2' : 'ba2';
  // ângulo equivalente mais próximo do atual (para a fusão não dar uma volta inteira)
  a1 += Math.PI * 2 * Math.round((p[k1] - a1) / (Math.PI * 2));
  p[k1] += (a1 - p[k1]) * w;
  p[k2] += (a2 - p[k2]) * w;
}

/** Posição local (sem rot/dx/dy) do centro da cabeça e de um ponto do tronco (u ao longo, n para a frente). */
export function headLocal(p: Pose): [number, number] {
  const la = p.lean;
  const ha = la + p.head;
  return [Math.sin(la) * TORSO + Math.sin(ha) * 29 + p.dx, -Math.cos(la) * TORSO - Math.cos(ha) * 29 + p.dy];
}

export function torsoLocal(p: Pose, u: number, n: number): [number, number] {
  const la = p.lean;
  return [Math.sin(la) * u + Math.cos(la) * n + p.dx, -Math.cos(la) * u + Math.sin(la) * n + p.dy];
}

export { lin };
