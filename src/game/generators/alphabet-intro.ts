/**
 * Знакомство с буквой: карточка со звуком и примерами, затем проверка
 * «найди эту букву» среди похожих.
 *
 * Проверка именно среди похожих: человек, впервые увидевший ҳ, узнает её
 * рядом с б и м без всякого знания. Рядом с х — только если запомнил.
 */

import type { Rng } from '../../core/rng';
import { shuffle } from '../../core/rng';
import type { Letter, Word } from '../../data/content';
import { lookalikesOf } from '../../domain/answer';
import type { AlphabetIntroExercise } from '../types';
import type { LevelPool } from './pool';

const MAX_EXAMPLES = 3;
const TILES = 4;

export function makeAlphabetIntro(
  pool: LevelPool,
  letter: Letter,
  rng: Rng,
): AlphabetIntroExercise | null {
  const lower = letter.lower.normalize('NFC').toLowerCase();
  const examples = collectExamples(pool, letter, lower).slice(0, MAX_EXAMPLES);
  // Буква без примеров — это карточка ни о чём
  if (examples.length === 0) return null;

  const options = buildTiles(lower, examples, rng);
  if (options.length < 3) return null;

  const tiles = shuffle(rng, options);
  return {
    kind: 'alphabet_intro',
    wordIds: examples.map((e) => e.id),
    lower,
    upper: letter.upper,
    name: letter.name,
    sound: letter.sound,
    ru: letter.ru,
    note: letter.note || undefined,
    examples: examples.map((w) => ({ tg: w.tg, ru: w.ru })),
    options: tiles,
    correct: tiles.indexOf(lower),
  };
}

/** Примеры буквы из контента; если их нет — ищем слова уровня с этой буквой. */
function collectExamples(pool: LevelPool, letter: Letter, lower: string): Word[] {
  const byId = new Map(pool.vocabulary.map((w) => [w.id, w]));
  const out: Word[] = [];
  const seen = new Set<string>();

  for (const id of letter.examples ?? []) {
    const word = byId.get(id);
    if (!word || seen.has(word.id)) continue;
    // контент мог разъехаться — показываем только слова, где буква правда есть
    if (!word.tg.normalize('NFC').toLowerCase().includes(lower)) continue;
    seen.add(word.id);
    out.push(word);
  }

  if (out.length === 0) {
    for (const word of pool.words) {
      if (out.length >= MAX_EXAMPLES) break;
      if (!word.tg.normalize('NFC').toLowerCase().includes(lower)) continue;
      out.push(word);
    }
  }
  return out;
}

function buildTiles(lower: string, examples: readonly Word[], rng: Rng): string[] {
  const used = new Set([lower]);
  const out = [lower];

  const take = (letters: readonly string[]): void => {
    for (const ch of letters) {
      if (out.length >= TILES) return;
      if (used.has(ch) || ch === ' ' || ch === '-') continue;
      used.add(ch);
      out.push(ch);
    }
  };

  take(lookalikesOf(lower));
  // добираем буквами из примеров — все они таджикские и выглядят уместно
  const around = examples.flatMap((w) => [...w.tg.normalize('NFC').toLowerCase()]);
  take(shuffle(rng, around));
  return out;
}
