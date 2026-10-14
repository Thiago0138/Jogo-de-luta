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
  { id: 'featured', name: `${ico('star')} Destaques` },
  { id: 'skins', name: `${ico('shirt')} Skins` },
  { id: 'moves', name: `${ico('moves')} Golpes` },
  { id: 'entrances', name: `${ico('entrance')} Entradas` },
  { id: 'abilities', name: `${ico('abilities')} Habilidades` },
  { id: 'chests', name: `${ico('chest')} Baús` },
  { id: 'gems', name: `${ico('gem')} Gemas` },
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
  page.innerHTML = `<div class="page-head"><h1>Loja</h1></div><div class="seg"></div><div class="shop-body"></div>`;
  const seg = page.querySelector('.seg') as HTMLElement;
  for (const t of TABS) {
    const b = el('button', t.id === sub ? 'on' : '', t.name);
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
      body.appendChild(el('div', 'banner-info', `${ico('clock')} Nova seleção em <b>${timeLeft(midnight.getTime() - Date.now())}</b>`));
      body.appendChild(dailyGift());
      body.appendChild(grid(featured()));
      break;
    }
    case 'skins':
      for (const k of SKIN_KINDS) {
        const list = shopItems([k]);
        if (!list.length) continue;
        body.appendChild(el('h3', 'sec', { outfit: 'Trajes', gloves: 'Luvas', mask: 'Máscaras', aura: 'Auras', hair: 'Penteados premium', hairColor: 'Cores de cabelo' }[k as string] ?? k));
        body.appendChild(grid(list.map((d) => ({ id: d.id, discount: 0 }))));
      }
      break;
    case 'moves': {
      body.appendChild(el('p', 'muted small', 'Golpes de assinatura: desbloqueiam com o nível, mas podes treiná-los com moedas até 3 níveis antes. Os estilos com gemas só mudam o espetáculo — o dano é igual.'));
      body.appendChild(el('h3', 'sec', 'Treino de golpes'));
      body.appendChild(grid(ITEM_LIST.filter((d) => d.kind === 'move').map((d) => ({ id: d.id, discount: 0 }))));
      body.appendChild(el('h3', 'sec', 'Estilos de golpe'));
      body.appendChild(grid(shopItems(['moveStyle']).map((d) => ({ id: d.id, discount: 0 }))));
      break;
    }
    case 'entrances':
      body.appendChild(el('p', 'muted small', 'Entra no ringue em grande: danças, fumo, lasers, pirotecnia e fogo de artifício antes de cada luta.'));
      body.appendChild(grid(shopItems(['entrance']).map((d) => ({ id: d.id, discount: 0 }))));
      break;
    case 'abilities':
      body.appendChild(el('h3', 'sec', 'Super ataques'));
      body.appendChild(grid(shopItems(['super']).map((d) => ({ id: d.id, discount: 0 }))));
      body.appendChild(el('h3', 'sec', 'Passivas'));
      body.appendChild(grid(shopItems(['passive']).map((d) => ({ id: d.id, discount: 0 }))));
      body.appendChild(el('p', 'muted small', 'Mais habilidades raras saem em baús, sobem com o nível ou são prémios de Desafios Lendários.'));
      break;
    case 'chests': {
      const g = el('div', 'chest-shop');
      for (const id of CHEST_ORDER) {
        const c = CHESTS[id];
        if (c.coinPrice == null && c.gemPrice == null) continue;
        const card = el('div', 'chest-offer');
        card.style.setProperty('--cg', c.glow);
        const price = c.gemPrice != null ? `${ico('gem')} ${fmt(c.gemPrice)}` : `${ico('coin')} ${fmt(c.coinPrice!)}`;
        card.innerHTML = `<div class="co-art">${chestSvg(c.body, c.trim)}</div><b>${esc(c.name)}</b><span class="muted small">${esc(c.desc)}</span><div class="odds"></div><button class="btn btn-gold sm">${price}</button>`;
        const odds = card.querySelector('.odds') as HTMLElement;
        const tot = Object.values(c.weights).reduce((a, b) => a + (b ?? 0), 0);
        odds.innerHTML = Object.entries(c.weights)
          .map(([r, w]) => `<span class="rar rar-${r}">${RARITIES[r as keyof typeof RARITIES].name} ${(((w ?? 0) / tot) * 100).toFixed(w! / tot < 0.01 ? 1 : 0)}%</span>`)
          .join('');
        (card.querySelector('button') as HTMLElement).onclick = () => {
          if (!buyChest(id)) {
            toast(c.gemPrice != null ? 'Gemas insuficientes.' : 'Moedas insuficientes.', 'err');
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
  const box = el('div', `gift ${claimed ? 'done' : ''}`);
  box.innerHTML = `<span class="gift-ico">${ico('gift')}</span><div><b>Presente diário</b><span>150 moedas + 5 gemas</span></div><button class="btn ${claimed ? 'btn-ghost' : 'btn-gold'} sm">${claimed ? 'Amanhã há mais' : 'Recolher'}</button>`;
  (box.querySelector('button') as HTMLElement).onclick = () => {
    if (S.giftDay === today) return;
    S.giftDay = today;
    S.coins += 150;
    S.gems += 5;
    commit();
    sfx.coin();
    toast('+150 moedas  ·  +5 gemas', 'ok');
    render();
  };
  return box;
}

const PACKS = [
  { gems: 100, price: '0,99 €', bonus: '' },
  { gems: 550, price: '4,99 €', bonus: '+10%' },
  { gems: 1200, price: '9,99 €', bonus: '+20%' },
  { gems: 2600, price: '19,99 €', bonus: '+30%' },
  { gems: 7000, price: '49,99 €', bonus: '+40%' },
  { gems: 15000, price: '99,99 €', bonus: 'Melhor valor' },
];

function gemsTab(): HTMLElement {
  const box = el('div', 'gems-tab');
  box.innerHTML = `<p class="muted small">As gemas desbloqueiam skins e habilidades premium. Também ganhas gemas ao subir de nível, em missões semanais, desafios e baús.</p>`;
  const g = el('div', 'gem-grid');
  PACKS.forEach((p, i) => {
    const b = el('button', 'gem-pack');
    b.innerHTML = `${p.bonus ? `<span class="gp-bonus">${p.bonus}</span>` : ''}<div class="gp-ico">${ico('gem').repeat(Math.min(3, 1 + Math.floor(i / 2)))}</div><b>${fmt(p.gems)}</b><span class="gp-price">${p.price}</span>`;
    b.onclick = () => {
      sfx.click();
      modal(
        'Loja de gemas',
        '<p>Os pagamentos com dinheiro real ainda não estão ativos nesta versão.</p><p class="muted small">Quando a loja abrir, as compras serão processadas por um fornecedor de pagamentos seguro.</p>',
      );
    };
    g.appendChild(b);
  });
  box.appendChild(g);
  return box;
}
