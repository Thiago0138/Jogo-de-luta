import { S, claimableCount, commit, onChange, refreshMissions } from '../core/state';
import { xpToNext } from '../data/stats';
import { dayKey } from '../core/rng';
import { leagueOf } from '../data/leagues';
import { sfx, unlockAudio } from '../audio/sfx';
import { resolveLook } from '../render/look';
import { el, esc, fmt } from './dom';
import { Preview } from './preview';
import { renderHome } from './screens/home';
import { renderShop } from './screens/shop';
import { renderCollection } from './screens/collection';
import { renderMissions } from './screens/missions';
import { renderFighter } from './screens/fighter';
import { careerBadge, renderCareer } from './modes/career';
import { forgeBadge, renderForge } from './modes/forge';
import { currentProfile } from '../core/profiles';
import { autoTutorial, helpButton, type TutId } from './tutorial';
import { gymBadge, renderGym } from './modes/gym';
import { dailyBadge, renderDaily } from './modes/daily';
import { passBadge, renderPass } from './modes/pass';
import { openSettings } from './screens/settings';
import { ico, leagueBadge } from './icons';

export type Tab = 'home' | 'shop' | 'collection' | 'missions' | 'fighter' | 'career' | 'gym' | 'daily' | 'pass' | 'forge';

const TABS: { id: Tab; icon: string; name: string }[] = [
  { id: 'home', icon: 'ring', name: 'Ring' },
  { id: 'fighter', icon: 'fighter', name: 'Fighter' },
  { id: 'shop', icon: 'shop', name: 'Shop' },
  { id: 'collection', icon: 'collection', name: 'Collection' },
  { id: 'missions', icon: 'missions', name: 'Missions' },
];

let current: Tab = 'home';
let sub: string | undefined;
let view: HTMLElement;
let topbar: HTMLElement;
let tabbar: HTMLElement;
let avatar: Preview | null = null;

export function mountApp(root: HTMLElement): void {
  root.innerHTML = '';
  const shell = el('div', 'shell');
  topbar = el('header', 'topbar');
  view = el('main', 'view');
  tabbar = el('nav', 'tabbar');
  shell.append(topbar, view, tabbar);
  root.appendChild(shell);
  buildTopbar();
  buildTabbar();
  onChange(refreshChrome);
  refreshMissions();
  go('home');
  root.addEventListener('pointerdown', unlockAudio, { once: true });
}

function buildTopbar(): void {
  topbar.innerHTML = `
    <button class="tb-me" aria-label="Fighter">
      <div class="tb-avatar"></div>
      <div class="tb-info"><b class="tb-name"></b><div class="tb-xp"><i></i></div></div>
      <span class="tb-lvl"></span>
    </button>
    <div class="tb-cur">
      <button class="pill coins" aria-label="Coins · open the Shop" title="Coins · open the Shop">${ico('coin')}<b></b><i class="pill-plus">+</i></button>
      <button class="pill gems" aria-label="Gems · get more gems" title="Gems · get more">${ico('gem')}<b></b><i class="pill-plus">+</i></button>
      <button class="icon-btn refresh" aria-label="Reload page" title="Reload">${ico('refresh')}</button>
      <button class="icon-btn gear" aria-label="Settings">${ico('gear')}</button>
    </div>`;
  avatar = new Preview(resolveLook(S.appearance, S.loadout), { stage: false, focusHead: true, zoom: 1.05 });
  topbar.querySelector('.tb-avatar')!.appendChild(avatar.canvas);
  (topbar.querySelector('.tb-me') as HTMLElement).onclick = () => go('fighter');
  (topbar.querySelector('.coins') as HTMLElement).onclick = () => {
    sfx.click();
    go('shop', 'featured');
  };
  (topbar.querySelector('.gems') as HTMLElement).onclick = () => {
    sfx.click();
    go('shop', 'gems');
  };
  (topbar.querySelector('.refresh') as HTMLElement).onclick = () => {
    sfx.click();
    save();
    // procura uma versão nova do jogo antes de recarregar
    const reg = navigator.serviceWorker?.getRegistration?.();
    Promise.resolve(reg)
      .then((r) => r?.update())
      .catch(() => {})
      .finally(() => setTimeout(() => location.reload(), 150));
  };
  (topbar.querySelector('.gear') as HTMLElement).onclick = () => {
    sfx.click();
    openSettings();
  };
  refreshChrome();
}

function buildTabbar(): void {
  tabbar.innerHTML = TABS.map((t) => `<button data-tab="${t.id}"><span class="ti">${ico(t.icon)}</span><span class="tn">${t.name}</span><i class="badge"></i></button>`).join('');
  tabbar.querySelectorAll('button').forEach((b) => {
    b.onclick = () => {
      sfx.click();
      go(b.dataset.tab as Tab);
    };
  });
}

let lastCoins = -1;
let lastGems = -1;
export function refreshChrome(): void {
  if (!topbar) return;
  const nm = topbar.querySelector('.tb-name') as HTMLElement;
  nm.textContent = S.name;
  if (currentProfile() === 'fresh') nm.insertAdjacentHTML('beforeend', '<span class="tb-fresh">NEW PLAYER</span>');
  (topbar.querySelector('.tb-lvl') as HTMLElement).textContent = String(S.level);
  (topbar.querySelector('.tb-xp i') as HTMLElement).style.transform = `scaleX(${Math.min(1, S.xp / xpToNext(S.level))})`;
  if (S.coins !== lastCoins) {
    const b = topbar.querySelector('.coins b') as HTMLElement;
    b.textContent = short(S.coins);
    if (lastCoins >= 0) bump(b.parentElement!);
    lastCoins = S.coins;
  }
  if (S.gems !== lastGems) {
    const b = topbar.querySelector('.gems b') as HTMLElement;
    b.textContent = short(S.gems);
    if (lastGems >= 0) bump(b.parentElement!);
    lastGems = S.gems;
  }
  if (avatar) avatar.look = resolveLook(S.appearance, S.loadout);
  const badges: Partial<Record<Tab, number>> = {
    home: Object.values(S.chests).reduce((a, b) => a + b, 0) + careerBadge() + gymBadge() + dailyBadge() + passBadge(),
    shop: S.giftDay !== dayKey() ? 1 : 0,
    collection: forgeBadge(),
    missions: claimableCount(),
    fighter: S.statPoints,
  };
  tabbar.querySelectorAll('button').forEach((b) => {
    const id = b.dataset.tab as Tab;
    b.classList.toggle('on', id === current || (id === 'home' && ['career', 'gym', 'daily', 'pass'].includes(current)) || (id === 'collection' && current === 'forge'));
    const n = badges[id] ?? 0;
    const i = b.querySelector('.badge') as HTMLElement;
    i.textContent = n > 0 ? (n > 9 ? '9+' : String(n)) : '';
    i.style.display = n > 0 ? '' : 'none';
  });
}

/** Números compactos para a barra de topo (ex.: 100K, 1,2M). */
function short(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M';
  if (n >= 1e4) return Math.floor(n / 1e3) + 'K';
  return fmt(n);
}

function bump(e: HTMLElement): void {
  e.classList.remove('bump');
  void e.offsetWidth;
  e.classList.add('bump');
}

export function go(tab: Tab, subTab?: string): void {
  current = tab;
  sub = subTab;
  render();
}

let rendered = '';

/** Os ecrãs chamam isto quando mudam de separador interno, para o redesenho manter o separador. */
export function rememberSub(s: string): void {
  sub = s;
  rendered = `${current}|${s}`;
}

export function render(): void {
  if (!view) return;
  // redesenhar o mesmo ecrã (ex.: depois de equipar um traje) mantém a posição do scroll
  const keep = `${current}|${sub ?? ''}` === rendered ? view.scrollTop : 0;
  view.innerHTML = '';
  const page = el('div', `page page-${current}`);
  view.appendChild(page);
  switch (current) {
    case 'home':
      renderHome(page);
      break;
    case 'shop':
      renderShop(page, sub);
      break;
    case 'collection':
      renderCollection(page, sub);
      break;
    case 'missions':
      renderMissions(page, sub);
      break;
    case 'fighter':
      renderFighter(page, sub);
      break;
    case 'career':
      renderCareer(page, sub);
      break;
    case 'gym':
      renderGym(page, sub);
      break;
    case 'daily':
      renderDaily(page, sub);
      break;
    case 'pass':
      renderPass(page, sub);
      break;
    case 'forge':
      renderForge(page, sub);
      break;
  }
  rendered = `${current}|${sub ?? ''}`;
  view.scrollTop = keep;
  // guia da secção: botão "?" sempre à mão e abre sozinho na primeira visita
  const tut = TUT_OF[current];
  page.appendChild(helpButton(tut, 'tut-fab'));
  autoTutorial(tut);
  refreshChrome();
}

const TUT_OF: Record<Tab, TutId> = {
  home: 'home',
  shop: 'shop',
  collection: 'collection',
  missions: 'missions',
  fighter: 'fighter',
  career: 'career',
  gym: 'gym',
  daily: 'daily',
  pass: 'pass',
  forge: 'forge',
};

export function currentTab(): Tab {
  return current;
}

export function leagueChip(): string {
  const L = leagueOf(S.trophies);
  return `<span class="league" style="--lc:${L.color}">${leagueBadge(L.id, L.color)} ${esc(L.name)}</span>`;
}

export function save(): void {
  commit();
}
