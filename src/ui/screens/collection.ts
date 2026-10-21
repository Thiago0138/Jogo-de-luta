import { go, rememberSub } from '../app';
import { duplicateCount, shards } from '../../core/forge';
import { S, collectibleTotal, collectionCount, owns } from '../../core/state';
import { ITEM_LIST, type ItemKind } from '../../data/items';
import { RARITIES, RARITY_ORDER, type Rarity } from '../../data/rarity';
import { sfx } from '../../audio/sfx';
import { el, fmt } from '../dom';
import { itemCard } from './cards';
import { openItem } from './itemModal';
import { openTrade } from './trade';
import { ico } from '../icons';

const FILTERS: { id: string; name: string; kinds: ItemKind[] }[] = [
  { id: 'all', name: 'All', kinds: [] },
  { id: 'outfit', name: 'Outfits', kinds: ['outfit'] },
  { id: 'gear', name: 'Gloves & Masks', kinds: ['gloves', 'mask'] },
  { id: 'aura', name: 'Auras', kinds: ['aura'] },
  { id: 'hair', name: 'Hair', kinds: ['hair', 'hairColor'] },
  { id: 'super', name: 'Supers', kinds: ['super'] },
  { id: 'passive', name: 'Passives', kinds: ['passive'] },
  { id: 'move', name: 'Moves', kinds: ['move', 'moveStyle'] },
  { id: 'taunt', name: 'Taunts', kinds: ['taunt'] },
  { id: 'entrance', name: 'Entrances', kinds: ['entrance'] },
  { id: 'arena', name: 'Arenas', kinds: ['arena'] },
];

let onlyOwned = false;
let rarF: Rarity | null = null;

export function renderCollection(page: HTMLElement, sub = 'all'): void {
  rememberSub(sub);
  const f = FILTERS.find((x) => x.id === sub) ?? FILTERS[0];
  const have = collectionCount();
  const total = collectibleTotal();
  page.innerHTML = `
    <div class="page-head"><h1>Collection</h1><button class="btn btn-gold sm forge-btn">${ico('anvil')} Forge <span class="fb-sh">${ico('shard')}${fmt(shards())}</span>${duplicateCount() ? `<i class="fb-dot">${duplicateCount()}</i>` : ''}</button><button class="btn btn-blue sm trade-btn">${ico('swap')} Trades</button></div>
    <div class="card coll-head">
      <div class="ch-top"><b>${have}</b><span>/ ${total} items collected</span><em class="ch-pct">${Math.floor((have / total) * 100)}%</em></div>
      <div class="ch-bar"><i style="transform:scaleX(${have / total})"></i></div>
      <div class="rar-legend"></div>
      ${rarF ? '' : '<small class="rl-hint">Tap a rarity to show only those items</small>'}
    </div>
    <div class="seg scroll"></div>
    ${rarF ? `<p class="muted small rar-note">Showing only <b class="rar-${rarF}">${RARITIES[rarF].name}</b> items · tap it again to show all</p>` : ''}
    <label class="toggle"><input type="checkbox" ${onlyOwned ? 'checked' : ''}/> Show owned only</label>
    <div class="grid coll-grid"></div>`;
  (page.querySelector('.forge-btn') as HTMLElement).onclick = () => {
    sfx.click();
    go('forge');
  };
  (page.querySelector('.trade-btn') as HTMLElement).onclick = () => {
    sfx.click();
    openTrade();
  };
  const legend = page.querySelector('.rar-legend') as HTMLElement;
  legend.classList.toggle('filtering', !!rarF);
  for (const r of RARITY_ORDER) {
    const all = ITEM_LIST.filter((d) => d.rarity === r);
    const got = all.filter((d) => owns(d.id)).length;
    const b = el('button', `rl rar-${r} ${rarF === r ? 'on' : ''} ${got && got === all.length ? 'full' : ''}`, `<span class="rl-name">${RARITIES[r].name}</span><span class="rl-n">${got}/${all.length}</span><i class="rl-bar" style="transform:scaleX(${all.length ? got / all.length : 0})"></i>`);
    b.title = `Show only ${RARITIES[r].name} items`;
    b.onclick = () => {
      sfx.click();
      rarF = rarF === r ? null : r;
      renderCollection(page, f.id);
    };
    legend.appendChild(b);
  }
  const seg = page.querySelector('.seg') as HTMLElement;
  for (const x of FILTERS) {
    const b = el('button', x.id === f.id ? 'on' : '', x.name);
    b.onclick = () => {
      sfx.click();
      renderCollection(page, x.id);
    };
    seg.appendChild(b);
  }
  const chk = page.querySelector('.toggle input') as HTMLInputElement;
  chk.onchange = () => {
    onlyOwned = chk.checked;
    renderCollection(page, f.id);
  };
  const grid = page.querySelector('.coll-grid') as HTMLElement;
  const list = ITEM_LIST.filter((d) => (f.kinds.length ? f.kinds.includes(d.kind) : true))
    .filter((d) => !onlyOwned || owns(d.id))
    .filter((d) => !rarF || d.rarity === rarF)
    .sort((a, b) => Number(owns(b.id)) - Number(owns(a.id)) || RARITIES[b.rarity].tier - RARITIES[a.rarity].tier);
  for (const d of list) {
    const c = itemCard(d.id);
    c.onclick = () => {
      sfx.click();
      openItem(d.id, owns(d.id) ? 'collection' : 'shop');
    };
    grid.appendChild(c);
  }
  if (!list.length) {
    const empty = el('div', 'coll-empty', `${ico('chest')}<b>Nothing here yet</b><span>Open chests, level up or visit the Shop to collect items like these.</span><button class="btn btn-gold sm">${ico('shop')} Go to Shop</button>`);
    (empty.querySelector('button') as HTMLElement).onclick = () => {
      sfx.click();
      go('shop');
    };
    grid.appendChild(empty);
  }
  void S;
}
