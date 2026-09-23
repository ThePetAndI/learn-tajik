/**
 * Товар дня: каждый день в лавке три предложения со скидкой.
 *
 * Набор выбирается по дате, а не случайно при каждом открытии: перезапуск
 * его не меняет, перебирать нечего. Каждое предложение продаётся один раз
 * в день. Скидка — 30%, ветка Савдо добавляет сверху и открывает ещё
 * прилавки. Предложения, которые добавляет дерево, дописываются в конец
 * списка — уже показанные при этом не меняются.
 */

import type { Rng } from '../core/rng';
import { rngFor } from '../core/rng';
import { dayKey } from '../core/time';
import type { SaveState } from '../data/state';
import { applyPerks, perksOf } from './bonuses';
import { allPets, getItem, isOwned, type ShopItem } from './catalog';
import { FOODS, getFood, type Food } from './foods';
import { openGearChest, type GearDrop } from './gear';
import { GEAR_CHESTS } from './gear-items';
import { canFeed, feed } from './meals';
import { PET_CHESTS, giveCopy, openPetChest, type PetDrop } from './pets';
import type { Rarity } from './rarity';

export type DealKind = 'nest' | 'gear' | 'shards' | 'food' | 'copy' | 'hints' | 'freeze' | 'refill';

/** Порядок здесь не важен: на каждый день он перемешивается. */
export const DEAL_KINDS: readonly DealKind[] = ['nest', 'gear', 'shards', 'food', 'copy', 'hints', 'freeze', 'refill'];

/** Прилавков без дерева. */
export const BASE_DEALS = 3;
/** Скидка без дерева. */
export const BASE_DEAL_DISCOUNT = 0.3;

const SHARDS_PACK = 30;
const SHARDS_PRICE = 240;
const HINTS_PACK = 5;
/** Копия питомца: чем реже зверь, тем дороже. */
const COPY_PRICE: Record<Rarity, number> = { common: 450, rare: 900, epic: 1800, legendary: 3600 };

export interface Deal {
  /** 'nest', 'food:food_osh', 'copy:pet_cat' — ключ для экрана. */
  id: string;
  /**
   * Покупка помнится по виду, а не по id: питомец в «копии» зависит от того,
   * кто уже есть, и с новым питомцем посреди дня id сменился бы — а купить
   * копию второй раз за день нельзя.
   */
  kind: DealKind;
  title: string;
  about: string;
  icon: string;
  tone: string;
  /** Обычная цена в монетах. */
  base: number;
  /** Цена сегодня. */
  price: number;
  /** Угощение или питомец, о котором речь. */
  food?: Food;
  pet?: ShopItem;
}

/** Скидка товара дня этому игроку: 30% и поверх — ветка Савдо. */
export function dealDiscount(state: SaveState): number {
  return 1 - (1 - BASE_DEAL_DISCOUNT) * (1 - perksOf(state).dealDiscount);
}

/** Цены круглые — до пяти монет: «343» в лавке выглядит как ошибка. */
function discounted(base: number, discount: number): number {
  return Math.max(5, Math.round((base * (1 - discount)) / 5) * 5);
}

/** Перемешивает копию массива: одна и та же перестановка на одно и то же rng. */
function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

function makeDeal(state: SaveState, kind: DealKind, day: string, discount: number): Deal | null {
  const deal = (d: Omit<Deal, 'price'>): Deal => ({ ...d, price: discounted(d.base, discount) });
  switch (kind) {
    case 'nest': {
      const chest = PET_CHESTS.find((c) => c.coins > 0);
      if (!chest) return null;
      return deal({ id: 'nest', kind, title: chest.title, about: 'Один питомец любой редкости', icon: 'nest', tone: 'orange', base: chest.coins });
    }
    case 'gear': {
      const chest = GEAR_CHESTS.find((c) => c.coins > 0 && c.gems === 0);
      if (!chest) return null;
      return deal({ id: 'gear', kind, title: chest.title, about: chest.about, icon: 'chest', tone: 'blue', base: chest.coins });
    }
    case 'shards':
      return deal({
        id: 'shards', kind, title: SHARDS_PACK + ' осколков', about: 'На улучшение снаряжения',
        icon: 'shards', tone: 'purple', base: SHARDS_PRICE,
      });
    case 'food': {
      // своё зерно у каждого выбора: добавленный деревом прилавок не меняет угощение
      const food = FOODS[Math.floor(rngFor('deals:' + day + ':food')() * FOODS.length)];
      if (!food) return null;
      return deal({
        id: 'food:' + food.id, kind, title: food.tg + ' — ' + food.ru, about: 'Угощение для питомца',
        icon: food.icon, tone: food.tone, base: food.price, food,
      });
    }
    case 'copy': {
      // только знакомые питомцы: копия чужого зверя бесполезна
      const owned = allPets().filter((p) => isOwned(state, p.id));
      const pet = owned[Math.floor(rngFor('deals:' + day + ':copy')() * owned.length)];
      if (!pet) return null;
      return deal({
        id: 'copy:' + pet.id, kind, title: 'Копия: ' + pet.title, about: 'Для звезды питомца',
        icon: 'paw', tone: pet.tone, base: COPY_PRICE[pet.rarity ?? 'common'], pet,
      });
    }
    case 'hints': {
      const hint = getItem('hint');
      return deal({
        id: 'hints', kind, title: HINTS_PACK + ' подсказок', about: 'Открывают букву в колесе',
        icon: 'bulb', tone: 'gold', base: (hint?.price ?? 20) * HINTS_PACK,
      });
    }
    case 'freeze': {
      const item = getItem('freeze');
      return deal({
        id: 'freeze', kind, title: item?.title ?? 'Заморозка стрика', about: 'Прикрывает пропущенный день',
        icon: 'sparkle', tone: 'blue', base: item?.price ?? 120,
      });
    }
    case 'refill': {
      const item = getItem('refill');
      return deal({
        id: 'refill', kind, title: item?.title ?? 'Полный запас жизней', about: 'Тратится, когда жизни кончатся',
        icon: 'heart', tone: 'red', base: item?.price ?? 100,
      });
    }
  }
}

/** Товары дня для этого игрока на этот день. */
export function dealsFor(state: SaveState, ts: number): Deal[] {
  const day = dayKey(ts);
  const order = shuffled(DEAL_KINDS, rngFor('deals:' + day));
  const count = Math.min(order.length, BASE_DEALS + perksOf(state).dealSlots);
  const discount = dealDiscount(state);
  const out: Deal[] = [];
  for (const kind of order.slice(0, count)) {
    const deal = makeDeal(state, kind, day, discount);
    if (deal) out.push(deal);
  }
  return out;
}

export function isDealBought(state: SaveState, kind: DealKind, ts: number): boolean {
  return state.daily.dealDay === dayKey(ts) && state.daily.dealsBought.includes(kind);
}

export type DealCheck = 'ok' | 'no-such-deal' | 'bought' | 'eating' | 'not-enough-coins';

export function canBuyDeal(state: SaveState, id: string, ts: number): DealCheck {
  const deal = dealsFor(state, ts).find((d) => d.id === id);
  if (!deal) return 'no-such-deal';
  if (isDealBought(state, deal.kind, ts)) return 'bought';
  if (deal.food && canFeed(state, deal.food.id, deal.price) === 'eating') return 'eating';
  if (state.wallet.coins < deal.price) return 'not-enough-coins';
  return 'ok';
}

/** Что досталось по товару дня — экран покажет это так же, как обычную покупку. */
export type DealResult =
  | { kind: 'nest'; drop: PetDrop }
  | { kind: 'gear'; drops: GearDrop[] }
  | { kind: 'food'; food: Food }
  | { kind: 'copy'; pet: ShopItem }
  | { kind: 'shards' | 'hints' | 'freeze' | 'refill'; n: number };

/** Покупает товар дня. null — купить нельзя, и ничего не изменилось. */
export function buyDeal(state: SaveState, id: string, rng: Rng, ts: number): DealResult | null {
  if (canBuyDeal(state, id, ts) !== 'ok') return null;
  const deal = dealsFor(state, ts).find((d) => d.id === id) as Deal;
  const pay = { coins: deal.price, gems: 0 };

  let result: DealResult | null = null;
  switch (deal.kind) {
    case 'nest': {
      const chest = PET_CHESTS.find((c) => c.coins > 0);
      const drop = chest ? openPetChest(state, chest.id, rng, ts, pay) : null;
      if (drop) result = { kind: 'nest', drop };
      break;
    }
    case 'gear': {
      const chest = GEAR_CHESTS.find((c) => c.coins > 0 && c.gems === 0);
      const drops = chest ? openGearChest(state, chest.id, rng, ts, pay) : null;
      if (drops) result = { kind: 'gear', drops };
      break;
    }
    case 'food': {
      const food = deal.food ? getFood(deal.food.id) : undefined;
      if (food && feed(state, food.id, ts, deal.price) === 'ok') result = { kind: 'food', food };
      break;
    }
    case 'copy': {
      if (deal.pet && state.wallet.coins >= deal.price && giveCopy(state, deal.pet.id, ts)) {
        state.wallet.coins -= deal.price;
        result = { kind: 'copy', pet: deal.pet };
      }
      break;
    }
    case 'shards':
      state.wallet.coins -= deal.price;
      state.inventory.shards += SHARDS_PACK;
      result = { kind: 'shards', n: SHARDS_PACK };
      break;
    case 'hints':
      state.wallet.coins -= deal.price;
      state.inventory.items['hint'] = (state.inventory.items['hint'] ?? 0) + HINTS_PACK;
      result = { kind: 'hints', n: HINTS_PACK };
      break;
    case 'freeze':
      state.wallet.coins -= deal.price;
      state.streak.freezes = Math.min(99, state.streak.freezes + 1);
      result = { kind: 'freeze', n: 1 };
      break;
    case 'refill':
      state.wallet.coins -= deal.price;
      state.inventory.items['refill'] = (state.inventory.items['refill'] ?? 0) + 1;
      result = { kind: 'refill', n: 1 };
      break;
  }
  if (!result) return null;

  // покупка помнится до полуночи: новый день — новый список
  const day = dayKey(ts);
  if (state.daily.dealDay !== day) {
    state.daily.dealDay = day;
    state.daily.dealsBought = [];
  }
  state.daily.dealsBought.push(deal.kind);
  state.stats.deals += 1;
  applyPerks(state, ts);
  return result;
}
