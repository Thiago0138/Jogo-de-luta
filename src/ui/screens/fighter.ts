import { S, commit, levelRewardChest, owns, moveSlots } from '../../core/state';
import { ITEM_LIST, MOVE_SLOTS, MOVE_SLOT3_LEVEL, item, type ItemKind } from '../../data/items';
import { CHESTS } from '../../data/chests';
import { RARITIES } from '../../data/rarity';
import { MAX_LEVEL, STATS, STAT_CAP, STAT_START, maxHp, powerRating, xpToNext, type StatId } from '../../data/stats';
import { resolveLook } from '../../render/look';
import { sfx } from '../../audio/sfx';
import { render, rememberSub } from '../app';
import { el, esc, fmt, modal, toast } from '../dom';
import { Preview, itemThumb } from '../preview';
import { openCreator } from './creator';
import { isEquipped, openItem, passiveSlots, superSlots, toggleEquip } from './itemModal';
import { ico } from '../icons';
import { levelSlots, levelUnlocks, openLevelReward } from '../progress';

const TABS = [
  { id: 'stats', name: `${ico('chart')} Stats` },
  { id: 'gear', name: `${ico('shirt')} Gear` },
  { id: 'road', name: `${ico('road')} Progression` },
];

export function renderFighter(page: HTMLElement, sub = 'stats'): void {
  rememberSub(sub);
  page.innerHTML = `
    <div class="fighter-top">
      <div class="ft-stage"></div>
      <div class="ft-info">
        <h1>${esc(S.name)}</h1>
        <div class="ft-lvl">Level <b>${S.level}</b>${S.level < MAX_LEVEL ? ` · ${fmt(S.xp)}/${fmt(xpToNext(S.level))} XP` : ' · MAX'}</div>
        <div class="ft-row"><span>${ico('heart')} ${fmt(maxHp(S.level, S.stats.vit))} HP</span><span>${ico('bolt')} ${fmt(powerRating(S.level, S.stats))} power</span></div>
        <button class="btn btn-ghost sm edit">${ico('edit')} Edit appearance</button>
      </div>
    </div>
    <div class="seg"></div>
    <div class="f-body"></div>`;
  const p = new Preview(resolveLook(S.appearance, S.loadout), { turn: true, key: 'fighter' });
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
  body.innerHTML = `<div class="pts ${S.statPoints ? 'has' : ''}">Points available: <b>${S.statPoints}</b>${S.statPoints ? '' : ' · earn more by leveling up'}</div>`;
  const list = el('div', 'stat-list');
  for (const st of STATS) {
    const v = S.stats[st.id];
    const r = el('div', 'stat');
    r.style.setProperty('--sc', st.color);
    r.innerHTML = `<span class="st-ico">${ico(st.icon)}</span>
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
    const reset = el('button', 'btn btn-ghost wide', `↺ Reset points (${ico('gem')} 50)`);
    reset.onclick = () => {
      modal('Reset points', `<p>All spent points become available again. Costs ${ico('gem')} 50.</p>`, [
        { label: 'Cancel' },
        {
          label: 'Reset',
          cls: 'btn-gold',
          onClick: () => {
            if (S.gems < 50) {
              toast('Not enough gems.', 'err');
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
    { label: 'Outfit', kind: 'outfit', id: L.outfit },
    { label: 'Gloves', kind: 'gloves', id: L.gloves },
    { label: 'Mask', kind: 'mask', id: L.mask },
    { label: 'Aura', kind: 'aura', id: L.aura },
    { label: 'Hairstyle', kind: 'hair', id: S.appearance.hair },
    { label: 'Hair color', kind: 'hairColor', id: S.appearance.hairColor },
    { label: 'Entrance', kind: 'entrance', id: L.entrance },
  ];
  const abil: Slot[] = [];
  for (let i = 0; i < 2; i++) abil.push({ label: `Super ${i + 1}`, kind: 'super', id: L.supers[i] ?? null, locked: i >= superSlots() ? 8 : undefined });
  for (let i = 0; i < 2; i++) abil.push({ label: `Passive ${i + 1}`, kind: 'passive', id: L.passives[i] ?? null, locked: i >= passiveSlots() ? 6 : undefined });

  const section = (title: string, list: Slot[], hint = '') => {
    body.appendChild(el('h3', 'sec', title));
    if (hint) body.appendChild(el('p', 'muted small', hint));
    const g = el('div', 'slots');
    for (const s of list) g.appendChild(slotEl(s));
    body.appendChild(g);
  };
  const moves: Slot[] = [];
  for (let i = 0; i < MOVE_SLOTS; i++) moves.push({ label: `Move ${i + 1}`, kind: 'move', id: L.moves[i] ?? null, locked: i >= moveSlots() ? MOVE_SLOT3_LEVEL : undefined });
  const styles: Slot[] = [{ label: 'Move style', kind: 'moveStyle', id: L.styles[0] ?? null }];
  const taunts: Slot[] = [0, 1].map((i) => ({ label: `Taunt ${i + 1}`, kind: 'taunt' as ItemKind, id: L.taunts[i] ?? null }));
  section('Signature moves', moves, 'The special moves your fighter uses in the ring. They unlock as you level up; you can train them with coins up to 3 levels early.');
  section('Move styles', styles, 'Visual effects for your moves (cosmetic only, same damage).');
  section('Crowd taunts', taunts, 'Your fighter plays to the crowd to charge the Super, picking one of these 2 each time.');
  section('Look', slots);
  section('Arena', [{ label: 'Arena', kind: 'arena', id: L.arena }], 'Where your fights take place. Buy new arenas in the Shop.');
  section('Abilities', abil, 'Supers fire when your Super bar is full. Passives are always active.');
}

function slotEl(s: Slot): HTMLElement {
  const b = el('button', `slot ${s.locked ? 'locked' : ''} ${s.id ? 'r-' + item(s.id).rarity : ''}`);
  const art = el('div', 'slot-art');
  if (s.locked) art.innerHTML = ico('lock', 'ic-big');
  else if (s.id) art.appendChild(itemThumb(s.id));
  else art.textContent = '+';
  b.appendChild(art);
  b.appendChild(el('div', 'slot-l', s.locked ? `${s.label} · Lv ${s.locked}` : s.label));
  if (s.id && !s.locked) {
    const d = item(s.id);
    b.appendChild(el('div', 'slot-n', esc(d.name)));
  }
  b.onclick = () => {
    sfx.click();
    if (s.locked) {
      toast(`Unlocks at level ${s.locked}.`, 'info');
      return;
    }
    picker(s);
  };
  return b;
}

function picker(s: Slot): void {
  const list = ITEM_LIST.filter((d) => d.kind === s.kind && (owns(d.id) || d.kind === 'move'))
    .sort((a, b) => (s.kind === 'move' ? (a.unlockLevel ?? 0) - (b.unlockLevel ?? 0) : RARITIES[b.rarity].tier - RARITIES[a.rarity].tier));
  const box = el('div', 'picker');
  let close: () => void = () => {};
  const visualKinds = ['outfit', 'gloves', 'mask', 'aura', 'hair'];
  if (s.id && !(s.kind === 'hair' && s.id === 'h_careca') && ['outfit', 'gloves', 'mask', 'aura', 'hair', 'super', 'passive', 'move', 'moveStyle', 'taunt'].includes(s.kind)) {
    const label = visualKinds.includes(s.kind) ? `${ico('close')} ${s.kind === 'hair' ? 'No hair (bald)' : s.kind === 'outfit' ? 'No outfit (plain trunks)' : `No ${s.label.toLowerCase()}`}` : `${ico('close')} Remove from this slot`;
    const rm = el('button', 'pick-row none', label);
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
    r.appendChild(el('div', 'pr-txt', `<b>${esc(d.name)}</b><small>${esc(d.desc)}</small>`));
    const locked = d.kind === 'move' && !owns(d.id);
    if (locked) {
      r.classList.add('locked');
      r.appendChild(el('div', 'pr-lock', `${ico('lock')} Lv ${d.unlockLevel}`));
    }
    const equip = () => {
      if (s.kind === 'super' || s.kind === 'passive' || s.kind === 'move' || s.kind === 'taunt') {
        const arr = s.kind === 'super' ? S.loadout.supers : s.kind === 'passive' ? S.loadout.passives : s.kind === 'taunt' ? S.loadout.taunts : S.loadout.moves;
        if (!arr.includes(d.id)) {
          const idx = s.id ? arr.indexOf(s.id) : -1;
          if (idx >= 0) arr[idx] = d.id;
          else arr.push(d.id);
          commit();
        }
      } else if (!isEquipped(d.id)) toggleEquip(d.id);
      close();
      render();
    };
    // abre sempre a pré-visualização (como fica no ringue) e pergunta se quer equipar
    r.onclick = () => {
      sfx.click();
      if (locked) {
        openItem(d.id, 'shop');
        return;
      }
      openItem(d.id, 'collection', 0, { slot: s.label.replace(/ \d$/, '').toLowerCase(), equip });
    };
    box.appendChild(r);
  }
  if (!list.length) box.appendChild(el('p', 'muted', 'You have no items of this type yet. Check the Shop or open Chests!'));
  close = modal(`Choose: ${s.label}`, box, [], 'picker-modal');
}

function road(body: HTMLElement): void {
  body.appendChild(el('p', 'muted small', 'Every level gives you 3 stat points, 5 gems and more health. Tap a level to see exactly what you get.'));
  const list = el('div', 'road');
  let nextEl: HTMLElement | null = null;
  for (let lv = 2; lv <= MAX_LEVEL; lv++) {
    const rewards: string[] = [];
    for (const d of levelUnlocks(lv)) rewards.push(`<span class="rar-${d.rarity}">${esc(d.name)}</span>`);
    for (const x of levelSlots(lv)) rewards.push(`<span>${x}</span>`);
    const c = levelRewardChest(lv);
    if (c) rewards.push(`<span>${ico('chest')} ${esc(CHESTS[c].name)}</span>`);
    rewards.push(`<span class="rs-base">${ico('star')} +3 ${ico('gem')} +5</span>`);
    const r = el('button', `road-step ${S.level >= lv ? 'got' : ''} ${S.level + 1 === lv ? 'next' : ''} ${rewards.length > 1 ? 'big' : ''}`);
    r.innerHTML = `<span class="rs-lv">${lv}</span><div class="rs-r">${rewards.join('')}</div>${S.level >= lv ? `<span class="rs-ok">${ico('check')}</span>` : `<span class="rs-go">›</span>`}`;
    r.onclick = () => {
      sfx.click();
      openLevelReward(lv);
    };
    if (S.level + 1 === lv) nextEl = r;
    list.appendChild(r);
  }
  body.appendChild(list);
  if (nextEl) requestAnimationFrame(() => nextEl?.scrollIntoView({ block: 'center' }));
}
