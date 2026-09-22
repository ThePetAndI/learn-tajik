/**
 * Сборка материала уровня. Единственное место, где генераторы встречаются
 * с контентом: сами они — чистые функции над готовым пулом.
 *
 * Диалоги и изафеты цепляются к уровню по теме его слов, а не списком в
 * course.json: дописал диалог с темой «family» — он сам появится на семейных
 * уровнях, править код не нужно.
 */

import {
  allWords,
  dialoguesOfThemes,
  getLetter,
  getPhrase,
  getWord,
  izafetsOfThemes,
  levels,
  sections,
  type FlatLevel,
  type Letter,
  type Phrase,
  type Word,
} from '../data/content';
import { getState } from '../core/store';
import { makePool, type LevelPool } from './generators';

/**
 * Названия тем по-русски берём из заголовков разделов курса — но не у первого
 * раздела, который тему задел, а у того, где её слов больше всего.
 *
 * Раздел «Алфавит» на примерах занимает слова изо всех тем сразу, и по правилу
 * «первый попавшийся» приветствия, семья и числа разом получали бы название
 * «Алфавит». Две корзины с одинаковой подписью — задание, которое нельзя решить.
 */
const themeTitles: Record<string, string> = (() => {
  const counts = new Map<string, Map<string, number>>();
  for (const section of sections) {
    for (const level of section.levels) {
      for (const id of level.words ?? []) {
        const word = getWord(id);
        if (!word) continue;
        const perSection = counts.get(word.theme) ?? new Map<string, number>();
        perSection.set(section.title, (perSection.get(section.title) ?? 0) + 1);
        counts.set(word.theme, perSection);
      }
    }
  }

  const out: Record<string, string> = {};
  for (const [theme, perSection] of counts) {
    let best = '';
    let bestN = 0;
    for (const [title, n] of perSection) {
      if (n > bestN) {
        best = title;
        bestN = n;
      }
    }
    if (best) out[theme] = best;
  }
  return out;
})();

/** Слова, введённые до каждого уровня. Считается один раз при первом обращении. */
let priorCache: Word[][] | null = null;

function priorWordsFor(index: number): readonly Word[] {
  if (!priorCache) {
    priorCache = [];
    const seen = new Set<string>();
    const running: Word[] = [];
    for (const level of levels) {
      priorCache.push([...running]);
      for (const id of level.wordIds) {
        if (seen.has(id)) continue;
        const word = getWord(id);
        if (!word) continue;
        seen.add(id);
        running.push(word);
      }
    }
  }
  return priorCache[index] ?? [];
}

function themesOf(words: readonly Word[]): string[] {
  return [...new Set(words.map((w) => w.theme))];
}

/**
 * С какими словами игрок ещё не знаком. Незнакомо всё, что он ни разу
 * не назвал верно: и то, что видит впервые, и то, что пока не даётся.
 *
 * Считаем по всему словарю, а не только по словам уровня: задания
 * подтягивают слова и со стороны — пара из соседней темы, лишнее слово
 * из пройденного раздела, — и их тоже нельзя спрашивать вслепую.
 */
function freshWords(): Set<string> {
  const srs = getState().srs;
  const out = new Set<string>();
  for (const word of allWords()) {
    if (!srs[word.id]?.introduced) out.add(word.id);
  }
  return out;
}

/** Пул уровня карты. */
export function poolForLevel(level: FlatLevel): LevelPool {
  const words = level.wordIds
    .map(getWord)
    .filter((w): w is Word => Boolean(w));
  const phrases = level.phraseIds
    .map(getPhrase)
    .filter((p): p is Phrase => Boolean(p));
  const letters = level.letterChars
    .map(getLetter)
    .filter((l): l is Letter => Boolean(l));
  const themes = themesOf(words);

  return makePool(words, phrases, allWords(), {
    priorWords: priorWordsFor(level.index),
    letters,
    dialogues: dialoguesOfThemes(themes),
    izafets: izafetsOfThemes(themes),
    themeTitles,
    freshWords: freshWords(),
  });
}

/**
 * Пул для сессий повторения и восстановления: слова берутся отовсюду,
 * букв и «пройденного раньше» здесь нет — на карте они уже позади.
 * Знакомить тоже не с чем: повторяют только то, что уже знают.
 */
export function poolForWords(words: Word[], phrases: Phrase[]): LevelPool {
  const themes = themesOf(words);
  return makePool(words, phrases, allWords(), {
    priorWords: words,
    dialogues: dialoguesOfThemes(themes),
    izafets: izafetsOfThemes(themes),
    themeTitles,
  });
}
