/**
 * Знакомство с фразой или разговором. Не проверка: ошибиться нельзя,
 * на звёзды не влияет. Перевод целиком — и каждое слово отдельно, чтобы
 * потом, собирая фразу, игрок узнавал слова, а не угадывал их.
 */

import { h, onTap } from '../../core/dom';
import { haptics } from '../../core/haptics';
import { button } from '../../ui/button';
import { icon } from '../../ui/icons';
import type { ExerciseContext, ExerciseInstance, ExerciseModule, PhraseIntroExercise } from '../types';

export const phraseIntroModule: ExerciseModule<PhraseIntroExercise> = {
  title: (ex) => (ex.lines.length > 1 ? 'Новый разговор' : 'Новая фраза'),

  mount(ex: PhraseIntroExercise, ctx: ExerciseContext): ExerciseInstance {
    let done = false;
    const next = button({ label: 'Понятно', tone: 'orange', size: 'big', wide: true });
    onTap(next, () => {
      if (done) return;
      done = true;
      haptics.tap();
      ctx.finish({ correct: true, message: 'Запомним' });
    });

    const talk = ex.lines.length > 1;
    const lines = h(
      'div',
      { class: 'pintro__lines' + (talk ? ' is-talk' : '') },
      ...ex.lines.map((line) =>
        h(
          'div',
          { class: 'pintro__line' + (line.who ? ' is-' + line.who : '') },
          talk ? h('span', { class: 'pintro__who' }, icon(line.who === 'me' ? 'user' : 'chat')) : null,
          h(
            'div',
            { class: 'pintro__bubble' },
            h('div', { class: 'pintro__tg', text: line.tg }),
            h('div', { class: 'pintro__ru', text: line.ru }),
          ),
        ),
      ),
    );

    const gloss =
      ex.gloss.length > 0
        ? h(
            'div',
            { class: 'pintro__gloss' },
            h('div', { class: 'pintro__gloss-title', text: 'По словам' }),
            ...ex.gloss.map((g) =>
              h(
                'div',
                { class: 'pintro__word' },
                h('span', { class: 'pintro__word-tg', text: g.tg }),
                h('span', { class: 'pintro__word-ru', text: g.ru }),
              ),
            ),
          )
        : // устойчивое выражение: разбирать на слова нечего, запоминается целиком
          h('div', { class: 'pintro__whole', text: 'Это устойчивое выражение — запоминается целиком.' });

    const el = h(
      'div',
      { class: 'ex ex--intro ex--pintro' },
      h('div', { class: 'intro-card pintro' }, lines, gloss),
      h('div', { class: 'ex__action' }, next),
    );
    return { el };
  },
};
