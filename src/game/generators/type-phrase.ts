/**
 * Напиши фразу — самое трудное задание курса и единственное продуктивное:
 * все остальные дают материал на экране, а здесь фразу надо построить с нуля.
 *
 * Поэтому оно и самое опасное. Два ограничения делают его честным.
 *
 * Первое — длина. Набирать на телефоне шесть слов с ғ, ӣ, қ, ӯ, ҳ, ҷ значит
 * проверять терпение, а не язык.
 *
 * Второе — фразу, которую ни разу не видели, набрать невозможно. Кто ставит
 * это задание, отвечает за то, что фраза на уровне уже была (см. index.ts):
 * сюда она приходит уже с гарантией.
 *
 * И третье: непроверенные фразы сюда не попадают. Узнать форму, в которой
 * мы не уверены, — полбеды; заставить её написать и засчитать ошибку за
 * отклонение от неё — уже вред.
 */

import type { Rng } from '../../core/rng';
import type { Phrase } from '../../data/content';
import { tokenize } from '../../domain/answer';
import type { TypePhraseExercise } from '../types';
import { phraseKey } from './phrase-intro';
import type { LevelPool } from './pool';

const MIN_TOKENS = 2;
const MAX_TOKENS = 4;
/** Потолок на всю фразу: столько букв ещё набирают, больше — мучение. */
const MAX_LETTERS = 22;

export function makeTypePhrase(
  pool: LevelPool,
  phrase: Phrase,
  _rng: Rng,
): TypePhraseExercise | null {
  if (!phrase.verified) return null;
  // как и слово: писать фразу просят, только если её объясняли до этого урока
  if (!pool.seenPhrases.has(phraseKey(phrase.id))) return null;

  const answer = tokenize(phrase.tg);
  if (answer.length < MIN_TOKENS || answer.length > MAX_TOKENS) return null;
  if (answer.reduce((n, w) => n + [...w].length, 0) > MAX_LETTERS) return null;

  const alt = (phrase.alt ?? [])
    .map(tokenize)
    .filter((tokens) => tokens.length > 0);

  return {
    kind: 'type_phrase',
    phraseId: phrase.id,
    wordIds: phrase.words ?? [],
    ru: phrase.ru,
    tg: phrase.tg,
    answer,
    ...(alt.length > 0 ? { alt } : {}),
  };
}
