/**
 * Покупки: питомцы, скины карты, бустеры, сундуки с бустерами, ступени питомцев.
 *
 * Что продаётся — в catalog.ts, сколько даёт — в bonuses.ts. Здесь только то,
 * что меняет состояние. После всего, что меняет бонусы, зовётся applyPerks:
 * купленный пёс сторожит жизнь сразу, а не со следующего запуска.
 */

import type { Rng } from '../core/rng';
import type { SaveState } from '../data/state';
import { applyPerks, shopPrice } from './bonuses';
import {
  boosterCount,
  getItem,
  isOwned,
  itemsOfKind,
  nextTier,
  petTier,
  type PetTier,
  type ShopItem,
} from './catalog';

/* ————————————————————————— покупка ————————————————————————— */

export type BuyResult = 'ok' | 'no-such-item' | 'already-owned' | 'chest-only' | 'not-enough-coins';

/** Сколько предмет стоит этому игроку — со скидкой из дерева. */
export function priceOf(state: SaveState, id: string): number {
  const item = getItem(id);
  return item ? shopPrice(state, item.price) : 0;
}

export function canBuy(state: SaveState, id: string): BuyResult {
  const item = getItem(id);
  if (!item) return 'no-such-item';
  // питомцы из лона не продаются: цена у них в каталоге 0, и без этой проверки
  // их можно было бы «купить» даром
  if (item.chestOnly) return 'chest-only';
  // бустеры покупаются сколько угодно раз, остальное — один
  if (item.kind !== 'booster' && isOwned(state, id)) return 'already-owned';
  if (state.wallet.coins < priceOf(state, id)) return 'not-enough-coins';
  return 'ok';
}

/** Покупает предмет. Питомцы и скины сразу надеваются. */
export function buy(state: SaveState, id: string, ts: number): BuyResult {
  const result = canBuy(state, id);
  if (result !== 'ok') return result;
  const item = getItem(id) as ShopItem;

  state.wallet.coins -= priceOf(state, id);

  if (item.kind === 'booster') {
    // заморозки живут отдельным счётчиком — так их видно в профиле
    if (id === 'freeze') state.streak.freezes = Math.min(99, state.streak.freezes + 1);
    else state.inventory.items[id] = boosterCount(state, id) + 1;
  } else {
    if (!state.inventory.owned.includes(id)) state.inventory.owned.push(id);
    equip(state, id, ts);
  }
  return 'ok';
}

/** Надевает питомца или скин. false — предмет не куплен. */
export function equip(state: SaveState, id: string, ts: number): boolean {
  const item = getItem(id);
  if (!item || !isOwned(state, id)) return false;
  if (item.kind === 'pet') {
    state.profile.petId = id;
    applyPerks(state, ts);
    return true;
  }
  if (item.kind === 'theme') {
    state.profile.themeId = id.replace(/^theme_/, '');
    return true;
  }
  return false;
}

/* ————————————————————————— прокачка питомца ————————————————————————— */

export type UpgradeResult = 'ok' | 'no-such-item' | 'not-owned' | 'maxed' | 'not-enough-coins';

export function canUpgradePet(state: SaveState, id: string): UpgradeResult {
  const item = getItem(id);
  if (!item || item.kind !== 'pet' || !item.tiers) return 'no-such-item';
  if (!isOwned(state, id)) return 'not-owned';
  const next = nextTier(state, id);
  if (!next) return 'maxed';
  if (state.wallet.coins < next.price) return 'not-enough-coins';
  return 'ok';
}

/** Поднимает питомца на ступень. Эффекты применяются сразу. */
export function upgradePet(state: SaveState, id: string, ts: number): UpgradeResult {
  const check = canUpgradePet(state, id);
  if (check !== 'ok') return check;
  const next = nextTier(state, id) as PetTier;
  state.wallet.coins -= next.price;
  state.inventory.petLevels[id] = petTier(state, id) + 1;
  applyPerks(state, ts);
  return 'ok';
}

/* ————————————————————————— сундуки с бустерами ————————————————————————— */

export interface CaseResult {
  /** id бустера -> сколько выпало. */
  boosters: Record<string, number>;
  coins: number;
}

/**
 * Что лежит в сундуке. Чистая функция — её проверяют тесты.
 * lootBonus — доля к монетам из дерева прокачки.
 */
export function rollCase(id: string, rng: Rng, lootBonus = 0): CaseResult | null {
  const item = getItem(id);
  if (!item || item.kind !== 'case' || !item.loot) return null;
  const pool = itemsOfKind('booster').map((b) => b.id);
  if (pool.length === 0) return null;

  const boosters: Record<string, number> = {};
  const add = (bid: string): void => {
    boosters[bid] = (boosters[bid] ?? 0) + 1;
  };

  for (const bid of item.loot.guaranteed ?? []) add(bid);
  const rest = Math.max(0, item.loot.boosters - Object.values(boosters).reduce((a, b) => a + b, 0));
  for (let i = 0; i < rest; i++) add(pool[Math.floor(rng() * pool.length)] as string);

  const [lo, hi] = item.loot.coins;
  let coins = lo + Math.floor(rng() * (hi - lo + 1));

  /*
   * Пол: содержимое не бывает дешевле самого сундука.
   * Без него бронзовый мог выдать три самых дешёвых бустера и горсть монет —
   * суммарно меньше цены. Сундук со случайным составом это нормально,
   * сундук, который обирает, — нет. Недостающее добираем монетами.
   */
  const worth = (c: number): number =>
    c + Object.entries(boosters).reduce((sum, [bid, n]) => sum + (getItem(bid)?.price ?? 0) * n, 0);
  if (worth(coins) <= item.price) coins += item.price - worth(coins) + 1;

  coins = Math.floor(coins * (1 + Math.max(0, lootBonus)));
  return { boosters, coins };
}

/** Покупает и открывает сундук. null — не хватило монет или нет такого. */
export function openCase(
  state: SaveState,
  id: string,
  rng: Rng,
  lootBonus = 0,
): CaseResult | null {
  const item = getItem(id);
  if (!item || item.kind !== 'case') return null;
  const price = priceOf(state, id);
  if (state.wallet.coins < price) return null;
  const result = rollCase(id, rng, lootBonus);
  if (!result) return null;

  state.wallet.coins -= price;
  for (const [bid, n] of Object.entries(result.boosters)) {
    // заморозки живут отдельным счётчиком, как и при обычной покупке
    if (bid === 'freeze') state.streak.freezes = Math.min(99, state.streak.freezes + n);
    else state.inventory.items[bid] = boosterCount(state, bid) + n;
  }
  state.wallet.coins += result.coins;
  state.stats.cases += 1;
  return result;
}

/* ————————————————————————— бустеры ————————————————————————— */

/** Тратит один бустер. false — его нет. */
export function useBooster(state: SaveState, id: string): boolean {
  const have = boosterCount(state, id);
  if (have <= 0) return false;
  state.inventory.items[id] = have - 1;
  return true;
}
