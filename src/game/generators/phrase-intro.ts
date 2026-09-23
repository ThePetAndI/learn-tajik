/**
 * Карточка знакомства с фразой или разговором.
 *
 * Показывает перевод целиком и каждое слово отдельно, в словарной форме.
 * Форма во фразе может отличаться — «меравам» во фразе, «рафтан» в словаре, —
 * но смысл каждого слова теперь известен, а как слово меняется, объясняет
 * правило в начале раздела.
 */

import type { Dialogue, Example, Phrase, Word } from '../../data/content';
import type { PhraseIntroExercise } from '../types';

/**
 * Слова фразы с переводом. Значение берётся из словаря, но если в контенте
 * у фразы указано своё значение слова (gloss), берётся оно: словарное иногда
 * сбивает — «хайр» в словаре «пока», а в «Шаб ба хайр» это «добро».
 */
function gloss(
  ids: readonly string[],
  vocabulary: ReadonlyMap<string, Word>,
  own: readonly Example[] = [],
): { tg: string; ru: string }[] {
  const override = new Map(own.map((g) => [g.tg.normalize('NFC').toLowerCase(), g.ru]));
  const out: { tg: string; ru: string }[] = [];
  for (const id of ids) {
    const word = vocabulary.get(id);
    if (!word) continue;
    const key = word.tg.normalize('NFC').toLowerCase();
    out.push({ tg: word.tg, ru: override.get(key) ?? word.ru });
  }
  return out;
}

export function phraseKey(id: string): string {
  return 'p:' + id;
}

export function dialogueKey(id: string): string {
  return 'd:' + id;
}

export function makePhraseIntro(phrase: Phrase, vocabulary: ReadonlyMap<string, Word>): PhraseIntroExercise {
  return {
    kind: 'phrase_intro',
    key: phraseKey(phrase.id),
    wordIds: phrase.words ?? [],
    lines: [{ tg: phrase.tg, ru: phrase.ru }],
    gloss: gloss(phrase.words ?? [], vocabulary, phrase.gloss),
  };
}

export function makeDialogueIntro(dialogue: Dialogue, vocabulary: ReadonlyMap<string, Word>): PhraseIntroExercise {
  return {
    kind: 'phrase_intro',
    key: dialogueKey(dialogue.id),
    wordIds: dialogue.words ?? [],
    lines: [
      { tg: dialogue.ask.tg, ru: dialogue.ask.ru, who: 'them' },
      { tg: dialogue.reply.tg, ru: dialogue.reply.ru, who: 'me' },
    ],
    gloss: gloss(dialogue.words ?? [], vocabulary, dialogue.gloss),
  };
}
