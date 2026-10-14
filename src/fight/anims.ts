import { P, easeInOut, easeOut, lerpPose, type Pose } from '../render/pose';

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
const VICTORY = P({ lean: -0.1, head: -0.3, fa1: 2.95, fa2: 0.15, ba1: 2.8, ba2: 0.2, fl1: 0.2, bl1: -0.2 });
const VICTORY2 = P({ lean: -0.15, head: -0.35, fa1: 2.75, fa2: 0.5, ba1: 3.0, ba2: 0.1, fl1: 0.25, bl1: -0.2, dy: -4 });
const DRINK = P({ lean: -0.05, head: -0.45, ba1: 0.9, ba2: 2.5, fa1: 2.2, fa2: 2.3 });

const CHARGE = P({ dy: 14, lean: -0.15, head: -0.3, fa1: 1.8, fa2: 0.6, ba1: 1.9, ba2: 0.4, fl1: 0.7, fl2: -0.9, bl1: -0.6, bl2: -0.5 });
const HAYMAKER_W = P({ lean: -0.3, ba1: -0.4, ba2: 1.8, fa1: 0.7, fa2: 2.2, fl1: 0.5, bl1: -0.3, dx: -6 });
const HAYMAKER = P({ lean: 0.5, ba1: 1.6, ba2: -0.05, fa1: 0.3, fa2: 2.2, fl1: 0.8, fl2: -0.3, bl1: -0.6, bl2: -0.2, dx: 10 });

const CLOTHES = P({ lean: 0.2, fa1: 1.6, fa2: 0.0, ba1: -0.4, ba2: 1.0 });
const DROPKICK = P({ rot: -1.3, lean: 0, fl1: 1.5, fl2: 0, bl1: 1.4, bl2: 0, fa1: -0.5, fa2: 1.2, ba1: -0.8, ba2: 1.0, head: 0.4 });
const TUCK = P({ lean: 0.6, fl1: 1.8, fl2: -2.2, bl1: 1.6, bl2: -2.1, fa1: 1.3, fa2: 1.4, ba1: 1.2, ba2: 1.5, head: 0.3 });
const SPLASH = P({ rot: 1.45, lean: 0, fa1: 2.8, fa2: 0.2, ba1: 2.7, ba2: 0.3, fl1: 0.1, bl1: -0.1, head: -0.5 });
const ELBOW = P({ rot: 1.3, fa1: 1.6, fa2: 2.6, ba1: 1.2, ba2: 1.5, fl1: 0.4, bl1: -0.3, head: -0.2 });
const PERCH = P({ dy: 34, lean: 0.35, fl1: 1.4, fl2: -1.9, bl1: 1.0, bl2: -1.7, fa1: 0.4, fa2: 1.1, ba1: 1.9, ba2: 0.5 });
const STOMP_UP = P({ lean: -0.1, fl1: 1.1, fl2: -1.4, fa1: 0.9, fa2: 1.8, ba1: 0.4, ba2: 1.4 });
const STOMP = P({ lean: 0.25, fl1: 0.9, fl2: 0.1, fa1: 0.6, fa2: 1.5, ba1: 0.5, ba2: 1.4 });
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
const POINT = P({ lean: -0.15, head: -0.45, fa1: 2.9, fa2: 0.05, ba1: 0.7, ba2: 1.6, fl1: 0.25, bl1: -0.25 });
const TIRED = P({ lean: 0.55, head: -0.2, dy: 10, fa1: 0.55, fa2: 0.7, ba1: 0.45, ba2: 0.6, fl1: 0.45, fl2: -0.7, bl1: -0.25, bl2: -0.5 });
const TIRED2 = P({ lean: 0.62, head: -0.1, dy: 13, fa1: 0.6, fa2: 0.6, ba1: 0.5, ba2: 0.55, fl1: 0.45, fl2: -0.75, bl1: -0.25, bl2: -0.55 });
const CLINCH = P({ lean: 0.55, head: 0.3, fa1: 1.5, fa2: 1.2, ba1: 1.4, ba2: 1.3, fl1: 0.5, bl1: -0.6, bl2: -0.2 });

const SKICK_W = P({ lean: -0.05, fl1: 1.1, fl2: -1.8, bl1: -0.1, bl2: -0.1, fa1: 0.5, fa2: 1.6, ba1: -0.2, ba2: 1.2, dy: -2 });
const SKICK = P({ lean: -0.7, head: 0.35, fl1: 2.2, fl2: -0.05, bl1: 0.15, bl2: -0.05, fa1: -0.4, fa2: 0.8, ba1: -0.9, ba2: 0.6, dy: 4 });
const SPEAR = P({ lean: 1.25, head: 0.35, fa1: 1.05, fa2: 0.45, ba1: 0.95, ba2: 0.55, fl1: 0.65, fl2: -0.7, bl1: -0.95, bl2: -0.3, dy: 16 });

const ROPES = P({ lean: -0.5, head: -0.25, fa1: -0.7, fa2: 1.3, ba1: -0.9, ba2: 1.1, fl1: 0.45, fl2: -0.6, bl1: -0.25, bl2: -0.2, dy: 4 });
const KIPUP = P({ rot: -1.2, lean: 0.2, fl1: 1.9, fl2: -1.6, bl1: 1.7, bl2: -1.7, fa1: 2.7, fa2: 1.8, ba1: 2.6, ba2: 1.8, head: 0.3 });

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
  victory: A([[0, VICTORY], [0.5, VICTORY2], [1.0, VICTORY]], true),
  drink: A([[0, GUARD], [0.18, DRINK], [0.55, DRINK], [0.7, GUARD]]),
  charge: A([[0, GUARD], [0.2, CHARGE, snap], [10, CHARGE]]),
  haymakerW: A([[0, CHARGE], [0.12, HAYMAKER_W], [10, HAYMAKER_W]]),
  haymaker: A([[0, HAYMAKER_W], [0.08, HAYMAKER, snap], [0.4, HAYMAKER], [0.65, GUARD]]),
  clothes: A([[0, CLOTHES, snap], [10, CLOTHES]]),
  dropkick: A([[0, TUCK], [0.15, DROPKICK, snap], [10, DROPKICK]]),
  tuck: A([[0, TUCK, snap], [10, TUCK]]),
  splash: A([[0, TUCK], [0.2, SPLASH, easeOut], [10, SPLASH]]),
  elbow: A([[0, GUARD], [0.2, ELBOW, easeOut], [10, ELBOW]]),
  perch: A([[0, PERCH], [0.6, P({ ...PERCH, ba1: 2.2, head: -0.3 })], [1.2, PERCH]], true),
  stomp: A([[0, GUARD], [0.15, STOMP_UP], [0.25, STOMP, snap], [0.45, GUARD]]),
  pin: A([[0, PIN, easeOut], [10, PIN]]),
  reach: A([[0, GUARD], [0.18, REACH, snap], [10, REACH]]),
  apron: A([[0, APRON], [0.8, P({ ...APRON, dy: 2, head: 0.1 })], [1.6, APRON]], true),
  spin: A([[0, SPIN], [10, SPIN]]),
  wings: A([[0, GUARD], [0.3, WINGS, easeOut], [10, WINGS]]),
  rise: A([[0, CHARGE], [0.2, RISE, snap], [10, RISE]]),
  stun: A([[0, STUN1], [0.45, STUN2], [0.9, STUN1]], true),
  lieKO: A([[0, LIE2], [10, LIE2]]),
  superkick: A([[0, GUARD], [0.14, SKICK_W], [0.24, SKICK, snap], [0.42, SKICK], [0.7, GUARD]]),
  spear: A([[0, SPEAR, snap], [10, SPEAR]]),
  ropes: A([[0, ROPES, snap], [10, ROPES]]),
  kipup: A([[0, P({ ...KIPUP, rot: -1.57 })], [0.12, KIPUP], [0.3, P({ dy: 18, lean: 0.3, fl1: 0.9, fl2: -1.4, bl1: -0.3, bl2: -1.3 })], [0.45, GUARD, easeOut]]),
  dance: A([[0, DANCE1], [0.3, DANCE3], [0.6, DANCE2], [0.9, DANCE3], [1.2, DANCE1]], true),
  flex: A([[0, GUARD], [0.25, FLEX, snap], [0.8, FLEX2], [1.3, FLEX]], true),
  point: A([[0, GUARD], [0.25, POINT, snap], [0.9, P({ ...POINT, head: -0.6, dy: -3 })], [1.5, POINT]], true),
  tired: A([[0, TIRED], [0.45, TIRED2], [0.9, TIRED]], true),
  clinch: A([[0, GUARD], [0.15, CLINCH, snap], [10, CLINCH]]),
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

export { lin };
