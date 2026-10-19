import './forge.css';
import { sfx, unlockAudio } from '../../audio/sfx';
import * as FG from '../../core/forge';
import { owns } from '../../core/state';
import { KIND_NAMES, type ItemDef } from '../../data/items';
import { RARITIES, RARITY_ORDER, type Rarity } from '../../data/rarity';
import { go, rememberSub } from '../app';
import { el, esc, fmt, modal, rarityTag, toast } from '../dom';
import { ico } from '../icons';
import { itemThumb } from '../preview';

type Sub = 'recycle' | 'craft' | 'fuse';
const TABS: { id: Sub; name: string; icon: string }[] = [
  { id: 'recycle', name: 'Recycle', icon: 'swap' },
  { id: 'craft', name: 'Craft', icon: 'anvil' },
  { id: 'fuse', name: 'Fuse', icon: 'sparkle' },
];

const SHARD = () => ico('shard');
const rc = (r: Rarity) => (r === 'celestial' ? '#7af7ff' : RARITIES[r].color);

let keepHigh = true;
let craftR: Rarity | 'all' = 'all';
let fuseR: Rarity = 'comum';
let fuseTouched = false;

const buzz = (p: number | number[]) => {
  try {
    navigator.vibrate?.(p);
  } catch {
    /* sem vibração */
  }
};

export function forgeBadge(): number {
  return FG.forgeBadge();
}

export function renderForge(page: HTMLElement, sub?: string): void {
  const tab: Sub = (TABS.find((t) => t.id === sub)?.id ?? (FG.duplicateCount() ? 'recycle' : 'craft')) as Sub;
  rememberSub(tab);
  page.classList.add('fg-page');
  page.innerHTML = `
    <div class="fg-top">
      <h1 class="fg-title">${ico('anvil')} The Forge</h1>
      <div class="seg scroll fg-seg"></div>
      <div class="fg-bal" title="Shards">${SHARD()}<b class="fg-bal-n">${fmt(FG.shards())}</b></div>
    </div>
    <div class="fg-body"></div>`;
  const seg = page.querySelector('.fg-seg') as HTMLElement;
  for (const t of TABS) {
    const dot = t.id === 'fuse' && FG.forgeBadge() ? '<i class="fg-dot"></i>' : t.id === 'recycle' && FG.duplicateCount() ? `<i class="fg-dot">${FG.duplicateCount()}</i>` : '';
    const b = el('button', t.id === tab ? 'on' : '', `${ico(t.icon)}${t.name}${dot}`);
    b.onclick = () => {
      sfx.click();
      renderForge(page, t.id);
    };
    seg.appendChild(b);
  }
  const body = page.querySelector('.fg-body') as HTMLElement;
  if (tab === 'recycle') recycleTab(page, body);
  else if (tab === 'craft') craftTab(page, body);
  else fuseTab(page, body);
}

/** Contador de fragmentos a subir (com um "pop"). */
function bumpBalance(page: HTMLElement, from: number, to: number): void {
  const n = page.querySelector('.fg-bal-n') as HTMLElement | null;
  const box = page.querySelector('.fg-bal') as HTMLElement | null;
  if (!n || !box) return;
  box.classList.remove('bump');
  void box.offsetWidth;
  box.classList.add('bump');
  const t0 = performance.now();
  const dur = Math.min(1400, 400 + Math.abs(to - from) * 2);
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    n.textContent = fmt(Math.round(from + (to - from) * e));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Fragmentos a voar de um elemento para o saldo. */
function flyShards(page: HTMLElement, fromEl: Element, n: number): void {
  const bal = page.querySelector('.fg-bal');
  if (!bal) return;
  const a = fromEl.getBoundingClientRect();
  const b = bal.getBoundingClientRect();
  const count = Math.min(14, 4 + Math.round(Math.log2(n + 1)));
  for (let i = 0; i < count; i++) {
    const s = el('div', 'fg-fly', SHARD());
    const x0 = a.left + a.width * (0.2 + Math.random() * 0.6);
    const y0 = a.top + a.height * (0.2 + Math.random() * 0.6);
    s.style.left = `${x0}px`;
    s.style.top = `${y0}px`;
    s.style.setProperty('--dx', `${b.left + b.width / 2 - x0}px`);
    s.style.setProperty('--dy', `${b.top + b.height / 2 - y0}px`);
    s.style.setProperty('--mx', `${(Math.random() - 0.5) * 160}px`);
    s.style.animationDelay = `${i * 45}ms`;
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 1100 + i * 45);
  }
}

// ───────────────────────── Reciclar ─────────────────────────

function recycleTab(page: HTMLElement, body: HTMLElement): void {
  const dups = FG.duplicates();
  const only = keepHigh ? RARITY_ORDER.filter((r) => RARITIES[r].tier < 4) : undefined;
  const value = FG.recycleValue(only);
  const copies = dups.filter((d) => !only || only.includes(d.rarity)).reduce((n, d) => n + FG.spares(d.id), 0);
  const st = FG.forgeStats();
  body.innerHTML = `
    <div class="card fg-hero">
      <div class="fg-hero-art">${SHARD()}</div>
      <div class="fg-hero-txt">
        <b>Turn duplicates into Shards</b>
        <span>Every extra copy becomes shards. You always keep one of each item. Spend shards in <b>Craft</b> to pick exactly the item you want.</span>
        <div class="fg-rates">${RARITY_ORDER.map((r) => `<span style="--rc:${rc(r)}">${RARITIES[r].name} <b>${FG.SHARD_VALUE[r]}</b></span>`).join('')}</div>
      </div>
    </div>
    <div class="fg-actions">
      <label class="toggle"><input type="checkbox" ${keepHigh ? 'checked' : ''}/> Keep Legendary+ duplicates (for Fuse)</label>
      <button class="btn btn-gold fg-all" ${copies ? '' : 'disabled'}>${ico('swap')} Recycle ${copies} duplicate${copies === 1 ? '' : 's'} <span class="fg-plus">+${SHARD()}${fmt(value)}</span></button>
    </div>
    <div class="fg-grid"></div>
    ${dups.length ? '' : `<div class="fg-empty">${ico('check')}<b>No duplicates right now</b><span>Open chests and spin the wheel — every duplicate you get can be recycled here.</span></div>`}
    <p class="muted small fg-foot">Recycled so far: ${fmt(st.recycled)} · Crafted: ${fmt(st.crafted)} · Fused: ${fmt(st.fused)}</p>`;
  const chk = body.querySelector('.toggle input') as HTMLInputElement;
  chk.onchange = () => {
    keepHigh = chk.checked;
    sfx.click();
    renderForge(page, 'recycle');
  };
  const grid = body.querySelector('.fg-grid') as HTMLElement;
  for (const d of dups) {
    const n = FG.spares(d.id);
    const kept = !!only && !only.includes(d.rarity);
    const c = el('button', `fg-card r-${d.rarity} ${kept ? 'kept' : ''}`);
    c.style.setProperty('--rc', rc(d.rarity));
    const art = el('div', 'fg-art');
    art.appendChild(itemThumb(d.id));
    c.appendChild(art);
    c.insertAdjacentHTML('beforeend', `<div class="fg-n">×${n}</div><div class="fg-name">${esc(d.name)}</div><div class="fg-val">${kept ? 'Kept' : `+${SHARD()}${fmt(n * FG.SHARD_VALUE[d.rarity])}`}</div>`);
    c.onclick = () => {
      sfx.click();
      const v = FG.SHARD_VALUE[d.rarity];
      modal(
        esc(d.name),
        `<div class="fg-one"><div class="fg-one-art"></div><p>${rarityTag(d.rarity)} · ${KIND_NAMES[d.kind]}</p><p>You have <b>${n}</b> extra cop${n === 1 ? 'y' : 'ies'}. Each one is worth <b>${v}</b> shards.</p></div>`,
        [
          { label: 'Close', cls: 'btn-ghost' },
          {
            label: `Recycle 1 · +${SHARD()}${v}`,
            cls: 'btn-gold',
            onClick: () => {
              const from = FG.shards();
              const got = FG.recycleOne(d.id);
              if (got) {
                sfx.coin();
                renderForge(page, 'recycle');
                bumpBalance(page, from, FG.shards());
              }
            },
          },
        ],
        'fg-modal',
      );
      const slot = document.querySelector('.fg-one-art');
      slot?.appendChild(itemThumb(d.id));
    };
    grid.appendChild(c);
  }
  const all = body.querySelector('.fg-all') as HTMLButtonElement;
  all.onclick = () => {
    if (!copies) return;
    sfx.click();
    modal(
      'Recycle duplicates?',
      `<p class="fg-confirm">Recycle <b>${copies}</b> duplicate${copies === 1 ? '' : 's'} for <b class="fg-gold">${SHARD()} ${fmt(value)} shards</b>?<br><span class="muted small">You keep one copy of every item${keepHigh ? ', and all Legendary, Mythic and Celestial duplicates' : ''}.</span></p>`,
      [
        { label: 'Cancel', cls: 'btn-ghost' },
        {
          label: `Recycle all`,
          cls: 'btn-gold',
          onClick: () => {
            unlockAudio();
            // as cartas "derretem" antes de se refazer o ecrã
            const cards = [...grid.querySelectorAll('.fg-card:not(.kept)')];
            cards.forEach((c, i) => {
              (c as HTMLElement).style.animationDelay = `${Math.min(i, 20) * 25}ms`;
              c.classList.add('melt');
            });
            flyShards(page, all, value);
            const from = FG.shards();
            const res = FG.recycleAll(only);
            sfx.whoosh();
            buzz([20, 40, 30]);
            for (let i = 0; i < 5; i++) setTimeout(() => sfx.coin(), 250 + i * 110);
            setTimeout(() => {
              renderForge(page, 'recycle');
              bumpBalance(page, from, FG.shards());
              toast(`+${fmt(res.shards)} shards from ${res.copies} duplicates`, 'ok');
            }, 650 + Math.min(cards.length, 20) * 25);
          },
        },
      ],
      'fg-modal',
    );
  };
}

// ───────────────────────── Fabricar ─────────────────────────

function craftTab(page: HTMLElement, body: HTMLElement): void {
  const feat = FG.featured();
  const ends = FG.featuredEndsIn();
  const days = Math.max(0, Math.floor(ends / 86400000));
  const hours = Math.max(0, Math.floor((ends % 86400000) / 3600000));
  body.innerHTML = `
    <div class="card fg-feat">
      <div class="fg-feat-head"><b>${ico('star')} Weekly Forge Deals</b><span class="fg-off">-${Math.round(FG.FEATURED_OFF * 100)}%</span><span class="muted small">New deals in ${days}d ${hours}h</span></div>
      <div class="fg-feat-row"></div>
    </div>
    <div class="seg scroll fg-rseg"></div>
    <div class="fg-grid fg-craft"></div>`;
  const row = body.querySelector('.fg-feat-row') as HTMLElement;
  for (const d of feat) row.appendChild(craftCard(page, d, true));
  const rseg = body.querySelector('.fg-rseg') as HTMLElement;
  for (const r of ['all', ...RARITY_ORDER] as (Rarity | 'all')[]) {
    const b = el('button', r === craftR ? 'on' : '', r === 'all' ? 'All' : RARITIES[r].name);
    if (r !== 'all') b.style.setProperty('--rc', rc(r));
    b.onclick = () => {
      sfx.click();
      craftR = r;
      renderForge(page, 'craft');
    };
    rseg.appendChild(b);
  }
  const grid = body.querySelector('.fg-craft') as HTMLElement;
  const list = FG.craftable()
    .filter((d) => craftR === 'all' || d.rarity === craftR)
    .sort((a, b) => Number(owns(a.id)) - Number(owns(b.id)) || RARITIES[a.rarity].tier - RARITIES[b.rarity].tier);
  for (const d of list) grid.appendChild(craftCard(page, d, false));
}

function craftCard(page: HTMLElement, d: ItemDef, feat: boolean): HTMLElement {
  const have = owns(d.id);
  const cost = FG.craftCost(d);
  const afford = FG.shards() >= cost;
  const c = el('button', `fg-card r-${d.rarity} ${have ? 'owned' : ''} ${feat ? 'feat' : ''} ${!have && afford ? 'afford' : ''}`);
  c.style.setProperty('--rc', rc(d.rarity));
  const art = el('div', 'fg-art');
  art.appendChild(itemThumb(d.id));
  c.appendChild(art);
  const disc = cost < FG.CRAFT_COST[d.rarity];
  c.insertAdjacentHTML(
    'beforeend',
    `<div class="fg-name">${esc(d.name)}</div><div class="fg-val">${have ? `Owned ${ico('check')}` : `${disc ? `<s>${fmt(FG.CRAFT_COST[d.rarity])}</s>` : ''}${SHARD()}${fmt(cost)}`}</div>`,
  );
  c.onclick = () => {
    sfx.click();
    if (have) {
      toast('You already own this item.', 'info');
      return;
    }
    modal(
      esc(d.name),
      `<div class="fg-one"><div class="fg-one-art"></div><p>${rarityTag(d.rarity)} · ${KIND_NAMES[d.kind]}</p><p class="muted">${esc(d.desc)}</p><p>Craft cost: <b class="fg-gold">${SHARD()} ${fmt(cost)}</b> · you have <b>${fmt(FG.shards())}</b></p></div>`,
      [
        { label: 'Close', cls: 'btn-ghost' },
        {
          label: afford ? `Craft · ${SHARD()}${fmt(cost)}` : `Need ${fmt(cost - FG.shards())} more`,
          cls: afford ? 'btn-gold' : 'btn-ghost',
          onClick: () => {
            if (!afford) return false;
            if (!FG.craft(d)) return false;
            unlockAudio();
            reveal(d, true, false, 'CRAFTED!', () => renderForge(page, 'craft'));
          },
        },
      ],
      'fg-modal',
    );
    document.querySelector('.fg-one-art')?.appendChild(itemThumb(d.id));
  };
  return c;
}

// ───────────────────────── Fundir ─────────────────────────

function fuseTab(page: HTMLElement, body: HTMLElement): void {
  const fusable = RARITY_ORDER.slice(0, -1) as Rarity[];
  if (!fusable.includes(fuseR)) fuseR = 'comum';
  // escolhe sozinho a primeira raridade que já dá para fundir
  if (!FG.canFuse(fuseR) && !fuseTouched) {
    // sem escolha do jogador: a primeira que já dá para fundir, senão a que está mais perto
    const ready = fusable.find((r) => FG.canFuse(r));
    fuseR = ready ?? fusable.reduce((best, r) => (FG.fuseSpares(r) > FG.fuseSpares(best) ? r : best), fusable[0]);
  }
  const next = RARITY_ORDER[RARITIES[fuseR].tier + 1];
  const have = FG.fuseSpares(fuseR);
  const ok = have >= FG.FUSE_N;
  body.innerHTML = `
    <div class="fg-fuse-tiers"></div>
    <div class="card fg-fuse" style="--rc:${rc(fuseR)};--nc:${rc(next)}">
      <div class="fg-ring">
        ${Array.from({ length: FG.FUSE_N }, (_, i) => `<div class="fg-slot ${i < have ? 'full' : ''}" style="--i:${i}"></div>`).join('')}
        <div class="fg-core"><div class="fg-q">?</div><span>${RARITIES[next].name}</span></div>
      </div>
      <div class="fg-fuse-txt">
        <b>Fuse ${FG.FUSE_N} ${RARITIES[fuseR].name} duplicates</b>
        <span>into <b style="color:${rc(next)}">1 random ${RARITIES[next].name}</b> item.</span>
        <span class="fg-jump">${ico('sparkle')} ${Math.round(FG.JUMP2 * 100)}% chance of a DOUBLE UPGRADE to ${RARITIES[RARITY_ORDER[Math.min(RARITY_ORDER.length - 1, RARITIES[fuseR].tier + 2)]].name}!</span>
        <span class="muted small">Uses your extra copies only — you never lose your last copy of an item.</span>
        <button class="btn btn-gold fg-go" ${ok ? '' : 'disabled'}>${ok ? `${ico('sparkle')} FUSE!` : `Need ${FG.FUSE_N - have} more`}</button>
      </div>
    </div>`;
  const tiers = body.querySelector('.fg-fuse-tiers') as HTMLElement;
  for (const r of fusable) {
    const n = FG.fuseSpares(r);
    const nx = RARITY_ORDER[RARITIES[r].tier + 1];
    const b = el('button', `fg-tier ${r === fuseR ? 'on' : ''} ${n >= FG.FUSE_N ? 'ready' : ''}`);
    b.style.setProperty('--rc', rc(r));
    b.style.setProperty('--nc', rc(nx));
    b.innerHTML = `<span class="fg-tn">${RARITIES[r].name}</span><span class="fg-tc"><b>${Math.min(n, 99)}</b>/${FG.FUSE_N}</span><span class="fg-tarrow">→ ${RARITIES[nx].name}</span>`;
    b.onclick = () => {
      sfx.click();
      fuseR = r;
      fuseTouched = true;
      renderForge(page, 'fuse');
    };
    tiers.appendChild(b);
  }
  // mostra nas ranhuras os repetidos que vão ser usados
  const avail = FG.duplicates()
    .filter((d) => d.rarity === fuseR)
    .map((d) => ({ d, n: FG.spares(d.id) }));
  const use: ItemDef[] = [];
  while (use.length < FG.FUSE_N) {
    avail.sort((a, b) => b.n - a.n);
    if (!avail[0] || avail[0].n <= 0) break;
    avail[0].n--;
    use.push(avail[0].d);
  }
  const slots = body.querySelectorAll('.fg-slot');
  use.forEach((d, i) => slots[i]?.appendChild(itemThumb(d.id)));
  const go = body.querySelector('.fg-go') as HTMLButtonElement;
  go.onclick = () => {
    if (!ok) return;
    unlockAudio();
    const res = FG.fuse(fuseR);
    if (!res) return;
    fuseAnim(res, () => renderForge(page, 'fuse'));
  };
}

/** Animação da fusão: os 5 itens giram, aceleram e colapsam num núcleo de luz antes da revelação. */
function fuseAnim(res: FG.FuseResult, done: () => void): void {
  const from = res.used[0].rarity;
  const root = el('div', 'fg-anim');
  root.style.setProperty('--rc', rc(from));
  root.style.setProperty('--nc', rc(res.out.rarity));
  const orbit = el('div', 'fg-orbit');
  res.used.forEach((d, i) => {
    const o = el('div', 'fg-orb');
    o.style.setProperty('--a', `${(i * 360) / res.used.length}deg`);
    o.appendChild(itemThumb(d.id));
    orbit.appendChild(o);
  });
  root.appendChild(el('div', 'fg-rays'));
  root.appendChild(orbit);
  root.appendChild(el('div', 'fg-nova'));
  const skip = el('button', 'btn btn-ghost sm fg-skip', 'Skip');
  root.appendChild(skip);
  document.body.appendChild(root);
  sfx.whoosh();
  buzz(15);
  const timers: number[] = [];
  const at = (ms: number, f: () => void) => timers.push(window.setTimeout(f, ms));
  // tique-taque a acelerar
  [0, 380, 700, 960, 1160, 1320, 1440, 1530].forEach((t, i) => at(t, () => {
    sfx.click();
    if (i > 4) buzz(8);
  }));
  at(1650, () => {
    root.classList.add('boom');
    sfx.reveal(RARITIES[res.out.rarity].tier);
    buzz([40, 30, 80]);
  });
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    timers.forEach(clearTimeout);
    root.classList.add('out');
    setTimeout(() => root.remove(), 250);
    reveal(res.out, res.isNew, res.jumped, res.jumped ? 'DOUBLE UPGRADE!' : 'FUSED!', done);
  };
  at(2050, finish);
  skip.onclick = (e) => {
    e.stopPropagation();
    finish();
  };
}

/** Carta de revelação (fusão e fabrico): costas da cor da raridade, vira e mostra o item. */
function reveal(d: ItemDef, isNew: boolean, jumped: boolean, title: string, done: () => void): void {
  const tier = RARITIES[d.rarity].tier;
  const root = el('div', `fg-reveal t${tier} ${jumped ? 'jump' : ''}`);
  root.style.setProperty('--rc', rc(d.rarity));
  root.innerHTML = `
    <div class="fg-rv-rays"></div>
    <div class="fg-rv-title">${title}</div>
    <div class="fg-rv-card">
      <div class="fg-rv-back">${ico('sparkle')}</div>
      <div class="fg-rv-front">
        ${isNew ? '<div class="fg-rv-new">NEW!</div>' : '<div class="fg-rv-dup">+1 copy</div>'}
        <div class="fg-rv-art"></div>
        <div class="fg-rv-kind">${KIND_NAMES[d.kind]}</div>
        <div class="fg-rv-name">${esc(d.name)}</div>
        ${rarityTag(d.rarity)}
      </div>
    </div>
    <button class="btn btn-gold fg-rv-ok">Awesome!</button>`;
  root.querySelector('.fg-rv-art')!.appendChild(itemThumb(d.id));
  if (tier >= 4) {
    for (let i = 0; i < 40; i++) {
      const c = el('i', 'fg-conf');
      c.style.left = `${Math.random() * 100}%`;
      c.style.background = ['#ff3d6e', '#ffd23d', '#3aa0ff', '#4cd964', '#b45cff', '#fff'][i % 6];
      c.style.animationDelay = `${0.9 + Math.random() * 0.6}s`;
      c.style.animationDuration = `${1.6 + Math.random() * 1.4}s`;
      root.appendChild(c);
    }
  }
  document.body.appendChild(root);
  setTimeout(() => {
    root.classList.add('flip');
    sfx.reveal(tier);
    if (tier >= 4) buzz([30, 40, 60, 40, 120]);
  }, 650 + Math.min(tier, 5) * 120);
  let gone = false;
  const leave = () => {
    if (gone || !root.classList.contains('flip')) return;
    gone = true;
    sfx.click();
    root.classList.add('out');
    setTimeout(() => root.remove(), 250);
    done();
  };
  // depois de a carta virar, tocar em qualquer lado continua
  root.onclick = leave;
}

/** Atalho usado noutros ecrãs (ex.: janela do item). */
export function openForge(sub?: Sub): void {
  go('forge', sub);
}
