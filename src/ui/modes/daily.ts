import './daily.css';
import { sfx, unlockAudio } from '../../audio/sfx';
import * as A from '../../core/dailyAudio';
import {
  D, DAY7_ODDS, GIFT_TABLE, HOT_MILESTONES, LOGIN_REWARDS, SCRATCH_CHARGE, SCRATCH_GEM_COST, SCRATCH_LOSE, SCRATCH_TABLE,
  SPIN_CHARGE, SPIN_GEM_COST, TASK_BONUS, WHEEL, badgeCount, bonusReady, claimBonus, claimHot, claimLogin, claimTask,
  collectPending, ensureTasks, finishScratch, freeScratchReady, freeSpinReady, giftReady, loginPrize, loginStatus,
  msToMidnight, newScratch, onDailyEarn, openGift, prizeTier, scratchesAvailable, spinWheel, spinsAvailable, task,
  tasksClaimable, weekBonus, type Prize, type PrizeResult, type Sym, type WheelSeg,
} from '../../core/daily';
import { S } from '../../core/state';
import { CHESTS, type ChestId } from '../../data/chests';
import { item } from '../../data/items';
import { RARITIES, type Rarity } from '../../data/rarity';
import { rememberSub, render } from '../app';
import { openChest } from '../chest';
import { el, esc, fmt, modal, toast } from '../dom';
import { ico } from '../icons';
import { itemThumb } from '../preview';
import { chestSvg } from '../screens/home';

type Sub = 'login' | 'wheel' | 'scratch' | 'tasks' | 'gift';
const TABS: { id: Sub; name: string; icon: string }[] = [
  { id: 'login', name: 'Login', icon: 'calendar' },
  { id: 'wheel', name: 'Wheel', icon: 'star' },
  { id: 'scratch', name: 'Scratch', icon: 'sparkle' },
  { id: 'tasks', name: 'Challenges', icon: 'fire' },
  { id: 'gift', name: 'Gift', icon: 'gift' },
];

onDailyEarn((msg) => toast(msg, 'ok'));

let spinning = false;

// ───────────────────────── Helpers ─────────────────────────

function dur(ms: number): string {
  if (ms <= 0) return 'now';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function chestArt(id: ChestId): string {
  const c = CHESTS[id];
  return chestSvg(c.body, c.trim);
}

function ticketSvg(): string {
  return `<svg viewBox="0 0 64 44" aria-hidden="true"><path d="M4 6h56v10a6 6 0 0 0 0 12v10H4V28a6 6 0 0 0 0-12z" fill="#ff5fa2" stroke="#140a1c" stroke-width="3"/><rect x="14" y="12" width="36" height="20" rx="3" fill="#d9e2ee" stroke="#140a1c" stroke-width="2"/><path d="M20 22h24" stroke="#8a93a6" stroke-width="3" stroke-dasharray="3 3"/></svg>`;
}

interface Part {
  art: string;
  text: string;
  cls: string;
}

function prizeParts(p: Prize): Part[] {
  const out: Part[] = [];
  if (p.item) {
    const d = item(p.item);
    out.push({ art: '', text: d.name, cls: `item rar-${d.rarity}` });
  }
  if (p.chest) out.push({ art: chestArt(p.chest), text: CHESTS[p.chest].name, cls: 'chest' });
  if (p.gems) out.push({ art: ico('gem'), text: `${fmt(p.gems)} Gems`, cls: 'gems' });
  if (p.coins) out.push({ art: ico('coin'), text: `${fmt(p.coins)} Coins`, cls: 'coins' });
  if (p.xp) out.push({ art: ico('xp'), text: `${p.xp} XP`, cls: 'xp' });
  if (p.spins) out.push({ art: wheelMini(), text: `+${p.spins} Wheel Spin`, cls: 'spin' });
  if (p.scratches) out.push({ art: ticketSvg(), text: `+${p.scratches} Scratch Card`, cls: 'ticket' });
  return out;
}

function wheelMini(): string {
  const cols = ['#3a7bff', '#9b3dff', '#20b866', '#ff8a1a', '#ff3d6e', '#3a7bff', '#9b3dff', '#ff8a1a'];
  const segs = cols
    .map((c, i) => {
      const a0 = (i / 8) * Math.PI * 2;
      const a1 = ((i + 1) / 8) * Math.PI * 2;
      return `<path d="M20 20L${20 + 17 * Math.cos(a0)} ${20 + 17 * Math.sin(a0)}A17 17 0 0 1 ${20 + 17 * Math.cos(a1)} ${20 + 17 * Math.sin(a1)}Z" fill="${c}"/>`;
    })
    .join('');
  return `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="19" fill="#ffd23d" stroke="#140a1c" stroke-width="2"/>${segs}<circle cx="20" cy="20" r="5" fill="#ffd23d" stroke="#140a1c" stroke-width="2"/></svg>`;
}

function chips(p: Prize): string {
  return prizeParts(p)
    .map((x) => `<span class="dl-chip ${x.cls}">${x.art ? `<i>${x.art}</i>` : ''}${esc(x.text)}</span>`)
    .join('');
}

// ───────────────────────── Juice: confetti, fly-to-wallet, bursts ─────────────────────────

const CONF_COLS = ['#ffd23d', '#ff3d6e', '#3aa0ff', '#4cd964', '#b45cff', '#ffffff', '#ff9f1a'];
interface Conf {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  vr: number;
  w: number;
  h: number;
  c: string;
  t: number;
}
let confCanvas: HTMLCanvasElement | null = null;
let confParts: Conf[] = [];
let confRaf = 0;

function confetti(n = 120, ox = 0.5, oy = 0.45): void {
  if (!confCanvas) {
    confCanvas = el('canvas', 'dl-confetti');
    document.body.appendChild(confCanvas);
  }
  const cv = confCanvas;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(innerWidth * dpr);
  cv.height = Math.round(innerHeight * dpr);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
    const v = 380 + Math.random() * 620;
    confParts.push({
      x: innerWidth * ox, y: innerHeight * oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      r: Math.random() * 6, vr: (Math.random() - 0.5) * 14, w: 5 + Math.random() * 6, h: 3 + Math.random() * 5,
      c: CONF_COLS[i % CONF_COLS.length], t: 0,
    });
  }
  if (confRaf) return;
  let last = performance.now();
  const ctx = cv.getContext('2d')!;
  const step = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    confParts = confParts.filter((p) => p.y < innerHeight + 30 && p.t < 4.5);
    for (const p of confParts) {
      p.t += dt;
      p.vy += 900 * dt;
      p.vx *= 1 - 1.6 * dt;
      p.vy *= 1 - 1.2 * dt;
      p.x += p.vx * dt + Math.sin(p.t * 6 + p.r) * 30 * dt;
      p.y += p.vy * dt;
      p.r += p.vr * dt;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.scale(1, Math.cos(p.t * 9 + p.r));
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (confParts.length) confRaf = requestAnimationFrame(step);
    else {
      confRaf = 0;
      cv.remove();
      confCanvas = null;
    }
  };
  confRaf = requestAnimationFrame(step);
}

/** Icons flying from a point to the coin/gem pill in the top bar. */
function flyTo(kind: 'coins' | 'gems', from: DOMRect, n = 8): void {
  const target = document.querySelector(`.topbar .${kind}`) as HTMLElement | null;
  if (!target) return;
  const tr = target.getBoundingClientRect();
  const x1 = tr.left + 16;
  const y1 = tr.top + tr.height / 2;
  for (let i = 0; i < n; i++) {
    const f = el('div', `dl-fly ${kind}`, ico(kind === 'coins' ? 'coin' : 'gem'));
    document.body.appendChild(f);
    const x0 = from.left + from.width / 2 + (Math.random() - 0.5) * 60;
    const y0 = from.top + from.height / 2 + (Math.random() - 0.5) * 40;
    const mx = (x0 + x1) / 2 + (Math.random() - 0.5) * 120;
    const my = Math.min(y0, y1) - 40 - Math.random() * 60;
    const a = f.animate(
      [
        { transform: `translate(${x0}px,${y0}px) scale(0.4)`, opacity: 0 },
        { transform: `translate(${x0}px,${y0 - 20}px) scale(1.2)`, opacity: 1, offset: 0.15 },
        { transform: `translate(${mx}px,${my}px) scale(1)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${x1}px,${y1}px) scale(0.6)`, opacity: 0.9 },
      ],
      { duration: 650 + i * 55, easing: 'cubic-bezier(.45,0,.55,1)', delay: i * 35 },
    );
    a.onfinish = () => {
      f.remove();
      if (i === 0 || i === n - 1) sfx.coin();
      if (i === n - 1) {
        target.classList.remove('bump');
        void target.offsetWidth;
        target.classList.add('bump');
      }
    };
  }
}

function burst(host: HTMLElement, n = 14, color = '#ffd23d'): void {
  const r = host.getBoundingClientRect();
  for (let i = 0; i < n; i++) {
    const s = el('i', 'dl-spark');
    s.style.background = color;
    document.body.appendChild(s);
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
    const d = 40 + Math.random() * 60;
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    s.animate(
      [
        { transform: `translate(${x}px,${y}px) scale(1)`, opacity: 1 },
        { transform: `translate(${x + Math.cos(a) * d}px,${y + Math.sin(a) * d}px) scale(0)`, opacity: 0.2 },
      ],
      { duration: 500 + Math.random() * 300, easing: 'cubic-bezier(.2,.8,.3,1)' },
    ).onfinish = () => s.remove();
  }
}

// ───────────────────────── Prize reveal popup ─────────────────────────

function showPrize(res: PrizeResult | null, title = 'YOU WON!', onClose?: () => void): void {
  if (!res) {
    onClose?.();
    return;
  }
  const p = res.prize;
  const tier = prizeTier(p);
  const back = el('div', `dl-pz t${tier}`);
  const box = el('div', 'dl-pz-box');
  box.innerHTML = `<div class="dl-rays"></div><h2 class="dl-pz-title">${esc(title)}</h2><div class="dl-pz-items"></div><div class="dl-pz-btns"></div>`;
  back.appendChild(box);
  document.body.appendChild(back);
  const items = box.querySelector('.dl-pz-items') as HTMLElement;
  const parts = prizeParts(p);
  parts.forEach((pt, i) => {
    const d = el('div', `dl-pz-it ${pt.cls}`);
    if (pt.cls.startsWith('item') && p.item) {
      const it = item(p.item);
      const art = el('div', 'dl-pz-art');
      art.appendChild(itemThumb(p.item));
      d.appendChild(art);
      d.appendChild(el('b', '', esc(it.name)));
      d.appendChild(el('span', `rar rar-${it.rarity}`, `${RARITIES[it.rarity].name}${res.isNew ? ' · NEW!' : ''}`));
    } else {
      d.innerHTML = `<div class="dl-pz-art">${pt.art}</div><b>${esc(pt.text)}</b>`;
    }
    d.style.animationDelay = `${0.15 + i * 0.22}s`;
    items.appendChild(d);
    setTimeout(() => sfx.reveal(Math.max(0, tier - (parts.length - 1 - i))), 150 + i * 220);
  });
  sfx.open();
  if (tier >= 3) {
    setTimeout(() => {
      confetti(tier >= 4 ? 220 : 130);
      sfx.cheer(tier >= 4 ? 1.4 : 0.8);
    }, 250);
  }
  if (res.level) {
    setTimeout(() => {
      sfx.levelUp();
      toast(`Level up! You're now level ${res.level!.to}`, 'ok');
    }, 700);
  }
  const btns = box.querySelector('.dl-pz-btns') as HTMLElement;
  let done = false;
  const close = (after?: () => void) => {
    if (done) return;
    done = true;
    const r = items.getBoundingClientRect();
    if (p.coins) flyTo('coins', r, Math.min(12, 5 + Math.floor(p.coins / 100)));
    if (p.gems) flyTo('gems', r, Math.min(12, 4 + Math.floor(p.gems / 5)));
    back.classList.add('out');
    setTimeout(() => back.remove(), 220);
    if (after) after();
    else onClose?.();
  };
  const collect = el('button', 'btn btn-gold', 'Collect');
  collect.onclick = () => {
    sfx.click();
    close();
  };
  if (p.chest) {
    const id = p.chest;
    const open = el('button', 'btn btn-blue', `${ico('chest')} Open now`);
    open.onclick = () => {
      sfx.click();
      close(() => {
        if ((S.chests[id] ?? 0) > 0) openChest(id, () => render());
        else onClose?.();
      });
    };
    btns.appendChild(open);
  }
  btns.appendChild(collect);
  setTimeout(() => collect.focus(), 50);
}

function oddsModal(title: string, rows: [string, string, string][], note = ''): void {
  const body = `<table class="dl-odds"><tbody>${rows.map(([a, b, c]) => `<tr><td class="ic">${a}</td><td>${b}</td><td class="pc">${c}</td></tr>`).join('')}</tbody></table>${note ? `<p class="muted small">${note}</p>` : ''}`;
  modal(title, body, [{ label: 'Got it', cls: 'btn-gold' }], 'dl-odds-modal');
}

function pct(n: number): string {
  return `${n < 1 ? n.toFixed(1) : n % 1 ? n.toFixed(1) : n}%`;
}

// ───────────────────────── Page ─────────────────────────

/** Ecrã "daily". */
export function renderDaily(page: HTMLElement, sub?: string): void {
  let cur = (TABS.some((t) => t.id === sub) ? sub : defaultSub()) as Sub;
  rememberSub(cur);
  if (D.pending && !spinning) {
    const r = collectPending();
    if (r) toast(`Wheel prize collected: ${prizeParts(r.prize).map((x) => x.text).join(' + ')}`, 'ok');
  }
  ensureTasks();
  page.innerHTML = '';
  page.classList.add('dl-page');
  const top = el('div', 'dl-top');
  top.innerHTML = `<h1 class="dl-title">${ico('gift')} Daily</h1><div class="seg dl-seg"></div><span class="dl-reset">${ico('clock')} New day in <b data-cd="mid"></b></span>`;
  page.appendChild(top);
  const seg = top.querySelector('.seg') as HTMLElement;
  const body = el('div', 'dl-body');
  page.appendChild(body);

  const drawTabs = () => {
    seg.innerHTML = '';
    for (const t of TABS) {
      const n = tabBadge(t.id);
      const b = el('button', t.id === cur ? 'on' : '', `${ico(t.icon)} ${t.name}${n ? `<i class="dl-dot">${n > 9 ? '9+' : n}</i>` : ''}`);
      b.onclick = () => {
        if (spinning || t.id === cur) return;
        sfx.click();
        cur = t.id;
        rememberSub(cur);
        drawTabs();
        drawBody();
      };
      seg.appendChild(b);
    }
  };
  const drawBody = () => {
    body.innerHTML = '';
    body.className = `dl-body dl-p-${cur}`;
    const refresh = () => {
      if (!page.isConnected) return;
      drawTabs();
      drawBody();
    };
    switch (cur) {
      case 'login':
        panelLogin(body, refresh);
        break;
      case 'wheel':
        panelWheel(body, refresh, drawTabs);
        break;
      case 'scratch':
        panelScratch(body, refresh);
        break;
      case 'tasks':
        panelTasks(body, refresh);
        break;
      case 'gift':
        panelGift(body, refresh);
        break;
    }
    tickTimers(page);
  };
  drawTabs();
  drawBody();

  // one timer for all countdowns on the page
  let lastMid = msToMidnight();
  const timer = setInterval(() => {
    if (!page.isConnected) {
      clearInterval(timer);
      return;
    }
    const m = msToMidnight();
    const newDay = m > lastMid + 1000;
    lastMid = m;
    if ((tickTimers(page) || newDay) && !spinning && !page.querySelector('.dl-scratching')) {
      drawTabs();
      drawBody();
    }
  }, 1000);
}

/** Updates every [data-cd] countdown; returns true if one of them just hit zero. */
function tickTimers(page: HTMLElement): boolean {
  let expired = false;
  page.querySelectorAll<HTMLElement>('[data-cd]').forEach((e) => {
    const k = e.dataset.cd!;
    const ms = k === 'mid' ? msToMidnight() : Number(k) - Date.now();
    if (k !== 'mid' && ms <= 0 && e.dataset.live !== '0') {
      expired = true;
      e.dataset.live = '0';
    }
    e.textContent = dur(ms);
  });
  return expired;
}

function defaultSub(): Sub {
  if (!loginStatus().claimedToday) return 'login';
  if (spinsAvailable() > 0) return 'wheel';
  if (scratchesAvailable() > 0 || D.scratch.active) return 'scratch';
  if (tasksClaimable() > 0) return 'tasks';
  if (giftReady()) return 'gift';
  return 'tasks';
}

function tabBadge(id: Sub): number {
  switch (id) {
    case 'login':
      return loginStatus().claimedToday ? 0 : 1;
    case 'wheel':
      return spinsAvailable();
    case 'scratch':
      return scratchesAvailable() + (D.scratch.active ? 1 : 0);
    case 'tasks':
      return tasksClaimable();
    case 'gift':
      return giftReady() ? 1 : 0;
  }
}

// ───────────────────────── 1. Login calendar ─────────────────────────

function dayArt(i: number): string {
  const p = LOGIN_REWARDS[i].prize;
  if (LOGIN_REWARDS[i].rare) return `<div class="dl-rare-art"><span>?</span></div>`;
  if (p.chest) return chestArt(p.chest);
  if (p.gems) return ico('gem');
  return ico('coin');
}

function panelLogin(body: HTMLElement, refresh: () => void): void {
  const st = loginStatus();
  const cycles = st.claimedToday ? D.login.cycles : st.cycles;
  const week = el('div', 'dl-week');
  const cards: HTMLElement[] = [];
  for (let i = 0; i < 7; i++) {
    const day = i + 1;
    const done = st.claimedToday ? day <= st.done : !st.broken && day <= st.done;
    const lost = st.broken && day <= st.done;
    const today = !st.claimedToday && day === st.day && !st.broken;
    const pr = loginPrize(day, cycles);
    const label = LOGIN_REWARDS[i].rare ? `Rare Item + ${pr.gems} Gems` : prizeParts(pr).map((x) => x.text).join(' + ');
    const c = el('div', `dl-day${done ? ' done' : ''}${lost ? ' lost' : ''}${today ? ' today' : ''}${LOGIN_REWARDS[i].rare ? ' rare' : ''}${st.claimedToday && day === st.day ? ' just' : ''}`);
    c.innerHTML = `<span class="dl-dn">Day ${day}</span><div class="dl-dart">${dayArt(i)}</div><span class="dl-dl">${esc(label)}</span><i class="dl-check">${ico('check')}</i>`;
    week.appendChild(c);
    cards.push(c);
  }
  body.appendChild(week);

  const foot = el('div', 'dl-lfoot');
  const mult = weekBonus(cycles);
  foot.innerHTML = `<div class="dl-linfo"><span class="dl-flame">${ico('fire')}</span><div><b>${st.claimedToday ? `Day ${st.day} claimed!` : st.broken ? 'Streak broken!' : `Day ${st.day} is ready`}</b><small>${
    st.broken
      ? st.canSave
        ? `You missed ${st.missed} day${st.missed > 1 ? 's' : ''}. Save your ${st.done}-day streak or start over.`
        : `You missed ${st.missed} days — the streak resets to Day 1.`
      : `Week ${cycles + 1}${mult > 1 ? ` · rewards ×${mult}` : ''} · finish 7 days to boost next week (up to ×2)`
  }</small></div></div><div class="dl-lbtns"></div>`;
  body.appendChild(foot);
  const btns = foot.querySelector('.dl-lbtns') as HTMLElement;
  const info = el('button', 'btn btn-ghost sm', ico('info'));
  info.title = 'Rewards & odds';
  info.onclick = () => {
    sfx.click();
    oddsModal(
      'Login Calendar',
      [
        ...LOGIN_REWARDS.map((r, i): [string, string, string] => [`D${i + 1}`, esc(r.rare ? `Random item + ${r.prize.gems} Gems` : r.label), '100%']),
        ...Object.entries(DAY7_ODDS).map(([r, w]): [string, string, string] => ['D7', `Item is ${RARITIES[r as Rarity].name}`, pct(w!)]),
      ],
      'Log in every day to climb the track. Missing a day resets the streak unless you spend gems on a Streak Saver (20 gems per missed day, up to 3 days). Each completed week boosts coin and gem rewards by 25% (max ×2). Day 7 items prefer ones you don\'t own yet.',
    );
  };
  btns.appendChild(info);

  const doClaim = (saver: boolean) => {
    unlockAudio();
    const idx = st.broken && !saver ? 0 : st.day - 1;
    const card = cards[idx];
    if (st.broken && !saver) cards.forEach((c) => c.classList.remove('lost'));
    btns.querySelectorAll('button').forEach((b) => ((b as HTMLButtonElement).disabled = true));
    card.classList.add('claiming');
    sfx.whoosh();
    setTimeout(() => {
      const r = claimLogin(saver);
      if (!r) {
        refresh();
        return;
      }
      card.classList.remove('claiming');
      card.classList.add('done', 'stamp');
      sfx.stamp();
      A.pop(4);
      burst(card, 18, r.day === 7 ? '#b45cff' : '#ffd23d');
      setTimeout(() => showPrize(r.res, r.day === 7 ? 'DAY 7 JACKPOT!' : `DAY ${r.day} REWARD`, refresh), 450);
    }, 520);
  };

  if (!st.claimedToday) {
    if (st.broken && st.canSave) {
      const save = el('button', 'btn btn-blue', `Save streak · ${st.saveCost} ${ico('gem')}`);
      save.disabled = S.gems < st.saveCost;
      save.onclick = () => doClaim(true);
      btns.appendChild(save);
    }
    const claim = el('button', 'btn btn-gold pulse', st.broken ? 'Restart · Day 1' : `Claim Day ${st.day}`);
    claim.onclick = () => doClaim(false);
    btns.appendChild(claim);
  } else {
    btns.appendChild(el('span', 'dl-next', `Next reward in <b data-cd="mid"></b>`));
  }
  // the "next day" card glows softly when today is done
  if (st.claimedToday) cards[st.day % 7]?.classList.add('next');
}

// ───────────────────────── 2. Lucky Wheel ─────────────────────────

const TAU = Math.PI * 2;

function drawIcon(c: CanvasRenderingContext2D, kind: WheelSeg['icon'], s: number, chest?: ChestId): void {
  c.save();
  c.lineWidth = Math.max(1.5, s * 0.08);
  c.strokeStyle = '#140a1c';
  c.lineJoin = 'round';
  switch (kind) {
    case 'coin': {
      const g = c.createRadialGradient(-s * 0.15, -s * 0.15, s * 0.05, 0, 0, s * 0.5);
      g.addColorStop(0, '#fff2a8');
      g.addColorStop(0.5, '#ffd23d');
      g.addColorStop(1, '#e08a00');
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, s * 0.46, 0, TAU);
      c.fill();
      c.stroke();
      c.strokeStyle = 'rgba(160,80,0,.8)';
      c.beginPath();
      c.arc(0, 0, s * 0.3, 0, TAU);
      c.stroke();
      c.fillStyle = 'rgba(255,255,255,.7)';
      c.beginPath();
      c.ellipse(-s * 0.16, -s * 0.18, s * 0.08, s * 0.05, -0.6, 0, TAU);
      c.fill();
      break;
    }
    case 'gem': {
      const g = c.createLinearGradient(0, -s * 0.45, 0, s * 0.5);
      g.addColorStop(0, '#c9f5ff');
      g.addColorStop(0.45, '#4fc3ff');
      g.addColorStop(1, '#2a5bff');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(-s * 0.48, -s * 0.12);
      c.lineTo(-s * 0.24, -s * 0.42);
      c.lineTo(s * 0.24, -s * 0.42);
      c.lineTo(s * 0.48, -s * 0.12);
      c.lineTo(0, s * 0.48);
      c.closePath();
      c.fill();
      c.stroke();
      c.strokeStyle = 'rgba(20,10,28,.45)';
      c.lineWidth *= 0.6;
      c.beginPath();
      c.moveTo(-s * 0.48, -s * 0.12);
      c.lineTo(s * 0.48, -s * 0.12);
      c.moveTo(-s * 0.12, -s * 0.42);
      c.lineTo(-s * 0.2, -s * 0.12);
      c.lineTo(0, s * 0.48);
      c.lineTo(s * 0.2, -s * 0.12);
      c.lineTo(s * 0.12, -s * 0.42);
      c.stroke();
      break;
    }
    case 'xp': {
      c.fillStyle = '#7dff9a';
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? s * 0.22 : s * 0.5;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.closePath();
      c.fill();
      c.stroke();
      break;
    }
    case 'chest': {
      const d = CHESTS[chest ?? 'bronze'];
      c.fillStyle = d.body;
      c.beginPath();
      c.roundRect(-s * 0.46, -s * 0.05, s * 0.92, s * 0.45, s * 0.06);
      c.fill();
      c.stroke();
      c.beginPath();
      c.moveTo(-s * 0.46, -s * 0.05);
      c.quadraticCurveTo(-s * 0.46, -s * 0.42, 0, -s * 0.42);
      c.quadraticCurveTo(s * 0.46, -s * 0.42, s * 0.46, -s * 0.05);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = d.trim;
      c.fillRect(-s * 0.1, -s * 0.14, s * 0.2, s * 0.2);
      c.strokeRect(-s * 0.1, -s * 0.14, s * 0.2, s * 0.2);
      break;
    }
    case 'ticket': {
      c.fillStyle = '#ff5fa2';
      c.beginPath();
      c.roundRect(-s * 0.48, -s * 0.3, s * 0.96, s * 0.6, s * 0.08);
      c.fill();
      c.stroke();
      c.fillStyle = '#d9e2ee';
      c.fillRect(-s * 0.3, -s * 0.16, s * 0.6, s * 0.32);
      c.strokeRect(-s * 0.3, -s * 0.16, s * 0.6, s * 0.32);
      break;
    }
    case 'crown': {
      const g = c.createLinearGradient(0, -s * 0.4, 0, s * 0.35);
      g.addColorStop(0, '#fff2a8');
      g.addColorStop(1, '#ff9f1a');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(-s * 0.48, s * 0.32);
      c.lineTo(-s * 0.5, -s * 0.3);
      c.lineTo(-s * 0.22, -s * 0.02);
      c.lineTo(0, -s * 0.44);
      c.lineTo(s * 0.22, -s * 0.02);
      c.lineTo(s * 0.5, -s * 0.3);
      c.lineTo(s * 0.48, s * 0.32);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = '#ff3d6e';
      for (const x of [-0.25, 0, 0.25]) {
        c.beginPath();
        c.arc(x * s, s * 0.16, s * 0.07, 0, TAU);
        c.fill();
      }
      break;
    }
  }
  c.restore();
}

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/** Renders the static wheel face (segments + labels + icons + pegs) once. */
function wheelFace(size: number, dpr: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = cv.height = Math.round(size * dpr);
  const c = cv.getContext('2d')!;
  c.scale(dpr, dpr);
  const R = size / 2;
  c.translate(R, R);
  const N = WHEEL.length;
  const seg = TAU / N;
  WHEEL.forEach((s, i) => {
    const a0 = -Math.PI / 2 + i * seg;
    const a1 = a0 + seg;
    const g = c.createRadialGradient(0, 0, R * 0.15, 0, 0, R);
    const col = s.id === 'jackpot' ? '#ff3d6e' : s.color;
    g.addColorStop(0, shade(col, 0.35));
    g.addColorStop(0.7, col);
    g.addColorStop(1, shade(col, -0.3));
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, 0);
    c.arc(0, 0, R, a0, a1);
    c.closePath();
    c.fill();
    if (s.id === 'jackpot') {
      // golden sparkle stripes
      c.save();
      c.clip();
      c.globalAlpha = 0.28;
      c.fillStyle = '#ffd23d';
      for (let k = 0; k < 6; k++) {
        c.beginPath();
        c.moveTo(0, 0);
        c.arc(0, 0, R, a0 + (k / 6) * seg, a0 + ((k + 0.5) / 6) * seg);
        c.fill();
      }
      c.restore();
    }
    // separator
    c.strokeStyle = 'rgba(20,10,28,.85)';
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(Math.cos(a0) * R, Math.sin(a0) * R);
    c.stroke();
    // icon (upright when the segment is at the top)
    const mid = a0 + seg / 2;
    c.save();
    c.rotate(mid + Math.PI / 2);
    c.translate(0, -R * 0.78);
    drawIcon(c, s.icon, R * 0.24, s.chest);
    c.restore();
    // label along the radius
    c.save();
    c.rotate(mid);
    const maxLen = R * 0.42;
    let fs = Math.min(R * 0.15, 17);
    c.font = `${fs}px 'Luckiest Guy', Impact, sans-serif`;
    const w = c.measureText(s.label).width;
    if (w > maxLen) {
      fs *= maxLen / w;
      c.font = `${fs}px 'Luckiest Guy', Impact, sans-serif`;
    }
    c.textAlign = 'right';
    c.textBaseline = 'middle';
    c.lineWidth = Math.max(2, fs * 0.22);
    c.strokeStyle = 'rgba(20,10,28,.9)';
    c.strokeText(s.label, R * 0.64, fs * 0.06);
    c.fillStyle = s.id === 'jackpot' ? '#ffe680' : '#fff';
    c.fillText(s.label, R * 0.64, fs * 0.06);
    c.restore();
  });
  // inner shadow ring
  const ig = c.createRadialGradient(0, 0, R * 0.8, 0, 0, R);
  ig.addColorStop(0, 'rgba(0,0,0,0)');
  ig.addColorStop(1, 'rgba(0,0,0,.35)');
  c.fillStyle = ig;
  c.beginPath();
  c.arc(0, 0, R, 0, TAU);
  c.fill();
  // pegs at the separators
  for (let i = 0; i < N; i++) {
    const a = -Math.PI / 2 + i * seg;
    const x = Math.cos(a) * (R - 5);
    const y = Math.sin(a) * (R - 5);
    c.fillStyle = '#fff6d0';
    c.strokeStyle = '#140a1c';
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(x, y, 3.6, 0, TAU);
    c.fill();
    c.stroke();
  }
  return cv;
}

class WheelView {
  canvas = el('canvas', 'dl-wheel-cv');
  private ctx = this.canvas.getContext('2d')!;
  private face: HTMLCanvasElement | null = null;
  private size = 0;
  private dpr = 1;
  theta = 0;
  private pa = 0; // pointer angle
  private pv = 0;
  private raf = 0;
  private last = 0;
  private lastPeg = 0;
  private omega = 0;
  private hl = -1; // highlighted segment
  private hlT = 0;
  private t = 0;
  private anim: ((dt: number) => boolean) | null = null;
  private idleUntil = 0;

  mount(size: number): void {
    this.size = size;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = this.canvas.height = Math.round(size * this.dpr);
    this.canvas.style.width = this.canvas.style.height = `${size}px`;
    const faceR = size / 2 - size * 0.075;
    this.face = wheelFace(faceR * 2, this.dpr);
    this.theta = -((Math.random() * WHEEL.length + 0.5) * TAU) / WHEEL.length;
    this.lastPeg = Math.floor(this.theta / (TAU / WHEEL.length));
    this.draw();
    // re-render the face once the display font is ready
    document.fonts?.load(`16px 'Luckiest Guy'`).then(() => {
      if (!this.canvas.isConnected) return;
      this.face = wheelFace(faceR * 2, this.dpr);
      this.draw();
    });
    this.kick(2500);
  }

  /** Runs the RAF loop for a while (for idle bulbs / pointer settling). */
  kick(ms = 1200): void {
    this.idleUntil = Math.max(this.idleUntil, performance.now() + ms);
    if (!this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.loop);
    }
  }

  /** Fim pendente de um giro (garante que o jogo nunca fica preso a "girar"). */
  private pendingDone: (() => void) | null = null;

  private loop = (now: number): void => {
    this.raf = 0;
    if (!this.canvas.isConnected) {
      this.anim = null;
      this.pendingDone?.();
      return;
    }
    try {
      this.step(now);
    } catch (e) {
      // um erro (ex.: som) nunca pode congelar a roda: acaba o giro já
      console.error(e);
      this.anim = null;
      this.pendingDone?.();
    }
  };

  private step(now: number): void {
    const dt = Math.min(0.04, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    const prev = this.theta;
    if (this.anim && !this.anim(dt)) this.anim = null;
    this.omega = dt > 0 ? (this.theta - prev) / dt : 0;
    // pegs passing the pointer
    const seg = TAU / WHEEL.length;
    const peg = Math.floor((this.theta + seg * 0.0) / seg);
    if (peg !== this.lastPeg) {
      const n = Math.abs(peg - this.lastPeg);
      this.lastPeg = peg;
      if (Math.abs(this.omega) > 0.05) {
        try {
          A.tick(0.92 + Math.random() * 0.16);
        } catch {
          /* sem som */
        }
        this.pv -= Math.min(26, 8 + Math.abs(this.omega) * 0.9) * Math.min(2, n) * Math.sign(this.omega);
      }
    }
    // pointer spring
    this.pv += (-700 * this.pa - 16 * this.pv) * dt;
    this.pa += this.pv * dt;
    if (this.pa < -0.75) {
      this.pa = -0.75;
      this.pv = Math.abs(this.pv) * 0.3;
    }
    if (this.pa > 0.3) {
      this.pa = 0.3;
      this.pv = -Math.abs(this.pv) * 0.3;
    }
    if (this.hl >= 0) this.hlT += dt;
    this.draw();
    const settling = Math.abs(this.pa) > 0.002 || Math.abs(this.pv) > 0.01;
    if (this.anim || settling || this.hl >= 0 || now < this.idleUntil) this.raf = requestAnimationFrame(this.loop);
  }

  spinTo(index: number, onDone: () => void): void {
    const N = WHEEL.length;
    const seg = TAU / N;
    const jitter = (Math.random() - 0.5) * 0.7;
    this.hl = -1;
    const start = this.theta;
    const windBack = 0.22;
    // wheel-local angle at the pointer = -theta (mod 2π) → land on segment centre ± jitter
    const target = -((index + 0.5 + jitter) * seg);
    const fromWind = start - windBack;
    let total = target - fromWind;
    total = ((total % TAU) + TAU) % TAU;
    const turns = 5 + Math.floor(Math.random() * 2);
    total += turns * TAU;
    const T = 4.9 + Math.random() * 0.8;
    let t = 0;
    try {
      A.riser(0.35);
    } catch {
      /* sem som */
    }
    this.anim = (dt) => {
      t += dt;
      if (t < 0.32) {
        const u = t / 0.32;
        this.theta = start - windBack * (0.5 - 0.5 * Math.cos(u * Math.PI));
        return true;
      }
      const u = Math.min(1, (t - 0.32) / T);
      // friction-like deceleration: fast launch, long slow crawl at the end
      this.theta = fromWind + total * (1 - Math.pow(1 - u, 3.2));
      if (u >= 1) {
        this.theta = fromWind + total;
        this.hl = index;
        this.hlT = 0;
        setTimeout(finish, 900);
        setTimeout(() => this.kick(400), 950);
        return false;
      }
      return true;
    };
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(guard);
      this.pendingDone = null;
      this.anim = null;
      this.theta = fromWind + total;
      this.hl = -1;
      onDone();
    };
    this.pendingDone = finish;
    // se o telemóvel pausar a animação (app em segundo plano, erro…), o prémio sai na mesma
    const guard = setTimeout(finish, (0.32 + T) * 1000 + 2500);
    this.kick(100);
  }

  private draw(): void {
    const c = this.ctx;
    const S0 = this.size;
    const R = S0 / 2;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, S0, S0);
    c.save();
    c.translate(R, R);
    // outer rim
    const rimG = c.createLinearGradient(0, -R, 0, R);
    rimG.addColorStop(0, '#ffe680');
    rimG.addColorStop(0.5, '#ff9f1a');
    rimG.addColorStop(1, '#a35a00');
    c.fillStyle = 'rgba(0,0,0,.4)';
    c.beginPath();
    c.arc(0, 4, R - 1, 0, TAU);
    c.fill();
    c.fillStyle = rimG;
    c.beginPath();
    c.arc(0, 0, R - 2, 0, TAU);
    c.fill();
    c.lineWidth = 3;
    c.strokeStyle = '#140a1c';
    c.stroke();
    // bulbs
    const faceR = R - S0 * 0.075;
    const nb = 20;
    const moving = Math.abs(this.omega) > 0.3;
    for (let i = 0; i < nb; i++) {
      const a = (i / nb) * TAU;
      let on: boolean;
      if (this.hl >= 0) on = Math.floor(this.hlT * 8) % 2 === 0;
      else if (moving) on = (i + Math.floor(this.t * 14)) % 3 === 0;
      else on = (i + Math.floor(this.t * 2.5)) % 2 === 0;
      const x = Math.cos(a) * (faceR + (R - faceR) / 2 - 1);
      const y = Math.sin(a) * (faceR + (R - faceR) / 2 - 1);
      if (on) {
        c.fillStyle = 'rgba(255,240,170,.45)';
        c.beginPath();
        c.arc(x, y, 6, 0, TAU);
        c.fill();
      }
      c.fillStyle = on ? '#fffbe0' : '#8a4b10';
      c.beginPath();
      c.arc(x, y, Math.max(2, S0 * 0.012), 0, TAU);
      c.fill();
    }
    // face
    c.fillStyle = '#140a1c';
    c.beginPath();
    c.arc(0, 0, faceR + 1.5, 0, TAU);
    c.fill();
    if (this.face) {
      c.save();
      c.rotate(this.theta);
      c.drawImage(this.face, -faceR, -faceR, faceR * 2, faceR * 2);
      c.restore();
    }
    // winning segment highlight
    if (this.hl >= 0) {
      const seg = TAU / WHEEL.length;
      const a0 = -Math.PI / 2 + this.theta + this.hl * seg;
      c.save();
      c.globalAlpha = 0.25 + 0.25 * Math.sin(this.hlT * 14);
      c.fillStyle = '#fff';
      c.beginPath();
      c.moveTo(0, 0);
      c.arc(0, 0, faceR, a0, a0 + seg);
      c.closePath();
      c.fill();
      c.restore();
      c.save();
      c.lineWidth = 4;
      c.strokeStyle = '#ffe680';
      c.shadowColor = '#ffd23d';
      c.shadowBlur = 16;
      c.beginPath();
      c.moveTo(0, 0);
      c.arc(0, 0, faceR - 2, a0, a0 + seg);
      c.closePath();
      c.stroke();
      c.restore();
    }
    // hub
    const hr = R * 0.17;
    const hg = c.createRadialGradient(-hr * 0.3, -hr * 0.3, hr * 0.1, 0, 0, hr);
    hg.addColorStop(0, '#fff6c0');
    hg.addColorStop(0.5, '#ffd23d');
    hg.addColorStop(1, '#d07a00');
    c.fillStyle = hg;
    c.beginPath();
    c.arc(0, 0, hr, 0, TAU);
    c.fill();
    c.lineWidth = 3;
    c.strokeStyle = '#140a1c';
    c.stroke();
    c.fillStyle = '#3a1c00';
    c.font = `${Math.round(hr * 0.62)}px 'Luckiest Guy', Impact, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('SPIN', 0, hr * 0.06);
    c.restore();
    // pointer (top), pivot above the rim, wobbling on the pegs
    const pw = S0 * 0.055;
    const pl = S0 * 0.14;
    c.save();
    c.translate(R, S0 * 0.02);
    c.rotate(this.pa);
    c.fillStyle = 'rgba(0,0,0,.35)';
    c.beginPath();
    c.moveTo(-pw + 2, 3);
    c.lineTo(pw + 2, 3);
    c.lineTo(2, pl + 3);
    c.closePath();
    c.fill();
    const pg = c.createLinearGradient(-pw, 0, pw, 0);
    pg.addColorStop(0, '#ff8aa8');
    pg.addColorStop(0.5, '#ff3d6e');
    pg.addColorStop(1, '#a3102c');
    c.fillStyle = pg;
    c.beginPath();
    c.moveTo(-pw, 0);
    c.quadraticCurveTo(0, -pw * 0.9, pw, 0);
    c.lineTo(0, pl);
    c.closePath();
    c.fill();
    c.lineWidth = 2.5;
    c.strokeStyle = '#140a1c';
    c.stroke();
    c.fillStyle = '#ffe680';
    c.beginPath();
    c.arc(0, pw * 0.05, pw * 0.35, 0, TAU);
    c.fill();
    c.stroke();
    c.restore();
  }
}

function panelWheel(body: HTMLElement, refresh: () => void, drawTabs: () => void): void {
  const stage = el('div', 'dl-wstage');
  const view = new WheelView();
  stage.appendChild(view.canvas);
  body.appendChild(stage);
  const side = el('div', 'dl-side');
  body.appendChild(side);

  const drawSide = () => {
    const free = freeSpinReady();
    const avail = spinsAvailable();
    side.innerHTML = `
      <h2 class="dl-h2">Lucky Wheel</h2>
      <p class="dl-status">${free ? `<b class="ok">Free spin ready!</b>` : `Free spin in <b data-cd="mid"></b>`}${D.wheel.bank ? ` · <b>${D.wheel.bank}</b> bonus spin${D.wheel.bank > 1 ? 's' : ''}` : ''}</p>
      <div class="dl-tops"><span class="dl-jack">${ico('crown')} JACKPOT: Legendary item + 50 Gems</span>${chips(WHEEL.find((w) => w.id === 'prata')!.prize)}${chips({ coins: 600 })}${chips({ gems: 15 })}</div>
      <div class="dl-actions"></div>
      <div class="dl-charge"><span>${ico('glove')} Win ${SPIN_CHARGE} fights → +1 spin</span>${pips(D.spinCharge, SPIN_CHARGE)}</div>`;
    const act = side.querySelector('.dl-actions') as HTMLElement;
    if (avail > 0) {
      const b = el('button', 'btn btn-gold dl-big pulse', free ? 'SPIN FREE' : `SPIN (${D.wheel.bank})`);
      b.onclick = () => go(false);
      act.appendChild(b);
    } else {
      const b = el('button', 'btn btn-blue dl-big', `SPIN · ${SPIN_GEM_COST} ${ico('gem')}`);
      b.disabled = S.gems < SPIN_GEM_COST;
      b.onclick = () => go(true);
      act.appendChild(b);
    }
    const odds = el('button', 'btn btn-ghost sm', `${ico('info')}<span class="dl-hn-txt"> Odds</span>`);
    odds.onclick = () => {
      sfx.click();
      oddsModal(
        'Lucky Wheel — real odds',
        WHEEL.map((s) => [`<span class="dl-sw" style="background:${s.color}"></span>`, esc(s.sub), pct(s.w)]),
        'Every spin is independent; the wheel lands on a segment with exactly these chances (segment size on the wheel is decorative). The jackpot item is a random Legendary item, preferring ones you don\'t own.',
      );
    };
    act.appendChild(odds);
  };

  const go = (gems: boolean) => {
    if (spinning) return;
    unlockAudio();
    if (gems && S.gems < SPIN_GEM_COST) {
      toast('Not enough gems', 'err');
      return;
    }
    const index = spinWheel(gems);
    if (index == null) {
      toast('No spins left', 'err');
      return;
    }
    spinning = true;
    sfx.click();
    side.querySelectorAll('button').forEach((b) => ((b as HTMLButtonElement).disabled = true));
    stage.classList.add('spinning');
    view.spinTo(index, () => {
      stage.classList.remove('spinning');
      const seg = WHEEL[index];
      const res = collectPending();
      spinning = false;
      const big = seg.id === 'jackpot';
      if (big) {
        sfx.boom();
        confetti(260);
      }
      showPrize(res, big ? 'JACKPOT!!!' : 'YOU WON!', () => {
        if (!body.isConnected) return;
        drawTabs();
        drawSide();
        tickTimers(body.parentElement as HTMLElement);
      });
    });
  };
  view.canvas.onclick = (e) => {
    const r = view.canvas.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < r.width * 0.2) {
      if (spinsAvailable() > 0) go(false);
      else view.kick(600);
    }
  };
  drawSide();
  requestAnimationFrame(() => {
    if (!stage.isConnected) return;
    const sz = Math.floor(Math.min(stage.clientWidth, stage.clientHeight));
    view.mount(Math.max(160, Math.min(360, sz)));
  });
  void refresh;
}

function pips(n: number, of: number): string {
  let s = '<span class="dl-pips">';
  for (let i = 0; i < of; i++) s += `<i class="${i < n ? 'on' : ''}"></i>`;
  return `${s}</span>`;
}

// ───────────────────────── 3. Scratch card ─────────────────────────

const SYM_ICON: Record<Sym, string> = { coin: 'coin', xp: 'xp', gem: 'gem', chest: 'chest', crown: 'crown', fist: 'fist' };

function panelScratch(body: HTMLElement, refresh: () => void): void {
  const card = D.scratch.active;
  const ticket = el('div', `dl-ticket${card ? ' live' : ''}`);
  ticket.innerHTML = `<div class="dl-thead"><b>LUCKY PUNCH</b><span>Match 3 to win!</span></div><div class="dl-tarea"><div class="dl-cells"></div><canvas class="dl-foil"></canvas></div>`;
  body.appendChild(ticket);
  const side = el('div', 'dl-side');
  body.appendChild(side);
  const cellsBox = ticket.querySelector('.dl-cells') as HTMLElement;
  const foil = ticket.querySelector('.dl-foil') as HTMLCanvasElement;
  const area = ticket.querySelector('.dl-tarea') as HTMLElement;
  const cells: HTMLElement[] = [];
  for (let i = 0; i < 9; i++) {
    const s = card ? card.grid[i] : 'fist';
    const c = el('div', `dl-cell s-${s}`, card ? ico(SYM_ICON[s]) : '');
    cellsBox.appendChild(c);
    cells.push(c);
  }

  const free = freeScratchReady();
  side.innerHTML = `
    <h2 class="dl-h2">Scratch Card</h2>
    <p class="dl-status">${
      card ? '<b class="ok">Scratch the foil with your finger!</b>' : free ? '<b class="ok">Free card ready!</b>' : `Free card in <b data-cd="mid"></b>`
    }${D.scratch.bank ? ` · <b>${D.scratch.bank}</b> bonus card${D.scratch.bank > 1 ? 's' : ''}` : ''}</p>
    <div class="dl-paytable">${SCRATCH_TABLE.map((r) => `<span class="s-${r.sym}">${ico(SYM_ICON[r.sym])}<em>×3</em> ${esc(r.name)}</span>`).join('')}</div>
    <div class="dl-actions"></div>
    <div class="dl-charge"><span>${ico('glove')} Win ${SCRATCH_CHARGE} fights → +1 card</span>${pips(D.scratchCharge, SCRATCH_CHARGE)}</div>`;
  const act = side.querySelector('.dl-actions') as HTMLElement;
  const odds = el('button', 'btn btn-ghost sm', `${ico('info')}<span class="dl-hn-txt"> Odds</span>`);
  odds.onclick = () => {
    sfx.click();
    oddsModal(
      'Scratch Card — real odds',
      [
        ...SCRATCH_TABLE.map((r): [string, string, string] => [`<span class="dl-oi s-${r.sym}">${ico(SYM_ICON[r.sym])}</span>`, `3× → ${esc(r.name)}`, pct(r.w)]),
        ['—', 'No match', pct(SCRATCH_LOSE)],
      ],
      'The result of each card is decided when you get it; scratching only reveals it. A card never has more than one matching set.',
    );
  };

  // ── foil
  let W = 0;
  let H = 0;
  let dpr = 1;
  let fctx: CanvasRenderingContext2D | null = null;
  const GS = 7; // samples per cell side
  const marks = new Uint8Array(9 * GS * GS);
  const revealed = new Array(9).fill(false);
  let finished = false;
  let nRev = 0;

  const paintFoil = () => {
    W = area.clientWidth;
    H = area.clientHeight;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    foil.width = Math.round(W * dpr);
    foil.height = Math.round(H * dpr);
    const c = foil.getContext('2d')!;
    fctx = c;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = c.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#e9eef6');
    g.addColorStop(0.3, '#a9b4c6');
    g.addColorStop(0.5, '#f6f9ff');
    g.addColorStop(0.7, '#9aa6ba');
    g.addColorStop(1, '#dfe6f1');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    // glitter
    for (let i = 0; i < 260; i++) {
      c.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.6})`;
      c.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
    }
    // cell outlines + star stamps
    const cw = W / 3;
    const ch = H / 3;
    for (let i = 0; i < 9; i++) {
      const x = (i % 3) * cw;
      const y = Math.floor(i / 3) * ch;
      c.strokeStyle = 'rgba(80,90,110,.35)';
      c.lineWidth = 1.5;
      c.beginPath();
      c.roundRect(x + 4, y + 4, cw - 8, ch - 8, 8);
      c.stroke();
      c.fillStyle = 'rgba(90,100,125,.28)';
      c.font = `${Math.round(ch * 0.42)}px 'Luckiest Guy', Impact, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('★', x + cw / 2, y + ch / 2 + 2);
    }
    c.save();
    c.translate(W / 2, H / 2);
    c.rotate(-0.12);
    c.font = `${Math.round(Math.min(W, H) * 0.16)}px 'Luckiest Guy', Impact, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineWidth = 5;
    c.strokeStyle = '#140a1c';
    c.strokeText(card ? 'SCRATCH!' : 'NO CARD', 0, 0);
    c.fillStyle = card ? '#ffd23d' : '#cfd6e4';
    c.fillText(card ? 'SCRATCH!' : 'NO CARD', 0, 0);
    c.restore();
  };

  const markSeg = (x0: number, y0: number, x1: number, y1: number, r: number) => {
    const cw = W / 3;
    const ch = H / 3;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const L2 = dx * dx + dy * dy || 1;
    for (let ci = 0; ci < 9; ci++) {
      if (revealed[ci]) continue;
      const cx0 = (ci % 3) * cw;
      const cy0 = Math.floor(ci / 3) * ch;
      // skip cells far from the stroke
      if (Math.max(x0, x1) + r < cx0 || Math.min(x0, x1) - r > cx0 + cw || Math.max(y0, y1) + r < cy0 || Math.min(y0, y1) - r > cy0 + ch) continue;
      let cnt = 0;
      for (let k = 0; k < GS * GS; k++) {
        const idx = ci * GS * GS + k;
        if (!marks[idx]) {
          const px = cx0 + ((k % GS) + 0.5) * (cw / GS);
          const py = cy0 + (Math.floor(k / GS) + 0.5) * (ch / GS);
          let t = ((px - x0) * dx + (py - y0) * dy) / L2;
          t = Math.max(0, Math.min(1, t));
          const qx = x0 + t * dx - px;
          const qy = y0 + t * dy - py;
          if (qx * qx + qy * qy <= r * r) marks[idx] = 1;
        }
        cnt += marks[idx];
      }
      if (cnt / (GS * GS) >= 0.5) revealCell(ci);
    }
  };

  const revealCell = (ci: number) => {
    if (revealed[ci]) return;
    revealed[ci] = true;
    nRev++;
    cells[ci].classList.add('rev');
    A.pop(Math.min(8, nRev));
    // clear the rest of that cell's foil so it reads clearly
    if (fctx) {
      const cw = W / 3;
      const ch = H / 3;
      const x = (ci % 3) * cw;
      const y = Math.floor(ci / 3) * ch;
      fctx.save();
      fctx.globalCompositeOperation = 'destination-out';
      fctx.beginPath();
      fctx.roundRect(x + 3, y + 3, cw - 6, ch - 6, 8);
      fctx.fill();
      fctx.restore();
    }
    if (nRev >= 9) finish();
  };

  const finish = () => {
    if (finished || !card) return;
    finished = true;
    ticket.classList.remove('dl-scratching');
    foil.classList.add('gone');
    cells.forEach((c) => c.classList.add('rev'));
    act.querySelectorAll('button').forEach((b) => ((b as HTMLButtonElement).disabled = true));
    const win = card.win;
    setTimeout(() => {
      if (win) {
        cells.forEach((c, i) => card.grid[i] === win && c.classList.add('win'));
        sfx.reveal(3);
        burst(ticket, 20);
        setTimeout(() => showPrize(finishScratch(), 'MATCH 3!', refresh), 900);
      } else {
        ticket.classList.add('lose');
        A.aww();
        finishScratch();
        const msg = el('div', 'dl-lose', 'No match… so close!');
        area.appendChild(msg);
        setTimeout(refresh, 1700);
      }
    }, 350);
  };

  if (card) {
    ticket.classList.add('dl-scratching');
    let last: [number, number] | null = null;
    let lastSnd = 0;
    const pos = (e: PointerEvent): [number, number] => {
      const r = foil.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
    };
    const stroke = (p: [number, number]) => {
      if (!fctx || finished) return;
      const from = last ?? p;
      const r = Math.max(13, Math.min(W, H) * 0.075);
      fctx.save();
      fctx.globalCompositeOperation = 'destination-out';
      fctx.lineCap = 'round';
      fctx.lineJoin = 'round';
      fctx.lineWidth = r * 2;
      fctx.beginPath();
      fctx.moveTo(from[0], from[1]);
      fctx.lineTo(p[0] + 0.01, p[1]);
      fctx.stroke();
      fctx.restore();
      markSeg(from[0], from[1], p[0], p[1], r * 0.9);
      last = p;
      const now = performance.now();
      if (now - lastSnd > 70) {
        lastSnd = now;
        A.scratch();
      }
    };
    foil.onpointerdown = (e) => {
      unlockAudio();
      foil.setPointerCapture(e.pointerId);
      last = null;
      stroke(pos(e));
    };
    foil.onpointermove = (e) => {
      if (!foil.hasPointerCapture(e.pointerId)) return;
      const evs = e.getCoalescedEvents?.() ?? [e];
      for (const ev of evs) stroke(pos(ev));
    };
    foil.onpointerup = foil.onpointercancel = () => {
      last = null;
    };
    const all = el('button', 'btn btn-ghost sm', `${ico('sparkle')} Reveal all`);
    all.onclick = () => {
      sfx.click();
      all.disabled = true;
      let k = 0;
      for (let i = 0; i < 9; i++) {
        if (revealed[i]) continue;
        const ci = i;
        setTimeout(() => !finished && revealCell(ci), 90 * k++);
      }
    };
    act.appendChild(all);
  } else {
    const avail = scratchesAvailable();
    if (avail > 0) {
      const b = el('button', 'btn btn-gold dl-big pulse', free ? 'GET FREE CARD' : `USE CARD (${D.scratch.bank})`);
      b.onclick = () => {
        unlockAudio();
        if (newScratch(false)) {
          sfx.open();
          refresh();
        }
      };
      act.appendChild(b);
    } else {
      const b = el('button', 'btn btn-blue dl-big', `BUY CARD · ${SCRATCH_GEM_COST} ${ico('gem')}`);
      b.disabled = S.gems < SCRATCH_GEM_COST;
      b.onclick = () => {
        unlockAudio();
        if (newScratch(true)) {
          sfx.open();
          refresh();
        } else toast('Not enough gems', 'err');
      };
      act.appendChild(b);
    }
  }
  act.appendChild(odds);
  requestAnimationFrame(() => {
    if (!area.isConnected) return;
    paintFoil();
    document.fonts?.load(`16px 'Luckiest Guy'`).then(() => {
      if (area.isConnected && nRev === 0 && !finished) paintFoil();
    });
  });
}

// ───────────────────────── 4. Challenges + Hot Streak ─────────────────────────

function panelTasks(body: HTMLElement, refresh: () => void): void {
  ensureTasks();
  const left = el('div', 'dl-tasks');
  body.appendChild(left);
  D.tasks.ids.forEach((id, i) => {
    const t = task(id);
    const prog = Math.min(t.goal, D.tasks.prog[i]);
    const done = prog >= t.goal;
    const claimed = D.tasks.claimed[i];
    const row = el('div', `dl-task${done ? ' done' : ''}${claimed ? ' claimed' : ''}`);
    row.innerHTML = `<span class="dl-tico">${ico(claimed ? 'check' : done ? 'star' : 'target')}</span>
      <div class="dl-tmain"><b>${esc(t.text)}</b><div class="dl-bar"><i style="width:${(prog / t.goal) * 100}%"></i><span>${prog}/${t.goal}</span></div></div>
      <div class="dl-trew">${chips(t.prize)}</div><div class="dl-tbtn"></div>`;
    const slot = row.querySelector('.dl-tbtn') as HTMLElement;
    if (claimed) slot.innerHTML = `<span class="dl-ok">${ico('check')}</span>`;
    else if (done) {
      const b = el('button', 'btn btn-gold sm pulse', 'Claim');
      b.onclick = () => {
        unlockAudio();
        burst(row);
        showPrize(claimTask(i), 'CHALLENGE DONE!', refresh);
      };
      slot.appendChild(b);
    } else slot.innerHTML = `<span class="dl-go">Fight!</span>`;
    left.appendChild(row);
  });
  const allDone = D.tasks.claimed.every(Boolean);
  const bonus = el('div', `dl-task bonus${D.tasks.bonus ? ' claimed' : allDone ? ' done' : ''}`);
  const nClaimed = D.tasks.claimed.filter(Boolean).length;
  bonus.innerHTML = `<span class="dl-tico">${chestArt(TASK_BONUS.chest!)}</span><div class="dl-tmain"><b>Complete all 3</b><div class="dl-bar"><i style="width:${(nClaimed / 3) * 100}%"></i><span>${nClaimed}/3</span></div></div><div class="dl-trew">${chips(TASK_BONUS)}</div><div class="dl-tbtn"></div>`;
  const bslot = bonus.querySelector('.dl-tbtn') as HTMLElement;
  if (D.tasks.bonus) bslot.innerHTML = `<span class="dl-ok">${ico('check')}</span>`;
  else if (bonusReady()) {
    const b = el('button', 'btn btn-gold sm pulse', 'Claim');
    b.onclick = () => {
      unlockAudio();
      burst(bonus);
      showPrize(claimBonus(), 'ALL CHALLENGES DONE!', refresh);
    };
    bslot.appendChild(b);
  }
  left.appendChild(bonus);
  left.appendChild(el('p', 'dl-note', `New challenges in <b data-cd="mid"></b>`));

  // Hot Streak
  const hot = el('div', `dl-hot${D.hot.cur >= 2 ? ' lit' : ''}`);
  const maxAt = HOT_MILESTONES[HOT_MILESTONES.length - 1].at;
  hot.innerHTML = `<div class="dl-hhead"><span class="dl-hflame">${ico('fire')}</span><div><b>Hot Streak</b><small>Consecutive wins · a loss resets it</small></div><span class="dl-hnum">×${D.hot.cur}</span></div>
    <div class="dl-htrack"><div class="dl-hfill" style="width:${(Math.min(maxAt, D.hot.cur) / maxAt) * 100}%"></div></div>
    <div class="dl-hnodes"></div>
    <div class="dl-hfoot">Best: <b>${D.hot.best}</b> wins in a row</div>
    <div class="dl-charge"><span>${ico('glove')} Win ${SPIN_CHARGE} fights → +1 spin</span>${pips(D.spinCharge, SPIN_CHARGE)}</div>
    <div class="dl-charge"><span>${ico('glove')} Win ${SCRATCH_CHARGE} fights → +1 card</span>${pips(D.scratchCharge, SCRATCH_CHARGE)}</div>`;
  const nodes = hot.querySelector('.dl-hnodes') as HTMLElement;
  for (const m of HOT_MILESTONES) {
    const ready = D.hot.ready.includes(m.at);
    const reached = D.hot.reached.includes(m.at) && !ready;
    const n = el('div', `dl-hn${ready ? ' ready' : reached ? ' got' : ''}`);
    n.style.left = `${(m.at / maxAt) * 100}%`;
    n.innerHTML = `<i>${m.at}</i><span>${esc(m.label)}</span>`;
    if (ready) {
      n.onclick = () => {
        unlockAudio();
        burst(n, 16, '#ff7a1a');
        showPrize(claimHot(m.at), `HOT STREAK ×${m.at}!`, refresh);
      };
    }
    nodes.appendChild(n);
  }
  body.appendChild(hot);
}

// ───────────────────────── 5. Mystery Gift ─────────────────────────

function panelGift(body: HTMLElement, refresh: () => void): void {
  const ready = giftReady();
  const stage = el('div', `dl-gift${ready ? ' ready' : ''}`);
  stage.innerHTML = `<div class="dl-gglow"></div><div class="dl-gbox"><div class="dl-glid"><i></i></div><div class="dl-gbody"><i></i></div></div>
    <div class="dl-gtxt">${ready ? '<b>TAP TO OPEN!</b>' : `Next gift in <b data-cd="${D.giftAt}"></b>`}</div>`;
  body.appendChild(stage);
  const side = el('div', 'dl-side');
  side.innerHTML = `<h2 class="dl-h2">Mystery Gift</h2><p class="dl-status">A free gift every 4 hours. Come back often!</p>
    <table class="dl-odds small"><tbody>${GIFT_TABLE.map((g) => `<tr><td>${esc(g.name)}</td><td class="pc">${pct(g.w)}</td></tr>`).join('')}</tbody></table>`;
  body.appendChild(side);
  if (!ready) return;
  let opened = false;
  stage.onclick = () => {
    if (opened) return;
    opened = true;
    unlockAudio();
    stage.classList.add('opening');
    sfx.charge();
    setTimeout(() => {
      stage.classList.add('open');
      sfx.open();
      burst(stage, 24, '#ff5fa2');
      const res = openGift();
      setTimeout(() => showPrize(res, 'MYSTERY GIFT!', refresh), 500);
    }, 750);
  };
}

/** Número para o "badge" de notificação deste modo (0 = nada por fazer). */
export function dailyBadge(): number {
  try {
    return badgeCount();
  } catch {
    return 0;
  }
}
