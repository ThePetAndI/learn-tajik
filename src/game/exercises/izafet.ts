/**
 * Изафет-конструктор: «падар» + и + «ман» = «падари ман».
 *
 * Рамка со слотами нарисована заранее и «и» уже приклеено к первому слоту —
 * задание не про то, где стоит буква, а про то, какое слово главное.
 * По-русски определение идёт первым («мой отец»), в таджикском — вторым,
 * и это самая частая ошибка начинающих.
 */

import { h, onTap } from '../../core/dom';
import { haptics } from '../../core/haptics';
import { compareAnswer } from '../../domain/answer';
import { button } from '../../ui/button';
import type {
  ExerciseContext,
  ExerciseInstance,
  ExerciseModule,
  IzafetBuilderExercise,
} from '../types';

export const izafetModule: ExerciseModule<IzafetBuilderExercise> = {
  title: () => 'Собери по-таджикски',

  mount(ex: IzafetBuilderExercise, ctx: ExerciseContext): ExerciseInstance {
    let done = false;
    /** Что стоит в каждом слоте: фишка или пусто. */
    const slots: (HTMLButtonElement | null)[] = [null, null];

    const suffix = h('span', { class: 'izafet__suffix', text: ex.suffix });
    const slotEls = [0, 1].map((i) =>
      h(
        'button',
        { class: 'izafet__slot', attr: { type: 'button' }, data: { slot: String(i) } },
        i === 0 ? suffix : null,
      ),
    );

    const bank = h('div', { class: 'izafet__bank' });
    const check = button({
      label: 'Проверить',
      tone: 'green',
      size: 'big',
      wide: true,
      disabled: true,
    });

    function refresh(): void {
      check.disabled = done || slots.some((s) => s === null);
      for (const [i, el] of slotEls.entries()) {
        el.classList.toggle('is-empty', slots[i] === null);
      }
    }

    function place(chip: HTMLButtonElement): void {
      if (done) return;
      const free = slots.findIndex((s) => s === null);
      if (free < 0) return;
      slots[free] = chip;
      chip.classList.add('is-placed');
      slotEls[free]?.prepend(chip);
      haptics.tap();
      refresh();
    }

    function takeBack(index: number): void {
      if (done) return;
      const chip = slots[index];
      if (!chip) return;
      slots[index] = null;
      chip.classList.remove('is-placed');
      bank.append(chip);
      haptics.tap();
      refresh();
    }

    for (const word of ex.bank) {
      const chip = h('button', {
        class: 'chip',
        attr: { type: 'button' },
        text: word,
        data: { word },
      });
      onTap(chip, () => {
        const at = slots.indexOf(chip);
        if (at >= 0) takeBack(at);
        else place(chip);
      });
      bank.append(chip);
    }

    for (const [i, el] of slotEls.entries()) {
      onTap(el, () => {
        if (slots[i]) takeBack(i);
      });
    }

    onTap(check, () => {
      if (done || slots.some((s) => s === null)) return;
      done = true;
      check.disabled = true;

      const head = slots[0]?.dataset.word ?? '';
      const mod = slots[1]?.dataset.word ?? '';
      const built = head + ex.suffix + ' ' + mod;
      const result = compareAnswer(built, ex.tg);
      const correct = result !== 'wrong';

      frame.classList.add(correct ? 'is-right' : 'is-wrong');
      if (correct) haptics.correct();
      else haptics.wrong();

      ctx.attempt({ correct, wordIds: ex.wordIds, lenient: result === 'lenient' });
      ctx.finish({
        correct,
        lenient: result === 'lenient',
        expected: ex.tg,
        given: built,
      });
    });

    refresh();

    const frame = h(
      'div',
      { class: 'izafet__frame' },
      slotEls[0] as HTMLElement,
      slotEls[1] as HTMLElement,
    );

    const el = h(
      'div',
      { class: 'ex ex--izafet' },
      h('div', { class: 'izafet__ru', text: ex.ru }),
      frame,
      ctx.settings.showHints
        ? h('div', {
            class: 'izafet__tip',
            text: 'Сначала главное слово с «' + ex.suffix + '», потом второе',
          })
        : null,
      bank,
      h('div', { class: 'ex__action' }, check),
    );

    return { el };
  },
};
