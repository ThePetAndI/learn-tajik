/**
 * Кормление питомца. Что за угощения — в foods.ts.
 *
 * Угощение действует, пока питомец его ест: столько пройденных уроков,
 * сколько написано на нём, плюс «Дастархон» из дерева. Урок, в котором
 * жизни кончились, не считается — угощение не сгорает на неудаче.
 */

import type { SaveState } from '../data/state';
import { applyPerks, perksOf, shopPrice } from './bonuses';
import { currentMeal, getFood, type Food } from './foods';
import { INTEGER_PERKS, type PerkKey, type Perks } from './perks';

/**
 * Что угощение даст этому игроку — с «Дастархоном» из дерева. Считается
 * так же, как в bonuses.perksOf, чтобы подпись не расходилась с делом.
 */
export function foodEffect(state: SaveState, food: Food): Partial<Perks> {
  const factor = 1 + perksOf(state).foodPower;
  const out: Partial<Perks> = {};
  for (const [key, value] of Object.entries(food.perks) as [PerkKey, number][]) {
    out[key] = INTEGER_PERKS.has(key) ? Math.round(value * factor) : value * factor;
  }
  return out;
}

/** Цена угощения этому игроку — со скидкой лавки. */
export function foodPrice(state: SaveState, food: Food): number {
  return shopPrice(state, food.price);
}

/** На сколько уроков хватит угощения: своё и сверху из дерева. */
export function mealLength(state: SaveState, food: Food): number {
  return food.lessons + perksOf(state).foodLength;
}

export type FeedCheck = 'ok' | 'no-such-food' | 'eating' | 'not-enough-coins';

/** price — своя цена вместо обычной: так угощение продаёт товар дня. */
export function canFeed(state: SaveState, id: string, price?: number): FeedCheck {
  const food = getFood(id);
  if (!food) return 'no-such-food';
  // одно угощение за раз: иначе они складывались бы в бесконечный бонус
  if (currentMeal(state)) return 'eating';
  if (state.wallet.coins < (price ?? foodPrice(state, food))) return 'not-enough-coins';
  return 'ok';
}

/** Покупает угощение и сразу кормит питомца. Бонус действует с этой секунды. */
export function feed(state: SaveState, id: string, ts: number, price?: number): FeedCheck {
  const check = canFeed(state, id, price);
  if (check !== 'ok') return check;
  const food = getFood(id) as Food;
  state.wallet.coins -= price ?? foodPrice(state, food);
  state.inventory.meal = { id, left: mealLength(state, food) };
  state.stats.meals += 1;
  applyPerks(state, ts);
  return 'ok';
}

/**
 * Урок пройден — питомец доедает ещё кусочек. Возвращает угощение, если оно
 * на этом кончилось: экран итогов скажет об этом, а не оставит гадать.
 */
export function consumeMeal(state: SaveState, ts: number): Food | null {
  const meal = state.inventory.meal;
  if (!meal) return null;
  if (meal.left > 1) {
    state.inventory.meal = { id: meal.id, left: meal.left - 1 };
    return null;
  }
  state.inventory.meal = null;
  applyPerks(state, ts);
  return getFood(meal.id) ?? null;
}
