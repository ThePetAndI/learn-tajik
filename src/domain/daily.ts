/**
 * Ежедневные награды: сундук за выполненную цель и колесо удачи.
 * Оба открываются раз в сутки по локальной дате устройства.
 */

import { pick, weightedPick, type Rng } from '../core/rng';
import { dayKey } from '../core/time';
import type { SaveState } from '../data/state';
import { chestRewardsFor, spinsPerDay } from './bonuses';
import { addLives, refillLives } from './lives';
import { dailyGoalReached } from './streak';

export type RewardKind = 'coins' | 'life' | 'lives_full' | 'booster' | 'freeze';

export interface Reward {
  kind: RewardKind;
  /** Сколько: монет, жизней или штук бустера. */
  amount: number;
  /** Для kind === 'booster' — что именно. */
  itemId?: string;
  label: string;
}

/* ————————————————————————— сундук ————————————————————————— */

const CHEST_REWARDS: { reward: Reward; weight: number }[] = [
  { reward: { kind: 'coins', amount: 25, label: '25 монет' }, weight: 30 },
  { reward: { kind: 'coins', amount: 50, label: '50 монет' }, weight: 22 },
  { reward: { kind: 'coins', amount: 100, label: '100 монет' }, weight: 8 },
  { reward: { kind: 'life', amount: 1, label: 'жизнь' }, weight: 18 },
  { reward: { kind: 'booster', amount: 1, itemId: 'hint', label: 'подсказка' }, weight: 12 },
  { reward: { kind: 'booster', amount: 1, itemId: 'fifty', label: 'подсказка 50/50' }, weight: 8 },
  { reward: { kind: 'freeze', amount: 1, label: 'заморозка стрика' }, weight: 2 },
];

export function chestOpenedToday(state: SaveState, ts: number): boolean {
  return state.daily.lastChestDay === dayKey(ts);
}

/** Сундук даётся за выполненную дневную цель, один раз в день. */
export function canOpenChest(state: SaveState, ts: number): boolean {
  return !chestOpenedToday(state, ts) && dailyGoalReached(state, ts);
}

export function rollChest(rng: Rng): Reward {
  return weightedPick(rng, CHEST_REWARDS, (r) => r.weight).reward;
}

/**
 * Открывает сундук и применяет награды. Обычно награда одна, «Щедрый день»
 * в дереве добавляет ещё. null — открывать нечего.
 */
export function openChest(state: SaveState, rng: Rng, ts: number): Reward[] | null {
  if (!canOpenChest(state, ts)) return null;
  const rewards: Reward[] = [];
  const n = chestRewardsFor(state);
  for (let i = 0; i < n; i++) rewards.push(rollChest(rng));
  state.daily.lastChestDay = dayKey(ts);
  for (const reward of rewards) applyReward(state, reward, ts);
  return rewards;
}

/* ————————————————————————— колесо удачи ————————————————————————— */

/** Сектора идут по кругу — порядок важен для анимации. */
export const WHEEL_SECTORS: Reward[] = [
  { kind: 'coins', amount: 20, label: '20' },
  { kind: 'life', amount: 1, label: 'жизнь' },
  { kind: 'coins', amount: 40, label: '40' },
  { kind: 'booster', amount: 1, itemId: 'hint', label: 'подсказка' },
  { kind: 'coins', amount: 60, label: '60' },
  { kind: 'booster', amount: 1, itemId: 'fifty', label: '50/50' },
  { kind: 'coins', amount: 120, label: '120' },
  { kind: 'lives_full', amount: 1, label: 'полный' },
];

/** Веса по номеру сектора: крупные награды реже. */
const WHEEL_WEIGHTS = [26, 16, 20, 12, 12, 8, 4, 2];

/**
 * Сколько вращений уже сделано сегодня. Старое сохранение счётчика не знает:
 * если день совпал, а счётчик пуст — значит, крутили один раз.
 */
export function spinsUsedToday(state: SaveState, ts: number): number {
  if (state.daily.lastWheelDay !== dayKey(ts)) return 0;
  return Math.max(1, state.daily.spins);
}

/** Сколько вращений осталось на сегодня — дерево даёт до трёх в день. */
export function spinsLeftToday(state: SaveState, ts: number): number {
  return Math.max(0, spinsPerDay(state) - spinsUsedToday(state, ts));
}

/** Все вращения на сегодня уже сделаны. */
export function wheelSpunToday(state: SaveState, ts: number): boolean {
  return spinsLeftToday(state, ts) === 0;
}

export function canSpinWheel(state: SaveState, ts: number): boolean {
  return !wheelSpunToday(state, ts);
}

/** Выбирает сектор. Возвращает его номер — по нему крутится анимация. */
export function rollWheel(rng: Rng): number {
  const indexes = WHEEL_SECTORS.map((_, i) => i);
  return weightedPick(rng, indexes, (i) => WHEEL_WEIGHTS[i] ?? 1);
}

export function spinWheel(
  state: SaveState,
  rng: Rng,
  ts: number,
): { index: number; reward: Reward } | null {
  if (!canSpinWheel(state, ts)) return null;
  const index = rollWheel(rng);
  const reward = WHEEL_SECTORS[index] as Reward;
  state.daily.spins = spinsUsedToday(state, ts) + 1;
  state.daily.lastWheelDay = dayKey(ts);
  applyReward(state, reward, ts);
  return { index, reward };
}

/* ————————————————————————— выдача награды ————————————————————————— */

export function applyReward(state: SaveState, reward: Reward, ts: number): void {
  switch (reward.kind) {
    case 'coins':
      state.wallet.coins += reward.amount;
      state.stats.coinsEarned += reward.amount;
      break;
    case 'life':
      addLives(state, reward.amount, ts);
      break;
    case 'lives_full':
      refillLives(state, ts);
      break;
    case 'booster': {
      const id = reward.itemId;
      if (!id) break;
      state.inventory.items[id] = (state.inventory.items[id] ?? 0) + reward.amount;
      break;
    }
    case 'freeze':
      state.streak.freezes = Math.min(99, state.streak.freezes + reward.amount);
      break;
  }
}

/** Случайная подпись для экрана награды — чтобы не повторялась одна и та же. */
export function rewardCheer(rng: Rng): string {
  return pick(rng, ['Ура!', 'Отлично!', 'Повезло!', 'Забирай!', 'Вот это да!']);
}
