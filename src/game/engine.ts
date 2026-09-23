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
  /**
   * Сколько заданий с ошибкой повторить в конце сессии. Повтор — тренировка:
   * игрок только что увидел верный ответ и закрепляет его. На звёзды, монеты
   * и серию повтор не влияет, но в статистику слова идёт — ради неё он и нужен.
   */
  retryMistakes?: number;
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
  /** Текущее задание — повтор ошибки в конце сессии. */
  isRetry: () => boolean;
  /** Текущее задание после ошибки вернётся в конце. */
  willRetry: () => boolean;
}

export function createSession(opts: SessionOptions): Session {
  /** Своя копия очереди: повторы дописываются в конец, массив вызывающего не трогаем. */
  const queue = [...opts.exercises];
  /** С какого места начинаются повторы. */
  const firstPass = queue.length;
  const retryCap = Math.max(0, opts.retryMistakes ?? 0);
  /** Какие задания первого прохода уже поставлены в повтор. */
  const queued = new Set<number>();

  const state: SessionState = {
    index: 0,
    total: queue.length,
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

    current: () => queue[state.index],

    attempt(attempt: Attempt) {
      if (state.index >= firstPass) {
        // повтор — только тренировка: в счёт урока не идёт, но слово запоминается
        opts.onAttempt?.(attempt);
        return;
      }
      if (!attempt.correct && !queued.has(state.index) && queued.size < retryCap) {
        const exercise = queue[state.index];
        if (exercise) {
          queued.add(state.index);
          queue.push(exercise);
          state.total = queue.length;
        }
      }
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

    isRetry: () => state.index >= firstPass,

    willRetry: () => queued.has(state.index),

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
