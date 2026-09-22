/**
 * Напиши фразу. Перевод набирается целиком: ни банка слов, ни вариантов.
 *
 * Над полем — ячейки по числу слов. Это не украшение: по-таджикски
 * «Ман ба хона меравам» и «Ба хона меравам» оба верны, и без подсказки
 * о длине мы бы засчитывали или не засчитывали местоимение наугад.
 * Ячейки убирают эту неопределённость, не выдавая ни одного слова.
 *
 * Панель ғ ӣ қ ӯ ҳ ҷ — та же, что в «Напиши слово»: на системной
 * клавиатуре этих букв нет.
 */

import { h, onTap } from '../../core/dom';
import { haptics } from '../../core/haptics';
import { compareAnswer, comparePhrase, foldTajik, tokenize } from '../../domain/answer';
import { button } from '../../ui/button';
import { icon } from '../../ui/icons';
import type {
  ExerciseContext,
  ExerciseInstance,
  ExerciseModule,
  TypePhraseExercise,
} from '../types';

/** Буквы, которых нет на русской раскладке. */
const PANEL = ['ғ', 'ӣ', 'қ', 'ӯ', 'ҳ', 'ҷ'];
/** Слово дороже буквы в «Напиши слово»: и подсказывает оно больше. */
const HINT_COST = 16;

/** «2 слова», «5 слов» — подпись под вопросом должна читаться по-русски. */
function wordsLabel(n: number): string {
  const tail = n % 100;
  const last = n % 10;
  if (tail >= 11 && tail <= 14) return n + ' слов';
  if (last === 1) return n + ' слово';
  if (last >= 2 && last <= 4) return n + ' слова';
  return n + ' слов';
}

/** Те же слова, но в другом порядке — самая частая и самая учебная ошибка. */
function sameWords(given: readonly string[], expected: readonly string[]): boolean {
  if (given.length !== expected.length) return false;
  const key = (list: readonly string[]): string => list.map(foldTajik).sort().join('|');
  return key(given) === key(expected);
}

export const typePhraseModule: ExerciseModule<TypePhraseExercise> = {
  title: () => 'Напиши фразу',

  mount(ex: TypePhraseExercise, ctx: ExerciseContext): ExerciseInstance {
    let done = false;
    /** Сколько слов уже куплено подсказкой. */
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
        'aria-label': 'Фраза по-таджикски',
      },
    }) as HTMLInputElement;

    const check = button({
      label: 'Проверить',
      tone: 'green',
      size: 'big',
      wide: true,
      disabled: true,
    });

    /* ——————————————— ячейки по числу слов ——————————————— */

    const cells = ex.answer.map(() => h('span', { class: 'writing__cell' }));
    const slots = h('div', { class: 'writing__slots' }, ...cells);

    /** Сколько слов уже написано — по ним заполняются ячейки. */
    const typed = (): string[] => tokenize(input.value);

    function refresh(): void {
      const count = typed().length;
      check.disabled = done || count === 0;
      if (done) return;
      cells.forEach((cell, i) => {
        cell.classList.toggle('is-filled', i < count && i >= revealed);
        cell.classList.toggle('is-active', i === count && count < cells.length);
      });
      // написали больше слов, чем ждём — видно сразу, а не после проверки
      slots.classList.toggle('is-over', count > cells.length);
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
      const key = h('button', { class: 'keycap ' + cls, attr: { type: 'button' } }, content);
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

    /*
     * Последнее слово не продаётся: иначе подсказка перестаёт быть подсказкой
     * и становится покупкой ответа.
     */
    const maxHints = ex.answer.length - 1;

    const hintBtn = h(
      'button',
      { class: 'ex-hint', attr: { type: 'button' } },
      icon('bulb'),
      h('span', { text: 'Слово' }),
      h('span', { class: 'ex-hint__cost' }, icon('coin'), h('span', { text: String(HINT_COST) })),
    );

    function renderHint(): void {
      const cost = hintBtn.querySelector('.ex-hint__cost') as HTMLElement | null;
      if (cost) cost.classList.toggle('hidden', ctx.itemCount('hint') > 0);
      hintBtn.classList.toggle('hidden', done || revealed >= maxHints);
    }

    onTap(hintBtn, () => {
      if (done || revealed >= maxHints) return;
      if (!ctx.spend(HINT_COST)) {
        hintBtn.classList.add('is-poor');
        window.setTimeout(() => hintBtn.classList.remove('is-poor'), 500);
        return;
      }
      revealed++;
      input.value = ex.answer.slice(0, revealed).join(' ') + ' ';
      input.focus();
      for (let i = 0; i < revealed; i++) {
        const cell = cells[i];
        if (!cell) continue;
        cell.textContent = ex.answer[i] ?? '';
        cell.classList.add('is-given');
      }
      haptics.reward();
      refresh();
      renderHint();
    });

    /* ——————————————— проверка ——————————————— */

    /** Разбор: в ячейках верные слова, каждое помечено — попал игрок или нет. */
    function showDiff(given: readonly string[], against: readonly string[]): void {
      cells.forEach((cell, i) => {
        cell.classList.remove('is-filled', 'is-active', 'is-given');
        cell.textContent = against[i] ?? '';
        const hit = compareAnswer(given[i] ?? '', against[i] ?? '') !== 'wrong';
        cell.classList.add(hit ? 'is-right' : 'is-wrong');
      });
      slots.classList.remove('is-over');
      slots.classList.add('is-done');
    }

    function submit(): void {
      const given = typed();
      if (done || given.length === 0) return;
      done = true;
      input.blur();
      input.readOnly = true;
      check.disabled = true;
      hintBtn.classList.add('hidden');
      panel.classList.add('is-off');

      const { result, against } = comparePhrase(given, [ex.answer, ...(ex.alt ?? [])]);
      const correct = result !== 'wrong';
      input.classList.add(correct ? 'is-right' : 'is-wrong');
      showDiff(given, correct ? against : ex.answer);
      if (correct) haptics.correct();
      else haptics.wrong();

      ctx.attempt({ correct, wordIds: ex.wordIds, lenient: result === 'lenient' });
      ctx.finish({
        correct,
        lenient: result === 'lenient',
        expected: ex.tg,
        given: input.value.trim(),
        /*
         * Объясняем только то, что видно из самого сравнения. Сказать
         * «глагол в конце» здесь нельзя: фраза бывает и без глагола.
         */
        explain:
          !correct && sameWords(given, ex.answer)
            ? 'Все слова верные — другой порядок. В таджикском он строгий.'
            : undefined,
      });
    }

    onTap(check, submit);
    renderHint();
    refresh();

    const el = h(
      'div',
      { class: 'ex ex--typing ex--writing' },
      h(
        'div',
        { class: 'typing__prompt' },
        h('div', { class: 'typing__ru', text: ex.ru }),
        // ячейки показывают длину ответа, подпись называет её словами
        h('div', { class: 'typing__hint', text: wordsLabel(ex.answer.length) }),
      ),
      slots,
      h('div', { class: 'typing__field' }, input),
      panel,
      h('div', { class: 'ex__tools' }, hintBtn),
      h('div', { class: 'ex__action' }, check),
    );

    return { el };
  },
};
