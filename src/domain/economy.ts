/**
 * Монеты. Базовая часть: награда за верный ответ, бонус за серию,
 * награда за уровень. Множители питомцев и покупки добавятся с магазином.
 */

/** Монет за один верный ответ. */
export const COINS_PER_CORRECT = 2;
/** Каждые сколько верных подряд даётся бонус. */
export const COMBO_STEP = 3;
/** Насколько растёт бонус с каждой ступенью серии. */
export const COMBO_BONUS_STEP = 1;
/** Потолок бонуса за серию, чтобы одна длинная серия не ломала экономику. */
export const COMBO_BONUS_MAX = 5;
/** Награда за уровень по числу звёзд: 0, 1, 2, 3. */
export const LEVEL_BONUS = [0, 10, 16, 25] as const;
/** Первое прохождение уровня стоит вдвое дороже повторов. */
export const FIRST_CLEAR_MULTIPLIER = 2;

/**
 * Монеты за верный ответ с учётом уже набранной серии.
 * combo — сколько верных подряд было ДО этого ответа.
 */
export function coinsForAnswer(combo: number): number {
  const streak = Math.max(0, combo) + 1;
  const steps = Math.floor(streak / COMBO_STEP);
  const bonus = Math.min(COMBO_BONUS_MAX, steps * COMBO_BONUS_STEP);
  return COINS_PER_CORRECT + bonus;
}

/** Награда за завершённый уровень. */
export function coinsForLevel(stars: number, firstClear: boolean): number {
  const index = Math.max(0, Math.min(LEVEL_BONUS.length - 1, Math.round(stars)));
  const base = LEVEL_BONUS[index] ?? 0;
  return firstClear ? base * FIRST_CLEAR_MULTIPLIER : base;
}

export interface RewardBreakdown {
  /** Сумма за верные ответы, включая бонусы за серии. */
  answers: number;
  /** Награда за уровень. */
  level: number;
  total: number;
}

/** Итог по сессии — то, что показывает экран результатов. */
export function sessionRewards(
  answerCoins: number,
  stars: number,
  firstClear: boolean,
): RewardBreakdown {
  const level = coinsForLevel(stars, firstClear);
  return { answers: answerCoins, level, total: answerCoins + level };
}
