import { S, commit } from './state';
import { dayKey } from './rng';
import { STAT_CAP, type StatId } from '../data/stats';

/** Estações do ginásio (cada uma treina um atributo). */
export type StationId = 'bag' | 'speed' | 'press' | 'reflex';

export interface StationDef {
  id: StationId;
  name: string;
  stat: StatId;
  icon: string;
  how: string;
  /** Pontuação mínima para A, B... (S, A, B; abaixo = C). */
  grades: [number, number, number];
}

export const STATIONS: StationDef[] = [
  { id: 'bag', name: 'Heavy Bag', stat: 'for', icon: 'fist', how: 'Tap when the marker hits the gold zone.', grades: [2600, 1800, 1000] },
  { id: 'speed', name: 'Speed Bag', stat: 'vel', icon: 'speed', how: 'Tap when the ring closes on the bag. Keep the rhythm!', grades: [6400, 4600, 2600] },
  { id: 'press', name: 'Power Press', stat: 'res', icon: 'stamina', how: 'Hold to power up, release in the green zone.', grades: [2300, 1600, 900] },
  { id: 'reflex', name: 'Reflex Pads', stat: 'esq', icon: 'dodge', how: 'Tap the side a pad comes from when it reaches the ring.', grades: [5600, 3800, 2100] },
];

export const STATION: Record<StationId, StationDef> = Object.fromEntries(STATIONS.map((s) => [s.id, s])) as Record<StationId, StationDef>;

export type Grade = 'S' | 'A' | 'B' | 'C';

export const ENERGY_MAX = 5;
export const ENERGY_MS = 2 * 3600 * 1000;
export const EXTRA_GEMS = 10;
/** XP de treino por nota: cada 100 XP = +1 no atributo. */
export const GRADE_XP: Record<Grade, number> = { S: 45, A: 32, B: 22, C: 12 };
export const GRADE_COINS: Record<Grade, number> = { S: 120, A: 80, B: 50, C: 25 };
/** A cada N sessões completas ganha-se 1 ponto de atributo. */
export const POINT_EVERY = 8;
/** Abaixo disto a sessão não dá recompensas (desistiu logo). */
export const MIN_SCORE = 200;

export interface GymData {
  v: 1;
  energy: number;
  /** Momento a partir do qual conta a próxima recarga. */
  energyAt: number;
  best: Partial<Record<StationId, number>>;
  bestGrade: Partial<Record<StationId, Grade>>;
  plays: Partial<Record<StationId, number>>;
  /** XP de treino acumulada por atributo (0..99). */
  txp: Partial<Record<StatId, number>>;
  /** Pontos de atributo ganhos no ginásio (total). */
  gained: Partial<Record<StatId, number>>;
  streak: number;
  bestStreak: number;
  lastDay: string;
  sessions: number;
  today: string;
  todayCount: number;
}

const KEY = 'kotr-gym-v1';

function fresh(): GymData {
  return {
    v: 1, energy: ENERGY_MAX, energyAt: Date.now(), best: {}, bestGrade: {}, plays: {}, txp: {}, gained: {},
    streak: 0, bestStreak: 0, lastDay: '', sessions: 0, today: '', todayCount: 0,
  };
}

function load(): GymData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const d = JSON.parse(raw) as Partial<GymData>;
    const g = { ...fresh(), ...d } as GymData;
    if (!Number.isFinite(g.energy)) g.energy = ENERGY_MAX;
    if (!Number.isFinite(g.energyAt)) g.energyAt = Date.now();
    return g;
  } catch {
    return fresh();
  }
}

export const G: GymData = load();

export function saveGym(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(G));
  } catch {
    /* armazenamento indisponível */
  }
}

/** Aplica as recargas de energia que entretanto aconteceram. */
export function tickEnergy(now = Date.now()): void {
  if (G.energy >= ENERGY_MAX) {
    G.energyAt = now;
    return;
  }
  if (G.energyAt > now) G.energyAt = now;
  const n = Math.floor((now - G.energyAt) / ENERGY_MS);
  if (n > 0) {
    G.energy = Math.min(ENERGY_MAX, G.energy + n);
    G.energyAt = G.energy >= ENERGY_MAX ? now : G.energyAt + n * ENERGY_MS;
    saveGym();
  }
}

/** ms até à próxima recarga (0 se cheio). */
export function nextEnergyIn(now = Date.now()): number {
  tickEnergy(now);
  if (G.energy >= ENERGY_MAX) return 0;
  return Math.max(0, G.energyAt + ENERGY_MS - now);
}

export function energy(): number {
  tickEnergy();
  return G.energy;
}

/** Gasta uma sessão (energia grátis ou gemas). Devolve false se não der. */
export function spendSession(useGems: boolean): boolean {
  tickEnergy();
  if (!useGems) {
    if (G.energy <= 0) return false;
    if (G.energy >= ENERGY_MAX) G.energyAt = Date.now();
    G.energy--;
    saveGym();
    return true;
  }
  if (S.gems < EXTRA_GEMS) return false;
  S.gems -= EXTRA_GEMS;
  commit();
  return true;
}

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dayKey(d);
}

/** Sequência de dias seguidos, já contando com "hoje ainda não treinou". */
export function liveStreak(): number {
  const t = dayKey();
  if (G.lastDay === t || G.lastDay === yesterday()) return G.streak;
  return 0;
}

/** Devolve uma sessão paga que não chegou a começar. */
export function refundSession(gems: boolean): void {
  if (gems) {
    S.gems += EXTRA_GEMS;
    commit();
  } else {
    tickEnergy();
    G.energy = Math.min(ENERGY_MAX, G.energy + 1);
    saveGym();
  }
}

export function trainedToday(): boolean {
  return G.lastDay === dayKey();
}

export function gradeFor(st: StationId, score: number): Grade {
  const [s, a, b] = STATION[st].grades;
  return score >= s ? 'S' : score >= a ? 'A' : score >= b ? 'B' : 'C';
}

export interface SessionResult {
  station: StationId;
  score: number;
  grade: Grade;
  best: number;
  newBest: boolean;
  coins: number;
  gems: number;
  stat: StatId;
  xpGain: number;
  xpFrom: number;
  xpTo: number;
  statUps: number;
  statFrom: number;
  statPoint: boolean;
  streak: number;
  streakUp: boolean;
  /** Bónus de moedas por sequência (fração). */
  streakBonus: number;
}

/** Fecha uma sessão: dá recompensas, atualiza recordes e sequência. */
export function finishSession(st: StationId, score: number): SessionResult {
  const def = STATION[st];
  score = Math.max(0, Math.round(score));
  const grade = gradeFor(st, score);
  const prevBest = G.best[st] ?? 0;
  const newBest = score > prevBest && score > 0;
  if (newBest) G.best[st] = score;
  const order = ['C', 'B', 'A', 'S'];
  const pg = G.bestGrade[st];
  if (!pg || order.indexOf(grade) > order.indexOf(pg)) G.bestGrade[st] = grade;
  G.plays[st] = (G.plays[st] ?? 0) + 1;
  // sessão "vazia" (desistiu logo): não conta para nada
  const real = score >= MIN_SCORE;

  // sequência diária
  const t = dayKey();
  let streakUp = false;
  if (real && G.lastDay !== t) {
    G.streak = G.lastDay === yesterday() ? G.streak + 1 : 1;
    G.lastDay = t;
    streakUp = true;
    G.bestStreak = Math.max(G.bestStreak, G.streak);
  }
  if (G.today !== t) {
    G.today = t;
    G.todayCount = 0;
  }
  if (real) {
    G.todayCount++;
    G.sessions++;
  }

  const streakBonus = Math.min(0.5, Math.max(0, G.streak - 1) * 0.1);
  let coins = real ? Math.round(GRADE_COINS[grade] * (1 + streakBonus)) + (newBest && prevBest > 0 ? 50 : 0) : 0;
  const gems = streakUp && G.streak > 0 && G.streak % 7 === 0 ? 10 : 0;

  // XP de treino → atributo
  const stat = def.stat;
  const xpGain = real ? GRADE_XP[grade] : 0;
  const xpFrom = G.txp[stat] ?? 0;
  let x = xpFrom + xpGain;
  let statUps = 0;
  const statFrom = S.stats[stat];
  while (x >= 100) {
    x -= 100;
    if (S.stats[stat] < STAT_CAP) {
      S.stats[stat]++;
      statUps++;
      G.gained[stat] = (G.gained[stat] ?? 0) + 1;
    } else coins += 100;
  }
  G.txp[stat] = x;

  const statPoint = real && G.sessions % POINT_EVERY === 0;
  if (statPoint) S.statPoints++;

  S.coins += coins;
  S.gems += gems;
  saveGym();
  commit();
  return {
    station: st, score, grade, best: Math.max(prevBest, score), newBest, coins, gems, stat, xpGain, xpFrom, xpTo: x, statUps, statFrom,
    statPoint, streak: G.streak, streakUp, streakBonus,
  };
}
