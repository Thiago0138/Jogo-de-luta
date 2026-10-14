import { CHESTS, type ChestDef, type ChestId } from '../data/chests';
import { KIND_NAMES, item } from '../data/items';
import { RARITIES } from '../data/rarity';
import { sfx, unlockAudio } from '../audio/sfx';
import { applyDrops, rollChest, type ChestDrop } from '../core/state';
import { BACK_Y, drawBackdrop, drawFloor, drawRingBack, drawRingFront, ensureArena, newRopes } from '../fight/arena';
import { PK, Particles } from '../fight/fx';
import { glowSprite } from '../render/fighter';
import { el, esc, fmt, rarityTag } from './dom';
import { itemThumb } from './preview';
import { ico } from './icons';

type Phase = 'drop' | 'wait' | 'shake' | 'open' | 'reveal' | 'summary';

/** Abre um baú no centro do ringue com animação completa. */
export function openChest(id: ChestId, onDone: () => void): void {
  unlockAudio();
  const def = CHESTS[id];
  const drops = rollChest(id);
  applyDrops(id, drops);
  const best = drops.reduce((a, b) => (RARITIES[b.rarity].tier > RARITIES[a.rarity].tier ? b : a), drops[0]);
  const bestColor = best.rarity === 'celestial' ? '#7af7ff' : RARITIES[best.rarity].color;

  const root = el('div', 'chest-root');
  const canvas = el('canvas', 'chest-canvas');
  root.appendChild(canvas);
  const ui = el('div', 'chest-ui');
  root.appendChild(ui);
  document.body.appendChild(root);
  const ctx = canvas.getContext('2d', { alpha: false })!;
  ensureArena();
  const ropes = newRopes();
  const parts = new Particles();

  let W = 0;
  let H = 0;
  let dpr = 1;
  const resize = () => {
    W = root.clientWidth;
    H = root.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  };
  resize();
  window.addEventListener('resize', resize);

  let phase: Phase = 'drop';
  let pt = 0;
  let t = 0;
  let y = -900; // altura do baú acima do chão (unidades do mundo)
  let vy = 0;
  let lid = 0; // 0 fechado → 1 aberto
  let shake = 0;
  let idx = -1;
  let raf = 0;
  let last = performance.now();
  let rays = 0;
  sfx.whoosh();

  const label = el('div', 'chest-label', `<b>${esc(def.name)}</b><span>${esc(def.desc)}</span>`);
  ui.appendChild(label);
  const hint = el('div', 'chest-hint', 'Tap to open!');
  const skipBtn = el('button', 'btn btn-ghost chest-skip', `Show all ${ico('skip')}`);
  skipBtn.onclick = (e) => {
    e.stopPropagation();
    sfx.click();
    showSummary();
  };

  const setPhase = (p: Phase) => {
    phase = p;
    pt = 0;
  };

  const burst = (n: number, color: string, speed = 900) => {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const v = speed * (0.4 + Math.random() * 0.6);
      parts.spawn(i % 3 ? PK.Ember : PK.Star, 0, -90, Math.cos(a) * v, Math.sin(a) * v, 0.8 + Math.random() * 0.6, i % 3 ? 26 : 16, i % 2 ? color : '#ffffff', 900);
    }
  };

  const nextItem = () => {
    idx++;
    if (idx >= drops.length) {
      showSummary();
      return;
    }
    const d = drops[idx];
    const tier = RARITIES[d.rarity].tier;
    sfx.reveal(tier);
    const color = d.rarity === 'celestial' ? '#7af7ff' : RARITIES[d.rarity].color;
    burst(14 + tier * 10, color, 600 + tier * 120);
    rays = 0.4 + tier * 0.12;
    if (tier >= 4) {
      for (let i = 0; i < 80; i++) {
        const cs = ['#ff3d6e', '#ffd23d', '#3aa0ff', '#4cd964', '#b45cff', '#ffffff'];
        parts.spawn(PK.Confetti, (Math.random() - 0.5) * 900, -700 - Math.random() * 200, (Math.random() - 0.5) * 200, Math.random() * 100, 3, 6, cs[i % cs.length], 160);
      }
    }
    ui.querySelector('.reveal-card')?.remove();
    ui.appendChild(card(d, idx, drops.length));
  };

  const showSummary = () => {
    if (phase === 'summary') return;
    if (lid < 1) lid = 1;
    setPhase('summary');
    ui.innerHTML = '';
    const box = el('div', 'chest-summary');
    box.innerHTML = `<h2>${esc(def.name)}</h2>`;
    const grid = el('div', 'sum-grid');
    for (const d of drops) grid.appendChild(miniCard(d));
    box.appendChild(grid);
    const btn = el('button', 'btn btn-gold', 'Continue');
    btn.onclick = () => {
      sfx.click();
      close();
    };
    box.appendChild(btn);
    ui.appendChild(box);
  };

  const close = () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    root.classList.add('out');
    setTimeout(() => root.remove(), 250);
    onDone();
  };

  root.onclick = () => {
    if (phase === 'wait') {
      hint.remove();
      setPhase('shake');
      sfx.click();
    } else if (phase === 'reveal') {
      sfx.click();
      nextItem();
    }
  };

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    pt += dt;
    switch (phase) {
      case 'drop':
        vy += 2600 * dt;
        y += vy * dt;
        if (y >= 0) {
          y = 0;
          if (vy > 300) {
            sfx.thud();
            shake = 0.35;
            for (let i = 0; i < 18; i++) parts.spawn(PK.Dust, (Math.random() - 0.5) * 200, -4, (Math.random() - 0.5) * 400, -Math.random() * 120, 0.8, 16, '#d8d0e8', 0);
            vy = -vy * 0.25;
          } else {
            vy = 0;
            setPhase('wait');
            ui.appendChild(hint);
            ui.appendChild(skipBtn);
          }
        }
        break;
      case 'shake':
        shake = 0.2;
        if (Math.random() < 0.3) parts.spawn(PK.Ember, (Math.random() - 0.5) * 120, -60, 0, -200, 0.5, 20, def.glow, 0);
        if (pt > 0.9) {
          setPhase('open');
          sfx.open();
          sfx.cheer(1);
          burst(60, bestColor, 1100);
          shake = 0.4;
          rays = 1;
          label.remove();
        }
        break;
      case 'open':
        lid = Math.min(1, lid + dt * 4);
        if (pt > 0.7) {
          setPhase('reveal');
          nextItem();
        }
        break;
    }
    if (shake > 0) shake -= dt;
    rays = Math.max(phase === 'reveal' || phase === 'summary' ? 0.35 : 0, rays - dt * 0.4);
    parts.update(dt);
    render();
  };

  const render = () => {
    const portrait = H > W;
    const z = Math.min(W / 600, H / (portrait ? 640 : 560));
    const floorY = H * (portrait ? 0.62 : 0.7);
    const sx = shake > 0 ? (Math.random() - 0.5) * 14 : 0;
    const sy = shake > 0 ? (Math.random() - 0.5) * 14 : 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackdrop(ctx, W, H, 0, z, floorY + BACK_Y * z, t, 0.6, false);
    ctx.fillStyle = 'rgba(5,2,12,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (W / 2 + sx), dpr * (floorY + sy));
    drawFloor(ctx);
    drawRingBack(ctx, ropes);
    // holofote
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, -900, 0, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,240,200,0.28)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-40, -1200);
    ctx.lineTo(40, -1200);
    ctx.lineTo(230, 10);
    ctx.lineTo(-230, 10);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // raios de luz
    if (rays > 0.01) drawRays(ctx, t, rays, phase === 'reveal' && idx >= 0 ? rarityHex(drops[idx]) : bestColor);
    // cabo
    if (phase === 'drop') {
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -1400);
      ctx.lineTo(0, y - 150);
      ctx.stroke();
    }
    // sombra
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    const sh = Math.max(0.3, 1 - -y / 900);
    ctx.beginPath();
    ctx.ellipse(0, 4, 120 * sh, 22 * sh, 0, 0, Math.PI * 2);
    ctx.fill();
    const wob = phase === 'shake' ? Math.sin(t * 50) * 0.06 : phase === 'wait' ? Math.sin(t * 3) * 0.02 : 0;
    drawRingFront(ctx, ropes);
    ctx.save();
    ctx.scale(1.45, 1.45);
    drawChest(ctx, def, 0, y / 1.45, lid, t, wob, phase === 'wait' || phase === 'shake');
    ctx.restore();
    parts.draw(ctx);
  };

  raf = requestAnimationFrame(frame);
}

function rarityHex(d: ChestDrop): string {
  return d.rarity === 'celestial' ? '#7af7ff' : RARITIES[d.rarity].color;
}

function drawRays(ctx: CanvasRenderingContext2D, t: number, a: number, color: string): void {
  ctx.save();
  ctx.translate(0, -110);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, a) * 0.6;
  ctx.fillStyle = color;
  const n = 14;
  for (let i = 0; i < n; i++) {
    const ang = t * 0.4 + (i / n) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(ang - 0.06) * 1400, Math.sin(ang - 0.06) * 1400);
    ctx.lineTo(Math.cos(ang + 0.06) * 1400, Math.sin(ang + 0.06) * 1400);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = Math.min(1, a);
  ctx.drawImage(glowSprite(color.length === 7 ? color : '#ffffff'), -260, -260, 520, 520);
  ctx.restore();
}

function drawChest(ctx: CanvasRenderingContext2D, d: ChestDef, x: number, y: number, lid: number, t: number, wob: number, glow: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(wob);
  const w = 200;
  const h = 120;
  if (glow) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.45 + Math.sin(t * 4) * 0.2;
    ctx.drawImage(glowSprite(d.glow), -260, -300, 520, 400);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  const OUT = '#140a1c';
  // corpo
  ctx.lineWidth = 6;
  ctx.strokeStyle = OUT;
  ctx.fillStyle = d.body;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h, w, h, 10);
  ctx.fill();
  ctx.stroke();
  // tábuas
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 3;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 8, -h + (i * h) / 3);
    ctx.lineTo(w / 2 - 8, -h + (i * h) / 3);
    ctx.stroke();
  }
  // ferragens
  ctx.fillStyle = d.trim;
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 4;
  for (const sx of [-w / 2 + 22, w / 2 - 22]) {
    ctx.beginPath();
    ctx.rect(sx - 12, -h, 24, h);
    ctx.fill();
    ctx.stroke();
  }
  // interior brilhante quando aberto
  if (lid > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = lid;
    ctx.drawImage(glowSprite(d.glow), -200, -h - 160, 400, 260);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  // tampa (roda para trás à volta da dobradiça)
  ctx.save();
  ctx.translate(0, -h);
  const open = lid * 1.9;
  const sy = Math.cos(open);
  ctx.scale(1, sy === 0 ? 0.001 : sy);
  ctx.fillStyle = d.body;
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.bezierCurveTo(-w / 2, -80, w / 2, -80, w / 2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = d.trim;
  ctx.lineWidth = 4;
  for (const sx of [-w / 2 + 22, w / 2 - 22]) {
    ctx.beginPath();
    ctx.moveTo(sx - 12, 0);
    ctx.lineTo(sx - 12, -54);
    ctx.lineTo(sx + 12, -56);
    ctx.lineTo(sx + 12, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
  // fechadura
  if (lid < 0.5) {
    ctx.fillStyle = d.trim;
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-20, -h - 16, 40, 44, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = d.glow;
    ctx.beginPath();
    ctx.arc(0, -h + 4, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.7 + Math.sin(t * 6) * 0.3;
    ctx.drawImage(glowSprite(d.glow), -30, -h - 26, 60, 60);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

function dropName(d: ChestDrop): string {
  if (d.kind === 'coins') return `${fmt(d.amount)} Coins`;
  if (d.kind === 'gems') return `${fmt(d.amount)} Gems`;
  const it = item(d.id!);
  return d.amount > 1 ? `${it.name} ×${d.amount}` : it.name;
}

function dropIcon(d: ChestDrop): HTMLElement {
  if (d.kind === 'coins' || d.kind === 'gems') {
    const s = el('div', 'thumb-icon', ico(d.kind === 'coins' ? 'coin' : 'gem'));
    return s;
  }
  return itemThumb(d.id!);
}

function card(d: ChestDrop, i: number, n: number): HTMLElement {
  const c = el('div', `reveal-card r-${d.rarity}`);
  const kind = d.kind === 'item' ? KIND_NAMES[item(d.id!).kind] : d.kind === 'coins' ? 'Coins' : 'Gems';
  c.innerHTML = `<div class="rc-count">${i + 1}/${n}</div>${d.isNew ? '<div class="rc-new">NEW!</div>' : ''}
    <div class="rc-art"></div>
    <div class="rc-kind">${kind}</div>
    <div class="rc-name">${esc(dropName(d))}</div>
    ${rarityTag(d.rarity)}
    ${d.kind === 'item' ? `<p class="rc-desc">${esc(item(d.id!).desc)}</p>` : ''}
    <div class="rc-tap">tap to continue</div>`;
  c.querySelector('.rc-art')!.appendChild(dropIcon(d));
  return c;
}

function miniCard(d: ChestDrop): HTMLElement {
  const c = el('div', `mini-card r-${d.rarity}`);
  c.appendChild(dropIcon(d));
  const n = el('div', 'mc-name', esc(dropName(d)));
  c.appendChild(n);
  if (d.isNew) c.appendChild(el('div', 'rc-new sm', 'NEW'));
  return c;
}
