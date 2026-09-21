/**
 * Жизни. Ошибка стоит одну жизнь, время восстанавливает по одной за 30 минут.
 * Главный способ вернуть жизни — не таймер, а режим «Восстановление» (см. recovery.ts).
 *
 * Модуль чистый: всё считается от переданной метки времени,
 * поэтому тесты просто двигают часы.
 */

import { MINUTE } from '../core/time';
import type { SaveState } from '../data/state';

/** Одна жизнь за полчаса. */
export const LIFE_REGEN_MS = 30 * MINUTE;

export interface LivesState {
  count: number;
  max: number;
  updatedAt: number;
}

export interface LivesView {
  count: number;
  max: number;
  /** Новая точка отсчёта — её нужно записать обратно в состояние. */
  updatedAt: number;
  /** Сколько миллисекунд до следующей жизни; 0 — когда запас полон. */
  msToNext: number;
  full: boolean;
}

/**
 * Пересчитывает жизни на момент ts, ничего не меняя.
 * Часы, переведённые назад, не должны давать бесконечное ожидание:
 * в этом случае просто переносим точку отсчёта на текущий момент.
 */
export function computeLives(lives: LivesState, ts: number): LivesView {
  const max = Math.max(1, lives.max);
  const count = Math.min(max, Math.max(0, lives.count));

  if (count >= max) {
    return { count: max, max, updatedAt: ts, msToNext: 0, full: true };
  }

  const elapsed = ts - lives.updatedAt;
  if (elapsed < 0) {
    // время уехало назад — начинаем отсчёт заново, жизни не теряем
    return { count, max, updatedAt: ts, msToNext: LIFE_REGEN_MS, full: false };
  }

  const gained = Math.floor(elapsed / LIFE_REGEN_MS);
  const next = Math.min(max, count + gained);

  if (next >= max) {
    return { count: max, max, updatedAt: ts, msToNext: 0, full: true };
  }

  const anchor = lives.updatedAt + gained * LIFE_REGEN_MS;
  return {
    count: next,
    max,
    updatedAt: anchor,
    msToNext: Math.max(0, LIFE_REGEN_MS - (ts - anchor)),
    full: false,
  };
}

/** Применяет накопленное восстановление к состоянию. Возвращает актуальный срез. */
export function syncLives(state: SaveState, ts: number): LivesView {
  const view = computeLives(state.lives, ts);
  state.lives.count = view.count;
  state.lives.max = view.max;
  state.lives.updatedAt = view.updatedAt;
  return view;
}

/** Списывает жизнь за ошибку. false — жизней не осталось. */
export function spendLife(state: SaveState, ts: number): boolean {
  const view = syncLives(state, ts);
  if (view.count <= 0) return false;
  // если запас был полон, отсчёт до следующей жизни начинается сейчас
  if (view.full) state.lives.updatedAt = ts;
  state.lives.count = view.count - 1;
  return true;
}

/** Добавляет n жизней (награда, восстановление, покупка). Возвращает, сколько реально добавилось. */
export function addLives(state: SaveState, n: number, ts: number): number {
  const view = syncLives(state, ts);
  const next = Math.min(view.max, view.count + Math.max(0, Math.floor(n)));
  const added = next - view.count;
  state.lives.count = next;
  if (next >= view.max) state.lives.updatedAt = ts;
  return added;
}

/** Полный запас — награда за завершённую сессию восстановления. */
export function refillLives(state: SaveState, ts: number): number {
  const view = syncLives(state, ts);
  const added = view.max - view.count;
  state.lives.count = view.max;
  state.lives.updatedAt = ts;
  return added;
}

/** Можно ли начать уровень. */
export function hasLives(state: SaveState, ts: number): boolean {
  return computeLives(state.lives, ts).count > 0;
}

/** Увеличение максимума (бонус питомца). Новые слоты сразу заполняются. */
export function setMaxLives(state: SaveState, max: number, ts: number): void {
  const nextMax = Math.max(1, Math.min(20, Math.floor(max)));
  const view = syncLives(state, ts);
  const grew = nextMax - view.max;
  state.lives.max = nextMax;
  if (grew > 0) state.lives.count = Math.min(nextMax, view.count + grew);
  else state.lives.count = Math.min(nextMax, state.lives.count);
}
