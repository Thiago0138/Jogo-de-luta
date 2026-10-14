import { S, claimFreeChest, freeChestReady } from '../../core/state';
import { CHESTS, CHEST_ORDER } from '../../data/chests';
import { LEAGUES, leagueIndex } from '../../data/leagues';
import { CURRENT_VERSION } from '../../data/patchnotes';
import { powerRating } from '../../data/stats';
import { resolveLook } from '../../render/look';
import { sfx } from '../../audio/sfx';
import { render } from '../app';
import { openChest } from '../chest';
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
    <section class="card chests-card">
      <div class="card-head"><h2>Chests</h2><span class="muted">Open them in the middle of the ring</span></div>
      <div class="chest-row"></div>
    </section>`;

  const prev = new Preview(resolveLook(S.appearance, S.loadout), { turn: true, key: 'home' });
  page.querySelector('.hero-stage')!.appendChild(prev.canvas);
  prev.canvas.onclick = () => {
    sfx.click();
    prev.play(Math.random() < 0.5 ? 'taunt' : 'victory', 'happy');
  };

  (page.querySelector('.news-btn') as HTMLElement).onclick = () => {
    sfx.click();
    openPatchNotes();
  };
  (page.querySelector('.play-btn.solo') as HTMLElement).onclick = () => startMatch('solo');
  (page.querySelector('.play-btn.tag') as HTMLElement).onclick = () => startMatch('tag');
  (page.querySelector('.play-btn.champ') as HTMLElement).onclick = () => startMatch('champion');

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
        toast('You have no chests of this type. Win fights or buy one in the Shop!', 'info');
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
