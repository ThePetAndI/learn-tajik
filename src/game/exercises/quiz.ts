/** Квиз на четыре варианта. */

import { h, onTap } from '../../core/dom';
import { haptics } from '../../core/haptics';
import { hasSpecialLetters, specialLettersOf } from '../../domain/answer';
import type { ExerciseContext, ExerciseInstance, ExerciseModule, QuizExercise } from '../types';

/** Короткие варианты помещаются в две колонки, длинные — в одну. */
function useTwoColumns(options: readonly string[]): boolean {
  return options.every((o) => o.length <= 11);
}

export const quizModule: ExerciseModule<QuizExercise> = {
  title: (ex) => (ex.kind === 'quiz_tg_ru' ? 'Что это значит?' : 'Как сказать по-таджикски?'),

  mount(ex: QuizExercise, ctx: ExerciseContext): ExerciseInstance {
    const toTajik = ex.kind === 'quiz_ru_tg';
    let answered = false;

    const promptEl = h(
      'div',
      { class: 'quiz__prompt' + (toTajik ? '' : ' quiz__prompt--tg') },
      h('div', { class: 'quiz__word', text: ex.prompt }),
      ex.hint ? h('div', { class: 'quiz__hint', text: ex.hint }) : null,
      !toTajik && ctx.settings.showHints && hasSpecialLetters(ex.prompt)
        ? h('div', { class: 'quiz__letters', text: 'особые буквы: ' + specialLettersOf(ex.prompt).join(' ') })
        : null,
    );

    const buttons: HTMLButtonElement[] = [];

    const choose = (index: number): void => {
      if (answered) return;
      answered = true;
      const correct = index === ex.correct;

      buttons.forEach((btn, i) => {
        btn.disabled = true;
        if (i === ex.correct) btn.classList.add('is-right');
        else if (i === index) btn.classList.add('is-wrong');
        else btn.classList.add('is-dim');
      });

      if (correct) haptics.correct();
      else haptics.wrong();

      ctx.attempt({ correct, wordIds: ex.wordIds });
      ctx.finish({
        correct,
        expected: ex.options[ex.correct],
        given: ex.options[index],
      });
    };

    const list = h(
      'div',
      { class: 'quiz__options' + (useTwoColumns(ex.options) ? ' quiz__options--grid' : '') },
      ...ex.options.map((option, index) => {
        const btn = h('button', {
          class: 'card-btn quiz__option' + (toTajik ? ' quiz__option--tg' : ''),
          attr: { type: 'button' },
          text: option,
        });
        onTap(btn, () => choose(index));
        buttons.push(btn);
        return btn;
      }),
    );

    return { el: h('div', { class: 'ex ex--quiz' }, promptEl, list) };
  },
};
