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
    id: 'bronze', name: 'Baú de Bronze', body: '#8a4e22', trim: '#cd8a4a', glow: '#ffb070',
    rolls: 2, coins: [60, 140], gems: [0, 0],
    weights: { comum: 70, incomum: 25, raro: 5 },
    coinPrice: 400, desc: '2 recompensas · moedas',
  },
  prata: {
    id: 'prata', name: 'Baú de Prata', body: '#5a6576', trim: '#d9e2ee', glow: '#cfe6ff',
    rolls: 3, coins: [150, 300], gems: [0, 3],
    weights: { comum: 40, incomum: 38, raro: 18, epico: 4 },
    guaranteed: 'incomum', coinPrice: 1200, desc: '3 recompensas · incomum garantido',
  },
  ouro: {
    id: 'ouro', name: 'Baú de Ouro', body: '#b07a00', trim: '#ffe27a', glow: '#ffd23d',
    rolls: 4, coins: [350, 650], gems: [2, 8],
    weights: { incomum: 40, raro: 38, epico: 17, lendario: 4.5, mitico: 0.5 },
    guaranteed: 'raro', gemPrice: 120, desc: '4 recompensas · raro garantido',
  },
  lendario: {
    id: 'lendario', name: 'Baú Lendário', body: '#5b1fa8', trim: '#ffb31a', glow: '#d07aff',
    rolls: 5, coins: [800, 1400], gems: [8, 20],
    weights: { raro: 40, epico: 38, lendario: 18, mitico: 3.6, celestial: 0.4 },
    guaranteed: 'epico', gemPrice: 380, desc: '5 recompensas · épico garantido',
  },
  mitico: {
    id: 'mitico', name: 'Baú Mítico', body: '#7a0c2e', trim: '#7af7ff', glow: '#ff3d6e',
    rolls: 6, coins: [2000, 3500], gems: [25, 50],
    weights: { epico: 45, lendario: 38, mitico: 15, celestial: 2 },
    guaranteed: 'lendario', gemPrice: 950, desc: '6 recompensas · lendário garantido',
  },
};

export const CHEST_ORDER: ChestId[] = ['bronze', 'prata', 'ouro', 'lendario', 'mitico'];
