/** Экран результатов уровня: звёзды, точность, монеты. */

import { h } from '../core/dom';
import { closeAll, pop, type ScreenView } from '../core/router';
import { getState } from '../core/store';
import { now } from '../core/time';
import type { FlatLevel } from '../data/content';
import { computeLives } from '../domain/lives';
import { hasRecoveryMaterial } from '../domain/recovery';
import { MAX_STARS, starsTitle } from '../domain/stars';
import type { SessionResult } from '../game/engine';
import { button } from '../ui/button';
import { icon, type IconName } from '../ui/icons';
import { openRecovery } from './recovery';

export interface ResultsExtra {
  levelCoins: number;
  firstClear: boolean;
  /** Уровень прерван: кончились жизни. */
  failed?: boolean;
  /** Лаъл за уровень: всего и за что именно. */
  gems?: { total: number; perfect: number; section: number };
}

/** Откуда пришёл лаъл — одной строкой под счётчиками. */
function gemReason(gems: NonNullable<ResultsExtra['gems']>): string {
  const parts: string[] = [];
  if (gems.perfect > 0) parts.push('без единой ошибки +' + gems.perfect);
  if (gems.section > 0) parts.push('раздел закрыт +' + gems.section);
  const other = gems.total - gems.perfect - gems.section;
  if (other > 0) parts.push('освоенные слова и серия +' + other);
  return parts.join(' · ');
}

function statRow(iconName: IconName, label: string, value: string): HTMLElement {
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
  const failed = extra.failed === true;
  const totalCoins = result.coinsFromAnswers + extra.levelCoins;

  const stars = h('div', { class: 'results__stars' });
  for (let i = 0; i < MAX_STARS; i++) {
    const on = !failed && i < result.stars;
    const star = h(
      'span',
      { class: 'results__star ' + (on ? 'is-on' : 'is-off') },
      icon(on ? 'star' : 'starEmpty'),
    );
    star.style.animationDelay = 120 + i * 180 + 'ms';
    stars.append(star);
  }

  const actions = h('div', { class: 'results__actions' });
  if (failed && hasRecoveryMaterial(getState(), now())) {
    actions.append(
      button({
        label: 'Восстановление',
        sub: 'вернуть жизни на трудных словах',
        tone: 'green',
        size: 'big',
        wide: true,
        onTap: () => {
          closeAll();
          openRecovery();
        },
      }),
      button({ label: 'На карту', tone: 'white', wide: true, onTap: () => pop() }),
    );
  } else {
    actions.append(
      button({ label: 'На карту', tone: 'orange', size: 'big', wide: true, onTap: () => pop() }),
    );
  }

  const lives = computeLives(getState().lives, now());

  const el = h(
    'div',
    { class: 'screen screen--results' + (failed ? ' is-failed' : '') },
    h(
      'div',
      { class: 'results__body' },
      h('div', { class: 'results__section', text: level.sectionTitle }),
      h('h1', {
        class: 'h1 results__title',
        text: failed ? 'Жизни кончились' : starsTitle(result.stars),
      }),
      failed
        ? h('div', { class: 'results__broken' }, icon('heartEmpty'))
        : stars,
      totalCoins > 0 || (extra.gems?.total ?? 0) > 0
        ? h(
            'div',
            { class: 'results__loot' },
            totalCoins > 0
              ? h('div', { class: 'results__coins' }, icon('coin'), h('span', { text: '+' + totalCoins }))
              : null,
            (extra.gems?.total ?? 0) > 0
              ? h(
                  'div',
                  { class: 'results__gems' },
                  icon('gem'),
                  h('span', { text: '+' + (extra.gems?.total ?? 0) }),
                )
              : null,
          )
        : null,
      extra.gems && extra.gems.total > 0
        ? h('div', { class: 'results__gem-why', text: 'Лаъл: ' + gemReason(extra.gems) })
        : null,
      h(
        'div',
        { class: 'results__stats' },
        statRow('target', 'Точность', Math.round(result.accuracy * 100) + '%'),
        statRow('check', 'Верных ответов', result.correct + ' из ' + result.attempts),
        statRow('flame', 'Лучшая серия', result.bestCombo + ' подряд'),
        failed
          ? statRow('heart', 'Жизней осталось', lives.count + ' из ' + lives.max)
          : statRow(
              'coin',
              extra.firstClear ? 'За первое прохождение' : 'За уровень',
              '+' + extra.levelCoins,
            ),
      ),
      failed
        ? h('p', {
            class: 'p results__note',
            text: 'Уровень не засчитан. Верни жизни в «Восстановлении» — там повторяются слова, которые даются труднее всего.',
          })
        : result.mistakes > 0
          ? h('p', {
              class: 'p results__note',
              text: 'Ошибок: ' + result.mistakes + '. Пройди без ошибок — получишь три звезды.',
            })
          : null,
    ),
    actions,
  );

  return { el };
}
