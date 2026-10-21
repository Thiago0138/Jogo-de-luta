/**
 * Modo Carreira — "Road to the Title".
 * 5 capítulos × 8 etapas, 1–3 estrelas por etapa, chefes de capítulo, baús de estrelas.
 * O progresso fica numa chave própria do localStorage (não mexe no Save principal).
 */
import { ITEMS, ITEM_LIST, isPassItem, type ItemDef } from '../data/items';
import { RARITIES } from '../data/rarity';
import { STAT_CAP, STAT_IDS, POINTS_PER_LEVEL, powerRating, type Stats } from '../data/stats';
import type { ChestId } from '../data/chests';
import type { FightReport } from '../fight/engine';
import type { FighterSpec } from '../fight/fighter';
import { resolveLook } from '../render/look';
import { makeOpponent, movesFor, randomAppearance } from './opponents';
import { hashStr, pick, seeded } from './rng';
import { S, addXp, commit, grant, owns, type LevelUp, type Loadout } from './state';

// ───────────────────────── Definições ─────────────────────────

export interface BossDef {
  name: string;
  title: string;
  quote: string;
  outfit: string;
  gloves: string;
  mask: string | null;
  aura: string | null;
  hair: string;
  hairColor: string;
  super: string;
  passive: string;
  entrance: string;
}

export interface ChapterReward {
  chest: ChestId;
  gems: number;
  items: string[];
}

export interface ChapterDef {
  n: number;
  name: string;
  sub: string;
  color: string;
  dark: string;
  arena: string;
  /** Nível do 1.º e do último adversário. */
  levels: [number, number];
  /** Pontos de atributo extra (negativo = mais fraco) no início do capítulo. */
  bonus: number;
  /** Raridade máxima do equipamento dos adversários. */
  tier: number;
  boss: BossDef;
  reward: ChapterReward;
}

export const CHAPTERS: ChapterDef[] = [
  {
    n: 1, name: 'Backyard Brawls', sub: 'Kiddie pools, garage rings and a lot of heart', color: '#7bdc1f', dark: '#1d3a0c', arena: 'ar_kings',
    levels: [1, 5], bonus: -14, tier: 1,
    boss: { name: 'Big Rudy', title: 'King of the Backyard', quote: 'This is MY trampoline, kid.', outfit: 'o_leopardo', gloves: 'g_fita', mask: null, aura: null, hair: 'h_longo', hairColor: 'hc_loiro', super: 's_lariat', passive: 'p_ferro', entrance: 'e_danca' },
    reward: { chest: 'prata', gems: 20, items: ['g_fita'] },
  },
  {
    n: 2, name: 'Local Gym Circuit', sub: 'Sweat, smelly towels and real rivals', color: '#3aa0ff', dark: '#0c2446', arena: 'ar_kings',
    levels: [5, 11], bonus: -11, tier: 2,
    boss: { name: 'Rocco Anvil', title: 'Gym Boss', quote: 'Nobody leaves my gym standing.', outfit: 'o_luchador', gloves: 'g_ouro', mask: 'm_luchador', aura: 'a_holofotes', hair: 'h_curto', hairColor: 'hc_preto', super: 's_relampago', passive: 'p_folego', entrance: 'e_fumo' },
    reward: { chest: 'ouro', gems: 30, items: ['t_shuffle'] },
  },
  {
    n: 3, name: 'Regional Tour', sub: 'On the road: desert rings under a blazing sun', color: '#ff9f1a', dark: '#4a2205', arena: 'ar_desert',
    levels: [11, 18], bonus: -10, tier: 3,
    boss: { name: 'Sultan Sandstorm', title: 'Regional Champion', quote: 'The sands bury the weak.', outfit: 'o_gladiador', gloves: 'g_pedra', mask: 'm_caveira', aura: 'a_chamas', hair: 'h_samurai', hairColor: 'hc_preto', super: 's_relampago', passive: 'p_frio', entrance: 'e_pirotecnia' },
    reward: { chest: 'ouro', gems: 50, items: ['ar_desert'] },
  },
  {
    n: 4, name: 'National Championship', sub: 'Prime time, neon lights, the whole country watching', color: '#ff3df0', dark: '#3a0838', arena: 'ar_neon',
    levels: [18, 27], bonus: -12, tier: 4,
    boss: { name: 'Neon Viper', title: 'National Champion', quote: 'Smile for the cameras... then sleep.', outfit: 'o_rocker', gloves: 'g_tesla', mask: 'm_demonio', aura: 'a_neon', hair: 'h_super', hairColor: 'hc_rosa', super: 's_meteoro', passive: 'p_furia', entrance: 'e_lasers' },
    reward: { chest: 'lendario', gems: 80, items: ['ar_neon'] },
  },
  {
    n: 5, name: 'World Title', sub: 'The mountain temple. One belt. One king.', color: '#ffd23d', dark: '#3d2a00', arena: 'ar_temple',
    levels: [27, 38], bonus: -14, tier: 5,
    boss: { name: 'Emperor Kaiju', title: 'World Champion', quote: 'Kneel before the throne of the ring.', outfit: 'o_dragao', gloves: 'g_dragao', mask: null, aura: 'a_raio', hair: 'h_chamas', hairColor: 'hc_ouro', super: 's_cosmico', passive: 'p_fenix', entrance: 'e_dragao' },
    reward: { chest: 'mitico', gems: 150, items: ['ar_temple', 'g_sol'] },
  },
];

export const STAGES_PER_CHAPTER = 8;
export const TOTAL_STAGES = CHAPTERS.length * STAGES_PER_CHAPTER;
export const MAX_STARS = TOTAL_STAGES * 3;
/** Recompensa exclusiva por terminar a carreira. */
export const EXCLUSIVE_ITEM = 'g_sol';

/** Baús de estrelas: um a cada 10 estrelas. */
export const MILESTONES: { stars: number; chest: ChestId; gems: number }[] = [
  { stars: 10, chest: 'bronze', gems: 10 },
  { stars: 20, chest: 'prata', gems: 10 },
  { stars: 30, chest: 'prata', gems: 15 },
  { stars: 40, chest: 'ouro', gems: 15 },
  { stars: 50, chest: 'prata', gems: 20 },
  { stars: 60, chest: 'ouro', gems: 20 },
  { stars: 70, chest: 'ouro', gems: 25 },
  { stars: 80, chest: 'lendario', gems: 25 },
  { stars: 90, chest: 'ouro', gems: 30 },
  { stars: 100, chest: 'lendario', gems: 30 },
  { stars: 110, chest: 'lendario', gems: 40 },
  { stars: 120, chest: 'mitico', gems: 50 },
];

// ───────────────────────── Desafios (3.ª estrela) ─────────────────────────

export interface Challenge {
  id: string;
  text: string;
  test: (r: FightReport) => boolean;
}

const CHALLENGES: Record<string, Challenge> = {
  superko: { id: 'superko', text: 'Finish with a Super K.O.', test: (r) => r.superKO },
  flawless: { id: 'flawless', text: 'Never drop below 65% HP', test: (r) => r.minHp >= 0.65 },
  pinfall: { id: 'pinfall', text: 'Win by pinfall (no Super, no decision)', test: (r) => !r.superKO && !r.decision },
  fast: { id: 'fast', text: 'Win in under 55 seconds', test: (r) => r.duration < 55 },
  dodges: { id: 'dodges', text: 'Dodge at least one attack', test: (r) => r.tally.dodges >= 1 },
  counters: { id: 'counters', text: 'Land a counterattack', test: (r) => r.tally.counters >= 1 },
  grapples: { id: 'grapples', text: 'Land 2+ throws', test: (r) => r.tally.grapples >= 2 },
  supers: { id: 'supers', text: 'Fire 2+ Supers', test: (r) => r.tally.supers >= 2 },
  punches: { id: 'punches', text: 'Land 20+ punches', test: (r) => r.tally.punches >= 20 },
};
const POOL = ['pinfall', 'dodges', 'grapples', 'fast', 'counters', 'punches', 'supers', 'flawless'];

/** Estrela 2: terminar com vida. */
export const HP_STAR: Challenge = { id: 'hp', text: 'Never drop below 40% HP', test: (r) => r.minHp >= 0.4 };

// ───────────────────────── Etapas ─────────────────────────

export interface StageDef {
  id: string;
  /** Índice global 0..39. */
  g: number;
  ch: ChapterDef;
  /** Índice dentro do capítulo 0..7. */
  i: number;
  level: number;
  boss: boolean;
  bonus: number;
  hpMul: number;
  seed: number;
  arena: string;
  stars: [Challenge, Challenge, Challenge];
}

const WIN: Challenge = { id: 'win', text: 'Win the fight', test: (r) => r.won };

function buildStages(): StageDef[] {
  const out: StageDef[] = [];
  CHAPTERS.forEach((ch, c) => {
    for (let i = 0; i < STAGES_PER_CHAPTER; i++) {
      const g = c * STAGES_PER_CHAPTER + i;
      const boss = i === STAGES_PER_CHAPTER - 1;
      const [a, b] = ch.levels;
      const level = Math.round(a + ((b - a) * i) / (STAGES_PER_CHAPTER - 1));
      const r = seeded(hashStr(`career-${g}`));
      const third = boss ? CHALLENGES[c % 2 ? 'flawless' : 'superko'] : CHALLENGES[POOL[(g * 3 + Math.floor(r() * 3)) % POOL.length]];
      out.push({
        id: `c${c + 1}s${i + 1}`,
        g,
        ch,
        i,
        level,
        boss,
        bonus: ch.bonus + Math.floor(i / 3) + (boss ? 3 + c : 0),
        hpMul: c === 0 ? 0.72 + i * 0.025 + (boss ? 0.05 : 0) : boss ? 1 + c * 0.03 : 0.92 + i * 0.01,
        seed: hashStr(`kotr-career-${g}`) >>> 0,
        arena: ch.arena,
        stars: [WIN, HP_STAR, third],
      });
    }
  });
  return out;
}

export const STAGES: StageDef[] = buildStages();

export function stagesOf(ch: number): StageDef[] {
  return STAGES.slice(ch * STAGES_PER_CHAPTER, (ch + 1) * STAGES_PER_CHAPTER);
}

// ───────────────────────── Adversários ─────────────────────────

/** Ajusta o total de pontos de atributo mantendo a forma (arquétipo) da distribuição. */
function retarget(st: Stats, total: number, r: () => number): Stats {
  const s = { ...st };
  let sum = STAT_IDS.reduce((a, id) => a + s[id], 0);
  let guard = 5000;
  while (sum < total && guard-- > 0) {
    const w = STAT_IDS.map((id) => s[id] + 1);
    let x = r() * w.reduce((a, b) => a + b, 0);
    let k = 0;
    while (x > w[k]) x -= w[k++];
    const id = STAT_IDS[Math.min(k, STAT_IDS.length - 1)];
    if (s[id] < STAT_CAP) {
      s[id]++;
      sum++;
    }
  }
  while (sum > total && guard-- > 0) {
    const id = STAT_IDS[Math.floor(r() * STAT_IDS.length)];
    if (s[id] > 2) {
      s[id]--;
      sum--;
    }
  }
  return s;
}

function gearPick(kind: ItemDef['kind'], maxTier: number, r: () => number, minTier = 0): string | null {
  const pool = ITEM_LIST.filter((d) => d.kind === kind && RARITIES[d.rarity].tier <= maxTier && RARITIES[d.rarity].tier >= minTier && d.id !== EXCLUSIVE_ITEM && !isPassItem(d));
  return pool.length ? pick(pool, r).id : null;
}

const BASE_TOTAL = STAT_IDS.length * 5;

/** Adversário (determinístico) de uma etapa. */
export function stageOpponent(st: StageDef): FighterSpec {
  const sp = makeOpponent({ seed: st.seed, levelDelta: st.level - S.level, champion: st.boss });
  const r = seeded(st.seed ^ 0x5bd1e995);
  const lvl = sp.level;
  const total = Math.max(BASE_TOTAL - 20, BASE_TOTAL + (lvl - 1) * POINTS_PER_LEVEL + 3 + st.bonus);
  sp.stats = retarget(sp.stats, total, r);
  sp.hpMul = st.hpMul;
  const c = st.ch.n - 1;
  if (st.boss) {
    const B = st.ch.boss;
    const app = randomAppearance(seeded(st.seed + 99));
    app.hair = B.hair;
    app.hairColor = B.hairColor;
    const lo: Pick<Loadout, 'outfit' | 'gloves' | 'mask' | 'aura'> = { outfit: B.outfit, gloves: B.gloves, mask: B.mask, aura: B.aura };
    sp.name = B.name;
    sp.title = B.title;
    sp.look = resolveLook(app, lo);
    sp.supers = [B.super];
    sp.passives = [B.passive];
    sp.entrance = B.entrance;
    sp.moves = movesFor(lvl, seeded(st.seed + 5));
  } else {
    const app = randomAppearance(seeded(st.seed + 17));
    const tier = st.ch.tier;
    const lo = {
      outfit: gearPick('outfit', tier, r, Math.max(0, tier - 2)) ?? 'o_azul',
      gloves: gearPick('gloves', tier, r, Math.max(0, tier - 2)) ?? 'g_azuis',
      mask: r() < 0.12 + c * 0.1 ? gearPick('mask', tier, r) : null,
      aura: r() < c * 0.12 ? gearPick('aura', tier, r) : null,
    };
    sp.look = resolveLook(app, lo);
    // supers/passivas determinísticos (não dependem dos troféus do jogador)
    sp.supers = [gearPick('super', Math.max(0, Math.min(tier - 2, 1 + Math.floor(lvl / 12))), r, Math.max(0, tier - 4)) ?? 's_supersoco'];
    sp.passives = [gearPick('passive', Math.max(0, Math.min(tier - 2, Math.floor(lvl / 14))), r) ?? 'p_ferro'];
    sp.entrance = gearPick('entrance', tier, r) ?? 'e_classica';
  }
  return sp;
}

export function stagePower(st: StageDef): number {
  const sp = stageOpponent(st);
  return powerRating(sp.level, sp.stats);
}

// ───────────────────────── Progresso ─────────────────────────

const KEY = 'kotr-career-v1';

interface CareerSave {
  v: 1;
  /** Máscara de estrelas por etapa (bit0 vitória, bit1 vida, bit2 desafio). */
  m: Record<string, number>;
  /** Marcos de estrelas já reclamados (n.º de estrelas). */
  ms: number[];
  /** Capítulos com recompensa entregue. */
  chs: number[];
  /** Tentativas e vitórias. */
  fights: number;
  wins: number;
  /** Última etapa nova desbloqueada que ainda não foi vista no mapa (anima o nó). */
  fresh: string | null;
}

function freshCareer(): CareerSave {
  return { v: 1, m: {}, ms: [], chs: [], fights: 0, wins: 0, fresh: null };
}

function loadCareer(): CareerSave {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshCareer();
    const d = JSON.parse(raw) as Partial<CareerSave>;
    const b = freshCareer();
    return {
      ...b,
      ...d,
      m: typeof d.m === 'object' && d.m ? d.m : {},
      ms: Array.isArray(d.ms) ? d.ms : [],
      chs: Array.isArray(d.chs) ? d.chs : [],
      v: 1,
    };
  } catch {
    return freshCareer();
  }
}

export const C: CareerSave = loadCareer();

export function saveCareer(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(C));
  } catch {
    /* armazenamento indisponível */
  }
}

export function maskOf(id: string): number {
  return C.m[id] ?? 0;
}

export function starsOf(id: string): number {
  const m = maskOf(id);
  return (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1);
}

export function cleared(st: StageDef): boolean {
  return starsOf(st.id) > 0;
}

export function unlocked(st: StageDef): boolean {
  return st.g === 0 || cleared(STAGES[st.g - 1]);
}

export function chapterUnlocked(c: number): boolean {
  return unlocked(STAGES[c * STAGES_PER_CHAPTER]);
}

export function chapterStars(c: number): number {
  return stagesOf(c).reduce((a, s) => a + starsOf(s.id), 0);
}

export function totalStars(): number {
  return STAGES.reduce((a, s) => a + starsOf(s.id), 0);
}

/** Próxima etapa por vencer (ou null se a carreira acabou). */
export function nextStage(): StageDef | null {
  return STAGES.find((s) => !cleared(s)) ?? null;
}

export function careerDone(): boolean {
  return cleared(STAGES[STAGES.length - 1]);
}

export function claimableMilestones(): typeof MILESTONES {
  const t = totalStars();
  return MILESTONES.filter((m) => t >= m.stars && !C.ms.includes(m.stars));
}

export function nextMilestone(): (typeof MILESTONES)[number] | null {
  return MILESTONES.find((m) => !C.ms.includes(m.stars)) ?? null;
}

export function claimMilestone(stars: number): (typeof MILESTONES)[number] | null {
  const m = MILESTONES.find((x) => x.stars === stars);
  if (!m || C.ms.includes(stars) || totalStars() < stars) return null;
  C.ms.push(stars);
  S.chests[m.chest]++;
  S.gems += m.gems;
  saveCareer();
  commit();
  return m;
}

export function careerBadgeCount(): number {
  let n = claimableMilestones().length;
  const nx = nextStage();
  // há uma etapa nova pronta (e o jogador tem nível para ela)
  if (nx && S.created && S.level >= nx.level - 2) n++;
  return n;
}

// ───────────────────────── Resultado de um combate ─────────────────────────

export interface StageResult {
  st: StageDef;
  won: boolean;
  /** Estrelas conseguidas neste combate (máscara). */
  got: number;
  /** Máscara antes / depois. */
  before: number;
  after: number;
  /** Estrelas novas. */
  newStars: number;
  firstClear: boolean;
  coins: number;
  xp: number;
  gems: number;
  chests: ChestId[];
  items: { id: string; isNew: boolean }[];
  chapterDone: ChapterDef | null;
  levelUp: LevelUp | null;
  unlockedNext: StageDef | null;
}

export function evaluate(st: StageDef, r: FightReport): number {
  if (!r.won) return 0;
  let m = 0;
  st.stars.forEach((c, k) => {
    if (c.test(r)) m |= 1 << k;
  });
  return m;
}

/** Recompensas de 1.ª vitória (mostradas na ficha da etapa). */
export function firstClearRewards(st: StageDef): { coins: number; xp: number; gemsPerStar: number } {
  const boss = st.boss ? 1.6 : 1;
  return {
    coins: Math.round((70 + st.level * 14) * boss),
    xp: Math.round((55 + st.level * 9) * boss),
    gemsPerStar: st.boss ? 5 : 2,
  };
}

export function applyResult(st: StageDef, r: FightReport): StageResult {
  const before = maskOf(st.id);
  const got = evaluate(st, r);
  const after = before | got;
  const bits = (x: number) => (x & 1) + ((x >> 1) & 1) + ((x >> 2) & 1);
  const newStars = bits(after) - bits(before);
  const firstClear = r.won && before === 0;
  const fc = firstClearRewards(st);
  let coins: number;
  let xp: number;
  let gems = newStars * fc.gemsPerStar;
  const chests: ChestId[] = [];
  const items: { id: string; isNew: boolean }[] = [];
  let chapterDone: ChapterDef | null = null;
  if (r.won) {
    coins = firstClear ? fc.coins : Math.round(fc.coins * 0.3);
    xp = firstClear ? fc.xp : Math.round(fc.xp * 0.4);
  } else {
    coins = 10 + st.level * 3;
    xp = 15 + st.level * 3;
  }
  C.fights++;
  if (r.won) C.wins++;
  C.m[st.id] = after;
  if (firstClear && st.boss && !C.chs.includes(st.ch.n)) {
    C.chs.push(st.ch.n);
    chapterDone = st.ch;
    const rw = st.ch.reward;
    chests.push(rw.chest);
    S.chests[rw.chest]++;
    gems += rw.gems;
    for (const id of rw.items) {
      if (!ITEMS[id]) continue;
      // arenas repetidas não servem de nada: viram gemas
      if (ITEMS[id].kind === 'arena' && owns(id)) {
        gems += 150;
        items.push({ id, isNew: false });
      } else items.push({ id, isNew: grant(id) });
    }
  }
  const unlockedNext = firstClear && st.g + 1 < STAGES.length ? STAGES[st.g + 1] : null;
  if (unlockedNext) C.fresh = unlockedNext.id;
  S.coins += coins;
  S.gems += gems;
  const levelUp = addXp(xp);
  saveCareer();
  commit();
  return { st, won: r.won, got, before, after, newStars, firstClear, coins, xp, gems, chests, items, chapterDone, levelUp, unlockedNext };
}

export function consumeFresh(): string | null {
  const f = C.fresh;
  if (f) {
    C.fresh = null;
    saveCareer();
  }
  return f;
}

/** Só para testes/depuração. */
export function resetCareer(): void {
  Object.assign(C, freshCareer());
  saveCareer();
}
