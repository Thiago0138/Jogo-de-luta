import type { Rarity } from './rarity';

export type ChestId = 'bronze' | 'prata' | 'ouro' | 'lendario' | 'mitico';

export interface ChestDef {
  id: ChestId;
  name: string;
  /** Cores da madeira/metal do baú. */
  body: string;
  trim: string;
  glow: string;
  rolls: number;
  coins: [number, number];
  gems: [number, number];
  /** Pesos de raridade para os itens sorteados. */
  weights: Partial<Record<Rarity, number>>;
  /** Raridade mínima garantida num dos itens. */
  guaranteed?: Rarity;
  coinPrice?: number;
  gemPrice?: number;
  desc: string;
}

export const CHESTS: Record<ChestId, ChestDef> = {
  bronze: {
    id: 'bronze', name: 'Bronze Chest', body: '#8a4e22', trim: '#cd8a4a', glow: '#ffb070',
    rolls: 2, coins: [60, 140], gems: [0, 0],
    weights: { comum: 75, incomum: 21, raro: 3.5, epico: 0.5 },
    coinPrice: 1500, desc: '2 rewards · coins',
  },
  prata: {
    id: 'prata', name: 'Silver Chest', body: '#5a6576', trim: '#d9e2ee', glow: '#cfe6ff',
    rolls: 3, coins: [150, 300], gems: [0, 3],
    weights: { comum: 52, incomum: 34, raro: 11, epico: 2.6, lendario: 0.4 },
    guaranteed: 'incomum', coinPrice: 4500, desc: '3 rewards · Uncommon guaranteed',
  },
  ouro: {
    id: 'ouro', name: 'Gold Chest', body: '#b07a00', trim: '#ffe27a', glow: '#ffd23d',
    rolls: 4, coins: [350, 650], gems: [2, 8],
    weights: { incomum: 50, raro: 36, epico: 11.6, lendario: 2.2, mitico: 0.2 },
    guaranteed: 'raro', gemPrice: 120, desc: '4 rewards · Rare guaranteed',
  },
  lendario: {
    id: 'lendario', name: 'Legendary Chest', body: '#5b1fa8', trim: '#ffb31a', glow: '#d07aff',
    rolls: 5, coins: [800, 1400], gems: [8, 20],
    weights: { raro: 55, epico: 36.77, lendario: 8, mitico: 0.18, celestial: 0.05 },
    guaranteed: 'epico', gemPrice: 380, desc: '5 rewards · Epic guaranteed',
  },
  mitico: {
    id: 'mitico', name: 'Mythic Chest', body: '#7a0c2e', trim: '#7af7ff', glow: '#ff3d6e',
    rolls: 6, coins: [2000, 3500], gems: [25, 50],
    weights: { epico: 60, lendario: 39.69, mitico: 0.16, celestial: 0.15 },
    guaranteed: 'lendario', gemPrice: 950, desc: '6 rewards · Legendary guaranteed',
  },
};

export const CHEST_ORDER: ChestId[] = ['bronze', 'prata', 'ouro', 'lendario', 'mitico'];
