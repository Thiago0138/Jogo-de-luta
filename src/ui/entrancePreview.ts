import { S } from '../core/state';
import { makeOpponent, playerSpec } from '../core/opponents';
import { ITEMS, ITEM_LIST } from '../data/items';
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

/**
 * Demonstração ao vivo de um golpe, estilo de golpe, super ou passiva: o teu lutador faz o item
 * num adversário, em ciclo, dentro da própria cena de luta (sem HUD, narrador nem K.O.).
 */
export class ItemDemo {
  readonly el: HTMLElement;
  private scene: FightScene | null = null;

  constructor(id: string) {
    this.el = el('div', 'ent-preview');
    const d = ITEMS[id];
    const base = playerSpec();
    const me: FighterSpec = { ...base, entrance: undefined };
    if (d.kind === 'move') me.moves = [id];
    else if (d.kind === 'moveStyle') {
      const mv = ITEM_LIST.find((m) => m.kind === 'move' && m.vis?.type === d.vis?.type);
      me.moves = mv ? [mv.id] : [];
      me.styles = [id];
    } else if (d.kind === 'super') me.supers = [id];
    else if (d.kind === 'passive') me.passives = [id];
    const opp: FighterSpec = { ...makeOpponent({ seed: 7, levelDelta: 0 }), hpMul: 1 };
    requestAnimationFrame(() => {
      if (!this.el.isConnected) return;
      this.scene = new FightScene(this.el, { mode: 'solo', teams: [[me], [opp]], showcase: true, demo: id, entrances: false }, {
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
