import { coversHead } from '../../render/costume';
import { S, buy, canAfford, canBuyEarly, commit, count, grant, owns, recycle } from '../../core/state';
import { KIND_NAMES, MOVE_SLOTS, isTradeable, item, type ItemDef } from '../../data/items';
import { RARITIES } from '../../data/rarity';
import { resolveLook } from '../../render/look';
import { sfx } from '../../audio/sfx';
import { render } from '../app';
import { el, esc, fmt, modal, rarityTag, toast, type ModalAction } from '../dom';
import { EntrancePreview, ItemDemo } from '../entrancePreview';
import { Preview, itemThumb } from '../preview';
import { clearThumbs } from '../preview';
import { openTrade } from './trade';
import { ico } from '../icons';

export const superSlots = () => 2;
export const passiveSlots = () => 2;

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
    case 'entrance':
      return L.entrance === id;
    case 'move':
      return L.moves.includes(id);
    case 'moveStyle':
      return L.styles.includes(id);
  }
}

/** Equipa (ou desequipa, quando faz sentido) um item. */
export function toggleEquip(id: string): void {
  const d = item(id);
  const L = S.loadout;
  const on = isEquipped(id);
  const slotList = (list: string[], max: number) => {
    if (on) {
      if (list.length > 1) list.splice(list.indexOf(id), 1);
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
    case 'entrance':
      L.entrance = id;
      break;
    case 'move':
      if (on) L.moves.splice(L.moves.indexOf(id), 1);
      else {
        if (L.moves.length >= MOVE_SLOTS) {
          toast(`Só podes ter ${MOVE_SLOTS} golpes equipados. Tira um primeiro.`, 'info');
          return;
        }
        L.moves.push(id);
      }
      break;
    case 'moveStyle':
      if (on) L.styles.splice(L.styles.indexOf(id), 1);
      else {
        const tgt = d.vis?.type;
        L.styles = L.styles.filter((x) => item(x).vis?.type !== tgt);
        L.styles.push(id);
      }
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
  if (d.gems != null) return `${ico('gem')} ${fmt(Math.round(d.gems * (1 - discount)))}`;
  if (d.coins != null) return `${ico('coin')} ${fmt(Math.round(d.coins * (1 - discount)))}`;
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
    // para ver o cabelo, a cor ou a máscara, tira um traje que tape a cabeça
    if ((d.kind === 'hair' || d.kind === 'hairColor' || d.kind === 'mask') && coversHead(lo.outfit)) lo.outfit = 'o_classico';
    const p = new Preview(resolveLook(app, lo), { turn: true, spin: true });
    p.play('taunt', 'happy');
    art.appendChild(p.canvas);
  } else if (d.kind === 'entrance') {
    // a entrada completa, em ciclo, com o teu lutador (pára sozinha ao fechar o modal)
    art.classList.add('id-ent');
    art.appendChild(new EntrancePreview(id).el);
    art.appendChild(el('div', 'id-badge', ico('entrance')));
  } else {
    if (d.kind === 'move' || d.kind === 'moveStyle' || d.kind === 'super' || d.kind === 'passive') {
      // demonstração ao vivo, tal como acontece no ringue
      art.classList.add('id-ent');
      art.appendChild(new ItemDemo(id).el);
    } else {
      const th = itemThumb(id);
      th.classList.add('id-thumb');
      art.appendChild(th);
    }
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
  if (d.kind === 'move' && !owns(id)) {
    if (canBuyEarly(d)) {
      actions.push({
        label: `Treinar já ${ico('coin')} ${fmt(d.coins ?? 0)}`,
        cls: 'btn-gold',
        onClick: () => {
          if (S.coins < (d.coins ?? 0)) {
            toast('Moedas insuficientes.', 'err');
            return false;
          }
          S.coins -= d.coins ?? 0;
          grant(id);
          if (S.loadout.moves.length < MOVE_SLOTS) S.loadout.moves.push(id);
          commit();
          sfx.coin();
          toast(`${d.name} aprendido!`, 'ok');
          render();
        },
      });
    } else {
      actions.push({ label: `Nível ${d.unlockLevel} (compra a partir do ${Math.max(1, (d.unlockLevel ?? 1) - 3)})`, cls: 'btn-ghost', onClick: () => false });
    }
  }
  if (ctx === 'shop' && (d.coins != null || d.gems != null) && d.source === 'shop') {
    if (owns(id)) {
      actions.push({ label: `Já tens ${ico('check')}`, cls: 'btn-ghost', onClick: () => false });
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
    const removable = ['mask', 'aura', 'super', 'passive', 'move', 'moveStyle'].includes(d.kind);
    if (!eq || removable) {
      actions.push({
        label: eq ? 'Desequipar' : 'Equipar',
        cls: eq ? 'btn-ghost' : 'btn-blue',
        onClick: () => {
          toggleEquip(id);
          sfx.click();
          render();
        },
      });
    } else actions.push({ label: `Equipado ${ico('check')}`, cls: 'btn-ghost', onClick: () => false });
    if (ctx === 'collection') {
      if (n >= 2) {
        const v = r.recycle;
        actions.push({
          label: `Reciclar +${ico('coin')}${fmt(v)}`,
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
          label: `${ico('swap')} Trocar`,
          cls: 'btn-ghost',
          onClick: () => {
            openTrade(id);
          },
        });
      }
    }
  }
  if (!actions.length) actions.push({ label: 'Fechar' });
  modal(esc(d.name), body, actions, 'item-modal');
}
