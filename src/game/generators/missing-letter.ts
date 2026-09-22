/**
 * Пропущенная буква. Смысл задания — шесть особых букв: ҳ против х,
 * қ против к и так далее. Поэтому дырку сверлим в первую очередь на месте
 * особой буквы, а неверные варианты берём из похожих, а не из случайных:
 * выбор между ҳ и х осмысленный, между ҳ и б — нет.
 */

import type { Rng } from '../../core/rng';
import { shuffle } from '../../core/rng';
import type { Word } from '../../data/content';
import { isSpecialLetter, lookalikesOf } from '../../domain/answer';
import type { MissingLetterExercise } from '../types';
import { isSingleToken, type LevelPool } from './pool';

const MIN_LETTERS = 3;
const MAX_LETTERS = 12;
const OPTIONS = 4;

export function makeMissingLetter(
  pool: LevelPool,
  word: Word,
  rng: Rng,
): MissingLetterExercise | null {
  const tg = word.tg.normalize('NFC').toLowerCase();
  if (!isSingleToken(tg)) return null;
  if (tg.length < MIN_LETTERS || tg.length > MAX_LETTERS) return null;

  const chars = [...tg];
  const index = pickHole(chars, rng);
  if (index < 0) return null;

  const answer = chars[index] as string;
  const options = buildOptions(pool, chars, answer, rng);
  if (options.length < 3) return null;

  const shuffled = shuffle(rng, options);
  return {
    kind: 'missing_letter',
    explain: explainLetter(pool, answer),
    wordIds: [word.id],
    before: chars.slice(0, index).join(''),
    after: chars.slice(index + 1).join(''),
    ru: word.ru,
    options: shuffled,
    correct: shuffled.indexOf(answer),
    special: isSpecialLetter(answer),
  };
}

/** Сначала особая буква, потом любая с похожими, иначе задание не собирается. */
function pickHole(chars: readonly string[], rng: Rng): number {
  const positions = chars.map((_, i) => i);
  const special = positions.filter((i) => isSpecialLetter(chars[i] as string));
  if (special.length > 0) return shuffle(rng, special)[0] as number;

  const withPairs = positions.filter((i) => lookalikesOf(chars[i] as string).length > 0);
  if (withPairs.length > 0) return shuffle(rng, withPairs)[0] as number;
  return -1;
}

function buildOptions(
  pool: LevelPool,
  chars: readonly string[],
  answer: string,
  rng: Rng,
): string[] {
  const used = new Set([answer]);
  const out = [answer];

  const take = (letters: readonly string[]): void => {
    for (const letter of letters) {
      if (out.length >= OPTIONS) return;
      if (used.has(letter)) continue;
      used.add(letter);
      out.push(letter);
    }
  };

  take(lookalikesOf(answer));
  // добираем буквами самого слова: они выглядят уместно и не подсказывают ответ
  take(shuffle(rng, chars.filter((c) => c !== answer)));
  if (out.length < OPTIONS) take(shuffle(rng, lettersAround(pool)));
  return out;
}

/** Буквы из слов уровня — запасной источник вариантов. */
function lettersAround(pool: LevelPool): string[] {
  const set = new Set<string>();
  for (const word of pool.words) {
    for (const ch of word.tg.normalize('NFC').toLowerCase()) {
      if (ch !== ' ' && ch !== '-') set.add(ch);
    }
  }
  return [...set];
}

/**
 * Разбор для полосы ошибки: чем эта буква отличается от своего двойника.
 * Берётся из описания звука в alphabet.json — второй раз писать то же самое
 * в коде значит завести два источника правды, которые разойдутся.
 */
function explainLetter(pool: LevelPool, letter: string): string | undefined {
  const entry = pool.alphabet.find((l) => l.lower === letter);
  if (!entry || !entry.sound) return undefined;
  const twin = lookalikesOf(letter).find((l) => pool.alphabet.some((a) => a.lower === l));
  const head = entry.upper + entry.lower + ' — ' + entry.sound + '.';
  return twin ? head + ' Не путать с «' + twin + '».' : head;
}
