import { BEARD_STYLES, BROW_STYLES, EYE_COLORS, EYE_STYLES, MOUTH_STYLES, SKIN_TONES, type Appearance } from '../data/appearance';
import { ITEM_LIST, type ItemDef } from '../data/items';
import { RARITIES } from '../data/rarity';
import { POINTS_PER_LEVEL, STAT_CAP, STAT_IDS, baseStats, type StatId, type Stats } from '../data/stats';
import { leagueIndex } from '../data/leagues';
import type { FighterSpec } from '../fight/fighter';
import { resolveLook } from '../render/look';
import { S, owns, type Loadout } from './state';
import { pick, rint, seeded } from './rng';

const FIRST = ['Rei', 'Touro', 'Lobo', 'Tigre', 'Furacão', 'Martelo', 'Dragão', 'Titã', 'Falcão', 'Vulcão', 'Corvo', 'Gigante', 'Trovão', 'Bisonte', 'Cobra', 'Leão', 'Tubarão', 'Cometa', 'Pantera', 'Rocha'];
const LAST = ['de Aço', 'Selvagem', 'Dourado', 'Sombrio', 'da Noite', 'Elétrico', 'Imparável', 'do Norte', 'Furioso', 'Mascarado', 'de Ferro', 'Veloz', 'Infernal', 'Gelado', 'Real', 'Brutal'];
const SOLO = ['Big Rui', 'El Tornado', 'Mister Músculo', 'Zé Bigorna', 'Dona Marreta', 'Kid Faísca', 'La Sombra', 'Capitão Soco', 'Tó Trovão', 'Rita Rasteira', 'Duque Dinamite', 'Nuno Nitro', 'Baronesa Bomba', 'Max Mandíbula', 'Lady Lariat', 'Vasco Vulcão'];

type Archetype = { name: string; w: Partial<Record<StatId, number>> };
const ARCHETYPES: Archetype[] = [
  { name: 'Brutamontes', w: { for: 3, agr: 3, vit: 2, res: 1 } },
  { name: 'Boxeador', w: { for: 2, vel: 3, pre: 2, esq: 1 } },
  { name: 'Acrobata', w: { esq: 3, vel: 2, car: 2, ctr: 1 } },
  { name: 'Tanque', w: { def: 3, vit: 3, res: 2 } },
  { name: 'Técnico', w: { ctr: 3, pre: 2, def: 1, agr: 1 } },
  { name: 'Estrela', w: { car: 3, for: 1, vel: 1, pre: 1, vit: 1 } },
];

export function randomName(r: () => number = Math.random): string {
  return r() < 0.35 ? pick(SOLO, r) : `${pick(FIRST, r)} ${pick(LAST, r)}`;
}

export function randomAppearance(r: () => number = Math.random): Appearance {
  const hairs = ITEM_LIST.filter((d) => d.kind === 'hair' && RARITIES[d.rarity].tier <= 2);
  const colors = ITEM_LIST.filter((d) => d.kind === 'hairColor' && RARITIES[d.rarity].tier <= 2);
  return {
    skin: rint(0, SKIN_TONES.length - 1, r),
    hair: pick(hairs, r).id,
    hairColor: pick(colors, r).id,
    eyes: pick(EYE_STYLES, r).id,
    eyeColor: rint(0, EYE_COLORS.length - 1, r),
    brows: pick(BROW_STYLES, r).id,
    mouth: pick(MOUTH_STYLES, r).id,
    beard: r() < 0.5 ? 'nenhuma' : pick(BEARD_STYLES, r).id,
    height: 0.95 + r() * 0.1,
  };
}

function distribute(level: number, r: () => number, arch: Archetype, bonus = 0): Stats {
  const st = baseStats();
  let pts = (level - 1) * POINTS_PER_LEVEL + 3 + bonus;
  // pontos negativos retiram atributos (adversários de iniciação)
  for (let k = pts; k < 0; k++) {
    const id = STAT_IDS[Math.floor(r() * STAT_IDS.length)];
    if (st[id] > 2) st[id]--;
  }
  const w = STAT_IDS.map((id) => (arch.w[id] ?? 0) + 0.5);
  const tot = w.reduce((a, b) => a + b, 0);
  while (pts > 0) {
    let x = r() * tot;
    let i = 0;
    while (x > w[i]) x -= w[i++];
    const id = STAT_IDS[Math.min(i, STAT_IDS.length - 1)];
    if (st[id] < STAT_CAP) {
      st[id]++;
      pts--;
    } else if (STAT_IDS.every((k) => st[k] >= STAT_CAP)) break;
  }
  return st;
}

/** Escolhe itens por raridade máxima permitida (mais raros em ligas mais altas). */
function gear(kind: ItemDef['kind'], maxTier: number, r: () => number, chance = 1): string | null {
  if (r() > chance) return null;
  const pool = ITEM_LIST.filter((d) => d.kind === kind && RARITIES[d.rarity].tier <= maxTier);
  if (!pool.length) return null;
  // ligeira preferência pelos mais raros disponíveis
  pool.sort((a, b) => RARITIES[a.rarity].tier - RARITIES[b.rarity].tier);
  const i = Math.floor(Math.pow(r(), 0.7) * pool.length);
  return pool[Math.min(pool.length - 1, i)].id;
}

/** Golpes de assinatura de um lutador da IA: os desbloqueados até ao seu nível (máx. 6). */
export function movesFor(lvl: number, r: () => number = Math.random): string[] {
  const avail = ITEM_LIST.filter((d) => d.kind === 'move' && (d.unlockLevel ?? 1) <= lvl + 1);
  avail.sort(() => r() - 0.5);
  return avail.slice(0, 6).map((d) => d.id);
}

export interface OppOpts {
  levelDelta?: number;
  champion?: boolean;
  seed?: number;
}

export function makeOpponent(o: OppOpts = {}): FighterSpec {
  const r = o.seed != null ? seeded(o.seed) : Math.random;
  const li = leagueIndex(S.trophies);
  const lvl = Math.max(1, Math.min(60, S.level + (o.levelDelta ?? (li <= 1 ? rint(-1, 0, r) : rint(-1, 1, r)))));
  const arch = pick(ARCHETYPES, r);
  // nas primeiras ligas os adversários são um pouco mais fracos para dar confiança
  const rookie = S.life.fights < 6 ? -10 : 0;
  const handicap = o.champion ? 2 : (li === 0 ? -8 : li === 1 ? -5 : -3) + rookie;
  const stats = distribute(lvl, r, arch, handicap);
  const maxTier = Math.min(6, 1 + Math.floor(li * 0.8) + (o.champion ? 1 : 0));
  const loadout: Loadout = {
    outfit: gear('outfit', maxTier, r) ?? 'o_azul',
    gloves: gear('gloves', maxTier, r) ?? 'g_azuis',
    mask: gear('mask', maxTier, r, o.champion ? 0.7 : 0.25),
    aura: gear('aura', maxTier, r, o.champion ? 0.9 : li * 0.08),
    supers: [gear('super', Math.min(maxTier, 2 + Math.floor(lvl / 10)), r) ?? 's_supersoco'],
    passives: [gear('passive', Math.min(maxTier, 1 + Math.floor(lvl / 12)), r) ?? 'p_ferro'],
    belt: lvl >= 3 ? ['c_vida'] : [],
    entrance: gear('entrance', Math.min(6, maxTier + 1), r) ?? 'e_classica',
    moves: movesFor(lvl, r),
    styles: [],
  };
  const app = randomAppearance(r);
  if (o.champion) {
    app.hair = gear('hair', maxTier, r) ?? app.hair;
    app.hairColor = gear('hairColor', maxTier, r) ?? app.hairColor;
  }
  let name = randomName(r);
  for (let i = 0; i < 5 && name === S.name; i++) name = randomName(r);
  return {
    name,
    title: o.champion ? 'Campeão' : arch.name,
    level: lvl,
    stats,
    look: resolveLook(app, loadout),
    supers: loadout.supers,
    passives: loadout.passives,
    belt: loadout.belt,
    entrance: loadout.entrance,
    moves: loadout.moves,
    isPlayer: false,
    hpMul: o.champion ? 1 : S.life.fights < 6 ? 0.72 : li === 0 ? 0.9 : 1,
  };
}

/** Parceiro de tag team do jogador: um lutador fixo (semente própria) que acompanha o nível do jogador. */
export function makePartner(): FighterSpec {
  const r = seeded(S.partnerSeed);
  const arch = pick(ARCHETYPES, r);
  const app = randomAppearance(r);
  const lvl = Math.max(1, S.level);
  const stats = distribute(lvl, seeded(S.partnerSeed + 7), arch);
  const loadout = { outfit: 'o_azul', gloves: 'g_azuis', mask: null, aura: null };
  return {
    name: randomName(seeded(S.partnerSeed + 3)),
    title: 'Parceiro',
    level: lvl,
    stats,
    look: resolveLook(app, loadout),
    supers: ['s_supersoco'],
    passives: ['p_ferro'],
    belt: [],
    moves: movesFor(lvl, seeded(S.partnerSeed + 11)),
    isPlayer: false,
  };
}

export function playerSpec(): FighterSpec {
  const belt = S.loadout.belt.filter((id) => (S.owned[id] ?? 0) > 0);
  return {
    name: S.name || 'Tu',
    level: S.level,
    stats: { ...S.stats },
    look: resolveLook(S.appearance, S.loadout),
    supers: [...S.loadout.supers],
    passives: [...S.loadout.passives],
    belt,
    entrance: S.loadout.entrance,
    moves: S.loadout.moves.filter((id) => owns(id)),
    styles: S.loadout.styles.filter((id) => owns(id)),
    isPlayer: true,
  };
}
