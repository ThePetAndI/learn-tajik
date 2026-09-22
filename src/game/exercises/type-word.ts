/**
 * Напиши слово. Системная клавиатура на телефоне русская, и шести таджикских
 * букв на ней нет — поэтому под полем стоит своя панель: ғ ӣ қ ӯ ҳ ҷ.
 *
 * Ответ русскими буквами вместо таджикских засчитывается (см. domain/answer),
 * но тогда показываем, как пишется правильно.
 */

import { h, onTap } from '../../core/dom';
import { haptics } from '../../core/haptics';
import { compareAnswer } from '../../domain/answer';
import { button } from '../../ui/button';
import { icon } from '../../ui/icons';
import type {
  ExerciseContext,
  ExerciseInstance,
  ExerciseModule,
  TypeWordExercise,
} from '../types';

/** Буквы, которых нет на русской раскладке. */
const PANEL = ['ғ', 'ӣ', 'қ', 'ӯ', 'ҳ', 'ҷ'];
const HINT_COST = 12;

export const typeWordModule: ExerciseModule<TypeWordExercise> = {
  title: () => 'Напиши по-таджикски',

  mount(ex: TypeWordExercise, ctx: ExerciseContext): ExerciseInstance {
    let done = false;
    let revealed = 0;

    const input = h('input', {
      class: 'typing__input',
      attr: {
        type: 'text',
        autocomplete: 'off',
        autocapitalize: 'off',
        autocorrect: 'off',
        spellcheck: 'false',
        enterkeyhint: 'done',
        'aria-label': 'Ответ по-таджикски',
      },
    }) as HTMLInputElement;

    const check = button({
      label: 'Проверить',
      tone: 'green',
      size: 'big',
      wide: true,
      disabled: true,
    });

    function refresh(): void {
      check.disabled = done || input.value.trim().length === 0;
    }

    input.addEventListener('input', refresh);
    input.addEventListener('keydown', (ev) => {
      if ((ev as KeyboardEvent).key === 'Enter') {
        ev.preventDefault();
        submit();
      }
    });

    /* ——————————————— панель таджикских букв ——————————————— */

    function insert(text: string): void {
      if (done) return;
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? start;
      input.setRangeText(text, start, end, 'end');
      input.focus();
      refresh();
      haptics.tap();
    }

    function backspace(): void {
      if (done) return;
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? start;
      if (start === end && start > 0) input.setRangeText('', start - 1, start, 'end');
      else if (start !== end) input.setRangeText('', start, end, 'end');
      input.focus();
      refresh();
      haptics.tap();
    }

    function keyCap(content: Node | string, onPress: () => void, cls = ''): HTMLElement {
      const key = h(
        'button',
        { class: 'keycap ' + cls, attr: { type: 'button' } },
        content,
      );
      // не отдаём фокус полю: иначе системная клавиатура закрывается на каждой букве
      key.addEventListener('pointerdown', (ev) => ev.preventDefault());
      key.addEventListener('mousedown', (ev) => ev.preventDefault());
      onTap(key, onPress);
      return key;
    }

    const panel = h(
      'div',
      { class: 'keypanel' },
      ...PANEL.map((letter) => keyCap(letter, () => insert(letter))),
      keyCap(icon('backspace'), backspace, 'keycap--wide'),
    );

    /* ——————————————— подсказка ——————————————— */

    const hintBtn = h(
      'button',
      { class: 'ex-hint', attr: { type: 'button' } },
      icon('bulb'),
      h('span', { text: 'Буква' }),
      h('span', { class: 'ex-hint__cost' }, icon('coin'), h('span', { text: String(HINT_COST) })),
    );

    function renderHint(): void {
      const boosters = ctx.itemCount('hint');
      const cost = hintBtn.querySelector('.ex-hint__cost') as HTMLElement | null;
      if (cost) cost.classList.toggle('hidden', boosters > 0);
      hintBtn.classList.toggle('hidden', done || revealed >= ex.tg.length);
    }

    onTap(hintBtn, () => {
      if (done || revealed >= ex.tg.length) return;
      if (!ctx.spend(HINT_COST)) {
        hintBtn.classList.add('is-poor');
        window.setTimeout(() => hintBtn.classList.remove('is-poor'), 500);
        return;
      }
      revealed++;
      input.value = [...ex.tg].slice(0, revealed).join('');
      input.focus();
      haptics.reward();
      refresh();
      renderHint();
    });

    /* ——————————————— проверка ——————————————— */

    function submit(): void {
      if (done || input.value.trim().length === 0) return;
      done = true;
      input.blur();
      input.readOnly = true;
      check.disabled = true;
      hintBtn.classList.add('hidden');
      panel.classList.add('is-off');

      const result = compareAnswer(input.value, ex.tg);
      const correct = result !== 'wrong';
      input.classList.add(correct ? 'is-right' : 'is-wrong');
      if (correct) haptics.correct();
      else haptics.wrong();

      ctx.attempt({ correct, wordIds: ex.wordIds, lenient: result === 'lenient' });
      ctx.finish({
        correct,
        lenient: result === 'lenient',
        expected: ex.tg,
        given: input.value.trim(),
      });
    }

    onTap(check, submit);
    renderHint();
    refresh();

    const el = h(
      'div',
      { class: 'ex ex--typing' },
      h(
        'div',
        { class: 'typing__prompt' },
        h('div', { class: 'typing__ru', text: ex.ru }),
        ex.hint ? h('div', { class: 'typing__hint', text: ex.hint }) : null,
      ),
      h('div', { class: 'typing__field' }, input),
      panel,
      h('div', { class: 'ex__tools' }, hintBtn),
      h('div', { class: 'ex__action' }, check),
    );

    return { el };
  },
};
