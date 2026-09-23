/**
 * Коллекция: вехи собирательства — питомцы, снаряжение, звёзды, угощения.
 *
 * Награда за веху — не лаъл: лаъл даётся только за учёбу, а коллекцию
 * собирают на монеты, и через неё монеты превращались бы в лаъл. Поэтому
 * награды — вещи: бесплатная лона, караван, осколки, монеты. Каждая веха —
 * один раз, по ключу в ледгере наград, и забирается кнопкой: награду видно,
 * её не начисляют молча где-то в глубине покупки.
 */

import type { Rng } from '../core/rng';
import type { SaveState } from '../data/state';
import { applyPerks } from './bonuses';
import { allPets, isOwned, petRank, MAX_PET_RANK } from './catalog';
import { hasGrant } from './gems';
import { openGearChest, type GearDrop } from './gear';
import { GEAR, getGearChest } from './gear-items';
import { getPetChest, openPetChest, type PetDrop } from './pets';

export interface CollectionReward {
  coins?: number;
  shards?: number;
  /** Лона, которая откроется бесплатно. */
  nest?: string;
  /** Сундук снаряжения, который откроется бесплатно. */
  chest?: string;
}

export interface CollectionGoal {
  id: string;
  title: string;
  icon: string;
  n: number;
  progress: (state: SaveState) => number;
  reward: CollectionReward;
}

const petsOwned = (s: SaveState): number => allPets().filter((p) => isOwned(s, p.id)).length;
const gearOwned = (s: SaveState): number => GEAR.filter((g) => (s.inventory.gear[g.id] ?? 0) > 0).length;
const topRank = (s: SaveState): number => Math.max(...allPets().map((p) => (isOwned(s, p.id) ? petRank(s, p.id) : 0)));

export const COLLECTION: readonly CollectionGoal[] = [
  { id: 'pets4', title: 'Четыре питомца', icon: 'paw', n: 4, progress: petsOwned, reward: { nest: 'pc_lona' } },
  { id: 'pets6', title: 'Шесть питомцев', icon: 'paw', n: 6, progress: petsOwned, reward: { coins: 500, nest: 'pc_lona' } },
  { id: 'pets8', title: 'Восемь питомцев', icon: 'paw', n: 8, progress: petsOwned, reward: { nest: 'pc_lona_lal' } },
  {
    id: 'pets10', title: 'Все питомцы', icon: 'crown', n: allPets().length, progress: petsOwned,
    reward: { coins: 1000, nest: 'pc_lona_lal' },
  },
  { id: 'star5', title: 'Питомец на пяти звёздах', icon: 'star', n: MAX_PET_RANK, progress: topRank, reward: { nest: 'pc_lona_lal' } },
  { id: 'gear8', title: 'Восемь вещей', icon: 'hat', n: 8, progress: gearOwned, reward: { shards: 40 } },
  { id: 'gear16', title: 'Шестнадцать вещей', icon: 'necklace', n: 16, progress: gearOwned, reward: { chest: 'gc_caravan' } },
  {
    id: 'gear24', title: 'Всё снаряжение', icon: 'crown', n: GEAR.length, progress: gearOwned,
    reward: { coins: 1000, shards: 200 },
  },
  { id: 'meals10', title: 'Десять угощений', icon: 'osh', n: 10, progress: (s) => s.stats.meals, reward: { coins: 300 } },
];

function ledgerKey(goal: CollectionGoal): string {
  return 'collection:' + goal.id;
}

export type GoalStatus = 'claimed' | 'ready' | 'progress';

export function goalStatus(state: SaveState, goal: CollectionGoal): GoalStatus {
  if (hasGrant(state, ledgerKey(goal))) return 'claimed';
  return goal.progress(state) >= goal.n ? 'ready' : 'progress';
}

/** Сколько наград ждут, чтобы их забрали, — для точки на вкладке. */
export function claimableCount(state: SaveState): number {
  return COLLECTION.filter((g) => goalStatus(state, g) === 'ready').length;
}

export interface Claimed {
  goal: CollectionGoal;
  coins: number;
  shards: number;
  petDrop?: PetDrop;
  gearDrops?: GearDrop[];
}

/** Забирает награду вехи. null — веха не выполнена или уже забрана. */
export function claimGoal(state: SaveState, id: string, rng: Rng, ts: number): Claimed | null {
  const goal = COLLECTION.find((g) => g.id === id);
  if (!goal || goalStatus(state, goal) !== 'ready') return null;
  state.achievements[ledgerKey(goal)] = ts;

  const out: Claimed = { goal, coins: goal.reward.coins ?? 0, shards: goal.reward.shards ?? 0 };
  state.wallet.coins += out.coins;
  state.inventory.shards += out.shards;
  const free = { coins: 0, gems: 0 };
  if (goal.reward.nest && getPetChest(goal.reward.nest)) {
    out.petDrop = openPetChest(state, goal.reward.nest, rng, ts, free) ?? undefined;
  }
  if (goal.reward.chest && getGearChest(goal.reward.chest)) {
    out.gearDrops = openGearChest(state, goal.reward.chest, rng, ts, free) ?? undefined;
  }
  applyPerks(state, ts);
  return out;
}
