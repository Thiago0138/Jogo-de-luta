import { DEFAULT_APPEARANCE, type Appearance } from '../data/appearance';
import { CHESTS, type ChestId } from '../data/chests';
import { ITEMS, ITEM_LIST, STARTER_ITEMS, item, type ItemDef } from '../data/items';
import { DAILY_POOL, LEGENDARY, WEEKLY_POOL, emptyTally, type MissionDef, type Reward, type Tally } from '../data/missions';
import { LEAGUES, leagueIndex } from '../data/leagues';
import { RARITIES, RARITY_ORDER, type Rarity } from '../data/rarity';
import { MAX_LEVEL, POINTS_PER_LEVEL, baseStats, xpToNext, type Stats } from '../data/stats';
import { CURRENT_VERSION } from '../data/patchnotes';
import { dayKey, hashStr, pick, rint, seeded, shuffle, weekKey, weighted } from './rng';

export interface Loadout {
  outfit: string;
  gloves: string;
  mask: string | null;
  aura: string | null;
  supers: string[];
  passives: string[];
  entrance: string;
  /** Golpes de assinatura equipados (máx. 6). */
  moves: string[];
  /** Estilos visuais de golpe ativos. */
  styles: string[];
}

export interface MissionSet {
  key: string;
  ids: string[];
  progress: number[];
  claimed: boolean[];
}

export interface Settings {
  sound: boolean;
  /** Volume geral 0–1. */
  volume: number;
  music: boolean;
  speed: 1 | 2;
  quality: 'alta' | 'baixa';
  /** Modo de teste: todos os itens desbloqueados. */
  unlockAll: boolean;
  /** Narrador com voz. */
  announcer: boolean;
  /** Volume do narrador (0–1). */
  announcerVol: number;
  /** Música de fundo e volume (0–1). */
  bgm: boolean;
  bgmVol: number;
}

export interface Save {
  v: number;
  created: boolean;
  name: string;
  appearance: Appearance;
  loadout: Loadout;
  level: number;
  xp: number;
  statPoints: number;
  stats: Stats;
  coins: number;
  gems: number;
  trophies: number;
  bestLeague: number;
  owned: Record<string, number>;
  chests: Record<ChestId, number>;
  daily: MissionSet;
  weekly: MissionSet;
  legendaryClaimed: string[];
  life: Tally;
  streak: number;
  bestStreak: number;
  losses: number;
  redeemed: string[];
  settings: Settings;
  seenPatch: string;
  freeChestAt: number;
  partnerSeed: number;
  giftDay: string;
  /** Presentes únicos já entregues (ex.: 'gems100k'). */
  grants: string[];
}

const KEY = 'reis-do-ringue-save-v1';
const FREE_CHEST_MS = 4 * 3600 * 1000;

function fresh(): Save {
  const owned: Record<string, number> = {};
  for (const id of STARTER_ITEMS) owned[id] = 1;
  return {
    v: 1,
    created: false,
    name: '',
    appearance: { ...DEFAULT_APPEARANCE },
    loadout: {
      outfit: 'o_classico',
      gloves: 'g_vermelhas',
      mask: null,
      aura: null,
      supers: ['s_supersoco'],
      passives: ['p_ferro'],
      entrance: 'e_classica',
      moves: [],
      styles: [],
    },
    level: 1,
    xp: 0,
    statPoints: 3,
    stats: baseStats(),
    coins: 500,
    gems: 20,
    trophies: 0,
    bestLeague: 0,
    owned,
    chests: { bronze: 1, prata: 1, ouro: 0, lendario: 0, mitico: 0 },
    daily: { key: '', ids: [], progress: [], claimed: [] },
    weekly: { key: '', ids: [], progress: [], claimed: [] },
    legendaryClaimed: [],
    life: emptyTally(),
    streak: 0,
    bestStreak: 0,
    losses: 0,
    redeemed: [],
    settings: { sound: true, volume: 0.8, music: true, speed: 1, quality: 'alta', unlockAll: true, announcer: true, announcerVol: 0.9, bgm: true, bgmVol: 0.5 },
    seenPatch: '',
    freeChestAt: 0,
    partnerSeed: Math.floor(Math.random() * 1e9),
    giftDay: '',
    grants: [],
  };
}

function load(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const data = JSON.parse(raw) as Partial<Save>;
    const base = fresh();
    const s: Save = { ...base, ...data } as Save;
    s.life = { ...emptyTally(), ...(data.life ?? {}) };
    s.settings = { ...base.settings, ...(data.settings ?? {}) };
    s.chests = { ...base.chests, ...(data.chests ?? {}) };
    s.stats = { ...base.stats, ...(data.stats ?? {}) };
    s.loadout = { ...base.loadout, ...(data.loadout ?? {}) };
    // As poções (e o cinto) foram removidas do jogo: limpa restos de saves antigos.
    delete (s.loadout as Partial<Loadout> & { belt?: unknown }).belt;
    const life = s.life as Tally & { potions?: number; noPotionWins?: number };
    delete life.potions;
    delete life.noPotionWins;
    // A missão lendária das poções deu lugar à dos contra-ataques (mesma recompensa).
    if (Array.isArray(s.legendaryClaimed)) s.legendaryClaimed = s.legendaryClaimed.map((id) => (id === 'l_noPot' ? 'l_counter300' : id));
    s.appearance = { ...base.appearance, ...(data.appearance ?? {}) };
    // Remove itens que deixaram de existir.
    for (const id of Object.keys(s.owned)) if (!ITEMS[id]) delete s.owned[id];
    return s;
  } catch {
    return fresh();
  }
}

export const S: Save = load();

// equipa automaticamente golpes de assinatura se ainda não houver nenhum
if (!S.loadout.moves?.length) {
  S.loadout.moves = ITEM_LIST.filter((d) => d.kind === 'move' && ownsItem(d.id))
    .sort((a, b) => (b.unlockLevel ?? 0) - (a.unlockLevel ?? 0))
    .slice(0, 6)
    .map((d) => d.id);
}
if (!S.loadout.styles) S.loadout.styles = [];

function ownsItem(id: string): boolean {
  if ((S.owned[id] ?? 0) > 0) return true;
  const d = ITEMS[id];
  return !!d && S.settings.unlockAll;
}

type Listener = () => void;
const listeners = new Set<Listener>();
export function onChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let saveQueued = false;
export function commit(): void {
  for (const l of listeners) l();
  if (saveQueued) return;
  saveQueued = true;
  queueMicrotask(() => {
    saveQueued = false;
    try {
      localStorage.setItem(KEY, JSON.stringify(S));
    } catch {
      /* armazenamento cheio ou bloqueado */
    }
  });
}

export function resetSave(): void {
  localStorage.removeItem(KEY);
  location.reload();
}

// ───────────────────────── Inventário ─────────────────────────

export function owns(id: string): boolean {
  return ownsItem(id);
}

/** Pode comprar um golpe de assinatura com moedas (até 3 níveis antes do desbloqueio). */
export function canBuyEarly(d: ItemDef): boolean {
  return d.kind === 'move' && d.unlockLevel != null && S.level >= d.unlockLevel - 3 && !owns(d.id);
}

export function count(id: string): number {
  return S.owned[id] ?? 0;
}

/** Adiciona um item. Devolve true se for novo para a coleção. */
export function grant(id: string, n = 1): boolean {
  const isNew = !owns(id);
  S.owned[id] = (S.owned[id] ?? 0) + n;
  return isNew;
}

export function removeItem(id: string, n = 1): boolean {
  const c = count(id);
  if (c < n) return false;
  S.owned[id] = c - n;
  if (S.owned[id] <= 0) {
    delete S.owned[id];
    unequipIfMissing(id);
  }
  return true;
}

function unequipIfMissing(id: string): void {
  const L = S.loadout;
  const d = ITEMS[id];
  if (!d) return;
  if (L.outfit === id) L.outfit = 'o_classico';
  if (L.gloves === id) L.gloves = 'g_vermelhas';
  if (L.mask === id) L.mask = null;
  if (L.aura === id) L.aura = null;
  L.supers = L.supers.filter((x) => x !== id);
  if (!L.supers.length) L.supers = ['s_supersoco'];
  L.passives = L.passives.filter((x) => x !== id);
  if (S.appearance.hair === id) S.appearance.hair = 'h_curto';
  if (S.appearance.hairColor === id) S.appearance.hairColor = 'hc_castanho';
}

export function collectionCount(): number {
  let n = 0;
  for (const d of ITEM_LIST) if (owns(d.id)) n++;
  return n;
}

export function collectibleTotal(): number {
  return ITEM_LIST.length;
}

export function canAfford(d: ItemDef): boolean {
  if (d.gems != null) return S.gems >= d.gems;
  if (d.coins != null) return S.coins >= d.coins;
  return false;
}

export function buy(d: ItemDef): boolean {
  if (!canAfford(d)) return false;
  if (d.gems != null) S.gems -= d.gems;
  else if (d.coins != null) S.coins -= d.coins;
  grant(d.id);
  commit();
  return true;
}

export function recycle(id: string): number {
  const d = item(id);
  const min = d.source === 'start' ? 1 : 0;
  if (count(id) <= Math.max(1, min)) return 0;
  if (!removeItem(id)) return 0;
  const v = RARITIES[d.rarity].recycle;
  S.coins += v;
  commit();
  return v;
}

// ───────────────────────── Progressão ─────────────────────────

export interface LevelUp {
  from: number;
  to: number;
  unlocked: string[];
  chests: ChestId[];
}

export function levelRewardChest(level: number): ChestId | null {
  if (level % 10 === 0) return 'ouro';
  if (level % 5 === 0) return 'prata';
  return null;
}

export function addXp(amount: number): LevelUp | null {
  if (S.level >= MAX_LEVEL) return null;
  S.xp += amount;
  const from = S.level;
  const unlocked: string[] = [];
  const chests: ChestId[] = [];
  while (S.level < MAX_LEVEL && S.xp >= xpToNext(S.level)) {
    S.xp -= xpToNext(S.level);
    S.level++;
    S.statPoints += POINTS_PER_LEVEL;
    S.gems += 5;
    for (const d of ITEM_LIST) {
      if (d.source === 'level' && d.unlockLevel === S.level) {
        if (!owns(d.id)) grant(d.id);
        unlocked.push(d.id);
        if (d.kind === 'move' && S.loadout.moves.length < 6 && !S.loadout.moves.includes(d.id)) S.loadout.moves.push(d.id);
      }
    }
    const c = levelRewardChest(S.level);
    if (c) {
      S.chests[c]++;
      chests.push(c);
    }
  }
  if (S.level >= MAX_LEVEL) S.xp = 0;
  return S.level > from ? { from, to: S.level, unlocked, chests } : null;
}

// ───────────────────────── Missões ─────────────────────────

const MISSION_MAP: Record<string, MissionDef> = Object.fromEntries(
  [...DAILY_POOL, ...WEEKLY_POOL, ...LEGENDARY].map((m) => [m.id, m]),
);

export function mission(id: string): MissionDef {
  return MISSION_MAP[id];
}

export function refreshMissions(): boolean {
  let changed = false;
  const dk = dayKey();
  if (S.daily.key !== dk) {
    const r = seeded(hashStr(dk + S.partnerSeed));
    const ids = shuffle([...DAILY_POOL], r).slice(0, 4).map((m) => m.id);
    S.daily = { key: dk, ids, progress: ids.map(() => 0), claimed: ids.map(() => false) };
    changed = true;
  }
  const wk = weekKey();
  if (S.weekly.key !== wk) {
    const r = seeded(hashStr(wk + S.partnerSeed));
    const ids = shuffle([...WEEKLY_POOL], r).slice(0, 4).map((m) => m.id);
    S.weekly = { key: wk, ids, progress: ids.map(() => 0), claimed: ids.map(() => false) };
    changed = true;
  }
  if (changed) commit();
  return changed;
}

export function applyTally(t: Partial<Tally>): void {
  refreshMissions();
  for (const k in t) {
    const key = k as keyof Tally;
    S.life[key] += t[key] ?? 0;
  }
  for (const set of [S.daily, S.weekly]) {
    set.ids.forEach((id, i) => {
      const m = MISSION_MAP[id];
      if (m.key in t) set.progress[i] = Math.min(m.target, set.progress[i] + (t[m.key as keyof Tally] ?? 0));
    });
  }
}

export function legendaryProgress(m: MissionDef): number {
  switch (m.key) {
    case 'level':
      return S.level;
    case 'bestStreak':
      return S.bestStreak;
    case 'trophies':
      return S.trophies;
    case 'collection':
      return collectionCount();
    default:
      return S.life[m.key];
  }
}

export function giveReward(r: Reward): LevelUp | null {
  if (r.coins) S.coins += r.coins;
  if (r.gems) S.gems += r.gems;
  if (r.chest) S.chests[r.chest]++;
  if (r.item) grant(r.item);
  const lu = r.xp ? addXp(r.xp) : null;
  commit();
  return lu;
}

export function claimableCount(): number {
  refreshMissions();
  let n = 0;
  for (const set of [S.daily, S.weekly]) {
    set.ids.forEach((id, i) => {
      if (!set.claimed[i] && set.progress[i] >= MISSION_MAP[id].target) n++;
    });
  }
  for (const m of LEGENDARY) if (!S.legendaryClaimed.includes(m.id) && legendaryProgress(m) >= m.target) n++;
  return n;
}

// ───────────────────────── Ligas ─────────────────────────

export function changeTrophies(delta: number): ChestId | null {
  S.trophies = Math.max(0, S.trophies + delta);
  const li = leagueIndex(S.trophies);
  if (li > S.bestLeague) {
    S.bestLeague = li;
    const c = LEAGUES[li].reward;
    S.chests[c]++;
    return c;
  }
  return null;
}

// ───────────────────────── Baús ─────────────────────────

export interface ChestDrop {
  kind: 'item' | 'coins' | 'gems';
  id?: string;
  amount: number;
  rarity: Rarity;
  isNew?: boolean;
}

export function freeChestReady(): boolean {
  return Date.now() >= S.freeChestAt;
}

export function claimFreeChest(): boolean {
  if (!freeChestReady()) return false;
  S.chests.bronze++;
  S.freeChestAt = Date.now() + FREE_CHEST_MS;
  commit();
  return true;
}

function poolFor(r: Rarity): ItemDef[] {
  return ITEM_LIST.filter((d) => d.rarity === r && d.source !== 'start' && d.source !== 'mission' && d.source !== 'level');
}

export function rollChest(id: ChestId): ChestDrop[] {
  const c = CHESTS[id];
  const drops: ChestDrop[] = [];
  drops.push({ kind: 'coins', amount: rint(c.coins[0], c.coins[1]), rarity: 'comum' });
  if (c.gems[1] > 0) {
    const g = rint(c.gems[0], c.gems[1]);
    if (g > 0) drops.push({ kind: 'gems', amount: g, rarity: 'raro' });
  }
  const rarities: Rarity[] = [];
  for (let i = 0; i < c.rolls; i++) rarities.push(weighted(c.weights));
  if (c.guaranteed) {
    const gTier = RARITIES[c.guaranteed].tier;
    if (!rarities.some((r) => RARITIES[r].tier >= gTier)) rarities[rarities.length - 1] = c.guaranteed;
  }
  for (let r of rarities) {
    let pool = poolFor(r);
    // Favorece itens ainda não colecionados para manter a progressão interessante.
    while (!pool.length && RARITIES[r].tier > 0) {
      r = RARITY_ORDER[RARITIES[r].tier - 1];
      pool = poolFor(r);
    }
    const unowned = pool.filter((d) => !owns(d.id));
    const roll = Math.random();
    // Se já tens tudo desta raridade, às vezes sai um saco de moedas em vez de um repetido.
    if (!unowned.length && roll < 0.35) {
      drops.push({ kind: 'coins', amount: Math.round(rint(c.coins[0], c.coins[1]) * 0.5), rarity: 'comum' });
      continue;
    }
    const d = unowned.length && roll < 0.8 ? pick(unowned) : pick(pool);
    drops.push({ kind: 'item', id: d.id, amount: 1, rarity: d.rarity });
  }
  // Ordena por raridade: o melhor sai no fim.
  drops.sort((a, b) => RARITIES[a.rarity].tier - RARITIES[b.rarity].tier);
  return drops;
}

export function applyDrops(chest: ChestId, drops: ChestDrop[]): void {
  S.chests[chest] = Math.max(0, S.chests[chest] - 1);
  for (const d of drops) {
    if (d.kind === 'coins') S.coins += d.amount;
    else if (d.kind === 'gems') S.gems += d.amount;
    else if (d.id) d.isNew = grant(d.id, d.amount);
  }
  applyTally({ chestsOpened: 1 });
  commit();
}

export function buyChest(id: ChestId): boolean {
  const c = CHESTS[id];
  if (c.gemPrice != null) {
    if (S.gems < c.gemPrice) return false;
    S.gems -= c.gemPrice;
  } else if (c.coinPrice != null) {
    if (S.coins < c.coinPrice) return false;
    S.coins -= c.coinPrice;
  } else return false;
  S.chests[id]++;
  commit();
  return true;
}

// ───────────────────────── Trocas ─────────────────────────

const TRADE_SALT = 'rdr-troca-2026';

function b64e(s: string): string {
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64d(s: string): string {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return decodeURIComponent(escape(atob(s)));
}

export function createTrade(items: [string, number][], from: string): string | null {
  for (const [id, n] of items) {
    const d = ITEMS[id];
    if (!d || d.source === 'start' || count(id) < n) return null;
  }
  for (const [id, n] of items) removeItem(id, n);
  const payload = b64e(JSON.stringify({ i: items, f: from.slice(0, 20), n: Math.random().toString(36).slice(2, 10), t: Date.now() }));
  const sig = hashStr(payload + TRADE_SALT).toString(36);
  commit();
  return `RDR-${payload}.${sig}`;
}

export type RedeemResult = { ok: true; items: [string, number][]; from: string } | { ok: false; error: string };

export function redeemTrade(code: string): RedeemResult {
  const m = code.trim().match(/^RDR-([A-Za-z0-9_-]+)\.([a-z0-9]+)$/);
  if (!m) return { ok: false, error: 'Código inválido.' };
  if (hashStr(m[1] + TRADE_SALT).toString(36) !== m[2]) return { ok: false, error: 'Código corrompido ou adulterado.' };
  let data: { i: [string, number][]; f: string; n: string };
  try {
    data = JSON.parse(b64d(m[1]));
  } catch {
    return { ok: false, error: 'Código inválido.' };
  }
  if (S.redeemed.includes(data.n)) return { ok: false, error: 'Este código já foi usado.' };
  const valid = data.i.filter(([id, n]) => ITEMS[id] && n > 0 && n < 100);
  if (!valid.length) return { ok: false, error: 'O código não contém itens válidos.' };
  for (const [id, n] of valid) grant(id, n);
  S.redeemed.push(data.n);
  commit();
  return { ok: true, items: valid, from: data.f };
}

export function markPatchSeen(): void {
  S.seenPatch = CURRENT_VERSION;
  commit();
}

/** Presente único: 100 000 gemas para todos os jogadores (novos e existentes). */
if (!S.grants) S.grants = [];
if (!S.grants.includes('gems100k')) {
  S.grants.push('gems100k');
  S.gems += 100000;
  commit();
}
