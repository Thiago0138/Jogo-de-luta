import { S } from '../core/state';
import { hashStr, seeded } from '../core/rng';
import { ITEMS } from '../data/items';
import { leagueOf } from '../data/leagues';
import { RARITIES } from '../data/rarity';
import { maxHp, powerRating } from '../data/stats';
import { sfx } from '../audio/sfx';
import { TEAM_COLORS } from '../fight/arena';
import type { Mode } from '../fight/engine';
import type { FighterSpec } from '../fight/fighter';
import { countUp, el, esc, fmt } from './dom';
import { Preview } from './preview';
import { ico, leagueBadge } from './icons';

/** Registo (vitórias, combates, série) de um lutador. Os da IA são inventados de forma determinística. */
interface Record_ {
  wins: number;
  fights: number;
  streak: number;
}

function recordOf(sp: FighterSpec, mode: Mode): Record_ {
  if (sp.isPlayer) {
    const wins = mode === 'tag' ? S.life.tagWins : S.life.wins;
    return { wins, fights: S.life.fights, streak: S.streak };
  }
  const champ = sp.title === 'Champion';
  const r = seeded(hashStr(sp.name) ^ (sp.level * 7919));
  const lvl = Math.max(1, sp.level);
  const wins = Math.round((lvl * 5 + 4 + r() * lvl * 4) * (champ ? 1.7 : 1));
  const rate = champ ? 0.74 + r() * 0.16 : 0.5 + r() * 0.24;
  const fights = Math.max(wins, Math.round(wins / rate));
  const streak = champ ? 5 + Math.floor(r() * 9) : Math.floor(r() * 5);
  return { wins, fights, streak };
}

function hpOf(sp: FighterSpec, mode: Mode): number {
  return Math.round(maxHp(sp.level, sp.stats.vit) * (mode === 'tag' ? 0.5 : 1) * (sp.hpMul ?? 1));
}

function superChip(sp: FighterSpec, small = false): string {
  const it = ITEMS[sp.supers[0]];
  if (!it) return '';
  const col = RARITIES[it.rarity]?.color ?? '#fff';
  return `<span class="vs-super ${small ? 'sm' : ''}" style="--rc:${col}">${ico('bolt')}<em>SUPER</em><b>${esc(it.name)}</b></span>`;
}

const pct = (w: number, f: number) => (f > 0 ? `${Math.round((w / f) * 100)}%` : 'NEW');

/** Ecrã de apresentação antes do combate ("VS"). Toque (ou espera) para começar. */
export function versus(mode: Mode, teams: [FighterSpec[], FighterSpec[]], start: () => void): void {
  const root = el('div', `versus mode-${mode}`);
  const league = leagueOf(S.trophies);
  const title =
    mode === 'tag'
      ? `${ico('tag')}TAG TEAM<small>2 VS 2</small>`
      : mode === 'champion'
        ? `${ico('crown')}CHAMPION CHALLENGE${ico('crown')}`
        : `1 VS 1<small>${esc(league.name)} League</small>`;
  const sparks = Array.from({ length: 12 }, (_, i) => `<i style="--a:${i * 30 + (i % 2) * 11}deg;--d:${0.8 + (i % 3) * 0.25}"></i>`).join('');
  root.innerHTML = `
    <div class="vs-bg"><i class="vs-rays"></i></div>
    <div class="vs-panel l" style="--tc:${TEAM_COLORS[0]}"><i class="vs-half"></i><i class="vs-streak"></i></div>
    <div class="vs-panel r" style="--tc:${TEAM_COLORS[1]}"><i class="vs-half"></i><i class="vs-streak"></i></div>
    <div class="vs-slash"></div>
    <div class="vs-vignette"></div>
    <div class="vs-head"><div class="vs-title">${title}</div></div>
    <div class="vs-main">
      <div class="vs-side l" style="--tc:${TEAM_COLORS[0]}"></div>
      <div class="vs-side r" style="--tc:${TEAM_COLORS[1]}"></div>
    </div>
    <div class="vs-mid"><i class="vs-ring"></i><i class="vs-ring b"></i><div class="vs-sparks">${sparks}</div><span class="vs-word">VS</span></div>
    <div class="vs-foot">
      <div class="vs-cmp"><span class="vs-cmp-l"></span><div class="vs-bar"><i></i><b></b></div><span class="vs-cmp-r"></span></div>
      <div class="vs-tap">TAP TO START</div>
    </div>
    <div class="vs-flash"></div>`;

  const powers = teams.map((t) => t.reduce((a, sp) => a + powerRating(sp.level, sp.stats), 0));
  const counters: [HTMLElement, number][] = [];

  const side = (specs: FighterSpec[], cls: 'l' | 'r', team: 0 | 1) => {
    const s = root.querySelector(`.vs-side.${cls}`) as HTMLElement;
    const arts = el('div', `vs-arts n${specs.length}`);
    specs.forEach((sp, i) => {
      const p = new Preview(sp.look, { stage: false });
      p.facing = team ? -1 : 1;
      p.floor = 0.95;
      const art = el('div', `vs-art ${i ? 'second' : 'first'}`);
      art.appendChild(p.canvas);
      arts.appendChild(art);
    });

    const lead = specs[0];
    const champ = specs.some((sp) => sp.title === 'Champion');
    const rec = recordOf(lead, mode);
    const rank = champ
      ? `<span class="vs-rank champ">${ico('crown')}<b>CHAMPION</b></span>`
      : `<span class="vs-rank" style="--lc:${league.color}">${leagueBadge(league.id, league.color)}<b>${esc(league.name)}</b></span>`;
    let body: string;
    if (specs.length === 1) {
      body = `
        <div class="vs-name" style="--nl:${Math.max(8, lead.name.length)}">${esc(lead.name)}</div>
        <div class="vs-sub">${lead.title ? `${esc(lead.title)} · ` : ''}LV ${lead.level}</div>
        <div class="vs-pow"><em>TOTAL POWER</em><b>${ico('bolt')}<span class="vs-num">0</span></b></div>
        <div class="vs-grid">
          <span><em>${ico('heart')}HP</em><b>${fmt(hpOf(lead, mode))}</b></span>
          <span><em>${ico('medal')}WINS</em><b>${fmt(rec.wins)}<small>${pct(rec.wins, rec.fights)}</small></b></span>
          <span><em>${ico('fire')}STREAK</em><b>${rec.streak}</b></span>
        </div>
        ${superChip(lead)}`;
    } else {
      const rows = specs
        .map(
          (sp) => `<div class="vs-row">
            <div class="vs-rn"><b>${esc(sp.name)}</b><span>LV ${sp.level}</span></div>
            <div class="vs-rs"><span>${ico('bolt')}${fmt(powerRating(sp.level, sp.stats))}</span><span>${ico('heart')}${fmt(hpOf(sp, mode))}</span></div>
            ${superChip(sp, true)}
          </div>`,
        )
        .join('');
      body = `
        <div class="vs-pow"><em>TEAM POWER</em><b>${ico('bolt')}<span class="vs-num">0</span></b></div>
        ${rows}
        <div class="vs-rec">${ico('medal')}<b>${fmt(rec.wins)}</b> TAG WINS<i></i>${ico('fire')}<b>${rec.streak}</b></div>`;
    }
    const card = el('div', 'vs-card', `${rank}${body}`);
    s.appendChild(card);
    s.appendChild(arts);
    counters.push([card.querySelector('.vs-num') as HTMLElement, powers[team]]);
  };
  side(teams[0], 'l', 0);
  side(teams[1], 'r', 1);

  // barra de comparação de poder: quem é o favorito
  const share = powers[0] / Math.max(1, powers[0] + powers[1]);
  const lp = Math.round(share * 100);
  const even = Math.abs(lp - 50) <= 2;
  (root.querySelector('.vs-bar') as HTMLElement).style.setProperty('--share', String(share));
  (root.querySelector('.vs-bar b') as HTMLElement).textContent = even ? 'EVEN MATCH' : lp > 50 ? '◀ FAVOURITE' : 'FAVOURITE ▶';
  (root.querySelector('.vs-cmp-l') as HTMLElement).textContent = `${lp}%`;
  (root.querySelector('.vs-cmp-r') as HTMLElement).textContent = `${100 - lp}%`;
  if (!even) root.classList.add(lp > 50 ? 'fav-l' : 'fav-r');

  document.body.appendChild(root);
  sfx.cheer(0.6);

  const timers: number[] = [];
  const later = (ms: number, f: () => void) => timers.push(window.setTimeout(f, ms));
  // impacto do "VS" (sincronizado com a animação CSS)
  later(60, () => sfx.whoosh());
  later(520, () => sfx.impact(0.8));
  later(700, () => {
    for (const [e, v] of counters) if (e) countUp(e, 0, v, 900);
  });

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    timers.forEach(clearTimeout);
    root.classList.add('out');
    setTimeout(() => {
      root.remove();
      start();
    }, 260);
  };
  root.onclick = finish;
  later(4200, finish);
}
