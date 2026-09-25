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
  /** Числовое значение — только у числительных, для мини-игры «число и слово». */
  num?: number | null;
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
  /**
   * Другие верные переводы той же русской фразы — для задания «Напиши фразу»,
   * где ответ набирается руками. По-таджикски подлежащее-местоимение часто
   * опускают («Ба хона меравам» вместо «Ман ба хона меравам»), и таких мест
   * в языке много. Пока список пуст везде: заполнять его есть смысл только
   * с носителем, иначе мы засчитываем то, в чём сами не уверены.
   */
  alt?: string[];
  /**
   * Значение слова именно в этой фразе, если оно не то, что в словаре.
   * Карточка фразы разбирает её по словам, и словарное значение иногда
   * сбивает: «хайр» в словаре — «пока», а в «Шаб ба хайр» — «добро».
   * Здесь достаточно указать только такие слова, остальные берутся из словаря.
   */
  gloss?: Example[];
  audio?: string | null;
  verified: boolean;
  note?: string;
}

/** Мини-диалог: реплика собеседника и верный ответ. */
export interface Dialogue {
  id: string;
  theme: string;
  ask: Example;
  reply: Example;
  /** Свои неверные варианты; если пусто — берутся реплики других диалогов. */
  wrong?: Example[];
  words?: string[];
  /** Значение слова в этом разговоре, если оно не словарное (см. Phrase.gloss). */
  gloss?: Example[];
  audio?: string | null;
  verified: boolean;
  note?: string;
}

/** Изафетная пара: «падар» + и + «ман» = «падари ман». */
export interface Izafet {
  id: string;
  theme: string;
  /** Главное слово — к нему клеится изафет. */
  head: string;
  /** Зависимое слово. */
  mod: string;
  /** Полная форма. */
  tg: string;
  ru: string;
  words?: string[];
  audio?: string | null;
  verified: boolean;
  note?: string;
}

/** Правило грамматики — карточка в начале раздела или конкретного урока. */
export interface Rule {
  id: string;
  /** id раздела курса, к началу которого правило прикреплено. */
  section: string;
  /**
   * id урока, если правилу место не в начале раздела, а там, где его тема
   * впервые встречается: «шумо» и «ту» объясняют в уроке, где появилось «ту».
   */
  level?: string;
  title: string;
  /** Текст; абзацы разделены пустой строкой. */
  body: string;
  examples: Example[];
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
const dialogueModules = import.meta.glob('../../content/dialogues.json', { eager: true });
const izafetModules = import.meta.glob('../../content/izafet.json', { eager: true });
const ruleModules = import.meta.glob('../../content/rules.json', { eager: true });
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
const dialogueList = collect<Dialogue>(dialogueModules, 'dialogues');
const izafetList = collect<Izafet>(izafetModules, 'izafet');
const ruleList = collect<Rule>(ruleModules, 'rules');

export const words: ReadonlyMap<string, Word> = new Map(wordList.map((w) => [w.id, w]));
export const phrases: ReadonlyMap<string, Phrase> = new Map(phraseList.map((p) => [p.id, p]));
export const letters: readonly Letter[] = letterList;
export const dialogues: readonly Dialogue[] = dialogueList;
export const izafets: readonly Izafet[] = izafetList;
export const rules: readonly Rule[] = ruleList;

/** Буква по её строчному начертанию. */
const letterByChar = new Map(letterList.map((l) => [l.lower, l]));

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
      out.push({
        id: level.id,
        title: level.title,
        wordIds,
        phraseIds,
        exercises: level.exercises ?? 'auto',
        boss: level.boss === true,
        sectionId: section.id,
        sectionTitle: section.title,
        sectionColor: section.color ?? 'green',
        sectionIcon: section.icon ?? 'book',
        index: out.length,
        indexInSection,
        sectionIndex,
        playable: wordIds.length + phraseIds.length > 0,
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

export function getLetter(lower: string): Letter | undefined {
  return letterByChar.get(lower.normalize('NFC').toLowerCase());
}

/** Диалоги и изафеты цепляются к уровню по теме его слов — править код не нужно. */
export function dialoguesOfThemes(themes: readonly string[]): readonly Dialogue[] {
  const set = new Set(themes);
  return dialogueList.filter((d) => set.has(d.theme));
}

export function izafetsOfThemes(themes: readonly string[]): readonly Izafet[] {
  const set = new Set(themes);
  return izafetList.filter((z) => set.has(z.theme));
}

/** Правила раздела — показываются в его первом уровне. */
/**
 * Правила урока: свои, прикреплённые к нему по id, и — в первом уроке
 * раздела — общие правила раздела.
 */
export function rulesOfLevel(level: FlatLevel): readonly Rule[] {
  return ruleList.filter((r) =>
    r.level ? r.level === level.id : r.section === level.sectionId && level.indexInSection === 0,
  );
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

export function allDialogues(): readonly Dialogue[] {
  return dialogueList;
}

export function allIzafets(): readonly Izafet[] {
  return izafetList;
}

/** Сводка для экрана «Слова» и диагностики. */
export function contentStats(): {
  words: number;
  phrases: number;
  letters: number;
  dialogues: number;
  izafets: number;
  rules: number;
  sections: number;
  levels: number;
  playableLevels: number;
} {
  return {
    words: wordList.length,
    phrases: phraseList.length,
    letters: letterList.length,
    dialogues: dialogueList.length,
    izafets: izafetList.length,
    rules: ruleList.length,
    sections: sections.length,
    levels: levels.length,
    playableLevels: levels.filter((l) => l.playable).length,
  };
}
