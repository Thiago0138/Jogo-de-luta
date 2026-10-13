import { S, commit, giveReward, legendaryProgress, mission, refreshMissions, type MissionSet } from '../../core/state';
import { LEGENDARY, type MissionDef, type Reward } from '../../data/missions';
import { CHESTS } from '../../data/chests';
import { ITEMS } from '../../data/items';
import { sfx } from '../../audio/sfx';
import { go, render } from '../app';
import { el, esc, fmt, timeLeft, toast } from '../dom';

const TABS = [
  { id: 'daily', name: '☀️ Diárias' },
  { id: 'weekly', name: '📅 Semanais' },
  { id: 'legend', name: '🏆 Lendárias' },
];

function rewardHtml(r: Reward): string {
  const parts: string[] = [];
  if (r.xp) parts.push(`<span class="rw">⭐ ${fmt(r.xp)}</span>`);
  if (r.coins) parts.push(`<span class="rw">🪙 ${fmt(r.coins)}</span>`);
  if (r.gems) parts.push(`<span class="rw">💎 ${fmt(r.gems)}</span>`);
  if (r.chest) parts.push(`<span class="rw">🎁 ${esc(CHESTS[r.chest].name)}</span>`);
  if (r.item) {
    const d = ITEMS[r.item];
    parts.push(`<span class="rw rar-${d.rarity} itemrw">${d.icon} ${esc(d.name)}</span>`);
  }
  return parts.join('');
}

function row(m: MissionDef, progress: number, claimed: boolean, onClaim: () => void): HTMLElement {
  const done = progress >= m.target;
  const r = el('div', `mission ${done ? 'done' : ''} ${claimed ? 'claimed' : ''}`);
  const pct = Math.min(1, progress / m.target);
  r.innerHTML = `
    <div class="m-main">
      <b>${esc(m.text)}</b>
      <div class="m-bar"><i style="transform:scaleX(${pct})"></i><span>${fmt(Math.min(progress, m.target))} / ${fmt(m.target)}</span></div>
      <div class="m-rw">${rewardHtml(m.reward)}</div>
    </div>`;
  const btn = el('button', `btn sm ${claimed ? 'btn-ghost' : done ? 'btn-gold pulse' : 'btn-ghost'}`, claimed ? '✓' : done ? 'Recolher' : '…');
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
  toast('Recompensa recolhida!', 'ok');
  if (lu) toast(`Subiste para o nível ${lu.to}!`, 'ok');
  render();
}

export function renderMissions(page: HTMLElement, sub = 'daily'): void {
  refreshMissions();
  page.innerHTML = `<div class="page-head"><h1>Missões</h1></div><div class="seg"></div><div class="m-list"></div>`;
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
    list.appendChild(el('div', 'banner-info', `⏳ Novas missões em <b>${timeLeft(end.getTime() - Date.now())}</b>`));
    set.ids.forEach((id, i) => list.appendChild(row(mission(id), set.progress[i], set.claimed[i], () => claimSet(set, i))));
    const all = set.claimed.every(Boolean);
    if (all) list.appendChild(el('p', 'muted center', 'Completaste tudo! Volta mais tarde para novas missões.'));
  } else {
    list.appendChild(el('p', 'muted small', 'Desafios permanentes e muito difíceis. São a única forma de obter as skins Míticas e Celestiais mais raras.'));
    for (const m of LEGENDARY) {
      const claimed = S.legendaryClaimed.includes(m.id);
      list.appendChild(
        row(m, legendaryProgress(m), claimed, () => {
          if (S.legendaryClaimed.includes(m.id)) return;
          S.legendaryClaimed.push(m.id);
          commit();
          giveReward(m.reward);
          sfx.reveal(6);
          toast('Desafio Lendário concluído!', 'ok');
          render();
        }),
      );
    }
  }
  const play = el('button', 'btn btn-gold wide', '🥊 Ir lutar');
  play.onclick = () => go('home');
  list.appendChild(play);
}
