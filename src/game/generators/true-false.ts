/**
 * Правда или ложь на время: «китоб = книга?».
 *
 * Пара «наполовину верная» — подставной перевод берётся из той же темы.
 * Если бы «китоб» сравнивали с «понедельником», ответить можно было бы,
 * не зная слова вовсе.
 */

import type { Rng } from '../../core/rng';
import type { Word } from '../../data/content';
import type { TrueFalseExercise } from '../types';
import { pickDistractors, type LevelPool } from './pool';

/** Секунд на ответ. Для начинающего восемь секунд — это спокойное чтение. */
export const TRUE_FALSE_SECONDS = 8;

export function makeTrueFalse(
  pool: LevelPool,
  word: Word,
  rng: Rng,
): TrueFalseExercise | null {
  const truth = rng() < 0.5;
  if (truth) {
    return {
      kind: 'true_false',
      wordIds: [word.id],
      tg: word.tg,
      ru: word.ru,
      realRu: word.ru,
      truth: true,
      seconds: TRUE_FALSE_SECONDS,
    };
  }

  const fake = pickDistractors(pool, word, 1, 'ru', rng)[0];
  if (!fake) return null;

  return {
    kind: 'true_false',
    wordIds: [word.id],
    tg: word.tg,
    ru: fake,
    realRu: word.ru,
    truth: false,
    seconds: TRUE_FALSE_SECONDS,
  };
}
