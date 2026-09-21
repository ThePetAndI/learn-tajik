/** Собери фразу: перевод предложения из банка слов, с лишними словами. */

import type { Rng } from '../../core/rng';
import { shuffle } from '../../core/rng';
import type { Phrase } from '../../data/content';
import { tokenize } from '../../domain/answer';
import type { BuildPhraseExercise } from '../types';
import type { LevelPool } from './pool';

const MIN_TOKENS = 2;
const MAX_TOKENS = 7;
/** Сколько лишних слов подкладываем в банк. */
const DISTRACTORS = 3;

export function makeBuildPhrase(
  pool: LevelPool,
  phrase: Phrase,
  rng: Rng,
): BuildPhraseExercise | null {
  const answer = tokenize(phrase.tg);
  if (answer.length < MIN_TOKENS || answer.length > MAX_TOKENS) return null;

  const used = new Set(answer.map((t) => t.toLowerCase()));
  const extras: string[] = [];

  // Лишние слова берём из других фраз той же темы: они выглядят уместно
  const otherTokens = shuffle(
    rng,
    pool.phrases
      .filter((p) => p.id !== phrase.id)
      .flatMap((p) => tokenize(p.tg)),
  );
  for (const token of otherTokens) {
    if (extras.length >= DISTRACTORS) break;
    const key = token.toLowerCase();
    if (used.has(key)) continue;
    used.add(key);
    extras.push(token);
  }

  // Если фраз мало — добираем отдельными словами уровня
  if (extras.length < DISTRACTORS) {
    for (const word of shuffle(rng, [...pool.words])) {
      if (extras.length >= DISTRACTORS) break;
      const token = word.tg.split(/\s+/)[0] ?? '';
      const key = token.toLowerCase();
      if (!token || used.has(key)) continue;
      used.add(key);
      extras.push(token);
    }
  }

  return {
    kind: 'build_phrase',
    wordIds: phrase.words ?? [],
    ru: phrase.ru,
    tg: phrase.tg,
    bank: shuffle(rng, [...answer, ...extras]),
    answer,
  };
}
