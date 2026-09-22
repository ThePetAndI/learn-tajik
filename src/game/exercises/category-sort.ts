/**
 * Разложи по корзинам. Слова идут по одному, корзины внизу — так задание
 * играется одним большим пальцем и не требует перетаскивания.
 *
 * Ошибка не останавливает игру: слово всё равно уходит в свою корзину,
 * подсвеченную зелёным. Застрять на одном слове здесь не на чем.
 */

import { h, onTap } from '../../core/dom';
import { haptics } from '../../core/haptics';
import type {
  CategorySortExercise,
  ExerciseContext,
  ExerciseInstance,
  ExerciseModule,
} from '../types';

const SETTLE_MS = 420;

export const categorySortModule: ExerciseModule<CategorySortExercise> = {
  title: () => 'Разложи по корзинам',

  mount(ex: CategorySortExercise, ctx: ExerciseContext): ExerciseInstance {
    let index = 0;
    let mistakes = 0;
    let busy = false;
    const timers: number[] = [];
    const counts = [0, 0];

    const card = h('div', { class: 'sort__card' });
    const left = h('div', { class: 'sort__stack' });

    const basketEls = ex.baskets.map((label, i) =>
      h(
        'button',
        { class: 'sort__basket', attr: { type: 'button' }, data: { basket: String(i) } },
        h('span', { class: 'sort__basket-label', text: label }),
        h('span', { class: 'sort__basket-count', text: '0' }),
      ),
    );

    function paintCard(): void {
      const item = ex.items[index];
      if (!item) return;
      card.replaceChildren(
        h('span', { class: 'sort__tg', text: item.tg }),
        h('span', { class: 'sort__ru', text: item.ru }),
      );
      card.classList.remove('is-out-0', 'is-out-1', 'is-bad');
      void card.offsetWidth;
      card.classList.add('is-in');
      left.textContent = index + 1 + ' / ' + ex.items.length;
    }

    function choose(basket: number): void {
      if (busy) return;
      const item = ex.items[index];
      if (!item) return;

      const correct = item.basket === basket;
      if (!correct) mistakes++;
      busy = true;

      ctx.attempt({ correct, wordIds: [item.wordId] });
      if (correct) haptics.correct();
      else haptics.wrong();

      const target = item.basket;
      counts[target] = (counts[target] ?? 0) + 1;
      const counter = basketEls[target]?.querySelector('.sort__basket-count');
      if (counter) counter.textContent = String(counts[target]);

      basketEls[target]?.classList.add('is-hit');
      if (!correct) {
        basketEls[basket]?.classList.add('is-miss');
        card.classList.add('is-bad');
      }
      card.classList.remove('is-in');
      card.classList.add('is-out-' + target);

      const timer = window.setTimeout(() => {
        basketEls[target]?.classList.remove('is-hit');
        basketEls[basket]?.classList.remove('is-miss');
        busy = false;
        index++;
        if (index >= ex.items.length) {
          card.classList.add('hidden');
          ctx.finish({
            correct: mistakes === 0,
            message:
              mistakes === 0
                ? 'Всё по местам!'
                : 'Разложено, ошибок: ' + mistakes,
          });
          return;
        }
        paintCard();
      }, SETTLE_MS);
      timers.push(timer);
    }

    for (const [i, el] of basketEls.entries()) onTap(el, () => choose(i));

    paintCard();

    const el = h(
      'div',
      { class: 'ex ex--sort' },
      h('div', { class: 'sort__counter' }, left),
      h('div', { class: 'sort__stage' }, card),
      h('div', { class: 'sort__baskets' }, ...basketEls),
    );

    return {
      el,
      destroy: () => {
        for (const t of timers) clearTimeout(t);
      },
    };
  },
};
