import '@fontsource/luckiest-guy/400.css';
import './styles.css';
import { S } from './core/state';
import { setAmbient, setSound } from './audio/sfx';
import { mountApp } from './ui/app';
import { openCreator } from './ui/screens/creator';
import { modal } from './ui/dom';

async function boot(): Promise<void> {
  setSound(S.settings.sound);
  setAmbient(S.settings.music);
  // A fonte é usada no canvas: espera por ela (com limite) para o primeiro desenho sair certo.
  try {
    await Promise.race([document.fonts.load('40px "Luckiest Guy"'), new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    /* continua com a fonte de recurso */
  }
  const root = document.getElementById('app')!;
  document.getElementById('splash')?.remove();
  if (!S.created) {
    openCreator(true, () => {
      mountApp(root);
      modal(
        'Bem-vindo ao ringue!',
        `<p>As lutas são <b>automáticas</b>: tu preparas o lutador, o público vibra e tu assistes ao espetáculo.</p>
         <ul class="tips"><li>🥊 Ganha lutas para subir de liga e ganhar baús.</li><li>📊 Usa os pontos de nível nos atributos.</li><li>🎁 Tens já dois baús à tua espera no Ringue!</li></ul>`,
        [{ label: 'Bora lutar!', cls: 'btn-gold' }],
      );
    });
  } else {
    mountApp(root);
  }
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  (window as unknown as { __installPrompt: Event }).__installPrompt = e;
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

void boot();
