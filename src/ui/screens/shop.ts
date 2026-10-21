import { openDropRates, pct, perReward } from '../dropRates';
import { S, buyChest, commit, owns } from '../../core/state';
import { dayKey, hashStr, seeded, shuffle } from '../../core/rng';
import { CHESTS, CHEST_ORDER } from '../../data/chests';
import { ITEM_LIST, type ItemKind } from '../../data/items';
import { RARITIES } from '../../data/rarity';
import { sfx } from '../../audio/sfx';
import { render, rememberSub } from '../app';
import { openChest } from '../chest';
import { el, esc, fmt, modal, timeLeft, toast } from '../dom';
import { itemCard } from './cards';
import { chestSvg } from './home';
import { openItem } from './itemModal';
import { ico } from '../icons';

const TABS: { id: string; name: string }[] = [
  { id: 'featured', name: `${ico('star')} Featured` },
  { id: 'skins', name: `${ico('shirt')} Skins` },
  { id: 'moves', name: `${ico('moves')} Moves` },
  { id: 'entrances', name: `${ico('entrance')} Entrances` },
  { id: 'arenas', name: `${ico('ring')} Arenas` },
  { id: 'abilities', name: `${ico('abilities')} Abilities` },
  { id: 'chests', name: `${ico('chest')} Chests` },
  { id: 'gems', name: `${ico('gem')} Gems` },
];

const SKIN_KINDS: ItemKind[] = ['outfit', 'gloves', 'mask', 'aura', 'hair', 'hairColor'];

function shopItems(kinds: ItemKind[]) {
  return ITEM_LIST.filter((d) => d.source === 'shop' && kinds.includes(d.kind)).sort((a, b) => RARITIES[a.rarity].tier - RARITIES[b.rarity].tier);
}

/** 6 itens em destaque por dia (iguais durante o dia), um deles com desconto. */
export function featured(): { id: string; discount: number }[] {
  const r = seeded(hashStr('loja' + dayKey() + S.partnerSeed));
  const pool = ITEM_LIST.filter((d) => d.source === 'shop');
  const unowned = shuffle(pool.filter((d) => !owns(d.id)), r);
  const rest = shuffle(pool.filter((d) => owns(d.id)), r);
  const pick = [...unowned, ...rest].slice(0, 6);
  return pick.map((d, i) => ({ id: d.id, discount: i === 0 ? 0.3 : 0 }));
}

export function renderShop(page: HTMLElement, sub = 'featured'): void {
  rememberSub(sub);
  if (!TABS.some((t) => t.id === sub)) sub = 'featured';
  page.innerHTML = `<div class="page-head"><h1>Shop</h1></div><div class="seg"></div><div class="shop-body"></div>`;
  const seg = page.querySelector('.seg') as HTMLElement;
  for (const t of TABS) {
    const b = el('button', t.id === sub ? 'on' : '', t.name);
    if (t.id === 'featured' && S.giftDay !== dayKey()) b.appendChild(el('i', 'seg-dot', '1'));
    b.onclick = () => {
      sfx.click();
      renderShop(page, t.id);
    };
    seg.appendChild(b);
  }
  const body = page.querySelector('.shop-body') as HTMLElement;
  const grid = (ids: { id: string; discount: number }[]) => {
    const g = el('div', 'grid');
    for (const { id, discount } of ids) {
      const c = itemCard(id, { shop: true, discount });
      c.onclick = () => {
        sfx.click();
        openItem(id, 'shop', discount);
      };
      g.appendChild(c);
    }
    return g;
  };

  switch (sub) {
    case 'featured': {
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      body.appendChild(el('div', 'banner-info', `${ico('clock')} New picks in <b>${timeLeft(midnight.getTime() - Date.now())}</b>`));
      body.appendChild(dailyGift());
      body.appendChild(grid(featured()));
      break;
    }
    case 'skins':
      for (const k of SKIN_KINDS) {
        const list = shopItems([k]);
        if (!list.length) continue;
        body.appendChild(el('h3', 'sec', { outfit: 'Outfits', gloves: 'Gloves', mask: 'Masks', aura: 'Auras', hair: 'Premium hairstyles', hairColor: 'Hair colors' }[k as string] ?? k));
        body.appendChild(grid(list.map((d) => ({ id: d.id, discount: 0 }))));
      }
      break;
    case 'moves': {
      body.appendChild(el('p', 'muted small', 'Signature moves unlock as you level up, but you can train them with coins up to 3 levels early. Gem styles only change the show — the damage stays the same.'));
      body.appendChild(el('h3', 'sec', 'Move training'));
      body.appendChild(grid(ITEM_LIST.filter((d) => d.kind === 'move').map((d) => ({ id: d.id, discount: 0 }))));
      body.appendChild(el('h3', 'sec', 'Move styles'));
      body.appendChild(grid(shopItems(['moveStyle']).map((d) => ({ id: d.id, discount: 0 }))));
      body.appendChild(el('h3', 'sec', 'Crowd taunts'));
      body.appendChild(el('p', 'muted small', 'Play to the crowd to charge your Super. Equip 2 and your fighter picks one each time.'));
      body.appendChild(grid(shopItems(['taunt']).map((d) => ({ id: d.id, discount: 0 }))));
      break;
    }
    case 'entrances':
      body.appendChild(el('p', 'muted small', 'Make a grand entrance: dance moves, smoke, lasers, pyro and fireworks before every fight.'));
      body.appendChild(grid(shopItems(['entrance']).map((d) => ({ id: d.id, discount: 0 }))));
      break;
    case 'arenas':
      body.appendChild(el('p', 'muted small', 'Take your fights somewhere new. Your equipped arena is where all your fights happen — tap one to watch a live fight in it.'));
      body.appendChild(grid(shopItems(['arena']).map((d) => ({ id: d.id, discount: 0 }))));
      break;
    case 'abilities':
      body.appendChild(el('h3', 'sec', 'Super moves'));
      body.appendChild(grid(shopItems(['super']).map((d) => ({ id: d.id, discount: 0 }))));
      body.appendChild(el('h3', 'sec', 'Passives'));
      body.appendChild(grid(shopItems(['passive']).map((d) => ({ id: d.id, discount: 0 }))));
      body.appendChild(el('p', 'muted small', 'More rare abilities drop from chests, unlock as you level up or are rewards for Legendary Challenges.'));
      break;
    case 'chests': {
      const g = el('div', 'chest-shop');
      for (const id of CHEST_ORDER) {
        const c = CHESTS[id];
        if (c.coinPrice == null && c.gemPrice == null) continue;
        const card = el('div', 'chest-offer');
        card.style.setProperty('--cg', c.glow);
        const price = c.gemPrice != null ? `${ico('gem')} ${fmt(c.gemPrice)}` : `${ico('coin')} ${fmt(c.coinPrice!)}`;
        const short = c.gemPrice != null ? S.gems < c.gemPrice : S.coins < (c.coinPrice ?? 0);
        card.innerHTML = `<div class="co-art">${chestSvg(c.body, c.trim)}</div><b>${esc(c.name)}</b><span class="muted small">${esc(c.desc)}</span><div class="odds"></div><button class="btn btn-ghost sm dr-btn">${ico('info')} Drop rates</button><button class="btn ${short ? 'btn-ghost short' : 'btn-gold'} sm buy">${price}</button>`;
        const odds = card.querySelector('.odds') as HTMLElement;
        odds.innerHTML = perReward(c)
          .map(([r, p]) => `<span class="rar rar-${r}">${RARITIES[r].name} ${pct(p)}</span>`)
          .join('');
        (card.querySelector('.dr-btn') as HTMLElement).onclick = () => {
          sfx.click();
          openDropRates(id);
        };
        (card.querySelector('.buy') as HTMLElement).onclick = () => {
          if (!buyChest(id)) {
            toast(c.gemPrice != null ? 'Not enough gems.' : 'Not enough coins.', 'err');
            return;
          }
          sfx.coin();
          openChest(id, () => render());
        };
        g.appendChild(card);
      }
      body.appendChild(g);
      break;
    }
    case 'gems':
      body.appendChild(gemsTab());
      break;
  }
}

function dailyGift(): HTMLElement {
  const today = dayKey();
  const claimed = S.giftDay === today;
  const box = el('div', `gift ${claimed ? 'done' : 'ready'}`);
  box.innerHTML = `<span class="gift-ico">${ico('gift')}</span><div><b>Daily gift</b><span>${ico('coin')} 150 + ${ico('gem')} 5 · free every day</span></div><button class="btn ${claimed ? 'btn-ghost' : 'btn-gold pulse'} sm">${claimed ? `${ico('check')} More tomorrow` : 'Claim'}</button>`;
  (box.querySelector('button') as HTMLElement).onclick = () => {
    if (S.giftDay === today) return;
    S.giftDay = today;
    S.coins += 150;
    S.gems += 5;
    commit();
    sfx.coin();
    toast('+150 coins  ·  +5 gems', 'ok');
    render();
  };
  return box;
}

const PACKS = [
  { gems: 100, price: '$0.99', bonus: '' },
  { gems: 550, price: '$4.99', bonus: '+10%' },
  { gems: 1200, price: '$9.99', bonus: '+20%' },
  { gems: 2600, price: '$19.99', bonus: '+30%' },
  { gems: 7000, price: '$49.99', bonus: '+40%' },
  { gems: 15000, price: '$99.99', bonus: 'Best value' },
];

function gemsTab(): HTMLElement {
  const box = el('div', 'gems-tab');
  box.innerHTML = `<p class="muted small">Gems unlock premium skins and abilities. You also earn gems by leveling up, from weekly missions, challenges and chests.</p>`;
  const g = el('div', 'gem-grid');
  PACKS.forEach((p, i) => {
    const b = el('button', 'gem-pack');
    b.innerHTML = `${p.bonus ? `<span class="gp-bonus">${p.bonus}</span>` : ''}<div class="gp-ico">${ico('gem').repeat(Math.min(3, 1 + Math.floor(i / 2)))}</div><b>${fmt(p.gems)}</b><span class="gp-price">${p.price}</span>`;
    b.onclick = () => {
      sfx.click();
      modal(
        'Gem Shop',
        '<p>Real-money purchases are not available in this version yet.</p><p class="muted small">When the shop opens, purchases will be handled by a secure payment provider.</p>',
      );
    };
    g.appendChild(b);
  });
  box.appendChild(g);
  return box;
}
