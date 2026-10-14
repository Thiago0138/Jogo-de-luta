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
  { id: 'd_win3', text: 'Win 3 fights', key: 'wins', target: 3, reward: { xp: 120, coins: 250 } },
  { id: 'd_fight5', text: 'Fight 5 matches', key: 'fights', target: 5, reward: { xp: 100, coins: 200 } },
  { id: 'd_punch60', text: 'Land 60 punches', key: 'punches', target: 60, reward: { xp: 90, coins: 180 } },
  { id: 'd_grap6', text: 'Pull off 6 grapples or throws', key: 'grapples', target: 6, reward: { xp: 90, coins: 200 } },
  { id: 'd_super3', text: 'Use 3 Super moves', key: 'supers', target: 3, reward: { xp: 100, coins: 220 } },
  { id: 'd_tag1', text: 'Win 1 Tag Team fight', key: 'tagWins', target: 1, reward: { xp: 110, coins: 230 } },
  { id: 'd_dodge12', text: 'Dodge 12 hits', key: 'dodges', target: 12, reward: { xp: 90, coins: 180 } },
  { id: 'd_dive2', text: 'Dive off the top rope 2 times', key: 'dives', target: 2, reward: { xp: 110, coins: 220 } },
  { id: 'd_chest1', text: 'Open 1 chest', key: 'chestsOpened', target: 1, reward: { xp: 80, coins: 150 } },
  { id: 'd_counter5', text: 'Land 5 counterattacks', key: 'counters', target: 5, reward: { xp: 100, coins: 200 } },
  { id: 'd_dmg2500', text: 'Deal 2,500 damage', key: 'damage', target: 2500, reward: { xp: 110, coins: 220 } },
];

export const WEEKLY_POOL: MissionDef[] = [
  { id: 'w_win20', text: 'Win 20 fights', key: 'wins', target: 20, reward: { xp: 600, coins: 1500, gems: 10 } },
  { id: 'w_superko8', text: 'Finish 8 fights with a Super', key: 'superKOs', target: 8, reward: { xp: 500, coins: 1200, chest: 'prata' } },
  { id: 'w_tag8', text: 'Win 8 Tag Team fights', key: 'tagWins', target: 8, reward: { xp: 550, coins: 1300, gems: 10 } },
  { id: 'w_champ3', text: 'Defeat 3 Champions', key: 'championWins', target: 3, reward: { xp: 700, coins: 1500, chest: 'ouro' } },
  { id: 'w_perfect5', text: 'Win 5 fights with over 70% health', key: 'perfectWins', target: 5, reward: { xp: 600, coins: 1400, gems: 15 } },
  { id: 'w_grap40', text: 'Land 40 throws', key: 'grapples', target: 40, reward: { xp: 500, coins: 1200 } },
  { id: 'w_chest6', text: 'Open 6 chests', key: 'chestsOpened', target: 6, reward: { xp: 450, coins: 1000, chest: 'prata' } },
  { id: 'w_dmg30k', text: 'Deal 30,000 damage', key: 'damage', target: 30000, reward: { xp: 550, coins: 1300, gems: 10 } },
];

/** Desafios permanentes e muito difíceis que desbloqueiam as skins mais raras. */
export const LEGENDARY: MissionDef[] = [
  { id: 'l_streak5', text: 'Win 5 fights in a row', key: 'bestStreak', target: 5, reward: { gems: 30, chest: 'ouro' } },
  { id: 'l_level10', text: 'Reach level 10', key: 'level', target: 10, reward: { gems: 40, item: 'hc_arcoiris' } },
  { id: 'l_counter300', text: 'Land 300 counterattacks', key: 'counters', target: 300, reward: { gems: 50, item: 'm_cyber' } },
  { id: 'l_comeback', text: 'Win 10 fights after dropping below 15% health', key: 'comebackWins', target: 10, reward: { gems: 60, item: 'o_gelo' } },
  { id: 'l_streak15', text: 'Win 15 fights in a row', key: 'bestStreak', target: 15, reward: { gems: 80, chest: 'lendario' } },
  { id: 'l_champ25', text: 'Defeat 25 Champions', key: 'championWins', target: 25, reward: { gems: 100, item: 'a_cosmos' } },
  { id: 'l_trophy3500', text: 'Reach the Legend league (3,500 trophies)', key: 'trophies', target: 3500, reward: { gems: 150, item: 'h_coroa' } },
  { id: 'l_superko100', text: 'Finish 100 fights with a Super', key: 'superKOs', target: 100, reward: { gems: 120, item: 's_ira' } },
  { id: 'l_wins500', text: 'Win 500 fights', key: 'wins', target: 500, reward: { gems: 200, item: 'o_cosmos' } },
  { id: 'l_collect', text: 'Collect 60 different items', key: 'collection', target: 60, reward: { gems: 150, item: 'p_bencao' } },
];
