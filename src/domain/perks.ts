/**
 * Бонусы игрока — общий язык для всех их источников.
 *
 * Источников три: питомец со своей ступенью, снаряжение питомца и открытые
 * узлы дерева прокачки. Каждый отдаёт Partial<Perks>, здесь они складываются.
 * Так новый источник подключается одной строкой, а у потребителей — уровня,
 * лавки, жизней — ровно одна точка, откуда брать числа.
 *
 * Модуль чистый и ничего не импортирует из домена: его подключают все,
 * и цикл импортов здесь был бы бомбой замедленного действия.
 */

export interface Perks {
  /** Доля к монетам за ответы: 0.1 — это +10%. */
  coins: number;
  /** Доля к награде за пройденный уровень. */
  levelCoins: number;
  /** Монет сверху за каждый верный ответ. */
  flatCoins: number;
  /** Доля к лаъл. */
  gems: number;
  /** Жизней к максимуму. */
  lives: number;
  /** Доля к скорости восстановления жизней: 0.5 — в полтора раза быстрее. */
  regen: number;
  /** Сколько ошибок за уровень не стоят жизни. Звёзды они всё равно снимают. */
  shield: number;
  /** Скидка на подсказки, 0..1. */
  hintDiscount: number;
  /** Скидка в лавке, 0..1. */
  shopDiscount: number;
  /** Прибавка к потолку бонуса за серию верных ответов. */
  combo: number;
  /** Вращений колеса удачи в день сверх одного. */
  spins: number;
  /** Наград в ежедневном сундуке сверх одной. */
  chest: number;
  /** Доля к монетам из сундуков. */
  loot: number;
  /** Доля удачи в сундуках снаряжения: сдвигает шансы к редкому. */
  luck: number;
  /** Доля удачи в лоне: сдвигает шансы к редким питомцам. */
  petLuck: number;
  /** Доля к бонусу питомца: множит всё, что даёт его ступень со звёздами. */
  petPower: number;
  /** Доля к бонусам снаряжения. */
  gearPower: number;
  /** Скидка на соединение копий в звезду, 0..1. */
  mergeDiscount: number;
  /** Шанс, что повторный питомец даст две копии вместо одной, 0..1. */
  extraCopy: number;
  /** Доля к осколкам из повторных вещей. */
  shardBonus: number;
  /** Скидка на товар дня сверх его собственной, 0..1. */
  dealDiscount: number;
  /** Товаров дня сверх обычных трёх. */
  dealSlots: number;
  /** Доля к силе угощений. */
  foodPower: number;
  /** Уроков, на которые угощения хватает, сверх обычного. */
  foodLength: number;
  /** Слов в сессии повторения сверх обычного. */
  review: number;
}

export type PerkKey = keyof Perks;

export const NO_PERKS: Readonly<Perks> = Object.freeze({
  coins: 0,
  levelCoins: 0,
  flatCoins: 0,
  gems: 0,
  lives: 0,
  regen: 0,
  shield: 0,
  hintDiscount: 0,
  shopDiscount: 0,
  combo: 0,
  spins: 0,
  chest: 0,
  loot: 0,
  luck: 0,
  petLuck: 0,
  petPower: 0,
  gearPower: 0,
  mergeDiscount: 0,
  extraCopy: 0,
  shardBonus: 0,
  dealDiscount: 0,
  dealSlots: 0,
  foodPower: 0,
  foodLength: 0,
  review: 0,
});

/**
 * Оси-счётчики: жизни, щиты, серия. Их бонус целый — «+2,9 жизни» не бывает.
 * Когда бонус умножается (звёзды питомца), такие оси округляются.
 */
export const INTEGER_PERKS: ReadonlySet<PerkKey> = new Set<PerkKey>([
  'flatCoins',
  'lives',
  'shield',
  'combo',
  'spins',
  'chest',
  'dealSlots',
  'foodLength',
  'review',
]);

/**
 * Потолки. Бонусы помогают, но не отменяют саму игру: две бесплатные ошибки
 * за уровень — ещё подстраховка, пять — уже повод не думать над ответом.
 */
export const PERK_CAPS: Readonly<Perks> = Object.freeze({
  coins: 2,
  levelCoins: 2,
  flatCoins: 5,
  gems: 1,
  lives: 10,
  regen: 2,
  shield: 2,
  hintDiscount: 0.9,
  shopDiscount: 0.3,
  combo: 6,
  spins: 2,
  chest: 2,
  loot: 1.5,
  luck: 2,
  petLuck: 2,
  petPower: 1,
  gearPower: 1,
  mergeDiscount: 0.5,
  extraCopy: 0.5,
  shardBonus: 1,
  dealDiscount: 0.4,
  dealSlots: 3,
  foodPower: 1,
  foodLength: 3,
  review: 10,
});

/**
 * Скидки не суммируются: 50% и 50% — это не бесплатно, а 75%.
 * Каждая следующая действует на то, что осталось после предыдущей.
 */
const DISCOUNTS: readonly PerkKey[] = ['hintDiscount', 'shopDiscount', 'mergeDiscount', 'dealDiscount'];

export function combinePerks(sources: readonly Partial<Perks>[]): Perks {
  const out: Perks = { ...NO_PERKS };
  const remaining: Partial<Record<PerkKey, number>> = {};

  for (const source of sources) {
    for (const [key, value] of Object.entries(source) as [PerkKey, number | undefined][]) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) continue;
      if (DISCOUNTS.includes(key)) {
        remaining[key] = (remaining[key] ?? 1) * (1 - Math.min(0.99, value));
      } else {
        out[key] += value;
      }
    }
  }

  for (const key of DISCOUNTS) out[key] = 1 - (remaining[key] ?? 1);
  for (const key of Object.keys(out) as PerkKey[]) out[key] = Math.min(PERK_CAPS[key], out[key]);
  return out;
}

/* ————————————————————————— подписи ————————————————————————— */

const pct = (v: number): string => Math.round(v * 100) + '%';

/**
 * Короткая подпись бонуса: «+10% монет», «+1 жизнь». Одна на всё приложение,
 * чтобы дерево, питомцы и снаряжение называли одно и то же одинаково.
 */
export function perkLabel(key: PerkKey, value: number): string {
  switch (key) {
    case 'coins':
      return '+' + pct(value) + ' монет';
    case 'levelCoins':
      return '+' + pct(value) + ' за уровень';
    case 'flatCoins':
      return '+' + value + ' за ответ';
    case 'gems':
      return '+' + pct(value) + ' лаъл';
    case 'lives':
      return '+' + value + ' ' + (value === 1 ? 'жизнь' : value < 5 ? 'жизни' : 'жизней');
    case 'regen':
      return 'жизни быстрее на ' + pct(value);
    case 'shield':
      return value === 1 ? 'ошибка без потери жизни' : value + ' ошибки без потери жизни';
    case 'hintDiscount':
      return 'подсказки −' + pct(value);
    case 'shopDiscount':
      return 'лавка −' + pct(value);
    case 'combo':
      return '+' + value + ' к бонусу серии';
    case 'spins':
      return '+' + value + ' ' + (value === 1 ? 'вращение колеса' : 'вращения колеса');
    case 'chest':
      return '+' + value + ' ' + (value === 1 ? 'награда' : 'награды') + ' в сундуке дня';
    case 'loot':
      return '+' + pct(value) + ' монет из сундуков';
    case 'luck':
      return '+' + pct(value) + ' удачи';
    case 'petLuck':
      return '+' + pct(value) + ' удачи лоны';
    case 'petPower':
      return 'питомец сильнее на ' + pct(value);
    case 'gearPower':
      return 'снаряжение сильнее на ' + pct(value);
    case 'mergeDiscount':
      return 'звёзды питомцев −' + pct(value);
    case 'extraCopy':
      return pct(value) + ' шанс на двойную копию';
    case 'shardBonus':
      return '+' + pct(value) + ' осколков';
    case 'dealDiscount':
      return 'товар дня −' + pct(value);
    case 'dealSlots':
      return '+' + value + ' ' + (value === 1 ? 'товар дня' : 'товара дня');
    case 'foodPower':
      return 'угощения сильнее на ' + pct(value);
    case 'foodLength':
      return '+' + value + ' ' + (value === 1 ? 'урок' : 'урока') + ' к угощению';
    case 'review':
      return '+' + value + ' слов в повторении';
  }
}

/** Все подписи набора бонусов по порядку объявления. */
export function perkLabels(perks: Partial<Perks>): string[] {
  const out: string[] = [];
  for (const key of Object.keys(NO_PERKS) as PerkKey[]) {
    const value = perks[key];
    if (typeof value === 'number' && value > 0) out.push(perkLabel(key, value));
  }
  return out;
}
