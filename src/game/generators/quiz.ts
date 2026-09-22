/** Квиз на четыре варианта: таджикский -> русский и обратно. */

import type { Rng } from '../../core/rng';
import { shuffle } from '../../core/rng';
import type { Word } from '../../data/content';
import type { QuizExercise } from '../types';
import { pickDistractors, posLabel, type LevelPool } from './pool';

const OPTIONS = 4;

export function makeQuiz(
  pool: LevelPool,
  word: Word,
  direction: 'tg_ru' | 'ru_tg',
  rng: Rng,
): QuizExercise | null {
  const answerField = direction === 'tg_ru' ? 'ru' : 'tg';
  const promptField = direction === 'tg_ru' ? 'tg' : 'ru';

  const distractors = pickDistractors(pool, word, OPTIONS - 1, answerField, rng);
  // Три варианта на выбор — минимум, иначе это не выбор
  if (distractors.length < 2) return null;

  const answer = word[answerField];
  const options = shuffle(rng, [answer, ...distractors]);
  const correct = options.indexOf(answer);

  return {
    kind: direction === 'tg_ru' ? 'quiz_tg_ru' : 'quiz_ru_tg',
    wordIds: [word.id],
    prompt: word[promptField],
    hint: direction === 'ru_tg' && word.pos ? posLabel(word.pos) : undefined,
    options,
    correct,
  };
}
