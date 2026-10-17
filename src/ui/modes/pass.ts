import './pass.css';
import {
  BONUS_REWARD, CHALLENGES_PER_WEEK, P, PASS_PRICE, TIERS, TIER_PRICE, TIER_XP,
  addPassXp, awardFight, bonusAvailable, buyPremium, buyTier, canClaim, challenge, claim, claimAll, claimBonus,
  currentTier, onPassGain, rarityTierOf, rewardRarity, seasonAt, seasonTiers, syncPass, takeCarried, unclaimedCount, xpInTier,
  type Claimed, type PassReward,
} from '../../core/pass';
import { S } from '../../core/state';
import { CHESTS } from '../../data/chests';
import { ITEMS, KIND_NAMES } from '../../data/items';
import { RARITIES } from '../../data/rarity';
import { sfx } from '../../audio/sfx';
import { go, render, rememberSub } from '../app';
import { el, esc, fmt, modal, rarityTag, toast } from '../dom';
import { ico } from '../icons';
import { itemThumb } from '../preview';
import { openItem } from '../screens/itemModal';
import { chestSvg } from '../screens/home';

const COL = 90; // largura de uma coluna do trilho (inclui o espaço)

// ───────────────────────── Avisos de XP depois dos combates ─────────────────────────

onPassGain((g) => {
  setTimeout(() => {
    toast(`+${fmt(g.xp)} Pass XP${g.to > g.from ? ` · Tier ${g.to} reached!` : ''}`, 'ok');
    for (const c of g.completed) toast(`Pass challenge complete: ${c.text} (+${fmt(c.xp)} XP)`, 'ok');
  }, 900);
});

if (import.meta.env.DEV) {
  (window as unknown as { __pass: unknown }).__pass = { P, addPassXp, awardFight, unclaimedCount };
}

// ───────────────────────── Peças ─────────────────────────

function rewardName(r: PassReward): string {
  switch (r.kind) {
    case 'coins':
      return `${fmt(r.n)} Coins`;
    case 'gems':
      return `${fmt(r.n)} Gems`;
    case 'xp':
      return `${fmt(r.n)} XP`;
    case 'stat':
      return `${r.n} Stat point${r.n > 1 ? 's' : ''}`;
    case 'chest':
      return CHESTS[r.id].name;
    case 'item':
      return ITEMS[r.id]?.name ?? 'Item';
  }
}

function shortLabel(r: PassReward): string {
  switch (r.kind) {
    case 'coins':
    case 'gems':
    case 'xp':
      return `${r.kind === 'xp' ? '+' : '×'}${fmt(r.n)}${r.kind === 'xp' ? ' XP' : ''}`;
    case 'stat':
      return `+${r.n} Stat`;
    case 'chest':
      return CHESTS[r.id].name.replace(' Chest', '');
    case 'item':
      return ITEMS[r.id]?.name ?? '';
  }
}

function rewardArt(r: PassReward): HTMLElement {
  const box = el('div', 'fp-art');
  if (r.kind === 'item') box.appendChild(itemThumb(r.id));
  else if (r.kind === 'chest') box.innerHTML = chestSvg(CHESTS[r.id].body, CHESTS[r.id].trim);
  else box.innerHTML = ico(r.kind === 'coins' ? 'coin' : r.kind === 'gems' ? 'gem' : r.kind === 'xp' ? 'xp' : 'fist', 'fp-ico');
  return box;
}

function timeLeftLong(ms: number): string {
  if (ms <= 0) return 'ending…';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m`;
}

/** Próxima segunda-feira 00:00 (hora local): quando os desafios mudam. */
function nextWeek(): number {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  return d.getTime();
}

// ───────────────────────── Ecrã ─────────────────────────

let trackScroll = -1;

export function renderPass(page: HTMLElement, sub?: string): void {
  syncPass();
  const tab = sub === 'challenges' ? 'challenges' : 'rewards';
  const season = seasonAt();
  const tier = currentTier();
  const maxed = tier >= TIERS;
  const pending = unclaimedCount();
  const chDone = P.done.filter(Boolean).length;
  page.style.setProperty('--sc', season.color);

  const carried = takeCarried();
  if (carried) toast(`Season ${carried.season} ended: ${carried.count} unclaimed rewards were delivered!`, 'ok');

  const head = el('div', 'fp-head');
  head.innerHTML = `
    <button class="fp-back" aria-label="Back">‹</button>
    <div class="fp-title">
      <h1>FIGHT PASS${P.premium ? ` <span class="fp-prem-tag">${ico('crown')} PREMIUM</span>` : ''}</h1>
      <div class="fp-season"><b>Season ${season.n}:</b> ${esc(season.name)} <span class="fp-time">${ico('clock')} <em>${timeLeftLong(season.end - Date.now())}</em></span></div>
    </div>
    <div class="fp-lvl">
      <div class="fp-badge"><small>TIER</small>${tier}</div>
      <div class="fp-xpw">
        <div class="fp-xpbar"><i style="transform:scaleX(${xpInTier() / TIER_XP})"></i></div>
        <span>${maxed ? `Bonus: ${fmt(xpInTier())} / ${fmt(TIER_XP)} XP` : `${fmt(xpInTier())} / ${fmt(TIER_XP)} XP to tier ${tier + 1}`}</span>
      </div>
    </div>
    <div class="seg fp-seg">
      <button data-t="rewards" class="${tab === 'rewards' ? 'on' : ''}">${ico('gift')} Rewards</button>
      <button data-t="challenges" class="${tab === 'challenges' ? 'on' : ''}">${ico('target')} Challenges <b class="fp-chc">${chDone}/${CHALLENGES_PER_WEEK}</b></button>
    </div>
    <div class="fp-acts"></div>`;
  page.appendChild(head);
  (head.querySelector('.fp-back') as HTMLElement).onclick = () => {
    sfx.click();
    go('home');
  };
  head.querySelectorAll<HTMLElement>('.fp-seg button').forEach((b) => {
    b.onclick = () => {
      sfx.click();
      trackScroll = -1;
      rememberSub(b.dataset.t!);
      go('pass', b.dataset.t);
    };
  });

  const acts = head.querySelector('.fp-acts') as HTMLElement;
  if (!maxed) {
    const bt = el('button', 'btn btn-ghost sm fp-buytier', `+1 Tier ${ico('gem')}${TIER_PRICE}`);
    bt.onclick = () => openBuyTier();
    acts.appendChild(bt);
  }
  const ca = el('button', `btn btn-gold sm fp-claimall ${pending ? 'pulse' : ''}`, `${ico('gift')} Claim all${pending ? ` <b>${pending}</b>` : ''}`);
  ca.disabled = !pending;
  ca.onclick = () => {
    const got = claimAll();
    if (got.length) reveal(got);
  };
  acts.appendChild(ca);
  if (!P.premium) {
    const bp = el('button', 'btn btn-red sm fp-buyprem', `${ico('crown')} Premium`);
    bp.onclick = () => openPremium();
    acts.appendChild(bp);
  }

  // contagem decrescente viva
  const timeEl = head.querySelector('.fp-time em') as HTMLElement;
  const iv = window.setInterval(() => {
    if (!timeEl.isConnected) return clearInterval(iv);
    timeEl.textContent = timeLeftLong(seasonAt().end - Date.now());
  }, 30000);

  if (tab === 'rewards') renderTrack(page, tier);
  else renderChallenges(page);
}

function renderTrack(page: HTMLElement, tier: number): void {
  const tiers = seasonTiers(P.season);
  const wrap = el('div', 'fp-wrap');
  wrap.innerHTML = `<div class="fp-lanes"><div class="fp-lane prem">${ico(P.premium ? 'crown' : 'lock')}<span>PREMIUM</span></div><div class="fp-lane free"><span>FREE</span></div></div>`;
  const track = el('div', 'fp-track');
  const inner = el('div', 'fp-inner');
  inner.style.width = `${(TIERS + 1) * COL + 8}px`;
  const frac = xpInTier() / TIER_XP;
  const fillX = tier >= TIERS ? TIERS * COL : tier === 0 ? frac * (COL / 2) : (tier - 1) * COL + COL / 2 + frac * COL;
  inner.innerHTML = `<div class="fp-rail"><i style="transform:scaleX(${fillX / ((TIERS + 1) * COL)})"></i></div>`;

  for (const t of tiers) {
    const col = el('div', `fp-col ${t.n <= tier ? 'reached' : ''} ${t.n === tier + 1 ? 'next' : ''} ${t.n % 10 === 0 ? 'mile' : ''}`);
    col.appendChild(card(t.prem, t.n, 'prem', tier));
    col.appendChild(el('div', 'fp-num', `<b>${t.n}</b>`));
    col.appendChild(card(t.free, t.n, 'free', tier));
    inner.appendChild(col);
  }
  // nível bónus (repetível) depois do 40
  const bcol = el('div', `fp-col bonus ${tier >= TIERS ? 'reached' : ''}`);
  const bn = bonusAvailable();
  const bcard = el('button', `fp-card r-incomum bonus ${bn ? 'claim' : tier >= TIERS ? '' : 'future'}`);
  bcard.appendChild(rewardArt(BONUS_REWARD));
  bcard.appendChild(el('div', 'fp-lbl', bn ? `×${bn} ready` : 'Every 1,000 XP'));
  bcard.onclick = () => {
    if (bonusAvailable()) {
      const c = claimBonus();
      if (c) reveal([c]);
    } else toast(`Bonus tier: after tier ${TIERS}, every ${fmt(TIER_XP)} Pass XP earns a Silver Chest.`, 'info');
  };
  bcol.appendChild(el('div', 'fp-bonus-h', `${ico('star')}<span>BONUS</span>`));
  bcol.appendChild(el('div', 'fp-num', `<b>${TIERS}+</b>`));
  bcol.appendChild(bcard);
  inner.appendChild(bcol);

  track.appendChild(inner);
  wrap.appendChild(track);
  page.appendChild(wrap);

  const how = el('div', 'fp-how muted small', `${ico('xp')} Pass XP: Win <b>+100</b> · Loss <b>+40</b> · KO <b>+20</b> · Super KO <b>+50</b> · Flawless <b>+40</b> · Tag <b>×1.25</b> · Champion <b>×1.5</b>${P.premium ? ' · Premium <b>+20%</b>' : ''} · Weekly challenges <b>up to +1,500</b>`);
  page.appendChild(how);

  requestAnimationFrame(() => {
    if (trackScroll >= 0) track.scrollLeft = trackScroll;
    else {
      // primeiro por recolher, senão o próximo nível
      let focus = tier + 1;
      for (let n = 1; n <= tier; n++) if (canClaim(n, 'free') || canClaim(n, 'prem')) {
        focus = n;
        break;
      }
      track.scrollLeft = Math.max(0, (Math.min(TIERS + 1, focus) - 1) * COL - track.clientWidth / 2 + COL / 2);
    }
  });
  track.addEventListener('scroll', () => (trackScroll = track.scrollLeft), { passive: true });
}

function card(r: PassReward, n: number, track: 'free' | 'prem', tier: number): HTMLElement {
  const rar = rewardRarity(r);
  const claimed = (track === 'free' ? P.free : P.prem).includes(n);
  const locked = track === 'prem' && !P.premium;
  const ready = canClaim(n, track);
  const state = claimed ? 'claimed' : ready ? 'claim' : locked ? 'locked' : n > tier ? 'future' : '';
  const top = track === 'prem' && n === TIERS;
  const c = el('button', `fp-card ${track} r-${rar} ${state} ${r.kind === 'item' ? 'is-item' : ''} ${top ? 'top' : ''}`);
  c.appendChild(rewardArt(r));
  c.appendChild(el('div', 'fp-lbl', esc(shortLabel(r))));
  if (top) c.appendChild(el('div', 'fp-excl', 'EXCLUSIVE'));
  if (claimed) c.appendChild(el('i', 'fp-st ok', ico('check')));
  else if (locked) c.appendChild(el('i', 'fp-st lock', ico('lock')));
  c.onclick = () => {
    if (ready) {
      const got = claim(n, track);
      if (got) reveal([got]);
      return;
    }
    if (r.kind === 'item') {
      sfx.click();
      openItem(r.id, 'collection');
      return;
    }
    if (locked) {
      openPremium();
      return;
    }
    sfx.click();
    toast(`Tier ${n} ${track === 'prem' ? 'Premium' : 'Free'}: ${rewardName(r)}${claimed ? ' (claimed)' : n > tier ? ` · reach tier ${n}` : ''}`, 'info');
  };
  return c;
}

function renderChallenges(page: HTMLElement): void {
  const box = el('div', 'fp-chs');
  box.appendChild(el('div', 'fp-ch-head', `<span>${ico('calendar')} Weekly Pass challenges</span><span class="muted">${ico('clock')} New in ${timeLeftLong(nextWeek() - Date.now())}</span>`));
  const grid = el('div', 'fp-ch-grid');
  P.ch.forEach((id, i) => {
    const c = challenge(id);
    const prog = Math.min(c.target, P.prog[i] ?? 0);
    const done = !!P.done[i];
    const row = el('div', `fp-ch ${done ? 'done' : ''}`);
    row.innerHTML = `
      <div class="fp-ch-ico">${ico(done ? 'check' : c.icon)}</div>
      <div class="fp-ch-body">
        <b>${esc(c.text)}</b>
        <div class="fp-ch-bar"><i style="transform:scaleX(${prog / c.target})"></i><span>${fmt(prog)} / ${fmt(c.target)}</span></div>
      </div>
      <div class="fp-ch-xp">${done ? 'DONE' : `+${fmt(c.xp)}`}<small>PASS XP</small></div>`;
    grid.appendChild(row);
  });
  box.appendChild(grid);
  box.appendChild(el('div', 'fp-how muted small', 'Challenge XP is added automatically when you finish a challenge. Fights in any mode count.'));
  page.appendChild(box);
}

// ───────────────────────── Compras ─────────────────────────

function openPremium(): void {
  sfx.click();
  const tiers = seasonTiers(P.season);
  const top = tiers[TIERS - 1].prem;
  const items = tiers.filter((t) => t.prem.kind === 'item').length;
  const gems = tiers.reduce((a, t) => a + (t.prem.kind === 'gems' ? t.prem.n : 0), 0);
  const body = el('div', 'fp-pm');
  const hero = el('div', `fp-pm-hero r-${rewardRarity(top)}`);
  hero.appendChild(rewardArt(top));
  hero.appendChild(el('div', 'fp-pm-name', `<small>TIER ${TIERS} · SEASON EXCLUSIVE</small><b class="rar-${rewardRarity(top)}">${esc(rewardName(top))}</b>${rarityTag(rewardRarity(top))}`));
  hero.onclick = () => top.kind === 'item' && openItem(top.id, 'collection');
  body.appendChild(hero);
  body.appendChild(el('ul', 'fp-pm-list', `
    <li>${ico('gift')} <b>40 premium rewards</b> unlocked instantly for every tier you've reached</li>
    <li>${ico('star')} <b>${items} cosmetic items</b> up to Mythic + the exclusive reward</li>
    <li>${ico('gem')} <b>${fmt(gems)} gems</b> back, plus Gold, Legendary &amp; Mythic chests</li>
    <li>${ico('xp')} <b>+20% Pass XP</b> from every fight</li>`));
  modal(`${ico('crown')} Premium Pass`, body, [
    { label: 'Not now', cls: 'btn-ghost' },
    {
      label: `Unlock ${ico('gem')} ${fmt(PASS_PRICE)}`,
      cls: 'btn-gold',
      onClick: () => {
        if (S.gems < PASS_PRICE) {
          toast('Not enough gems.', 'err');
          return false;
        }
        if (!buyPremium()) return false;
        sfx.reveal(5);
        toast('Premium Pass unlocked!', 'ok');
        trackScroll = -1;
        render();
      },
    },
  ], 'fp-modal');
}

function openBuyTier(): void {
  sfx.click();
  const next = currentTier() + 1;
  const t = seasonTiers(P.season)[next - 1];
  const body = el('div', 'fp-bt');
  const row = el('div', 'fp-bt-row');
  for (const [r, tr] of [[t.free, 'free'], [t.prem, 'prem']] as const) {
    const c = el('div', `fp-card ${tr} r-${rewardRarity(r)} ${tr === 'prem' && !P.premium ? 'locked' : ''}`);
    c.appendChild(rewardArt(r));
    c.appendChild(el('div', 'fp-lbl', esc(shortLabel(r))));
    if (tr === 'prem' && !P.premium) c.appendChild(el('i', 'fp-st lock', ico('lock')));
    row.appendChild(c);
  }
  body.appendChild(el('p', '', `Skip straight to <b>tier ${next}</b> and unlock its rewards.`));
  body.appendChild(row);
  modal(`Buy tier ${next}`, body, [
    { label: 'Cancel', cls: 'btn-ghost' },
    {
      label: `Buy ${ico('gem')} ${TIER_PRICE}`,
      cls: 'btn-gold',
      onClick: () => {
        if (S.gems < TIER_PRICE) {
          toast('Not enough gems.', 'err');
          return false;
        }
        if (!buyTier()) return false;
        sfx.levelUp();
        toast(`Tier ${next} reached!`, 'ok');
        trackScroll = -1;
        render();
      },
    },
  ], 'fp-modal');
}

// ───────────────────────── Revelação de recompensas ─────────────────────────

function reveal(list: Claimed[]): void {
  const best = list.reduce((a, b) => (rarityTierOf(b.reward) > rarityTierOf(a.reward) ? b : a), list[0]);
  const bestTier = rarityTierOf(best.reward);
  const items = list.filter((c) => c.reward.kind === 'item');
  const hero = items.length ? items.reduce((a, b) => (rarityTierOf(b.reward) > rarityTierOf(a.reward) ? b : a)) : list.length === 1 ? list[0] : null;
  const rar = hero ? rewardRarity(hero.reward) : rewardRarity(best.reward);
  const col = rar === 'celestial' ? '#7af7ff' : RARITIES[rar].color;

  const root = el('div', `fp-reveal r-${rar}`);
  root.style.setProperty('--rc', col);
  root.innerHTML = `<div class="fp-rays"></div><div class="fp-rv-box"></div>`;
  const box = root.querySelector('.fp-rv-box') as HTMLElement;
  box.appendChild(el('h2', 'fp-rv-title', list.length === 1 ? (list[0].track === 'bonus' ? 'BONUS REWARD!' : `TIER ${list[0].tier} REWARD!`) : `${list.length} REWARDS!`));
  if (hero) {
    const h = el('div', `fp-rv-hero r-${rar}`);
    h.appendChild(rewardArt(hero.reward));
    const d = hero.reward.kind === 'item' ? ITEMS[hero.reward.id] : null;
    h.appendChild(el('div', 'fp-rv-name', `<b class="rar-${rar}">${esc(rewardName(hero.reward))}</b>${d ? `<div>${rarityTag(d.rarity)} <span class="muted small">${KIND_NAMES[d.kind]}</span></div>` : ''}`));
    if (d) {
      h.onclick = () => {
        sfx.click();
        openItem(d.id, 'collection');
      };
      h.appendChild(el('div', 'fp-rv-tap muted small', `${ico('eye')} Tap to preview`));
    }
    box.appendChild(h);
  }
  const rest = list.filter((c) => c !== hero);
  if (rest.length) {
    const strip = el('div', 'fp-rv-strip');
    rest.forEach((c, i) => {
      const k = el('div', `fp-card mini ${c.track === 'prem' ? 'prem' : 'free'} r-${rewardRarity(c.reward)}`);
      k.style.animationDelay = `${0.25 + Math.min(i, 20) * 0.05}s`;
      k.appendChild(rewardArt(c.reward));
      k.appendChild(el('div', 'fp-lbl', esc(shortLabel(c.reward))));
      if (c.reward.kind === 'item') {
        const id = c.reward.id;
        k.onclick = () => {
          sfx.click();
          openItem(id, 'collection');
        };
      }
      strip.appendChild(k);
    });
    box.appendChild(strip);
  }
  const ok = el('button', 'btn btn-gold fp-rv-ok', 'Collect');
  box.appendChild(ok);
  document.body.appendChild(root);
  sfx.reveal(Math.max(bestTier, items.length ? bestTier : 1));
  if (list.some((c) => c.reward.kind === 'coins' || c.reward.kind === 'gems')) setTimeout(() => sfx.coin(), 250);
  const close = () => {
    sfx.click();
    root.classList.add('out');
    setTimeout(() => root.remove(), 200);
    render();
  };
  ok.onclick = close;
  root.onclick = (e) => {
    if (e.target === root) close();
  };
}

/** Número para o "badge" de notificação deste modo (0 = nada por fazer). */
export function passBadge(): number {
  return unclaimedCount();
}
