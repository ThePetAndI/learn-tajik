/**
 * Пустой экран-заглушка для разделов, которые появятся на следующих вехах.
 * Лучше честная надпись, чем нерабочая кнопка.
 */

import { h } from '../core/dom';
import type { ScreenView } from '../core/router';
import { icon, type IconName } from '../ui/icons';

export function createStubScreen(
  title: string,
  iconName: IconName,
  text: string,
  cls = '',
): ScreenView {
  const el = h(
    'div',
    { class: 'screen ' + cls },
    h(
      'div',
      { class: 'screen-body' },
      h(
        'div',
        { class: 'empty-state' },
        h('div', { class: 'empty-state__icon' }, icon(iconName)),
        h('h2', { class: 'h2', text: title }),
        h('p', { class: 'p', text }),
      ),
    ),
  );
  return { el };
}
