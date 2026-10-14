/**
 * O jogo é pensado para a horizontal. Em telemóveis na vertical mostra um aviso para rodar o
 * ecrã (o CSS decide quando aparece); "Continuar na vertical" esconde-o até fechar o separador.
 * Quando o jogo está instalado (PWA/ecrã inteiro) tenta também bloquear a orientação.
 */

const KEY = 'rr-portrait-ok';
const O = 'stroke="#1a1220" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"';

const ART = `<svg class="rh-art" viewBox="0 0 200 200" aria-hidden="true">
  <defs>
    <linearGradient id="rhBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a4560"/><stop offset="1" stop-color="#22202e"/></linearGradient>
    <linearGradient id="rhScreen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7a3cff"/><stop offset=".55" stop-color="#3b1468"/><stop offset="1" stop-color="#d6202f"/></linearGradient>
    <linearGradient id="rhArrow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3a8"/><stop offset=".45" stop-color="#ffcc2e"/><stop offset="1" stop-color="#d98a00"/></linearGradient>
  </defs>
  <g class="rh-arrow">
    <path d="M150 52a68 68 0 0 1 14 74" fill="none" stroke="#1a1220" stroke-width="16" stroke-linecap="round"/>
    <path d="M150 52a68 68 0 0 1 14 74" fill="none" stroke="url(#rhArrow)" stroke-width="8" stroke-linecap="round"/>
    <path d="M150 140l26-22-30-6z" fill="url(#rhArrow)" ${O}/>
  </g>
  <g class="rh-phone">
    <rect x="70" y="30" width="60" height="140" rx="14" fill="url(#rhBody)" ${O}/>
    <rect x="78" y="44" width="44" height="106" rx="5" fill="url(#rhScreen)" stroke="#1a1220" stroke-width="3"/>
    <path d="M86 128l10-22h8l10 22z" fill="#ffffff" opacity=".9" stroke="#1a1220" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M84 132h32" stroke="#ff4a5a" stroke-width="4" stroke-linecap="round"/>
    <circle cx="100" cy="86" r="10" fill="#ffd23d" stroke="#1a1220" stroke-width="3"/>
    <path d="M94 160h12" stroke="#a99fc4" stroke-width="4" stroke-linecap="round"/>
    <path d="M78 54c2-4 5-6 9-6" fill="none" stroke="#fff" stroke-width="3" opacity=".5" stroke-linecap="round"/>
  </g>
</svg>`;

function storageOk(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function installRotateHint(): void {
  if (storageOk()) document.documentElement.classList.add('portrait-ok');
  const box = document.createElement('div');
  box.className = 'rotate-hint';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', 'Roda o telemóvel');
  box.innerHTML = `${ART}
    <h2>Roda o telemóvel <span>para jogar na horizontal</span></h2>
    <p>O ringue fica muito maior e vês melhor as lutas.</p>
    <button class="btn btn-ghost sm rh-cont">Continuar na vertical</button>`;
  (box.querySelector('.rh-cont') as HTMLElement).onclick = () => {
    try {
      sessionStorage.setItem(KEY, '1');
    } catch {
      /* sem armazenamento: esconde só agora */
    }
    document.documentElement.classList.add('portrait-ok');
  };
  document.body.appendChild(box);
  tryLockLandscape();
  // alguns browsers só deixam bloquear depois de um toque
  window.addEventListener('pointerdown', tryLockLandscape, { once: true });
}

/** Só funciona com o jogo instalado ou em ecrã inteiro; nos outros casos falha em silêncio. */
export function tryLockLandscape(): void {
  const installed = window.matchMedia?.('(display-mode: standalone), (display-mode: fullscreen)').matches || !!document.fullscreenElement;
  if (!installed) return;
  const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
  try {
    void o?.lock?.('landscape')?.catch(() => {});
  } catch {
    /* não suportado */
  }
}
