import { emitFightEnd } from '../core/events';
import { S, addXp, applyTally, changeTrophies, commit, type LevelUp } from '../core/state';
import { makeOpponent, makePartner, playerSpec } from '../core/opponents';
import { CHESTS, type ChestId } from '../data/chests';
import { ITEMS } from '../data/items';
import { leagueOf } from '../data/leagues';
import { xpToNext } from '../data/stats';
import { sfx, unlockAudio } from '../audio/sfx';
import { FightScene } from '../fight/scene';
import type { FightReport, Mode } from '../fight/engine';
import type { FighterSpec } from '../fight/fighter';
import { go, render } from './app';
import { openChest } from './chest';
import { openTutorial, tutorialSeen } from './tutorial';
import { countUp, el, esc, fmt, modal } from './dom';
import { Preview } from './preview';
import { versus } from './versus';
import { chestSvg } from './screens/home';
import { ico, leagueBadge } from './icons';

let busy = false;

export function startMatch(mode: Mode): void {
  if (busy) return;
  // primeira luta de sempre: explica como funcionam as lutas antes de começar
  if (!tutorialSeen('fight')) {
    openTutorial('fight', () => startMatch(mode));
    return;
  }
  busy = true;
  unlockAudio();
  sfx.click();
  const me = playerSpec();
  const teams: [FighterSpec[], FighterSpec[]] =
    mode === 'tag'
      ? [[me, makePartner()], [makeOpponent(), makeOpponent({ levelDelta: -1 })]]
      : [[me], [makeOpponent({ champion: mode === 'champion' })]];
  versus(mode, teams, () => fight(mode, teams));
}

function fight(mode: Mode, teams: [FighterSpec[], FighterSpec[]]): void {
  const holder = el('div', 'fight-layer');
  document.body.appendChild(holder);
  const scene = new FightScene(holder, { mode, teams }, {
    speed: S.settings.speed,
    quality: S.settings.quality,
    onSpeed: (s) => {
      S.settings.speed = s;
      commit();
    },
    onEnd: (r) => {
      scene.destroy();
      holder.remove();
      emitFightEnd({ mode, won: r.won, report: r });
      results(mode, teams, r);
    },
  });
}

interface Rewards {
  xp: number;
  coins: number;
  gems: number;
  trophies: number;
  chest: ChestId | null;
  leagueChest: ChestId | null;
  levelUp: LevelUp | null;
}

function computeRewards(mode: Mode, opp: FighterSpec, r: FightReport): Rewards {
  const lvl = opp.level;
  const mult = mode === 'champion' ? 1.8 : mode === 'tag' ? 1.25 : 1;
  let xp: number;
  let coins: number;
  let trophies: number;
  let gems = 0;
  let chest: ChestId | null = null;
  if (r.won) {
    xp = Math.round((55 + lvl * 7) * mult);
    coins = Math.round((70 + lvl * 9) * mult);
    trophies = 28 + Math.min(8, S.streak) + (mode === 'champion' ? 10 : 0);
    if (r.superKO) coins += 25;
    if (mode === 'champion') {
      gems = 3;
      chest = Math.random() < 0.25 ? 'ouro' : 'prata';
    } else {
      const x = Math.random();
      chest = x < 0.03 ? 'ouro' : x < 0.13 ? 'prata' : x < 0.42 ? 'bronze' : null;
    }
  } else {
    xp = Math.round((22 + lvl * 3) * mult);
    coins = Math.round((25 + lvl * 3) * mult);
    trophies = S.trophies < 80 ? 0 : mode === 'champion' ? -8 : -18;
  }
  return { xp, coins, gems, trophies, chest, leagueChest: null, levelUp: null };
}

function applyRewards(mode: Mode, r: FightReport, rw: Rewards): void {
  if (r.won) {
    S.streak++;
    S.bestStreak = Math.max(S.bestStreak, S.streak);
  } else {
    S.streak = 0;
    S.losses++;
  }
  S.coins += rw.coins;
  S.gems += rw.gems;
  if (rw.chest) S.chests[rw.chest]++;
  rw.leagueChest = changeTrophies(rw.trophies);
  applyTally(r.tally);
  rw.levelUp = addXp(rw.xp);
  commit();
  void mode;
}

function results(mode: Mode, teams: [FighterSpec[], FighterSpec[]], r: FightReport): void {
  const opp = teams[1][0];
  const rw = computeRewards(mode, opp, r);
  const xpBefore = S.xp;
  const lvlBefore = S.level;
  const coinsBefore = S.coins;
  applyRewards(mode, r, rw);

  const root = el('div', `results ${r.won ? 'win' : 'lose'}`);
  const L = leagueOf(S.trophies);
  root.innerHTML = `
    <div class="res-burst"></div>
    <h1 class="res-title">${r.won ? 'VICTORY!' : 'DEFEAT'}</h1>
    <p class="res-sub">${r.decision ? 'Judges\' decision' : r.won ? (r.superKO ? 'Super K.O.!' : '1, 2, 3 — pinfall!') : 'Train harder and come back stronger!'}</p>
    <div class="res-stage"></div>
    <div class="res-grid">
      <div class="res-item"><span>${ico('xp')} XP</span><b>+${fmt(rw.xp)}</b></div>
      <div class="res-item"><span>${ico('coin')} Coins</span><b>+<span class="rc">${fmt(rw.coins)}</span></b></div>
      <div class="res-item"><span>${ico('trophy')} Trophies</span><b class="${rw.trophies < 0 ? 'neg' : ''}">${rw.trophies >= 0 ? '+' : ''}${rw.trophies}</b></div>
      ${rw.gems ? `<div class="res-item"><span>${ico('gem')} Gems</span><b>+${rw.gems}</b></div>` : ''}
    </div>
    <div class="res-xp"><div class="rx-head"><span>Level <b class="rx-lvl">${lvlBefore}</b></span><span class="rx-num"></span></div><div class="rx-bar"><i></i></div></div>
    <div class="res-stats">
      <span>${ico('fist')} ${r.tally.punches} punches</span><span>${ico('grapple')} ${r.tally.grapples} throws</span><span>${ico('dodge')} ${r.tally.dodges} dodges</span><span>${ico('bolt')} ${r.tally.supers} supers</span>
    </div>
    <div class="res-chest"></div>
    <div class="res-actions">
      <button class="btn btn-ghost menu">Menu</button>
      <button class="btn btn-gold again">Fight again</button>
    </div>
    <div class="res-league" style="--lc:${L.color}">${leagueBadge(L.id, L.color)} ${esc(L.name)} League · ${ico('trophy')} ${fmt(S.trophies)}</div>`;

  const me = teams[0][0];
  const p = new Preview(me.look);
  p.play(r.won ? 'victory' : 'getup', r.won ? 'happy' : 'hurt');
  root.querySelector('.res-stage')!.appendChild(p.canvas);

  const chestBox = root.querySelector('.res-chest') as HTMLElement;
  const earned = [rw.chest, rw.leagueChest, ...(rw.levelUp?.chests ?? [])].filter(Boolean) as ChestId[];
  if (earned.length) {
    const id = earned[0];
    const c = CHESTS[id];
    chestBox.innerHTML = `<div class="rc-box" style="--cg:${c.glow}"><div class="cs-art">${chestSvg(c.body, c.trim)}</div><div><b>${earned.length > 1 ? `${earned.length} chests earned!` : `You earned a ${esc(c.name)}!`}</b><span>${rw.leagueChest ? 'New league reached! ' : ''}Open it now or later in the Ring.</span></div><button class="btn btn-gold sm open">Open</button></div>`;
    (chestBox.querySelector('.open') as HTMLElement).onclick = () => {
      sfx.click();
      if (S.chests[id] > 0) openChest(id, () => chestBox.remove());
    };
  }

  document.body.appendChild(root);
  if (r.won) {
    sfx.levelUp();
    sfx.cheer(1);
  }
  countUp(root.querySelector('.rc') as HTMLElement, 0, rw.coins, 900);
  void coinsBefore;

  // barra de XP animada (incluindo subidas de nível)
  const bar = root.querySelector('.rx-bar i') as HTMLElement;
  const num = root.querySelector('.rx-num') as HTMLElement;
  const lvlEl = root.querySelector('.rx-lvl') as HTMLElement;
  bar.style.transform = `scaleX(${xpBefore / xpToNext(lvlBefore)})`;
  let lv = lvlBefore;
  const step = () => {
    if (lv < S.level) {
      bar.style.transition = 'transform .6s cubic-bezier(.2,.8,.2,1)';
      bar.style.transform = 'scaleX(1)';
      setTimeout(() => {
        lv++;
        lvlEl.textContent = String(lv);
        bar.style.transition = 'none';
        bar.style.transform = 'scaleX(0)';
        lvlEl.parentElement!.classList.add('lvlup');
        sfx.levelUp();
        requestAnimationFrame(() => requestAnimationFrame(step));
      }, 650);
    } else {
      bar.style.transition = 'transform .8s cubic-bezier(.2,.8,.2,1)';
      bar.style.transform = `scaleX(${S.xp / xpToNext(S.level)})`;
      num.textContent = `${fmt(S.xp)} / ${fmt(xpToNext(S.level))}`;
    }
  };
  setTimeout(step, 450);

  const close = (again: boolean) => {
    sfx.click();
    root.classList.add('out');
    setTimeout(() => root.remove(), 220);
    busy = false;
    render();
    if (rw.levelUp) showLevelUp(rw.levelUp);
    else if (again) startMatch(mode);
  };
  (root.querySelector('.menu') as HTMLElement).onclick = () => close(false);
  (root.querySelector('.again') as HTMLElement).onclick = () => close(true);
}

function showLevelUp(lu: LevelUp): void {
  const body = el('div', 'lvlup-body');
  const gained = lu.to - lu.from;
  body.innerHTML = `<div class="lu-big">${lu.to}</div>
    <p>You ${gained > 1 ? `gained ${gained} levels` : 'leveled up'}! You earned <b>${gained * 3} stat points</b>, <b>${gained * 5} ${ico('gem')}</b> and more health.</p>
    ${lu.unlocked.length ? `<p>Unlocked: ${lu.unlocked.map((id) => `<b>${esc(ITEMS[id].name)}</b>`).join(', ')}</p>` : ''}
    ${lu.chests.length ? `<p>Reward: ${lu.chests.map((c) => esc(CHESTS[c].name)).join(', ')}</p>` : ''}`;
  modal('Level up!', body, [
    { label: 'Later' },
    {
      label: 'Spend points',
      cls: 'btn-gold',
      onClick: () => go('fighter'),
    },
  ], 'levelup');
}

// ───────────────────────── Combates personalizados (modos: Carreira, …) ─────────────────────────

export interface CustomMatch {
  /** Modo do motor (por defeito 'solo'; 'champion' para chefes). */
  mode?: Mode;
  teams: [FighterSpec[], FighterSpec[]];
  /** Título do ecrã VS (HTML). Por defeito o do modo. */
  title?: string;
  /** Distintivo (HTML) a mostrar no cartão do adversário no ecrã VS, em vez da liga. */
  badge?: string;
  /** Arena forçada (id do item). */
  arena?: string;
  /** Conta para as estatísticas/missões e avisa os outros modos (por defeito sim). */
  track?: boolean;
  onResult: (won: boolean, report: FightReport) => void;
}

/**
 * Combate com regras próprias: usa o mesmo ecrã VS e a mesma cena de luta, mas em vez do
 * ecrã de resultados normal (troféus, série…) entrega o relatório a `onResult`.
 */
export function startCustomMatch(m: CustomMatch): void {
  if (busy) return;
  busy = true;
  unlockAudio();
  sfx.click();
  const mode = m.mode ?? 'solo';
  versus(mode, m.teams, () => {
    const holder = el('div', 'fight-layer');
    document.body.appendChild(holder);
    const scene = new FightScene(holder, { mode, teams: m.teams, arena: m.arena }, {
      speed: S.settings.speed,
      quality: S.settings.quality,
      onSpeed: (s) => {
        S.settings.speed = s;
        commit();
      },
      onEnd: (r) => {
        scene.destroy();
        holder.remove();
        busy = false;
        if (m.track !== false) {
          applyTally(r.tally);
          commit();
          emitFightEnd({ mode, won: r.won, report: r });
        }
        m.onResult(r.won, r);
      },
    });
  });
  const vs = document.querySelectorAll('.versus');
  const root = vs[vs.length - 1] as HTMLElement | undefined;
  if (root && m.title) (root.querySelector('.vs-title') as HTMLElement).innerHTML = m.title;
  if (root && m.badge) {
    const rank = root.querySelector('.vs-side.r .vs-rank') as HTMLElement | null;
    if (rank) rank.outerHTML = m.badge;
  }
}

/** Modal de subida de nível (reutilizável pelos modos). */
export function showLevelUpModal(lu: LevelUp): void {
  showLevelUp(lu);
}
