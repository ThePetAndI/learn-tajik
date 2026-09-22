/**
 * Число и слово: «ҳафт» — набрать 7 на клавиатуре.
 *
 * Числительные — единственное, что можно проверить без перевода вообще:
 * цифра одинакова на любом языке, и ответ либо знаешь, либо нет.
 * Работает только на словах с полем num в контенте.
 */

import type { Rng } from '../../core/rng';
import type { Word } from '../../data/content';
import type { NumberWordExercise } from '../types';
import type { LevelPool } from './pool';

export function makeNumberWord(
  _pool: LevelPool,
  word: Word,
  _rng: Rng,
): NumberWordExercise | null {
  const value = word.num;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;

  return {
    kind: 'number_word',
    wordIds: [word.id],
    tg: word.tg,
    ru: word.ru,
    value: Math.round(value),
  };
}
