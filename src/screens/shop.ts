/**
 * Магазин. Две половины:
 *  «Лавка»   — вид карты, бустеры и сундуки с бустерами;
 *  «Питомцы» — питомцы, их ступени и снаряжение (screens/pets.ts).
 *
 * Питомцы ушли в отдельную половину, когда у них появился наряд: сцена
 * с питомцем в полный рост, слоты и инвентарь не помещаются в строчку
 * списка, а в общем списке с бустерами они терялись.
 */

import { h, onTap } from '../core/dom';
import { haptics } from '../core/haptics';
import type { ScreenView } from '../core/router';
import { getState, subscribe, update } from '../core/store';
import { rngFor } from '../core/rng';
import { now } from '../core/time';
import { perksOf } from '../domain/bonuses';
import {
  activeThemeId,
  boosterCount,
  isOwned,
  itemsOfKind,
  type ShopItem,
  type ShopKind,
} from '../domain/catalog';
import { buy, canBuy, equip, openCase, priceOf, type CaseResult } from '../domain/shop';
import { button } from '../ui/button';
import { icon, type IconName } from '../ui/icons';
import { modal } from '../ui/modal';
import { toast } from '../ui/toast';
import { createPetsView } from './pets';

type Segment = 'store' | 'pets';

function isEquipped(item: ShopItem): boolean {
  return item.kind === 'theme' && activeThemeId(getState()) === item.id.replace(/^theme_/, '');
}

/** Показывает, что выпало из сундука. Отдельным окном: это маленький праздник. */
function showCaseResult(item: ShopItem, result: CaseResult): void {
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
    h('div', { class: 'case-loot__coins' }, icon('coin'), h('span', { text: '+' + result.coins })),
  );

  haptics.reward();
  modal({
    title: item.title + ' открыт',
    body,
    actions: [{ label: 'Забрать', tone: 'orange', value: 'ok', primary: true }],
  });
}

function priceLabel(item: ShopItem): string {
  if (item.kind === 'theme') {
    if (isEquipped(item)) return 'Надето';
    if (isOwned(getState(), item.id)) return 'Надеть';
  }
  // цена со скидкой из дерева: показываем то, что реально спишется
  return String(priceOf(getState(), item.id));
}

function poor(): void {
  haptics.wrong();
  toast({ text: 'Не хватает монет', iconName: 'coin', tone: 'bad' });
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

      if (item.kind === 'theme' && isOwned(state, item.id)) {
        if (isEquipped(item)) return;
        update((s) => {
          equip(s, item.id, now());
        });
        haptics.reward();
        toast({ text: item.title + ' — надето', iconName: 'check', tone: 'good' });
        return;
      }

      if (item.kind === 'case') {
        if (state.wallet.coins < priceOf(state, item.id)) return poor();
        let opened: CaseResult | null = null;
        update((st) => {
          opened = openCase(st, item.id, rngFor('case:' + item.id + ':' + now()), perksOf(st).loot);
        });
        if (opened) showCaseResult(item, opened);
        return;
      }

      const check = canBuy(state, item.id);
      if (check === 'not-enough-coins') return poor();
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
    cards.set(item.id, { root, action, count });
    return root;
  }

  function section(title: string, kind: ShopKind): HTMLElement {
    return h(
      'section',
      { class: 'panel shop-section' },
      h('div', { class: 'panel__title', text: title }),
      ...itemsOfKind(kind).map(makeCard),
    );
  }

  function refreshStore(): void {
    const state = getState();
    for (const [id, refs] of cards) {
      const item = itemsOfKind('theme').concat(itemsOfKind('booster'), itemsOfKind('case')).find((i) => i.id === id);
      if (!item) continue;
      const owned = item.kind === 'theme' && isOwned(state, id);
      const equipped = isEquipped(item);
      refs.root.classList.toggle('is-owned', owned);
      refs.root.classList.toggle('is-equipped', equipped);

      const label = refs.action.querySelector('.btn__label');
      if (label) label.textContent = priceLabel(item);
      refs.action.classList.remove('t-orange', 't-green', 't-lock');
      refs.action.classList.add(equipped ? 't-lock' : owned ? 't-green' : 't-orange');
      refs.action.disabled = equipped;
      // монету показываем только там, где на кнопке цена
      const coin = refs.action.querySelector('.icon');
      if (coin) (coin as SVGElement).classList.toggle('hidden', owned);

      if (item.kind === 'booster') {
        const have = id === 'freeze' ? state.streak.freezes : boosterCount(state, id);
        refs.count.textContent = have > 0 ? '×' + have : '';
      }
    }
  }

  /* ——————————————— половины ——————————————— */

  const store = h(
    'div',
    { class: 'shop-store' },
    section('Вид карты', 'theme'),
    section('Бустеры', 'booster'),
    section('Сундуки с бустерами', 'case'),
    h('p', {
      class: 'p shop-note',
      text:
        'Сундук с бустерами отдаёт больше, чем стоит, — но какие именно бустеры, решает случай. ' +
        'Питомцы и их снаряжение — во второй половине магазина.',
    }),
  );
  const pets = createPetsView();

  let segment: Segment = 'pets';
  const segButtons = new Map<Segment, HTMLButtonElement>();
  const body = h('div', { class: 'screen-body' });

  function show(next: Segment): void {
    segment = next;
    for (const [id, btn] of segButtons) {
      btn.classList.toggle('is-active', id === next);
      btn.setAttribute('aria-selected', id === next ? 'true' : 'false');
    }
    body.replaceChildren(next === 'store' ? store : pets.el);
    body.scrollTop = 0;
    if (next === 'store') refreshStore();
    else pets.refresh();
  }

  const segBar = h(
    'div',
    { class: 'segbar', aria: { role: 'tablist' } },
    ...(
      [
        ['pets', 'Питомцы', 'paw'],
        ['store', 'Лавка', 'shop'],
      ] as [Segment, string, IconName][]
    ).map(([id, label, ic]) => {
      const btn = h(
        'button',
        { class: 'segbar__btn', attr: { type: 'button' }, aria: { role: 'tab' } },
        icon(ic),
        h('span', { text: label }),
      );
      onTap(btn, () => {
        if (segment === id) return;
        haptics.tap();
        show(id);
      });
      segButtons.set(id, btn);
      return btn;
    }),
  );

  const el = h(
    'div',
    { class: 'screen screen--shop' },
    h(
      'header',
      { class: 'topbar topbar--seg' },
      h('div', { class: 'topbar__title', text: 'Магазин' }),
      segBar,
    ),
    body,
  );

  const unsub = subscribe(() => {
    if (segment === 'store') refreshStore();
  });
  show('pets');

  return {
    el,
    onShow: () => (segment === 'store' ? refreshStore() : pets.refresh()),
    destroy: () => {
      unsub();
      pets.destroy();
    },
  };
}
