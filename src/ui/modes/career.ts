import './career.css';
import {
  C, CHAPTERS, EXCLUSIVE_ITEM, MAX_STARS, MILESTONES, STAGES_PER_CHAPTER, applyResult, careerBadgeCount, careerDone,
  chapterStars, chapterUnlocked, claimMilestone, claimableMilestones, consumeFresh, firstClearRewards, maskOf,
  nextMilestone, nextStage, stageOpponent, stagesOf, starsOf, totalStars, unlocked,
  STAGES, type StageDef, type StageResult,
} from '../../core/career';
import { S } from '../../core/state';
import { CHESTS, type ChestId } from '../../data/chests';
import { ITEMS } from '../../data/items';
import { RARITIES } from '../../data/rarity';
import { maxHp, powerRating } from '../../data/stats';
import { playerSpec } from '../../core/opponents';
import { sfx } from '../../audio/sfx';
import { go, render, rememberSub } from '../app';
import { openChest } from '../chest';
import { countUp, el, esc, fmt, toast } from '../dom';
import { ico } from '../icons';
import { Preview, itemThumb } from '../preview';
import { showLevelUpModal, startCustomMatch } from '../play';
import { chestSvg } from '../screens/home';

/** Posições (em %) dos 8 nós no mapa de um capítulo: uma estrada em onda. */
const NODE_POS: [number, number][] = [
  [7, 74], [19, 40], [31, 74], [43, 40], [55, 72], [67, 40], [78.5, 70], [90.5, 46],
];

const STAR = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.8l3.1 6.5 7.1.9-5.2 4.9 1.3 7.1L12 17.8 5.7 21.2 7 14.1 1.8 9.2l7.1-.9z"/></svg>`;

function bits(m: number): number {
  return (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1);
}

/** Estrelas acesas por contagem (as condições cumpridas aparecem na ficha). */
function starRow(mask: number, cls = ''): string {
  const n = bits(mask);
  return `<span class="ca-stars ${cls}">${[0, 1, 2].map((k) => `<i class="${k < n ? 'on' : ''}">${STAR}</i>`).join('')}</span>`;
}

function chestArt(id: ChestId): string {
  const c = CHESTS[id];
  return `<span class="ca-chest" style="--cg:${c.glow}">${chestSvg(c.body, c.trim)}</span>`;
}

function itemName(id: string): string {
  return ITEMS[id]?.name ?? id;
}

/** Capítulo a mostrar: o da sub-tab, ou o da próxima etapa. */
function currentChapter(sub?: string): number {
  const n = sub && /^ch[1-5]$/.test(sub) ? Number(sub.slice(2)) - 1 : -1;
  if (n >= 0 && chapterUnlocked(n)) return n;
  const nx = nextStage();
  return nx ? nx.ch.n - 1 : CHAPTERS.length - 1;
}

// ───────────────────────── Ecrã principal ─────────────────────────

export function renderCareer(page: HTMLElement, sub?: string): void {
  const ci = currentChapter(sub);
  const ch = CHAPTERS[ci];
  const total = totalStars();
  const nm = nextMilestone();
  const prevMs = nm ? MILESTONES[MILESTONES.indexOf(nm) - 1]?.stars ?? 0 : MAX_STARS;
  const claim = claimableMilestones();
  const done = careerDone();

  const wrap = el('div', `ca-wrap ${done ? 'ca-done' : ''}`);
  wrap.style.setProperty('--cc', ch.color);
  wrap.style.setProperty('--cd', ch.dark);
  wrap.innerHTML = `
    <div class="ca-top">
      <button class="ca-back" aria-label="Back"><span>‹</span></button>
      <div class="ca-title"><small>${done ? `${ico('crown')} Undisputed Champion` : 'Career'}</small><b>Road to the Title</b></div>
      <div class="ca-chips">${CHAPTERS.map((c, i) => {
        const open = chapterUnlocked(i);
        const cs = chapterStars(i);
        return `<button class="ca-chip ${i === ci ? 'on' : ''} ${open ? '' : 'locked'} ${C.chs.includes(c.n) ? 'won' : ''}" data-ch="${i}" style="--k:${c.color}">
          <b>${open ? c.n : ico('lock')}</b><span>${open ? `${cs}<i>${STAR}</i>` : 'Locked'}</span></button>`;
      }).join('')}</div>
      <button class="ca-starbox ${claim.length ? 'ready' : ''}">
        <span class="ca-sb-num"><i>${STAR}</i><b>${total}</b><small>/${MAX_STARS}</small></span>
        <span class="ca-sb-bar"><i style="transform:scaleX(${nm ? Math.min(1, (total - prevMs) / (nm.stars - prevMs)) : 1})"></i><em>${claim.length ? 'CLAIM!' : nm ? `${nm.stars}${'★'}` : 'ALL DONE'}</em></span>
        ${chestArt((claim[0] ?? nm ?? MILESTONES[MILESTONES.length - 1]).chest)}
      </button>
    </div>
    <div class="ca-map">
      <div class="ca-bg"><i class="ca-glow"></i><i class="ca-lights"></i><span class="ca-bignum">${ch.n}</span></div>
      <div class="ca-chead">
        <span class="ca-cn">Chapter ${ch.n} · ${esc(ITEMS[ch.arena]?.name ?? '')}</span>
        <h2>${esc(ch.name)}</h2>
        <p>${esc(ch.sub)}</p>
      </div>
      <div class="ca-cstars"><i>${STAR}</i><b>${chapterStars(ci)}</b>/${STAGES_PER_CHAPTER * 3}</div>
      <svg class="ca-road" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true"></svg>
      <div class="ca-nodes"></div>
      <div class="ca-foot"></div>
      ${ci > 0 ? `<button class="ca-nav prev" aria-label="Previous chapter">‹</button>` : ''}
      ${ci < CHAPTERS.length - 1 ? `<button class="ca-nav next ${chapterUnlocked(ci + 1) ? '' : 'locked'}" aria-label="Next chapter">›</button>` : ''}
    </div>`;
  page.appendChild(wrap);
  fitHeight(page, wrap);

  (wrap.querySelector('.ca-back') as HTMLElement).onclick = () => {
    sfx.click();
    go('home');
  };
  const toChapter = (i: number) => {
    if (i < 0 || i >= CHAPTERS.length) return;
    if (!chapterUnlocked(i)) {
      sfx.block();
      toast(`Beat ${CHAPTERS[i - 1].boss.name} to unlock Chapter ${i + 1}!`, 'info');
      return;
    }
    sfx.click();
    rememberSub(`ch${i + 1}`);
    go('career', `ch${i + 1}`);
  };
  wrap.querySelectorAll<HTMLElement>('.ca-chip').forEach((b) => (b.onclick = () => toChapter(Number(b.dataset.ch))));
  (wrap.querySelector('.ca-nav.prev') as HTMLElement | null)?.addEventListener('click', () => toChapter(ci - 1));
  (wrap.querySelector('.ca-nav.next') as HTMLElement | null)?.addEventListener('click', () => toChapter(ci + 1));
  (wrap.querySelector('.ca-starbox') as HTMLElement).onclick = () => openStarRoad();

  drawMap(wrap, ci);
}

/** O mapa ocupa exatamente a altura visível (sem scroll) em telemóveis deitados. */
function fitHeight(page: HTMLElement, wrap: HTMLElement): void {
  const fit = () => {
    const v = page.parentElement;
    if (!v || !wrap.isConnected) {
      window.removeEventListener('resize', fit);
      return;
    }
    const cs = getComputedStyle(v);
    const h = v.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 2;
    wrap.style.height = `${Math.max(270, h)}px`;
  };
  fit();
  window.addEventListener('resize', fit);
}

function drawMap(wrap: HTMLElement, ci: number): void {
  const ch = CHAPTERS[ci];
  const stages = stagesOf(ci);
  const svg = wrap.querySelector('.ca-road') as SVGSVGElement;
  const nodes = wrap.querySelector('.ca-nodes') as HTMLElement;
  const pts = NODE_POS.map(([x, y]) => [x * 10, y * 10] as [number, number]);
  // curva suave (Catmull-Rom → Bézier) que passa por todos os nós
  const seg = (a: number, b: number) => {
    let d = `M${pts[a][0]},${pts[a][1]}`;
    for (let i = a; i < b; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
    }
    return d;
  };
  const doneTo = Math.max(0, stages.filter((s) => starsOf(s.id) > 0).length - (stages.every((s) => starsOf(s.id) > 0) ? 1 : 0));
  const full = seg(0, pts.length - 1);
  svg.innerHTML = `
    <path d="${full}" class="rd-edge" vector-effect="non-scaling-stroke"/>
    <path d="${full}" class="rd-base" vector-effect="non-scaling-stroke"/>
    ${doneTo > 0 ? `<path d="${seg(0, Math.min(pts.length - 1, doneTo))}" class="rd-done" vector-effect="non-scaling-stroke"/>` : ''}
    <path d="${full}" class="rd-dash" vector-effect="non-scaling-stroke"/>`;

  const nx = nextStage();
  const fresh = consumeFresh();
  stages.forEach((st, i) => {
    const [x, y] = NODE_POS[i];
    const open = unlocked(st);
    const stars = starsOf(st.id);
    const cur = nx?.id === st.id;
    const b = el('button', `ca-node ${st.boss ? 'boss' : ''} ${open ? 'open' : 'locked'} ${stars ? 'clear' : ''} ${cur ? 'cur' : ''} ${fresh === st.id ? 'fresh' : ''} ${stars === 3 ? 'perfect' : ''}`);
    b.style.left = `${x}%`;
    b.style.top = `${y}%`;
    b.style.setProperty('--d', `${i * 0.04}s`);
    const label = st.boss ? `<span class="ca-boss-name">${esc(ch.boss.name)}</span>` : '';
    b.innerHTML = `
      ${cur ? `<span class="ca-here">${st.boss ? 'BOSS!' : 'FIGHT!'}</span>` : ''}
      ${st.boss ? `<span class="ca-crown">${ico('crown')}</span>` : ''}
      <span class="ca-disc"><b>${open ? (st.boss ? ico('glove') : `${ch.n}-${i + 1}`) : ico('lock')}</b></span>
      ${open ? starRow(maskOf(st.id)) : ''}
      ${label}`;
    b.onclick = () => {
      if (!open) {
        sfx.block();
        toast('Clear the previous stage first!', 'info');
        return;
      }
      sfx.click();
      openStage(st);
    };
    nodes.appendChild(b);
  });

  // rodapé: recompensa do chefe do capítulo
  const foot = wrap.querySelector('.ca-foot') as HTMLElement;
  const rw = ch.reward;
  const got = C.chs.includes(ch.n);
  foot.innerHTML = `
    <span class="ca-f-lab">${got ? `${ico('check')} Chapter cleared` : `${ico('crown')} Beat the boss`}</span>
    <span class="ca-f-items ${got ? 'got' : ''}">
      <span class="ca-f-it">${chestArt(rw.chest)}<em>${esc(CHESTS[rw.chest].name.replace(/ Chest$/, ''))}</em></span>
      <span class="ca-f-it">${ico('gem')}<em>${rw.gems}</em></span>
      ${rw.items.map((id) => `<span class="ca-f-it it" data-id="${id}" style="--rc:${RARITIES[ITEMS[id].rarity].color}"><i class="ca-thumb"></i><em>${esc(itemName(id))}</em></span>`).join('')}
    </span>`;
  foot.querySelectorAll<HTMLElement>('.ca-f-it.it').forEach((e) => {
    const th = e.querySelector('.ca-thumb') as HTMLElement;
    th.appendChild(itemThumb(e.dataset.id!));
  });
}

// ───────────────────────── Ficha da etapa ─────────────────────────

function overlay(cls: string): { root: HTMLElement; box: HTMLElement; close: () => void } {
  const root = el('div', `ca-pop ${cls}`);
  const box = el('div', 'ca-pop-box');
  root.appendChild(box);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    root.classList.add('out');
    setTimeout(() => root.remove(), 200);
  };
  root.addEventListener('click', (e) => {
    if (e.target === root) {
      sfx.click();
      close();
    }
  });
  document.body.appendChild(root);
  return { root, box, close };
}

function vsBadge(st: StageDef): string {
  return st.boss
    ? `<span class="vs-rank champ ca-vs-boss">${ico('crown')}<b>${esc(st.ch.boss.title.toUpperCase())}</b></span>`
    : `<span class="vs-rank ca-vs-stage" style="--lc:${st.ch.color}">${ico('road')}<b>STAGE ${st.ch.n}-${st.i + 1}</b></span>`;
}

function openStage(st: StageDef): void {
  const opp = stageOpponent(st);
  const me = playerSpec();
  const myPow = powerRating(me.level, me.stats);
  const opPow = powerRating(opp.level, opp.stats);
  const mask = maskOf(st.id);
  const first = mask === 0;
  const fc = firstClearRewards(st);
  const coins = first ? fc.coins : Math.round(fc.coins * 0.3);
  const xp = first ? fc.xp : Math.round(fc.xp * 0.4);
  const ratio = myPow / Math.max(1, myPow + opPow);
  const diff = ratio > 0.53 ? ['easy', 'Easy'] : ratio > 0.47 ? ['even', 'Even'] : ratio > 0.42 ? ['hard', 'Tough'] : ['brutal', 'Brutal'];
  const ch = st.ch;
  const { box, close } = overlay(`ca-stage ${st.boss ? 'is-boss' : ''}`);
  box.style.setProperty('--cc', ch.color);
  box.style.setProperty('--cd', ch.dark);
  const sup = ITEMS[opp.supers[0]];
  const pas = ITEMS[opp.passives[0]];
  box.innerHTML = `
    <button class="ca-x" aria-label="Close">${ico('close')}</button>
    <div class="ca-st-left">
      <div class="ca-st-tag">${st.boss ? `${ico('crown')} Chapter boss` : `Stage ${ch.n}-${st.i + 1}`}</div>
      <div class="ca-st-art"></div>
      <div class="ca-st-name"><b>${esc(opp.name)}</b><span>${esc(opp.title ?? '')} · LV ${opp.level}</span></div>
    </div>
    <div class="ca-st-right">
      ${st.boss ? `<p class="ca-quote">“${esc(ch.boss.quote)}”</p>` : ''}
      <div class="ca-pow">
        <span class="me"><b>${ico('bolt')}${fmt(myPow)}</b><small>You</small></span>
        <span class="ca-pow-bar" style="--share:${ratio}"><i></i><em class="d-${diff[0]}">${diff[1]}</em></span>
        <span class="op"><b>${ico('bolt')}${fmt(opPow)}</b><small>Rival</small></span>
      </div>
      <div class="ca-gear">
        ${sup ? `<span style="--rc:${RARITIES[sup.rarity].color}">${ico('bolt')}${esc(sup.name)}</span>` : ''}
        ${pas ? `<span style="--rc:${RARITIES[pas.rarity].color}">${ico('abilities')}${esc(pas.name)}</span>` : ''}
        <span>${ico('heart')}${fmt(maxHp(opp.level, opp.stats.vit) * (opp.hpMul ?? 1))} HP</span>
      </div>
      <ul class="ca-goals">
        ${st.stars.map((c, k) => `<li class="${mask & (1 << k) ? 'done' : ''}"><i>${STAR}</i><span>${esc(c.text)}</span>${mask & (1 << k) ? ico('check') : ''}</li>`).join('')}
      </ul>
      <div class="ca-rw">
        <span class="ca-rw-lab">${first ? 'First win' : 'Replay'}</span>
        <span>${ico('coin')}<b>${fmt(coins)}</b></span>
        <span>${ico('xp')}<b>${fmt(xp)}</b><small>XP</small></span>
        <span>${ico('gem')}<b>${fc.gemsPerStar}</b><small>/new ${'★'}</small></span>
        ${st.boss && first ? `<span class="ca-rw-chest">${chestArt(ch.reward.chest)}<b>+${ch.reward.items.length} item${ch.reward.items.length > 1 ? 's' : ''}</b></span>` : ''}
      </div>
      <div class="ca-st-actions">
        ${S.level < st.level - 2 ? `<span class="ca-warn">Recommended level ${st.level}</span>` : ''}
        <button class="btn btn-gold ca-go">${starsOf(st.id) === 3 ? 'Replay' : st.boss ? 'Face the boss!' : 'Fight!'}</button>
      </div>
    </div>`;
  const p = new Preview(opp.look, { stage: true });
  p.facing = -1;
  p.play('guard');
  box.querySelector('.ca-st-art')!.appendChild(p.canvas);
  (box.querySelector('.ca-x') as HTMLElement).onclick = () => {
    sfx.click();
    close();
  };
  (box.querySelector('.ca-go') as HTMLElement).onclick = () => {
    close();
    fightStage(st);
  };
}

function fightStage(st: StageDef): void {
  const opp = stageOpponent(st);
  const ch = st.ch;
  startCustomMatch({
    mode: st.boss ? 'champion' : 'solo',
    teams: [[playerSpec()], [opp]],
    arena: st.arena,
    title: st.boss
      ? `${ico('crown')}${esc(ch.boss.title.toUpperCase())}<small>Career · Chapter ${ch.n} boss</small>`
      : `STAGE ${ch.n}-${st.i + 1}<small>${esc(ch.name)}</small>`,
    badge: vsBadge(st),
    onResult: (_won, report) => {
      const res = applyResult(st, report);
      rememberSub(`ch${ch.n}`);
      go('career', `ch${ch.n}`);
      showResult(res);
    },
  });
}

// ───────────────────────── Resultado ─────────────────────────

function showResult(res: StageResult): void {
  const { st, won } = res;
  const ch = st.ch;
  const { root, box, close } = overlay(`ca-result ${won ? 'win' : 'lose'}`);
  box.style.setProperty('--cc', ch.color);
  box.style.setProperty('--cd', ch.dark);
  const nextSt = won && st.g + 1 < STAGES.length ? STAGES[st.g + 1] : null;
  const head = won ? (res.chapterDone ? (ch.n === CHAPTERS.length ? 'WORLD CHAMPION!' : 'CHAPTER CLEAR!') : res.firstClear ? 'STAGE CLEAR!' : 'VICTORY!') : 'DEFEATED';
  box.innerHTML = `
    <div class="ca-res-burst"></div>
    <div class="ca-res-head"><small>${st.boss ? esc(ch.boss.name) : `Stage ${ch.n}-${st.i + 1}`} · ${esc(ch.name)}</small><h1>${head}</h1></div>
    <div class="ca-res-stars">${[0, 1, 2].map((k) => `<i class="s${k} ${k < bits(res.before) ? 'had' : ''}">${STAR}</i>`).join('')}</div>
    <ul class="ca-goals mini">${st.stars.map((c, k) => `<li class="${res.got & (1 << k) ? 'done' : res.before & (1 << k) ? 'had' : ''}"><i>${STAR}</i><span>${esc(c.text)}</span></li>`).join('')}</ul>
    <div class="ca-res-rw">
      <span>${ico('coin')}<b class="rc">0</b></span>
      <span>${ico('xp')}<b>+${fmt(res.xp)}</b><small>XP</small></span>
      ${res.gems ? `<span>${ico('gem')}<b>+${fmt(res.gems)}</b></span>` : ''}
      ${res.newStars ? `<span class="ns">${STAR}<b>+${res.newStars}</b></span>` : ''}
    </div>
    <div class="ca-res-extra"></div>
    <div class="ca-res-actions">
      <button class="btn btn-ghost sm map">Map</button>
      ${won ? '' : `<button class="btn btn-blue sm retry">Retry</button>`}
      ${nextSt && unlocked(nextSt) ? `<button class="btn btn-gold sm next">${nextSt.boss ? 'Boss fight ›' : 'Next stage ›'}</button>` : ''}
    </div>`;

  // recompensas extra: baú do capítulo e itens
  const extra = box.querySelector('.ca-res-extra') as HTMLElement;
  if (res.chapterDone) {
    const id = res.chests[0];
    extra.innerHTML = `
      <div class="ca-ex-box">
        ${id ? `<button class="ca-ex-chest" title="Open">${chestArt(id)}<b>Open</b></button>` : ''}
        ${res.items.map((it) => `<span class="ca-ex-item" data-id="${it.id}" style="--rc:${RARITIES[ITEMS[it.id].rarity].color}"><i class="ca-thumb"></i><em>${esc(itemName(it.id))}</em>${it.isNew ? '<small>NEW!</small>' : ITEMS[it.id].kind === 'arena' ? '<small>+150 gems</small>' : ''}</span>`).join('')}
        <div class="ca-ex-txt"><b>${res.chapterDone.n === CHAPTERS.length ? 'You are the WORLD CHAMPION!' : `Chapter ${res.chapterDone.n + 1} unlocked!`}</b><span>${res.items.some((x) => x.id === EXCLUSIVE_ITEM) ? `Exclusive reward: ${esc(itemName(EXCLUSIVE_ITEM))}` : 'Rewards added to your collection.'}</span></div>
      </div>`;
    extra.querySelectorAll<HTMLElement>('.ca-ex-item').forEach((e) => (e.querySelector('.ca-thumb') as HTMLElement).appendChild(itemThumb(e.dataset.id!)));
    const cb = extra.querySelector('.ca-ex-chest') as HTMLElement | null;
    if (cb && id)
      cb.onclick = () => {
        sfx.click();
        if (S.chests[id] > 0) openChest(id, () => cb.remove());
      };
  } else if (won && claimableMilestones().length) {
    extra.innerHTML = `<div class="ca-ex-box ms"><span>${chestArt(claimableMilestones()[0].chest)}</span><div class="ca-ex-txt"><b>Star chest ready!</b><span>Claim it from the star bar on the map.</span></div></div>`;
  } else if (!won) {
    extra.innerHTML = `<div class="ca-ex-tip">${ico('info')} Level up, spend stat points and gear up in the <b>Fighter</b> tab, then come back!</div>`;
  }

  // animação das estrelas
  const starEls = [...box.querySelectorAll<HTMLElement>('.ca-res-stars i')];
  let delay = 450;
  const nb = bits(res.before);
  const na = bits(res.after);
  starEls.forEach((s, k) => {
    if (k >= na) return;
    const isNew = k >= nb;
    setTimeout(() => {
      s.classList.add('on');
      if (isNew) s.classList.add('new');
      sfx.ding();
      if (isNew) sfx.coin();
    }, delay);
    delay += 380;
  });
  if (won) {
    sfx.levelUp();
    sfx.cheer(res.chapterDone ? 1.3 : 0.8);
  }
  countUp(box.querySelector('.rc') as HTMLElement, 0, res.coins, 900);

  const after = () => {
    if (res.levelUp) showLevelUpModal(res.levelUp);
  };
  (box.querySelector('.map') as HTMLElement).onclick = () => {
    sfx.click();
    close();
    after();
  };
  (box.querySelector('.retry') as HTMLElement | null)?.addEventListener('click', () => {
    close();
    after();
    if (!res.levelUp) openStage(st);
  });
  (box.querySelector('.next') as HTMLElement | null)?.addEventListener('click', () => {
    close();
    after();
    if (nextSt && !res.levelUp) {
      if (nextSt.ch.n !== ch.n) {
        rememberSub(`ch${nextSt.ch.n}`);
        go('career', `ch${nextSt.ch.n}`);
      }
      openStage(nextSt);
    } else if (nextSt && nextSt.ch.n !== ch.n) go('career', `ch${nextSt.ch.n}`);
  });
  void root;
}

// ───────────────────────── Estrada das estrelas (baús) ─────────────────────────

function openStarRoad(): void {
  sfx.click();
  const total = totalStars();
  const { box, close } = overlay('ca-road-pop');
  const rows = MILESTONES.map((m) => {
    const got = C.ms.includes(m.stars);
    const ready = !got && total >= m.stars;
    return `<button class="ca-ms ${got ? 'got' : ''} ${ready ? 'ready' : ''}" data-s="${m.stars}" ${ready ? '' : 'disabled'}>
      <span class="ca-ms-n"><i>${STAR}</i>${m.stars}</span>
      ${chestArt(m.chest)}
      <span class="ca-ms-g">${ico('gem')}${m.gems}</span>
      <em>${got ? ico('check') : ready ? 'Claim' : `${Math.max(0, m.stars - total)} to go`}</em>
    </button>`;
  }).join('');
  box.innerHTML = `
    <button class="ca-x" aria-label="Close">${ico('close')}</button>
    <div class="ca-rp-head"><h2>${STAR} Star Chests</h2><span>Every 10 stars earns a chest. You have <b>${total}</b> / ${MAX_STARS} stars.</span></div>
    <div class="ca-ms-row">${rows}</div>
    <div class="ca-rp-foot">${ico('crown')} Finish the World Title to win the exclusive <b style="color:${RARITIES[ITEMS[EXCLUSIVE_ITEM].rarity].color}">${esc(itemName(EXCLUSIVE_ITEM))}</b> gloves.</div>`;
  (box.querySelector('.ca-x') as HTMLElement).onclick = () => {
    sfx.click();
    close();
  };
  box.querySelectorAll<HTMLButtonElement>('.ca-ms.ready').forEach((b) => {
    b.onclick = () => {
      const m = claimMilestone(Number(b.dataset.s));
      if (!m) return;
      sfx.coin();
      close();
      render();
      toast(`${CHESTS[m.chest].name} + ${m.gems} gems!`, 'ok');
      openChest(m.chest, () => render());
    };
  });
  const first = box.querySelector('.ca-ms.ready, .ca-ms:not(.got)') as HTMLElement | null;
  first?.scrollIntoView({ inline: 'center', block: 'nearest' });
}

/** Número para o "badge" de notificação deste modo (0 = nada por fazer). */
export function careerBadge(): number {
  return careerBadgeCount();
}

