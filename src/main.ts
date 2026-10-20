import { keepAwake } from './core/wakeLock';
import '@fontsource/luckiest-guy/400.css';
import './styles.css';
import { S } from './core/state';
import { installAudioUnlock, setAmbient, setSound, setVolume } from './audio/sfx';
import { music } from './audio/music';
import { mountApp } from './ui/app';
import { openCreator } from './ui/screens/creator';
import { modal } from './ui/dom';
import { ico } from './ui/icons';
import { installRotateHint } from './ui/rotateHint';
import { openTutorial } from './ui/tutorial';

async function boot(): Promise<void> {
  // o áudio nunca pode impedir o jogo de abrir
  try {
    installAudioUnlock();
    setVolume(S.settings.volume);
    setSound(S.settings.sound);
    music.setVolume(S.settings.bgmVol);
    music.setEnabled(S.settings.bgm);
    music.play('menu');
    setAmbient(S.settings.music);
  } catch (e) {
    console.error(e);
  }
  // A fonte é usada no canvas: espera por ela (com limite) para o primeiro desenho sair certo.
  try {
    await Promise.race([document.fonts.load('40px "Luckiest Guy"'), new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    /* continua com a fonte de recurso */
  }
  const root = document.getElementById('app')!;
  document.getElementById('splash')?.remove();
  installRotateHint();
  if (!S.created) {
    openCreator(true, () => {
      mountApp(root);
      modal(
        'Welcome to the ring!',
        `<p>Fights are <b>automatic</b>: you build your fighter, the crowd goes wild and you enjoy the show.</p>
         <ul class="tips"><li>${ico('glove')} Win fights to climb the leagues and earn chests.</li><li>${ico('chart')} Spend your level-up points on stats.</li><li>${ico('chest')} Two chests are already waiting for you in the Ring!</li></ul>`,
        [{ label: 'Show me around', cls: 'btn-gold', onClick: () => void setTimeout(() => openTutorial('home'), 220) }, { label: 'Let\'s fight!', cls: 'btn-ghost' }],
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
  // havendo uma versão nova, o service worker novo assume e a página recarrega sozinha uma vez
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        void reg.update().catch(() => {});
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) void reg.update().catch(() => {});
        });
      })
      .catch(() => {});
  });
}

keepAwake();
void boot();
