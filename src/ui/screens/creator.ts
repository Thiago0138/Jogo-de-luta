import { S, commit, owns } from '../../core/state';
import { BEARD_STYLES, BROW_STYLES, EYE_COLORS, EYE_STYLES, MOUTH_STYLES, SKIN_TONES, type Appearance } from '../../data/appearance';
import { itemsOfKind } from '../../data/items';
import { RARITIES } from '../../data/rarity';
import { randomAppearance, randomName } from '../../core/opponents';
import { resolveLook } from '../../render/look';
import { coversHead } from '../../render/costume';
import { sfx, unlockAudio } from '../../audio/sfx';
import { el, esc, toast } from '../dom';
import { Preview, clearThumbs } from '../preview';
import { sourceText } from './itemModal';
import { render } from '../app';
import { ico } from '../icons';

const TABS = [
  { id: 'skin', name: 'Skin', icon: 'skin' },
  { id: 'hair', name: 'Hair', icon: 'hair' },
  { id: 'hairColor', name: 'Color', icon: 'palette' },
  { id: 'eyes', name: 'Eyes', icon: 'eye' },
  { id: 'brows', name: 'Brows', icon: 'brows' },
  { id: 'mouth', name: 'Mouth', icon: 'lips' },
  { id: 'beard', name: 'Beard', icon: 'beard' },
  { id: 'body', name: 'Height', icon: 'height' },
];

/** Criador de personagem (primeira vez ou edição). */
export function openCreator(first: boolean, onDone?: () => void): void {
  unlockAudio();
  const app: Appearance = { ...S.appearance };
  let name = S.name || randomName();
  const root = el('div', 'creator');
  root.innerHTML = `
    <div class="cr-head">
      ${first ? '<div class="cr-logo">KINGS OF <span>THE RING</span></div><p>Create your fighter</p>' : '<h2>Appearance</h2>'}
    </div>
    <div class="cr-stage"><button class="cr-dice" aria-label="Random">${ico('dice')}</button></div>
    <div class="cr-panel">
      <div class="cr-tabs"></div>
      <div class="cr-opts"></div>
      <div class="cr-name"><input maxlength="16" placeholder="Fighter name" value="${esc(name)}"/><button class="cr-rn" aria-label="Random name">${ico('shuffle')}</button></div>
      <div class="cr-actions">${first ? '' : '<button class="btn btn-ghost cancel">Cancel</button>'}<button class="btn btn-gold ok">${first ? 'Enter the ring!' : 'Save'}</button></div>
    </div>`;
  document.body.appendChild(root);

  // sem capacetes nem capuzes, para se ver bem a cara e o cabelo que se está a escolher
  const lo = () => ({ ...S.loadout, outfit: coversHead(S.loadout.outfit) ? 'o_classico' : S.loadout.outfit });
  const prev = new Preview(resolveLook(app, lo()), { zoom: 1.05, turn: true, key: 'creator' });
  const stage = root.querySelector('.cr-stage')!;
  stage.appendChild(prev.canvas);
  stage.appendChild(el('div', 'cr-rot', '↔ Drag to rotate 360°'));
  const refresh = () => {
    prev.look = resolveLook(app, lo());
  };

  const tabsEl = root.querySelector('.cr-tabs') as HTMLElement;
  const opts = root.querySelector('.cr-opts') as HTMLElement;
  let tab = 'skin';

  const chip = (label: string, on: boolean, fn: () => void, extra = '', style = '') => {
    const b = el('button', `chip ${on ? 'on' : ''} ${extra}`, label);
    if (style) b.setAttribute('style', style);
    b.onclick = () => {
      sfx.click();
      fn();
      showTab();
      refresh();
    };
    return b;
  };

  const showTab = () => {
    tabsEl.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
    opts.innerHTML = '';
    switch (tab) {
      case 'skin':
        SKIN_TONES.forEach((c, i) => opts.appendChild(chip('', app.skin === i, () => (app.skin = i), 'swatch', `--sw:${c}`)));
        break;
      case 'hair':
      case 'hairColor': {
        const k = tab as 'hair' | 'hairColor';
        for (const d of itemsOfKind(k)) {
          const have = owns(d.id);
          const on = app[k] === d.id;
          const label = k === 'hairColor' ? '' : esc(d.name);
          const style = k === 'hairColor' ? `--sw:${d.vis?.anim === 'rainbow' ? 'conic-gradient(red,orange,yellow,lime,cyan,blue,magenta,red)' : `linear-gradient(135deg,${d.vis?.c1},${d.vis?.c2})`}` : '';
          const b = chip(label, on, () => {
            if (!have) {
              toast(`${d.name} (${RARITIES[d.rarity].name}) — ${sourceText(d)}`, 'info');
              return;
            }
            app[k] = d.id;
          }, `${k === 'hairColor' ? 'swatch' : ''} ${have ? '' : 'lock'} r-${d.rarity}`, style);
          b.title = d.name;
          opts.appendChild(b);
        }
        break;
      }
      case 'eyes':
        EYE_STYLES.forEach((e) => opts.appendChild(chip(e.name, app.eyes === e.id, () => (app.eyes = e.id))));
        opts.appendChild(el('div', 'break'));
        EYE_COLORS.forEach((c, i) => opts.appendChild(chip('', app.eyeColor === i, () => (app.eyeColor = i), 'swatch sm', `--sw:${c}`)));
        break;
      case 'brows':
        BROW_STYLES.forEach((e) => opts.appendChild(chip(e.name, app.brows === e.id, () => (app.brows = e.id))));
        break;
      case 'mouth':
        MOUTH_STYLES.forEach((e) => opts.appendChild(chip(e.name, app.mouth === e.id, () => (app.mouth = e.id))));
        break;
      case 'beard':
        BEARD_STYLES.forEach((e) => opts.appendChild(chip(e.name, app.beard === e.id, () => (app.beard = e.id))));
        break;
      case 'body': {
        const w = el('div', 'height-ctl');
        w.innerHTML = `<span>Short</span><input type="range" min="0.94" max="1.06" step="0.01" value="${app.height}"/><span>Tall</span>`;
        const inp = w.querySelector('input') as HTMLInputElement;
        inp.oninput = () => {
          app.height = parseFloat(inp.value);
          refresh();
        };
        opts.appendChild(w);
        opts.appendChild(el('p', 'muted small', 'Height is purely cosmetic: it has no effect in fights.'));
        break;
      }
    }
  };

  for (const t of TABS) {
    const b = el('button', '', `<span>${ico(t.icon)}</span>${t.name}`);
    b.dataset.t = t.id;
    b.onclick = () => {
      sfx.click();
      tab = t.id;
      showTab();
    };
    tabsEl.appendChild(b);
  }
  showTab();

  const nameIn = root.querySelector('.cr-name input') as HTMLInputElement;
  (root.querySelector('.cr-rn') as HTMLElement).onclick = () => {
    sfx.click();
    nameIn.value = randomName();
  };
  (root.querySelector('.cr-dice') as HTMLElement).onclick = () => {
    sfx.click();
    const r = randomAppearance();
    // só escolhe cabelo/cor que o jogador tenha
    if (!owns(r.hair)) r.hair = app.hair;
    if (!owns(r.hairColor)) r.hairColor = app.hairColor;
    Object.assign(app, r);
    prev.play('guard');
    showTab();
    refresh();
  };
  const close = () => {
    root.classList.add('out');
    setTimeout(() => root.remove(), 250);
  };
  (root.querySelector('.cancel') as HTMLElement | null)?.addEventListener('click', () => {
    sfx.click();
    close();
  });
  (root.querySelector('.ok') as HTMLElement).onclick = () => {
    name = nameIn.value.trim().replace(/\s+/g, ' ');
    if (name.length < 2) {
      toast('Pick a name with at least 2 letters.', 'err');
      return;
    }
    sfx.levelUp();
    S.appearance = app;
    S.name = name;
    S.created = true;
    clearThumbs();
    commit();
    close();
    onDone?.();
    if (!first) render();
  };
}
