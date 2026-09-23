/**
 * Колесо букв. Берём слово подлиннее, его буквы кладём на колесо,
 * а целями делаем слова, которые из этих букв собираются.
 * Если нашлось меньше двух — задание не складывается, возвращаем null.
 *
 * Цели — только слова этого урока и пройденных раньше. Раньше их брали
 * из всего словаря курса, и в первом же уроке колесо просило собрать
 * «мо» и «сол» — слова из разделов, до которых игрок ещё не дошёл.
 */

import type { Rng } from '../../core/rng';
import { shuffle } from '../../core/rng';
import type { Word } from '../../data/content';
import type { LetterWheelExercise } from '../types';
import { canSpell, isSingleToken, letterCounts, type LevelPool } from './pool';

const MIN_KEY_LETTERS = 4;
const MAX_KEY_LETTERS = 7;
const MIN_TARGET_LETTERS = 2;
const MIN_TARGETS = 2;
const MAX_TARGETS = 6;

export function makeLetterWheel(pool: LevelPool, rng: Rng): LetterWheelExercise | null {
  const keys = shuffle(
    rng,
    pool.words.filter(
      (w) =>
        isSingleToken(w.tg) &&
        w.tg.length >= MIN_KEY_LETTERS &&
        w.tg.length <= MAX_KEY_LETTERS,
    ),
  ).sort((a, b) => b.tg.length - a.tg.length);

  for (const key of keys) {
    const available = letterCounts(key.tg);
    const targets = collectTargets(pool, key, available);
    if (targets.length < MIN_TARGETS) continue;

    return {
      kind: 'letter_wheel',
      wordIds: targets.map((w) => w.id),
      letters: shuffle(rng, [...key.tg.normalize('NFC').toLowerCase()]),
      targets: targets.map((w) => ({
        wordId: w.id,
        tg: w.tg.normalize('NFC').toLowerCase(),
        ru: w.ru,
      })),
    };
  }
  return null;
}

function collectTargets(pool: LevelPool, key: Word, available: Map<string, number>): Word[] {
  const found: Word[] = [key];
  const seen = new Set([key.tg.normalize('NFC').toLowerCase()]);

  // сначала слова уровня — так задание остаётся по теме, — потом пройденные
  for (const source of [pool.words, pool.priorWords]) {
    for (const word of source) {
      if (found.length >= MAX_TARGETS) break;
      const tg = word.tg.normalize('NFC').toLowerCase();
      if (seen.has(tg)) continue;
      if (!isSingleToken(tg) || tg.length < MIN_TARGET_LETTERS) continue;
      if (!canSpell(tg, available)) continue;
      seen.add(tg);
      found.push(word);
    }
  }

  return found.sort((a, b) => a.tg.length - b.tg.length || a.tg.localeCompare(b.tg));
}
