/** Магазин: питомцы, скины карты и бустеры. */

import { h, onTap } from '../core/dom';
import { haptics } from '../core/haptics';
import type { ScreenView } from '../core/router';
import { getState, subscribe, update } from '../core/store';
import { now } from '../core/time';
import {
  activePet,
  activeThemeId,
  boosterCount,
  buy,
  canBuy,
  equip,
  isOwned,
  itemsOfKind,
  type ShopItem,
} from '../domain/shop';
import { button } from '../ui/button';
import { icon, type IconName } from '../ui/icons';
import { toast } from '../ui/toast';

function isEquipped(item: ShopItem): boolean {
  const state = getState();
  if (item.kind === 'pet') return (activePet(state)?.id ?? '') === item.id;
  if (item.kind === 'theme') return activeThemeId(state) === item.id.replace(/^theme_/, '');
  return false;
}

function priceLabel(item: ShopItem): string {
  if (item.kind === 'booster') return String(item.price);
  if (isEquipped(item)) return 'Надето';
  if (isOwned(getState(), item.id)) return 'Надеть';
  return String(item.price);
}

export function createShopScreen(): ScreenView {
  const cards = new Map<string, { root: HTMLElement; action: HTMLButtonElement; count: HTMLElement }>();

  function makeCard(item: ShopItem): HTMLElement {
    const count = h('span', { class: 'shop-card__count' });
    // монета живёт внутри кнопки: отдельный глиф сбоку выглядел так,
    // будто иконка отвалилась от кнопки
    const action = button({ tone: 'orange', size: 'sm', label: priceLabel(item), icon: 'coin' });

    onTap(action, () => {
      const state = getState();
      const owned = isOwned(state, item.id);

      if (item.kind !== 'booster' && owned) {
        if (isEquipped(item)) return;
        update((s) => {
          equip(s, item.id, now());
        });
        haptics.reward();
        toast({ text: item.title + ' — надето', iconName: 'check', tone: 'good' });
        return;
      }

      const check = canBuy(state, item.id);
      if (check === 'not-enough-coins') {
        haptics.wrong();
        toast({ text: 'Не хватает монет', iconName: 'coin', tone: 'bad' });
        return;
      }
      if (check !== 'ok') return;

      update((s) => {
        buy(s, item.id, now());
      });
      haptics.reward();
      toast({
        text: item.kind === 'booster' ? item.title + ' куплена' : item.title + ' теперь ваш',
        iconName: 'sparkle',
        tone: 'gold',
      });
    });

    const root = h(
      'div',
      { class: 'shop-card t-' + item.tone, data: { item: item.id } },
      h('span', { class: 'shop-card__icon' }, icon(item.icon as IconName)),
      h(
        'div',
        { class: 'shop-card__text' },
        h('div', { class: 'shop-card__title' }, h('span', { text: item.title }), count),
        h('div', { class: 'shop-card__desc', text: item.description }),
      ),
      h('div', { class: 'shop-card__buy' }, action),
    );

    cards.set(item.id, { root, action, count });
    return root;
  }

  function section(title: string, kind: 'pet' | 'theme' | 'booster'): HTMLElement {
    return h(
      'section',
      { class: 'panel shop-section' },
      h('div', { class: 'panel__title', text: title }),
      ...itemsOfKind(kind).map(makeCard),
    );
  }

  function refresh(): void {
    const state = getState();
    for (const item of [...itemsOfKind('pet'), ...itemsOfKind('theme'), ...itemsOfKind('booster')]) {
      const refs = cards.get(item.id);
      if (!refs) continue;
      const owned = isOwned(state, item.id);
      const equipped = isEquipped(item);

      refs.root.classList.toggle('is-owned', owned && item.kind !== 'booster');
      refs.root.classList.toggle('is-equipped', equipped);

      const label = refs.action.querySelector('.btn__label');
      if (label) label.textContent = priceLabel(item);

      refs.action.classList.remove('t-orange', 't-green', 't-lock');
      if (equipped) refs.action.classList.add('t-lock');
      else if (owned && item.kind !== 'booster') refs.action.classList.add('t-green');
      else refs.action.classList.add('t-orange');
      refs.action.disabled = equipped;

      // монету показываем только там, где на кнопке цена
      const coinIcon = refs.action.querySelector('.icon');
      if (coinIcon) {
        (coinIcon as SVGElement).classList.toggle('hidden', item.kind !== 'booster' && owned);
      }

      if (item.kind === 'booster') {
        const have = item.id === 'freeze' ? state.streak.freezes : boosterCount(state, item.id);
        refs.count.textContent = have > 0 ? '×' + have : '';
      } else {
        refs.count.textContent = '';
      }
    }
  }

  const el = h(
    'div',
    { class: 'screen screen--shop' },
    h(
      'header',
      { class: 'topbar' },
      h('div', { class: 'topbar__spacer' }),
      h('div', { class: 'topbar__title', text: 'Магазин' }),
      h('div', { class: 'topbar__spacer' }),
    ),
    h(
      'div',
      { class: 'screen-body' },
      section('Питомцы', 'pet'),
      section('Вид карты', 'theme'),
      section('Бустеры', 'booster'),
      h('p', {
        class: 'p shop-note',
        text: 'Бонус питомца действует сразу, как только вы его наденете. Активен один питомец.',
      }),
    ),
  );

  const unsub = subscribe(refresh);
  refresh();

  return {
    el,
    onShow: refresh,
    destroy: () => unsub(),
  };
}
