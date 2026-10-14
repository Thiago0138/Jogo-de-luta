import { S } from '../core/state';
import { playerSpec } from '../core/opponents';
import { FightScene } from '../fight/scene';
import type { FighterSpec } from '../fight/fighter';
import { el } from './dom';

/**
 * Pré-visualização animada de uma entrada no ringue (modal do item na coleção/loja).
 * Corre a própria cena de luta em modo "montra": só o jogador entra, sem HUD, narrador
 * nem música, e a entrada repete-se em ciclo. Liberta tudo sozinha quando o elemento
 * sai do documento (ex.: ao fechar o modal); `destroy()` também pode ser chamado à mão.
 */
export class EntrancePreview {
  readonly el: HTMLElement;
  private scene: FightScene | null = null;

  constructor(entranceId: string) {
    this.el = el('div', 'ent-preview');
    const me: FighterSpec = { ...playerSpec(), entrance: entranceId };
    // a equipa adversária é obrigatória para o motor, mas fica escondida durante a montra
    const ghost: FighterSpec = { ...me, isPlayer: false };
    // a cena mede o contentor ao arrancar: espera que o modal esteja no documento
    requestAnimationFrame(() => {
      if (!this.el.isConnected) return;
      this.scene = new FightScene(this.el, { mode: 'solo', teams: [[me], [ghost]], showcase: true }, {
        speed: 1,
        quality: S.settings.quality,
        onEnd: () => {},
      });
    });
  }

  destroy(): void {
    this.scene?.destroy();
    this.scene = null;
  }
}
