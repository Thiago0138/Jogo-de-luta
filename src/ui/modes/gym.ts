import './gym.css';
import { sfx } from '../../audio/sfx';
import { S } from '../../core/state';
import { STATS } from '../../data/stats';
import {
  ENERGY_MAX, EXTRA_GEMS, G, POINT_EVERY, STATION, STATIONS, energy, liveStreak, nextEnergyIn, spendSession, trainedToday,
  type StationId,
} from '../../core/gymStore';
import { el, fmt, timeLeft, toast } from '../dom';
import { ico } from '../icons';
import { go, rememberSub, render } from '../app';
import { HubScene } from './gym/hub';
import { runStation } from './gym/run';

let selected: StationId = 'bag';

/** Ecrã do ginásio: cena com as estações, detalhes da escolhida e progresso do treino. */
export function renderGym(page: HTMLElement, sub?: string): void {
  if (sub && sub in STATION) selected = sub as StationId;
  const head = el('div', 'page-head gym-head');
  head.innerHTML = `
    <button class="gym-back" aria-label="Back">‹</button>
    <h1>Gym</h1>
    <div class="gym-pills">
      <span class="gym-pill energy">${ico('bolt')}<b class="en-n"></b><small class="en-t"></small></span>
      <span class="gym-pill streak ${trainedToday() ? 'done' : ''}">${ico('fire')}<b>${liveStreak()}</b><small>day streak</small></span>
    </div>`;
  page.appendChild(head);
  (head.querySelector('.gym-back') as HTMLElement).onclick = () => {
    sfx.click();
    go('home');
  };

  const stage = el('div', 'gym-stage');
  const detail = el('div', 'gym-detail');
  const hub = new HubScene(selected);
  stage.appendChild(hub.canvas);
  // botões das estações (atalho acessível sobre a cena)
  const tabs = el('div', 'gym-tabs');
  for (const s of STATIONS) {
    const b = el('button', 'gym-tab', `${ico(s.icon)}<span>${s.name}</span>`);
    b.dataset.st = s.id;
    b.onclick = () => {
      sfx.click();
      selected = s.id;
      rememberSub(s.id);
      hub.select(s.id);
      fillDetail();
    };
    tabs.appendChild(b);
  }
  stage.appendChild(tabs);
  page.append(stage, detail);

  const prog = el('div', 'gym-prog');
  page.appendChild(prog);

  function fillDetail(): void {
    const s = STATION[selected];
    const st = STATS.find((x) => x.id === s.stat)!;
    const txp = G.txp[s.stat] ?? 0;
    const best = G.best[s.id] ?? 0;
    const gr = G.bestGrade[s.id];
    const en = energy();
    const label = en > 0 ? `TRAIN <small>${ico('bolt')}1</small>` : `TRAIN <small>${ico('gem')}${EXTRA_GEMS}</small>`;
    tabs.querySelectorAll<HTMLElement>('.gym-tab').forEach((b) => b.classList.toggle('on', b.dataset.st === selected));
    detail.innerHTML = `
      <div class="gd-info">
        <div class="gd-name">${ico(s.icon)} ${s.name}</div>
        <div class="gd-how">${s.how}</div>
      </div>
      <div class="gd-stat" style="--sc:${st.color}">
        <div class="gd-st">${ico(st.icon)} <b>${st.short}</b> <span>${S.stats[s.stat]}</span></div>
        <div class="gd-bar"><i style="width:${txp}%"></i></div>
        <small>${txp}/100 XP to +1</small>
      </div>
      <div class="gd-best">
        <small>Best</small><b>${best ? fmt(best) : '—'}</b>${gr ? `<span class="gd-grade g-${gr}">${gr}</span>` : ''}
      </div>
      <button class="btn ${en > 0 ? 'btn-gold' : 'btn-blue'} gd-go" ${en > 0 || S.gems >= EXTRA_GEMS ? '' : 'disabled'}>${label}</button>`;
    (detail.querySelector('.gd-go') as HTMLElement).onclick = start;
  }

  function fillProg(): void {
    const n = POINT_EVERY - (G.sessions % POINT_EVERY);
    const cards = STATIONS.map((s) => {
      const st = STATS.find((x) => x.id === s.stat)!;
      const txp = G.txp[s.stat] ?? 0;
      return `<div class="gp-card" style="--sc:${st.color}">
        <div class="gp-top">${ico(st.icon)}<b>${st.name}</b><span>${S.stats[s.stat]}</span></div>
        <div class="gd-bar"><i style="width:${txp}%"></i></div>
        <small>${s.name} · +${G.gained[s.stat] ?? 0} trained</small>
      </div>`;
    }).join('');
    prog.innerHTML = `
      <h2 class="sec">Training</h2>
      <div class="gp-grid">${cards}</div>
      <div class="gp-foot">
        <span>${ico('star')} Next <b>Stat Point</b> in ${n} session${n === 1 ? '' : 's'}</span>
        <span>${ico('fire')} Best streak <b>${G.bestStreak}</b> · ${fmt(G.sessions)} sessions</span>
        <span>${ico('coin')} Streak bonus <b>+${Math.min(50, Math.max(0, liveStreak() - 1) * 10)}%</b> coins</span>
      </div>`;
  }

  function fillEnergy(): void {
    const en = energy();
    (head.querySelector('.en-n') as HTMLElement).textContent = `${en}/${ENERGY_MAX}`;
    const ms = nextEnergyIn();
    (head.querySelector('.en-t') as HTMLElement).textContent = ms > 0 ? `+1 in ${timeLeft(ms)}` : 'full';
  }

  function start(): void {
    const free = energy() > 0;
    if (!free && S.gems < EXTRA_GEMS) {
      toast(`Not enough gems (${EXTRA_GEMS} needed)`, 'err');
      return;
    }
    if (!spendSession(!free)) return;
    sfx.click();
    fillEnergy();
    runStation(selected, !free, () => render());
  }

  fillDetail();
  fillProg();
  fillEnergy();
  // relógio da energia (para quando se sai do ecrã)
  let prevEn = energy();
  const iv = window.setInterval(() => {
    if (!head.isConnected) {
      clearInterval(iv);
      return;
    }
    fillEnergy();
    if (energy() !== prevEn) {
      prevEn = energy();
      fillDetail();
    }
  }, 1000);
}

/** Notificação no botão GYM: sessões grátis disponíveis. */
export function gymBadge(): number {
  // só avisa enquanto ainda não treinou hoje (e tem energia)
  return !trainedToday() && energy() > 0 ? 1 : 0;
}
