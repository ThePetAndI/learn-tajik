/**
 * Сессия уровня: очередь заданий, счёт, серии, награда.
 * Без DOM — экран уровня только отображает то, что здесь посчитано.
 */

import { coinsForAnswer } from '../domain/economy';
import { accuracy, starsFor } from '../domain/stars';
import type { Attempt, Exercise } from './types';

export interface SessionState {
  /** Номер текущего задания с нуля. */
  index: number;
  total: number;
  attempts: number;
  correct: number;
  mistakes: number;
  /** Верных ответов подряд прямо сейчас. */
  combo: number;
  bestCombo: number;
  /** Монеты, набранные за ответы (без награды за уровень). */
  coinsFromAnswers: number;
  finished: boolean;
}

export interface SessionResult {
  /** Уровень или «recovery» — сессия восстановления. */
  sessionId: string;
  total: number;
  attempts: number;
  correct: number;
  mistakes: number;
  bestCombo: number;
  coinsFromAnswers: number;
  accuracy: number;
  stars: number;
}

export interface SessionOptions {
  sessionId: string;
  exercises: Exercise[];
  /** Вызывается на каждую попытку — сюда подключится интервальное повторение. */
  onAttempt?: (attempt: Attempt) => void;
  /** Потолок бонуса за серию; без него — обычный из economy. */
  comboCap?: number;
}

export interface Session {
  readonly state: Readonly<SessionState>;
  current: () => Exercise | undefined;
  /** Записать попытку внутри задания. */
  attempt: (attempt: Attempt) => void;
  /** Перейти к следующему заданию. false — заданий больше нет. */
  advance: () => boolean;
  result: () => SessionResult;
  /** Доля пройденного, 0..1 — для полосы прогресса. */
  progress: () => number;
}

export function createSession(opts: SessionOptions): Session {
  const state: SessionState = {
    index: 0,
    total: opts.exercises.length,
    attempts: 0,
    correct: 0,
    mistakes: 0,
    combo: 0,
    bestCombo: 0,
    coinsFromAnswers: 0,
    finished: opts.exercises.length === 0,
  };

  return {
    state,

    current: () => opts.exercises[state.index],

    attempt(attempt: Attempt) {
      state.attempts++;
      if (attempt.correct) {
        // монеты считаются от серии ДО этого ответа
        state.coinsFromAnswers += coinsForAnswer(state.combo, opts.comboCap);
        state.correct++;
        state.combo++;
        if (state.combo > state.bestCombo) state.bestCombo = state.combo;
      } else {
        state.mistakes++;
        state.combo = 0;
      }
      opts.onAttempt?.(attempt);
    },

    advance() {
      if (state.finished) return false;
      state.index++;
      if (state.index >= state.total) {
        state.index = state.total;
        state.finished = true;
        return false;
      }
      return true;
    },

    progress() {
      if (state.total === 0) return 1;
      return Math.min(1, state.index / state.total);
    },

    result() {
      return {
        sessionId: opts.sessionId,
        total: state.total,
        attempts: state.attempts,
        correct: state.correct,
        mistakes: state.mistakes,
        bestCombo: state.bestCombo,
        coinsFromAnswers: state.coinsFromAnswers,
        accuracy: accuracy(state.correct, state.attempts),
        stars: starsFor(state.mistakes),
      };
    },
  };
}
