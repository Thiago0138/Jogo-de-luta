import { S, bonusGemsOn, commit, markPatchSeen, resetSave, setBonusGems } from '../../core/state';
import { PATCH_NOTES, CURRENT_VERSION } from '../../data/patchnotes';
import { backToMain, currentProfile, playFresh, restartFresh } from '../../core/profiles';
import { RARITIES, RARITY_ORDER } from '../../data/rarity';
import { setAmbient, setSound, setVolume, sfx } from '../../audio/sfx';
import { music } from '../../audio/music';
import { pickEnglishVoice } from '../../audio/announcer';
import { render } from '../app';
import { openTutorialList } from '../tutorial';
import { el, esc, modal } from '../dom';
import { ico } from '../icons';

export function openSettings(onClose?: () => void): void {
  const b = el('div', 'settings');
  const s = S.settings;
  b.innerHTML = `
    <div class="set-profile ${currentProfile()}">
      <div class="sp-head">${ico('fighter')} <b>Profile</b><span class="sp-tag">${currentProfile() === 'fresh' ? 'NEW PLAYER' : 'MAIN SAVE'}</span></div>
      <p class="muted small">${
        currentProfile() === 'fresh'
          ? 'You are playing as a brand-new player. Your main save is safe and untouched — switch back any time.'
          : 'Try the game from zero, like a brand-new player. Your main save is kept safe and you can come back to it any time, exactly as it is.'
      }</p>
      <div class="sp-btns">${
        currentProfile() === 'fresh'
          ? `<button class="btn btn-gold sp-main">${ico('crown')} Back to my main save</button><button class="btn btn-ghost sp-restart">Restart new player</button><label class="set-row sp-gems"><span>${ico('gem')} 100K bonus gems</span><input type="checkbox" class="sp-gems-in" ${bonusGemsOn() ? 'checked' : ''}/></label>`
          : `<button class="btn btn-blue sp-fresh">${ico('sparkle')} Play as a new player</button>`
      }</div>
    </div>
    <label class="set-row vol-row"><span>${ico('speaker')} Volume</span><input type="range" class="vol" min="0" max="100" step="1" value="${Math.round(s.volume * 100)}"/><b class="vol-n">${Math.round(s.volume * 100)}%</b></label>
    <label class="set-row vol-row"><span>${ico('music')} Music</span><input type="range" class="bgmv" min="0" max="100" step="1" value="${Math.round(s.bgmVol * 100)}"/><b class="bgm-n">${Math.round(s.bgmVol * 100)}%</b></label>
    <label class="set-row"><span>${ico('music')} Music on</span><input type="checkbox" data-k="bgm" ${s.bgm ? 'checked' : ''}/></label>
    <label class="set-row"><span>${ico('mic')} Announcer (voice & subtitles)</span><input type="checkbox" data-k="announcer" ${s.announcer ? 'checked' : ''}/></label>
    <label class="set-row vol-row"><span>${ico('mic')} Voice volume</span><input type="range" class="annv" min="0" max="100" step="1" value="${Math.round(s.announcerVol * 100)}"/><b class="ann-n">${Math.round(s.announcerVol * 100)}%</b></label>
    <label class="set-row"><span>${ico('unlock')} Unlock everything (test mode)</span><input type="checkbox" data-k="unlockAll" ${s.unlockAll ? 'checked' : ''}/></label>
    <label class="set-row"><span>${ico('speaker')} Sound effects</span><input type="checkbox" data-k="sound" ${s.sound ? 'checked' : ''}/></label>
    <label class="set-row"><span>${ico('sparkle')} High graphics quality</span><input type="checkbox" data-k="quality" ${s.quality === 'alta' ? 'checked' : ''}/></label>
    <label class="set-row"><span>${ico('fast')} 2x fight speed by default</span><input type="checkbox" data-k="speed" ${s.speed === 2 ? 'checked' : ''}/></label>
    <div class="set-btns">
      <button class="btn btn-ghost notes">${ico('news')} What's New</button>
      <button class="btn btn-ghost rar">${ico('rarity')} Rarities</button>
      <button class="btn btn-ghost guides">${ico('info')} Guides</button>
      <button class="btn btn-ghost install" hidden>${ico('install')} Install app</button>
      <button class="btn btn-red reset">Delete progress</button>
    </div>
    <p class="muted small center">Kings of the Ring v${CURRENT_VERSION}</p>`;
  const vol = b.querySelector('.vol') as HTMLInputElement;
  const volN = b.querySelector('.vol-n') as HTMLElement;
  vol.oninput = () => {
    s.volume = Number(vol.value) / 100;
    volN.textContent = vol.value + '%';
    setVolume(s.volume);
  };
  const bgmv = b.querySelector('.bgmv') as HTMLInputElement;
  const bgmN = b.querySelector('.bgm-n') as HTMLElement;
  bgmv.oninput = () => {
    s.bgmVol = Number(bgmv.value) / 100;
    bgmN.textContent = bgmv.value + '%';
    music.setVolume(s.bgmVol);
  };
  bgmv.onchange = () => commit();
  const annv = b.querySelector('.annv') as HTMLInputElement;
  const annN = b.querySelector('.ann-n') as HTMLElement;
  annv.oninput = () => {
    s.announcerVol = Number(annv.value) / 100;
    annN.textContent = annv.value + '%';
  };
  annv.onchange = () => {
    commit();
    sayTest(s.announcerVol);
  };
  vol.onchange = () => {
    commit();
    sfx.click();
  };
  b.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-k]').forEach((inp) => {
    inp.onchange = () => {
      const k = inp.dataset.k!;
      if (k === 'sound') {
        s.sound = inp.checked;
        setSound(s.sound);
      } else if (k === 'bgm') {
        s.bgm = inp.checked;
        music.setEnabled(s.bgm);
      } else if (k === 'announcer') {
        s.announcer = inp.checked;
      } else if (k === 'unlockAll') {
        s.unlockAll = inp.checked;
        commit();
        render();
      } else if (k === 'music') {
        s.music = inp.checked;
        setAmbient(s.music);
      } else if (k === 'quality') s.quality = inp.checked ? 'alta' : 'baixa';
      else if (k === 'speed') s.speed = inp.checked ? 2 : 1;
      commit();
      sfx.click();
    };
  });
  const spFresh = b.querySelector('.sp-fresh') as HTMLElement | null;
  if (spFresh)
    spFresh.onclick = () =>
      modal(
        'Play as a new player?',
        '<p>You will start from zero: new fighter, no items, no coins, every mode from the beginning.</p><p><b>Your main save stays safe.</b> Come back to it any time in Settings → Profile, exactly as you left it.</p>',
        [{ label: 'Cancel' }, { label: 'Start fresh', cls: 'btn-blue', onClick: () => playFresh() }],
      );
  const spMain = b.querySelector('.sp-main') as HTMLElement | null;
  if (spMain)
    spMain.onclick = () =>
      modal(
        'Back to your main save?',
        '<p>Your new-player progress is kept too, so you can come back to it later.</p>',
        [{ label: 'Cancel' }, { label: 'Switch', cls: 'btn-gold', onClick: () => backToMain() }],
      );
  const spGems = b.querySelector('.sp-gems-in') as HTMLInputElement | null;
  if (spGems)
    spGems.onchange = (e) => {
      e.stopPropagation();
      setBonusGems(spGems.checked);
      sfx.coin();
    };
  const spRestart = b.querySelector('.sp-restart') as HTMLElement | null;
  if (spRestart)
    spRestart.onclick = () =>
      modal('Restart the new player?', '<p>The new-player profile goes back to zero. Your main save is not affected.</p>', [
        { label: 'Cancel' },
        { label: 'Restart', cls: 'btn-red', onClick: () => restartFresh() },
      ]);
  (b.querySelector('.notes') as HTMLElement).onclick = () => openPatchNotes();
  (b.querySelector('.rar') as HTMLElement).onclick = () => openRarities();
  (b.querySelector('.guides') as HTMLElement).onclick = () => openTutorialList();
  const ins = b.querySelector('.install') as HTMLButtonElement;
  const prompt = (window as unknown as { __installPrompt?: { prompt: () => void } }).__installPrompt;
  if (prompt) {
    ins.hidden = false;
    ins.onclick = () => prompt.prompt();
  }
  (b.querySelector('.reset') as HTMLElement).onclick = () => {
    modal('Delete progress?', `<p>You will lose your fighter, items, coins, gems and all progress in Career, Gym, Daily, Fight Pass and the Forge${currentProfile() === 'fresh' ? ' (only for this new-player profile — your main save is not touched)' : ''}. This cannot be undone.</p>`, [
      { label: 'Cancel' },
      { label: 'Delete everything', cls: 'btn-red', onClick: () => resetSave() },
    ]);
  };
  modal('Settings', b, undefined, '', onClose);
}

/** Frase curta para ouvir o volume do narrador. */
function sayTest(vol: number): void {
  if (!S.settings.announcer || vol <= 0 || typeof speechSynthesis === 'undefined') return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance("Let's get ready to rumble!");
    const v = pickEnglishVoice();
    if (v) u.voice = v;
    u.lang = v?.lang ?? 'en-US';
    u.volume = vol;
    u.rate = 1.1;
    speechSynthesis.speak(u);
  } catch {
    /* sem voz */
  }
}

export function openPatchNotes(): void {
  const b = el('div', 'notes');
  for (const n of PATCH_NOTES) {
    const sec = el('section', 'note');
    sec.innerHTML = `<div class="note-h"><b>v${esc(n.version)} — ${esc(n.title)}</b><span>${esc(n.date)}</span></div><ul>${n.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
    b.appendChild(sec);
  }
  markPatchSeen();
  modal(`${ico('news')} What's New`, b, [{ label: 'Awesome!', cls: 'btn-gold', onClick: () => render() }]);
}

export function openRarities(): void {
  const b = el('div', 'rar-list');
  const desc: Record<string, string> = {
    comum: 'The starting point. Easy to find.',
    incomum: 'A little extra style.',
    raro: 'Starting to turn heads.',
    epico: 'Special effects and striking visuals.',
    lendario: 'Animated and very hard to get.',
    mitico: 'Extremely rare. Few fighters own one.',
    celestial: 'The absolute pinnacle. For the chosen few.',
  };
  for (const r of RARITY_ORDER) {
    const d = RARITIES[r];
    b.appendChild(el('div', `rar-row rar-${r}`, `<span class="rar rar-${r}">${d.name}</span><span>${desc[r]}</span>`));
  }
  modal(`${ico('rarity')} Rarities`, b);
}
