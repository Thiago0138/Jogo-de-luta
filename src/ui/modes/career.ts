import { el } from '../dom';

/** Ecrã "career" (placeholder: será preenchido). */
export function renderCareer(page: HTMLElement, _sub?: string): void {
  page.appendChild(el('div', 'page-head', '<h1>Career</h1>'));
}

/** Número para o "badge" de notificação deste modo (0 = nada por fazer). */
export function careerBadge(): number {
  return 0;
}
