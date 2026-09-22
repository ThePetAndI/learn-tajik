/**
 * Сборка уровня: из слов, фраз, диалогов и букв получается последовательность
 * заданий разных типов. Всё детерминировано по ключу — одна и та же попытка
 * собирается одинаково, а тесты могут проверять результат.
 */

import { rngFor, shuffle, type Rng } from '../../core/rng';
import type { Dialogue, Izafet, Letter, Phrase, Word } from '../../data/content';
import type { Exercise, ExerciseKind } from '../types';
import { makeAlphabetIntro } from './alphabet-intro';
import { makeBuildPhrase } from './build-phrase';
import { makeCategorySort } from './category-sort';
import { makeDialogue } from './dialogue';
import { makeIzafet } from './izafet';
import { makeLetterWheel } from './letter-wheel';
import { makeMatchPairs } from './match-pairs';
import { makeMissingLetter } from './missing-letter';
import { makeNumberWord } from './number-word';
import { makeOddOneOut } from './odd-one-out';
import type { LevelPool } from './pool';
import { makeQuiz } from './quiz';
import { makeTrueFalse } from './true-false';
import { makeTypePhrase } from './type-phrase';
import { makeTypeWord } from './type-word';
import { makeRuleCard } from './rule-card';
import { makeWordIntro } from './word-intro';

export { type LevelPool } from './pool';
export {
  makeAlphabetIntro,
  makeBuildPhrase,
  makeCategorySort,
  makeDialogue,
  makeIzafet,
  makeLetterWheel,
  makeMatchPairs,
  makeMissingLetter,
  makeNumberWord,
  makeOddOneOut,
  makeQuiz,
  makeTrueFalse,
  makeRuleCard,
  makeTypePhrase,
  makeTypeWord,
  makeWordIntro,
};

/** Уровень короче шести заданий не ощущается уровнем, длиннее десяти — утомляет. */
export const MIN_EXERCISES = 6;
export const MAX_EXERCISES = 10;
/** Сколько букв показываем на уровне алфавита: больше — и уровень превращается в лекцию. */
const MAX_INTROS = 2;
/**
 * Потолок на всю сессию вместе с карточками знакомства. Карточка — один тап,
 * но два десятка экранов подряд утомляют независимо от того, что на них.
 */
const MAX_STEPS = 18;

/**
 * Экраны, которые не являются заданиями: правило и знакомство со словом.
 * Ошибиться на них нельзя, попыток они не записывают, на звёзды не влияют —
 * и в длину урока считаются отдельно от настоящих заданий.
 */
export const CARD_KINDS = new Set<ExerciseKind>(['rule_card', 'word_intro']);

/**
 * Задания, где слово нужно вспомнить: перед ними знакомство обязательно.
 * Остальные — «собери фразу», колесо букв, диалог, изафет — держат слово
 * с переводом прямо на экране, пока игрок работает: вспоминать не из чего,
 * и такое задание само служит знакомством.
 */
export const NEEDS_INTRO = new Set<ExerciseKind>([
  'quiz_tg_ru',
  'quiz_ru_tg',
  'match_pairs',
  'type_word',
  'type_phrase',
  'missing_letter',
  'true_false',
  'number_word',
  'odd_one_out',
  'category_sort',
]);

/** Попытка собрать задание: вернёт null, если материала не хватило. */
type Candidate = () => Exercise | null;

/** Дополнительный материал уровня. Всё необязательное: чего нет — тех заданий не будет. */
export type PoolExtras = Partial<Omit<LevelPool, 'words' | 'phrases' | 'vocabulary'>>;

export function makePool(
  words: Word[],
  phrases: Phrase[],
  vocabulary: readonly Word[],
  extras: PoolExtras = {},
): LevelPool {
  return {
    words,
    phrases,
    vocabulary,
    priorWords: extras.priorWords ?? [],
    letters: extras.letters ?? [],
    alphabet: extras.alphabet ?? [],
    dialogues: extras.dialogues ?? [],
    izafets: extras.izafets ?? [],
    themeTitles: extras.themeTitles ?? {},
    freshWords: extras.freshWords ?? new Set(),
    rules: extras.rules ?? [],
  };
}

/**
 * Перебор материала по кругу: каждому заданию достаётся своё слово.
 * Курсор двигается только на удачной попытке — слово, которое не подошло
 * одному генератору, остаётся доступным следующему.
 */
function cycler<T>(items: readonly T[]) {
  let cursor = 0;
  return function forSome<R>(make: (item: T) => R | null): R | null {
    for (let k = 0; k < items.length; k++) {
      const item = items[(cursor + k) % items.length];
      const made = item === undefined ? null : make(item);
      if (made) {
        cursor = (cursor + k + 1) % items.length;
        return made;
      }
    }
    return null;
  };
}

/**
 * Порядок продуман: сначала узнавание, потом обратный перевод (он труднее),
 * письмо ближе к концу, а между ними — задания, которые дают отдохнуть
 * от однотипного выбора.
 *
 * Специализированные генераторы стоят в слоте первыми: число, изафет и диалог
 * появятся только там, где для них есть материал, и ничего не стоят там, где
 * его нет.
 */
export function buildLevelExercises(pool: LevelPool, seedKey: string): Exercise[] {
  const rng: Rng = rngFor(seedKey);
  const words = shuffle(rng, pool.words);
  const phrases = shuffle(rng, pool.phrases);
  const letters = shuffle(rng, [...pool.letters]);
  const dialogues = shuffle(rng, [...pool.dialogues]);
  const izafets = shuffle(rng, [...pool.izafets]);
  if (words.length === 0 && phrases.length === 0 && letters.length === 0) return [];

  const out: Exercise[] = [];
  const covered = new Set<string>();
  const used = new Set<string>();
  const kinds = new Set<string>();

  const forWord = cycler<Word>(words);
  const forPhrase = cycler<Phrase>(phrases);
  const forLetter = cycler<Letter>(letters);
  const forDialogue = cycler<Dialogue>(dialogues);
  const forIzafet = cycler<Izafet>(izafets);

  const push = (exercise: Exercise | null): boolean => {
    if (!exercise || out.length >= MAX_EXERCISES) return false;
    const key = exercise.kind + ':' + exercise.wordIds.join(',');
    if (used.has(key)) return false;
    // два одинаковых задания подряд выглядят как баг — кроме квиза и знакомства
    // с буквой: «вот Ғ, вот Қ» подряд как раз и есть урок алфавита
    if (
      out[out.length - 1]?.kind === exercise.kind &&
      exercise.kind !== 'quiz_tg_ru' &&
      exercise.kind !== 'alphabet_intro'
    ) {
      return false;
    }
    used.add(key);
    kinds.add(exercise.kind);
    out.push(exercise);
    for (const id of exercise.wordIds) covered.add(id);
    return true;
  };

  /**
   * Слот: пробуем кандидатов по порядку, пока один не встанет.
   * Первым проходом берём только те типы, которых на уровне ещё не было —
   * иначе одна и та же игра заняла бы два слота, а соседняя не появилась бы
   * ни разу.
   */
  const slot = (...candidates: Candidate[]): void => {
    const built: Array<Exercise | null> = [];
    for (const make of candidates) {
      if (out.length >= MAX_EXERCISES) return;
      const exercise = make();
      built.push(exercise);
      if (exercise && !kinds.has(exercise.kind) && push(exercise)) return;
    }
    for (const exercise of built) {
      if (push(exercise)) return;
    }
  };

  /** Два равноправных кандидата в случайном порядке — чтобы попытки не повторялись. */
  const alt = (a: Candidate, b: Candidate): [Candidate, Candidate] =>
    rng() < 0.5 ? [a, b] : [b, a];

  const intro = () => forLetter((l) => makeAlphabetIntro(pool, l, rng));
  const quizTg = () => forWord((w) => makeQuiz(pool, w, 'tg_ru', rng));
  const quizRu = () => forWord((w) => makeQuiz(pool, w, 'ru_tg', rng));
  const trueFalse = () => forWord((w) => makeTrueFalse(pool, w, rng));
  const typeWord = () => forWord((w) => makeTypeWord(pool, w, rng));
  const missing = () => forWord((w) => makeMissingLetter(pool, w, rng));
  const number = () => forWord((w) => makeNumberWord(pool, w, rng));
  const phrase = () => forPhrase((p) => makeBuildPhrase(pool, p, rng));
  const dialogue = () => forDialogue((d) => makeDialogue(pool, d, rng));
  const izafet = () => forIzafet((z) => makeIzafet(pool, z, rng));
  const pairs = () => makeMatchPairs(pool, rng);
  const sort = () => makeCategorySort(pool, rng);
  const odd = () => makeOddOneOut(pool, rng);
  const wheel = () => makeLetterWheel(pool, rng);

  /*
   * Напиши фразу берём только ту, которую на этом же уровне уже собирали
   * из слов. Фразу, которую видят впервые, набрать с нуля нельзя: это
   * не проверка памяти, а проверка везения.
   *
   * Смотрим в уже собранный out, а не запоминаем фразу в момент создания:
   * созданное задание ещё может не попасть в урок (дубликат, два одинаковых
   * подряд), и тогда мы бы спрашивали про фразу, которой на уровне нет.
   */
  const typePhrase = (): Exercise | null => {
    for (const ex of out) {
      if (ex.kind !== 'build_phrase') continue;
      const source = pool.phrases.find((p) => p.tg === ex.tg);
      const made = source ? makeTypePhrase(pool, source, rng) : null;
      if (made) return made;
    }
    return null;
  };

  for (let k = 0; k < MAX_INTROS; k++) slot(intro);

  slot(quizTg);
  slot(trueFalse, quizTg);
  slot(pairs, sort, quizTg);
  slot(number, quizRu);
  slot(dialogue, phrase, quizRu);
  slot(missing, typeWord, quizRu);
  slot(izafet, ...alt(wheel, phrase));
  slot(...alt(sort, odd), wheel);
  // последним — письмо: сначала собрать фразу из слов, потом написать её сам
  slot(typePhrase, typeWord, missing, trueFalse);

  // Каждое слово уровня должно встретиться хотя бы раз
  for (const word of words) {
    if (out.length >= MAX_EXERCISES) break;
    if (covered.has(word.id)) continue;
    push(makeQuiz(pool, word, 'tg_ru', rng)) || push(makeQuiz(pool, word, 'ru_tg', rng));
  }

  // Добиваем до минимума повторами в другую сторону
  for (let round = 0; round < 3 && out.length < MIN_EXERCISES; round++) {
    for (const word of words) {
      if (out.length >= MIN_EXERCISES) break;
      const dir = round % 2 === 0 ? 'ru_tg' : 'tg_ru';
      push(makeQuiz(pool, word, dir, rng));
    }
    if (phrases.length > 0) {
      for (const p of phrases) {
        if (out.length >= MIN_EXERCISES) break;
        push(makeBuildPhrase(pool, p, rng));
      }
    }
  }

  return withRules(pool, withIntros(pool, out));
}

/**
 * Правила раздела идут самыми первыми, до знакомства со словами.
 * Порядок не случайный: сначала «как это устроено», потом «вот слова»,
 * потом «а теперь проверим». Читать правило после заданий поздно.
 */
function withRules(pool: LevelPool, exercises: readonly Exercise[]): Exercise[] {
  if (pool.rules.length === 0) return [...exercises];
  return [...pool.rules.map(makeRuleCard), ...exercises];
}

/**
 * Ставит карточку знакомства перед первой проверкой незнакомого слова.
 *
 * Именно перед первой, а не пачкой в начале урока: восемь карточек подряд
 * читаются как словарь, а «вот слово — а теперь проверим» запоминается.
 * Карточка не задание: попыток не записывает, на звёзды и монеты не влияет.
 *
 * Знакомим со всеми новыми словами уровня, без потолка на число карточек:
 * иначе на большом уровне часть слов по-прежнему сваливалась бы на игрока
 * сразу вопросом. Чтобы урок не растянулся, подрезается хвост заданий —
 * но не ниже минимальной длины уровня.
 */
function withIntros(pool: LevelPool, exercises: readonly Exercise[]): Exercise[] {
  if (pool.freshWords.size === 0) return [...exercises];

  const byId = new Map(pool.vocabulary.map((w) => [w.id, w]));
  const freshIn = (list: readonly Exercise[]): Set<string> => {
    const out = new Set<string>();
    const shown = new Set<string>();
    for (const ex of list) {
      if (!NEEDS_INTRO.has(ex.kind)) {
        for (const id of ex.wordIds) shown.add(id);
        continue;
      }
      for (const id of ex.wordIds) {
        if (shown.has(id)) continue;
        if (pool.freshWords.has(id) && byId.has(id)) out.add(id);
      }
    }
    return out;
  };

  const room = Math.max(MIN_EXERCISES, MAX_STEPS - freshIn(exercises).size);
  const tasks = exercises.slice(0, room);
  const needed = freshIn(tasks);

  const shown = new Set<string>();
  const out: Exercise[] = [];
  for (const exercise of tasks) {
    if (!NEEDS_INTRO.has(exercise.kind)) {
      for (const id of exercise.wordIds) shown.add(id);
      out.push(exercise);
      continue;
    }
    for (const id of exercise.wordIds) {
      if (shown.has(id) || !needed.has(id)) continue;
      shown.add(id);
      out.push(makeWordIntro(byId.get(id) as Word));
    }
    out.push(exercise);
  }
  return out;
}
