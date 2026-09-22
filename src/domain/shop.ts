/**
 * Магазин: питомцы с бонусами, скины карты и бустеры.
 *
 * Питомцы и скины покупаются навсегда и лежат в inventory.owned,
 * бустеры расходуются и лежат в inventory.items.
 * Модуль без DOM: названия значков — просто строки, их разбирает UI.
 */

import type { Rng } from '../core/rng';
import type { SaveState } from '../data/state';
import { setMaxLives } from './lives';

export type ShopKind = 'pet' | 'theme' | 'booster' | 'case';

export interface PetBonus {
  /** Множитель монет за ответы, например 1.1 — это +10%. */
  coins?: number;
  /** Множитель награды за пройденный уровень. */
  levelCoins?: number;
  /** Прибавка к максимуму жизней. */
  lives?: number;
  /** Скидка на подсказки, 0..1. */
  hintDiscount?: number;
}

/**
 * Ступень прокачки питомца. Первая достаётся вместе с покупкой и стоит 0.
 * Прокачка — главный сток монет: курс выдаёт около 10 000, а раньше всё
 * постоянное в магазине стоило 1 950, и к четвёртому разделу деньги
 * становилось некуда девать.
 */
export interface PetTier {
  /** Сколько стоит переход на эту ступень. */
  price: number;
  /** Короткая подпись того, что даёт ступень. */
  label: string;
  bonus: PetBonus;
}

export const MAX_PET_TIER = 5;

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
  /** Ступени прокачки, от первой до MAX_PET_TIER. Только у питомцев. */
  tiers?: PetTier[];
  /** Содержимое кейса. */
  loot?: CaseLoot;
  /** Выдаётся с самого начала. */
  starter?: boolean;
}

/**
 * Что выпадает из кейса. Кейс — не азартная игра с призрачным шансом,
 * а покупка бустеров оптом со случайным составом: суммарно он всегда
 * отдаёт больше, чем стоит, иначе открывать его незачем.
 */
export interface CaseLoot {
  /** Сколько бустеров выпадет. */
  boosters: number;
  /** Диапазон монет обратно. */
  coins: [number, number];
  /** Эти бустеры гарантированно попадут в набор. */
  guaranteed?: string[];
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
    tiers: [
      { price: 0, label: 'просто друг', bonus: {} },
      { price: 300, label: '+10% за уровень', bonus: { levelCoins: 1.1 } },
      { price: 700, label: '+20% за уровень', bonus: { levelCoins: 1.2 } },
      { price: 1500, label: '+32% за уровень', bonus: { levelCoins: 1.32 } },
      { price: 3000, label: '+45% за уровень', bonus: { levelCoins: 1.45 } },
    ],
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
    tiers: [
      { price: 0, label: '+10% монет', bonus: { coins: 1.1 } },
      { price: 350, label: '+16% монет', bonus: { coins: 1.16 } },
      { price: 800, label: '+23% монет', bonus: { coins: 1.23 } },
      { price: 1700, label: '+31% монет', bonus: { coins: 1.31 } },
      { price: 3200, label: '+40% монет', bonus: { coins: 1.4 } },
    ],
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
    tiers: [
      { price: 0, label: 'шесть жизней', bonus: { lives: 1 } },
      { price: 400, label: 'семь жизней', bonus: { lives: 2 } },
      { price: 900, label: 'восемь жизней', bonus: { lives: 3 } },
      { price: 1800, label: 'девять жизней', bonus: { lives: 4 } },
      { price: 3400, label: 'десять жизней', bonus: { lives: 5 } },
    ],
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
    tiers: [
      { price: 0, label: 'скидка 40%', bonus: { hintDiscount: 0.4 } },
      { price: 450, label: 'скидка 52%', bonus: { hintDiscount: 0.52 } },
      { price: 1000, label: 'скидка 64%', bonus: { hintDiscount: 0.64 } },
      { price: 1900, label: 'скидка 76%', bonus: { hintDiscount: 0.76 } },
      { price: 3500, label: 'скидка 88%', bonus: { hintDiscount: 0.88 } },
    ],
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

  /* ——— кейсы ——— */
  {
    id: 'case_bronze',
    kind: 'case',
    title: 'Бронзовый сундук',
    description: 'Три случайных бустера и горсть монет обратно.',
    price: 150,
    icon: 'chest',
    tone: 'orange',
    loot: { boosters: 3, coins: [30, 70] },
  },
  {
    id: 'case_silver',
    kind: 'case',
    title: 'Серебряный сундук',
    description: 'Шесть бустеров, среди них точно заморозка стрика.',
    price: 400,
    icon: 'chest',
    tone: 'blue',
    loot: { boosters: 6, coins: [90, 190], guaranteed: ['freeze'] },
  },
  {
    id: 'case_gold',
    kind: 'case',
    title: 'Золотой сундук',
    description: 'Двенадцать бустеров, заморозка и полный запас жизней.',
    price: 900,
    icon: 'chest',
    tone: 'gold',
    loot: { boosters: 12, coins: [220, 420], guaranteed: ['freeze', 'refill'] },
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

/* ————————————————————————— прокачка питомца ————————————————————————— */

/** Текущая ступень питомца, 1..MAX_PET_TIER. Некупленный считается первым. */
export function petTier(state: SaveState, id: string): number {
  const raw = state.inventory.petLevels?.[id] ?? 1;
  return Math.max(1, Math.min(MAX_PET_TIER, Math.floor(raw)));
}

/** Бонус питомца на его текущей ступени. */
export function petBonus(state: SaveState, id: string): PetBonus {
  const item = getItem(id);
  if (!item) return {};
  const tiers = item.tiers;
  if (!tiers || tiers.length === 0) return item.bonus ?? {};
  return tiers[petTier(state, id) - 1]?.bonus ?? item.bonus ?? {};
}

/** Следующая ступень или null, если дальше некуда. */
export function nextTier(state: SaveState, id: string): PetTier | null {
  const item = getItem(id);
  if (!item?.tiers) return null;
  const tier = petTier(state, id);
  if (tier >= Math.min(MAX_PET_TIER, item.tiers.length)) return null;
  return item.tiers[tier] ?? null;
}

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
  if (!state.inventory.petLevels) state.inventory.petLevels = {};
  state.inventory.petLevels[id] = petTier(state, id) + 1;
  // прокачанный пёс тут же добавляет жизни, а не со следующего запуска
  if (state.profile.petId === id || getItem(id)?.starter) applyPetEffects(state, ts);
  return 'ok';
}

/* ————————————————————————— кейсы ————————————————————————— */

export interface CaseResult {
  /** id бустера -> сколько выпало. */
  boosters: Record<string, number>;
  coins: number;
}

/** Что лежит в кейсе. Чистая функция — её проверяют тесты. */
export function rollCase(id: string, rng: Rng): CaseResult | null {
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

  return { boosters, coins };
}

/** Покупает и открывает кейс. null — не хватило монет или нет такого. */
export function openCase(state: SaveState, id: string, rng: Rng): CaseResult | null {
  const item = getItem(id);
  if (!item || item.kind !== 'case') return null;
  if (state.wallet.coins < item.price) return null;
  const result = rollCase(id, rng);
  if (!result) return null;

  state.wallet.coins -= item.price;
  for (const [bid, n] of Object.entries(result.boosters)) {
    // заморозки живут отдельным счётчиком, как и при обычной покупке
    if (bid === 'freeze') state.streak.freezes = Math.min(99, state.streak.freezes + n);
    else state.inventory.items[bid] = (state.inventory.items[bid] ?? 0) + n;
  }
  state.wallet.coins += result.coins;
  return result;
}

/* ————————————————————————— бонусы ————————————————————————— */

export function activePet(state: SaveState): ShopItem | undefined {
  return getItem(state.profile.petId ?? 'pet_fox') ?? getItem('pet_fox');
}

export function activeThemeId(state: SaveState): string {
  return state.profile.themeId || 'meadow';
}

/** Бонус активного питомца на его ступени. */
function activeBonus(state: SaveState): PetBonus {
  const pet = activePet(state);
  return pet ? petBonus(state, pet.id) : {};
}

/** Множитель монет за ответы. */
export function coinMultiplier(state: SaveState): number {
  return activeBonus(state).coins ?? 1;
}

/** Множитель награды за пройденный уровень. */
export function levelCoinMultiplier(state: SaveState): number {
  return activeBonus(state).levelCoins ?? 1;
}

/** Максимум жизней с учётом питомца. */
export function maxLivesFor(state: SaveState): number {
  return BASE_MAX_LIVES + (activeBonus(state).lives ?? 0);
}

/** Пересчитывает то, что зависит от питомца. Вызывать после смены питомца и при старте. */
export function applyPetEffects(state: SaveState, ts: number): void {
  setMaxLives(state, maxLivesFor(state), ts);
}

/** Цена подсказки с учётом скидки питомца. */
export function hintCost(state: SaveState, base: number): number {
  const discount = activeBonus(state).hintDiscount ?? 0;
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
