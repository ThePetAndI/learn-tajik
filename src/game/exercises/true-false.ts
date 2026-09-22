/**
 * Правда или ложь на время.
 *
 * Время считаем по кадрам, а не по часам: если игрок свернул приложение,
 * requestAnimationFrame останавливается вместе с ним и таймер замирает.
 * По Date.now() возврат в игру выглядел бы как мгновенный проигрыш.
 */

import { h, onTap } from '../../core/dom';
import { haptics } from '../../core/haptics';
import { icon } from '../../ui/icons';
import type {
  ExerciseContext,
  ExerciseInstance,
  ExerciseModule,
  TrueFalseExercise,
} from '../types';

/** Кадры длиннее этого считаем «игра была свёрнута» и время не начисляем. */
const MAX_FRAME = 250;
/** Когда полоса становится тревожной. */
const ALARM_AT = 0.3;

export const trueFalseModule: ExerciseModule<TrueFalseExercise> = {
  title: () => 'Верно или нет?',

  mount(ex: TrueFalseExercise, ctx: ExerciseContext): ExerciseInstance {
    let answered = false;
    let elapsed = 0;
    let last = 0;
    let raf = 0;

    const total = ex.seconds * 1000;
    const bar = h('span', { class: 'timer__fill' });
    const clock = h('span', { class: 'timer__value' });
    const timer = h(
      'div',
      { class: 'timer' },
      h('span', { class: 'timer__icon' }, icon('clock')),
      h('span', { class: 'timer__track' }, bar),
      clock,
    );

    const yes = h(
      'button',
      { class: 'tf-btn tf-btn--yes', attr: { type: 'button' } },
      icon('check'),
      h('span', { text: 'Верно' }),
    );
    const no = h(
      'button',
      { class: 'tf-btn tf-btn--no', attr: { type: 'button' } },
      icon('cross'),
      h('span', { text: 'Неверно' }),
    );

    function paint(): void {
      const left = Math.max(0, 1 - elapsed / total);
      bar.style.transform = 'scaleX(' + left + ')';
      timer.classList.toggle('is-alarm', left <= ALARM_AT);
      clock.textContent = Math.ceil((total - elapsed) / 1000) + ' с';
    }

    function tick(now: number): void {
      if (answered) return;
      const delta = last === 0 ? 0 : now - last;
      last = now;
      if (delta <= MAX_FRAME) elapsed += delta;
      paint();
      if (elapsed >= total) {
        timeout();
        return;
      }
      raf = requestAnimationFrame(tick);
    }

    function stop(): void {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    function settle(correct: boolean, message?: string): void {
      answered = true;
      stop();
      yes.disabled = true;
      no.disabled = true;
      (ex.truth ? yes : no).classList.add('is-right');
      timer.classList.add('is-off');

      if (correct) haptics.correct();
      else haptics.wrong();

      ctx.attempt({ correct, wordIds: ex.wordIds });
      ctx.finish({
        correct,
        message,
        expected: ex.truth ? undefined : ex.tg + ' — ' + ex.realRu,
      });
    }

    function answer(said: boolean): void {
      if (answered) return;
      (said ? yes : no).classList.add('is-picked');
      settle(said === ex.truth);
    }

    function timeout(): void {
      if (answered) return;
      paint();
      settle(false, 'Время вышло');
    }

    onTap(yes, () => answer(true));
    onTap(no, () => answer(false));

    paint();
    raf = requestAnimationFrame(tick);

    const el = h(
      'div',
      { class: 'ex ex--tf' },
      timer,
      h(
        'div',
        { class: 'tf__card' },
        h('div', { class: 'tf__tg', text: ex.tg }),
        h('div', { class: 'tf__eq', text: '=' }),
        h('div', { class: 'tf__ru', text: ex.ru }),
      ),
      h('div', { class: 'tf__buttons' }, yes, no),
    );

    return { el, destroy: stop };
  },
};
