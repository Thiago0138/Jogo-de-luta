import { S, addXp, applyTally, changeTrophies, commit, removeItem, type LevelUp } from '../core/state';
import { makeOpponent, makePartner, playerSpec } from '../core/opponents';
import { CHESTS, type ChestId } from '../data/chests';
import { ITEMS } from '../data/items';
import { leagueOf } from '../data/leagues';
import { powerRating, xpToNext } from '../data/stats';
import { sfx, unlockAudio } from '../audio/sfx';
import { FightScene } from '../fight/scene';
import type { FightReport, Mode } from '../fight/engine';
import type { FighterSpec } from '../fight/fighter';
import { go, render } from './app';
import { openChest } from './chest';
import { countUp, el, esc, fmt, modal } from './dom';
import { Preview } from './preview';
import { chestSvg } from './screens/home';

let busy = false;

export function startMatch(mode: Mode): void {
  if (busy) return;
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

function versus(mode: Mode, teams: [FighterSpec[], FighterSpec[]], go: () => void): void {
  const root = el('div', 'versus');
  const title = mode === 'tag' ? 'TAG TEAM' : mode === 'champion' ? 'DESAFIO DO CAMPEÃO' : 'COMBATE';
  root.innerHTML = `<div class="vs-title">${title}</div><div class="vs-side l"></div><div class="vs-mid"><span>VS</span></div><div class="vs-side r"></div><div class="vs-tap">toca para começar</div>`;
  const side = (specs: FighterSpec[], cls: string, flip: boolean) => {
    const s = root.querySelector(`.vs-side.${cls}`) as HTMLElement;
    specs.forEach((sp, i) => {
      const box = el('div', `vs-fighter ${i ? 'second' : ''}`);
      const p = new Preview(sp.look);
      p.facing = flip ? -1 : 1;
      if (!i) p.play('taunt', 'happy');
      const art = el('div', 'vs-art');
      art.appendChild(p.canvas);
      box.appendChild(art);
      const info = el(
        'div',
        'vs-info',
        `<b>${esc(sp.name)}</b><span>Nv ${sp.level}${sp.title ? ` · ${esc(sp.title)}` : ''}</span><span class="vs-pow">⚡ ${fmt(powerRating(sp.level, sp.stats))}</span>`,
      );
      box.appendChild(info);
      s.appendChild(box);
    });
  };
  side(teams[0], 'l', false);
  side(teams[1], 'r', true);
  document.body.appendChild(root);
  sfx.cheer(0.6);
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    root.classList.add('out');
    setTimeout(() => {
      root.remove();
      go();
    }, 260);
  };
  root.onclick = finish;
  setTimeout(finish, 3200);
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
  // consome poções usadas
  for (const id of r.usedPotions) removeItem(id);
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
    <h1 class="res-title">${r.won ? 'VITÓRIA!' : 'DERROTA'}</h1>
    <p class="res-sub">${r.decision ? 'Decisão dos juízes' : r.won ? (r.superKO ? 'K.O. com Super!' : 'Contagem até 3!') : 'Treina mais e volta mais forte!'}</p>
    <div class="res-stage"></div>
    <div class="res-grid">
      <div class="res-item"><span>⭐ XP</span><b>+${fmt(rw.xp)}</b></div>
      <div class="res-item"><span>🪙 Moedas</span><b>+<span class="rc">${fmt(rw.coins)}</span></b></div>
      <div class="res-item"><span>🏆 Troféus</span><b class="${rw.trophies < 0 ? 'neg' : ''}">${rw.trophies >= 0 ? '+' : ''}${rw.trophies}</b></div>
      ${rw.gems ? `<div class="res-item"><span>💎 Gemas</span><b>+${rw.gems}</b></div>` : ''}
    </div>
    <div class="res-xp"><div class="rx-head"><span>Nível <b class="rx-lvl">${lvlBefore}</b></span><span class="rx-num"></span></div><div class="rx-bar"><i></i></div></div>
    <div class="res-stats">
      <span>👊 ${r.tally.punches} socos</span><span>🤼 ${r.tally.grapples} projeções</span><span>💨 ${r.tally.dodges} esquivas</span><span>⚡ ${r.tally.supers} supers</span>
    </div>
    <div class="res-chest"></div>
    <div class="res-actions">
      <button class="btn btn-ghost menu">Menu</button>
      <button class="btn btn-gold again">Lutar outra vez</button>
    </div>
    <div class="res-league" style="--lc:${L.color}">${L.icon} Liga ${esc(L.name)} · 🏆 ${fmt(S.trophies)}</div>`;

  const me = teams[0][0];
  const p = new Preview(me.look);
  p.play(r.won ? 'victory' : 'getup', r.won ? 'happy' : 'hurt');
  root.querySelector('.res-stage')!.appendChild(p.canvas);

  const chestBox = root.querySelector('.res-chest') as HTMLElement;
  const earned = [rw.chest, rw.leagueChest, ...(rw.levelUp?.chests ?? [])].filter(Boolean) as ChestId[];
  if (earned.length) {
    const id = earned[0];
    const c = CHESTS[id];
    chestBox.innerHTML = `<div class="rc-box" style="--cg:${c.glow}"><div class="cs-art">${chestSvg(c.body, c.trim)}</div><div><b>${earned.length > 1 ? `${earned.length} baús ganhos!` : `Ganhaste um ${esc(c.name)}!`}</b><span>${rw.leagueChest ? 'Nova liga alcançada! ' : ''}Abre já ou mais tarde no Ringue.</span></div><button class="btn btn-gold sm open">Abrir</button></div>`;
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
    <p>Subiste ${gained > 1 ? `${gained} níveis` : 'de nível'}! Ganhaste <b>${gained * 3} pontos de atributo</b>, <b>${gained * 5} 💎</b> e mais vida.</p>
    ${lu.unlocked.length ? `<p>Desbloqueado: ${lu.unlocked.map((id) => `<b>${ITEMS[id].icon} ${esc(ITEMS[id].name)}</b>`).join(', ')}</p>` : ''}
    ${lu.chests.length ? `<p>Recompensa: ${lu.chests.map((c) => esc(CHESTS[c].name)).join(', ')}</p>` : ''}`;
  modal('Subiste de nível!', body, [
    { label: 'Depois' },
    {
      label: 'Distribuir pontos',
      cls: 'btn-gold',
      onClick: () => go('fighter'),
    },
  ], 'levelup');
}
