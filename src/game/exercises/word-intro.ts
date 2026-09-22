/**
 * Знакомство со словом. Не проверка: попыток не записывает, ошибиться
 * нельзя, на звёзды не влияет — просто говорит, что это за слово,
 * прежде чем о нём спросят.
 */

import { h, onTap } from '../../core/dom';
import { haptics } from '../../core/haptics';
import { hasAudio, play } from '../../core/audio';
import { button } from '../../ui/button';
import { icon } from '../../ui/icons';
import type {
  ExerciseContext,
  ExerciseInstance,
  ExerciseModule,
  WordIntroExercise,
} from '../types';

export const wordIntroModule: ExerciseModule<WordIntroExercise> = {
  title: () => 'Новое слово',

  mount(ex: WordIntroExercise, ctx: ExerciseContext): ExerciseInstance {
    let done = false;

    const next = button({ label: 'Понятно', tone: 'orange', size: 'big', wide: true });
    onTap(next, () => {
      if (done) return;
      done = true;
      haptics.tap();
      ctx.finish({ correct: true, message: 'Запомним' });
    });

    // кнопка появляется только там, где есть запись: пока их нет, её нет нигде
    function speakBtn(src: string): HTMLElement {
      const b = h(
        'button',
        { class: 'speak', attr: { type: 'button' }, aria: { label: 'Послушать' } },
        icon('speaker'),
      );
      onTap(b, () => play(src));
      return b;
    }

    const el = h(
      'div',
      { class: 'ex ex--intro' },
      h(
        'div',
        { class: 'intro-card' },
        hasAudio(ex.audio)
          ? h(
              'div',
              { class: 'intro-card__sound-row' },
              h('div', { class: 'intro-card__tg', text: ex.tg }),
              speakBtn(ex.audio as string),
            )
          : h('div', { class: 'intro-card__tg', text: ex.tg }),
        h('div', { class: 'intro-card__ru', text: ex.ru }),
        ex.pos ? h('div', { class: 'intro-card__pos', text: ex.pos }) : null,
        ex.letters.length > 0
          ? h(
              'div',
              { class: 'intro-card__letters' },
              icon('sparkle'),
              h('span', { text: 'особые буквы: ' + ex.letters.join(' ') }),
            )
          : null,
        ex.example
          ? h(
              'div',
              { class: 'intro-card__example' },
              h('div', { class: 'intro-card__example-tg', text: ex.example.tg }),
              h('div', { class: 'intro-card__example-ru', text: ex.example.ru }),
            )
          : null,
      ),
      h('div', { class: 'ex__action' }, next),
    );

    return { el };
  },
};
