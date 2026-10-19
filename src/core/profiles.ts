/**
 * Perfis de jogo: o save principal e um "jogador novo" (começa do zero).
 * A troca é feita por um pequeno script no index.html, antes de qualquer módulo ler o localStorage,
 * para nenhum estado em memória escrever por cima do outro perfil.
 */
export type Profile = 'main' | 'fresh';

export function currentProfile(): Profile {
  try {
    return localStorage.getItem('kotr-profile') === 'fresh' ? 'fresh' : 'main';
  } catch {
    return 'main';
  }
}

function request(action: 'main' | 'fresh' | 'reset-fresh'): void {
  try {
    localStorage.setItem('kotr-profile-pending', action);
  } catch {
    return;
  }
  // deixa gravar o que estiver pendente (commit usa microtarefas) e recarrega
  setTimeout(() => location.reload(), 60);
}

/** Muda para o perfil de jogador novo (o save principal fica guardado). */
export const playFresh = (): void => request('fresh');
/** Volta ao save principal, tal como estava. */
export const backToMain = (): void => request('main');
/** Recomeça o perfil de jogador novo do zero. */
export const restartFresh = (): void => request('reset-fresh');
