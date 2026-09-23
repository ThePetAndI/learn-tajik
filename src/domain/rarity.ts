/**
 * Редкость — общая для снаряжения и питомцев: одни и те же четыре ступени,
 * одни и те же цвета, один и тот же сдвиг шансов от удачи.
 */

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export const RARITY_ORDER: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary'];

export const RARITY_TITLE: Record<Rarity, string> = {
  common: 'Обычный',
  rare: 'Редкий',
  epic: 'Эпический',
  legendary: 'Легендарный',
};

/** Следующая редкость; у легендарной следующей нет. */
export function nextRarity(r: Rarity): Rarity | null {
  return RARITY_ORDER[RARITY_ORDER.indexOf(r) + 1] ?? null;
}

/**
 * Удача сдвигает шансы от обычного к редкому. Обычное становится реже,
 * легендарное — чаще всех остальных: удача ощущается именно там.
 */
export function luckyWeights(weights: Record<Rarity, number>, luck: number): Record<Rarity, number> {
  const l = Math.max(0, luck);
  return {
    common: weights.common / (1 + l),
    rare: weights.rare * (1 + 0.5 * l),
    epic: weights.epic * (1 + l),
    legendary: weights.legendary * (1 + 1.5 * l),
  };
}

/** Шансы в процентах — ровно то, по чему идёт бросок. */
export function oddsOf(weights: Record<Rarity, number>): Record<Rarity, number> {
  const total = RARITY_ORDER.reduce((sum, r) => sum + weights[r], 0);
  const out = {} as Record<Rarity, number>;
  for (const r of RARITY_ORDER) out[r] = total > 0 ? (weights[r] / total) * 100 : 0;
  return out;
}

/** Выбор редкости по весам. Чистая функция — её проверяют тесты. */
export function pickRarity(weights: Record<Rarity, number>, roll: number): Rarity {
  const total = RARITY_ORDER.reduce((sum, r) => sum + weights[r], 0);
  let left = roll * total;
  for (const r of RARITY_ORDER) {
    left -= weights[r];
    if (left < 0) return r;
  }
  // на случай roll ровно 1: последняя редкость с ненулевым весом
  return [...RARITY_ORDER].reverse().find((r) => weights[r] > 0) ?? 'common';
}
