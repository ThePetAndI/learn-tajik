/**
 * Стрик — сколько дней подряд игрок занимается.
 *
 * День засчитывается за первое же упражнение: цель здесь — вернуть человека
 * завтра, а не заставить отсидеть норму. Заморозка из магазина прикрывает
 * ровно один пропущенный день.
 */

import { dayKey, daysBetween } from '../core/time';
import type { SaveState } from '../data/state';

export interface StreakChange {
  /** Стрик увеличился сегодня впервые. */
  advanced: boolean;
  /** Стрик прервался и начался заново. */
  broken: boolean;
  /** Пропуск прикрыт заморозкой. */
  frozen: boolean;
  current: number;
  best: number;
}

/**
 * Отмечает активность. Вызывается на первый ответ в сессии;
 * повторные вызовы в тот же день ничего не меняют.
 */
export function touchStreak(state: SaveState, ts: number): StreakChange {
  const today = dayKey(ts);
  const last = state.streak.lastDayKey;

  if (last === today) {
    return {
      advanced: false,
      broken: false,
      frozen: false,
      current: state.streak.current,
      best: state.streak.best,
    };
  }

  let broken = false;
  let frozen = false;

  if (last === null) {
    state.streak.current = 1;
  } else {
    const gap = daysBetween(last, today);
    if (gap <= 0) {
      // часы перевели назад — не наказываем и не награждаем
      return {
        advanced: false,
        broken: false,
        frozen: false,
        current: state.streak.current,
        best: state.streak.best,
      };
    }
    if (gap === 1) {
      state.streak.current += 1;
    } else if (gap === 2 && state.streak.freezes > 0) {
      // ровно один пропущенный день можно закрыть заморозкой
      state.streak.freezes -= 1;
      state.streak.current += 1;
      frozen = true;
    } else {
      state.streak.current = 1;
      broken = true;
    }
  }

  state.streak.lastDayKey = today;
  if (state.streak.current > state.streak.best) state.streak.best = state.streak.current;

  return {
    advanced: true,
    broken,
    frozen,
    current: state.streak.current,
    best: state.streak.best,
  };
}

/**
 * Актуальное значение стрика для показа: если последний день занятий
 * был давно, число уже не действует, даже если в состоянии оно осталось.
 */
export function visibleStreak(state: SaveState, ts: number): number {
  const last = state.streak.lastDayKey;
  if (last === null) return 0;
  const gap = daysBetween(last, dayKey(ts));
  if (gap <= 0) return state.streak.current;
  if (gap === 1) return state.streak.current;
  if (gap === 2 && state.streak.freezes > 0) return state.streak.current;
  return 0;
}

/** Сегодня уже занимались? */
export function practicedToday(state: SaveState, ts: number): boolean {
  return state.streak.lastDayKey === dayKey(ts);
}

/** Счётчик упражнений за сегодня — по нему открывается сундук. */
export function countDailyExercise(state: SaveState, ts: number): number {
  const today = dayKey(ts);
  if (state.daily.todayKey !== today) {
    state.daily.todayKey = today;
    state.daily.todayCount = 0;
  }
  state.daily.todayCount += 1;
  return state.daily.todayCount;
}

/** Сколько упражнений сделано сегодня (без изменения состояния). */
export function todayCount(state: SaveState, ts: number): number {
  return state.daily.todayKey === dayKey(ts) ? state.daily.todayCount : 0;
}

/** Выполнена ли дневная цель. */
export function dailyGoalReached(state: SaveState, ts: number): boolean {
  return todayCount(state, ts) >= state.settings.dailyGoal;
}
