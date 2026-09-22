/**
 * Знакомство с буквой: сначала карточка, потом проверка.
 *
 * Карточка сама по себе не задание — её можно пролистать не читая. Поэтому
 * сразу за ней идёт выбор буквы среди похожих: ҳ рядом с х, қ рядом с к.
 * Ошибиться здесь легко, если не посмотрел, и невозможно, если посмотрел.
 */

import { h, onTap } from '../../core/dom';
import { haptics } from '../../core/haptics';
import { button } from '../../ui/button';
import { icon } from '../../ui/icons';
import type {
  AlphabetIntroExercise,
  ExerciseContext,
  ExerciseInstance,
  ExerciseModule,
} from '../types';

export const alphabetIntroModule: ExerciseModule<AlphabetIntroExercise> = {
  title: () => 'Новая буква',

  mount(ex: AlphabetIntroExercise, ctx: ExerciseContext): ExerciseInstance {
    let answered = false;

    /* ——————————————— карточка ——————————————— */

    const ready = button({ label: 'Понятно', tone: 'orange', size: 'big', wide: true });

    const card = h(
      'div',
      { class: 'letter-card' },
      h(
        'div',
        { class: 'letter-card__glyph' },
        h('span', { class: 'letter-card__upper', text: ex.upper }),
        h('span', { class: 'letter-card__lower', text: ex.lower }),
      ),
      h('div', { class: 'letter-card__name', text: ex.name }),
      h('div', { class: 'letter-card__sound', text: ex.sound }),
      ex.ru === null
        ? h(
            'div',
            { class: 'letter-card__badge' },
            icon('sparkle'),
            h('span', { text: 'в русском такой буквы нет' }),
          )
        : null,
      ex.note ? h('div', { class: 'letter-card__note', text: ex.note }) : null,
      h(
        'div',
        { class: 'letter-card__examples' },
        ...ex.examples.map((e) =>
          h(
            'div',
            { class: 'letter-example' },
            h('span', { class: 'letter-example__tg', html: highlight(e.tg, ex.lower) }),
            h('span', { class: 'letter-example__ru', text: e.ru }),
          ),
        ),
      ),
    );

    /* ——————————————— проверка ——————————————— */

    const tiles: HTMLButtonElement[] = [];
    const quiz = h(
      'div',
      { class: 'letter-quiz hidden' },
      h('div', { class: 'letter-quiz__ask', text: 'Где буква ' + ex.upper + ex.lower + '?' }),
      h(
        'div',
        { class: 'letter-quiz__tiles' },
        ...ex.options.map((letter, index) => {
          const tile = h('button', {
            class: 'letter-tile letter-tile--big',
            attr: { type: 'button' },
            text: letter,
          });
          onTap(tile, () => choose(index));
          tiles.push(tile);
          return tile;
        }),
      ),
    );

    function choose(index: number): void {
      if (answered) return;
      answered = true;
      const correct = index === ex.correct;

      tiles.forEach((tile, i) => {
        tile.disabled = true;
        if (i === ex.correct) tile.classList.add('is-right');
        else if (i === index) tile.classList.add('is-wrong');
        else tile.classList.add('is-dim');
      });

      if (correct) haptics.correct();
      else haptics.wrong();

      ctx.attempt({ correct, wordIds: ex.wordIds });
      ctx.finish({
        correct,
        expected: ex.upper + ex.lower,
        message: correct ? 'Запомнил!' : undefined,
      });
    }

    onTap(ready, () => {
      card.classList.add('is-small');
      ready.classList.add('hidden');
      quiz.classList.remove('hidden');
      haptics.tap();
    });

    const el = h(
      'div',
      { class: 'ex ex--letter' },
      card,
      h('div', { class: 'ex__action' }, ready),
      quiz,
    );

    return { el };
  },
};

/** Подсвечиваем изучаемую букву прямо в слове. */
function highlight(word: string, letter: string): string {
  const safe = word.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);
  let out = '';
  for (const ch of safe) {
    out += ch.toLowerCase() === letter ? '<b>' + ch + '</b>' : ch;
  }
  return out;
}
