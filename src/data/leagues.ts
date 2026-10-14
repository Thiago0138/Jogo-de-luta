import type { ChestId } from './chests';

export interface League {
  id: string;
  name: string;
  min: number;
  color: string;
  icon: string;
  reward: ChestId;
}

export const LEAGUES: League[] = [
  { id: 'bronze', name: 'Bronze', min: 0, color: '#cd8a4a', icon: '', reward: 'bronze' },
  { id: 'prata', name: 'Silver', min: 300, color: '#cfd8e3', icon: '', reward: 'prata' },
  { id: 'ouro', name: 'Gold', min: 700, color: '#ffd23d', icon: '', reward: 'ouro' },
  { id: 'platina', name: 'Platinum', min: 1200, color: '#7af0e0', icon: '', reward: 'ouro' },
  { id: 'diamante', name: 'Diamond', min: 1800, color: '#6ab8ff', icon: '', reward: 'lendario' },
  { id: 'mestre', name: 'Master', min: 2600, color: '#c77dff', icon: '', reward: 'lendario' },
  { id: 'lenda', name: 'Legend', min: 3500, color: '#ff3d6e', icon: '', reward: 'mitico' },
];

export function leagueIndex(trophies: number): number {
  let i = 0;
  for (let k = 0; k < LEAGUES.length; k++) if (trophies >= LEAGUES[k].min) i = k;
  return i;
}

export function leagueOf(trophies: number): League {
  return LEAGUES[leagueIndex(trophies)];
}
