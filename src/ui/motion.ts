/** Тумблер «спокойных анимаций»: вешает класс на <html>, остальное делает CSS. */

export function applyReducedMotion(on: boolean): void {
  document.documentElement.classList.toggle('reduced-motion', on);
}

/** Уважать системную настройку, если пользователь её включил. */
export function systemPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
