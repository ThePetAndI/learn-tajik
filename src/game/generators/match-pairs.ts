/** Найди пары: таджикские слова и их переводы. */

import type { Rng } from '../../core/rng';
import { sample } from '../../core/rng';
import type { MatchPairsExercise } from '../types';
import type { LevelPool } from './pool';

const MIN_PAIRS = 4;
const MAX_PAIRS = 5;

export function makeMatchPairs(pool: LevelPool, rng: Rng): MatchPairsExercise | null {
  // Добор из словаря — помощь уровню, где слов мало, а не способ собрать
  // задание из чужих слов. Уровню без собственных слов пары не положены.
  if (pool.words.length < 2) return null;

  const candidates = [...pool.words];
  if (candidates.length < MIN_PAIRS) {
    const theme = candidates[0]?.theme;
    const known = new Set(candidates.map((w) => w.id));
    for (const word of pool.vocabulary) {
      if (candidates.length >= MAX_PAIRS) break;
      if (known.has(word.id) || (theme && word.theme !== theme)) continue;
      candidates.push(word);
      known.add(word.id);
    }
  }
  if (candidates.length < MIN_PAIRS) return null;

  const chosen = sample(rng, candidates, MAX_PAIRS);
  // Одинаковые переводы сделали бы задание нерешаемым
  const seenRu = new Set<string>();
  const seenTg = new Set<string>();
  const pairs = chosen.filter((w) => {
    const ru = w.ru.trim().toLowerCase();
    const tg = w.tg.trim().toLowerCase();
    if (seenRu.has(ru) || seenTg.has(tg)) return false;
    seenRu.add(ru);
    seenTg.add(tg);
    return true;
  });
  if (pairs.length < MIN_PAIRS) return null;

  return {
    kind: 'match_pairs',
    wordIds: pairs.map((w) => w.id),
    pairs: pairs.map((w) => ({ wordId: w.id, tg: w.tg, ru: w.ru })),
  };
}
