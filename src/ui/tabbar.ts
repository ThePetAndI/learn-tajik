/**
 * Нижний таб-бар: Магазин, Древо, Карта, Слова, Профиль.
 * Карта — посередине: это главный экран, и до центра большой палец
 * дотягивается проще всего.
 */

import { h, onTap } from '../core/dom';
import { haptics } from '../core/haptics';
import { onTabChange, showTab, type TabId } from '../core/router';
import { icon, type IconName } from './icons';

interface TabDef {
  id: TabId;
  label: string;
  iconName: IconName;
}

const TABS: TabDef[] = [
  { id: 'shop', label: 'Магазин', iconName: 'shop' },
  { id: 'tree', label: 'Древо', iconName: 'tree' },
  { id: 'map', label: 'Карта', iconName: 'map' },
  { id: 'words', label: 'Слова', iconName: 'book' },
  { id: 'profile', label: 'Профиль', iconName: 'user' },
];

export interface TabBarHandle {
  el: HTMLElement;
  setActive: (id: TabId) => void;
  /** Точка на вкладке: там что-то ждёт — например, награда коллекции. */
  setDot: (id: TabId, on: boolean) => void;
  destroy: () => void;
}

export function createTabBar(): TabBarHandle {
  const buttons = new Map<TabId, HTMLElement>();

  const items = TABS.map((t) => {
    const btn = h(
      'button',
      {
        class: 'tab',
        attr: { type: 'button' },
        data: { tab: t.id },
        aria: { label: t.label },
      },
      h('span', { class: 'tab__icon' }, icon(t.iconName), h('span', { class: 'tab__dot' })),
      h('span', { class: 'tab__label', text: t.label }),
    );
    onTap(btn, () => {
      haptics.tap();
      showTab(t.id);
    });
    buttons.set(t.id, btn);
    return btn;
  });

  const el = h('nav', { class: 'tabbar', aria: { role: 'tablist', label: 'Разделы' } }, ...items);

  function setActive(id: TabId): void {
    for (const [tabId, btn] of buttons) {
      const active = tabId === id;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    }
  }

  function setDot(id: TabId, on: boolean): void {
    buttons.get(id)?.classList.toggle('has-dot', on);
  }

  const unsub = onTabChange(setActive);

  return {
    el,
    setActive,
    setDot,
    destroy: () => {
      unsub();
      el.remove();
    },
  };
}
