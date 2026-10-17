import { sfx } from '../../../audio/sfx';
import { STATS } from '../../../data/stats';
import { S } from '../../../core/state';
import { EXTRA_GEMS, STATION, energy, finishSession, refundSession, spendSession, type SessionResult, type StationId } from '../../../core/gymStore';
import { el, fmt } from '../../dom';
import { ico } from '../../icons';
import { makeGame, type MiniGame } from './games';
import { outlined, rr } from './kit';

type Phase = 'count' | 'play' | 'end' | 'done';

const COUNT = 2.6;

/**
 * Corre um mini-jogo num ecrã inteiro por cima da app.
 * A sessão já deve ter sido paga (energia/gemas) antes de chamar.
 */
export function runStation(id: StationId, paidGems: boolean, onClose: () => void): void {
  const def = STATION[id];
  const ov = el('div', 'gym-play');
  const cv = el('canvas', 'gp-canvas');
  const quit = el('button', 'gp-quit', `${ico('close')}<span>End</span>`);
  quit.setAttribute('aria-label', 'Finish now');
  ov.append(cv, quit);
  document.body.appendChild(ov);
  const ctx = cv.getContext('2d')!;
  const game: MiniGame = makeGame(id);
  let phase: Phase = 'count';
  let pt = 0;
  let last = performance.now();
  let lastSec = -1;
  if (import.meta.env.DEV) (window as unknown as { __gym: unknown }).__gym = game;

  const size = () => {
    const W = ov.clientWidth || window.innerWidth;
    const H = ov.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    game.resize(W, H, dpr);
  };
  size();
  const ro = new ResizeObserver(size);
  ro.observe(ov);

  const pos = (e: PointerEvent): [number, number] => {
    const r = cv.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try {
      cv.setPointerCapture(e.pointerId);
    } catch {
      /* sem captura */
    }
    const [x, y] = pos(e);
    game.down(x, y);
  });
  const up = (e: PointerEvent) => {
    const [x, y] = pos(e);
    game.up(x, y);
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  quit.onclick = () => {
    sfx.click();
    if (phase === 'count') {
      // ainda não começou: devolve a sessão e sai
      phase = 'done';
      refundSession(paidGems);
      close();
    } else if (phase === 'play') {
      phase = 'end';
      pt = 0;
      game.live = false;
      game.up(0, 0);
    }
  };

  const tick = (now: number) => {
    if (!ov.isConnected) {
      ro.disconnect();
      return;
    }
    let dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (document.hidden) dt = 0;
    pt += dt;
    if (phase === 'count') {
      const sec = Math.ceil(COUNT - pt);
      if (sec !== lastSec && sec > 0 && sec <= 3) {
        lastSec = sec;
        sfx.click();
      }
      if (pt >= COUNT) {
        phase = 'play';
        pt = 0;
        game.live = true;
        sfx.bell();
      }
    } else if (phase === 'play') {
      game.t += dt;
      const left = game.dur - game.t;
      const sec = Math.ceil(left);
      if (sec <= 3 && sec !== lastSec && sec > 0) {
        lastSec = sec;
        sfx.ding();
      }
      if (left <= 0) {
        phase = 'end';
        pt = 0;
        game.live = false;
        game.up(0, 0);
        sfx.bell();
      }
    } else if (phase === 'end' && pt > 1.1) {
      phase = 'done';
      showResult();
    }
    game.update(dt, now / 1000);
    const dpr = game.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    game.draw(ctx, now / 1000);
    hud(now / 1000);
    if (phase !== 'done') requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  function hud(now: number): void {
    const { W, H } = game;
    // pontuação
    ctx.fillStyle = 'rgba(10,6,20,0.7)';
    rr(ctx, 10, 8, 150, 50, 14);
    ctx.fill();
    outlined(ctx, 'SCORE', 22, 22, 12, '#a99fc4', 'left');
    outlined(ctx, fmt(game.score), 22, 42, 24, '#fff', 'left');
    if (game.combo >= 2) {
      const p = game.comboPulse;
      game.comboPulse = Math.max(0, p - 0.03);
      outlined(ctx, `x${game.combo} COMBO`, 22, 76, 18 + p * 8, game.combo >= 10 ? '#ff7ae0' : '#ffd23d', 'left');
    }
    // tempo
    const bw = Math.min(260, W * 0.32);
    const bx = W / 2 - bw / 2;
    const left = Math.max(0, game.dur - game.t);
    ctx.fillStyle = 'rgba(10,6,20,0.7)';
    rr(ctx, bx - 8, 10, bw + 16, 30, 15);
    ctx.fill();
    ctx.fillStyle = '#2e2346';
    rr(ctx, bx, 18, bw, 14, 7);
    ctx.fill();
    const u = left / game.dur;
    ctx.fillStyle = left < 5 ? (Math.floor(now * 6) % 2 ? '#ff3d6e' : '#ff8aa8') : '#ffd23d';
    rr(ctx, bx, 18, Math.max(14, bw * u), 14, 7);
    ctx.fill();
    outlined(ctx, String(Math.ceil(left)), W / 2, 54, 18, '#fff');
    // contagem
    if (phase === 'count') {
      ctx.fillStyle = 'rgba(8,4,18,0.45)';
      ctx.fillRect(0, 0, W, H);
      outlined(ctx, def.name.toUpperCase(), W / 2, H * 0.24, 30, '#ffd23d');
      const n = Math.ceil(COUNT - pt);
      const f = 1 - ((COUNT - pt) % 1);
      const s = 70 * (1.3 - f * 0.3);
      outlined(ctx, n > 0 ? String(n) : 'GO!', W / 2, H * 0.48, s, '#fff');
      outlined(ctx, game.hint, W / 2, H * 0.7, Math.min(22, W / 34), '#c9b8ff');
    } else if (phase === 'play' && game.t < 0.6) {
      ctx.globalAlpha = 1 - game.t / 0.6;
      outlined(ctx, 'GO!', W / 2, H * 0.45, 70 + game.t * 60, '#ffd23d');
      ctx.globalAlpha = 1;
    } else if (phase === 'end' || phase === 'done') {
      ctx.fillStyle = 'rgba(8,4,18,0.4)';
      ctx.fillRect(0, 0, W, H);
      outlined(ctx, "TIME!", W / 2, H * 0.45, 64 + Math.min(1, pt * 4) * 10, '#ffd23d');
    }
  }

  function showResult(): void {
    quit.remove();
    const res = finishSession(id, game.score);
    ov.appendChild(resultCard(res, game, () => close(), () => again()));
    sfx.reveal(res.grade === 'S' ? 4 : res.grade === 'A' ? 3 : res.grade === 'B' ? 2 : 1);
    if (res.statUps) setTimeout(() => sfx.levelUp(), 900);
    else setTimeout(() => sfx.coin(), 700);
  }

  function close(): void {
    ov.classList.add('out');
    setTimeout(() => {
      ov.remove();
      ro.disconnect();
    }, 180);
    onClose();
  }

  function again(): void {
    const free = energy() > 0;
    if (!spendSession(!free)) return;
    ov.remove();
    ro.disconnect();
    runStation(id, !free, onClose);
  }
}

function resultCard(r: SessionResult, g: MiniGame, onDone: () => void, onAgain: () => void): HTMLElement {
  const def = STATION[r.station];
  const st = STATS.find((s) => s.id === r.stat)!;
  const wrap = el('div', 'gym-res');
  const free = energy();
  const canAgain = free > 0 || S.gems >= EXTRA_GEMS;
  const againLbl = free > 0 ? `Again <small>${ico('bolt')}1</small>` : `Again <small>${ico('gem')}${EXTRA_GEMS}</small>`;
  const rew: string[] = [`<span class="gr-chip coin">${ico('coin')}+${fmt(r.coins)}</span>`];
  if (r.gems) rew.push(`<span class="gr-chip gem">${ico('gem')}+${r.gems}</span>`);
  if (r.statPoint) rew.push(`<span class="gr-chip pt">${ico('star')}+1 Stat Point</span>`);
  if (r.streakBonus > 0) rew.push(`<span class="gr-chip streak">${ico('fire')}Streak +${Math.round(r.streakBonus * 100)}%</span>`);
  const statTxt = r.statUps
    ? `<b>${st.name}</b> <span class="gr-up">${r.statFrom} → ${r.statFrom + r.statUps}</span>`
    : `<b>${st.name}</b> <span>${S.stats[r.stat]}</span>`;
  wrap.innerHTML = `
    <div class="gr-card g-${r.grade}">
      <div class="gr-left">
        <div class="gr-grade">${r.grade}</div>
        <div class="gr-name">${def.name}</div>
      </div>
      <div class="gr-right">
        <div class="gr-score"><small>Score</small><b class="gr-num">0</b>${r.newBest ? '<span class="gr-best">NEW BEST!</span>' : `<span class="gr-pb">Best ${fmt(r.best)}</span>`}</div>
        <div class="gr-stats"><span><i class="c-p"></i>Perfect ${g.perfect}</span><span><i class="c-g"></i>Good ${g.good}</span><span><i class="c-m"></i>Miss ${g.miss}</span><span>Max combo ${g.maxCombo}</span></div>
        <div class="gr-train" style="--sc:${st.color}">
          <div class="gr-trow">${ico(st.icon)} ${statTxt}<em>+${r.xpGain} training XP</em></div>
          <div class="gr-bar"><i style="width:${r.xpFrom}%"></i></div>
        </div>
        <div class="gr-rew">${rew.join('')}</div>
        <div class="gr-btns">
          <button class="btn btn-ghost sm gr-again" ${canAgain ? '' : 'disabled'}>${againLbl}</button>
          <button class="btn btn-gold sm gr-done">Done</button>
        </div>
      </div>
    </div>`;
  const num = wrap.querySelector('.gr-num') as HTMLElement;
  const t0 = performance.now();
  const step = (now: number) => {
    const u = Math.min(1, (now - t0) / 700);
    num.textContent = fmt(r.score * (1 - Math.pow(1 - u, 3)));
    if (u < 1 && num.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  // barra de XP: enche (e dá a volta se subiu de nível)
  const bar = wrap.querySelector('.gr-bar i') as HTMLElement;
  setTimeout(() => {
    if (r.statUps) {
      bar.style.width = '100%';
      setTimeout(() => {
        bar.style.transition = 'none';
        bar.style.width = '0%';
        void bar.offsetWidth;
        bar.style.transition = '';
        bar.style.width = `${r.xpTo}%`;
        wrap.querySelector('.gr-train')!.classList.add('lvl');
      }, 520);
    } else bar.style.width = `${r.xpTo}%`;
  }, 350);
  (wrap.querySelector('.gr-done') as HTMLElement).onclick = () => {
    sfx.click();
    onDone();
  };
  (wrap.querySelector('.gr-again') as HTMLElement).onclick = () => {
    sfx.click();
    onAgain();
  };
  return wrap;
}
