/**
 * Сборка уровня: из слов, фраз, диалогов и букв получается последовательность
 * заданий разных типов. Всё детерминировано по ключу — одна и та же попытка
 * собирается одинаково, а тесты могут проверять результат.
 */

import { rngFor, shuffle, type Rng } from '../../core/rng';
import type { Dialogue, Izafet, Phrase, Word } from '../../data/content';
import type { Exercise, ExerciseKind, PhraseIntroExercise } from '../types';
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
import { dialogueKey, makeDialogueIntro, makePhraseIntro, phraseKey } from './phrase-intro';
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
/**
 * Потолок на всю сессию вместе с карточками знакомства. Карточка — один тап,
 * но два десятка экранов подряд утомляют независимо от того, что на них.
 */
const MAX_STEPS = 16;

/**
 * Экраны, которые не являются заданиями: правило, знакомство с буквой, со словом,
 * с фразой или разговором. Жизни и звёзды на них не теряются, попыток они не
 * записывают — и в длину урока считаются отдельно от настоящих заданий.
 */
export const CARD_KINDS = new Set<ExerciseKind>(['rule_card', 'alphabet_intro', 'word_intro', 'phrase_intro']);

/**
 * Задания, перед которыми слово обязано быть показано.
 *
 * Раньше сюда не входили «собери фразу», колесо букв, диалог и изафет —
 * считалось, что они держат слово с переводом прямо на экране. Это была
 * ошибка, и игрок почувствовал её сразу: во фразе перевод только у всей
 * фразы, а не у каждого слова; колесо показывает лишь русскую подсказку;
 * ответы в диалоге до выбора видны только по-таджикски. Во всех четырёх
 * слово нужно знать заранее. Теперь исключений нет: всё, что проверяется,
 * сначала объясняется.
 */
export const NEEDS_INTRO = new Set<ExerciseKind>([
  'quiz_tg_ru',
  'quiz_ru_tg',
  'match_pairs',
  'build_phrase',
  'letter_wheel',
  'type_word',
  'type_phrase',
  'missing_letter',
  'true_false',
  'dialogue_choice',
  'number_word',
  'odd_one_out',
  'category_sort',
  'izafet_builder',
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
    seenPhrases: extras.seenPhrases ?? new Set(),
    pastPhrases: extras.pastPhrases ?? [],
    reminder: extras.reminder ?? false,
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
  /*
   * Разговор — только из слов этого урока и уже выученных. Разговоры цепляются
   * к уроку по теме, и без этого первый же урок, где учат «салом» и «раҳмат»,
   * начинал разговор «Хайр! — То боздид!» — ещё два новых слова не по теме
   * урока, а своих фраз урок так и не показывал. Остальные разговоры темы
   * не пропадают: их реплики остаются неверными вариантами ответа.
   */
  const lessonWords = new Set(pool.words.map((w) => w.id));
  const dialogues = shuffle(
    rng,
    pool.dialogues.filter((d) => (d.words ?? []).every((id) => lessonWords.has(id) || !pool.freshWords.has(id))),
  );
  const izafets = shuffle(rng, [...pool.izafets]);
  if (words.length === 0 && phrases.length === 0) return [];

  const out: Exercise[] = [];
  const covered = new Set<string>();
  const used = new Set<string>();
  const kinds = new Set<string>();

  const forWord = cycler<Word>(words);
  const forPhrase = cycler<Phrase>(phrases);
  const forDialogue = cycler<Dialogue>(dialogues);
  const forIzafet = cycler<Izafet>(izafets);

  const push = (exercise: Exercise | null): boolean => {
    if (!exercise || out.length >= MAX_EXERCISES) return false;
    const key = exercise.kind + ':' + exercise.wordIds.join(',');
    if (used.has(key)) return false;
    // два одинаковых задания подряд выглядят как баг — кроме квиза
    if (out[out.length - 1]?.kind === exercise.kind && exercise.kind !== 'quiz_tg_ru') return false;
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

  const quizTg = () => forWord((w) => makeQuiz(pool, w, 'tg_ru', rng));
  const quizRu = () => forWord((w) => makeQuiz(pool, w, 'ru_tg', rng));
  const trueFalse = () => forWord((w) => makeTrueFalse(pool, w, rng));
  /*
   * Напиши слово — только знакомое до урока (makeTypeWord это проверяет).
   * На первом проходе слова урока все новые, поэтому пишут слова недавних
   * уроков: вспомнить и написать то, что учил вчера, — лучшее повторение.
   */
  const recent = shuffle(rng, [...pool.priorWords].slice(-15));
  const forRecent = cycler<Word>(recent);
  const typeWord = () =>
    forWord((w) => makeTypeWord(pool, w, rng)) ?? forRecent((w) => makeTypeWord(pool, w, rng));
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
   * Напиши фразу — только ту, что игрок уже видел и собирал до этого урока
   * (makeTypePhrase проверяет по отметкам «уже объясняли»). Фразу, которую
   * видят впервые, набрать с нуля нельзя: это не проверка памяти, а везения.
   *
   * Кандидаты: сначала фразы, собранные на этом уроке, — на повторном проходе
   * они уже знакомы, — потом фразы прошлых уроков раздела. Второе и есть
   * главный случай: написать по памяти то, что собирал урок назад.
   *
   * Собранное на этом уроке смотрим в out, а не запоминаем в момент создания:
   * созданное задание ещё может не попасть в урок (дубликат, два одинаковых
   * подряд), и тогда мы бы ссылались на фразу, которой на уровне нет.
   */
  const typePhrase = (): Exercise | null => {
    const built: Phrase[] = [];
    for (const ex of out) {
      if (ex.kind !== 'build_phrase') continue;
      const source = pool.phrases.find((p) => p.tg === ex.tg);
      if (source) built.push(source);
    }
    for (const source of [...built, ...shuffle(rng, [...pool.pastPhrases])]) {
      const made = makeTypePhrase(pool, source, rng);
      if (made) return made;
    }
    return null;
  };

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

  return withRules(pool, withCards(pool, out, seedKey));
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
 * Ставит карточки знакомства перед первым заданием, которому они нужны.
 *
 * Именно перед первым, а не пачкой в начале урока: восемь карточек подряд
 * читаются как словарь, а «вот слово — а теперь проверим» запоминается.
 * Карточка не задание: попыток не записывает, на звёзды и монеты не влияет.
 *
 * Три вида карточек, в таком порядке:
 *  — фраза или разговор, которые игрок ещё не видел: перевод целиком и
 *    каждое слово по отдельности. Их слова после этого считаются показанными,
 *    и отдельной карточки на каждое не нужно;
 *  — слово, которое ещё не показывали, — перед первой его проверкой;
 *  — и перед любой из них — новая особая буква, если она в ней впервые
 *    встречается: «ҳ» объясняется прямо перед «раҳмат», а не за пять уроков
 *    до него на словах, подобранных ради буквы.
 *
 * Урок не должен растянуться: на всё вместе есть общий потолок экранов,
 * и под него подрезается хвост заданий — но не ниже минимальной длины урока.
 */
function withCards(pool: LevelPool, exercises: readonly Exercise[], seedKey: string): Exercise[] {
  const byId = new Map(pool.vocabulary.map((w) => [w.id, w]));
  const phrasesById = new Map(pool.phrases.map((p) => [p.id, p]));
  const dialoguesById = new Map(pool.dialogues.map((d) => [d.id, d]));

  /** Карточка фразы или разговора, которые нужны заданию и ещё не видены. */
  const phraseCard = (ex: Exercise, carded: ReadonlySet<string>): PhraseIntroExercise | null => {
    if ((ex.kind === 'build_phrase' || ex.kind === 'type_phrase') && ex.phraseId) {
      const key = phraseKey(ex.phraseId);
      const phrase = phrasesById.get(ex.phraseId);
      if (phrase && !pool.seenPhrases.has(key) && !carded.has(key)) return makePhraseIntro(phrase, byId);
    }
    if (ex.kind === 'dialogue_choice' && ex.dialogueId) {
      const key = dialogueKey(ex.dialogueId);
      const dialogue = dialoguesById.get(ex.dialogueId);
      if (dialogue && !pool.seenPhrases.has(key) && !carded.has(key)) {
        const card = makeDialogueIntro(dialogue, byId);
        // фраза урока, которую разговор показывает дословно, своей карточки уже не требует
        const lines = new Set(card.lines.map((l) => sameText(l.tg)));
        const also = pool.phrases
          .filter((p) => lines.has(sameText(p.tg)))
          .map((p) => phraseKey(p.id))
          .filter((k) => !pool.seenPhrases.has(k) && !carded.has(k));
        return also.length > 0 ? { ...card, alsoKeys: also } : card;
      }
    }
    return null;
  };

  /** Один проход: где какие карточки встанут. Та же логика и для подсчёта, и для сборки. */
  const plan = (tasks: readonly Exercise[]): Exercise[] => {
    const out: Exercise[] = [];
    const shown = new Set<string>();
    const carded = new Set<string>();
    const lettered = new Set<string>();

    /*
     * Карточка буквы — перед первой карточкой, где эта буква видна. Зерно у каждой
     * буквы своё: план считается дважды (целиком и с подрезанным хвостом), и плитки
     * проверки не должны от этого меняться.
     */
    const lettersFor = (text: string): void => {
      const lower = text.normalize('NFC').toLowerCase();
      for (const letter of pool.letters) {
        if (lettered.has(letter.lower) || !lower.includes(letter.lower)) continue;
        const card = makeAlphabetIntro(pool, letter, rngFor(seedKey + ':буква:' + letter.lower));
        if (!card) continue;
        lettered.add(letter.lower);
        out.push(card);
      }
    };

    for (const exercise of tasks) {
      const card = phraseCard(exercise, carded);
      if (card) {
        lettersFor(card.lines.map((l) => l.tg).join(' '));
        carded.add(card.key);
        for (const key of card.alsoKeys ?? []) carded.add(key);
        for (const id of card.wordIds) shown.add(id);
        out.push(card);
      }
      if (!NEEDS_INTRO.has(exercise.kind)) {
        for (const id of exercise.wordIds) shown.add(id);
        out.push(exercise);
        continue;
      }
      for (const id of needsOf(exercise)) {
        if (shown.has(id) || !pool.freshWords.has(id)) continue;
        const word = byId.get(id);
        if (!word) continue;
        lettersFor(word.tg);
        shown.add(id);
        out.push(makeWordIntro(word, pool.reminder));
      }
      for (const id of needsOf(exercise)) shown.add(id);
      out.push(exercise);
    }
    return out;
  };

  const full = plan(exercises);
  // правила встанут в начало урока следом — их экраны тоже в общем потолке
  const cards = full.length - exercises.length + pool.rules.length;
  const room = Math.max(MIN_EXERCISES, MAX_STEPS - cards);
  return room >= exercises.length ? full : plan(exercises.slice(0, room));
}

/** Тексты совпадают, если отличаются только регистром и знаками препинания. */
function sameText(tg: string): string {
  return tg.normalize('NFC').toLowerCase().replace(/[.,!?…:;«»"—-]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Какие слова задание требует знать. Обычно это wordIds, но у пар, корзин,
 * «лишнего» и колеса слов несколько, и каждое — отдельный ответ.
 */
export function needsOf(ex: Exercise): string[] {
  switch (ex.kind) {
    case 'match_pairs':
      return ex.pairs.map((p) => p.wordId);
    case 'category_sort':
      return ex.items.map((i) => i.wordId);
    case 'odd_one_out':
      return ex.options.map((o) => o.wordId);
    case 'letter_wheel':
      return ex.targets.map((t) => t.wordId);
    default:
      return ex.wordIds;
  }
}
