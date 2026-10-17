import { el } from '../dom';

/** Ecrã "pass" (placeholder: será preenchido). */
export function renderPass(page: HTMLElement, _sub?: string): void {
  page.appendChild(el('div', 'page-head', '<h1>Pass</h1>'));
}

/** Número para o "badge" de notificação deste modo (0 = nada por fazer). */
export function passBadge(): number {
  return 0;
}
