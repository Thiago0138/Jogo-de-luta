import { S, commit, markPatchSeen, resetSave } from '../../core/state';
import { PATCH_NOTES, CURRENT_VERSION } from '../../data/patchnotes';
import { RARITIES, RARITY_ORDER } from '../../data/rarity';
import { setAmbient, setSound, setVolume, sfx } from '../../audio/sfx';
import { music } from '../../audio/music';
import { pickEnglishVoice } from '../../audio/announcer';
import { render } from '../app';
import { el, esc, modal } from '../dom';
import { ico } from '../icons';

export function openSettings(onClose?: () => void): void {
  const b = el('div', 'settings');
  const s = S.settings;
  b.innerHTML = `
    <label class="set-row vol-row"><span>${ico('speaker')} Volume</span><input type="range" class="vol" min="0" max="100" step="1" value="${Math.round(s.volume * 100)}"/><b class="vol-n">${Math.round(s.volume * 100)}%</b></label>
    <label class="set-row vol-row"><span>${ico('music')} Música</span><input type="range" class="bgmv" min="0" max="100" step="1" value="${Math.round(s.bgmVol * 100)}"/><b class="bgm-n">${Math.round(s.bgmVol * 100)}%</b></label>
    <label class="set-row"><span>${ico('music')} Música ligada</span><input type="checkbox" data-k="bgm" ${s.bgm ? 'checked' : ''}/></label>
    <label class="set-row"><span>${ico('mic')} Narrador (voz e legendas)</span><input type="checkbox" data-k="announcer" ${s.announcer ? 'checked' : ''}/></label>
    <label class="set-row vol-row"><span>${ico('mic')} Volume do narrador</span><input type="range" class="annv" min="0" max="100" step="1" value="${Math.round(s.announcerVol * 100)}"/><b class="ann-n">${Math.round(s.announcerVol * 100)}%</b></label>
    <label class="set-row"><span>${ico('unlock')} Tudo desbloqueado (modo teste)</span><input type="checkbox" data-k="unlockAll" ${s.unlockAll ? 'checked' : ''}/></label>
    <label class="set-row"><span>${ico('speaker')} Efeitos sonoros</span><input type="checkbox" data-k="sound" ${s.sound ? 'checked' : ''}/></label>
    <label class="set-row"><span>${ico('crowd')} Som do público</span><input type="checkbox" data-k="music" ${s.music ? 'checked' : ''}/></label>
    <label class="set-row"><span>${ico('sparkle')} Qualidade gráfica alta</span><input type="checkbox" data-k="quality" ${s.quality === 'alta' ? 'checked' : ''}/></label>
    <label class="set-row"><span>${ico('fast')} Lutas a 2x por defeito</span><input type="checkbox" data-k="speed" ${s.speed === 2 ? 'checked' : ''}/></label>
    <div class="set-btns">
      <button class="btn btn-ghost notes">${ico('news')} Novidades</button>
      <button class="btn btn-ghost rar">${ico('rarity')} Raridades</button>
      <button class="btn btn-ghost install" hidden>${ico('install')} Instalar app</button>
      <button class="btn btn-red reset">Apagar progresso</button>
    </div>
    <p class="muted small center">Reis do Ringue v${CURRENT_VERSION}</p>`;
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
  b.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((inp) => {
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
  (b.querySelector('.notes') as HTMLElement).onclick = () => openPatchNotes();
  (b.querySelector('.rar') as HTMLElement).onclick = () => openRarities();
  const ins = b.querySelector('.install') as HTMLButtonElement;
  const prompt = (window as unknown as { __installPrompt?: { prompt: () => void } }).__installPrompt;
  if (prompt) {
    ins.hidden = false;
    ins.onclick = () => prompt.prompt();
  }
  (b.querySelector('.reset') as HTMLElement).onclick = () => {
    modal('Apagar progresso?', '<p>Vais perder o teu lutador, itens, moedas e gemas. Isto não pode ser desfeito.</p>', [
      { label: 'Cancelar' },
      { label: 'Apagar tudo', cls: 'btn-red', onClick: () => resetSave() },
    ]);
  };
  modal('Definições', b, undefined, '', onClose);
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
  modal(`${ico('news')} Novidades`, b, [{ label: 'Fixe!', cls: 'btn-gold', onClick: () => render() }]);
}

export function openRarities(): void {
  const b = el('div', 'rar-list');
  const desc: Record<string, string> = {
    comum: 'O ponto de partida. Fáceis de encontrar.',
    incomum: 'Um pouco de estilo extra.',
    raro: 'Começam a dar nas vistas.',
    epico: 'Efeitos especiais e visuais marcantes.',
    lendario: 'Animadas e muito difíceis de obter.',
    mitico: 'Raríssimas. Poucos lutadores as têm.',
    celestial: 'O topo absoluto. Só para os eleitos.',
  };
  for (const r of RARITY_ORDER) {
    const d = RARITIES[r];
    b.appendChild(el('div', `rar-row rar-${r}`, `<span class="rar rar-${r}">${d.name}</span><span>${desc[r]}</span>`));
  }
  modal(`${ico('rarity')} Raridades`, b);
}
