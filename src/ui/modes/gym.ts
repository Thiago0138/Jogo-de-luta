import { el } from '../dom';

/** Ecrã "gym" (placeholder: será preenchido). */
export function renderGym(page: HTMLElement, _sub?: string): void {
  page.appendChild(el('div', 'page-head', '<h1>Gym</h1>'));
}

/** Número para o "badge" de notificação deste modo (0 = nada por fazer). */
export function gymBadge(): number {
  return 0;
}
