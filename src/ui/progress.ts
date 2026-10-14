import { S, levelRewardChest, owns } from '../core/state';
import { ITEM_LIST, KIND_NAMES, MOVE_SLOT3_LEVEL, SUPER2_LEVEL, PASSIVE2_LEVEL, type ItemDef } from '../data/items';
import { CHESTS, type ChestId } from '../data/chests';
import { RARITIES } from '../data/rarity';
import { LEAGUES, leagueIndex } from '../data/leagues';
import { MAX_LEVEL, POINTS_PER_LEVEL, maxHp } from '../data/stats';
import { sfx } from '../audio/sfx';
import { el, esc, fmt, modal } from './dom';
import { ico, leagueBadge } from './icons';
import { openItem } from './screens/itemModal';
import { chestSvg } from './screens/home';
import { openDropRates } from './dropRates';

export function levelUnlocks(lv: number): ItemDef[] {
  return ITEM_LIST.filter((d) => d.source === 'level' && d.unlockLevel === lv);
}

export function levelSlots(lv: number): string[] {
  const s: string[] = [];
  if (lv === PASSIVE2_LEVEL) s.push(`${ico('abilities')} 2nd passive slot`);
  if (lv === SUPER2_LEVEL) s.push(`${ico('bolt')} 2nd super slot`);
  if (lv === MOVE_SLOT3_LEVEL) s.push(`${ico('moves')} 3rd move slot`);
  return s;
}

function chestRow(id: ChestId, note: string): HTMLElement {
  const c = CHESTS[id];
  const b = el('button', 'pr-row pr-chest', `<span class="pr-art">${chestSvg(c.body, c.trim)}</span><span class="pr-t"><b>${esc(c.name)}</b><small>${esc(note)} · tap to see drop rates</small></span>`);
  b.onclick = () => {
    sfx.click();
    openDropRates(id);
  };
  return b;
}

function itemRow(d: ItemDef): HTMLElement {
  const b = el('button', `pr-row rar-${d.rarity}`, `<span class="pr-ic">${ico(d.kind === 'super' ? 'bolt' : d.kind === 'passive' ? 'abilities' : d.kind === 'move' || d.kind === 'moveStyle' ? 'moves' : 'star')}</span><span class="pr-t"><b>${esc(d.name)}</b><small>${RARITIES[d.rarity].name} ${esc(KIND_NAMES[d.kind] ?? d.kind)} · tap to preview</small></span>${owns(d.id) ? `<span class="pr-ok">${ico('check')}</span>` : ''}`);
  b.onclick = () => {
    sfx.click();
    openItem(d.id, owns(d.id) ? 'collection' : 'shop');
  };
  return b;
}

/** Tudo o que se ganha exatamente ao chegar a um nível. */
export function openLevelReward(lv: number): void {
  const box = el('div', 'pr-list');
  const got = S.level >= lv;
  box.appendChild(el('p', `pr-state ${got ? 'ok' : ''}`, got ? `${ico('check')} Already unlocked` : S.level + 1 === lv ? 'Next level!' : `${lv - S.level} levels to go`));
  const base = (h: string, t: string, s: string) => box.appendChild(el('div', 'pr-row', `<span class="pr-ic">${ico(h)}</span><span class="pr-t"><b>${t}</b><small>${s}</small></span>`));
  base('star', `+${POINTS_PER_LEVEL} stat points`, 'Spend them on Power, Speed, Vitality and more');
  base('gem', '+5 gems', 'Added to your wallet straight away');
  base('heart', `+${fmt(maxHp(lv, 0) - maxHp(lv - 1, 0))} base health`, `Max HP rises with every level (${fmt(maxHp(lv, S.stats.vit))} HP with your current Vitality)`);
  for (const s of levelSlots(lv)) box.appendChild(el('div', 'pr-row pr-hl', `<span class="pr-t"><b>${s}</b><small>Equip one more in the Gear tab</small></span>`));
  for (const d of levelUnlocks(lv)) box.appendChild(itemRow(d));
  const c = levelRewardChest(lv);
  if (c) box.appendChild(chestRow(c, 'Free chest'));
  modal(`${ico('road')} Level ${lv} rewards`, box);
}

/** Escada das ligas com o baú que cada uma dá na primeira vez. */
export function openLeagues(): void {
  const box = el('div', 'pr-list');
  const cur = leagueIndex(S.trophies);
  box.appendChild(el('p', 'muted small', 'Win fights to earn trophies. The first time you reach a league you get its chest.'));
  LEAGUES.forEach((L, i) => {
    const c = CHESTS[L.reward];
    const reached = S.bestLeague >= i;
    const r = el('button', `pr-row pr-lg ${i === cur ? 'cur' : ''} ${reached ? 'got' : ''}`);
    r.style.setProperty('--lc', L.color);
    r.innerHTML = `<span class="pr-art">${leagueBadge(L.id, L.color)}</span><span class="pr-t"><b>${esc(L.name)}</b><small>${ico('trophy')} ${fmt(L.min)}+ trophies${i === cur ? ' · you are here' : ''}</small></span><span class="pr-rw">${chestSvg(c.body, c.trim)}<small>${esc(c.name.replace(/ Chest$/, ''))}</small></span>${reached ? `<span class="pr-ok">${ico('check')}</span>` : ''}`;
    r.onclick = () => {
      sfx.click();
      openDropRates(L.reward);
    };
    box.appendChild(r);
  });
  modal(`${ico('trophy')} Leagues`, box);
}

export const ROAD_MAX = MAX_LEVEL;
