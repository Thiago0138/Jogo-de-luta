import { S, commit, markPatchSeen, resetSave } from '../../core/state';
import { PATCH_NOTES, CURRENT_VERSION } from '../../data/patchnotes';
import { RARITIES, RARITY_ORDER } from '../../data/rarity';
import { setAmbient, setSound, sfx } from '../../audio/sfx';
import { render } from '../app';
import { el, esc, modal } from '../dom';

export function openSettings(): void {
  const b = el('div', 'settings');
  const s = S.settings;
  b.innerHTML = `
    <label class="set-row"><span>🔊 Efeitos sonoros</span><input type="checkbox" data-k="sound" ${s.sound ? 'checked' : ''}/></label>
    <label class="set-row"><span>👥 Som do público</span><input type="checkbox" data-k="music" ${s.music ? 'checked' : ''}/></label>
    <label class="set-row"><span>✨ Qualidade gráfica alta</span><input type="checkbox" data-k="quality" ${s.quality === 'alta' ? 'checked' : ''}/></label>
    <label class="set-row"><span>⏩ Lutas a 2x por defeito</span><input type="checkbox" data-k="speed" ${s.speed === 2 ? 'checked' : ''}/></label>
    <div class="set-btns">
      <button class="btn btn-ghost notes">📰 Novidades</button>
      <button class="btn btn-ghost rar">💠 Raridades</button>
      <button class="btn btn-ghost install" hidden>📲 Instalar app</button>
      <button class="btn btn-red reset">Apagar progresso</button>
    </div>
    <p class="muted small center">Reis do Ringue v${CURRENT_VERSION}</p>`;
  b.querySelectorAll('input').forEach((inp) => {
    inp.onchange = () => {
      const k = inp.dataset.k!;
      if (k === 'sound') {
        s.sound = inp.checked;
        setSound(s.sound);
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
  modal('Definições', b);
}

export function openPatchNotes(): void {
  const b = el('div', 'notes');
  for (const n of PATCH_NOTES) {
    const sec = el('section', 'note');
    sec.innerHTML = `<div class="note-h"><b>v${esc(n.version)} — ${esc(n.title)}</b><span>${esc(n.date)}</span></div><ul>${n.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
    b.appendChild(sec);
  }
  markPatchSeen();
  modal('📰 Novidades', b, [{ label: 'Fixe!', cls: 'btn-gold', onClick: () => render() }]);
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
  modal('💠 Raridades', b);
}
