/**
 * Контракт между движком и мини-играми.
 *
 * Граница жёсткая: мини-игра получает готовое задание и контекст, и больше
 * ничего не знает — ни про контент, ни про прогресс, ни про карту.
 * Задания собирают генераторы из game/generators.
 */

import type { Rng } from '../core/rng';

export type ExerciseKind =
  | 'quiz_tg_ru'
  | 'quiz_ru_tg'
  | 'match_pairs'
  | 'build_phrase'
  | 'letter_wheel'
  | 'type_word'
  | 'missing_letter'
  | 'true_false'
  | 'alphabet_intro';

interface ExerciseCommon {
  kind: ExerciseKind;
  /** Слова, которые задание проверяет — идут в статистику повторения. */
  wordIds: string[];
}

/** Квиз на четыре варианта, в обе стороны. */
export interface QuizExercise extends ExerciseCommon {
  kind: 'quiz_tg_ru' | 'quiz_ru_tg';
  prompt: string;
  /** Подпись под вопросом — например, пример употребления. */
  hint?: string;
  options: string[];
  /** Индекс верного варианта в options. */
  correct: number;
}

/** Найди пары: таджикские слова и переводы. */
export interface MatchPairsExercise extends ExerciseCommon {
  kind: 'match_pairs';
  pairs: { wordId: string; tg: string; ru: string }[];
}

/** Собери фразу из банка слов. */
export interface BuildPhraseExercise extends ExerciseCommon {
  kind: 'build_phrase';
  /** Что переводим. */
  ru: string;
  /** Эталонный перевод целиком — показываем при ошибке. */
  tg: string;
  /** Слова банка, уже перемешанные, с лишними. */
  bank: string[];
  /** Верная последовательность слов. */
  answer: string[];
}

/** Колесо букв: собери слова из общего набора букв. */
export interface LetterWheelExercise extends ExerciseCommon {
  kind: 'letter_wheel';
  /** Буквы на колесе, уже перемешанные. */
  letters: string[];
  /** Слова, которые нужно найти. */
  targets: { wordId: string; tg: string; ru: string }[];
}

export type Exercise =
  | QuizExercise
  | MatchPairsExercise
  | BuildPhraseExercise
  | LetterWheelExercise;

/** Результат одной попытки внутри задания. */
export interface Attempt {
  correct: boolean;
  /** Каких слов касалась попытка. */
  wordIds: string[];
  /** Ответ засчитан, но написан русскими буквами вместо таджикских. */
  lenient?: boolean;
}

/** Чем закончилось задание — определяет полосу обратной связи. */
export interface ExerciseOutcome {
  correct: boolean;
  /** Правильный ответ — показывается при ошибке или мягком совпадении. */
  expected?: string;
  /** Что ответил игрок. */
  given?: string;
  lenient?: boolean;
  /** Своя подпись вместо стандартной. */
  message?: string;
}

export interface ExerciseContext {
  /** Записать попытку: идёт в счёт ошибок, серии и статистики слов. */
  attempt: (result: Attempt) => void;
  /** Задание пройдено целиком. Движок покажет полосу и кнопку «Продолжить». */
  finish: (outcome: ExerciseOutcome) => void;
  /** Потратить монеты на подсказку. false — не хватило. */
  spend: (cost: number) => boolean;
  /** Сколько сейчас монет — для подписи на кнопке подсказки. */
  coins: () => number;
  /** Детерминированный генератор для перемешиваний внутри задания. */
  rng: Rng;
  settings: { showHints: boolean };
}

export interface ExerciseInstance {
  el: HTMLElement;
  /** Освободить слушатели и таймеры. */
  destroy?: () => void;
}

export interface ExerciseModule<E extends Exercise = Exercise> {
  /** Заголовок над карточкой задания. */
  title: (exercise: E) => string;
  mount: (exercise: E, ctx: ExerciseContext) => ExerciseInstance;
}
