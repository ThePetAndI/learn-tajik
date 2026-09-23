/**
 * Снаряжение питомцев: что бывает, какой редкости и сколько даёт.
 *
 * Только данные и чтение состояния — поиск в сундуках, улучшение и наряд
 * живут в gear.ts. Разделено ради того же правила, что и каталог с деревом:
 * bonuses.ts читает бонусы надетого, а gear.ts после надевания зовёт
 * bonuses.applyPerks, и импорты не должны замкнуться.
 *
 * Три слота: голова, шея, оберег. Четыре редкости. Бонус считается
 * формулой, а не таблицей на каждый уровень каждого предмета: единица оси ×
 * сила редкости × рост с уровнем. Так редкий предмет всегда сильнее
 * обычного того же уровня, и каждое улучшение что-то добавляет — это
 * проверяют тесты, а не глаз.
 */

import type { SaveState } from '../data/state';
import { activePet } from './catalog';
import type { PerkKey, Perks } from './perks';

export type GearSlot = 'head' | 'neck' | 'charm';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export const SLOTS: readonly { id: GearSlot; title: string; tg: string; icon: string }[] = [
  { id: 'head', title: 'Голова', tg: 'кулоҳ', icon: 'hat' },
  { id: 'neck', title: 'Шея', tg: 'гарданбанд', icon: 'necklace' },
  { id: 'charm', title: 'Оберег', tg: 'тумор', icon: 'amulet' },
];

export interface RarityInfo {
  id: Rarity;
  title: string;
  /** Во сколько раз сильнее обычного на том же уровне. */
  power: number;
  maxLevel: number;
  /** Сколько осколков даёт повторная находка. */
  shards: number;
  /** Цена первого улучшения в монетах; дальше растёт на 30% за уровень. */
  coins: number;
  /** Осколков на первое улучшение; дальше — столько же за каждый уровень. */
  shardCost: number;
}

export const RARITIES: Record<Rarity, RarityInfo> = {
  common: { id: 'common', title: 'Обычный', power: 1, maxLevel: 5, shards: 5, coins: 40, shardCost: 3 },
  rare: { id: 'rare', title: 'Редкий', power: 1.7, maxLevel: 7, shards: 12, coins: 90, shardCost: 5 },
  epic: { id: 'epic', title: 'Эпический', power: 2.6, maxLevel: 9, shards: 30, coins: 200, shardCost: 9 },
  legendary: { id: 'legendary', title: 'Легендарный', power: 4, maxLevel: 10, shards: 80, coins: 450, shardCost: 15 },
};

export const RARITY_ORDER: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary'];

/** Какие оси бывают у снаряжения и сколько даёт обычный предмет первого уровня. */
const UNIT: Partial<Record<PerkKey, number>> = {
  coins: 0.03,
  levelCoins: 0.04,
  gems: 0.03,
  hintDiscount: 0.04,
  regen: 0.05,
  loot: 0.05,
  luck: 0.06,
};

/** Прирост за уровень: каждый следующий добавляет четверть от первого. */
const LEVEL_STEP = 0.25;

export interface GearItem {
  id: string;
  title: string;
  /** Таджикское название, если у вещи оно своё и узнаваемое. */
  tg?: string;
  /** Одна строка о вещи. */
  about: string;
  slot: GearSlot;
  rarity: Rarity;
  axis: PerkKey;
}

export const GEAR: readonly GearItem[] = [
  /* ——— голова ——— */
  { id: 'h_cap', title: 'Колпачок', about: 'Полосатый, с помпоном.', slot: 'head', rarity: 'common', axis: 'levelCoins' },
  { id: 'h_wreath', title: 'Венок', about: 'Из листьев тутовника.', slot: 'head', rarity: 'common', axis: 'gems' },
  { id: 'h_bow', title: 'Бантик', about: 'Чтобы не забыть выучить слово.', slot: 'head', rarity: 'common', axis: 'hintDiscount' },
  { id: 'h_toqi', title: 'Тюбетейка', tg: 'тоқӣ', about: 'Чёрная, с белым узором-бодом.', slot: 'head', rarity: 'rare', axis: 'gems' },
  { id: 'h_salla', title: 'Чалма', tg: 'салла', about: 'Намотана по всем правилам.', slot: 'head', rarity: 'rare', axis: 'levelCoins' },
  { id: 'h_crown', title: 'Корона', about: 'Маловата, но держится.', slot: 'head', rarity: 'epic', axis: 'coins' },
  { id: 'h_helmet', title: 'Шлем', about: 'Старинный, с гребнем.', slot: 'head', rarity: 'epic', axis: 'regen' },
  { id: 'h_lal_crown', title: 'Корона Кӯҳи Лаъл', about: 'С рубином из памирских копей.', slot: 'head', rarity: 'legendary', axis: 'gems' },

  /* ——— шея ——— */
  { id: 'n_scarf', title: 'Шарф', about: 'Тёплый, вязаный.', slot: 'neck', rarity: 'common', axis: 'coins' },
  { id: 'n_bell', title: 'Колокольчик', about: 'Звенит на каждом верном ответе.', slot: 'neck', rarity: 'common', axis: 'regen' },
  { id: 'n_beads', title: 'Бусы', about: 'Деревянные, на шнурке.', slot: 'neck', rarity: 'common', axis: 'loot' },
  { id: 'n_atlas', title: 'Атласный шарф', tg: 'атлас', about: 'Шёлк икат — узор, будто размытый ветром.', slot: 'neck', rarity: 'rare', axis: 'coins' },
  { id: 'n_pearls', title: 'Ожерелье', about: 'Жемчуг, нитка в три оборота.', slot: 'neck', rarity: 'rare', axis: 'regen' },
  { id: 'n_chain', title: 'Золотая цепь', about: 'Тяжёлая. Питомец гордится.', slot: 'neck', rarity: 'epic', axis: 'coins' },
  { id: 'n_medal', title: 'Медаль', about: 'За отличную учёбу.', slot: 'neck', rarity: 'epic', axis: 'levelCoins' },
  { id: 'n_lal', title: 'Гарданбанд с лаълом', tg: 'гарданбанд', about: 'Ожерелье с рубином.', slot: 'neck', rarity: 'legendary', axis: 'coins' },

  /* ——— оберег ——— */
  { id: 'c_feather', title: 'Пёрышко', about: 'Лёгкое, как верный ответ.', slot: 'charm', rarity: 'common', axis: 'hintDiscount' },
  { id: 'c_key', title: 'Ключик', about: 'Неизвестно от чего. Пока.', slot: 'charm', rarity: 'common', axis: 'loot' },
  { id: 'c_pebble', title: 'Камешек', about: 'Гладкий, из горной реки.', slot: 'charm', rarity: 'common', axis: 'luck' },
  { id: 'c_anor', title: 'Гранат', tg: 'анор', about: 'Знак достатка по всей Средней Азии.', slot: 'charm', rarity: 'rare', axis: 'luck' },
  { id: 'c_tumor', title: 'Тумор', tg: 'тумор', about: 'Треугольный оберег на шнурке.', slot: 'charm', rarity: 'rare', axis: 'regen' },
  { id: 'c_qalam', title: 'Калам', tg: 'қалам', about: 'Тростниковое перо каллиграфа.', slot: 'charm', rarity: 'epic', axis: 'hintDiscount' },
  { id: 'c_star', title: 'Звезда', about: 'Упала с неба над Памиром.', slot: 'charm', rarity: 'epic', axis: 'luck' },
  { id: 'c_lal', title: 'Лаъл', tg: 'лаъл', about: 'Сам рубин. Удача любит его.', slot: 'charm', rarity: 'legendary', axis: 'luck' },
];

const BY_ID = new Map(GEAR.map((g) => [g.id, g]));

export function getGear(id: string): GearItem | undefined {
  return BY_ID.get(id);
}

export function gearOfRarity(rarity: Rarity): GearItem[] {
  return GEAR.filter((g) => g.rarity === rarity);
}

/* ————————————————————————— сила ————————————————————————— */

/** Сколько даёт вещь на уровне level. */
export function gearValue(item: GearItem, level: number): number {
  const unit = UNIT[item.axis] ?? 0;
  const power = RARITIES[item.rarity].power;
  const lvl = Math.max(1, Math.min(RARITIES[item.rarity].maxLevel, Math.floor(level)));
  return Math.round(unit * power * (1 + LEVEL_STEP * (lvl - 1)) * 1000) / 1000;
}

export function gearPerk(item: GearItem, level: number): Partial<Perks> {
  return { [item.axis]: gearValue(item, level) };
}

/* ————————————————————————— что у игрока ————————————————————————— */

/** Уровень вещи у игрока; 0 — не найдена. */
export function gearLevel(state: SaveState, id: string): number {
  const item = getGear(id);
  const raw = state.inventory.gear[id];
  if (!item || raw === undefined) return 0;
  return Math.max(1, Math.min(RARITIES[item.rarity].maxLevel, Math.floor(raw)));
}

export function ownsGear(state: SaveState, id: string): boolean {
  return gearLevel(state, id) > 0;
}

/** Что надето на питомце: слот -> id вещи. Только найденные вещи. */
export function wornBy(state: SaveState, petId: string): Partial<Record<GearSlot, string>> {
  const raw = state.inventory.worn[petId] ?? {};
  const out: Partial<Record<GearSlot, string>> = {};
  for (const slot of SLOTS) {
    const id = raw[slot.id];
    const item = id ? getGear(id) : undefined;
    if (item && item.slot === slot.id && ownsGear(state, item.id)) out[slot.id] = item.id;
  }
  return out;
}

/**
 * Бонусы снаряжения активного питомца — источник для bonuses.ts.
 * Работает только наряд того, кто сейчас с игроком: у каждого питомца свой.
 */
export function gearPerks(state: SaveState): Partial<Perks>[] {
  const pet = activePet(state);
  if (!pet) return [];
  const out: Partial<Perks>[] = [];
  for (const id of Object.values(wornBy(state, pet.id))) {
    const item = id ? getGear(id) : undefined;
    if (item) out.push(gearPerk(item, gearLevel(state, item.id)));
  }
  return out;
}

/* ————————————————————————— сундуки ————————————————————————— */

export interface GearChest {
  id: string;
  title: string;
  about: string;
  /** Цена: в монетах или в лаъл, одно из двух. */
  coins: number;
  gems: number;
  /** Сколько вещей внутри. */
  count: number;
  /** Базовые веса редкостей, до удачи. */
  weights: Record<Rarity, number>;
  tone: string;
}

export const GEAR_CHESTS: readonly GearChest[] = [
  {
    id: 'gc_wanderer',
    title: 'Сундук странника',
    about: 'Одна вещь для питомца.',
    coins: 250,
    gems: 0,
    count: 1,
    weights: { common: 62, rare: 28, epic: 8, legendary: 2 },
    tone: 'orange',
  },
  {
    id: 'gc_caravan',
    title: 'Караван',
    about: 'Пять вещей сразу — дешевле, чем по одной.',
    coins: 1100,
    gems: 0,
    count: 5,
    weights: { common: 62, rare: 28, epic: 8, legendary: 2 },
    tone: 'gold',
  },
  {
    id: 'gc_lal',
    title: 'Лаъловый ларец',
    about: 'Обычных вещей в нём не бывает.',
    coins: 0,
    gems: 12,
    count: 1,
    weights: { common: 0, rare: 55, epic: 35, legendary: 10 },
    tone: 'ruby',
  },
];

export function getGearChest(id: string): GearChest | undefined {
  return GEAR_CHESTS.find((c) => c.id === id);
}

/**
 * Удача сдвигает шансы от обычного к редкому. Обычное становится реже,
 * легендарное — чаще всех остальных: удача ощущается именно там.
 */
export function chestWeights(chest: GearChest, luck: number): Record<Rarity, number> {
  const l = Math.max(0, luck);
  const w = chest.weights;
  return {
    common: w.common / (1 + l),
    rare: w.rare * (1 + 0.5 * l),
    epic: w.epic * (1 + l),
    legendary: w.legendary * (1 + 1.5 * l),
  };
}

/**
 * Шансы в процентах — ровно то, что показывается игроку. Сундук со скрытыми
 * шансами — это уже не игра, а лотерея; здесь их видно до покупки.
 */
export function chestOdds(chest: GearChest, luck: number): Record<Rarity, number> {
  const w = chestWeights(chest, luck);
  const total = RARITY_ORDER.reduce((sum, r) => sum + w[r], 0);
  const out = {} as Record<Rarity, number>;
  for (const r of RARITY_ORDER) out[r] = total > 0 ? (w[r] / total) * 100 : 0;
  return out;
}

/**
 * Гарантия: столько сундуков подряд без эпической или легендарной вещи —
 * и следующая вещь будет не ниже эпической. Невезение не бесконечно.
 */
export const PITY_EVERY = 10;

/** Сколько вещей до гарантированной эпической. */
export function pityLeft(state: SaveState): number {
  return Math.max(1, PITY_EVERY - state.inventory.pity);
}
