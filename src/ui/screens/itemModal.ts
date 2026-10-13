import { S, buy, canAfford, commit, count, owns, recycle } from '../../core/state';
import { KIND_NAMES, isTradeable, item, type ItemDef } from '../../data/items';
import { RARITIES } from '../../data/rarity';
import { resolveLook } from '../../render/look';
import { sfx } from '../../audio/sfx';
import { render } from '../app';
import { el, esc, fmt, modal, rarityTag, toast, type ModalAction } from '../dom';
import { Preview } from '../preview';
import { clearThumbs } from '../preview';
import { openTrade } from './trade';

export const superSlots = () => 2;
export const passiveSlots = () => 2;
export const beltSlots = () => 3;

export function isEquipped(id: string): boolean {
  const d = item(id);
  const L = S.loadout;
  switch (d.kind) {
    case 'hair':
      return S.appearance.hair === id;
    case 'hairColor':
      return S.appearance.hairColor === id;
    case 'outfit':
      return L.outfit === id;
    case 'gloves':
      return L.gloves === id;
    case 'mask':
      return L.mask === id;
    case 'aura':
      return L.aura === id;
    case 'super':
      return L.supers.includes(id);
    case 'passive':
      return L.passives.includes(id);
    case 'potion':
      return L.belt.includes(id);
  }
}

/** Equipa (ou desequipa, quando faz sentido) um item. */
export function toggleEquip(id: string): void {
  const d = item(id);
  const L = S.loadout;
  const on = isEquipped(id);
  const slotList = (list: string[], max: number) => {
    if (on) {
      if (list.length > 1 || d.kind === 'potion') list.splice(list.indexOf(id), 1);
      else {
        toast('Precisas de ter pelo menos um equipado.', 'info');
        return;
      }
    } else {
      if (list.length >= max) list.shift();
      list.push(id);
    }
  };
  switch (d.kind) {
    case 'hair':
      S.appearance.hair = id;
      break;
    case 'hairColor':
      S.appearance.hairColor = id;
      break;
    case 'outfit':
      L.outfit = id;
      break;
    case 'gloves':
      L.gloves = id;
      break;
    case 'mask':
      L.mask = on ? null : id;
      break;
    case 'aura':
      L.aura = on ? null : id;
      break;
    case 'super':
      slotList(L.supers, superSlots());
      break;
    case 'passive':
      slotList(L.passives, passiveSlots());
      break;
    case 'potion':
      slotList(L.belt, beltSlots());
      break;
  }
  if (d.kind === 'hair' || d.kind === 'hairColor') clearThumbs();
  commit();
}

export function sourceText(d: ItemDef): string {
  switch (d.source) {
    case 'start':
      return 'Item inicial';
    case 'shop':
      return 'Disponível na Loja';
    case 'chest':
      return 'Só sai em Baús';
    case 'mission':
      return 'Recompensa de Desafio Lendário';
    case 'level':
      return `Desbloqueia no nível ${d.unlockLevel}`;
  }
}

export function priceHtml(d: ItemDef, discount = 0): string {
  if (d.gems != null) return `💎 ${fmt(Math.round(d.gems * (1 - discount)))}`;
  if (d.coins != null) return `🪙 ${fmt(Math.round(d.coins * (1 - discount)))}`;
  return '';
}

const VISUAL = ['hair', 'hairColor', 'outfit', 'gloves', 'mask', 'aura'];

export function openItem(id: string, ctx: 'shop' | 'collection', discount = 0): void {
  const d = item(id);
  const r = RARITIES[d.rarity];
  const body = el('div', `item-detail r-${d.rarity}`);
  const art = el('div', 'id-art');
  body.appendChild(art);
  if (VISUAL.includes(d.kind)) {
    const app = { ...S.appearance };
    const lo = { ...S.loadout };
    if (d.kind === 'hair') app.hair = id;
    if (d.kind === 'hairColor') app.hairColor = id;
    if (d.kind === 'outfit') lo.outfit = id;
    if (d.kind === 'gloves') lo.gloves = id;
    if (d.kind === 'mask') lo.mask = id;
    if (d.kind === 'aura') lo.aura = id;
    const p = new Preview(resolveLook(app, lo));
    p.play('taunt', 'happy');
    art.appendChild(p.canvas);
  } else {
    art.appendChild(el('div', 'id-icon', d.icon));
  }
  const n = count(id);
  const info = el('div', 'id-info');
  info.innerHTML = `
    <div class="id-kind">${KIND_NAMES[d.kind]}</div>
    ${rarityTag(d.rarity)}
    <p class="id-desc">${esc(d.desc || 'Personaliza o teu lutador.')}</p>
    <p class="id-src">${sourceText(d)}${n ? ` · Tens <b>${n}</b>` : ''}</p>`;
  body.appendChild(info);

  const actions: ModalAction[] = [];
  if (ctx === 'shop' && (d.coins != null || d.gems != null) && d.source === 'shop') {
    const canStack = d.kind === 'potion';
    if (owns(id) && !canStack) {
      actions.push({ label: 'Já tens ✓', cls: 'btn-ghost', onClick: () => false });
    } else {
      actions.push({
        label: `Comprar ${priceHtml(d, discount)}`,
        cls: 'btn-gold',
        onClick: () => {
          const price = { ...d, coins: d.coins != null ? Math.round(d.coins * (1 - discount)) : undefined, gems: d.gems != null ? Math.round(d.gems * (1 - discount)) : undefined };
          if (!canAfford(price)) {
            toast(d.gems != null ? 'Gemas insuficientes.' : 'Moedas insuficientes.', 'err');
            return false;
          }
          buy(price);
          sfx.coin();
          sfx.reveal(r.tier);
          toast(`${d.name} comprado!`, 'ok');
          render();
        },
      });
    }
  }
  if (owns(id)) {
    const eq = isEquipped(id);
    const removable = ['mask', 'aura', 'super', 'passive', 'potion'].includes(d.kind);
    if (!eq || removable) {
      actions.push({
        label: eq ? 'Desequipar' : d.kind === 'potion' ? 'Pôr no cinto' : 'Equipar',
        cls: eq ? 'btn-ghost' : 'btn-blue',
        onClick: () => {
          toggleEquip(id);
          sfx.click();
          render();
        },
      });
    } else actions.push({ label: 'Equipado ✓', cls: 'btn-ghost', onClick: () => false });
    if (ctx === 'collection') {
      const dup = d.kind === 'potion' ? n >= 1 : n >= 2;
      if (dup) {
        const v = d.kind === 'potion' ? Math.round((d.coins ?? 100) * 0.4) : r.recycle;
        actions.push({
          label: `Reciclar +🪙${fmt(v)}`,
          cls: 'btn-ghost',
          onClick: () => {
            const got = recycle(id);
            if (got) {
              sfx.coin();
              toast(`+${got} moedas`, 'ok');
              render();
            }
          },
        });
      }
      if (isTradeable(d)) {
        actions.push({
          label: '🔁 Trocar',
          cls: 'btn-ghost',
          onClick: () => {
            openTrade(id);
          },
        });
      }
    }
  }
  if (!actions.length) actions.push({ label: 'Fechar' });
  modal(`${d.icon} ${esc(d.name)}`, body, actions, 'item-modal');
}
