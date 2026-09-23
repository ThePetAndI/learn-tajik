/**
 * Снаряжение: сундуки, улучшение, наряд. Что за вещи — в gear-items.ts.
 *
 * Сундук со снаряжением устроен честно:
 *  — шансы видны до покупки и ровно те, по которым идёт бросок;
 *  — повторная находка не пропадает, а становится осколками — на улучшение;
 *  — после PITY_EVERY вещей без эпической следующая будет не ниже эпической.
 */

import type { Rng } from '../core/rng';
import type { SaveState } from '../data/state';
import { applyPerks, perksOf, shopPrice } from './bonuses';
import { isOwned } from './catalog';
import {
  PITY_EVERY,
  RARITIES,
  RARITY_ORDER,
  chestWeights,
  gearLevel,
  gearOfRarity,
  getGear,
  getGearChest,
  type GearChest,
  type GearItem,
  type GearSlot,
  type Rarity,
} from './gear-items';

/* ————————————————————————— бросок ————————————————————————— */

function pickRarity(weights: Record<Rarity, number>, rng: Rng): Rarity {
  const total = RARITY_ORDER.reduce((sum, r) => sum + weights[r], 0);
  let roll = rng() * total;
  for (const r of RARITY_ORDER) {
    roll -= weights[r];
    if (roll < 0) return r;
  }
  return 'common';
}

/**
 * Что выпадет из сундука. Чистая функция — её проверяют тесты.
 * pity — сколько вещей подряд уже было без эпической; возвращается новое.
 */
export function rollGear(
  chest: GearChest,
  luck: number,
  pity: number,
  rng: Rng,
): { items: GearItem[]; pity: number } {
  const items: GearItem[] = [];
  let streak = Math.max(0, pity);
  const weights = chestWeights(chest, luck);

  for (let i = 0; i < chest.count; i++) {
    let rarity = pickRarity(weights, rng);
    // гарантия: невезение не бесконечно
    if (streak >= PITY_EVERY - 1 && (rarity === 'common' || rarity === 'rare')) {
      rarity = pickRarity({ common: 0, rare: 0, epic: weights.epic, legendary: weights.legendary }, rng);
    }
    const pool = gearOfRarity(rarity);
    const item = pool[Math.floor(rng() * pool.length)] ?? pool[0];
    if (!item) continue;
    items.push(item);
    streak = rarity === 'epic' || rarity === 'legendary' ? 0 : streak + 1;
  }
  return { items, pity: streak };
}

/* ————————————————————————— сундук ————————————————————————— */

export interface GearDrop {
  item: GearItem;
  /** Вещь найдена впервые. */
  isNew: boolean;
  /** Сколько осколков дала повторная находка; 0 — если вещь новая. */
  shards: number;
}

/** Цена сундука для этого игрока: монеты — со скидкой лавки, лаъл — как есть. */
export function gearChestPrice(state: SaveState, chest: GearChest): { coins: number; gems: number } {
  return { coins: chest.coins > 0 ? shopPrice(state, chest.coins) : 0, gems: chest.gems };
}

export type ChestCheck = 'ok' | 'no-such-chest' | 'not-enough-coins' | 'not-enough-gems';

export function canOpenGearChest(state: SaveState, id: string): ChestCheck {
  const chest = getGearChest(id);
  if (!chest) return 'no-such-chest';
  const price = gearChestPrice(state, chest);
  if (state.wallet.coins < price.coins) return 'not-enough-coins';
  if (state.wallet.gems < price.gems) return 'not-enough-gems';
  return 'ok';
}

/** Покупает и открывает сундук. null — не хватило или нет такого. */
export function openGearChest(state: SaveState, id: string, rng: Rng, ts: number): GearDrop[] | null {
  if (canOpenGearChest(state, id) !== 'ok') return null;
  const chest = getGearChest(id) as GearChest;
  const price = gearChestPrice(state, chest);

  const { items, pity } = rollGear(chest, perksOf(state).luck, state.inventory.pity, rng);
  state.wallet.coins -= price.coins;
  state.wallet.gems -= price.gems;
  state.inventory.pity = pity;
  state.stats.cases += 1;

  const drops: GearDrop[] = [];
  for (const item of items) {
    if (gearLevel(state, item.id) === 0) {
      state.inventory.gear[item.id] = 1;
      drops.push({ item, isNew: true, shards: 0 });
    } else {
      const shards = RARITIES[item.rarity].shards;
      state.inventory.shards += shards;
      drops.push({ item, isNew: false, shards });
    }
  }
  // новая вещь могла оказаться надетой раньше (после импорта) — пересчитать не повредит
  applyPerks(state, ts);
  return drops;
}

/* ————————————————————————— улучшение ————————————————————————— */

/** Цена перехода с уровня level на следующий. */
export function upgradeCost(item: GearItem, level: number): { coins: number; shards: number } {
  const r = RARITIES[item.rarity];
  return {
    coins: Math.round(r.coins * Math.pow(1.3, Math.max(0, level - 1))),
    shards: r.shardCost * Math.max(1, level),
  };
}

export type GearUpgradeCheck = 'ok' | 'no-such-item' | 'not-owned' | 'maxed' | 'not-enough-coins' | 'not-enough-shards';

export function canUpgradeGear(state: SaveState, id: string): GearUpgradeCheck {
  const item = getGear(id);
  if (!item) return 'no-such-item';
  const level = gearLevel(state, id);
  if (level === 0) return 'not-owned';
  if (level >= RARITIES[item.rarity].maxLevel) return 'maxed';
  const cost = upgradeCost(item, level);
  if (state.wallet.coins < cost.coins) return 'not-enough-coins';
  if (state.inventory.shards < cost.shards) return 'not-enough-shards';
  return 'ok';
}

export function upgradeGear(state: SaveState, id: string, ts: number): GearUpgradeCheck {
  const check = canUpgradeGear(state, id);
  if (check !== 'ok') return check;
  const item = getGear(id) as GearItem;
  const level = gearLevel(state, id);
  const cost = upgradeCost(item, level);
  state.wallet.coins -= cost.coins;
  state.inventory.shards -= cost.shards;
  state.inventory.gear[id] = level + 1;
  applyPerks(state, ts);
  return 'ok';
}

/* ————————————————————————— наряд ————————————————————————— */

/**
 * Надевает вещь на питомца. У каждого питомца свой наряд: сменили
 * питомца — его наряд вернулся вместе с ним. Одну и ту же вещь могут
 * носить разные питомцы: работает всё равно только наряд активного.
 */
export function equipGear(state: SaveState, petId: string, id: string, ts: number): boolean {
  const item = getGear(id);
  if (!item || gearLevel(state, id) === 0 || !isOwned(state, petId)) return false;
  const outfit = { ...(state.inventory.worn[petId] ?? {}) };
  outfit[item.slot] = id;
  state.inventory.worn[petId] = outfit;
  applyPerks(state, ts);
  return true;
}

export function unequipGear(state: SaveState, petId: string, slot: GearSlot, ts: number): void {
  const outfit = { ...(state.inventory.worn[petId] ?? {}) };
  delete outfit[slot];
  state.inventory.worn[petId] = outfit;
  applyPerks(state, ts);
}
