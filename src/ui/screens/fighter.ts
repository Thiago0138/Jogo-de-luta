import { S, commit, levelRewardChest, owns } from '../../core/state';
import { ITEM_LIST, item, type ItemKind } from '../../data/items';
import { CHESTS } from '../../data/chests';
import { RARITIES } from '../../data/rarity';
import { MAX_LEVEL, STATS, STAT_CAP, STAT_START, maxHp, powerRating, xpToNext, type StatId } from '../../data/stats';
import { resolveLook } from '../../render/look';
import { sfx } from '../../audio/sfx';
import { render } from '../app';
import { el, esc, fmt, modal, toast } from '../dom';
import { Preview, itemThumb } from '../preview';
import { openCreator } from './creator';
import { beltSlots, isEquipped, openItem, passiveSlots, superSlots, toggleEquip } from './itemModal';

const TABS = [
  { id: 'stats', name: '📊 Atributos' },
  { id: 'gear', name: '🎽 Equipamento' },
  { id: 'road', name: '🛣️ Progressão' },
];

export function renderFighter(page: HTMLElement, sub = 'stats'): void {
  page.innerHTML = `
    <div class="fighter-top">
      <div class="ft-stage"></div>
      <div class="ft-info">
        <h1>${esc(S.name)}</h1>
        <div class="ft-lvl">Nível <b>${S.level}</b>${S.level < MAX_LEVEL ? ` · ${fmt(S.xp)}/${fmt(xpToNext(S.level))} XP` : ' · MÁX'}</div>
        <div class="ft-row"><span>❤️ ${fmt(maxHp(S.level, S.stats.vit))} vida</span><span>⚡ ${fmt(powerRating(S.level, S.stats))} poder</span></div>
        <button class="btn btn-ghost sm edit">✏️ Editar aparência</button>
      </div>
    </div>
    <div class="seg"></div>
    <div class="f-body"></div>`;
  const p = new Preview(resolveLook(S.appearance, S.loadout));
  page.querySelector('.ft-stage')!.appendChild(p.canvas);
  (page.querySelector('.edit') as HTMLElement).onclick = () => {
    sfx.click();
    openCreator(false);
  };
  const seg = page.querySelector('.seg') as HTMLElement;
  for (const t of TABS) {
    const b = el('button', t.id === sub ? 'on' : '', t.name);
    b.onclick = () => {
      sfx.click();
      renderFighter(page, t.id);
    };
    seg.appendChild(b);
  }
  const body = page.querySelector('.f-body') as HTMLElement;
  if (sub === 'gear') gear(body);
  else if (sub === 'road') road(body);
  else stats(body);
}

function stats(body: HTMLElement): void {
  body.innerHTML = `<div class="pts ${S.statPoints ? 'has' : ''}">Pontos disponíveis: <b>${S.statPoints}</b>${S.statPoints ? '' : ' · ganha mais ao subir de nível'}</div>`;
  const list = el('div', 'stat-list');
  for (const st of STATS) {
    const v = S.stats[st.id];
    const r = el('div', 'stat');
    r.style.setProperty('--sc', st.color);
    r.innerHTML = `<span class="st-ico">${st.icon}</span>
      <div class="st-main"><div class="st-top"><b>${st.name}</b><span class="st-v">${v}</span></div>
      <div class="st-bar"><i style="transform:scaleX(${v / STAT_CAP})"></i></div>
      <small>${st.desc}</small></div>`;
    const plus = el('button', 'st-plus', '+');
    plus.disabled = S.statPoints <= 0 || v >= STAT_CAP;
    plus.onclick = () => add(st.id);
    r.appendChild(plus);
    list.appendChild(r);
  }
  body.appendChild(list);
  const spent = Object.values(S.stats).reduce((a, b) => a + b - STAT_START, 0);
  if (spent > 0) {
    const reset = el('button', 'btn btn-ghost wide', '↺ Redistribuir pontos (💎 50)');
    reset.onclick = () => {
      modal('Redistribuir pontos', '<p>Todos os pontos gastos voltam a ficar disponíveis. Custa 💎 50.</p>', [
        { label: 'Cancelar' },
        {
          label: 'Redistribuir',
          cls: 'btn-gold',
          onClick: () => {
            if (S.gems < 50) {
              toast('Gemas insuficientes.', 'err');
              return false;
            }
            S.gems -= 50;
            for (const st of STATS) {
              S.statPoints += S.stats[st.id] - STAT_START;
              S.stats[st.id] = STAT_START;
            }
            commit();
            render();
          },
        },
      ]);
    };
    body.appendChild(reset);
  }
}

function add(id: StatId): void {
  if (S.statPoints <= 0 || S.stats[id] >= STAT_CAP) return;
  S.stats[id]++;
  S.statPoints--;
  sfx.click();
  commit();
  render();
}

interface Slot {
  label: string;
  kind: ItemKind;
  id: string | null;
  locked?: number;
}

function gear(body: HTMLElement): void {
  const L = S.loadout;
  const slots: Slot[] = [
    { label: 'Traje', kind: 'outfit', id: L.outfit },
    { label: 'Luvas', kind: 'gloves', id: L.gloves },
    { label: 'Máscara', kind: 'mask', id: L.mask },
    { label: 'Aura', kind: 'aura', id: L.aura },
    { label: 'Penteado', kind: 'hair', id: S.appearance.hair },
    { label: 'Cor do cabelo', kind: 'hairColor', id: S.appearance.hairColor },
  ];
  const abil: Slot[] = [];
  for (let i = 0; i < 2; i++) abil.push({ label: `Super ${i + 1}`, kind: 'super', id: L.supers[i] ?? null, locked: i >= superSlots() ? 8 : undefined });
  for (let i = 0; i < 2; i++) abil.push({ label: `Passiva ${i + 1}`, kind: 'passive', id: L.passives[i] ?? null, locked: i >= passiveSlots() ? 6 : undefined });
  const belt: Slot[] = [];
  const lv = [0, 4, 12];
  for (let i = 0; i < 3; i++) belt.push({ label: `Cinto ${i + 1}`, kind: 'potion', id: L.belt[i] ?? null, locked: i >= beltSlots() ? lv[i] : undefined });

  const section = (title: string, list: Slot[], hint = '') => {
    body.appendChild(el('h3', 'sec', title));
    if (hint) body.appendChild(el('p', 'muted small', hint));
    const g = el('div', 'slots');
    for (const s of list) g.appendChild(slotEl(s));
    body.appendChild(g);
  };
  section('Visual', slots);
  section('Habilidades', abil, 'Os supers são usados quando a barra de Super enche. As passivas estão sempre ativas.');
  section('Cinto de poções', belt, 'Cada poção do cinto é usada automaticamente uma vez por luta, quando é precisa.');
}

function slotEl(s: Slot): HTMLElement {
  const b = el('button', `slot ${s.locked ? 'locked' : ''} ${s.id ? 'r-' + item(s.id).rarity : ''}`);
  const art = el('div', 'slot-art');
  if (s.locked) art.textContent = '🔒';
  else if (s.id) art.appendChild(itemThumb(s.id));
  else art.textContent = '+';
  b.appendChild(art);
  b.appendChild(el('div', 'slot-l', s.locked ? `${s.label} · Nv ${s.locked}` : s.label));
  if (s.id && !s.locked) {
    const d = item(s.id);
    const extra = s.kind === 'potion' ? ` ×${S.owned[s.id] ?? 0}` : '';
    b.appendChild(el('div', 'slot-n', esc(d.name) + extra));
  }
  b.onclick = () => {
    sfx.click();
    if (s.locked) {
      toast(`Desbloqueia no nível ${s.locked}.`, 'info');
      return;
    }
    picker(s);
  };
  return b;
}

function picker(s: Slot): void {
  const list = ITEM_LIST.filter((d) => d.kind === s.kind && owns(d.id)).sort((a, b) => RARITIES[b.rarity].tier - RARITIES[a.rarity].tier);
  const box = el('div', 'picker');
  let close: () => void = () => {};
  if (s.id && ['mask', 'aura', 'super', 'passive', 'potion'].includes(s.kind)) {
    const rm = el('button', 'pick-row none', '✖ Remover deste espaço');
    rm.onclick = () => {
      toggleEquip(s.id!);
      close();
      render();
    };
    box.appendChild(rm);
  }
  for (const d of list) {
    const r = el('button', `pick-row r-${d.rarity} ${isEquipped(d.id) ? 'on' : ''}`);
    const art = el('div', 'pr-art');
    art.appendChild(itemThumb(d.id));
    r.appendChild(art);
    r.appendChild(el('div', 'pr-txt', `<b>${esc(d.name)}${d.kind === 'potion' ? ` ×${S.owned[d.id]}` : ''}</b><small>${esc(d.desc)}</small>`));
    r.onclick = () => {
      if (s.kind === 'super' || s.kind === 'passive' || s.kind === 'potion') {
        const arr = s.kind === 'super' ? S.loadout.supers : s.kind === 'passive' ? S.loadout.passives : S.loadout.belt;
        if (arr.includes(d.id)) {
          close();
          return;
        }
        const idx = s.id ? arr.indexOf(s.id) : -1;
        if (idx >= 0) arr[idx] = d.id;
        else arr.push(d.id);
        commit();
      } else if (!isEquipped(d.id)) toggleEquip(d.id);
      sfx.click();
      close();
      render();
    };
    r.oncontextmenu = (e) => {
      e.preventDefault();
      openItem(d.id, 'collection');
    };
    box.appendChild(r);
  }
  if (!list.length) box.appendChild(el('p', 'muted', 'Ainda não tens itens deste tipo. Procura na Loja ou em Baús!'));
  close = modal(`Escolher: ${s.label}`, box, [], 'picker-modal');
}

function road(body: HTMLElement): void {
  body.appendChild(el('p', 'muted small', 'A cada nível ganhas 3 pontos de atributo, 5 gemas e mais vida. Alguns níveis desbloqueiam habilidades, espaços e skins.'));
  const list = el('div', 'road');
  const unlocks = new Map<number, string[]>();
  for (const d of ITEM_LIST) if (d.source === 'level' && d.unlockLevel) unlocks.set(d.unlockLevel, [...(unlocks.get(d.unlockLevel) ?? []), `${d.icon} ${d.name}`]);
  const slotsAt: Record<number, string> = { 4: '🧪 2.º espaço do cinto', 6: '✨ 2.ª passiva', 8: '⚡ 2.º super', 12: '🧪 3.º espaço do cinto' };
  for (let lv = 2; lv <= Math.min(MAX_LEVEL, Math.max(S.level + 12, 32)); lv++) {
    const rewards: string[] = [];
    for (const u of unlocks.get(lv) ?? []) rewards.push(u);
    if (slotsAt[lv]) rewards.push(slotsAt[lv]);
    const c = levelRewardChest(lv);
    if (c) rewards.push(`🎁 ${CHESTS[c].name}`);
    if (!rewards.length) continue;
    const r = el('div', `road-step ${S.level >= lv ? 'got' : ''} ${S.level + 1 === lv ? 'next' : ''}`);
    r.innerHTML = `<span class="rs-lv">${lv}</span><div class="rs-r">${rewards.map((x) => `<span>${esc(x)}</span>`).join('')}</div>${S.level >= lv ? '<span class="rs-ok">✓</span>' : ''}`;
    list.appendChild(r);
  }
  body.appendChild(list);
}
