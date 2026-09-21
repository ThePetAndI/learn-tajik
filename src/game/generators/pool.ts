/**
 * Материал, из которого собираются задания уровня, и общие помощники.
 * Генератор, которому не хватает материала, возвращает null — движок
 * просто берёт задание другого типа. Молча подсовывать кривое задание нельзя.
 */

import type { Rng } from '../../core/rng';
import { sample, shuffle } from '../../core/rng';
import type { Phrase, Word } from '../../data/content';
import type { Exercise } from '../types';

export interface LevelPool {
  /** Слова уровня — то, чему учим прямо сейчас. */
  words: Word[];
  phrases: Phrase[];
  /** Весь словарь курса — источник правдоподобных неверных вариантов. */
  vocabulary: readonly Word[];
}

export type Generator = (pool: LevelPool, rng: Rng) => Exercise | null;

/**
 * Неверные варианты для квиза. Сначала берём слова той же темы —
 * выбирать между «отец» и «мать» сложнее и полезнее, чем между «отец» и «вторник».
 */
export function pickDistractors(
  pool: LevelPool,
  target: Word,
  count: number,
  field: 'tg' | 'ru',
  rng: Rng,
): string[] {
  const used = new Set([normalized(target[field])]);
  const out: string[] = [];

  const take = (candidates: readonly Word[]): void => {
    for (const word of shuffle(rng, candidates)) {
      if (out.length >= count) return;
      if (word.id === target.id) continue;
      const value = word[field];
      const key = normalized(value);
      if (used.has(key)) continue;
      used.add(key);
      out.push(value);
    }
  };

  take(pool.vocabulary.filter((w) => w.theme === target.theme));
  if (out.length < count) take(pool.words);
  if (out.length < count) take(pool.vocabulary);
  return out;
}

function normalized(value: string): string {
  return value.trim().toLowerCase();
}

/** Слова уровня, отсортированные так, чтобы порядок не зависел от файла. */
export function orderedWords(pool: LevelPool, rng: Rng): Word[] {
  return shuffle(rng, pool.words);
}

export function pickWords(pool: LevelPool, count: number, rng: Rng): Word[] {
  return sample(rng, pool.words, count);
}

/** Буквы слова как мультимножество — для проверки «собирается ли из набора». */
export function letterCounts(word: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const ch of word.normalize('NFC').toLowerCase()) {
    if (ch === ' ' || ch === '-') continue;
    counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }
  return counts;
}

/** Можно ли собрать слово из данного набора букв. */
export function canSpell(word: string, available: Map<string, number>): boolean {
  const need = letterCounts(word);
  for (const [ch, n] of need) {
    if ((available.get(ch) ?? 0) < n) return false;
  }
  return true;
}

/** Слово из одной части, без пробелов и дефисов — годится для колеса букв. */
export function isSingleToken(word: string): boolean {
  return !/[\s-]/.test(word.trim());
}
