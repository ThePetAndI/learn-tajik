/** Собери фразу: перевод предложения из банка слов. */

import { h, onTap } from '../../core/dom';
import { haptics } from '../../core/haptics';
import { compareTokens } from '../../domain/answer';
import { button } from '../../ui/button';
import type {
  BuildPhraseExercise,
  ExerciseContext,
  ExerciseInstance,
  ExerciseModule,
} from '../types';

export const buildPhraseModule: ExerciseModule<BuildPhraseExercise> = {
  title: () => 'Собери фразу',

  mount(ex: BuildPhraseExercise, ctx: ExerciseContext): ExerciseInstance {
    let done = false;

    const line = h('div', { class: 'phrase__line' });
    const bank = h('div', { class: 'phrase__bank' });
    const check = button({ label: 'Проверить', tone: 'green', size: 'big', wide: true, disabled: true });

    /** Слова в строке ответа, в порядке постановки. */
    const placed: HTMLButtonElement[] = [];

    function refresh(): void {
      check.disabled = placed.length === 0;
      line.classList.toggle('is-empty', placed.length === 0);
    }

    function makeChip(word: string): HTMLButtonElement {
      const chip = h('button', {
        class: 'chip',
        attr: { type: 'button' },
        text: word,
        data: { word },
      });
      onTap(chip, () => {
        if (done) return;
        haptics.tap();
        const index = placed.indexOf(chip);
        if (index >= 0) {
          placed.splice(index, 1);
          bank.append(chip);
          chip.classList.remove('is-placed');
        } else {
          placed.push(chip);
          line.append(chip);
          chip.classList.add('is-placed');
        }
        refresh();
      });
      return chip;
    }

    for (const word of ex.bank) bank.append(makeChip(word));

    onTap(check, () => {
      if (done || placed.length === 0) return;
      done = true;
      check.disabled = true;

      const given = placed.map((c) => c.dataset.word ?? '');
      const result = compareTokens(given, ex.answer);
      const correct = result !== 'wrong';

      line.classList.add(correct ? 'is-right' : 'is-wrong');
      for (const chip of placed) chip.classList.add(correct ? 'is-right' : 'is-wrong');
      if (correct) haptics.correct();
      else haptics.wrong();

      ctx.attempt({ correct, wordIds: ex.wordIds, lenient: result === 'lenient' });
      ctx.finish({
        correct,
        lenient: result === 'lenient',
        expected: ex.tg,
        given: given.join(' '),
      });
    });

    refresh();

    const el = h(
      'div',
      { class: 'ex ex--phrase' },
      h('div', { class: 'phrase__source' }, h('div', { class: 'phrase__ru', text: ex.ru })),
      line,
      bank,
      h('div', { class: 'ex__action' }, check),
    );

    return { el };
  },
};
