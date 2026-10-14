export type StatId = 'for' | 'agr' | 'vel' | 'esq' | 'def' | 'vit' | 'res' | 'pre' | 'car' | 'ctr';

export interface StatDef {
  id: StatId;
  name: string;
  short: string;
  icon: string;
  desc: string;
  color: string;
}

export const STATS: StatDef[] = [
  { id: 'for', name: 'Strength', short: 'STR', icon: 'fist', desc: 'Damage of punches and kicks.', color: '#ff5a5a' },
  { id: 'agr', name: 'Grappling', short: 'GRP', icon: 'grapple', desc: 'Damage and frequency of throws and suplexes.', color: '#ff8a3d' },
  { id: 'vel', name: 'Speed', short: 'SPD', icon: 'speed', desc: 'How fast you attack and move.', color: '#ffd23d' },
  { id: 'esq', name: 'Evasion', short: 'EVA', icon: 'dodge', desc: 'Chance to dodge incoming hits.', color: '#5ef0c0' },
  { id: 'def', name: 'Defense', short: 'DEF', icon: 'shield', desc: 'Take less damage and block more often.', color: '#4aa8ff' },
  { id: 'vit', name: 'Vitality', short: 'VIT', icon: 'vitality', desc: 'Raises your max health.', color: '#ff4f8b' },
  { id: 'res', name: 'Endurance', short: 'END', icon: 'stamina', desc: 'Get up faster and last longer.', color: '#9be15d' },
  { id: 'pre', name: 'Accuracy', short: 'ACC', icon: 'target', desc: 'Chance to land a critical hit.', color: '#c77dff' },
  { id: 'car', name: 'Charisma', short: 'CHA', icon: 'charisma', desc: 'Pump up the crowd: charge your Super faster.', color: '#ff7ae0' },
  { id: 'ctr', name: 'Counter', short: 'CTR', icon: 'counter', desc: 'Strike back after a dodge or a block.', color: '#7ad7ff' },
];

export type Stats = Record<StatId, number>;

export const STAT_IDS: StatId[] = STATS.map((s) => s.id);
export const STAT_CAP = 99;
export const STAT_START = 5;
export const POINTS_PER_LEVEL = 3;
export const MAX_LEVEL = 60;

export function baseStats(v = STAT_START): Stats {
  const s = {} as Stats;
  for (const id of STAT_IDS) s[id] = v;
  return s;
}

export function maxHp(level: number, vit: number): number {
  return Math.round(320 + level * 18 + vit * 9);
}

/** Pontuação de poder usada para mostrar/equilibrar adversários. */
export function powerRating(level: number, stats: Stats): number {
  let sum = 0;
  for (const id of STAT_IDS) sum += stats[id];
  return Math.round(level * 12 + sum * 4);
}

export function xpToNext(level: number): number {
  return Math.round(90 + level * 55 + level * level * 4);
}
