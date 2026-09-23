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
import { INTEGER_PERKS, perkLabels, type PerkKey, type Perks } from './perks';
import type { Rarity } from './rarity';

export type ShopKind = 'pet' | 'theme' | 'booster' | 'case';

/**
 * Ступень прокачки питомца. Первая достаётся вместе с покупкой и стоит 0.
 * Бонус — в долях, как и везде: 0.1 — это +10%.
 */
export interface PetTier {
  /** Сколько стоит переход на эту ступень. */
  price: number;
  /** Короткая подпись; нет — строится из бонуса (tierLabel). */
  label?: string;
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
  /** Редкость питомца: по ней шансы в лоне и цена соединения копий. */
  rarity?: Rarity;
  /** Питомец только из лона — купить его нельзя. */
  chestOnly?: boolean;
  /** Порода для рисунка (ui/pet.ts). */
  breed?: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  /* ——— питомцы ——— */
  {
    id: 'pet_fox',
    kind: 'pet',
    rarity: 'common',
    breed: 'fox',
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
    rarity: 'common',
    breed: 'cat',
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
    rarity: 'common',
    breed: 'dog',
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
    rarity: 'common',
    breed: 'bird',
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

  /*
   * ——— питомцы из лона ———
   * Купить их нельзя: они только выходят из лоны или приходят обменом копий.
   * Подписи ступеней строятся из бонуса (tierLabel), чтобы не разойтись с ним.
   */
  {
    id: 'pet_kabk',
    kind: 'pet',
    rarity: 'rare',
    breed: 'kabk',
    chestOnly: true,
    title: 'Кабк',
    description: 'Горная куропатка. В таджикских стихах кабк — сама красота походки.',
    price: 0,
    icon: 'bird',
    tone: 'blue',
    tiers: [
      { price: 0, bonus: { gems: 0.06 } },
      { price: 420, bonus: { gems: 0.09 } },
      { price: 950, bonus: { gems: 0.12 } },
      { price: 2000, bonus: { gems: 0.16 } },
      { price: 3800, bonus: { gems: 0.2 } },
    ],
  },
  {
    id: 'pet_bulbul',
    kind: 'pet',
    rarity: 'rare',
    breed: 'bulbul',
    chestOnly: true,
    title: 'Булбул',
    description: 'Соловей из стихов Хафиза и Саади. Поёт — и серия тянется дольше.',
    price: 0,
    icon: 'bird',
    tone: 'gold',
    tiers: [
      { price: 0, bonus: { combo: 1 } },
      { price: 420, bonus: { combo: 2 } },
      { price: 950, bonus: { combo: 2, coins: 0.05 } },
      { price: 2000, bonus: { combo: 3, coins: 0.05 } },
      { price: 3800, bonus: { combo: 4, coins: 0.08 } },
    ],
  },
  {
    id: 'pet_hirs',
    kind: 'pet',
    rarity: 'epic',
    breed: 'hirs',
    chestOnly: true,
    title: 'Хирс',
    description: 'Медведь с гор. Прикрывает от ошибки и бережёт жизни.',
    price: 0,
    icon: 'paw',
    tone: 'orange',
    tiers: [
      { price: 0, bonus: { shield: 1 } },
      { price: 520, bonus: { shield: 1, lives: 1 } },
      { price: 1200, bonus: { shield: 1, lives: 2 } },
      { price: 2500, bonus: { shield: 2, lives: 2 } },
      { price: 4500, bonus: { shield: 2, lives: 3 } },
    ],
  },
  {
    id: 'pet_ohu',
    kind: 'pet',
    rarity: 'epic',
    breed: 'ohu',
    chestOnly: true,
    title: 'Оҳу',
    description: 'Косуля: лёгкая и быстрая. С ней жизни возвращаются скорее.',
    price: 0,
    icon: 'paw',
    tone: 'green',
    tiers: [
      { price: 0, bonus: { regen: 0.3 } },
      { price: 520, bonus: { regen: 0.45 } },
      { price: 1200, bonus: { regen: 0.6 } },
      { price: 2500, bonus: { regen: 0.8 } },
      { price: 4500, bonus: { regen: 1 } },
    ],
  },
  {
    id: 'pet_uqob',
    kind: 'pet',
    rarity: 'epic',
    breed: 'uqob',
    chestOnly: true,
    title: 'Уқоб',
    description: 'Орёл: издалека видит редкое — в сундуках и в гнёздах.',
    price: 0,
    icon: 'bird',
    tone: 'purple',
    tiers: [
      { price: 0, bonus: { luck: 0.2, petLuck: 0.2 } },
      { price: 520, bonus: { luck: 0.3, petLuck: 0.3 } },
      { price: 1200, bonus: { luck: 0.4, petLuck: 0.4 } },
      { price: 2500, bonus: { luck: 0.55, petLuck: 0.55 } },
      { price: 4500, bonus: { luck: 0.7, petLuck: 0.7 } },
    ],
  },
  {
    id: 'pet_babr',
    kind: 'pet',
    rarity: 'legendary',
    breed: 'babr',
    chestOnly: true,
    title: 'Бабри барфӣ',
    description: 'Снежный барс Памира. Редчайший зверь гор — и лучший спутник.',
    price: 0,
    icon: 'paw',
    tone: 'teal',
    tiers: [
      { price: 0, bonus: { coins: 0.1, levelCoins: 0.1, gems: 0.05 } },
      { price: 700, bonus: { coins: 0.14, levelCoins: 0.14, gems: 0.08 } },
      { price: 1600, bonus: { coins: 0.18, levelCoins: 0.18, gems: 0.11 } },
      { price: 3200, bonus: { coins: 0.23, levelCoins: 0.23, gems: 0.15 } },
      { price: 6000, bonus: { coins: 0.3, levelCoins: 0.3, gems: 0.2 } },
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

/* ————————————————————————— звёзды питомца ————————————————————————— */

export const MAX_PET_RANK = 5;

/**
 * Во сколько раз звёзды умножают бонус ступени. Ступень — это тренировка
 * за монеты, звёзды — это копии того же питомца, соединённые вместе.
 * Две оси: одна растёт от монет, другая от везения и терпения.
 */
export const RANK_MULT: readonly number[] = [1, 1.2, 1.45, 1.75, 2.1];

/** Звёзды питомца, 1..MAX_PET_RANK. Нет записи — одна звезда. */
export function petRank(state: SaveState, id: string): number {
  const raw = state.inventory.petRanks?.[id] ?? 1;
  return Math.max(1, Math.min(MAX_PET_RANK, Math.floor(raw)));
}

/** Сколько лишних копий питомца лежит про запас. */
export function petCopies(state: SaveState, id: string): number {
  return Math.max(0, Math.floor(state.inventory.petCopies?.[id] ?? 0));
}

/**
 * Бонус, умноженный на звёзды. Счётные оси — жизни, щиты, серия — округляются:
 * «+2,9 жизни» не бывает, бывает «+3».
 */
export function rankedBonus(bonus: Partial<Perks>, rank: number): Partial<Perks> {
  const mult = RANK_MULT[Math.max(1, Math.min(MAX_PET_RANK, rank)) - 1] ?? 1;
  const out: Partial<Perks> = {};
  for (const [key, value] of Object.entries(bonus) as [PerkKey, number][]) {
    const scaled = value * mult;
    out[key] = INTEGER_PERKS.has(key) ? Math.round(scaled) : Math.round(scaled * 1000) / 1000;
  }
  return out;
}

/** Бонус ступени без звёзд — что даёт тренировка сама по себе. */
export function tierBonus(state: SaveState, id: string): Partial<Perks> {
  const tiers = getItem(id)?.tiers;
  if (!tiers || tiers.length === 0) return {};
  return tiers[petTier(state, id) - 1]?.bonus ?? {};
}

/** Бонус питомца: ступень, умноженная на звёзды. */
export function petBonus(state: SaveState, id: string): Partial<Perks> {
  return rankedBonus(tierBonus(state, id), petRank(state, id));
}

/** Подпись ступени: своя, если задана, иначе — из самого бонуса. */
export function tierLabel(tier: PetTier): string {
  return tier.label ?? perkLabels(tier.bonus).join(', ');
}

/** Все питомцы — по порядку каталога. */
export function allPets(): ShopItem[] {
  return SHOP_ITEMS.filter((i) => i.kind === 'pet');
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
