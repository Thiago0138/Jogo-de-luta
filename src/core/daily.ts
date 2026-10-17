/**
 * DAILY hub — state and rules (login calendar, Lucky Wheel, Scratch Card, daily challenges,
 * Hot Streak and Mystery Gift). Persisted in its own localStorage key, independent of the main save.
 * Every random draw uses the published odds below (shown to the player in the "Odds" panels).
 */
import type { ChestId } from '../data/chests';
import { ITEMS } from '../data/items';
import { RARITIES, type Rarity } from '../data/rarity';
import type { FightEndEvent } from './events';
import { onFightEnd } from './events';
import { dayKey, hashStr, pick, seeded, shuffle, weighted } from './rng';
import { S, addXp, commit, grant, owns, poolFor, type LevelUp } from './state';

// ───────────────────────── Types ─────────────────────────

export interface Prize {
  coins?: number;
  gems?: number;
  xp?: number;
  chest?: ChestId;
  /** Item id (already rolled). */
  item?: string;
  spins?: number;
  scratches?: number;
}

export interface PrizeResult {
  prize: Prize;
  level: LevelUp | null;
  isNew: boolean;
}

interface DState {
  v: 1;
  login: { last: string; streak: number; cycles: number; total: number; best: number };
  wheel: { freeDay: string; bank: number; spun: number };
  scratch: { freeDay: string; bank: number; played: number; active: ScratchCard | null };
  /** Wins counting toward a bonus spin (3) / scratch card (5). */
  spinCharge: number;
  scratchCharge: number;
  tasks: { day: string; ids: string[]; prog: number[]; claimed: boolean[]; bonus: boolean };
  hot: { cur: number; best: number; reached: number[]; ready: number[] };
  giftAt: number;
  /** Prize rolled by a wheel spin, paid when the animation ends (or on the next visit). */
  pending: Prize | null;
}

const KEY = 'kotr-daily-v1';
const DAY_MS = 86400000;
export const GIFT_MS = 4 * 3600 * 1000;
export const SPIN_GEM_COST = 15;
export const SCRATCH_GEM_COST = 10;
export const SAVER_GEM_COST = 20; // per missed day
export const SAVER_MAX_MISSED = 3;
export const SPIN_CHARGE = 3;
export const SCRATCH_CHARGE = 5;

function fresh(): DState {
  return {
    v: 1,
    login: { last: '', streak: 0, cycles: 0, total: 0, best: 0 },
    wheel: { freeDay: '', bank: 0, spun: 0 },
    scratch: { freeDay: '', bank: 0, played: 0, active: null },
    spinCharge: 0,
    scratchCharge: 0,
    tasks: { day: '', ids: [], prog: [], claimed: [], bonus: false },
    hot: { cur: 0, best: 0, reached: [], ready: [] },
    giftAt: 0,
    pending: null,
  };
}

function load(): DState {
  const base = fresh();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const d = JSON.parse(raw) as Partial<DState>;
    return {
      ...base,
      ...d,
      login: { ...base.login, ...(d.login ?? {}) },
      wheel: { ...base.wheel, ...(d.wheel ?? {}) },
      scratch: { ...base.scratch, ...(d.scratch ?? {}) },
      tasks: { ...base.tasks, ...(d.tasks ?? {}) },
      hot: { ...base.hot, ...(d.hot ?? {}) },
    };
  } catch {
    return base;
  }
}

export const D: DState = load();

export function saveDaily(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(D));
  } catch {
    /* storage full or blocked */
  }
}

// ───────────────────────── Dates ─────────────────────────

function parseDay(k: string): number {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}
function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b) - parseDay(a)) / DAY_MS);
}
/** ms until next local midnight. */
export function msToMidnight(): number {
  const n = new Date();
  const m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
  return m.getTime() - n.getTime();
}

// ───────────────────────── Prizes ─────────────────────────

/** Item of the given rarity, preferring ones the player doesn't own yet. */
export function rollItem(r: Rarity, rnd: () => number = Math.random): string | null {
  const pool = poolFor(r);
  if (!pool.length) return null;
  const fresh = pool.filter((d) => !owns(d.id));
  return pick(fresh.length ? fresh : pool, rnd).id;
}

export function givePrize(p: Prize): PrizeResult {
  if (p.coins) S.coins += p.coins;
  if (p.gems) S.gems += p.gems;
  if (p.chest) S.chests[p.chest] = (S.chests[p.chest] ?? 0) + 1;
  let isNew = false;
  if (p.item) isNew = grant(p.item);
  if (p.spins) D.wheel.bank += p.spins;
  if (p.scratches) D.scratch.bank += p.scratches;
  const level = p.xp ? addXp(p.xp) : null;
  saveDaily();
  commit();
  return { prize: p, level, isNew };
}

/** Prestige tier of a prize (0–6) — drives sounds/confetti. */
export function prizeTier(p: Prize): number {
  let t = 0;
  if (p.item) t = Math.max(t, RARITIES[itemRarity(p.item)].tier);
  if (p.chest) t = Math.max(t, { bronze: 1, prata: 2, ouro: 3, lendario: 4, mitico: 5 }[p.chest]);
  if (p.gems) t = Math.max(t, p.gems >= 40 ? 3 : p.gems >= 15 ? 2 : 1);
  if (p.coins) t = Math.max(t, p.coins >= 500 ? 2 : p.coins >= 250 ? 1 : 0);
  return t;
}

function itemRarity(id: string): Rarity {
  return ITEMS[id]?.rarity ?? 'comum';
}

// ───────────────────────── Login calendar ─────────────────────────

export const LOGIN_REWARDS: { prize: Prize; label: string; rare?: boolean }[] = [
  { prize: { coins: 150 }, label: '150 Coins' },
  { prize: { gems: 5 }, label: '5 Gems' },
  { prize: { coins: 400, spins: 1 }, label: '400 + Spin' },
  { prize: { chest: 'prata' }, label: 'Silver Chest' },
  { prize: { gems: 15, scratches: 1 }, label: '15 Gems + Card' },
  { prize: { chest: 'ouro' }, label: 'Gold Chest' },
  { prize: { gems: 25 }, label: 'Rare Item!', rare: true },
];
/** Day-7 item odds. */
export const DAY7_ODDS: Partial<Record<Rarity, number>> = { epico: 80, lendario: 20 };

/** Each completed week boosts coin/gem rewards: +25% per week, up to +100%. */
export function weekBonus(cycles = D.login.cycles): number {
  return 1 + 0.25 * Math.min(4, cycles);
}

export interface LoginStatus {
  claimedToday: boolean;
  /** Day (1–7) shown as "today" on the calendar. */
  day: number;
  /** Days already done in the current run (shown as claimed). */
  done: number;
  broken: boolean;
  missed: number;
  canSave: boolean;
  saveCost: number;
  /** Week (cycle) for the multiplier, if the claim happens. */
  cycles: number;
}

export function loginStatus(): LoginStatus {
  const today = dayKey();
  const L = D.login;
  if (L.last === today) return { claimedToday: true, day: L.streak, done: L.streak, broken: false, missed: 0, canSave: false, saveCost: 0, cycles: L.cycles };
  const gap = L.last ? daysBetween(L.last, today) : 0;
  const cont = L.streak % 7;
  const nextCycles = L.streak === 7 ? L.cycles + 1 : L.cycles;
  if (!L.last || L.streak === 0) return { claimedToday: false, day: 1, done: 0, broken: false, missed: 0, canSave: false, saveCost: 0, cycles: 0 };
  if (gap === 1) return { claimedToday: false, day: cont + 1, done: cont, broken: false, missed: 0, canSave: false, saveCost: 0, cycles: nextCycles };
  const missed = Math.max(1, gap - 1);
  const canSave = missed <= SAVER_MAX_MISSED;
  return { claimedToday: false, day: cont + 1, done: cont, broken: true, missed, canSave, saveCost: SAVER_GEM_COST * missed, cycles: nextCycles };
}

export function loginPrize(day: number, cycles: number): Prize {
  const base = LOGIN_REWARDS[day - 1].prize;
  const m = weekBonus(cycles);
  const p: Prize = { ...base };
  if (p.coins) p.coins = Math.round((p.coins * m) / 10) * 10;
  if (p.gems) p.gems = Math.round(p.gems * m);
  return p;
}

/** Claims today's login reward. `useSaver` pays gems to keep a broken streak. */
export function claimLogin(useSaver = false): { day: number; res: PrizeResult } | null {
  const st = loginStatus();
  if (st.claimedToday) return null;
  const L = D.login;
  let day = st.day;
  let cycles = st.cycles;
  if (st.broken) {
    if (useSaver && st.canSave && S.gems >= st.saveCost) {
      S.gems -= st.saveCost;
    } else {
      day = 1;
      cycles = 0;
    }
  }
  const prize = loginPrize(day, cycles);
  if (day === 7) {
    const r = weighted(DAY7_ODDS) as Rarity;
    prize.item = rollItem(r) ?? undefined;
    if (!prize.item) prize.chest = 'lendario';
  }
  L.last = dayKey();
  L.streak = day;
  L.cycles = cycles;
  L.total++;
  L.best = Math.max(L.best, L.cycles * 7 + day);
  return { day, res: givePrize(prize) };
}

// ───────────────────────── Lucky Wheel ─────────────────────────

export interface WheelSeg {
  id: string;
  label: string;
  sub: string;
  icon: 'coin' | 'gem' | 'xp' | 'chest' | 'ticket' | 'crown';
  prize: Prize;
  /** Probability in %, all segments sum to 100. */
  w: number;
  color: string;
  chest?: ChestId;
}

export const WHEEL: WheelSeg[] = [
  { id: 'jackpot', label: 'JACKPOT', sub: 'Legendary item + 50 gems', icon: 'crown', prize: { gems: 50 }, w: 0.5, color: '#ff3d6e' },
  { id: 'c100', label: '100', sub: '100 Coins', icon: 'coin', prize: { coins: 100 }, w: 22, color: '#3a7bff' },
  { id: 'g15', label: '15', sub: '15 Gems', icon: 'gem', prize: { gems: 15 }, w: 7, color: '#9b3dff' },
  { id: 'xp', label: '60 XP', sub: '60 XP', icon: 'xp', prize: { xp: 60 }, w: 14, color: '#20b866' },
  { id: 'c250', label: '250', sub: '250 Coins', icon: 'coin', prize: { coins: 250 }, w: 17, color: '#ff8a1a' },
  { id: 'bronze', label: 'BRONZE', sub: 'Bronze Chest', icon: 'chest', prize: { chest: 'bronze' }, w: 10, color: '#3a7bff', chest: 'bronze' },
  { id: 'g5', label: '5', sub: '5 Gems', icon: 'gem', prize: { gems: 5 }, w: 14, color: '#9b3dff' },
  { id: 'scr', label: 'CARD', sub: '+1 Scratch Card', icon: 'ticket', prize: { scratches: 1 }, w: 4, color: '#20b866' },
  { id: 'c600', label: '600', sub: '600 Coins', icon: 'coin', prize: { coins: 600 }, w: 8, color: '#ff8a1a' },
  { id: 'prata', label: 'SILVER', sub: 'Silver Chest', icon: 'chest', prize: { chest: 'prata' }, w: 3.5, color: '#9b3dff', chest: 'prata' },
];

export function freeSpinReady(): boolean {
  return D.wheel.freeDay !== dayKey();
}
export function spinsAvailable(): number {
  return (freeSpinReady() ? 1 : 0) + D.wheel.bank;
}

/** Pays for a spin (free → banked → gems) and rolls the result; the prize stays pending until collected. */
export function spinWheel(payGems = false): number | null {
  if (D.pending) collectPending();
  if (payGems) {
    if (S.gems < SPIN_GEM_COST) return null;
    S.gems -= SPIN_GEM_COST;
  } else if (freeSpinReady()) D.wheel.freeDay = dayKey();
  else if (D.wheel.bank > 0) D.wheel.bank--;
  else return null;
  const w: Record<string, number> = {};
  WHEEL.forEach((s, i) => (w[String(i)] = s.w));
  const index = Number(weighted(w));
  const seg = WHEEL[index];
  const prize: Prize = { ...seg.prize };
  if (seg.id === 'jackpot') prize.item = rollItem('lendario') ?? undefined;
  D.wheel.spun++;
  D.pending = prize;
  saveDaily();
  commit();
  return index;
}

export function collectPending(): PrizeResult | null {
  const p = D.pending;
  if (!p) return null;
  D.pending = null;
  return givePrize(p);
}

// ───────────────────────── Scratch Card ─────────────────────────

export type Sym = 'coin' | 'xp' | 'gem' | 'chest' | 'crown' | 'fist';
export interface ScratchCard {
  grid: Sym[];
  win: Sym | null;
  paid: boolean;
}

export const SCRATCH_TABLE: { sym: Sym; name: string; prize: Prize; w: number }[] = [
  { sym: 'coin', name: '300 Coins', prize: { coins: 300 }, w: 18 },
  { sym: 'xp', name: '80 XP', prize: { xp: 80 }, w: 9 },
  { sym: 'gem', name: '12 Gems', prize: { gems: 12 }, w: 8 },
  { sym: 'chest', name: 'Silver Chest', prize: { chest: 'prata' }, w: 3.5 },
  { sym: 'crown', name: 'Gold Chest + 40 Gems', prize: { chest: 'ouro', gems: 40 }, w: 1.5 },
];
/** Chance of a losing card, in %. */
export const SCRATCH_LOSE = 60;
const ALL_SYMS: Sym[] = ['coin', 'xp', 'gem', 'chest', 'crown', 'fist'];

export function freeScratchReady(): boolean {
  return D.scratch.freeDay !== dayKey();
}
export function scratchesAvailable(): number {
  return (freeScratchReady() ? 1 : 0) + D.scratch.bank;
}

function makeGrid(win: Sym | null): Sym[] {
  const g: Sym[] = win ? [win, win, win] : [];
  const counts: Partial<Record<Sym, number>> = win ? { [win]: 3 } : {};
  while (g.length < 9) {
    const s = pick(ALL_SYMS.filter((x) => x !== win && (counts[x] ?? 0) < 2));
    counts[s] = (counts[s] ?? 0) + 1;
    g.push(s);
  }
  return shuffle(g);
}

/** Starts a new card (consumes a free/banked card or gems). Outcome is decided and saved now. */
export function newScratch(payGems = false): ScratchCard | null {
  if (D.scratch.active) return D.scratch.active;
  if (payGems) {
    if (S.gems < SCRATCH_GEM_COST) return null;
    S.gems -= SCRATCH_GEM_COST;
    commit();
  } else if (freeScratchReady()) D.scratch.freeDay = dayKey();
  else if (D.scratch.bank > 0) D.scratch.bank--;
  else return null;
  const w: Record<string, number> = { lose: SCRATCH_LOSE };
  for (const r of SCRATCH_TABLE) w[r.sym] = r.w;
  const out = weighted(w);
  const win = out === 'lose' ? null : (out as Sym);
  D.scratch.active = { grid: makeGrid(win), win, paid: payGems };
  D.scratch.played++;
  saveDaily();
  return D.scratch.active;
}

/** Finishes the active card and pays the prize. */
export function finishScratch(): PrizeResult | null {
  const c = D.scratch.active;
  if (!c) return null;
  D.scratch.active = null;
  if (!c.win) {
    saveDaily();
    return null;
  }
  const row = SCRATCH_TABLE.find((r) => r.sym === c.win)!;
  return givePrize({ ...row.prize });
}

// ───────────────────────── Daily challenges ─────────────────────────

export interface TaskDef {
  id: string;
  text: string;
  goal: number;
  count: (e: FightEndEvent) => number;
  prize: Prize;
  easy?: boolean;
}

export const TASKS: TaskDef[] = [
  { id: 'w3', text: 'Win 3 fights', goal: 3, count: (e) => (e.won ? 1 : 0), prize: { spins: 1 }, easy: true },
  { id: 'f4', text: 'Play 4 fights', goal: 4, count: () => 1, prize: { coins: 300 }, easy: true },
  { id: 'ko2', text: 'Win 2 fights by KO', goal: 2, count: (e) => (e.won && !e.report.decision ? 1 : 0), prize: { scratches: 1 }, easy: true },
  { id: 'sko', text: 'KO with a Super', goal: 1, count: (e) => (e.won && e.report.superKO ? 1 : 0), prize: { scratches: 1, coins: 150 } },
  { id: 'tag', text: 'Win a Tag fight', goal: 1, count: (e) => (e.won && e.mode === 'tag' ? 1 : 0), prize: { spins: 1 } },
  { id: 'champ', text: 'Beat a Champion', goal: 1, count: (e) => (e.won && e.mode === 'champion' ? 1 : 0), prize: { spins: 1, gems: 10 } },
  { id: 'sup3', text: 'Use 3 Supers', goal: 3, count: (e) => e.report.tally.supers ?? 0, prize: { spins: 1 } },
  { id: 'ctr', text: 'Land 6 counters', goal: 6, count: (e) => e.report.tally.counters ?? 0, prize: { coins: 250, gems: 3 } },
  { id: 'dodge', text: 'Dodge 10 attacks', goal: 10, count: (e) => e.report.tally.dodges ?? 0, prize: { coins: 250 } },
  { id: 'perf', text: 'Win with 70%+ HP', goal: 1, count: (e) => (e.won ? e.report.tally.perfectWins ?? 0 : 0), prize: { scratches: 1, gems: 5 } },
  { id: 'grab', text: 'Land 8 grapples', goal: 8, count: (e) => e.report.tally.grapples ?? 0, prize: { coins: 250 } },
];
export const TASK_BONUS: Prize = { chest: 'prata' };
const TASK_MAP: Record<string, TaskDef> = Object.fromEntries(TASKS.map((t) => [t.id, t]));
export function task(id: string): TaskDef {
  return TASK_MAP[id] ?? TASKS[0];
}

/** Rolls today's 3 challenges if the day changed. */
export function ensureTasks(): void {
  const today = dayKey();
  if (D.tasks.day === today && D.tasks.ids.length === 3 && D.tasks.ids.every((id) => TASK_MAP[id])) return;
  const r = seeded(hashStr('daily-tasks' + today + S.partnerSeed));
  const easy = shuffle(TASKS.filter((t) => t.easy), r);
  const rest = shuffle(TASKS.filter((t) => !t.easy), r);
  const ids = [easy[0].id, rest[0].id, rest[1].id];
  D.tasks = { day: today, ids, prog: [0, 0, 0], claimed: [false, false, false], bonus: false };
  saveDaily();
}

export function claimTask(i: number): PrizeResult | null {
  ensureTasks();
  const t = task(D.tasks.ids[i]);
  if (D.tasks.claimed[i] || D.tasks.prog[i] < t.goal) return null;
  D.tasks.claimed[i] = true;
  return givePrize({ ...t.prize });
}
export function bonusReady(): boolean {
  ensureTasks();
  return !D.tasks.bonus && D.tasks.claimed.every(Boolean);
}
export function claimBonus(): PrizeResult | null {
  if (!bonusReady()) return null;
  D.tasks.bonus = true;
  return givePrize({ ...TASK_BONUS });
}

// ───────────────────────── Hot Streak ─────────────────────────

export const HOT_MILESTONES: { at: number; prize: Prize; label: string }[] = [
  { at: 2, prize: { spins: 1 }, label: '+1 Spin' },
  { at: 4, prize: { scratches: 1, gems: 5 }, label: 'Card + Gems' },
  { at: 6, prize: { chest: 'prata' }, label: 'Silver Chest' },
  { at: 10, prize: { chest: 'ouro', gems: 10 }, label: 'Gold Chest' },
];

export function claimHot(at: number): PrizeResult | null {
  const i = D.hot.ready.indexOf(at);
  if (i < 0) return null;
  D.hot.ready.splice(i, 1);
  const m = HOT_MILESTONES.find((x) => x.at === at);
  return m ? givePrize({ ...m.prize }) : null;
}

// ───────────────────────── Mystery Gift ─────────────────────────

export const GIFT_TABLE: { prize: Prize; name: string; w: number }[] = [
  { prize: { coins: 120 }, name: '120 Coins', w: 40 },
  { prize: { coins: 300 }, name: '300 Coins', w: 20 },
  { prize: { gems: 5 }, name: '5 Gems', w: 15 },
  { prize: { xp: 50 }, name: '50 XP', w: 12 },
  { prize: { spins: 1 }, name: '+1 Wheel Spin', w: 8 },
  { prize: { scratches: 1 }, name: '+1 Scratch Card', w: 4 },
  { prize: { gems: 25 }, name: '25 Gems', w: 1 },
];
export function giftReady(): boolean {
  return Date.now() >= D.giftAt;
}
export function openGift(): PrizeResult | null {
  if (!giftReady()) return null;
  D.giftAt = Date.now() + GIFT_MS;
  const w: Record<string, number> = {};
  GIFT_TABLE.forEach((g, i) => (w[String(i)] = g.w));
  return givePrize({ ...GIFT_TABLE[Number(weighted(w))].prize });
}

// ───────────────────────── Badge ─────────────────────────

export function tasksClaimable(): number {
  ensureTasks();
  let n = 0;
  D.tasks.ids.forEach((id, i) => {
    if (!D.tasks.claimed[i] && D.tasks.prog[i] >= task(id).goal) n++;
  });
  return n + (bonusReady() ? 1 : 0) + D.hot.ready.length;
}

export function badgeCount(): number {
  return (loginStatus().claimedToday ? 0 : 1) + spinsAvailable() + scratchesAvailable() + (D.scratch.active ? 1 : 0) + tasksClaimable() + (giftReady() ? 1 : 0);
}

// ───────────────────────── Fight results ─────────────────────────

type EarnCb = (msg: string) => void;
let earnCb: EarnCb | null = null;
/** UI hook: called with short messages ("+1 Spin") when fights earn daily stuff. */
export function onDailyEarn(cb: EarnCb): void {
  earnCb = cb;
}

onFightEnd((e) => {
  ensureTasks();
  const msgs: string[] = [];
  D.tasks.ids.forEach((id, i) => {
    const t = task(id);
    if (D.tasks.prog[i] >= t.goal) return;
    const n = t.count(e);
    if (n > 0) {
      D.tasks.prog[i] = Math.min(t.goal, D.tasks.prog[i] + n);
      if (D.tasks.prog[i] >= t.goal) msgs.push(`Daily challenge done: ${t.text}!`);
    }
  });
  if (e.won) {
    D.hot.cur++;
    D.hot.best = Math.max(D.hot.best, D.hot.cur);
    for (const m of HOT_MILESTONES) {
      if (D.hot.cur >= m.at && !D.hot.reached.includes(m.at)) {
        D.hot.reached.push(m.at);
        D.hot.ready.push(m.at);
        msgs.push(`Hot Streak ×${m.at}: ${m.label} ready!`);
      }
    }
    D.spinCharge++;
    if (D.spinCharge >= SPIN_CHARGE) {
      D.spinCharge = 0;
      D.wheel.bank++;
      msgs.push('+1 Lucky Wheel spin!');
    }
    D.scratchCharge++;
    if (D.scratchCharge >= SCRATCH_CHARGE) {
      D.scratchCharge = 0;
      D.scratch.bank++;
      msgs.push('+1 Scratch Card!');
    }
  } else {
    D.hot.cur = 0;
    D.hot.reached = [];
  }
  saveDaily();
  commit();
  if (!earnCb || !msgs.length) return;
  if (msgs.length <= 2) for (const m of msgs) earnCb(m);
  else earnCb(`DAILY: ${msgs.length} new rewards ready — open the Daily hub!`);
});
