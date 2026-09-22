/**
 * Число и слово: «ҳафт» — набрать 7.
 *
 * Клавиатура своя, а не системная: системная на числовом режиме у каждой
 * прошивки своя и половину экрана съедает.
 */

import { h, onTap } from '../../core/dom';
import { haptics } from '../../core/haptics';
import { icon } from '../../ui/icons';
import { button } from '../../ui/button';
import type {
  ExerciseContext,
  ExerciseInstance,
  ExerciseModule,
  NumberWordExercise,
} from '../types';

const MAX_DIGITS = 5;

export const numberWordModule: ExerciseModule<NumberWordExercise> = {
  title: () => 'Какое это число?',

  mount(ex: NumberWordExercise, ctx: ExerciseContext): ExerciseInstance {
    let typed = '';
    let done = false;

    const display = h('div', { class: 'numpad__display' });
    const check = button({
      label: 'Проверить',
      tone: 'green',
      size: 'big',
      wide: true,
      disabled: true,
    });

    function paint(): void {
      display.textContent = typed || '—';
      display.classList.toggle('is-empty', typed.length === 0);
      check.disabled = done || typed.length === 0;
    }

    function type(digit: string): void {
      if (done || typed.length >= MAX_DIGITS) return;
      // ведущий ноль не бывает частью числа
      if (typed === '' && digit === '0') return;
      typed += digit;
      haptics.tap();
      paint();
    }

    function backspace(): void {
      if (done || typed.length === 0) return;
      typed = typed.slice(0, -1);
      haptics.tap();
      paint();
    }

    function submit(): void {
      if (done || typed.length === 0) return;
      done = true;
      check.disabled = true;
      pad.classList.add('is-off');

      const correct = Number(typed) === ex.value;
      display.classList.add(correct ? 'is-right' : 'is-wrong');
      if (correct) haptics.correct();
      else haptics.wrong();

      ctx.attempt({ correct, wordIds: ex.wordIds });
      ctx.finish({
        correct,
        expected: String(ex.value) + ' — ' + ex.ru,
        given: typed,
      });
    }

    function keyCap(content: Node | string, onPress: () => void, cls = ''): HTMLElement {
      const key = h(
        'button',
        { class: 'keycap keycap--num ' + cls, attr: { type: 'button' } },
        content,
      );
      onTap(key, onPress);
      return key;
    }

    const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const pad = h(
      'div',
      { class: 'numpad__keys' },
      ...digits.map((d) => keyCap(d, () => type(d))),
      keyCap('0', () => type('0')),
      keyCap(icon('backspace'), backspace, 'keycap--wide'),
    );

    onTap(check, submit);
    paint();

    const el = h(
      'div',
      { class: 'ex ex--numpad' },
      h('div', { class: 'numpad__word', text: ex.tg }),
      display,
      pad,
      h('div', { class: 'ex__action' }, check),
    );

    return { el };
  },
};
