/**
 * Угощения для питомца — дастархон.
 *
 * Каждое угощение — слово из урока «Еда»: нон, чой, шир, шӯрбо, ҳалво,
 * тарбуз, ош. Купили, покормили — и несколько следующих уроков питомец
 * помогает сильнее обычного. Угощение одно за раз: пока питомец не доел,
 * второе не дают, иначе угощения складывались бы в бесконечный бонус.
 *
 * Бонусы угощений — про удобство, а не про жизни: жизни, которые исчезают,
 * когда угощение доедено, отнимали бы сердце посреди дня.
 *
 * Только данные и чтение состояния: кормление живёт в meals.ts, чтобы
 * bonuses.ts мог читать бонус угощения без кольца импортов.
 */

import type { SaveState } from '../data/state';
import type { Perks } from './perks';

export interface Food {
  id: string;
  /** Слово по-таджикски — то же, что в уроке. */
  tg: string;
  ru: string;
  /** id слова в content/words: угощение повторяет то же слово. */
  wordId: string;
  price: number;
  /** На сколько пройденных уроков хватает. */
  lessons: number;
  perks: Partial<Perks>;
  icon: string;
  tone: string;
  flavor: string;
}

export const FOODS: readonly Food[] = [
  {
    id: 'food_non', tg: 'нон', ru: 'хлеб', wordId: 'w_non',
    price: 40, lessons: 4, perks: { flatCoins: 1 },
    icon: 'non', tone: 'orange', flavor: 'Без нона за дастархон не садятся.',
  },
  {
    id: 'food_choy', tg: 'чой', ru: 'чай', wordId: 'w_choy',
    price: 60, lessons: 3, perks: { hintDiscount: 0.5 },
    icon: 'choy', tone: 'green', flavor: 'Пиала чая — и голова ясная.',
  },
  {
    id: 'food_shir', tg: 'шир', ru: 'молоко', wordId: 'w_shir',
    price: 70, lessons: 3, perks: { regen: 0.5 },
    icon: 'shir', tone: 'blue', flavor: 'Силы возвращаются быстрее.',
  },
  {
    id: 'food_shurbo', tg: 'шӯрбо', ru: 'суп', wordId: 'w_shurbo',
    price: 100, lessons: 3, perks: { shield: 1 },
    icon: 'shurbo', tone: 'red', flavor: 'После горячего шӯрбо одна ошибка за урок не страшна.',
  },
  {
    id: 'food_halvo', tg: 'ҳалво', ru: 'халва', wordId: 'w_halvo',
    price: 120, lessons: 3, perks: { combo: 2 },
    icon: 'halvo', tone: 'gold', flavor: 'Сладкое — для длинной серии.',
  },
  {
    id: 'food_tarbuz', tg: 'тарбуз', ru: 'арбуз', wordId: 'w_tarbuz',
    price: 150, lessons: 4, perks: { levelCoins: 0.4 },
    icon: 'tarbuz', tone: 'pink', flavor: 'Сочный арбуз — щедрая награда за урок.',
  },
  {
    id: 'food_osh', tg: 'ош', ru: 'плов', wordId: 'w_osh',
    price: 260, lessons: 5, perks: { coins: 0.2, levelCoins: 0.2, shield: 1 },
    icon: 'osh', tone: 'purple', flavor: 'Ош — царь дастархона: всего понемногу.',
  },
];

const BY_ID = new Map(FOODS.map((f) => [f.id, f]));

export function getFood(id: string): Food | undefined {
  return BY_ID.get(id);
}

/** Что питомец ест сейчас и сколько уроков осталось; null — ничего. */
export function currentMeal(state: SaveState): { food: Food; left: number } | null {
  const meal = state.inventory.meal;
  if (!meal || meal.left <= 0) return null;
  const food = getFood(meal.id);
  return food ? { food, left: meal.left } : null;
}

/** Бонус угощения — источник для bonuses.ts. Сила из дерева прикладывается там. */
export function mealPerks(state: SaveState): Partial<Perks> {
  return currentMeal(state)?.food.perks ?? {};
}
