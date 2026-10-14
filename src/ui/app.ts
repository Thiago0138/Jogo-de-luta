import { S, claimableCount, commit, onChange, refreshMissions } from '../core/state';
import { xpToNext } from '../data/stats';
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
import { openSettings } from './screens/settings';

export type Tab = 'home' | 'shop' | 'collection' | 'missions' | 'fighter';

const TABS: { id: Tab; icon: string; name: string }[] = [
  { id: 'home', icon: '🏟️', name: 'Ringue' },
  { id: 'shop', icon: '🛒', name: 'Loja' },
  { id: 'collection', icon: '🎒', name: 'Coleção' },
  { id: 'missions', icon: '📜', name: 'Missões' },
  { id: 'fighter', icon: '💪', name: 'Lutador' },
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
    <button class="tb-me" aria-label="Lutador">
      <div class="tb-avatar"></div>
      <div class="tb-info"><b class="tb-name"></b><div class="tb-xp"><i></i></div></div>
      <span class="tb-lvl"></span>
    </button>
    <div class="tb-cur">
      <button class="pill coins" aria-label="Moedas">🪙 <b></b></button>
      <button class="pill gems" aria-label="Gemas">💎 <b></b></button>
      <button class="icon-btn refresh" aria-label="Recarregar página" title="Recarregar">🔄</button>
      <button class="icon-btn gear" aria-label="Definições">⚙️</button>
    </div>`;
  avatar = new Preview(resolveLook(S.appearance, S.loadout), { stage: false, focusHead: true, zoom: 1.05 });
  topbar.querySelector('.tb-avatar')!.appendChild(avatar.canvas);
  (topbar.querySelector('.tb-me') as HTMLElement).onclick = () => go('fighter');
  (topbar.querySelector('.coins') as HTMLElement).onclick = () => go('shop');
  (topbar.querySelector('.gems') as HTMLElement).onclick = () => go('shop', 'gems');
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
  tabbar.innerHTML = TABS.map((t) => `<button data-tab="${t.id}"><span class="ti">${t.icon}</span><span class="tn">${t.name}</span><i class="badge"></i></button>`).join('');
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
  (topbar.querySelector('.tb-name') as HTMLElement).textContent = S.name;
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
  const badges: Record<Tab, number> = {
    home: Object.values(S.chests).reduce((a, b) => a + b, 0),
    shop: 0,
    collection: 0,
    missions: claimableCount(),
    fighter: S.statPoints,
  };
  tabbar.querySelectorAll('button').forEach((b) => {
    const id = b.dataset.tab as Tab;
    b.classList.toggle('on', id === current);
    const n = badges[id];
    const i = b.querySelector('.badge') as HTMLElement;
    i.textContent = n > 0 ? (n > 9 ? '9+' : String(n)) : '';
    i.style.display = n > 0 ? '' : 'none';
  });
}

/** Números compactos para a barra de topo (ex.: 100K, 1,2M). */
function short(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',') + 'M';
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

export function render(): void {
  if (!view) return;
  view.innerHTML = '';
  view.scrollTop = 0;
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
  }
  refreshChrome();
}

export function currentTab(): Tab {
  return current;
}

export function leagueChip(): string {
  const L = leagueOf(S.trophies);
  return `<span class="league" style="--lc:${L.color}">${L.icon} ${esc(L.name)}</span>`;
}

export function save(): void {
  commit();
}
