/**
 * Карточка уровня — то, что открывается по тапу на узел карты.
 * Запуск уровня отдан наружу через setLevelStartHandler: карта не знает
 * про движок упражнений, движок не знает про карту.
 */

import { h } from '../core/dom';
import { getState } from '../core/store';
import { now } from '../core/time';
import { computeLives } from '../domain/lives';
import type { FlatLevel } from '../data/content';
import { getLevelProgress } from '../domain/progress';
import { MAX_STARS } from '../domain/stars';
import { button } from '../ui/button';
import { icon } from '../ui/icons';
import { modal } from '../ui/modal';
import { plural } from '../core/time';

type StartHandler = (level: FlatLevel) => void;

let startHandler: StartHandler | null = null;
let livesGate: (() => void) | null = null;

/** Что показать, когда жизней нет. Подключается в app.ts. */
export function setLivesGate(fn: (() => void) | null): void {
  livesGate = fn;
}

/** Движок упражнений подключается сюда на вехе 3. */
export function setLevelStartHandler(fn: StartHandler | null): void {
  startHandler = fn;
}

function starRow(earned: number): HTMLElement {
  const row = h('div', { class: 'level-card__stars' });
  for (let i = 0; i < MAX_STARS; i++) {
    const cls = i < earned ? 'is-on' : 'is-off';
    const wrap = h('span', { class: 'level-card__star ' + cls }, icon(i < earned ? 'star' : 'starEmpty'));
    wrap.style.animationDelay = i * 90 + 'ms';
    row.append(wrap);
  }
  return row;
}

export function openLevelCard(level: FlatLevel): void {
  const progress = getLevelProgress(getState(), level.id);
  const done = progress.stars > 0;

  const wordCount = level.wordIds.length;
  const phraseCount = level.phraseIds.length;
  const bits: string[] = [];
  if (wordCount > 0) bits.push(wordCount + ' ' + plural(wordCount, 'слово', 'слова', 'слов'));
  if (phraseCount > 0) bits.push(phraseCount + ' ' + plural(phraseCount, 'фраза', 'фразы', 'фраз'));
  if (level.kind === 'alphabet') bits.push('буквы алфавита');

  const body = h(
    'div',
    { class: 'level-card' },
    h(
      'div',
      { class: 'level-card__badge' + (level.boss ? ' is-boss' : '') },
      level.boss ? icon('chest') : h('span', { text: String(level.index + 1) }),
    ),
    h('div', { class: 'level-card__section', text: level.sectionTitle }),
    h('h2', { class: 'h2 level-card__title', text: level.title }),
    starRow(progress.stars),
    bits.length > 0
      ? h('div', { class: 'level-card__meta', text: bits.join(' · ') })
      : null,
    level.boss
      ? h('div', { class: 'level-card__boss' }, icon('sparkle'), h('span', { text: 'Сундук за раздел' }))
      : null,
  );

  const m = modal({ body, closeButton: true, class: 'modal__card--level' });

  const actions = h('div', { class: 'modal__actions' });
  if (!level.playable) {
    actions.append(
      h('p', {
        class: 'p level-card__note',
        text: 'Для этого уровня ещё не написаны слова — они появятся вместе с контентом курса.',
      }),
      button({ label: 'Понятно', tone: 'white', wide: true, onTap: () => m.close(null) }),
    );
  } else {
    actions.append(
      button({
        label: done ? 'Повторить' : 'Начать',
        tone: done ? 'green' : 'orange',
        size: 'big',
        wide: true,
        onTap: () => {
          m.close('start');
          // без жизней уровень не начинаем: сначала предложим восстановление
          if (computeLives(getState().lives, now()).count <= 0) {
            livesGate?.();
            return;
          }
          startHandler?.(level);
        },
      }),
    );
  }
  body.append(actions);
}
