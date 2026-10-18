/**
 * FIGHT PASS — passe de temporada (lógica e dados, sem UI).
 * Estado próprio em localStorage ('kotr-pass-v1'); as recompensas vão para o save principal (S).
 */
import { S, addXp, commit, grant, owns, type LevelUp } from './state';
import { onFightEnd, type FightEndEvent } from './events';
import { ITEMS, type ItemDef } from '../data/items';
import { RARITIES, type Rarity } from '../data/rarity';
import type { ChestId } from '../data/chests';
import { hashStr, seeded, shuffle, weekKey } from './rng';

export const PASS_KEY = 'kotr-pass-v1';
export const TIERS = 40;
export const TIER_XP = 1000;
export const PASS_PRICE = 600;
export const TIER_PRICE = 120;
/** Bónus de XP do passe premium. */
export const PREMIUM_BOOST = 0.2;
export const CHALLENGES_PER_WEEK = 5;

const DAY = 86400000;
/** Início da Temporada 1 (fixo). As temporadas seguintes encadeiam-se automaticamente. */
const EPOCH = Date.UTC(2026, 9, 1);
export const SEASON_DAYS = 35;

const SEASON_NAMES: [string, string][] = [
  ['Rise of the Kings', '#ffd23d'],
  ['Steel & Thunder', '#7ab8ff'],
  ['Neon Uprising', '#ff4fd8'],
  ['Cosmic Clash', '#7af7ff'],
  ['Blood Moon Brawl', '#ff3d6e'],
  ['Dragon Dynasty', '#ff9f1a'],
];

export interface Season {
  n: number;
  name: string;
  color: string;
  start: number;
  end: number;
}

export function seasonAt(now = Date.now()): Season {
  const idx = Math.max(0, Math.floor((now - EPOCH) / (SEASON_DAYS * DAY)));
  const start = EPOCH + idx * SEASON_DAYS * DAY;
  const [name, color] = SEASON_NAMES[idx % SEASON_NAMES.length];
  return { n: idx + 1, name, color, start, end: start + SEASON_DAYS * DAY };
}

// ───────────────────────── Recompensas ─────────────────────────

export type PassReward =
  | { kind: 'coins'; n: number }
  | { kind: 'gems'; n: number }
  | { kind: 'xp'; n: number }
  | { kind: 'stat'; n: number }
  | { kind: 'chest'; id: ChestId; n: number }
  | { kind: 'item'; id: string };

export interface Tier {
  n: number;
  free: PassReward;
  prem: PassReward;
}

/**
 * Exclusivos do passe por temporada (itens com `source: 'pass'`, que não existem em mais lado nenhum).
 * Cada temporada tem o seu conjunto; enquanto uma temporada não tiver conjunto próprio, volta o
 * conjunto mais antigo ("returning") — nunca itens da loja ou dos baús. Se o jogador já tiver o item,
 * recebe gemas em vez de um duplicado (ver `applyReward`).
 */
interface PassSet {
  free: Record<number, string>;
  prem: Record<number, string>;
}
const SEASON_SETS: PassSet[] = [
  // Temporada 1 — Rise of the Kings (ouro real + violeta)
  {
    free: { 5: 'fp1_hc_arminho', 15: 'fp1_g_veludo', 25: 'fp1_a_brasas', 35: 'fp1_o_principe' },
    prem: {
      1: 'fp1_m_mascarada', 5: 'fp1_hc_ametista', 9: 'fp1_t_vassalos', 13: 'fp1_o_guarda', 17: 'fp1_g_cetro',
      21: 'fp1_ms_spear_real', 26: 'fp1_e_coroacao', 30: 'fp1_o_regalia', 35: 'fp1_a_leao', 40: 'fp1_o_soberano',
    },
  },
];
export function passSet(season: number): PassSet {
  return SEASON_SETS[(Math.max(1, season) - 1) % SEASON_SETS.length];
}

const FREE_CHESTS: Record<number, ChestId> = { 4: 'bronze', 8: 'prata', 12: 'bronze', 16: 'prata', 20: 'ouro', 22: 'prata', 28: 'prata', 30: 'ouro', 32: 'ouro', 38: 'lendario', 40: 'lendario' };
const PREM_CHESTS: Record<number, ChestId> = {
  2: 'prata', 3: 'ouro', 7: 'ouro', 11: 'prata', 14: 'ouro', 20: 'lendario', 23: 'ouro', 27: 'lendario', 29: 'ouro', 32: 'lendario', 36: 'mitico', 38: 'lendario', 39: 'mitico',
};
/** Níveis do trilho grátis que dão gemas em dobro (compensam os itens que deixaram de ser aleatórios). */
const FREE_GEM_BONUS = new Set([10]);

const tierCache = new Map<number, Tier[]>();

/** Tabela de 40 níveis da temporada (determinística por temporada). Todos os itens são exclusivos do passe. */
export function seasonTiers(season: number): Tier[] {
  const hit = tierCache.get(season);
  if (hit) return hit;
  const set = passSet(season);
  const tiers: Tier[] = [];
  for (let n = 1; n <= TIERS; n++) {
    let free: PassReward;
    if (set.free[n] && ITEMS[set.free[n]]) free = { kind: 'item', id: set.free[n] };
    else if (FREE_CHESTS[n]) free = { kind: 'chest', id: FREE_CHESTS[n], n: 1 };
    else if (FREE_GEM_BONUS.has(n)) free = { kind: 'gems', n: 30 };
    else {
      const k = n % 4;
      if (k === 1) free = { kind: 'coins', n: 150 + n * 15 };
      else if (k === 2) free = { kind: 'xp', n: 120 + n * 8 };
      else if (k === 3) free = { kind: 'gems', n: n < 20 ? 10 : 20 };
      else free = { kind: 'stat', n: 1 };
    }
    let prem: PassReward;
    if (set.prem[n] && ITEMS[set.prem[n]]) prem = { kind: 'item', id: set.prem[n] };
    else if (PREM_CHESTS[n]) prem = { kind: 'chest', id: PREM_CHESTS[n], n: 1 };
    else {
      const k = n % 4;
      if (k === 1) prem = { kind: 'gems', n: n < 20 ? 40 : 70 };
      else if (k === 2) prem = { kind: 'coins', n: 500 + n * 30 };
      else if (k === 3) prem = { kind: 'stat', n: 2 };
      else prem = { kind: 'xp', n: 300 + n * 12 };
    }
    tiers.push({ n, free, prem });
  }
  tierCache.set(season, tiers);
  return tiers;
}

/** Gemas dadas em vez de um exclusivo repetido (temporadas em que o conjunto regressa). */
const DUPE_GEMS: Record<Rarity, number> = { comum: 20, incomum: 40, raro: 80, epico: 150, lendario: 300, mitico: 500, celestial: 800 };

/** O exclusivo já é do jogador? (então vale gemas). */
export function isReturningOwned(r: PassReward): boolean {
  return r.kind === 'item' && owns(r.id);
}

export function rewardRarity(r: PassReward): Rarity {
  if (r.kind === 'item') return ITEMS[r.id]?.rarity ?? 'comum';
  if (r.kind === 'chest') return ({ bronze: 'comum', prata: 'incomum', ouro: 'raro', lendario: 'epico', mitico: 'lendario' } as const)[r.id];
  if (r.kind === 'gems') return r.n >= 40 ? 'raro' : 'incomum';
  if (r.kind === 'stat') return r.n >= 2 ? 'raro' : 'incomum';
  return 'comum';
}

/** Aplica a recompensa ao save principal (sem commit). Devolve a recompensa efetivamente entregue. */
export function applyReward(r: PassReward): PassReward {
  if (r.kind === 'item' && ITEMS[r.id] && owns(r.id)) {
    // exclusivo repetido (conjunto que regressa noutra temporada): gemas em vez de um duplicado
    const g: PassReward = { kind: 'gems', n: DUPE_GEMS[ITEMS[r.id].rarity] };
    giveReward(g);
    return g;
  }
  giveReward(r);
  return r;
}

function giveReward(r: PassReward): LevelUp | null {
  switch (r.kind) {
    case 'coins':
      S.coins += r.n;
      return null;
    case 'gems':
      S.gems += r.n;
      return null;
    case 'stat':
      S.statPoints += r.n;
      return null;
    case 'chest':
      S.chests[r.id] = (S.chests[r.id] ?? 0) + r.n;
      return null;
    case 'item':
      grant(r.id);
      return null;
    case 'xp':
      return addXp(r.n);
  }
}

// ───────────────────────── Desafios semanais ─────────────────────────

export interface Challenge {
  id: string;
  text: string;
  target: number;
  xp: number;
  /** Incremento produzido por um combate (ou valor absoluto, se `abs`). */
  val: (e: FightEndEvent, P: PassSave) => number;
  abs?: boolean;
  icon: string;
}

const win = (e: FightEndEvent) => (e.won ? 1 : 0);
export const CHALLENGE_POOL: Challenge[] = [
  { id: 'c_win10', text: 'Win 10 fights', target: 10, xp: 1200, icon: 'trophy', val: win },
  { id: 'c_win6', text: 'Win 6 fights', target: 6, xp: 900, icon: 'trophy', val: win },
  { id: 'c_fight15', text: 'Fight 15 matches', target: 15, xp: 1000, icon: 'fist', val: () => 1 },
  { id: 'c_sko3', text: 'Land 3 Super KOs', target: 3, xp: 1500, icon: 'bolt', val: (e) => (e.report.superKO ? 1 : 0) },
  { id: 'c_ko8', text: 'Win 8 fights by KO', target: 8, xp: 1200, icon: 'fire', val: (e) => (e.won && !e.report.decision ? 1 : 0) },
  { id: 'c_tag3', text: 'Win 3 Tag Team fights', target: 3, xp: 1200, icon: 'tag', val: (e) => (e.won && e.mode === 'tag' ? 1 : 0) },
  { id: 'c_champ2', text: 'Beat the Champion 2 times', target: 2, xp: 1500, icon: 'crown', val: (e) => (e.won && e.mode === 'champion' ? 1 : 0) },
  { id: 'c_flaw2', text: 'Win 2 flawless fights', target: 2, xp: 1500, icon: 'shield', val: (e) => (e.won && e.report.tally.perfectWins ? 1 : 0) },
  { id: 'c_comeback2', text: 'Win 2 comebacks (under 15% HP)', target: 2, xp: 1400, icon: 'heart', val: (e) => (e.won && e.report.tally.comebackWins ? 1 : 0) },
  { id: 'c_streak5', text: 'Win 5 fights in a row', target: 5, xp: 1500, icon: 'medal', abs: true, val: (_e, P) => P.run },
  { id: 'c_modes3', text: 'Win in 3 different modes', target: 3, xp: 1300, icon: 'star', abs: true, val: (e, P) => {
    if (e.won) P.modes |= e.mode === 'solo' ? 1 : e.mode === 'tag' ? 2 : 4;
    return (P.modes & 1) + ((P.modes >> 1) & 1) + ((P.modes >> 2) & 1);
  } },
  { id: 'c_quick3', text: 'Win 3 fights in under 60 seconds', target: 3, xp: 1300, icon: 'clock', val: (e) => (e.won && !e.report.decision && e.report.duration < 60 ? 1 : 0) },
  { id: 'c_punch300', text: 'Land 300 punches', target: 300, xp: 900, icon: 'glove', val: (e) => e.report.tally.punches },
  { id: 'c_grap40', text: 'Pull off 40 grapples or throws', target: 40, xp: 1000, icon: 'grapple', val: (e) => e.report.tally.grapples },
  { id: 'c_super15', text: 'Use 15 Super moves', target: 15, xp: 1000, icon: 'sparkle', val: (e) => e.report.tally.supers },
  { id: 'c_dive8', text: 'Land 8 top-rope dives', target: 8, xp: 1100, icon: 'dodge', val: (e) => e.report.tally.dives },
  { id: 'c_counter15', text: 'Land 15 counterattacks', target: 15, xp: 1000, icon: 'counter', val: (e) => e.report.tally.counters },
  { id: 'c_dodge25', text: 'Dodge 25 hits', target: 25, xp: 900, icon: 'speed', val: (e) => e.report.tally.dodges },
  { id: 'c_dmg25k', text: 'Deal 25,000 damage', target: 25000, xp: 1000, icon: 'target', val: (e) => e.report.tally.damage },
];
const CH_BY_ID = Object.fromEntries(CHALLENGE_POOL.map((c) => [c.id, c]));
export function challenge(id: string): Challenge {
  return CH_BY_ID[id] ?? CHALLENGE_POOL[0];
}

// ───────────────────────── Estado ─────────────────────────

export interface PassSave {
  v: 1;
  season: number;
  xp: number;
  premium: boolean;
  free: number[];
  prem: number[];
  /** Níveis bónus (depois do 40) já recolhidos. */
  bonus: number;
  week: string;
  ch: string[];
  prog: number[];
  done: boolean[];
  /** Vitórias seguidas (para o desafio de série). */
  run: number;
  /** Modos ganhos esta semana (bits: solo, tag, campeão). */
  modes: number;
  /** Último nível visto no ecrã (para animar a subida). */
  seen: number;
}

function freshPass(season: number): PassSave {
  return { v: 1, season, xp: 0, premium: false, free: [], prem: [], bonus: 0, week: '', ch: [], prog: [], done: [], run: 0, modes: 0, seen: 0 };
}

function loadPass(): PassSave {
  try {
    const raw = localStorage.getItem(PASS_KEY);
    if (raw) {
      const d = JSON.parse(raw) as Partial<PassSave>;
      const base = freshPass(d.season ?? seasonAt().n);
      return { ...base, ...d, free: d.free ?? [], prem: d.prem ?? [], ch: d.ch ?? [], prog: d.prog ?? [], done: d.done ?? [] } as PassSave;
    }
  } catch {
    /* save do passe estragado: recomeça */
  }
  return freshPass(seasonAt().n);
}

export const P: PassSave = loadPass();

export function savePass(): void {
  try {
    localStorage.setItem(PASS_KEY, JSON.stringify(P));
  } catch {
    /* armazenamento cheio ou bloqueado */
  }
}

/** Recompensas da temporada anterior entregues automaticamente (para o ecrã avisar). */
let carried: { season: number; count: number } | null = null;
export function takeCarried(): { season: number; count: number } | null {
  const c = carried;
  carried = null;
  return c;
}

/** Garante temporada e semana atuais. Chamar antes de ler o estado. */
export function syncPass(now = Date.now()): void {
  const s = seasonAt(now);
  let dirty = false;
  if (P.season !== s.n) {
    // fim de temporada: entrega o que ficou por recolher e recomeça
    const old = seasonTiers(P.season);
    const t = tierOf(P.xp);
    let count = 0;
    for (const tr of old) {
      if (tr.n > t) break;
      if (!P.free.includes(tr.n)) (applyReward(tr.free), count++);
      if (P.premium && !P.prem.includes(tr.n)) (applyReward(tr.prem), count++);
    }
    if (count) {
      carried = { season: P.season, count };
      commit();
    }
    Object.assign(P, freshPass(s.n));
    dirty = true;
  }
  const wk = `${s.n}:${weekKey(new Date(now))}`;
  if (P.week !== wk) {
    const rng = seeded(hashStr(`passch-${wk}`));
    // um desafio fácil de vitórias + 4 variados
    const easy = shuffle(CHALLENGE_POOL.filter((c) => c.id === 'c_win10' || c.id === 'c_fight15' || c.id === 'c_win6'), rng)[0];
    const rest = shuffle(CHALLENGE_POOL.filter((c) => !['c_win10', 'c_fight15', 'c_win6'].includes(c.id)), rng).slice(0, CHALLENGES_PER_WEEK - 1);
    P.week = wk;
    P.ch = [easy, ...rest].map((c) => c.id);
    P.prog = P.ch.map(() => 0);
    P.done = P.ch.map(() => false);
    P.modes = 0;
    dirty = true;
  }
  if (dirty) savePass();
}

export function tierOf(xp: number): number {
  return Math.min(TIERS, Math.floor(xp / TIER_XP));
}
export function currentTier(): number {
  return tierOf(P.xp);
}
/** XP dentro do nível atual (0..TIER_XP). */
export function xpInTier(): number {
  return P.xp % TIER_XP;
}
/** Níveis bónus disponíveis (cada TIER_XP depois do 40 vale um Baú de Prata). */
export function bonusAvailable(): number {
  return Math.max(0, Math.floor((P.xp - TIERS * TIER_XP) / TIER_XP) - P.bonus);
}
export const BONUS_REWARD: PassReward = { kind: 'chest', id: 'prata', n: 1 };

export function canClaim(n: number, track: 'free' | 'prem'): boolean {
  if (n > currentTier()) return false;
  if (track === 'prem') return P.premium && !P.prem.includes(n);
  return !P.free.includes(n);
}

export function unclaimedCount(): number {
  syncPass();
  const t = currentTier();
  let c = 0;
  for (let n = 1; n <= t; n++) {
    if (!P.free.includes(n)) c++;
    if (P.premium && !P.prem.includes(n)) c++;
  }
  return c + bonusAvailable();
}

export interface Claimed {
  tier: number;
  track: 'free' | 'prem' | 'bonus';
  reward: PassReward;
}

export function claim(n: number, track: 'free' | 'prem'): Claimed | null {
  syncPass();
  if (!canClaim(n, track)) return null;
  const tr = seasonTiers(P.season)[n - 1];
  (track === 'free' ? P.free : P.prem).push(n);
  const reward = applyReward(track === 'free' ? tr.free : tr.prem);
  savePass();
  commit();
  return { tier: n, track, reward };
}

export function claimBonus(): Claimed | null {
  if (bonusAvailable() <= 0) return null;
  P.bonus++;
  applyReward(BONUS_REWARD);
  savePass();
  commit();
  return { tier: TIERS + P.bonus, track: 'bonus', reward: BONUS_REWARD };
}

export function claimAll(): Claimed[] {
  syncPass();
  const out: Claimed[] = [];
  const t = currentTier();
  for (let n = 1; n <= t; n++) {
    const a = claim(n, 'free');
    if (a) out.push(a);
    const b = claim(n, 'prem');
    if (b) out.push(b);
  }
  while (bonusAvailable() > 0) {
    const c = claimBonus();
    if (c) out.push(c);
  }
  return out;
}

export function buyPremium(): boolean {
  syncPass();
  if (P.premium || S.gems < PASS_PRICE) return false;
  S.gems -= PASS_PRICE;
  P.premium = true;
  savePass();
  commit();
  return true;
}

export function buyTier(): boolean {
  syncPass();
  if (currentTier() >= TIERS || S.gems < TIER_PRICE) return false;
  S.gems -= TIER_PRICE;
  P.xp += TIER_XP;
  savePass();
  commit();
  return true;
}

// ───────────────────────── XP dos combates ─────────────────────────

export interface Gain {
  xp: number;
  parts: [string, number][];
  from: number;
  to: number;
  completed: Challenge[];
}

type GainCb = (g: Gain) => void;
const gainCbs: GainCb[] = [];
export function onPassGain(cb: GainCb): void {
  gainCbs.push(cb);
}

/** Soma XP ao passe (sem desafios). */
export function addPassXp(xp: number): { from: number; to: number } {
  syncPass();
  const from = currentTier();
  P.xp += Math.max(0, Math.round(xp));
  savePass();
  return { from, to: currentTier() };
}

export function fightXp(e: FightEndEvent): [string, number][] {
  const parts: [string, number][] = [[e.won ? 'Victory' : 'Fight', e.won ? 100 : 40]];
  if (e.won) {
    if (e.report.superKO) parts.push(['Super KO', 50]);
    else if (!e.report.decision) parts.push(['KO', 20]);
    if (e.report.tally.perfectWins) parts.push(['Flawless', 40]);
    if (e.report.tally.comebackWins) parts.push(['Comeback', 30]);
  }
  const base = parts.reduce((a, p) => a + p[1], 0);
  const mul = e.mode === 'champion' ? 1.5 : e.mode === 'tag' ? 1.25 : 1;
  if (mul > 1) parts.push([e.mode === 'champion' ? 'Champion ×1.5' : 'Tag Team ×1.25', Math.round(base * (mul - 1))]);
  if (P.premium) {
    const sub = parts.reduce((a, p) => a + p[1], 0);
    parts.push(['Premium +20%', Math.round(sub * PREMIUM_BOOST)]);
  }
  return parts;
}

export function awardFight(e: FightEndEvent): Gain {
  syncPass();
  const from = currentTier();
  const parts = fightXp(e);
  let xp = parts.reduce((a, p) => a + p[1], 0);
  P.run = e.won ? P.run + 1 : 0;
  const completed: Challenge[] = [];
  P.ch.forEach((id, i) => {
    const c = challenge(id);
    const v = c.val(e, P);
    if (P.done[i]) return;
    P.prog[i] = c.abs ? Math.max(P.prog[i] ?? 0, v) : (P.prog[i] ?? 0) + v;
    if (P.prog[i] >= c.target) {
      P.prog[i] = c.target;
      P.done[i] = true;
      completed.push(c);
      xp += c.xp;
      parts.push([`Challenge: ${c.text}`, c.xp]);
    }
  });
  P.xp += xp;
  savePass();
  const g: Gain = { xp, parts, from, to: currentTier(), completed };
  for (const cb of gainCbs) {
    try {
      cb(g);
    } catch {
      /* ignora */
    }
  }
  return g;
}

export function itemDef(r: PassReward): ItemDef | null {
  return r.kind === 'item' ? ITEMS[r.id] ?? null : null;
}

export function rarityTierOf(r: PassReward): number {
  return RARITIES[rewardRarity(r)].tier;
}

onFightEnd(awardFight);
