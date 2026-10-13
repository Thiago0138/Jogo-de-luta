import { S, collectibleTotal, collectionCount, owns } from '../../core/state';
import { ITEM_LIST, type ItemKind } from '../../data/items';
import { RARITIES, RARITY_ORDER } from '../../data/rarity';
import { sfx } from '../../audio/sfx';
import { el } from '../dom';
import { itemCard } from './cards';
import { openItem } from './itemModal';
import { openTrade } from './trade';

const FILTERS: { id: string; name: string; kinds: ItemKind[] }[] = [
  { id: 'all', name: 'Tudo', kinds: [] },
  { id: 'outfit', name: 'Trajes', kinds: ['outfit'] },
  { id: 'gear', name: 'Luvas & Máscaras', kinds: ['gloves', 'mask'] },
  { id: 'aura', name: 'Auras', kinds: ['aura'] },
  { id: 'hair', name: 'Cabelo', kinds: ['hair', 'hairColor'] },
  { id: 'super', name: 'Supers', kinds: ['super'] },
  { id: 'passive', name: 'Passivas', kinds: ['passive'] },
  { id: 'potion', name: 'Poções', kinds: ['potion'] },
];

let onlyOwned = false;

export function renderCollection(page: HTMLElement, sub = 'all'): void {
  const f = FILTERS.find((x) => x.id === sub) ?? FILTERS[0];
  const have = collectionCount();
  const total = collectibleTotal();
  page.innerHTML = `
    <div class="page-head"><h1>Coleção</h1><button class="btn btn-blue sm trade-btn">🔁 Trocas</button></div>
    <div class="card coll-head">
      <div class="ch-top"><b>${have}</b><span>/ ${total} itens colecionados</span></div>
      <div class="ch-bar"><i style="transform:scaleX(${have / total})"></i></div>
      <div class="rar-legend"></div>
    </div>
    <div class="seg scroll"></div>
    <label class="toggle"><input type="checkbox" ${onlyOwned ? 'checked' : ''}/> Mostrar só o que tenho</label>
    <div class="grid coll-grid"></div>`;
  (page.querySelector('.trade-btn') as HTMLElement).onclick = () => {
    sfx.click();
    openTrade();
  };
  const legend = page.querySelector('.rar-legend') as HTMLElement;
  for (const r of RARITY_ORDER) {
    const all = ITEM_LIST.filter((d) => d.rarity === r && d.kind !== 'potion');
    const got = all.filter((d) => owns(d.id)).length;
    legend.appendChild(el('div', `rl rar-${r}`, `<span class="rl-name">${RARITIES[r].name}</span><span class="rl-n">${got}/${all.length}</span>`));
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
    .sort((a, b) => Number(owns(b.id)) - Number(owns(a.id)) || RARITIES[b.rarity].tier - RARITIES[a.rarity].tier);
  for (const d of list) {
    const c = itemCard(d.id);
    c.onclick = () => {
      sfx.click();
      openItem(d.id, owns(d.id) ? 'collection' : 'shop');
    };
    grid.appendChild(c);
  }
  if (!list.length) grid.appendChild(el('p', 'muted', 'Ainda não tens itens nesta categoria.'));
  void S;
}
