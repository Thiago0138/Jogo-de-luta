import { count, owns } from '../../core/state';
import { item } from '../../data/items';
import { RARITIES } from '../../data/rarity';
import { el, esc } from '../dom';
import { itemThumb } from '../preview';
import { isEquipped, priceHtml } from './itemModal';
import { ico } from '../icons';

export interface CardOpts {
  shop?: boolean;
  discount?: number;
  hideUnowned?: boolean;
}

export function itemCard(id: string, o: CardOpts = {}): HTMLElement {
  const d = item(id);
  const have = owns(id);
  const n = count(id);
  const locked = !have && !o.shop;
  const c = el('button', `icard r-${d.rarity} ${locked ? 'locked' : ''} ${have && isEquipped(id) ? 'equipped' : ''}`);
  c.dataset.id = id;
  const art = el('div', 'ic-art');
  art.appendChild(itemThumb(id));
  c.appendChild(art);
  if (locked) c.appendChild(el('div', 'ic-lock', ico('lock')));
  const name = el('div', 'ic-name', esc(d.name));
  c.appendChild(name);
  const foot = el('div', 'ic-foot');
  if (o.shop) {
    if (have) foot.innerHTML = `<span class="ic-owned">Owned ${ico('check')}</span>`;
    else {
      const old = o.discount ? `<s>${priceHtml(d)}</s>` : '';
      foot.innerHTML = `${old}<span class="ic-price">${priceHtml(d, o.discount ?? 0)}</span>`;
    }
  } else {
    foot.innerHTML = `<span class="rar-dot" style="--rc:${RARITIES[d.rarity].color}"></span>${RARITIES[d.rarity].name}`;
  }
  c.appendChild(foot);
  if (n > 1) c.appendChild(el('div', 'ic-count', `×${n}`));
  if (o.discount) c.appendChild(el('div', 'ic-sale', `-${Math.round(o.discount * 100)}%`));
  if (have && isEquipped(id)) c.appendChild(el('div', 'ic-eq', 'EQUIPPED'));
  return c;
}
