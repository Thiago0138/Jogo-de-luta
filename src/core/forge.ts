/**
 * Forja: o destino dos itens repetidos.
 * - Reciclar: cada cópia a mais vira Fragmentos (shards) consoante a raridade.
 * - Fabricar: gastar fragmentos para escolher um item que ainda não se tem (montra semanal com desconto).
 * - Fundir: 5 repetidos da mesma raridade → 1 item aleatório da raridade acima (raramente salta duas).
 * Os fragmentos ficam numa chave própria do localStorage (não mexe no Save principal).
 */
import { ITEM_LIST, type ItemDef } from '../data/items';
import { RARITIES, RARITY_ORDER, type Rarity } from '../data/rarity';
import { commit, count, grant, owns, poolFor, removeItem } from './state';

const KEY = 'kotr-forge-v1';

/** Fragmentos por cada cópia reciclada. */
export const SHARD_VALUE: Record<Rarity, number> = { comum: 5, incomum: 12, raro: 30, epico: 80, lendario: 250, mitico: 600, celestial: 1500 };
/** Custo de fabrico de um item. */
export const CRAFT_COST: Record<Rarity, number> = { comum: 40, incomum: 100, raro: 260, epico: 700, lendario: 2200, mitico: 5500, celestial: 14000 };
/** Repetidos necessários para uma fusão. */
export const FUSE_N = 5;
/** Desconto da montra semanal. */
export const FEATURED_OFF = 0.3;
/** Probabilidade de a fusão saltar duas raridades. */
export const JUMP2 = 0.04;

interface ForgeSave {
  shards: number;
  recycled: number;
  fused: number;
  crafted: number;
}

function load(): ForgeSave {
  const base: ForgeSave = { shards: 0, recycled: 0, fused: 0, crafted: 0 };
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...base, ...(JSON.parse(raw) as Partial<ForgeSave>) } : base;
  } catch {
    return base;
  }
}

const F = load();

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(F));
  } catch {
    /* sem espaço: ignora */
  }
}

export const shards = (): number => F.shards;
export const forgeStats = (): Readonly<ForgeSave> => F;

/** Cópias a mais de um item (fica sempre uma). */
export function spares(id: string): number {
  return Math.max(0, count(id) - 1);
}

/** Todos os itens com repetidos, do mais raro para o mais comum. */
export function duplicates(): ItemDef[] {
  return ITEM_LIST.filter((d) => spares(d.id) > 0).sort((a, b) => RARITIES[b.rarity].tier - RARITIES[a.rarity].tier);
}

export function duplicateCount(): number {
  return duplicates().reduce((n, d) => n + spares(d.id), 0);
}

/** Fragmentos que se ganham reciclando todos os repetidos (opcionalmente só algumas raridades). */
export function recycleValue(only?: Rarity[]): number {
  return duplicates()
    .filter((d) => !only || only.includes(d.rarity))
    .reduce((n, d) => n + spares(d.id) * SHARD_VALUE[d.rarity], 0);
}

/** Recicla uma cópia a mais de um item. */
export function recycleOne(id: string): number {
  const d = ITEM_LIST.find((x) => x.id === id);
  if (!d || spares(id) < 1 || !removeItem(id)) return 0;
  const v = SHARD_VALUE[d.rarity];
  F.shards += v;
  F.recycled++;
  save();
  commit();
  return v;
}

/** Recicla todos os repetidos (mantém uma cópia de cada). Devolve fragmentos e cópias. */
export function recycleAll(only?: Rarity[]): { shards: number; copies: number } {
  let got = 0;
  let copies = 0;
  for (const d of duplicates()) {
    if (only && !only.includes(d.rarity)) continue;
    const n = spares(d.id);
    if (n > 0 && removeItem(d.id, n)) {
      got += n * SHARD_VALUE[d.rarity];
      copies += n;
    }
  }
  F.shards += got;
  F.recycled += copies;
  save();
  commit();
  return { shards: got, copies };
}

// ───────────────────────── Fabricar ─────────────────────────

/** Itens que a forja sabe fabricar (os mesmos que podem sair dos baús). */
export function craftable(): ItemDef[] {
  return RARITY_ORDER.flatMap((r) => poolFor(r));
}

function weekIndex(): number {
  return Math.floor((Date.now() / 86400000 + 3) / 7); // semanas a começar à segunda
}

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Montra da semana: 5 itens (do raro para cima) com desconto, iguais para todos nessa semana. */
export function featured(): ItemDef[] {
  const r = rng(weekIndex() * 7919 + 17);
  const pool = craftable().filter((d) => RARITIES[d.rarity].tier >= 2);
  const out: ItemDef[] = [];
  const want: Rarity[] = ['raro', 'epico', 'lendario', 'mitico', 'celestial'];
  for (const rar of want) {
    const p = pool.filter((d) => d.rarity === rar && !out.includes(d));
    if (p.length) out.push(p[Math.floor(r() * p.length)]);
  }
  return out;
}

export function featuredEndsIn(): number {
  return (weekIndex() + 1) * 7 * 86400000 - 3 * 86400000 - Date.now();
}

export function craftCost(d: ItemDef): number {
  const base = CRAFT_COST[d.rarity];
  return featured().some((f) => f.id === d.id) ? Math.round((base * (1 - FEATURED_OFF)) / 10) * 10 : base;
}

export function craft(d: ItemDef): boolean {
  const c = craftCost(d);
  if (owns(d.id) || F.shards < c) return false;
  F.shards -= c;
  F.crafted++;
  save();
  grant(d.id);
  commit();
  return true;
}

// ───────────────────────── Fundir ─────────────────────────

/** Repetidos disponíveis para fundir numa raridade. */
export function fuseSpares(r: Rarity): number {
  return duplicates()
    .filter((d) => d.rarity === r)
    .reduce((n, d) => n + spares(d.id), 0);
}

export function canFuse(r: Rarity): boolean {
  return RARITIES[r].tier < RARITY_ORDER.length - 1 && fuseSpares(r) >= FUSE_N;
}

export interface FuseResult {
  used: ItemDef[];
  out: ItemDef;
  isNew: boolean;
  jumped: boolean;
}

/** Funde 5 repetidos (gasta primeiro os que têm mais cópias). */
export function fuse(r: Rarity): FuseResult | null {
  if (!canFuse(r)) return null;
  const used: ItemDef[] = [];
  const avail = duplicates()
    .filter((d) => d.rarity === r)
    .map((d) => ({ d, n: spares(d.id) }));
  while (used.length < FUSE_N) {
    avail.sort((a, b) => b.n - a.n);
    const top = avail[0];
    if (!top || top.n <= 0) return null;
    top.n--;
    used.push(top.d);
  }
  for (const d of used) removeItem(d.id);
  const tier = RARITIES[r].tier;
  const jumped = tier + 2 < RARITY_ORDER.length && Math.random() < JUMP2;
  let target = RARITY_ORDER[Math.min(RARITY_ORDER.length - 1, tier + (jumped ? 2 : 1))];
  let pool = poolFor(target);
  while (!pool.length && RARITIES[target].tier > tier + 1) {
    target = RARITY_ORDER[RARITIES[target].tier - 1];
    pool = poolFor(target);
  }
  if (!pool.length) pool = poolFor(RARITY_ORDER[tier + 1]);
  // 60% das vezes prefere um item que ainda não se tem (mais "NEW!")
  const fresh = pool.filter((d) => !owns(d.id));
  const from = fresh.length && Math.random() < 0.6 ? fresh : pool;
  const out = from[Math.floor(Math.random() * from.length)];
  const isNew = grant(out.id);
  F.fused++;
  save();
  commit();
  return { used, out, isNew, jumped: RARITIES[out.rarity].tier >= tier + 2 };
}

/** Há alguma coisa para fazer na forja? (para o ponto vermelho) */
export function forgeBadge(): number {
  return RARITY_ORDER.some((r) => canFuse(r)) ? 1 : 0;
}
