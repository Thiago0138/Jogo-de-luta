export type Rarity = 'comum' | 'incomum' | 'raro' | 'epico' | 'lendario' | 'mitico' | 'celestial';

export interface RarityDef {
  id: Rarity;
  name: string;
  color: string;
  /** Cor secundária usada em gradientes/brilhos. */
  glow: string;
  /** Ordem de raridade (0 = mais comum). */
  tier: number;
  /** Valor de reciclagem de um duplicado, em moedas. */
  recycle: number;
}

export const RARITIES: Record<Rarity, RarityDef> = {
  comum: { id: 'comum', name: 'Comum', color: '#a9b4c2', glow: '#e4ebf3', tier: 0, recycle: 20 },
  incomum: { id: 'incomum', name: 'Incomum', color: '#4cd964', glow: '#b6ffc4', tier: 1, recycle: 50 },
  raro: { id: 'raro', name: 'Raro', color: '#3aa0ff', glow: '#a9d6ff', tier: 2, recycle: 120 },
  epico: { id: 'epico', name: 'Épico', color: '#b45cff', glow: '#e3c2ff', tier: 3, recycle: 300 },
  lendario: { id: 'lendario', name: 'Lendário', color: '#ffb31a', glow: '#ffe7a3', tier: 4, recycle: 800 },
  mitico: { id: 'mitico', name: 'Mítico', color: '#ff3d6e', glow: '#ffb3c6', tier: 5, recycle: 2000 },
  celestial: { id: 'celestial', name: 'Celestial', color: '#7af7ff', glow: '#ffffff', tier: 6, recycle: 5000 },
};

export const RARITY_ORDER: Rarity[] = ['comum', 'incomum', 'raro', 'epico', 'lendario', 'mitico', 'celestial'];

export function rarityColor(r: Rarity, t = 0): string {
  if (r !== 'celestial') return RARITIES[r].color;
  return `hsl(${(t * 90) % 360} 100% 70%)`;
}
