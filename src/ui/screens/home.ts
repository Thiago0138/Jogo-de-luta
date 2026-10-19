import { careerBadge } from '../modes/career';
import { gymBadge } from '../modes/gym';
import { dailyBadge } from '../modes/daily';
import { passBadge } from '../modes/pass';
import { openLeagues } from '../progress';
import { openDropRates } from '../dropRates';
import { S, claimFreeChest, freeChestReady } from '../../core/state';
import { CHESTS, CHEST_ORDER } from '../../data/chests';
import { LEAGUES, leagueIndex } from '../../data/leagues';
import { CURRENT_VERSION } from '../../data/patchnotes';
import { powerRating } from '../../data/stats';
import { resolveLook } from '../../render/look';
import { sfx } from '../../audio/sfx';
import { go, render } from '../app';
import { chestCount, openAllChests, openChest } from '../chest';
import { el, esc, fmt, timeLeft, toast } from '../dom';
import { Preview } from '../preview';
import { startMatch } from '../play';
import { openPatchNotes } from './settings';
import { ico, leagueBadge } from '../icons';

export function renderHome(page: HTMLElement): void {
  const li = leagueIndex(S.trophies);
  const L = LEAGUES[li];
  const next = LEAGUES[li + 1];
  const prog = next ? (S.trophies - L.min) / (next.min - L.min) : 1;
  const unseen = S.seenPatch !== CURRENT_VERSION;

  page.innerHTML = `
    <section class="hero">
      <div class="hero-stage"></div>
      <div class="hero-info">
        <div class="hero-league" style="--lc:${L.color}">
          <span class="lg-icon">${leagueBadge(L.id, L.color)}</span>
          <div class="lg-txt"><b>${esc(L.name)} League</b><span>${ico('trophy')} ${fmt(S.trophies)}${next ? ` / ${fmt(next.min)}` : ''}</span></div>
        </div>
        <div class="lg-bar"><i style="transform:scaleX(${Math.min(1, prog)})"></i></div>
        <h1 class="hero-name">${esc(S.name)}</h1>
        <div class="hero-stats">
          <span>${ico('bolt')} Power <b>${fmt(powerRating(S.level, S.stats))}</b></span>
          <span>${ico('fire')} Streak <b>${S.streak}</b></span>
          <span>${ico('medal')} Wins <b>${fmt(S.life.wins)}</b></span>
        </div>
      </div>
      <button class="news-btn ${unseen ? 'dot' : ''}">${ico('news')} What's New</button>
    </section>
    <section class="play">
      <button class="play-btn solo"><span class="pb-ico">${ico('glove')}</span><span class="pb-txt"><b>FIGHT</b><small>1 vs 1</small></span></button>
      <button class="play-btn tag"><span class="pb-ico">${ico('tag')}</span><span class="pb-txt"><b>TAG TEAM</b><small>2 vs 2</small></span></button>
      <button class="play-btn champ"><span class="pb-ico">${ico('crown')}</span><span class="pb-txt"><b>CHAMPION</b><small>Tough challenge · bigger prizes</small></span></button>
    </section>
    <section class="modes">
      <button class="mode-btn m-career" data-go="career"><span class="mb-ico">${ico('road')}</span><span class="mb-txt"><b>CAREER</b><small>Road to the Title</small></span><i class="mb-badge"></i></button>
      <button class="mode-btn m-gym" data-go="gym"><span class="mb-ico">${ico('glove')}</span><span class="mb-txt"><b>GYM</b><small>Train &amp; mini-games</small></span><i class="mb-badge"></i></button>
      <button class="mode-btn m-daily" data-go="daily"><span class="mb-ico">${ico('gift')}</span><span class="mb-txt"><b>DAILY</b><small>Wheel · rewards · luck</small></span><i class="mb-badge"></i></button>
      <button class="mode-btn m-pass" data-go="pass"><span class="mb-ico">${ico('star')}</span><span class="mb-txt"><b>FIGHT PASS</b><small>Season rewards</small></span><i class="mb-badge"></i></button>
    </section>
    <section class="card chests-card">
      <div class="card-head"><h2>Chests</h2>${chestCount() > 1 ? `<button class="btn btn-gold sm open-all">${ico('chest')} Open all (${chestCount()})</button>` : ''}<button class="btn btn-ghost sm odds-btn">${ico('info')} Drop rates</button></div>
      <div class="chest-row"></div>
    </section>`;

  const prev = new Preview(resolveLook(S.appearance, S.loadout), { turn: true, key: 'home' });
  page.querySelector('.hero-stage')!.appendChild(prev.canvas);
  // tocar no lutador abre o ecrã do lutador
  prev.canvas.style.cursor = 'pointer';
  prev.canvas.onclick = () => {
    sfx.click();
    go('fighter');
  };

  const allBtn = page.querySelector('.open-all') as HTMLElement | null;
  if (allBtn)
    allBtn.onclick = () => {
      sfx.click();
      openAllChests(() => render());
    };
  (page.querySelector('.news-btn') as HTMLElement).onclick = () => {
    sfx.click();
    openPatchNotes();
  };
  (page.querySelector('.play-btn.solo') as HTMLElement).onclick = () => startMatch('solo');
  (page.querySelector('.play-btn.tag') as HTMLElement).onclick = () => startMatch('tag');
  (page.querySelector('.play-btn.champ') as HTMLElement).onclick = () => startMatch('champion');
  const badges: Record<string, number> = { career: careerBadge(), gym: gymBadge(), daily: dailyBadge(), pass: passBadge() };
  page.querySelectorAll<HTMLElement>('.mode-btn').forEach((b) => {
    const id = b.dataset.go as 'career' | 'gym' | 'daily' | 'pass';
    const n = badges[id] ?? 0;
    const bd = b.querySelector('.mb-badge') as HTMLElement;
    bd.textContent = n > 9 ? '9+' : n ? String(n) : '';
    bd.classList.toggle('on', n > 0);
    b.onclick = () => {
      sfx.click();
      go(id);
    };
  });

  (page.querySelector('.hero-league') as HTMLElement).onclick = () => {
    sfx.click();
    openLeagues();
  };
  (page.querySelector('.odds-btn') as HTMLElement).onclick = () => {
    sfx.click();
    openDropRates();
  };
  const row = page.querySelector('.chest-row') as HTMLElement;
  // baú grátis
  const free = el('button', 'chest-slot free');
  const updFree = () => {
    const ready = freeChestReady();
    free.classList.toggle('ready', ready);
    free.innerHTML = `<div class="cs-art">${chestSvg('#8a4e22', '#cd8a4a')}</div><b>Free</b><span>${ready ? 'Claim!' : timeLeft(S.freeChestAt - Date.now())}</span>`;
  };
  updFree();
  const timer = setInterval(() => {
    if (!free.isConnected) clearInterval(timer);
    else updFree();
  }, 1000);
  free.onclick = () => {
    if (claimFreeChest()) {
      sfx.coin();
      toast('Bronze Chest claimed!', 'ok');
      render();
    } else {
      toast('Not ready yet.', 'info');
    }
  };
  row.appendChild(free);

  for (const id of CHEST_ORDER) {
    const c = CHESTS[id];
    const n = S.chests[id];
    const b = el('button', `chest-slot ${n ? 'has' : 'empty'}`);
    b.style.setProperty('--cg', c.glow);
    b.innerHTML = `<div class="cs-art">${chestSvg(c.body, c.trim)}</div><b>${esc(c.name.replace(/ Chest$/, ''))}</b><span>${n ? `×${n}` : '—'}</span>`;
    b.onclick = () => {
      sfx.click();
      if (!S.chests[id]) {
        toast('You have none of these yet. Here is what it can drop!', 'info');
        openDropRates(id);
        return;
      }
      openChest(id, () => render());
    };
    row.appendChild(b);
  }
}

export function chestSvg(body: string, trim: string): string {
  return `<svg viewBox="0 0 64 56" aria-hidden="true">
    <path d="M6 24 Q6 6 32 6 Q58 6 58 24 Z" fill="${body}" stroke="#140a1c" stroke-width="3"/>
    <rect x="6" y="24" width="52" height="28" rx="4" fill="${body}" stroke="#140a1c" stroke-width="3"/>
    <rect x="12" y="8" width="7" height="44" fill="${trim}" stroke="#140a1c" stroke-width="2"/>
    <rect x="45" y="8" width="7" height="44" fill="${trim}" stroke="#140a1c" stroke-width="2"/>
    <rect x="26" y="19" width="12" height="13" rx="3" fill="${trim}" stroke="#140a1c" stroke-width="2"/>
    <circle cx="32" cy="26" r="2.5" fill="#140a1c"/>
  </svg>`;
}
