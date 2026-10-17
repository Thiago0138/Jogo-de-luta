import { el } from '../dom';

/** Ecrã "daily" (placeholder: será preenchido). */
export function renderDaily(page: HTMLElement, _sub?: string): void {
  page.appendChild(el('div', 'page-head', '<h1>Daily</h1>'));
}

/** Número para o "badge" de notificação deste modo (0 = nada por fazer). */
export function dailyBadge(): number {
  return 0;
}
