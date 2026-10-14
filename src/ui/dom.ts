import { RARITIES, type Rarity } from '../data/rarity';
import { sfx } from '../audio/sfx';
import { ico } from './icons';

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function fmt(n: number): string {
  return Math.floor(n).toLocaleString('pt-PT');
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

export function rarityTag(r: Rarity): string {
  return `<span class="rar rar-${r}">${RARITIES[r].name}</span>`;
}

let toastBox: HTMLElement | null = null;
export function toast(msg: string, kind: 'ok' | 'err' | 'info' = 'info'): void {
  if (!toastBox) {
    toastBox = el('div', 'toasts');
    document.body.appendChild(toastBox);
  }
  const t = el('div', `toast ${kind}`, esc(msg));
  toastBox.appendChild(t);
  setTimeout(() => t.classList.add('out'), 2200);
  setTimeout(() => t.remove(), 2600);
}

export interface ModalAction {
  label: string;
  cls?: string;
  onClick?: () => void | boolean;
}

/** Abre um modal. Devolve uma função para o fechar. */
export function modal(
  title: string, body: HTMLElement | string, actions: ModalAction[] = [{ label: 'Fechar' }], cls = '', onClose?: () => void,
): () => void {
  const back = el('div', 'modal-back');
  const box = el('div', `modal ${cls}`);
  box.innerHTML = `<div class="modal-head"><h3>${title}</h3><button class="x" aria-label="Fechar">${ico('close')}</button></div>`;
  const content = el('div', 'modal-body');
  if (typeof body === 'string') content.innerHTML = body;
  else content.appendChild(body);
  box.appendChild(content);
  const foot = el('div', 'modal-foot');
  let closed = false;
  const close = () => {
    if (!closed) {
      closed = true;
      onClose?.();
    }
    back.classList.add('out');
    setTimeout(() => back.remove(), 180);
  };
  for (const a of actions) {
    const b = el('button', `btn ${a.cls ?? 'btn-ghost'}`, a.label);
    b.onclick = () => {
      sfx.click();
      if (a.onClick?.() === false) return;
      close();
    };
    foot.appendChild(b);
  }
  if (actions.length) box.appendChild(foot);
  back.appendChild(box);
  back.onclick = (e) => {
    if (e.target === back) close();
  };
  (box.querySelector('.x') as HTMLElement).onclick = () => {
    sfx.click();
    close();
  };
  document.body.appendChild(back);
  return close;
}

/** Anima um número de `from` para `to` num elemento. */
export function countUp(e: HTMLElement, from: number, to: number, ms = 800): void {
  const t0 = performance.now();
  const step = (now: number) => {
    const u = Math.min(1, (now - t0) / ms);
    const v = from + (to - from) * (1 - Math.pow(1 - u, 3));
    e.textContent = fmt(v);
    if (u < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function timeLeft(ms: number): string {
  if (ms <= 0) return 'pronto';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}
