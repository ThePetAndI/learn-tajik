/**
 * Дастархон: угощения для питомца.
 *
 * На сцене питомца — кнопка «Покормить» или то, что он сейчас ест; по кнопке —
 * лист угощений. Каждое угощение подписано по-таджикски и по-русски и
 * помечено, знакомо ли уже это слово: дастархон — ещё одно место, где
 * встречаются слова из урока «Еда».
 */

import { h, onTap } from '../core/dom';
import { haptics } from '../core/haptics';
import { getState, update } from '../core/store';
import { now, plural } from '../core/time';
import type { SaveState } from '../data/state';
import { activePet } from '../domain/catalog';
import { FOODS, currentMeal, type Food } from '../domain/foods';
import { canFeed, feed, foodEffect, foodPrice, mealLength } from '../domain/meals';
import { perkLabels } from '../domain/perks';
import { button } from '../ui/button';
import { icon, type IconName } from '../ui/icons';
import { modal } from '../ui/modal';
import type { PetHandle } from '../ui/pet';
import { toast } from '../ui/toast';
import { poorToast } from './shop-bits';

function lessonWord(n: number): string {
  return plural(n, 'урок', 'урока', 'уроков');
}

/** «+1 монета за ответ» — что угощение даст именно этому игроку. */
export function foodWords(state: SaveState, food: Food): string {
  return perkLabels(foodEffect(state, food)).join(', ');
}

/** «Гурба ест нон: +1 за ответ · ещё 3 урока» — для тоста на карте. */
export function mealSummary(state: SaveState): string | null {
  const meal = currentMeal(state);
  if (!meal) return null;
  const pet = activePet(state);
  return (
    (pet ? pet.title + ' ест ' : 'Угощение: ') + meal.food.tg + ' — ' + foodWords(state, meal.food) +
    ' · ещё ' + meal.left + ' ' + lessonWord(meal.left)
  );
}

function foodOrb(food: Food, extra = ''): HTMLElement {
  return h('span', { class: 'food-orb t-' + food.tone + (extra ? ' ' + extra : '') }, icon(food.icon as IconName));
}

/**
 * Строка под питомцем на сцене: что он ест и сколько ещё, или кнопка
 * «Покормить». Одна строка — чтобы угощение было под рукой, но не
 * отдельной простынёй на и без того длинной странице.
 */
export function mealRow(stagePet: PetHandle): HTMLElement {
  const state = getState();
  const meal = currentMeal(state);
  if (meal) {
    const row = h(
      'button',
      { class: 'pmeal', attr: { type: 'button' } },
      foodOrb(meal.food),
      h(
        'span',
        { class: 'pmeal__text' },
        h('span', { class: 'pmeal__title', text: 'Ест ' + meal.food.tg + ' · ещё ' + meal.left + ' ' + lessonWord(meal.left) }),
        h('span', { class: 'pmeal__perk', text: foodWords(state, meal.food) }),
      ),
    );
    onTap(row, () => {
      haptics.tap();
      openFoodSheet(stagePet);
    });
    return row;
  }
  return button({
    label: 'Покормить',
    icon: 'non',
    tone: 'green',
    size: 'sm',
    class: 'pmeal__feed',
    onTap: () => openFoodSheet(stagePet),
  });
}

/** Лист угощений. Пока питомец ест, кормить нельзя — лист это объясняет. */
export function openFoodSheet(stagePet: PetHandle): void {
  const state = getState();
  const meal = currentMeal(state);
  const pet = activePet(state);
  const list = h('div', { class: 'foods' });

  const head = h(
    'p',
    {
      class: 'p foods__note',
      text: meal
        ? (pet?.title ?? 'Питомец') + ' ещё ест ' + meal.food.tg + ' — ' + meal.left + ' ' + lessonWord(meal.left) +
          '. Новое угощение — когда доест.'
        : 'Угощение помогает на нескольких следующих уроках. Одно за раз: пока питомец ест, второе не дают.',
    },
  );

  const m = modal({
    title: 'Дастархон',
    body: h('div', {}, head, list),
    closeButton: true,
    class: 'modal__card--gear',
  });

  for (const food of FOODS) {
    const price = foodPrice(state, food);
    const known = state.srs[food.wordId]?.introduced === true;
    const lessons = mealLength(state, food);
    const buy = button({
      label: String(price),
      icon: 'coin',
      tone: meal ? 'lock' : state.wallet.coins >= price ? 'orange' : 'lock',
      size: 'sm',
      onTap: () => {
        const check = canFeed(getState(), food.id);
        if (check === 'eating') {
          haptics.wrong();
          toast({ text: 'Сначала пусть доест', iconName: food.icon as IconName, tone: 'bad' });
          return;
        }
        if (check === 'not-enough-coins') return poorToast('coins');
        if (check !== 'ok') return;
        update((s) => {
          feed(s, food.id, now());
        });
        haptics.reward();
        m.close('ok');
        stagePet.cheer();
        toast({
          text: (pet?.title ?? 'Питомец') + ' ест ' + food.tg + ': ' + foodWords(getState(), food),
          iconName: food.icon as IconName,
          tone: 'gold',
          ms: 3000,
        });
      },
    });
    list.append(
      h(
        'div',
        { class: 'food' + (meal?.food.id === food.id ? ' is-eating' : '') },
        foodOrb(food),
        h(
          'div',
          { class: 'food__text' },
          h(
            'div',
            { class: 'food__name' },
            h('span', { class: 'food__tg', text: food.tg }),
            h('span', { class: 'food__ru', text: food.ru }),
          ),
          h('div', { class: 'food__perk', text: foodWords(state, food) + ' · ' + lessons + ' ' + lessonWord(lessons) }),
          // дастархон — ещё одно место, где встречаются слова урока «Еда»
          h(
            'div',
            { class: 'food__word' + (known ? ' is-known' : '') },
            icon(known ? 'check' : 'book'),
            h('span', { text: known ? 'слово знакомо' : 'слово из урока «Еда»' }),
          ),
        ),
        buy,
      ),
    );
  }
}
