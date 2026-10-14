import { S, commit, giveReward, legendaryProgress, mission, refreshMissions, type MissionSet } from '../../core/state';
import { LEGENDARY, type MissionDef, type Reward } from '../../data/missions';
import { CHESTS } from '../../data/chests';
import { ITEMS, KIND_NAMES } from '../../data/items';
import { RARITIES } from '../../data/rarity';
import { chestSvg } from './home';
import { itemArt, openItem } from './itemModal';
import { openDropRates } from '../dropRates';
import { owns } from '../../core/state';
import { sfx } from '../../audio/sfx';
import { go, render, rememberSub } from '../app';
import { el, esc, fmt, modal, rarityTag, timeLeft, toast, type ModalAction } from '../dom';
import { ico } from '../icons';

const TABS = [
  { id: 'daily', name: `${ico('sun')} Daily` },
  { id: 'weekly', name: `${ico('calendar')} Weekly` },
  { id: 'legend', name: `${ico('trophy')} Legendary` },
];

function rewardHtml(r: Reward): string {
  const parts: string[] = [];
  if (r.xp) parts.push(`<span class="rw">${ico('xp')} ${fmt(r.xp)}</span>`);
  if (r.coins) parts.push(`<span class="rw">${ico('coin')} ${fmt(r.coins)}</span>`);
  if (r.gems) parts.push(`<span class="rw">${ico('gem')} ${fmt(r.gems)}</span>`);
  if (r.chest) parts.push(`<span class="rw">${ico('chest')} ${esc(CHESTS[r.chest].name)}</span>`);
  if (r.item) {
    const d = ITEMS[r.item];
    parts.push(`<span class="rw rar-${d.rarity} itemrw">${ico('star')} ${esc(d.name)}</span>`);
  }
  return parts.join('');
}

/** Como se progride em cada tipo de missão. */
const HOW: Record<string, string> = {
  fights: 'Every fight counts, win or lose.',
  wins: 'Win fights in any mode (1 vs 1, Tag Team or Champion).',
  tagWins: 'Win Tag Team (2 vs 2) fights.',
  championWins: 'Beat the Champion in Champion mode.',
  punches: 'Every punch that lands counts.',
  grapples: 'Land grapples and throws: slams, suplexes, powerbombs...',
  supers: 'Use your Super when the Super bar is full.',
  superKOs: 'Finish the fight with a Super (the final blow must be your Super).',
  dodges: 'Dodge attacks: the Dodge stat makes your fighter evade more often.',
  counters: 'Counter after dodging or blocking: raise your Counter stat.',
  dives: 'Land aerial attacks: top-rope dives, crossbodies and springboards.',
  perfectWins: 'Win without losing any health.',
  comebackWins: 'Win a fight after dropping below 15% health.',
  chestsOpened: 'Open any chest.',
  damage: 'Total damage dealt across all your fights.',
  level: 'Earn XP in fights and missions to level up.',
  bestStreak: 'Win fights in a row without losing. Your best streak ever counts.',
  trophies: 'Win fights to earn trophies (losing takes some away).',
  collection: 'Collect different items from the Shop, chests and level-ups.',
};

/** Janela com o desafio ao pormenor: progresso, como avançar e tudo o que se recebe. */
function openMission(m: MissionDef, progress: number, claimed: boolean, onClaim: () => void, legendary: boolean): void {
  const done = progress >= m.target;
  const box = el('div', 'md');
  const pct = Math.min(1, progress / m.target);
  box.innerHTML = `
    <div class="md-state ${claimed ? 'ok' : done ? 'ready' : ''}">${claimed ? `${ico('check')} Claimed` : done ? `${ico('gift')} Complete! Claim your reward` : `${Math.floor(pct * 100)}% complete`}</div>
    <div class="m-bar md-bar"><i style="transform:scaleX(${pct})"></i><span>${fmt(Math.min(progress, m.target))} / ${fmt(m.target)}</span></div>
    <p class="muted small">${esc(HOW[m.key] ?? '')}</p>
    <h3 class="sec">You get</h3>
    <div class="md-rw"></div>`;
  const rw = box.querySelector('.md-rw') as HTMLElement;
  const r = m.reward;
  if (r.item) {
    const d = ITEMS[r.item];
    const card = el('div', `md-item r-${d.rarity}`);
    card.appendChild(itemArt(r.item));
    const info = el('div', 'md-info');
    info.innerHTML = `<b class="rar-${d.rarity}">${esc(d.name)}</b><div class="md-tags"><span class="id-kind">${KIND_NAMES[d.kind]}</span>${rarityTag(d.rarity)}</div><p>${esc(d.desc)}</p>
      <p class="muted small">${d.source === 'mission' ? `${ico('lock')} Exclusive: only obtainable by completing this challenge.` : ''}${owns(d.id) ? ` ${ico('check')} You already own it.` : ''}</p>`;
    const more = el('button', 'btn btn-ghost sm', `${ico('eye')} Full preview`);
    more.onclick = () => {
      sfx.click();
      openItem(d.id, owns(d.id) ? 'collection' : 'shop');
    };
    info.appendChild(more);
    card.appendChild(info);
    rw.appendChild(card);
    void RARITIES;
  }
  const line = (icon: string, title: string, sub: string) => rw.appendChild(el('div', 'pr-row', `<span class="pr-ic">${ico(icon)}</span><span class="pr-t"><b>${title}</b><small>${sub}</small></span>`));
  if (r.gems) line('gem', `${fmt(r.gems)} gems`, 'Spend them in the Shop on chests, outfits and entrances');
  if (r.coins) line('coin', `${fmt(r.coins)} coins`, 'Buy items and train moves early');
  if (r.xp) line('xp', `${fmt(r.xp)} XP`, 'Counts toward your next level');
  if (r.chest) {
    const c = CHESTS[r.chest];
    const b = el('button', 'pr-row pr-chest', `<span class="pr-art">${chestSvg(c.body, c.trim)}</span><span class="pr-t"><b>${esc(c.name)}</b><small>${esc(c.desc)} · tap to see what can drop</small></span>`);
    b.onclick = () => {
      sfx.click();
      openDropRates(r.chest!);
    };
    rw.appendChild(b);
  }
  const actions: ModalAction[] = [];
  if (done && !claimed) actions.push({ label: `${ico('gift')} Claim`, cls: 'btn-gold', onClick: () => onClaim() });
  actions.push({ label: 'Close' });
  modal(`${legendary ? ico('trophy') + ' ' : ''}${esc(m.text)}`, box, actions, 'mission-modal');
}

function row(m: MissionDef, progress: number, claimed: boolean, onClaim: () => void, legendary = false): HTMLElement {
  const done = progress >= m.target;
  const r = el('div', `mission ${done ? 'done' : ''} ${claimed ? 'claimed' : ''}`);
  r.onclick = (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    sfx.click();
    openMission(m, progress, claimed, onClaim, legendary);
  };
  const pct = Math.min(1, progress / m.target);
  r.innerHTML = `
    <div class="m-main">
      <b>${esc(m.text)}</b>
      <div class="m-bar"><i style="transform:scaleX(${pct})"></i><span>${fmt(Math.min(progress, m.target))} / ${fmt(m.target)}</span></div>
      <div class="m-rw">${rewardHtml(m.reward)}</div>
    </div><span class="m-go">›</span>`;
  const btn = el('button', `btn sm ${claimed ? 'btn-ghost' : done ? 'btn-gold pulse' : 'btn-ghost'}`, claimed ? ico('check') : done ? 'Claim' : '…');
  btn.disabled = claimed || !done;
  btn.onclick = () => {
    sfx.coin();
    onClaim();
  };
  r.appendChild(btn);
  return r;
}

function claimSet(set: MissionSet, i: number): void {
  if (set.claimed[i]) return;
  set.claimed[i] = true;
  const m = mission(set.ids[i]);
  const lu = giveReward(m.reward);
  toast('Reward claimed!', 'ok');
  if (lu) toast(`You reached level ${lu.to}!`, 'ok');
  render();
}

export function renderMissions(page: HTMLElement, sub = 'daily'): void {
  rememberSub(sub);
  refreshMissions();
  page.innerHTML = `<div class="page-head"><h1>Missions</h1></div><div class="seg"></div><div class="m-list"></div>`;
  const seg = page.querySelector('.seg') as HTMLElement;
  for (const t of TABS) {
    const b = el('button', t.id === sub ? 'on' : '', t.name);
    b.onclick = () => {
      sfx.click();
      renderMissions(page, t.id);
    };
    seg.appendChild(b);
  }
  const list = page.querySelector('.m-list') as HTMLElement;
  if (sub === 'daily' || sub === 'weekly') {
    const set = sub === 'daily' ? S.daily : S.weekly;
    const end = new Date();
    if (sub === 'daily') end.setHours(24, 0, 0, 0);
    else {
      const d = (8 - (end.getDay() || 7)) % 7 || 7;
      end.setDate(end.getDate() + d);
      end.setHours(0, 0, 0, 0);
    }
    list.appendChild(el('div', 'banner-info', `${ico('clock')} New missions in <b>${timeLeft(end.getTime() - Date.now())}</b>`));
    set.ids.forEach((id, i) => list.appendChild(row(mission(id), set.progress[i], set.claimed[i], () => claimSet(set, i))));
    const all = set.claimed.every(Boolean);
    if (all) list.appendChild(el('p', 'muted center', 'All done! Come back later for new missions.'));
  } else {
    list.appendChild(el('p', 'muted small', 'Permanent, very tough challenges. The only way to get the rarest Mythic and Celestial skins. Tap a challenge to see exactly what you get.'));
    for (const m of LEGENDARY) {
      const claimed = S.legendaryClaimed.includes(m.id);
      list.appendChild(
        row(m, legendaryProgress(m), claimed, () => {
          if (S.legendaryClaimed.includes(m.id)) return;
          S.legendaryClaimed.push(m.id);
          commit();
          giveReward(m.reward);
          sfx.reveal(6);
          toast('Legendary Challenge complete!', 'ok');
          render();
        }, true),
      );
    }
  }
  const play = el('button', 'btn btn-gold wide', `${ico('glove')} Go fight`);
  play.onclick = () => go('home');
  list.appendChild(play);
}
