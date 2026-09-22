/**
 * Разложи по корзинам: слова темы уровня против слов пройденной темы.
 *
 * Как и в «лишнем слове», чужая корзина набирается только из пройденного:
 * раскладывать незнакомое — значит угадывать.
 */

import type { Rng } from '../../core/rng';
import { sample, shuffle } from '../../core/rng';
import type { Word } from '../../data/content';
import type { CategorySortExercise } from '../types';
import { mainTheme, themeLabel, type LevelPool } from './pool';

const PER_BASKET = 3;

export function makeCategorySort(pool: LevelPool, rng: Rng): CategorySortExercise | null {
  const theme = mainTheme(pool.words);
  if (!theme) return null;

  const own = pool.words.filter((w) => w.theme === theme);
  if (own.length < PER_BASKET) return null;

  const other = pickOtherTheme(pool, theme, rng);
  if (!other) return null;

  const labels: [string, string] = [themeLabel(pool, theme), themeLabel(pool, other.theme)];
  // две корзины с одинаковой подписью — задание без решения
  if (labels[0] === labels[1]) return null;

  const mine = sample(rng, own, PER_BASKET);
  const theirs = sample(rng, other.words, PER_BASKET);

  const items = shuffle(rng, [
    ...mine.map((w) => ({ wordId: w.id, tg: w.tg, ru: w.ru, basket: 0 as const })),
    ...theirs.map((w) => ({ wordId: w.id, tg: w.tg, ru: w.ru, basket: 1 as const })),
  ]);

  return {
    kind: 'category_sort',
    wordIds: items.map((i) => i.wordId),
    baskets: labels,
    items,
  };
}

/** Самая крупная из пройденных чужих тем — в ней точно наберётся три слова. */
function pickOtherTheme(
  pool: LevelPool,
  theme: string,
  rng: Rng,
): { theme: string; words: Word[] } | null {
  const byTheme = new Map<string, Word[]>();
  for (const word of pool.priorWords) {
    if (word.theme === theme) continue;
    const list = byTheme.get(word.theme);
    if (list) list.push(word);
    else byTheme.set(word.theme, [word]);
  }

  const usable = [...byTheme.entries()].filter(([, list]) => list.length >= PER_BASKET);
  if (usable.length === 0) return null;
  const picked = shuffle(rng, usable)[0] as [string, Word[]];
  return { theme: picked[0], words: picked[1] };
}
