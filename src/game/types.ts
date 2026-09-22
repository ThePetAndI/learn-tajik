/**
 * Контракт между движком и мини-играми.
 *
 * Граница жёсткая: мини-игра получает готовое задание и контекст, и больше
 * ничего не знает — ни про контент, ни про прогресс, ни про карту.
 * Задания собирают генераторы из game/generators.
 */

import type { Rng } from '../core/rng';

export type ExerciseKind =
  | 'word_intro'
  | 'quiz_tg_ru'
  | 'quiz_ru_tg'
  | 'match_pairs'
  | 'build_phrase'
  | 'letter_wheel'
  | 'type_word'
  | 'missing_letter'
  | 'true_false'
  | 'alphabet_intro'
  | 'odd_one_out'
  | 'dialogue_choice'
  | 'number_word'
  | 'category_sort'
  | 'izafet_builder';

interface ExerciseCommon {
  kind: ExerciseKind;
  /** Слова, которые задание проверяет — идут в статистику повторения. */
  wordIds: string[];
}

/**
 * Знакомство со словом: карточка перед первой проверкой.
 * Не задание — попытки не записывает и на звёзды не влияет.
 */
export interface WordIntroExercise extends ExerciseCommon {
  kind: 'word_intro';
  tg: string;
  ru: string;
  /** Часть речи по-русски. */
  pos?: string;
  example?: { tg: string; ru: string };
  /** Особые буквы слова — то, на что стоит посмотреть заранее. */
  letters: string[];
  /** Задел на будущее: озвучки пока нет. */
  audio?: string | null;
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

/** Напиши слово: ответ набирается руками, панель даёт ғ ӣ қ ӯ ҳ ҷ. */
export interface TypeWordExercise extends ExerciseCommon {
  kind: 'type_word';
  /** Что переводим. */
  ru: string;
  /** Правильный ответ. */
  tg: string;
  /** Подпись под вопросом — часть речи или пример. */
  hint?: string;
}

/** Пропущенная буква: в слове вырезана одна буква, её надо выбрать. */
export interface MissingLetterExercise extends ExerciseCommon {
  kind: 'missing_letter';
  /** Часть слова до пропуска и после — между ними пустая клетка. */
  before: string;
  after: string;
  ru: string;
  /** Буквы на выбор. */
  options: string[];
  correct: number;
  /** Пропущена одна из шести особых букв — подсвечиваем это в подписи. */
  special: boolean;
}

/** Правда или ложь на время: «китоб = книга?». */
export interface TrueFalseExercise extends ExerciseCommon {
  kind: 'true_false';
  tg: string;
  /** Перевод, который проверяем — верный или подставной. */
  ru: string;
  /** Верна ли пара. */
  truth: boolean;
  /** Сколько секунд даётся на ответ. */
  seconds: number;
  /** Настоящий перевод — показываем, когда пара подставная. */
  realRu: string;
}

/** Знакомство с буквой: карточка, затем проверка «найди эту букву». */
export interface AlphabetIntroExercise extends ExerciseCommon {
  kind: 'alphabet_intro';
  lower: string;
  upper: string;
  /** Название буквы по-таджикски. */
  name: string;
  sound: string;
  /** Русская буква с тем же звуком; null — такой в русском нет. */
  ru: string | null;
  note?: string;
  examples: { tg: string; ru: string }[];
  /** Плитки для проверки: среди похожих букв одна изученная. */
  options: string[];
  correct: number;
}

/** Лишнее слово: три из одной темы, одно из чужой. */
export interface OddOneOutExercise extends ExerciseCommon {
  kind: 'odd_one_out';
  /** Название темы трёх слов — объясняет ответ. */
  theme: string;
  options: { wordId: string; tg: string; ru: string }[];
  correct: number;
}

/** Выбери реплику: мини-диалог из двух ходов. */
export interface DialogueChoiceExercise extends ExerciseCommon {
  kind: 'dialogue_choice';
  ask: { tg: string; ru: string };
  options: { tg: string; ru: string }[];
  correct: number;
}

/** Число и слово: таджикское числительное набирается цифрами. */
export interface NumberWordExercise extends ExerciseCommon {
  kind: 'number_word';
  tg: string;
  ru: string;
  value: number;
}

/** Разложи слова по двум корзинам. */
export interface CategorySortExercise extends ExerciseCommon {
  kind: 'category_sort';
  /** Подписи корзин. */
  baskets: [string, string];
  items: { wordId: string; tg: string; ru: string; basket: 0 | 1 }[];
}

/** Изафет: «падар» + «и» + «ман» = «падари ман». */
export interface IzafetBuilderExercise extends ExerciseCommon {
  kind: 'izafet_builder';
  ru: string;
  /** Полный верный ответ. */
  tg: string;
  /** Главное слово — к нему клеится «и». */
  head: string;
  /** Зависимое слово. */
  mod: string;
  /** Соединитель, почти всегда «и». */
  suffix: string;
  /** Слова на выбор, с лишними. */
  bank: string[];
}

export type Exercise =
  | WordIntroExercise
  | QuizExercise
  | MatchPairsExercise
  | BuildPhraseExercise
  | LetterWheelExercise
  | TypeWordExercise
  | MissingLetterExercise
  | TrueFalseExercise
  | AlphabetIntroExercise
  | OddOneOutExercise
  | DialogueChoiceExercise
  | NumberWordExercise
  | CategorySortExercise
  | IzafetBuilderExercise;

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
  /** Потратить бустер из инвентаря. false — его нет. */
  useItem: (itemId: string) => boolean;
  /** Сколько бустеров осталось. */
  itemCount: (itemId: string) => number;
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
