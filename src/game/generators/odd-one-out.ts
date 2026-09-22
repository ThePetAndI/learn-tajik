/**
 * Лишнее слово: три слова одной темы и одно чужое.
 *
 * Чужое берём только из пройденного (pool.priorWords). Слово, которого
 * игрок ещё не видел, в такой задаче — не проверка, а угадайка: «лишним»
 * окажется просто незнакомое.
 */

import type { Rng } from '../../core/rng';
import { sample, shuffle } from '../../core/rng';
import type { Word } from '../../data/content';
import type { OddOneOutExercise } from '../types';
import { mainTheme, themeLabel, type LevelPool } from './pool';

const SAME = 3;

export function makeOddOneOut(pool: LevelPool, rng: Rng): OddOneOutExercise | null {
  const theme = mainTheme(pool.words);
  if (!theme) return null;

  const own = pool.words.filter((w) => w.theme === theme);
  if (own.length < SAME) return null;

  const label = themeLabel(pool, theme);
  // чужое слово должно быть из темы, которая и называется иначе:
  // иначе объяснение «остальные — «семья»» окажется верным и для лишнего
  const strangers = pool.priorWords.filter(
    (w) => w.theme !== theme && themeLabel(pool, w.theme) !== label,
  );
  if (strangers.length === 0) return null;

  const picked = sample(rng, own, SAME);
  const odd = sample(rng, strangers, 1)[0] as Word;

  // одинаковые переводы сделали бы «лишнее» спорным
  const seen = new Set(picked.map((w) => w.ru.trim().toLowerCase()));
  if (seen.has(odd.ru.trim().toLowerCase())) return null;

  const options = shuffle(rng, [...picked, odd]);
  return {
    kind: 'odd_one_out',
    wordIds: options.map((w) => w.id),
    theme: label,
    options: options.map((w) => ({ wordId: w.id, tg: w.tg, ru: w.ru })),
    correct: options.indexOf(odd),
  };
}
