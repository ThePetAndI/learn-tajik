/**
 * Загрузка курса из /content. Файлы попадают в бандл на сборке
 * (import.meta.glob), поэтому в рантайме ничего не качается и всё работает офлайн.
 *
 * Добавили новый файл в content/words — он подхватится сам, править код не нужно.
 */

/* ————————————————————————————— типы ————————————————————————————— */

export type PartOfSpeech =
  | 'noun'
  | 'verb'
  | 'adj'
  | 'adv'
  | 'pron'
  | 'num'
  | 'prep'
  | 'conj'
  | 'part'
  | 'interj'
  | 'phrase';

export interface Example {
  tg: string;
  ru: string;
}

export interface Word {
  id: string;
  tg: string;
  ru: string;
  pos: PartOfSpeech;
  theme: string;
  example?: Example | null;
  /** Задел на будущее: озвучки пока нет, поле всегда null. */
  audio?: string | null;
  verified: boolean;
  note?: string;
}

export interface Phrase {
  id: string;
  tg: string;
  ru: string;
  theme: string;
  /** Слова, встречающиеся во фразе. */
  words?: string[];
  audio?: string | null;
  verified: boolean;
  note?: string;
}

export interface Letter {
  lower: string;
  upper: string;
  name: string;
  sound: string;
  ru: string | null;
  /** true для шести букв, которых нет в русском алфавите. */
  special: boolean;
  note?: string;
  examples?: string[];
  verified: boolean;
}

export interface ExerciseSpec {
  type: string;
  [key: string]: unknown;
}

export interface CourseLevel {
  id: string;
  title: string;
  words?: string[];
  phrases?: string[];
  exercises?: 'auto' | ExerciseSpec[];
  kind?: string;
  boss?: boolean;
}

export interface CourseSection {
  id: string;
  title: string;
  color?: string;
  icon?: string;
  levels: CourseLevel[];
}

/** Уровень вместе с местом в курсе — то, чем оперируют карта и движок. */
export interface FlatLevel {
  id: string;
  title: string;
  wordIds: string[];
  phraseIds: string[];
  exercises: 'auto' | ExerciseSpec[];
  kind: string;
  boss: boolean;
  sectionId: string;
  sectionTitle: string;
  sectionColor: string;
  sectionIcon: string;
  /** Сквозной номер с нуля. */
  index: number;
  /** Номер внутри раздела с нуля. */
  indexInSection: number;
  sectionIndex: number;
  /** Можно ли в него играть: без слов задания не собрать. */
  playable: boolean;
}

/* ————————————————————————————— чтение файлов ————————————————————————————— */

type Module = { default?: unknown } | unknown;

function pickDefault(mod: Module): unknown {
  if (mod && typeof mod === 'object' && 'default' in (mod as Record<string, unknown>)) {
    return (mod as { default: unknown }).default;
  }
  return mod;
}

const wordModules = import.meta.glob('../../content/words/*.json', { eager: true });
const phraseModules = import.meta.glob('../../content/phrases/*.json', { eager: true });
const courseModules = import.meta.glob('../../content/course.json', { eager: true });
const alphabetModules = import.meta.glob('../../content/alphabet.json', { eager: true });

function collect<T>(modules: Record<string, Module>, field: string): T[] {
  const out: T[] = [];
  for (const mod of Object.values(modules)) {
    const data = pickDefault(mod) as Record<string, unknown> | undefined;
    const list = data?.[field];
    if (Array.isArray(list)) out.push(...(list as T[]));
  }
  return out;
}

/* ————————————————————————————— индексы ————————————————————————————— */

const wordList = collect<Word>(wordModules, 'words');
const phraseList = collect<Phrase>(phraseModules, 'phrases');
const letterList = collect<Letter>(alphabetModules, 'letters');

export const words: ReadonlyMap<string, Word> = new Map(wordList.map((w) => [w.id, w]));
export const phrases: ReadonlyMap<string, Phrase> = new Map(phraseList.map((p) => [p.id, p]));
export const letters: readonly Letter[] = letterList;

const byTheme = new Map<string, Word[]>();
for (const w of wordList) {
  const list = byTheme.get(w.theme);
  if (list) list.push(w);
  else byTheme.set(w.theme, [w]);
}

export const sections: readonly CourseSection[] = (() => {
  for (const mod of Object.values(courseModules)) {
    const data = pickDefault(mod) as { sections?: CourseSection[] } | undefined;
    if (Array.isArray(data?.sections)) return data.sections;
  }
  return [];
})();

/** Плоский список уровней в порядке карты. */
export const levels: readonly FlatLevel[] = (() => {
  const out: FlatLevel[] = [];
  sections.forEach((section, sectionIndex) => {
    section.levels.forEach((level, indexInSection) => {
      const wordIds = level.words ?? [];
      const phraseIds = level.phrases ?? [];
      const kind = level.kind ?? 'words';
      out.push({
        id: level.id,
        title: level.title,
        wordIds,
        phraseIds,
        exercises: level.exercises ?? 'auto',
        kind,
        boss: level.boss === true,
        sectionId: section.id,
        sectionTitle: section.title,
        sectionColor: section.color ?? 'green',
        sectionIcon: section.icon ?? 'book',
        index: out.length,
        indexInSection,
        sectionIndex,
        // уровень алфавита играбелен без слов: он про буквы
        playable: kind === 'alphabet' ? letterList.length > 0 : wordIds.length + phraseIds.length > 0,
      });
    });
  });
  return out;
})();

const levelById = new Map(levels.map((l) => [l.id, l]));

/* ————————————————————————————— доступ ————————————————————————————— */

export function getWord(id: string): Word | undefined {
  return words.get(id);
}

export function getPhrase(id: string): Phrase | undefined {
  return phrases.get(id);
}

export function getLevel(id: string): FlatLevel | undefined {
  return levelById.get(id);
}

/** Слова темы — из них берутся правдоподобные неверные варианты. */
export function wordsOfTheme(theme: string): readonly Word[] {
  return byTheme.get(theme) ?? [];
}

export function allWords(): readonly Word[] {
  return wordList;
}

export function allPhrases(): readonly Phrase[] {
  return phraseList;
}

/** Сводка для экрана «Слова» и диагностики. */
export function contentStats(): {
  words: number;
  phrases: number;
  letters: number;
  sections: number;
  levels: number;
  playableLevels: number;
} {
  return {
    words: wordList.length,
    phrases: phraseList.length,
    letters: letterList.length,
    sections: sections.length,
    levels: levels.length,
    playableLevels: levels.filter((l) => l.playable).length,
  };
}
