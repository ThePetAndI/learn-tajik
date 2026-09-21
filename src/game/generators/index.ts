/**
 * Сборка уровня: из слов и фраз получается последовательность заданий
 * разных типов. Всё детерминировано по ключу — одна и та же попытка
 * собирается одинаково, а тесты могут проверять результат.
 */

import { rngFor, shuffle, type Rng } from '../../core/rng';
import type { Phrase, Word } from '../../data/content';
import type { Exercise } from '../types';
import { makeBuildPhrase } from './build-phrase';
import { makeLetterWheel } from './letter-wheel';
import { makeMatchPairs } from './match-pairs';
import type { LevelPool } from './pool';
import { makeQuiz } from './quiz';

export { type LevelPool } from './pool';
export { makeBuildPhrase, makeLetterWheel, makeMatchPairs, makeQuiz };

/** Уровень короче шести заданий не ощущается уровнем, длиннее десяти — утомляет. */
export const MIN_EXERCISES = 6;
export const MAX_EXERCISES = 10;

export function makePool(
  words: Word[],
  phrases: Phrase[],
  vocabulary: readonly Word[],
): LevelPool {
  return { words, phrases, vocabulary };
}

/**
 * Порядок продуман: сначала знакомство со словами узнаванием,
 * потом то же самое наоборот (это труднее), между ними — задания,
 * которые дают отдохнуть от однотипного выбора.
 */
export function buildLevelExercises(pool: LevelPool, seedKey: string): Exercise[] {
  const rng: Rng = rngFor(seedKey);
  const words = shuffle(rng, pool.words);
  const phrases = shuffle(rng, pool.phrases);
  if (words.length === 0 && phrases.length === 0) return [];

  const out: Exercise[] = [];
  const covered = new Set<string>();
  const used = new Set<string>();

  const push = (exercise: Exercise | null): boolean => {
    if (!exercise || out.length >= MAX_EXERCISES) return false;
    const key = exercise.kind + ':' + exercise.wordIds.join(',');
    if (used.has(key)) return false;
    // два одинаковых задания подряд выглядят как баг
    if (out[out.length - 1]?.kind === exercise.kind && exercise.kind !== 'quiz_tg_ru') return false;
    used.add(key);
    out.push(exercise);
    for (const id of exercise.wordIds) covered.add(id);
    return true;
  };

  let wi = 0;
  for (let k = 0; k < 2 && wi < words.length; k++, wi++) {
    push(makeQuiz(pool, words[wi] as Word, 'tg_ru', rng));
  }

  push(makeMatchPairs(pool, rng));

  for (let k = 0; k < 2 && wi < words.length; k++, wi++) {
    push(makeQuiz(pool, words[wi] as Word, 'ru_tg', rng));
  }

  if (phrases[0]) push(makeBuildPhrase(pool, phrases[0], rng));
  push(makeLetterWheel(pool, rng));
  if (phrases[1]) push(makeBuildPhrase(pool, phrases[1], rng));

  // Каждое слово уровня должно встретиться хотя бы раз
  for (const word of words) {
    if (out.length >= MAX_EXERCISES) break;
    if (covered.has(word.id)) continue;
    push(makeQuiz(pool, word, 'tg_ru', rng)) || push(makeQuiz(pool, word, 'ru_tg', rng));
  }

  // Добиваем до минимума повторами в другую сторону
  for (let round = 0; round < 3 && out.length < MIN_EXERCISES; round++) {
    for (const word of words) {
      if (out.length >= MIN_EXERCISES) break;
      const dir = round % 2 === 0 ? 'ru_tg' : 'tg_ru';
      push(makeQuiz(pool, word, dir, rng));
    }
    if (phrases.length > 0) {
      for (const phrase of phrases) {
        if (out.length >= MIN_EXERCISES) break;
        push(makeBuildPhrase(pool, phrase, rng));
      }
    }
  }

  return out;
}
