/**
 * Карточка правила: как устроена грамматика, прежде чем её спрашивать.
 * Не проверка — ошибиться нельзя, попыток не записывает.
 */

import { h, onTap } from '../../core/dom';
import { haptics } from '../../core/haptics';
import { button } from '../../ui/button';
import { icon } from '../../ui/icons';
import type {
  ExerciseContext,
  ExerciseInstance,
  ExerciseModule,
  RuleCardExercise,
} from '../types';

export const ruleCardModule: ExerciseModule<RuleCardExercise> = {
  title: () => 'Как это устроено',

  mount(ex: RuleCardExercise, ctx: ExerciseContext): ExerciseInstance {
    let done = false;

    const next = button({ label: 'Понятно', tone: 'orange', size: 'big', wide: true });
    onTap(next, () => {
      if (done) return;
      done = true;
      haptics.tap();
      ctx.finish({ correct: true, message: 'Поехали' });
    });

    // Пустая строка разделяет абзацы — так правило читается, а не сливается в стену
    const paragraphs = ex.body.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

    const el = h(
      'div',
      { class: 'ex ex--rule' },
      h(
        'div',
        { class: 'rule-card' },
        h(
          'div',
          { class: 'rule-card__head' },
          h('span', { class: 'rule-card__mark' }, icon('bulb')),
          h('h2', { class: 'rule-card__title', text: ex.title }),
        ),
        h(
          'div',
          { class: 'rule-card__body' },
          ...paragraphs.map((p) => h('p', { class: 'rule-card__p', text: p.trim() })),
        ),
        ex.examples.length > 0
          ? h(
              'div',
              { class: 'rule-card__examples' },
              ...ex.examples.map((e) =>
                h(
                  'div',
                  { class: 'rule-example' },
                  h('span', { class: 'rule-example__tg', text: e.tg }),
                  h('span', { class: 'rule-example__ru', text: e.ru }),
                ),
              ),
            )
          : null,
      ),
      h('div', { class: 'ex__action' }, next),
    );

    return { el };
  },
};
