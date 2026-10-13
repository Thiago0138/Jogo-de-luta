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
  { id: 'for', name: 'Força', short: 'FOR', icon: '👊', desc: 'Dano de socos e pontapés.', color: '#ff5a5a' },
  { id: 'agr', name: 'Agarrão', short: 'AGR', icon: '🤼', desc: 'Dano e frequência de projeções e suplexes.', color: '#ff8a3d' },
  { id: 'vel', name: 'Velocidade', short: 'VEL', icon: '⚡', desc: 'Rapidez dos ataques e do movimento.', color: '#ffd23d' },
  { id: 'esq', name: 'Esquiva', short: 'ESQ', icon: '💨', desc: 'Probabilidade de desviar de golpes.', color: '#5ef0c0' },
  { id: 'def', name: 'Defesa', short: 'DEF', icon: '🛡️', desc: 'Reduz o dano recebido e bloqueia mais.', color: '#4aa8ff' },
  { id: 'vit', name: 'Vitalidade', short: 'VIT', icon: '❤️', desc: 'Aumenta a vida máxima.', color: '#ff4f8b' },
  { id: 'res', name: 'Resistência', short: 'RES', icon: '🔋', desc: 'Levanta-se mais depressa e aguenta mais.', color: '#9be15d' },
  { id: 'pre', name: 'Precisão', short: 'PRE', icon: '🎯', desc: 'Probabilidade de golpe crítico.', color: '#c77dff' },
  { id: 'car', name: 'Carisma', short: 'CAR', icon: '🎤', desc: 'O público vibra: carrega o Super mais rápido.', color: '#ff7ae0' },
  { id: 'ctr', name: 'Contra-ataque', short: 'CTR', icon: '🔄', desc: 'Responde com um contra-golpe após esquivar ou bloquear.', color: '#7ad7ff' },
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
