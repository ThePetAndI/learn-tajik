/**
 * Каталог лавки: что продаётся и что у игрока уже есть.
 *
 * Только данные и чтение состояния, никаких покупок: покупки живут в shop.ts,
 * а сведение бонусов — в bonuses.ts. Разделено ради одного правила: данные
 * не импортируют поведение. Иначе bonuses.ts, которому нужны ступени
 * питомцев, и shop.ts, которому после покупки нужно пересчитать бонусы,
 * замкнулись бы друг на друга.
 */

import type { SaveState } from '../data/state';
import type { Perks } from './perks';

export type ShopKind = 'pet' | 'theme' | 'booster' | 'case';

/**
 * Ступень прокачки питомца. Первая достаётся вместе с покупкой и стоит 0.
 * Бонус — в долях, как и везде: 0.1 — это +10%.
 */
export interface PetTier {
  /** Сколько стоит переход на эту ступень. */
  price: number;
  /** Короткая подпись того, что даёт ступень. */
  label: string;
  bonus: Partial<Perks>;
}

export const MAX_PET_TIER = 5;

/**
 * Что выпадает из сундука с бустерами. Сундук — не азартная игра с призрачным
 * шансом, а покупка бустеров оптом со случайным составом: суммарно он всегда
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

export interface ShopItem {
  id: string;
  kind: ShopKind;
  title: string;
  description: string;
  price: number;
  icon: string;
  /** Оттенок для карточки в магазине. */
  tone: string;
  /** Ступени прокачки, от первой до MAX_PET_TIER. Только у питомцев. */
  tiers?: PetTier[];
  /** Содержимое сундука. */
  loot?: CaseLoot;
  /** Выдаётся с самого начала. */
  starter?: boolean;
}

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
      { price: 300, label: '+10% за уровень', bonus: { levelCoins: 0.1 } },
      { price: 700, label: '+20% за уровень', bonus: { levelCoins: 0.2 } },
      { price: 1500, label: '+32% за уровень', bonus: { levelCoins: 0.32 } },
      { price: 3000, label: '+45% за уровень', bonus: { levelCoins: 0.45 } },
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
    tiers: [
      { price: 0, label: '+10% монет', bonus: { coins: 0.1 } },
      { price: 350, label: '+16% монет', bonus: { coins: 0.16 } },
      { price: 800, label: '+23% монет', bonus: { coins: 0.23 } },
      { price: 1700, label: '+31% монет', bonus: { coins: 0.31 } },
      { price: 3200, label: '+40% монет', bonus: { coins: 0.4 } },
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

  /* ——— сундуки с бустерами ——— */
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

/* ————————————————————————— что есть у игрока ————————————————————————— */

export function isOwned(state: SaveState, id: string): boolean {
  const item = getItem(id);
  if (!item) return false;
  if (item.starter) return true;
  return state.inventory.owned.includes(id);
}

export function activePet(state: SaveState): ShopItem | undefined {
  return getItem(state.profile.petId ?? 'pet_fox') ?? getItem('pet_fox');
}

export function activeThemeId(state: SaveState): string {
  return state.profile.themeId || 'meadow';
}

export function boosterCount(state: SaveState, id: string): number {
  return Math.max(0, Math.floor(state.inventory.items[id] ?? 0));
}

/* ————————————————————————— ступени питомца ————————————————————————— */

/** Текущая ступень питомца, 1..MAX_PET_TIER. Некупленный считается первым. */
export function petTier(state: SaveState, id: string): number {
  const raw = state.inventory.petLevels?.[id] ?? 1;
  return Math.max(1, Math.min(MAX_PET_TIER, Math.floor(raw)));
}

/** Бонус питомца на его текущей ступени. */
export function petBonus(state: SaveState, id: string): Partial<Perks> {
  const tiers = getItem(id)?.tiers;
  if (!tiers || tiers.length === 0) return {};
  return tiers[petTier(state, id) - 1]?.bonus ?? {};
}

/** Следующая ступень или null, если дальше некуда. */
export function nextTier(state: SaveState, id: string): PetTier | null {
  const item = getItem(id);
  if (!item?.tiers) return null;
  const tier = petTier(state, id);
  if (tier >= Math.min(MAX_PET_TIER, item.tiers.length)) return null;
  return item.tiers[tier] ?? null;
}

/** Бонус активного питомца — источник для bonuses.ts. */
export function petPerks(state: SaveState): Partial<Perks> {
  const pet = activePet(state);
  return pet ? petBonus(state, pet.id) : {};
}
