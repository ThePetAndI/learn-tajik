/** Экран результатов уровня: звёзды, точность, монеты. */

import { h } from '../core/dom';
import { pop, type ScreenView } from '../core/router';
import type { FlatLevel } from '../data/content';
import type { SessionResult } from '../game/engine';
import { MAX_STARS, starsTitle } from '../domain/stars';
import { button } from '../ui/button';
import { icon } from '../ui/icons';

export interface ResultsExtra {
  levelCoins: number;
  firstClear: boolean;
}

function statRow(iconName: Parameters<typeof icon>[0], label: string, value: string): HTMLElement {
  return h(
    'div',
    { class: 'results__stat' },
    h('span', { class: 'results__stat-icon' }, icon(iconName)),
    h('span', { class: 'results__stat-label', text: label }),
    h('span', { class: 'results__stat-value', text: value }),
  );
}

export function createResultsScreen(
  level: FlatLevel,
  result: SessionResult,
  extra: ResultsExtra,
): ScreenView {
  const stars = h('div', { class: 'results__stars' });
  for (let i = 0; i < MAX_STARS; i++) {
    const on = i < result.stars;
    const star = h('span', { class: 'results__star ' + (on ? 'is-on' : 'is-off') }, icon(on ? 'star' : 'starEmpty'));
    star.style.animationDelay = 120 + i * 180 + 'ms';
    stars.append(star);
  }

  const totalCoins = result.coinsFromAnswers + extra.levelCoins;

  const el = h(
    'div',
    { class: 'screen screen--results' },
    h(
      'div',
      { class: 'results__body' },
      h('div', { class: 'results__section', text: level.sectionTitle }),
      h('h1', { class: 'h1 results__title', text: starsTitle(result.stars) }),
      stars,
      h(
        'div',
        { class: 'results__coins' },
        icon('coin'),
        h('span', { text: '+' + totalCoins }),
      ),
      h(
        'div',
        { class: 'results__stats' },
        statRow('target', 'Точность', Math.round(result.accuracy * 100) + '%'),
        statRow('check', 'Верных ответов', result.correct + ' из ' + result.attempts),
        statRow('flame', 'Лучшая серия', result.bestCombo + ' подряд'),
        statRow(
          'coin',
          extra.firstClear ? 'За первое прохождение' : 'За уровень',
          '+' + extra.levelCoins,
        ),
      ),
      result.mistakes > 0
        ? h('p', {
            class: 'p results__note',
            text:
              'Ошибок: ' +
              result.mistakes +
              '. Пройди без ошибок — получишь три звезды.',
          })
        : null,
    ),
    h(
      'div',
      { class: 'results__actions' },
      button({
        label: 'На карту',
        tone: 'orange',
        size: 'big',
        wide: true,
        onTap: () => pop(),
      }),
    ),
  );

  // экран поверх карты: системная «назад» должна вести туда же
  const onKey = (ev: KeyboardEvent): void => {
    if (ev.key === 'Enter') pop();
  };

  return {
    el,
    onShow: () => document.addEventListener('keydown', onKey),
    destroy: () => document.removeEventListener('keydown', onKey),
  };
}
