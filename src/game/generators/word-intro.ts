/**
 * Знакомство со словом — карточка, которая показывается перед первой
 * проверкой этого слова.
 *
 * Без неё первое, что игрок узнаёт о слове, — это вопрос о нём: выбери
 * перевод из четырёх, угадай. Угадывание не учит, а первое впечатление
 * о слове тратится впустую.
 */

import type { Word } from '../../data/content';
import { specialLettersOf } from '../../domain/answer';
import type { WordIntroExercise } from '../types';
import { posLabel } from './pool';

export function makeWordIntro(word: Word, remind = false): WordIntroExercise {
  return {
    kind: 'word_intro',
    ...(remind ? { remind: true } : {}),
    wordIds: [word.id],
    tg: word.tg,
    ru: word.ru,
    pos: posLabel(word.pos),
    ...(word.also && word.also.length > 0 ? { also: [...word.also] } : {}),
    example: word.example ? { tg: word.example.tg, ru: word.example.ru } : undefined,
    letters: specialLettersOf(word.tg),
    audio: word.audio ?? null,
  };
}
