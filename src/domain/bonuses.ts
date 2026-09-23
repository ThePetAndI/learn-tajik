/**
 * Сводные бонусы игрока и всё, что из них следует.
 *
 * Единственное место, где источники бонусов встречаются: питомец, дерево,
 * снаряжение. Потребители — уровень, лавка, жизни, повторение — спрашивают
 * только отсюда и не знают, откуда взялось число.
 */

import type { SaveState } from '../data/state';
import { petPerks } from './catalog';
import { COMBO_BONUS_MAX } from './economy';
import { gearPerks } from './gear-items';
import { LIFE_REGEN_MS, setMaxLives, syncLives } from './lives';
import { combinePerks, type Perks } from './perks';
import { treePerks } from './tree-nodes';

export const BASE_MAX_LIVES = 5;

/** Все бонусы игрока, сведённые вместе и обрезанные потолками. */
export function perksOf(state: SaveState): Perks {
  return combinePerks([petPerks(state), ...treePerks(state), ...gearPerks(state)]);
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

/** Сколько миллисекунд восстанавливается одна жизнь. */
export function regenMsFor(state: SaveState): number {
  return Math.round(LIFE_REGEN_MS / (1 + perksOf(state).regen));
}

/** Потолок бонуса за серию верных ответов. */
export function comboCapFor(state: SaveState): number {
  return COMBO_BONUS_MAX + perksOf(state).combo;
}

/** Сколько ошибок за уровень не стоят жизни. */
export function shieldFor(state: SaveState): number {
  return Math.floor(perksOf(state).shield);
}

/** Сколько раз в день можно крутить колесо. */
export function spinsPerDay(state: SaveState): number {
  return 1 + Math.floor(perksOf(state).spins);
}

/** Сколько наград лежит в сундуке дня. */
export function chestRewardsFor(state: SaveState): number {
  return 1 + Math.floor(perksOf(state).chest);
}

/** На сколько слов и заданий длиннее сессия повторения. */
export function reviewExtraFor(state: SaveState): number {
  return Math.floor(perksOf(state).review);
}

/**
 * Монеты за ответы с учётом всего: плоская прибавка за каждый верный ответ
 * и множитель. Плоская идёт до множителя — иначе +1 монета не росла бы
 * от бонуса кошки, и два источника вели бы себя по-разному.
 */
export function answerCoinsFor(state: SaveState, fromAnswers: number, correct: number): number {
  const flat = Math.floor(perksOf(state).flatCoins) * Math.max(0, correct);
  return applyCoinBonus(fromAnswers + flat, coinMultiplier(state));
}

/** Применяет множитель к награде, округляя вниз — так проще объяснять числа. */
export function applyCoinBonus(amount: number, multiplier: number): number {
  return Math.floor(amount * multiplier);
}

/**
 * Пересчитывает то, что хранится в состоянии, но зависит от бонусов:
 * максимум жизней и скорость их восстановления. Звать после всего, что меняет бонусы, —
 * покупки, смены питомца, открытия узла дерева, надевания снаряжения, — и при
 * старте. Пёс, купленный минуту назад, должен сторожить жизнь сразу, а не со
 * следующего запуска.
 */
export function applyPerks(state: SaveState, ts: number): void {
  setMaxLives(state, maxLivesFor(state), ts);
  setRegen(state, regenMsFor(state), ts);
}

/**
 * Меняет скорость восстановления, не теряя уже накопленного: сначала
 * засчитываем то, что восстановилось по старой скорости, и только потом
 * переключаемся. Иначе ускорение задним числом дарило бы жизни.
 */
function setRegen(state: SaveState, ms: number, ts: number): void {
  if ((state.lives.regenMs ?? LIFE_REGEN_MS) === ms) return;
  syncLives(state, ts);
  state.lives.regenMs = ms;
}
