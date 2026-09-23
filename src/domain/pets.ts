/**
 * Питомцы из лоны: выпадение, копии, звёзды и обмен копий.
 *
 * Лона — гнездо: сундук, из которого выходит питомец. Выпал новый — он ваш.
 * Выпал тот, что уже есть, — это не потеря, а копия: копии соединяются,
 * и питомец получает звезду. Звёзды умножают его бонус и меняют вид.
 *
 * Лишние копии одной редкости можно обменять: три копии — и приходит
 * питомец редкостью выше. Так даже самые частые повторки ведут к редкому
 * зверю, а не копятся мёртвым грузом.
 *
 * Честность та же, что у сундуков снаряжения: шансы видны до покупки
 * и ровно те, по которым идёт бросок; после PET_PITY питомцев без
 * эпического следующий — не ниже эпического.
 */

import type { Rng } from '../core/rng';
import type { SaveState } from '../data/state';
import { applyPerks, perksOf, shopPrice } from './bonuses';
import {
  MAX_PET_RANK,
  allPets,
  getItem,
  isOwned,
  petCopies,
  petRank,
  type ShopItem,
} from './catalog';
import { luckyWeights, nextRarity, oddsOf, pickRarity, type Rarity } from './rarity';

/* ————————————————————————— лона ————————————————————————— */

export interface PetChest {
  id: string;
  title: string;
  /** Перевод названия — мелко под ним. */
  ru: string;
  about: string;
  /** Цена: в монетах или в лаъл, одно из двух. */
  coins: number;
  gems: number;
  weights: Record<Rarity, number>;
  tone: string;
}

export const PET_CHESTS: readonly PetChest[] = [
  {
    id: 'pc_lona',
    title: 'Лона',
    ru: 'гнездо',
    about: 'Один питомец любой редкости.',
    coins: 700,
    gems: 0,
    weights: { common: 64, rare: 26, epic: 8, legendary: 2 },
    tone: 'orange',
  },
  {
    id: 'pc_lona_lal',
    title: 'Лонаи лаъл',
    ru: 'рубиновое гнездо',
    about: 'Один питомец — редкий или лучше.',
    coins: 0,
    gems: 25,
    weights: { common: 0, rare: 55, epic: 35, legendary: 10 },
    tone: 'ruby',
  },
];

/** Столько питомцев подряд без эпического — и следующий будет не ниже. */
export const PET_PITY = 10;

export function getPetChest(id: string): PetChest | undefined {
  return PET_CHESTS.find((c) => c.id === id);
}

export function petsOfRarity(rarity: Rarity): ShopItem[] {
  return allPets().filter((p) => (p.rarity ?? 'common') === rarity);
}

/** Шансы лона с учётом удачи — ровно то, по чему идёт бросок. */
export function petChestOdds(chest: PetChest, luck: number): Record<Rarity, number> {
  return oddsOf(luckyWeights(chest.weights, luck));
}

/** Сколько питомцев до гарантированного эпического. */
export function petPityLeft(state: SaveState): number {
  return Math.max(1, PET_PITY - state.inventory.petPity);
}

/**
 * Кто выйдет из лона. Чистая функция — её проверяют тесты.
 * pity — сколько питомцев подряд уже было без эпического; возвращается новое.
 */
export function rollPet(
  chest: PetChest,
  luck: number,
  pity: number,
  rng: Rng,
): { pet: ShopItem; pity: number } | null {
  const weights = luckyWeights(chest.weights, luck);
  let rarity = pickRarity(weights, rng());
  if (pity >= PET_PITY - 1 && (rarity === 'common' || rarity === 'rare')) {
    rarity = pickRarity({ common: 0, rare: 0, epic: weights.epic, legendary: weights.legendary }, rng());
  }
  const pool = petsOfRarity(rarity);
  const pet = pool[Math.floor(rng() * pool.length)] ?? pool[0];
  if (!pet) return null;
  return { pet, pity: rarity === 'epic' || rarity === 'legendary' ? 0 : pity + 1 };
}

export interface PetDrop {
  pet: ShopItem;
  /** Питомец новый — теперь он ваш. */
  isNew: boolean;
  /** Сколько копий добавилось; 0 — если питомец новый. */
  copies: number;
}

/**
 * Выдаёт питомца: новый становится вашим, повтор — копией. «Двойня» из
 * дерева иногда даёт две копии вместо одной.
 */
function grantPet(state: SaveState, pet: ShopItem, rng: Rng): PetDrop {
  if (!isOwned(state, pet.id)) {
    state.inventory.owned.push(pet.id);
    return { pet, isNew: true, copies: 0 };
  }
  const extra = rng() < perksOf(state).extraCopy ? 1 : 0;
  const copies = 1 + extra;
  state.inventory.petCopies[pet.id] = petCopies(state, pet.id) + copies;
  return { pet, isNew: false, copies };
}

/** Цена лона для этого игрока: монеты — со скидкой лавки, лаъл — как есть. */
export function petChestPrice(state: SaveState, chest: PetChest): { coins: number; gems: number } {
  return { coins: chest.coins > 0 ? shopPrice(state, chest.coins) : 0, gems: chest.gems };
}

export type PetChestCheck = 'ok' | 'no-such-chest' | 'not-enough-coins' | 'not-enough-gems';

export function canOpenPetChest(state: SaveState, id: string): PetChestCheck {
  const chest = getPetChest(id);
  if (!chest) return 'no-such-chest';
  const price = petChestPrice(state, chest);
  if (state.wallet.coins < price.coins) return 'not-enough-coins';
  if (state.wallet.gems < price.gems) return 'not-enough-gems';
  return 'ok';
}

/**
 * Покупает и открывает лону. null — не хватило или нет такой.
 * pay — своя цена вместо обычной: так лону продаёт товар дня.
 */
export function openPetChest(
  state: SaveState,
  id: string,
  rng: Rng,
  ts: number,
  pay?: { coins: number; gems: number },
): PetDrop | null {
  const chest = getPetChest(id);
  if (!chest) return null;
  const price = pay ?? petChestPrice(state, chest);
  if (state.wallet.coins < price.coins || state.wallet.gems < price.gems) return null;
  const rolled = rollPet(chest, perksOf(state).petLuck, state.inventory.petPity, rng);
  if (!rolled) return null;

  state.wallet.coins -= price.coins;
  state.wallet.gems -= price.gems;
  state.inventory.petPity = rolled.pity;
  state.stats.cases += 1;
  const drop = grantPet(state, rolled.pet, rng);
  applyPerks(state, ts);
  return drop;
}

/** Копия уже знакомого питомца — так её продаёт товар дня. false — питомца нет. */
export function giveCopy(state: SaveState, id: string, ts: number): boolean {
  const pet = getItem(id);
  if (!pet || pet.kind !== 'pet' || !isOwned(state, id)) return false;
  state.inventory.petCopies[id] = petCopies(state, id) + 1;
  applyPerks(state, ts);
  return true;
}

/* ————————————————————————— звёзды ————————————————————————— */

/** Копий на переход к следующей звезде: индекс — текущие звёзды. */
const RANK_COPIES = [0, 1, 2, 3, 4];
/** Монет на переход к следующей звезде у обычного питомца. */
const RANK_COINS = [0, 200, 450, 900, 1600];
/** Чем реже питомец, тем дороже его звёзды в монетах. */
const RARITY_FACTOR: Record<Rarity, number> = { common: 1, rare: 1.3, epic: 1.7, legendary: 2.2 };

/** Что стоит следующая звезда. null — звёзд уже максимум. */
export function rankUpCost(state: SaveState, id: string): { copies: number; coins: number } | null {
  const pet = getItem(id);
  if (!pet || pet.kind !== 'pet') return null;
  const rank = petRank(state, id);
  if (rank >= MAX_PET_RANK) return null;
  const factor = RARITY_FACTOR[pet.rarity ?? 'common'];
  const discount = perksOf(state).mergeDiscount;
  return {
    copies: RANK_COPIES[rank] ?? 99,
    coins: Math.round((RANK_COINS[rank] ?? 0) * factor * (1 - discount)),
  };
}

export type RankUpCheck = 'ok' | 'no-such-pet' | 'not-owned' | 'maxed' | 'not-enough-copies' | 'not-enough-coins';

export function canRankUp(state: SaveState, id: string): RankUpCheck {
  const pet = getItem(id);
  if (!pet || pet.kind !== 'pet') return 'no-such-pet';
  if (!isOwned(state, id)) return 'not-owned';
  const cost = rankUpCost(state, id);
  if (!cost) return 'maxed';
  if (petCopies(state, id) < cost.copies) return 'not-enough-copies';
  if (state.wallet.coins < cost.coins) return 'not-enough-coins';
  return 'ok';
}

/** Соединяет копии: питомец получает звезду, бонус растёт сразу. */
export function rankUp(state: SaveState, id: string, ts: number): RankUpCheck {
  const check = canRankUp(state, id);
  if (check !== 'ok') return check;
  const cost = rankUpCost(state, id)!;
  state.inventory.petCopies[id] = petCopies(state, id) - cost.copies;
  state.wallet.coins -= cost.coins;
  state.inventory.petRanks[id] = petRank(state, id) + 1;
  applyPerks(state, ts);
  return 'ok';
}

/* ————————————————————————— обмен копий ————————————————————————— */

/** Сколько копий одной редкости уходит в обмен. */
export const FUSE_COPIES = 3;
/** Сбор за обмен в монетах — по редкости того, что отдают. */
const FUSE_COINS: Record<Rarity, number> = { common: 150, rare: 300, epic: 600, legendary: 0 };

/** Сколько копий питомцев этой редкости лежит про запас. */
export function spareCopies(state: SaveState, rarity: Rarity): number {
  return petsOfRarity(rarity).reduce((sum, p) => sum + petCopies(state, p.id), 0);
}

/**
 * Какие копии уйдут: сначала у тех, у кого их больше всего, — у них запас
 * глубже всего. Это показывается игроку до подтверждения.
 */
export function fusionPlan(state: SaveState, rarity: Rarity): { id: string; n: number }[] {
  const plan: { id: string; n: number }[] = [];
  const left = new Map(petsOfRarity(rarity).map((p) => [p.id, petCopies(state, p.id)]));
  for (let k = 0; k < FUSE_COPIES; k++) {
    let best = '';
    let bestN = 0;
    for (const [id, n] of left) {
      if (n > bestN) {
        best = id;
        bestN = n;
      }
    }
    if (!best) return [];
    left.set(best, bestN - 1);
    const row = plan.find((r) => r.id === best);
    if (row) row.n++;
    else plan.push({ id: best, n: 1 });
  }
  return plan;
}

export function fusionCost(state: SaveState, rarity: Rarity): number {
  return shopPrice(state, FUSE_COINS[rarity]);
}

export type FuseCheck = 'ok' | 'top-rarity' | 'not-enough-copies' | 'not-enough-coins';

export function canFuse(state: SaveState, rarity: Rarity): FuseCheck {
  if (!nextRarity(rarity)) return 'top-rarity';
  if (spareCopies(state, rarity) < FUSE_COPIES) return 'not-enough-copies';
  if (state.wallet.coins < fusionCost(state, rarity)) return 'not-enough-coins';
  return 'ok';
}

/** Три копии одной редкости — питомец редкостью выше, случайный. */
export function fuse(state: SaveState, rarity: Rarity, rng: Rng, ts: number): PetDrop | null {
  if (canFuse(state, rarity) !== 'ok') return null;
  const target = nextRarity(rarity) as Rarity;
  const pool = petsOfRarity(target);
  const pet = pool[Math.floor(rng() * pool.length)] ?? pool[0];
  if (!pet) return null;

  for (const { id, n } of fusionPlan(state, rarity)) {
    state.inventory.petCopies[id] = petCopies(state, id) - n;
  }
  state.wallet.coins -= fusionCost(state, rarity);
  const drop = grantPet(state, pet, rng);
  applyPerks(state, ts);
  return drop;
}
