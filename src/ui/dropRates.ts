import { CHESTS, CHEST_ORDER, type ChestDef, type ChestId } from '../data/chests';
import { KIND_NAMES } from '../data/items';
import { RARITIES, RARITY_ORDER, type Rarity } from '../data/rarity';
import { owns, poolFor } from '../core/state';
import { sfx } from '../audio/sfx';
import { el, esc, fmt, modal } from './dom';
import { ico } from './icons';
import { openItem } from './screens/itemModal';
import { chestSvg } from './screens/home';

/** Percentagem legível: 37% · 2.6% · 0.45% · 0.012% */
export function pct(p: number): string {
  const v = p * 100;
  if (v >= 10) return `${v.toFixed(0)}%`;
  if (v >= 1) return `${v.toFixed(1)}%`;
  if (v >= 0.1) return `${v.toFixed(2)}%`;
  return `${v.toPrecision(2)}%`;
}

/** Probabilidade de cada raridade em cada recompensa (antes da garantia). */
export function perReward(c: ChestDef): [Rarity, number][] {
  const tot = Object.values(c.weights).reduce((a, b) => a + (b ?? 0), 0);
  return RARITY_ORDER.filter((r) => c.weights[r]).map((r) => [r, (c.weights[r] ?? 0) / tot]);
}

/**
 * Probabilidade exata de sair pelo menos uma vez algo com chance `a` por recompensa e raridade `r`,
 * tendo em conta a garantia (se nenhuma recompensa atingir a raridade garantida, a última passa a sê-la).
 * `k` é o tamanho do conjunto da raridade (1 = a raridade inteira, N = um item concreto).
 */
function atLeastOne(c: ChestDef, r: Rarity, a: number, k: number): number {
  const n = c.rolls;
  if (!c.guaranteed) return 1 - (1 - a) ** n;
  const g = RARITIES[c.guaranteed].tier;
  const q = perReward(c).filter(([x]) => RARITIES[x].tier < g).reduce((s, [, p]) => s + p, 0);
  let none: number;
  if (RARITIES[r].tier >= g) none = (1 - a) ** n - q ** n + q ** n * (1 - (r === c.guaranteed ? 1 / k : 0));
  else none = (1 - a) ** n + (q - a) ** (n - 1) * a;
  return 1 - none;
}

function chestBody(id: ChestId): HTMLElement {
  const c = CHESTS[id];
  const box = el('div', 'dr-body');
  const extra = [`${ico('coin')} ${fmt(c.coins[0])}–${fmt(c.coins[1])} coins`];
  if (c.gems[1] > 0) extra.push(`${ico('gem')} ${c.gems[0] ? `${c.gems[0]}–` : 'up to '}${c.gems[1]} gems`);
  extra.push(`${ico('chest')} ${c.rolls} item rewards`);
  if (c.guaranteed) extra.push(`${ico('check')} at least 1 <b class="rar-${c.guaranteed}">${RARITIES[c.guaranteed].name}</b> or better`);
  box.innerHTML = `<div class="dr-head" style="--cg:${c.glow}"><div class="dr-art">${chestSvg(c.body, c.trim)}</div><div class="dr-info"><b>${esc(c.name)}</b>${extra.map((x) => `<span>${x}</span>`).join('')}</div></div>
    <table class="dr-table"><thead><tr><th>Rarity</th><th>Each reward</th><th>Per chest</th></tr></thead><tbody></tbody></table>
    <p class="muted small">"Per chest" is the real chance of getting at least one, guarantee included. Items are drawn evenly within their rarity; duplicates can be recycled for coins.</p>
    <div class="dr-items"></div>`;
  const tb = box.querySelector('tbody') as HTMLElement;
  const items = box.querySelector('.dr-items') as HTMLElement;
  for (const [r, p] of [...perReward(c)].reverse()) {
    tb.insertAdjacentHTML('beforeend', `<tr class="rar-${r}"><td><b>${RARITIES[r].name}</b></td><td>${pct(p)}</td><td>${pct(atLeastOne(c, r, p, 1))}</td></tr>`);
    const pool = poolFor(r);
    if (!pool.length) continue;
    const per = atLeastOne(c, r, p / pool.length, pool.length);
    const sec = el('details', `dr-sec rar-${r}`);
    sec.innerHTML = `<summary><b>${RARITIES[r].name}</b><span>${pool.length} items · ${pct(per)} each per chest</span></summary><div class="dr-list"></div>`;
    const list = sec.querySelector('.dr-list') as HTMLElement;
    for (const d of pool) {
      const b = el('button', `dr-it ${owns(d.id) ? 'got' : ''}`, `<span class="dr-n">${esc(d.name)}</span><span class="dr-k">${esc(KIND_NAMES[d.kind] ?? d.kind)}</span>${owns(d.id) ? `<span class="dr-ok">${ico('check')}</span>` : ''}`);
      b.onclick = () => {
        sfx.click();
        openItem(d.id, owns(d.id) ? 'collection' : 'shop');
      };
      list.appendChild(b);
    }
    items.appendChild(sec);
  }
  return box;
}

/** Janela com o conteúdo possível e as probabilidades reais de cada baú. */
export function openDropRates(start: ChestId = 'bronze'): void {
  const wrap = el('div', 'drop-rates');
  const seg = el('div', 'seg scroll');
  const holder = el('div');
  wrap.append(seg, holder);
  const show = (id: ChestId) => {
    seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.id === id));
    holder.replaceChildren(chestBody(id));
  };
  for (const id of CHEST_ORDER) {
    const b = el('button', '', esc(CHESTS[id].name.replace(/ Chest$/, '')));
    b.dataset.id = id;
    b.onclick = () => {
      sfx.click();
      show(id);
    };
    seg.appendChild(b);
  }
  show(start);
  modal(`${ico('chest')} Drop rates`, wrap, [{ label: 'Close' }], 'wide');
}
