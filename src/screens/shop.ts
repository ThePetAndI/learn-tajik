/** Магазин: питомцы, скины карты и бустеры. */

import { h, onTap } from '../core/dom';
import { haptics } from '../core/haptics';
import type { ScreenView } from '../core/router';
import { getState, subscribe, update } from '../core/store';
import { rngFor } from '../core/rng';
import { now } from '../core/time';
import {
  activePet,
  activeThemeId,
  boosterCount,
  isOwned,
  itemsOfKind,
  MAX_PET_TIER,
  nextTier,
  petTier,
  SHOP_ITEMS,
  type ShopItem,
} from '../domain/catalog';
import { perksOf } from '../domain/bonuses';
import { buy, canBuy, canUpgradePet, equip, openCase, priceOf, upgradePet } from '../domain/shop';
import { button } from '../ui/button';
import { icon, type IconName } from '../ui/icons';
import { toast } from '../ui/toast';
import { modal } from '../ui/modal';

function isEquipped(item: ShopItem): boolean {
  const state = getState();
  if (item.kind === 'pet') return (activePet(state)?.id ?? '') === item.id;
  if (item.kind === 'theme') return activeThemeId(state) === item.id.replace(/^theme_/, '');
  return false;
}

/** Показывает, что выпало из кейса. Отдельным окном: это маленький праздник. */
function showCaseResult(item: ShopItem, result: { boosters: Record<string, number>; coins: number }): void {
  const rows = Object.entries(result.boosters)
    .map(([id, n]) => ({ item: itemsOfKind('booster').find((b) => b.id === id), n }))
    .filter((r): r is { item: ShopItem; n: number } => Boolean(r.item))
    .sort((a, b) => b.n - a.n);

  const body = h(
    'div',
    { class: 'case-loot' },
    ...rows.map((r) =>
      h(
        'div',
        { class: 'case-loot__row t-' + r.item.tone },
        h('span', { class: 'case-loot__icon' }, icon(r.item.icon as IconName)),
        h('span', { class: 'case-loot__name', text: r.item.title }),
        h('span', { class: 'case-loot__count', text: '×' + r.n }),
      ),
    ),
    h(
      'div',
      { class: 'case-loot__coins' },
      icon('coin'),
      h('span', { text: '+' + result.coins }),
    ),
  );

  haptics.reward();
  modal({
    title: item.title + ' открыт',
    body,
    actions: [{ label: 'Забрать', tone: 'orange', value: 'ok', primary: true }],
  });
}

function priceLabel(item: ShopItem): string {
  // цена со скидкой из дерева: показываем то, что реально спишется
  if (item.kind === 'booster' || item.kind === 'case') return String(priceOf(getState(), item.id));
  if (isEquipped(item)) return 'Надето';
  if (isOwned(getState(), item.id)) return 'Надеть';
  return String(priceOf(getState(), item.id));
}

export function createShopScreen(): ScreenView {
  const cards = new Map<
    string,
    {
      root: HTMLElement;
      action: HTMLButtonElement;
      count: HTMLElement;
      tier?: { row: HTMLElement; pips: HTMLElement; label: HTMLElement; btn: HTMLButtonElement };
    }
  >();

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

      if (item.kind === 'case') {
        if (state.wallet.coins < priceOf(state, item.id)) {
          haptics.wrong();
          toast({ text: 'Не хватает монет', iconName: 'coin', tone: 'bad' });
          return;
        }
        let opened: ReturnType<typeof openCase> = null;
        update((st) => {
          opened = openCase(st, item.id, rngFor('case:' + item.id + ':' + now()), perksOf(st).loot);
        });
        if (opened) showCaseResult(item, opened);
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
      h(
        'div',
        { class: 'shop-card__main' },
        h('span', { class: 'shop-card__icon' }, icon(item.icon as IconName)),
        h(
          'div',
          { class: 'shop-card__text' },
          h('div', { class: 'shop-card__title' }, h('span', { text: item.title }), count),
          h('div', { class: 'shop-card__desc', text: item.description }),
        ),
        h('div', { class: 'shop-card__buy' }, action),
      ),
    );

    // ——— строка прокачки: только у питомцев и только после покупки ———
    let tier: { row: HTMLElement; pips: HTMLElement; label: HTMLElement; btn: HTMLButtonElement } | undefined;
    if (item.kind === 'pet' && item.tiers) {
      const pips = h('span', { class: 'pet-tier__pips' });
      const label = h('span', { class: 'pet-tier__label' });
      const btn = button({ tone: 'purple', size: 'sm', label: '', icon: 'coin' });
      onTap(btn, () => {
        const check = canUpgradePet(getState(), item.id);
        if (check === 'not-enough-coins') {
          haptics.wrong();
          toast({ text: 'Не хватает монет', iconName: 'coin', tone: 'bad' });
          return;
        }
        if (check !== 'ok') return;
        let gained = '';
        update((st) => {
          const next = nextTier(st, item.id);
          gained = next?.label ?? '';
          upgradePet(st, item.id, now());
        });
        haptics.reward();
        toast({ text: item.title + ': ' + gained, iconName: 'sparkle', tone: 'gold' });
      });
      const row = h('div', { class: 'pet-tier' }, pips, label, btn);
      root.append(row);
      tier = { row, pips, label, btn };
    }

    cards.set(item.id, { root, action, count, tier });
    return root;
  }

  function section(title: string, kind: ShopItem['kind']): HTMLElement {
    return h(
      'section',
      { class: 'panel shop-section' },
      h('div', { class: 'panel__title', text: title }),
      ...itemsOfKind(kind).map(makeCard),
    );
  }

  function refresh(): void {
    const state = getState();
    for (const item of SHOP_ITEMS) {
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

      if (refs.tier) {
        // прокачка появляется только у купленного питомца: у чужого она бессмысленна
        refs.tier.row.classList.toggle('hidden', !owned);
        const tier = petTier(state, item.id);
        refs.tier.pips.replaceChildren(
          ...Array.from({ length: MAX_PET_TIER }, (_, i) =>
            h('span', { class: 'pet-tier__pip' + (i < tier ? ' is-on' : '') }),
          ),
        );
        const next = nextTier(state, item.id);
        refs.tier.label.textContent = next ? next.label : 'максимум';
        refs.tier.btn.classList.toggle('hidden', !next);
        const price = refs.tier.btn.querySelector('.btn__label');
        if (price) price.textContent = next ? String(next.price) : '';
        refs.tier.btn.disabled = canUpgradePet(state, item.id) === 'maxed';
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
      section('Сундуки', 'case'),
      h('p', {
        class: 'p shop-note',
        text:
          'Бонус питомца действует сразу, как только вы его наденете. Активен один питомец, ' +
          'но прокачивать можно всех. Сундук отдаёт бустеров больше, чем стоит, — но какие ' +
          'именно, решает случай.',
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
