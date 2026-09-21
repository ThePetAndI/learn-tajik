/** Квиз на четыре варианта. */

import { h, onTap } from '../../core/dom';
import { haptics } from '../../core/haptics';
import { hasSpecialLetters, specialLettersOf } from '../../domain/answer';
import { icon } from '../../ui/icons';
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

    /* ——— бустер «50 на 50»: убирает два неверных варианта ——— */

    const fiftyCount = h('span', { class: 'quiz__fifty-count' });
    const fiftyBtn = h(
      'button',
      { class: 'quiz__fifty', attr: { type: 'button' }, aria: { label: 'Убрать два неверных варианта' } },
      icon('target'),
      h('span', { text: '50/50' }),
      fiftyCount,
    );
    let fiftyUsed = false;

    function renderFifty(): void {
      const left = ctx.itemCount('fifty');
      fiftyCount.textContent = '×' + left;
      // прятать кнопку, когда бустеров нет: иначе она дразнит впустую
      fiftyBtn.classList.toggle('hidden', left <= 0 || fiftyUsed || answered);
    }

    onTap(fiftyBtn, () => {
      if (answered || fiftyUsed) return;
      if (!ctx.useItem('fifty')) {
        renderFifty();
        return;
      }
      fiftyUsed = true;
      const wrong = buttons
        .map((btn, i) => ({ btn, i }))
        .filter((x) => x.i !== ex.correct);
      // убираем два случайных неверных — какие именно, решает свой ГПСЧ
      const shuffled = wrong.sort(() => ctx.rng() - 0.5).slice(0, 2);
      for (const { btn } of shuffled) {
        btn.disabled = true;
        btn.classList.add('is-dim');
      }
      haptics.reward();
      renderFifty();
    });

    renderFifty();

    return {
      el: h('div', { class: 'ex ex--quiz' }, promptEl, list, h('div', { class: 'quiz__tools' }, fiftyBtn)),
    };
  },
};
