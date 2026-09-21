/**
 * Статистика слов и интервальное повторение (SM-2 в упрощённом виде).
 *
 * Здесь две вещи, которые нужны в разных местах игры:
 *  — запись попытки: сколько раз слово показывали, сколько раз ошиблись,
 *    когда показать снова;
 *  — оценка сложности: какие слова даются хуже всего. По ней режим
 *    «Восстановление» набирает свою мини-сессию.
 *
 * Модуль чистый: время приходит аргументом, случайности нет.
 */

import { DAY, MINUTE } from '../core/time';
import { createWordStat, type SaveState, type WordStat } from '../data/state';

/** Коробки Лейтнера: базовый интервал в днях для каждой ступени. */
export const BOX_INTERVALS = [0, 1, 3, 7, 16, 35, 90] as const;
export const MAX_BOX = BOX_INTERVALS.length - 1;

export const MIN_EASE = 1.3;
export const MAX_EASE = 2.8;
const EASE_UP = 0.08;
const EASE_DOWN = 0.2;

/** После ошибки слово возвращается в ближайшую очередь, а не через сутки. */
const RETRY_DELAY_MS = 10 * MINUTE;

export function getWordStat(state: SaveState, wordId: string, ts: number): WordStat {
  return state.srs[wordId] ?? createWordStat(ts);
}

/**
 * Записывает попытку по слову и пересчитывает, когда показать его снова.
 * Возвращает обновлённую статистику (она же положена в state).
 */
export function recordWordAttempt(
  state: SaveState,
  wordId: string,
  correct: boolean,
  ts: number,
): WordStat {
  const stat = { ...getWordStat(state, wordId, ts) };

  stat.seen += 1;
  stat.lastAt = ts;

  if (correct) {
    stat.correct += 1;
    stat.streak += 1;
    stat.box = Math.min(MAX_BOX, stat.box + 1);
    stat.ease = Math.min(MAX_EASE, stat.ease + EASE_UP);
    stat.introduced = true;
    const base = BOX_INTERVALS[stat.box] ?? 0;
    stat.interval = base * (stat.ease / 2.5);
    stat.dueAt = ts + stat.interval * DAY;
  } else {
    stat.wrong += 1;
    stat.streak = 0;
    stat.box = 0;
    stat.ease = Math.max(MIN_EASE, stat.ease - EASE_DOWN);
    stat.interval = 0;
    stat.dueAt = ts + RETRY_DELAY_MS;
  }

  state.srs[wordId] = stat;
  return stat;
}

/** Записывает попытку сразу по нескольким словам (пары, колесо букв). */
export function recordAttemptWords(
  state: SaveState,
  wordIds: readonly string[],
  correct: boolean,
  ts: number,
): void {
  for (const id of wordIds) recordWordAttempt(state, id, correct, ts);
}

/**
 * Насколько слово трудное, 0..1.
 * Складывается из доли ошибок, того, сорвана ли серия, и того,
 * насколько далеко слово продвинулось по коробкам.
 */
export function wordDifficulty(stat: WordStat): number {
  if (stat.seen === 0) return 0.5;
  const wrongRate = stat.wrong / stat.seen;
  const brokenStreak = stat.streak === 0 ? 0.2 : 0;
  const shallowBox = (1 - stat.box / MAX_BOX) * 0.3;
  return Math.min(1, Math.max(0, wrongRate * 0.5 + brokenStreak + shallowBox));
}

/** Слово просрочено — пора повторить. */
export function isDue(stat: WordStat, ts: number): boolean {
  return stat.introduced && stat.dueAt <= ts;
}

/** Сколько слов ждут повторения прямо сейчас. */
export function dueCount(state: SaveState, ts: number): number {
  let n = 0;
  for (const stat of Object.values(state.srs)) {
    if (isDue(stat, ts)) n++;
  }
  return n;
}

/** Просроченные слова, самые давние первыми. */
export function dueWords(state: SaveState, ts: number, limit = 50): string[] {
  return Object.entries(state.srs)
    .filter(([, stat]) => isDue(stat, ts))
    .sort((a, b) => a[1].dueAt - b[1].dueAt)
    .slice(0, limit)
    .map(([id]) => id);
}

/**
 * Самые трудные слова — основа сессии восстановления.
 * Слова, где были ошибки, идут первыми; при равенстве — те, что давно не показывали.
 */
export function hardestWords(state: SaveState, limit: number, ts: number): string[] {
  const scored = Object.entries(state.srs)
    .filter(([, stat]) => stat.seen > 0)
    .map(([id, stat]) => ({ id, stat, score: wordDifficulty(stat) }));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.stat.wrong !== a.stat.wrong) return b.stat.wrong - a.stat.wrong;
    return a.stat.lastAt - b.stat.lastAt;
  });

  void ts;
  return scored.slice(0, limit).map((x) => x.id);
}

/** Просроченные слова из заданного набора — для повторения раздела. */
export function dueWordsFrom(
  state: SaveState,
  candidates: readonly string[],
  ts: number,
): string[] {
  return candidates.filter((id) => {
    const stat = state.srs[id];
    return stat !== undefined && isDue(stat, ts);
  });
}

/** Сколько слов набора уже знакомы игроку. */
export function introducedCount(state: SaveState, candidates: readonly string[]): number {
  let n = 0;
  for (const id of candidates) {
    if (state.srs[id]?.introduced) n++;
  }
  return n;
}

/**
 * Что показать в сессии повторения: сначала просроченное, потом трудное,
 * потом просто знакомое. Слова, которых игрок ещё не видел, не берём —
 * повторение не должно превращаться в изучение нового.
 */
export function reviewSelection(
  state: SaveState,
  candidates: readonly string[],
  limit: number,
  ts: number,
): string[] {
  const known = candidates.filter((id) => state.srs[id]?.introduced || (state.srs[id]?.seen ?? 0) > 0);
  const scored = known.map((id) => {
    const stat = state.srs[id] as WordStat;
    return { id, due: isDue(stat, ts), score: wordDifficulty(stat), lastAt: stat.lastAt };
  });
  scored.sort((a, b) => {
    if (a.due !== b.due) return a.due ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    return a.lastAt - b.lastAt;
  });
  return scored.slice(0, limit).map((x) => x.id);
}

export interface WordsSummary {
  /** Слов, которые уже встречались. */
  seen: number;
  /** Слов, отвеченных верно хотя бы раз. */
  introduced: number;
  /** Слов в дальних коробках — можно считать выученными. */
  learned: number;
  due: number;
}

export function wordsSummary(state: SaveState, ts: number): WordsSummary {
  let seen = 0;
  let introduced = 0;
  let learned = 0;
  let due = 0;
  for (const stat of Object.values(state.srs)) {
    if (stat.seen > 0) seen++;
    if (stat.introduced) introduced++;
    if (stat.box >= 4) learned++;
    if (isDue(stat, ts)) due++;
  }
  return { seen, introduced, learned, due };
}
