import type { ChestId } from './chests';

/** Contadores produzidos por cada luta (e por outros eventos) que alimentam missões. */
export interface Tally {
  fights: number;
  wins: number;
  tagWins: number;
  championWins: number;
  punches: number;
  grapples: number;
  supers: number;
  superKOs: number;
  dodges: number;
  counters: number;
  dives: number;
  perfectWins: number;
  comebackWins: number;
  chestsOpened: number;
  damage: number;
}

export function emptyTally(): Tally {
  return {
    fights: 0, wins: 0, tagWins: 0, championWins: 0, punches: 0, grapples: 0, supers: 0,
    superKOs: 0, dodges: 0, counters: 0, dives: 0, perfectWins: 0,
    comebackWins: 0, chestsOpened: 0, damage: 0,
  };
}

export interface Reward {
  xp?: number;
  coins?: number;
  gems?: number;
  chest?: ChestId;
  item?: string;
}

export interface MissionDef {
  id: string;
  text: string;
  key: keyof Tally | 'level' | 'bestStreak' | 'trophies' | 'collection';
  target: number;
  reward: Reward;
}

export const DAILY_POOL: MissionDef[] = [
  { id: 'd_win3', text: 'Vence 3 lutas', key: 'wins', target: 3, reward: { xp: 120, coins: 250 } },
  { id: 'd_fight5', text: 'Disputa 5 lutas', key: 'fights', target: 5, reward: { xp: 100, coins: 200 } },
  { id: 'd_punch60', text: 'Acerta 60 socos', key: 'punches', target: 60, reward: { xp: 90, coins: 180 } },
  { id: 'd_grap6', text: 'Faz 6 agarrões ou projeções', key: 'grapples', target: 6, reward: { xp: 90, coins: 200 } },
  { id: 'd_super3', text: 'Usa 3 super ataques', key: 'supers', target: 3, reward: { xp: 100, coins: 220 } },
  { id: 'd_tag1', text: 'Vence 1 luta de Tag Team', key: 'tagWins', target: 1, reward: { xp: 110, coins: 230 } },
  { id: 'd_dodge12', text: 'Esquiva 12 golpes', key: 'dodges', target: 12, reward: { xp: 90, coins: 180 } },
  { id: 'd_dive2', text: 'Faz 2 saltos da corda de cima', key: 'dives', target: 2, reward: { xp: 110, coins: 220 } },
  { id: 'd_chest1', text: 'Abre 1 baú', key: 'chestsOpened', target: 1, reward: { xp: 80, coins: 150 } },
  { id: 'd_counter5', text: 'Faz 5 contra-ataques', key: 'counters', target: 5, reward: { xp: 100, coins: 200 } },
  { id: 'd_dmg2500', text: 'Causa 2500 de dano', key: 'damage', target: 2500, reward: { xp: 110, coins: 220 } },
];

export const WEEKLY_POOL: MissionDef[] = [
  { id: 'w_win20', text: 'Vence 20 lutas', key: 'wins', target: 20, reward: { xp: 600, coins: 1500, gems: 10 } },
  { id: 'w_superko8', text: 'Termina 8 lutas com um super', key: 'superKOs', target: 8, reward: { xp: 500, coins: 1200, chest: 'prata' } },
  { id: 'w_tag8', text: 'Vence 8 lutas de Tag Team', key: 'tagWins', target: 8, reward: { xp: 550, coins: 1300, gems: 10 } },
  { id: 'w_champ3', text: 'Derrota 3 Campeões', key: 'championWins', target: 3, reward: { xp: 700, coins: 1500, chest: 'ouro' } },
  { id: 'w_perfect5', text: 'Vence 5 lutas com mais de 70% de vida', key: 'perfectWins', target: 5, reward: { xp: 600, coins: 1400, gems: 15 } },
  { id: 'w_grap40', text: 'Faz 40 projeções', key: 'grapples', target: 40, reward: { xp: 500, coins: 1200 } },
  { id: 'w_chest6', text: 'Abre 6 baús', key: 'chestsOpened', target: 6, reward: { xp: 450, coins: 1000, chest: 'prata' } },
  { id: 'w_dmg30k', text: 'Causa 30 000 de dano', key: 'damage', target: 30000, reward: { xp: 550, coins: 1300, gems: 10 } },
];

/** Desafios permanentes e muito difíceis que desbloqueiam as skins mais raras. */
export const LEGENDARY: MissionDef[] = [
  { id: 'l_streak5', text: 'Vence 5 lutas seguidas', key: 'bestStreak', target: 5, reward: { gems: 30, chest: 'ouro' } },
  { id: 'l_level10', text: 'Chega ao nível 10', key: 'level', target: 10, reward: { gems: 40, item: 'hc_arcoiris' } },
  { id: 'l_counter300', text: 'Faz 300 contra-ataques', key: 'counters', target: 300, reward: { gems: 50, item: 'm_cyber' } },
  { id: 'l_comeback', text: 'Vence 10 lutas depois de ficares abaixo de 15% de vida', key: 'comebackWins', target: 10, reward: { gems: 60, item: 'o_gelo' } },
  { id: 'l_streak15', text: 'Vence 15 lutas seguidas', key: 'bestStreak', target: 15, reward: { gems: 80, chest: 'lendario' } },
  { id: 'l_champ25', text: 'Derrota 25 Campeões', key: 'championWins', target: 25, reward: { gems: 100, item: 'a_cosmos' } },
  { id: 'l_trophy3500', text: 'Chega à liga Lenda (3500 troféus)', key: 'trophies', target: 3500, reward: { gems: 150, item: 'h_coroa' } },
  { id: 'l_superko100', text: 'Termina 100 lutas com um super', key: 'superKOs', target: 100, reward: { gems: 120, item: 's_ira' } },
  { id: 'l_wins500', text: 'Vence 500 lutas', key: 'wins', target: 500, reward: { gems: 200, item: 'o_cosmos' } },
  { id: 'l_collect', text: 'Coleciona 60 itens diferentes', key: 'collection', target: 60, reward: { gems: 150, item: 'p_bencao' } },
];
