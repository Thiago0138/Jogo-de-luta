import { careerBadge } from '../modes/career';
import { gymBadge } from '../modes/gym';
import { dailyBadge } from '../modes/daily';
import { passBadge } from '../modes/pass';
import { openLeagues } from '../progress';
import { openDropRates } from '../dropRates';
import { S, claimFreeChest, claimableCount, freeChestReady } from '../../core/state';
import { CHESTS, CHEST_ORDER } from '../../data/chests';
import { LEAGUES, leagueIndex } from '../../data/leagues';
import { CURRENT_VERSION } from '../../data/patchnotes';
import { powerRating } from '../../data/stats';
import { resolveLook } from '../../render/look';
import { sfx } from '../../audio/sfx';
import { go, render } from '../app';
import { chestCount, openAllChests, openChest } from '../chest';
import { chestIconSvg, chestIdFromColors } from '../chestArt';
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
    <button class="next-hint" hidden><span class="nh-ico"></span><span class="nh-txt"><small>Next up</small><b></b></span><span class="nh-go">›</span></button>
    <section class="play">
      <button class="play-btn solo"><span class="pb-ico">${ico('glove')}</span><span class="pb-txt"><b>FIGHT</b><small>1 vs 1 · win trophies &amp; coins</small></span><span class="pb-go">PLAY</span></button>
      <button class="play-btn tag"><span class="pb-ico">${ico('tag')}</span><span class="pb-txt"><b>TAG TEAM</b><small>2 vs 2 with a partner</small></span></button>
      <button class="play-btn champ"><span class="pb-ico">${ico('crown')}</span><span class="pb-txt"><b>CHAMPION</b><small>Tough fight · big prizes</small></span></button>
    </section>
    <section class="modes">
      <button class="mode-btn m-career" data-go="career"><span class="mb-ico">${ico('road')}</span><span class="mb-txt"><b>CAREER</b><small>Road to the Title</small></span><i class="mb-badge"></i></button>
      <button class="mode-btn m-gym" data-go="gym"><span class="mb-ico">${ico('glove')}</span><span class="mb-txt"><b>GYM</b><small>Train &amp; mini-games</small></span><i class="mb-badge"></i></button>
      <button class="mode-btn m-daily" data-go="daily"><span class="mb-ico">${ico('gift')}</span><span class="mb-txt"><b>DAILY</b><small>Spin &amp; free rewards</small></span><i class="mb-badge"></i></button>
      <button class="mode-btn m-pass" data-go="pass"><span class="mb-ico">${ico('star')}</span><span class="mb-txt"><b>FIGHT PASS</b><small>Season rewards</small></span><i class="mb-badge"></i></button>
    </section>
    <section class="card chests-card">
      <div class="card-head"><h2>Chests${chestCount() ? `<i class="ch-n">${chestCount()}</i>` : ''}</h2>${chestCount() > 1 ? `<button class="btn btn-gold sm open-all">${ico('chest')} Open all</button>` : ''}<button class="btn btn-ghost sm odds-btn" aria-label="Drop rates" title="Drop rates">${ico('info')}<span>Odds</span></button></div>
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
  nextHint(page, free, next ? `${next.name} League` : '', next ? next.min - S.trophies : 0);
}

/** "O que fazer a seguir": uma dica curta no topo + destaque no botão certo (só a coisa mais útil). */
function nextHint(page: HTMLElement, free: HTMLElement, nextLeague: string, need: number): void {
  const hint = page.querySelector('.next-hint') as HTMLElement;
  const q = (s: string) => page.querySelector(s) as HTMLElement | null;
  const chests = chestCount();
  const missions = claimableCount();
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  let pick: { icon: string; text: string; target: HTMLElement | null; act: () => void; own?: boolean } | null = null;
  if (freeChestReady()) pick = { icon: 'gift', text: 'Your free chest is ready!', target: free, act: () => free.click(), own: true };
  else if (chests) {
    const slot = q('.chest-slot.has');
    pick = { icon: 'chest', text: `Open ${plural(chests, 'chest')}`, target: slot, act: () => slot?.click(), own: true };
  } else if (missions) pick = { icon: 'missions', text: `Claim ${plural(missions, 'mission reward')}`, target: null, act: () => go('missions') };
  else if (dailyBadge()) pick = { icon: 'gift', text: 'Free daily rewards waiting', target: q('.m-daily'), act: () => go('daily') };
  else if (passBadge()) pick = { icon: 'star', text: 'Fight Pass rewards to claim', target: q('.m-pass'), act: () => go('pass') };
  else if (S.statPoints) pick = { icon: 'chart', text: `Spend ${plural(S.statPoints, 'stat point')}`, target: null, act: () => go('fighter') };
  else if (careerBadge()) pick = { icon: 'road', text: 'Continue your Career', target: q('.m-career'), act: () => go('career') };
  else if (gymBadge()) pick = { icon: 'glove', text: 'Train at the Gym today', target: q('.m-gym'), act: () => go('gym') };
  else if (need > 0) pick = { icon: 'trophy', text: `${fmt(need)} trophies to ${nextLeague}`, target: q('.play-btn.solo'), act: () => startMatch('solo') };
  if (!pick) return;
  const p = pick;
  hint.hidden = false;
  (hint.querySelector('.nh-ico') as HTMLElement).innerHTML = ico(p.icon);
  (hint.querySelector('.nh-txt b') as HTMLElement).textContent = p.text;
  p.target?.classList.add('nudge');
  hint.onclick = () => {
    // quando a dica só "carrega" noutro botão, esse botão já toca o seu próprio som
    if (!p.own) sfx.click();
    p.act();
  };
}

/** Ícone de baú para os menus: o tier é reconhecido pela cor do corpo (mesmo visual da abertura). */
export function chestSvg(body: string, _trim?: string): string {
  return chestIconSvg(chestIdFromColors(body));
}
