/**
 * Прогресс по карте: что открыто, что пройдено, где игрок сейчас.
 * Модуль чистый — уровни и состояние приходят аргументами, поэтому тестируется
 * без загрузки контента.
 */

import type { FlatLevel } from '../data/content';
import type { LevelProgress, SaveState } from '../data/state';
import { MAX_STARS, accuracy, starsFor } from './stars';

/**
 * 'done'    — пройден;
 * 'current' — тот самый уровень, на котором игрок сейчас (ровно один на карте);
 * 'open'    — открыт, но не текущий: так выглядят уровни без заданий, через
 *             которые курс перешагнул;
 * 'locked'  — закрыт.
 */
export type LevelStatus = 'done' | 'current' | 'open' | 'locked';

export const EMPTY_PROGRESS: Readonly<LevelProgress> = Object.freeze({
  stars: 0,
  best: 0,
  attempts: 0,
  completedAt: null,
});

export function getLevelProgress(state: SaveState, levelId: string): Readonly<LevelProgress> {
  return state.levels[levelId] ?? EMPTY_PROGRESS;
}

export function isDone(state: SaveState, levelId: string): boolean {
  return getLevelProgress(state, levelId).stars > 0;
}

/**
 * Уровень открыт, если он первый или предыдущий играбельный уровень пройден.
 *
 * Уровень без контента пропускается при подсчёте: иначе один недописанный
 * раздел запирал бы весь курс дальше по карте. Запустить его всё равно нельзя.
 */
export function isUnlocked(state: SaveState, levels: readonly FlatLevel[], index: number): boolean {
  if (index <= 0) return true;
  if (index >= levels.length) return false;
  for (let i = index - 1; i >= 0; i--) {
    const prev = levels[i];
    if (!prev || !prev.playable) continue;
    return isDone(state, prev.id);
  }
  // до этого места играбельных уровней нет — открываем
  return true;
}

/**
 * Где игрок сейчас: первый непройденный играбельный уровень.
 * Если играть больше не во что — последний играбельный, иначе последний вообще.
 */
export function currentIndex(state: SaveState, levels: readonly FlatLevel[]): number {
  let lastPlayable = -1;
  for (let i = 0; i < levels.length; i++) {
    const level = levels[i];
    if (!level || !level.playable) continue;
    lastPlayable = i;
    if (!isDone(state, level.id)) return i;
  }
  if (lastPlayable >= 0) return lastPlayable;
  return Math.max(0, levels.length - 1);
}

export function statusOf(
  state: SaveState,
  levels: readonly FlatLevel[],
  index: number,
  current: number = currentIndex(state, levels),
): LevelStatus {
  const level = levels[index];
  if (!level) return 'locked';
  if (isDone(state, level.id)) return 'done';
  if (index === current) return 'current';
  return isUnlocked(state, levels, index) ? 'open' : 'locked';
}

export interface SectionSummary {
  sectionId: string;
  title: string;
  stars: number;
  maxStars: number;
  done: number;
  total: number;
  /** Раздел целиком закрыт. */
  locked: boolean;
}

export function sectionSummary(
  state: SaveState,
  levels: readonly FlatLevel[],
  sectionId: string,
): SectionSummary {
  let stars = 0;
  let done = 0;
  let total = 0;
  let locked = true;
  let title = '';
  for (let i = 0; i < levels.length; i++) {
    const level = levels[i];
    if (!level || level.sectionId !== sectionId) continue;
    title = level.sectionTitle;
    total++;
    const p = getLevelProgress(state, level.id);
    stars += p.stars;
    if (p.stars > 0) done++;
    if (locked && isUnlocked(state, levels, i)) locked = false;
  }
  return { sectionId, title, stars, maxStars: total * MAX_STARS, done, total, locked };
}

export function totalStars(state: SaveState): number {
  let sum = 0;
  for (const p of Object.values(state.levels)) sum += p.stars;
  return sum;
}

export interface CourseSummary {
  done: number;
  total: number;
  stars: number;
  maxStars: number;
}

export function courseSummary(state: SaveState, levels: readonly FlatLevel[]): CourseSummary {
  let done = 0;
  let stars = 0;
  for (const level of levels) {
    const p = getLevelProgress(state, level.id);
    if (p.stars > 0) done++;
    stars += p.stars;
  }
  return { done, total: levels.length, stars, maxStars: levels.length * MAX_STARS };
}

export interface LevelResult {
  stars: number;
  previousStars: number;
  /** Уровень пройден впервые. */
  firstClear: boolean;
  /** Звёзд стало больше, чем было. */
  improved: boolean;
  accuracy: number;
}

/**
 * Записывает итог уровня. Звёзды и лучшая точность только растут:
 * переигрывать ради тренировки можно без риска испортить результат.
 */
export function recordLevelResult(
  state: SaveState,
  levelId: string,
  correct: number,
  total: number,
  mistakes: number,
  ts: number,
): LevelResult {
  const prev = state.levels[levelId];
  const previousStars = prev?.stars ?? 0;
  const stars = starsFor(mistakes);
  const acc = accuracy(correct, total);

  const next: LevelProgress = {
    stars: Math.max(previousStars, stars),
    best: Math.max(prev?.best ?? 0, acc),
    attempts: (prev?.attempts ?? 0) + 1,
    completedAt: prev?.completedAt ?? ts,
  };
  state.levels[levelId] = next;

  const firstClear = previousStars === 0;
  if (firstClear) state.stats.levelsDone += 1;

  return {
    stars,
    previousStars,
    firstClear,
    improved: stars > previousStars,
    accuracy: acc,
  };
}
