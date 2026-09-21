/** Звёзды за уровень: 3 — без ошибок, 2 — одна-две, 1 — просто дошёл до конца. */

export const MAX_STARS = 3;

export function starsFor(mistakes: number): number {
  if (mistakes <= 0) return 3;
  if (mistakes <= 2) return 2;
  return 1;
}

/** Доля верных ответов, 0..1. */
export function accuracy(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, correct / total));
}

/** Подпись под результатом уровня. */
export function starsTitle(stars: number): string {
  if (stars >= 3) return 'Идеально!';
  if (stars === 2) return 'Отлично!';
  if (stars === 1) return 'Уровень пройден';
  return 'Попробуй ещё раз';
}
