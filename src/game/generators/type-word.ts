/**
 * Напиши слово. Самое трудное задание уровня: перевод надо не узнать,
 * а вспомнить и написать. Поэтому берём только короткие слова из одной
 * части — длинное набирать на телефоне мучительно, и это проверяет
 * терпение, а не память.
 */

import type { Rng } from '../../core/rng';
import type { Word } from '../../data/content';
import type { TypeWordExercise } from '../types';
import { isSingleToken, posLabel, type LevelPool } from './pool';

const MIN_LETTERS = 2;
const MAX_LETTERS = 9;

export function makeTypeWord(
  _pool: LevelPool,
  word: Word,
  _rng: Rng,
): TypeWordExercise | null {
  const tg = word.tg.normalize('NFC');
  if (!isSingleToken(tg)) return null;
  if (tg.length < MIN_LETTERS || tg.length > MAX_LETTERS) return null;
  // «нағз, хуб» в ответе — перевод неоднозначен, набирать нечего
  if (word.ru.includes(',')) return null;

  return {
    kind: 'type_word',
    wordIds: [word.id],
    ru: word.ru,
    tg,
    hint: posLabel(word.pos),
  };
}
