/**
 * Магазин: питомцы с бонусами, скины карты и бустеры.
 *
 * Питомцы и скины покупаются навсегда и лежат в inventory.owned,
 * бустеры расходуются и лежат в inventory.items.
 * Модуль без DOM: названия значков — просто строки, их разбирает UI.
 */

import type { SaveState } from '../data/state';
import { setMaxLives } from './lives';

export type ShopKind = 'pet' | 'theme' | 'booster';

export interface PetBonus {
  /** Множитель монет, например 1.1 — это +10%. */
  coins?: number;
  /** Прибавка к максимуму жизней. */
  lives?: number;
  /** Скидка на подсказки, 0..1. */
  hintDiscount?: number;
}

export interface ShopItem {
  id: string;
  kind: ShopKind;
  title: string;
  description: string;
  price: number;
  icon: string;
  /** Оттенок для карточки в магазине. */
  tone: string;
  bonus?: PetBonus;
  /** Выдаётся с самого начала. */
  starter?: boolean;
}

export const BASE_MAX_LIVES = 5;

export const SHOP_ITEMS: ShopItem[] = [
  /* ——— питомцы ——— */
  {
    id: 'pet_fox',
    kind: 'pet',
    title: 'Рӯбоҳ',
    description: 'Лисёнок-проводник. С ним вы и начинали.',
    price: 0,
    icon: 'fox',
    tone: 'orange',
    starter: true,
  },
  {
    id: 'pet_cat',
    kind: 'pet',
    title: 'Гурба',
    description: 'Кошка приносит на 10% больше монет за ответы.',
    price: 200,
    icon: 'cat',
    tone: 'pink',
    bonus: { coins: 1.1 },
  },
  {
    id: 'pet_dog',
    kind: 'pet',
    title: 'Саг',
    description: 'Пёс сторожит ещё одну жизнь: максимум шесть вместо пяти.',
    price: 350,
    icon: 'dog',
    tone: 'blue',
    bonus: { lives: 1 },
  },
  {
    id: 'pet_bird',
    kind: 'pet',
    title: 'Парранда',
    description: 'Птица подсказывает дешевле — скидка 40% на подсказки.',
    price: 500,
    icon: 'bird',
    tone: 'teal',
    bonus: { hintDiscount: 0.4 },
  },

  /* ——— скины карты ——— */
  {
    id: 'theme_meadow',
    kind: 'theme',
    title: 'Луг',
    description: 'Зелёные холмы и песочная дорожка.',
    price: 0,
    icon: 'meadow',
    tone: 'green',
    starter: true,
  },
  {
    id: 'theme_desert',
    kind: 'theme',
    title: 'Пустыня',
    description: 'Песок, камни и жаркое солнце.',
    price: 150,
    icon: 'desert',
    tone: 'gold',
  },
  {
    id: 'theme_winter',
    kind: 'theme',
    title: 'Зима',
    description: 'Снег, ели и морозное небо.',
    price: 300,
    icon: 'snow',
    tone: 'blue',
  },
  {
    id: 'theme_night',
    kind: 'theme',
    title: 'Ночь',
    description: 'Звёзды над горами и светлячки у дороги.',
    price: 450,
    icon: 'moon',
    tone: 'purple',
  },

  /* ——— бустеры ——— */
  {
    id: 'hint',
    kind: 'booster',
    title: 'Подсказка',
    description: 'Открывает букву в колесе. Тратится вместо монет.',
    price: 20,
    icon: 'bulb',
    tone: 'gold',
  },
  {
    id: 'fifty',
    kind: 'booster',
    title: '50 на 50',
    description: 'Убирает два неверных варианта в квизе.',
    price: 35,
    icon: 'target',
    tone: 'teal',
  },
  {
    id: 'freeze',
    kind: 'booster',
    title: 'Заморозка стрика',
    description: 'Прикрывает один пропущенный день.',
    price: 120,
    icon: 'sparkle',
    tone: 'blue',
  },
  {
    id: 'refill',
    kind: 'booster',
    title: 'Полный запас жизней',
    description: 'Сразу восполняет все жизни.',
    price: 100,
    icon: 'heart',
    tone: 'red',
  },
];

const BY_ID = new Map(SHOP_ITEMS.map((i) => [i.id, i]));

export function getItem(id: string): ShopItem | undefined {
  return BY_ID.get(id);
}

export function itemsOfKind(kind: ShopKind): ShopItem[] {
  return SHOP_ITEMS.filter((i) => i.kind === kind);
}

/* ————————————————————————— владение и покупка ————————————————————————— */

export function isOwned(state: SaveState, id: string): boolean {
  const item = getItem(id);
  if (!item) return false;
  if (item.starter) return true;
  return state.inventory.owned.includes(id);
}

export type BuyResult = 'ok' | 'no-such-item' | 'already-owned' | 'not-enough-coins';

export function canBuy(state: SaveState, id: string): BuyResult {
  const item = getItem(id);
  if (!item) return 'no-such-item';
  // бустеры покупаются сколько угодно раз, остальное — один
  if (item.kind !== 'booster' && isOwned(state, id)) return 'already-owned';
  if (state.wallet.coins < item.price) return 'not-enough-coins';
  return 'ok';
}

/** Покупает предмет. Питомцы и скины сразу надеваются. */
export function buy(state: SaveState, id: string, ts: number): BuyResult {
  const result = canBuy(state, id);
  if (result !== 'ok') return result;
  const item = getItem(id) as ShopItem;

  state.wallet.coins -= item.price;

  if (item.kind === 'booster') {
    state.inventory.items[id] = (state.inventory.items[id] ?? 0) + 1;
    // заморозки живут отдельным счётчиком — так их видно в профиле
    if (id === 'freeze') {
      state.inventory.items[id] = 0;
      state.streak.freezes = Math.min(99, state.streak.freezes + 1);
    }
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
    applyPetEffects(state, ts);
    return true;
  }
  if (item.kind === 'theme') {
    state.profile.themeId = id.replace(/^theme_/, '');
    return true;
  }
  return false;
}

/* ————————————————————————— бонусы ————————————————————————— */

export function activePet(state: SaveState): ShopItem | undefined {
  return getItem(state.profile.petId ?? 'pet_fox') ?? getItem('pet_fox');
}

export function activeThemeId(state: SaveState): string {
  return state.profile.themeId || 'meadow';
}

/** Множитель монет от питомца. */
export function coinMultiplier(state: SaveState): number {
  return activePet(state)?.bonus?.coins ?? 1;
}

/** Максимум жизней с учётом питомца. */
export function maxLivesFor(state: SaveState): number {
  return BASE_MAX_LIVES + (activePet(state)?.bonus?.lives ?? 0);
}

/** Пересчитывает то, что зависит от питомца. Вызывать после смены питомца и при старте. */
export function applyPetEffects(state: SaveState, ts: number): void {
  setMaxLives(state, maxLivesFor(state), ts);
}

/** Цена подсказки с учётом скидки питомца. */
export function hintCost(state: SaveState, base: number): number {
  const discount = activePet(state)?.bonus?.hintDiscount ?? 0;
  return Math.max(1, Math.round(base * (1 - discount)));
}

/** Применяет множитель к награде, округляя вниз — так проще объяснять числа. */
export function applyCoinBonus(amount: number, multiplier: number): number {
  return Math.floor(amount * multiplier);
}

/* ————————————————————————— бустеры ————————————————————————— */

export function boosterCount(state: SaveState, id: string): number {
  return Math.max(0, Math.floor(state.inventory.items[id] ?? 0));
}

/** Тратит один бустер. false — его нет. */
export function useBooster(state: SaveState, id: string): boolean {
  const have = boosterCount(state, id);
  if (have <= 0) return false;
  state.inventory.items[id] = have - 1;
  return true;
}
