/** Нижний таб-бар: Магазин, Карта, Слова, Профиль. */

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
  { id: 'map', label: 'Карта', iconName: 'map' },
  { id: 'words', label: 'Слова', iconName: 'book' },
  { id: 'profile', label: 'Профиль', iconName: 'user' },
];

export interface TabBarHandle {
  el: HTMLElement;
  setActive: (id: TabId) => void;
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
      h('span', { class: 'tab__icon' }, icon(t.iconName)),
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

  const unsub = onTabChange(setActive);

  return {
    el,
    setActive,
    destroy: () => {
      unsub();
      el.remove();
    },
  };
}
