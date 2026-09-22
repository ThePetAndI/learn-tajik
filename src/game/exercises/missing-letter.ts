/** Пропущенная буква: в слове дырка, буква выбирается из четырёх похожих. */

import { h, onTap } from '../../core/dom';
import { haptics } from '../../core/haptics';
import type {
  ExerciseContext,
  ExerciseInstance,
  ExerciseModule,
  MissingLetterExercise,
} from '../types';

export const missingLetterModule: ExerciseModule<MissingLetterExercise> = {
  title: (ex) => (ex.special ? 'Какая буква пропала?' : 'Вставь букву'),

  mount(ex: MissingLetterExercise, ctx: ExerciseContext): ExerciseInstance {
    let answered = false;

    const gap = h('span', { class: 'gap__slot' });
    const word = h(
      'div',
      { class: 'gap__word' },
      h('span', { text: ex.before }),
      gap,
      h('span', { text: ex.after }),
    );

    const tiles: HTMLButtonElement[] = [];

    const choose = (index: number): void => {
      if (answered) return;
      answered = true;
      const correct = index === ex.correct;

      gap.textContent = ex.options[index] ?? '';
      gap.classList.add('is-filled', correct ? 'is-right' : 'is-wrong');

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
        expected: ex.before + (ex.options[ex.correct] ?? '') + ex.after,
        given: ex.before + (ex.options[index] ?? '') + ex.after,
        explain: ex.explain,
      });
    };

    const row = h(
      'div',
      { class: 'gap__options' },
      ...ex.options.map((letter, index) => {
        const tile = h('button', {
          class: 'letter-tile',
          attr: { type: 'button' },
          text: letter,
        });
        onTap(tile, () => choose(index));
        tiles.push(tile);
        return tile;
      }),
    );

    const el = h(
      'div',
      { class: 'ex ex--gap' },
      h('div', { class: 'gap__ru', text: ex.ru }),
      word,
      ex.special && ctx.settings.showHints
        ? h('div', { class: 'gap__note', text: 'Здесь одна из особых таджикских букв' })
        : null,
      row,
    );

    return { el };
  },
};
