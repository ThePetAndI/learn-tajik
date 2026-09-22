/**
 * Сводные бонусы игрока и всё, что из них следует.
 *
 * Единственное место, где источники бонусов встречаются: питомец, дерево,
 * снаряжение. Потребители — уровень, лавка, жизни, повторение — спрашивают
 * только отсюда и не знают, откуда взялось число.
 */

import type { SaveState } from '../data/state';
import { petPerks } from './catalog';
import { setMaxLives } from './lives';
import { combinePerks, type Perks } from './perks';

export const BASE_MAX_LIVES = 5;

/** Все бонусы игрока, сведённые вместе и обрезанные потолками. */
export function perksOf(state: SaveState): Perks {
  return combinePerks([petPerks(state)]);
}

/** Множитель монет за ответы. */
export function coinMultiplier(state: SaveState): number {
  return 1 + perksOf(state).coins;
}

/** Множитель награды за пройденный уровень. */
export function levelCoinMultiplier(state: SaveState): number {
  return 1 + perksOf(state).levelCoins;
}

/** Максимум жизней с учётом всех бонусов. */
export function maxLivesFor(state: SaveState): number {
  return BASE_MAX_LIVES + perksOf(state).lives;
}

/** Цена подсказки со скидкой. */
export function hintCost(state: SaveState, base: number): number {
  return Math.max(1, Math.round(base * (1 - perksOf(state).hintDiscount)));
}

/** Цена в лавке со скидкой. Бесплатное бесплатным и остаётся. */
export function shopPrice(state: SaveState, base: number): number {
  if (base <= 0) return 0;
  return Math.max(1, Math.round(base * (1 - perksOf(state).shopDiscount)));
}

/** Применяет множитель к награде, округляя вниз — так проще объяснять числа. */
export function applyCoinBonus(amount: number, multiplier: number): number {
  return Math.floor(amount * multiplier);
}

/**
 * Пересчитывает то, что хранится в состоянии, но зависит от бонусов:
 * пока это только максимум жизней. Звать после всего, что меняет бонусы, —
 * покупки, смены питомца, открытия узла дерева, надевания снаряжения, — и при
 * старте. Пёс, купленный минуту назад, должен сторожить жизнь сразу, а не со
 * следующего запуска.
 */
export function applyPerks(state: SaveState, ts: number): void {
  setMaxLives(state, maxLivesFor(state), ts);
}
