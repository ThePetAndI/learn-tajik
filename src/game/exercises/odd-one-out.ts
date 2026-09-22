/** Лишнее слово: три слова об одном, одно — о другом. */

import { h, onTap } from '../../core/dom';
import { haptics } from '../../core/haptics';
import type {
  ExerciseContext,
  ExerciseInstance,
  ExerciseModule,
  OddOneOutExercise,
} from '../types';

export const oddOneOutModule: ExerciseModule<OddOneOutExercise> = {
  title: () => 'Найди лишнее',

  mount(ex: OddOneOutExercise, ctx: ExerciseContext): ExerciseInstance {
    let answered = false;
    const cards: HTMLButtonElement[] = [];

    const choose = (index: number): void => {
      if (answered) return;
      answered = true;
      const correct = index === ex.correct;

      cards.forEach((card, i) => {
        card.disabled = true;
        card.classList.add('is-open');
        if (i === ex.correct) card.classList.add('is-right');
        else if (i === index) card.classList.add('is-wrong');
        else card.classList.add('is-dim');
      });

      if (correct) haptics.correct();
      else haptics.wrong();

      ctx.attempt({ correct, wordIds: ex.wordIds });
      ctx.finish({
        correct,
        message: correct ? 'Верно, остальные — «' + ex.theme.toLowerCase() + '»' : undefined,
        expected: ex.options[ex.correct]?.tg,
      });
    };

    const grid = h(
      'div',
      { class: 'odd__grid' },
      ...ex.options.map((option, index) => {
        const card = h(
          'button',
          { class: 'card-btn odd__card', attr: { type: 'button' } },
          h('span', { class: 'odd__tg', text: option.tg }),
          h('span', { class: 'odd__ru', text: option.ru }),
        );
        onTap(card, () => choose(index));
        cards.push(card);
        return card;
      }),
    );

    const el = h(
      'div',
      { class: 'ex ex--odd' },
      h('div', { class: 'odd__ask', text: 'Три слова об одном. Какое не подходит?' }),
      grid,
    );

    return { el };
  },
};
