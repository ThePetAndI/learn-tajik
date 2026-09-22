/**
 * Выбери реплику. Слева — то, что сказал собеседник, ниже варианты ответа.
 *
 * Перевод реплики собеседника показываем сразу: задание про то, что ответить,
 * а не про то, что спросили. Переводы вариантов, наоборот, открываются только
 * после ответа — иначе выбирать можно было бы по-русски.
 */

import { clear, h, onTap } from '../../core/dom';
import { haptics } from '../../core/haptics';
import { icon } from '../../ui/icons';
import type {
  DialogueChoiceExercise,
  ExerciseContext,
  ExerciseInstance,
  ExerciseModule,
} from '../types';

export const dialogueModule: ExerciseModule<DialogueChoiceExercise> = {
  title: () => 'Что ответишь?',

  mount(ex: DialogueChoiceExercise, ctx: ExerciseContext): ExerciseInstance {
    let answered = false;
    const bubbles: HTMLButtonElement[] = [];

    const choose = (index: number): void => {
      if (answered) return;
      answered = true;
      const correct = index === ex.correct;

      bubbles.forEach((bubble, i) => {
        bubble.disabled = true;
        // после ответа открываем перевод у каждого варианта — видно, что предлагали
        const option = ex.options[i];
        if (option) {
          bubble.append(h('span', { class: 'talk__ru', text: option.ru }));
        }
        if (i === ex.correct) bubble.classList.add('is-right');
        else if (i === index) bubble.classList.add('is-wrong');
        else bubble.classList.add('is-dim');
      });

      if (correct) haptics.correct();
      else haptics.wrong();

      ctx.attempt({ correct, wordIds: ex.wordIds });
      ctx.finish({ correct, expected: ex.options[ex.correct]?.tg });
    };

    const ask = h(
      'div',
      { class: 'talk__row talk__row--them' },
      h('div', { class: 'talk__avatar' }, icon('chat')),
      h(
        'div',
        { class: 'talk__bubble talk__bubble--them' },
        h('span', { class: 'talk__tg', text: ex.ask.tg }),
        h('span', { class: 'talk__ru', text: ex.ask.ru }),
      ),
    );

    const options = h(
      'div',
      { class: 'talk__options' },
      ...ex.options.map((option, index) => {
        const bubble = h(
          'button',
          { class: 'talk__bubble talk__bubble--me', attr: { type: 'button' } },
          h('span', { class: 'talk__tg', text: option.tg }),
        );
        onTap(bubble, () => choose(index));
        bubbles.push(bubble);
        return bubble;
      }),
    );

    const el = h('div', { class: 'ex ex--talk' }, ask, options);

    return {
      el,
      destroy: () => clear(options),
    };
  },
};
