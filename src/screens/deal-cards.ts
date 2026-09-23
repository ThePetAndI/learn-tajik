/**
 * Товар дня — первая полка лавки.
 *
 * Три предложения со скидкой (больше — с веткой Савдо), каждое продаётся
 * один раз в день. Рядом — зачёркнутая обычная цена: скидку должно быть
 * видно, а не верить на слово. Лона и сундук по товару дня открываются так
 * же, как купленные обычным путём, — с тем же яйцом и теми же вещами.
 */

import { h, onTap } from '../core/dom';
import { haptics } from '../core/haptics';
import { rngFor } from '../core/rng';
import { getState, update } from '../core/store';
import { now } from '../core/time';
import { activePet } from '../domain/catalog';
import { buyDeal, canBuyDeal, dealDiscount, dealsFor, type Deal, type DealResult } from '../domain/deals';
import { button } from '../ui/button';
import { icon, type IconName } from '../ui/icons';
import { breedOf, petFace } from '../ui/pet';
import { toast } from '../ui/toast';
import { foodWords } from './food-cards';
import { showDrops } from './gear-cards';
import { showPetDrop } from './pet-cards';
import { poorToast } from './shop-bits';

/** До полуночи: «5 ч 12 мин», «40 мин». */
function untilMidnight(ts: number): string {
  const d = new Date(ts);
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
  const min = Math.max(1, Math.ceil((next - ts) / 60_000));
  const hours = Math.floor(min / 60);
  return hours > 0 ? hours + ' ч ' + (min % 60) + ' мин' : min + ' мин';
}

function announce(deal: Deal, got: DealResult): void {
  switch (got.kind) {
    case 'nest':
      showPetDrop(got.drop, 'Товар дня');
      return;
    case 'gear':
      showDrops('Товар дня', got.drops);
      return;
    case 'food': {
      const pet = activePet(getState());
      toast({
        text: (pet?.title ?? 'Питомец') + ' ест ' + got.food.tg + ': ' + foodWords(getState(), got.food),
        iconName: got.food.icon as IconName,
        tone: 'gold',
        ms: 3000,
      });
      return;
    }
    case 'copy':
      toast({ text: '+1 копия: ' + got.pet.title, iconName: 'paw', tone: 'gold' });
      return;
    default:
      toast({ text: deal.title + ' — ваше', iconName: deal.icon as IconName, tone: 'gold' });
  }
}

function dealCard(deal: Deal): HTMLElement {
  const state = getState();
  const ts = now();
  const check = canBuyDeal(state, deal.id, ts);
  const off = Math.round((1 - deal.price / deal.base) * 100);

  const action = button({
    label: check === 'bought' ? 'Куплено' : check === 'eating' ? 'Питомец ест' : String(deal.price),
    icon: check === 'bought' || check === 'eating' ? undefined : 'coin',
    tone: check === 'ok' ? 'orange' : 'lock',
    size: 'sm',
    disabled: check === 'bought',
  });
  onTap(action, () => {
    const c = canBuyDeal(getState(), deal.id, now());
    if (c === 'not-enough-coins') return poorToast('coins');
    if (c === 'eating') {
      haptics.wrong();
      toast({ text: 'Питомец ещё ест — новое угощение, когда доест', iconName: 'non', tone: 'bad' });
      return;
    }
    if (c !== 'ok') return;
    let got: DealResult | null = null;
    update((s) => {
      got = buyDeal(s, deal.id, rngFor('deal:' + deal.id + ':' + now()), now());
    });
    if (!got) return;
    haptics.reward();
    announce(deal, got);
  });

  // у копии вместо значка — лицо самого питомца: так видно, чья звезда
  const art = deal.pet
    ? h('span', { class: 'deal__icon deal__icon--pet t-' + deal.tone }, petFace(breedOf(deal.pet.id)))
    : h('span', { class: 'deal__icon t-' + deal.tone }, icon(deal.icon as IconName));

  return h(
    'div',
    { class: 'deal' + (check === 'bought' ? ' is-bought' : ''), data: { deal: deal.id } },
    art,
    h(
      'div',
      { class: 'deal__text' },
      h('div', { class: 'deal__title', text: deal.title }),
      h('div', { class: 'deal__about', text: deal.about }),
      h(
        'div',
        { class: 'deal__prices' },
        h('span', { class: 'deal__old', text: String(deal.base) }),
        h('span', { class: 'deal__off', text: '−' + off + '%' }),
      ),
    ),
    action,
  );
}

export interface DealsPanel {
  el: HTMLElement;
  refresh: () => void;
}

export function createDealsPanel(): DealsPanel {
  const timer = h('span', { class: 'deals__timer' });
  const list = h('div', { class: 'deals' });
  const note = h('p', { class: 'p gnote' });
  const el = h(
    'section',
    { class: 'panel', data: { panel: 'deals' } },
    h('div', { class: 'panel__head' }, h('div', { class: 'panel__title', text: 'Товар дня' }), timer),
    list,
    note,
  );

  function refresh(): void {
    const state = getState();
    const ts = now();
    timer.replaceChildren(icon('clock'), h('span', { text: untilMidnight(ts) }));
    list.replaceChildren(...dealsFor(state, ts).map(dealCard));
    note.textContent =
      'Скидка ' + Math.round(dealDiscount(state) * 100) + '%, каждый товар — один раз в день. ' +
      'В полночь полка обновляется; ветка Савдо в дереве Бозор даёт скидку больше и новые товары.';
  }

  return { el, refresh };
}
