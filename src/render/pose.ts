/**
 * Esqueleto 2D do lutador. Ângulos dos membros medem-se a partir da vertical para baixo;
 * positivo roda para a frente (direção para onde o lutador olha).
 */
export interface Pose {
  lean: number;
  head: number;
  fa1: number;
  fa2: number;
  ba1: number;
  ba2: number;
  fl1: number;
  fl2: number;
  bl1: number;
  bl2: number;
  /** Rotação do corpo inteiro em torno da anca. */
  rot: number;
  /** Deslocamento extra da anca (ex.: agachar). */
  dx: number;
  dy: number;
}

export const POSE_KEYS: (keyof Pose)[] = ['lean', 'head', 'fa1', 'fa2', 'ba1', 'ba2', 'fl1', 'fl2', 'bl1', 'bl2', 'rot', 'dx', 'dy'];

export const NEUTRAL: Pose = {
  lean: 0.08, head: 0, fa1: 0.8, fa2: 1.6, ba1: 0.95, ba2: 1.55,
  fl1: 0.25, fl2: -0.2, bl1: -0.25, bl2: -0.15, rot: 0, dx: 0, dy: 0,
};

export function P(p: Partial<Pose>): Pose {
  return { ...NEUTRAL, ...p };
}

export function copyPose(dst: Pose, src: Pose): Pose {
  for (const k of POSE_KEYS) dst[k] = src[k];
  return dst;
}

export function lerpPose(dst: Pose, a: Pose, b: Pose, t: number): Pose {
  for (const k of POSE_KEYS) dst[k] = a[k] + (b[k] - a[k]) * t;
  return dst;
}

export function newPose(): Pose {
  return { ...NEUTRAL };
}

// Medidas base (unidades do mundo); a altura escala tudo.
export const TH = 40;
export const SH = 40;
export const TORSO = 58;
export const NECK = 6;
export const HEAD_R = 27;
export const UA = 30;
export const FA = 29;

// Índices das articulações.
export const J_HIP = 0, J_NECK = 1, J_HEAD = 2, J_SH = 3, J_FE = 4, J_FH = 5, J_BE = 6, J_BH = 7, J_FK = 8, J_FF = 9, J_BK = 10, J_BF = 11;
const NJ = 12;

/** Pontos do esqueleto, reutilizados entre frames para evitar alocações. */
export class Skel {
  x = new Float32Array(NJ);
  y = new Float32Array(NJ);
  torsoA = 0;
  headA = 0;
  /** Ângulos absolutos dos antebraços/canelas (para desenhar luvas/botas). */
  faL = 0; baL = 0; flL = 0; blL = 0;
  /** Ponto mais baixo do corpo, relativo à anca. */
  minY = 0;
}

/** Calcula as posições das articulações com a anca na origem. */
export function solve(p: Pose, s: Skel): Skel {
  const X = s.x, Y = s.y;
  const la = p.lean;
  const tx = Math.sin(la), ty = -Math.cos(la);
  X[J_HIP] = 0; Y[J_HIP] = 0;
  X[J_NECK] = tx * TORSO; Y[J_NECK] = ty * TORSO;
  X[J_SH] = tx * (TORSO - 8); Y[J_SH] = ty * (TORSO - 8);
  s.torsoA = la;
  s.headA = la + p.head;
  X[J_HEAD] = X[J_NECK] + Math.sin(s.headA) * (NECK + HEAD_R - 4);
  Y[J_HEAD] = Y[J_NECK] - Math.cos(s.headA) * (NECK + HEAD_R - 4);

  const fa = la + p.fa1;
  X[J_FE] = X[J_SH] + Math.sin(fa) * UA; Y[J_FE] = Y[J_SH] + Math.cos(fa) * UA;
  s.faL = fa + p.fa2;
  X[J_FH] = X[J_FE] + Math.sin(s.faL) * FA; Y[J_FH] = Y[J_FE] + Math.cos(s.faL) * FA;

  const ba = la + p.ba1;
  X[J_BE] = X[J_SH] + Math.sin(ba) * UA; Y[J_BE] = Y[J_SH] + Math.cos(ba) * UA;
  s.baL = ba + p.ba2;
  X[J_BH] = X[J_BE] + Math.sin(s.baL) * FA; Y[J_BH] = Y[J_BE] + Math.cos(s.baL) * FA;

  X[J_FK] = 3 + Math.sin(p.fl1) * TH; Y[J_FK] = Math.cos(p.fl1) * TH;
  s.flL = p.fl1 + p.fl2;
  X[J_FF] = X[J_FK] + Math.sin(s.flL) * SH; Y[J_FF] = Y[J_FK] + Math.cos(s.flL) * SH;

  X[J_BK] = -3 + Math.sin(p.bl1) * TH; Y[J_BK] = Math.cos(p.bl1) * TH;
  s.blL = p.bl1 + p.bl2;
  X[J_BF] = X[J_BK] + Math.sin(s.blL) * SH; Y[J_BF] = Y[J_BK] + Math.cos(s.blL) * SH;

  if (p.rot !== 0) {
    const c = Math.cos(p.rot), n = Math.sin(p.rot);
    for (let i = 1; i < NJ; i++) {
      const x = X[i], y = Y[i];
      X[i] = x * c - y * n;
      Y[i] = x * n + y * c;
    }
    s.torsoA += p.rot; s.headA += p.rot;
    s.faL += p.rot; s.baL += p.rot; s.flL += p.rot; s.blL += p.rot;
  }
  if (p.dx !== 0 || p.dy !== 0) {
    for (let i = 0; i < NJ; i++) { X[i] += p.dx; Y[i] += p.dy; }
  }
  let m = Math.max(Y[J_FF] + 7, Y[J_BF] + 7, Y[J_HIP] + 17, Y[J_FK] + 10, Y[J_BK] + 10);
  m = Math.max(m, Y[J_HEAD] + HEAD_R, Y[J_FH] + 10, Y[J_BH] + 10, Y[J_NECK] + 20, Y[J_SH] + 20, Y[J_FE] + 9, Y[J_BE] + 9);
  s.minY = m;
  return s;
}

export const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
export const easeIn = (t: number) => t * t;
export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
