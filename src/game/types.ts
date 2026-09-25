/**
 * Контракт между движком и мини-играми.
 *
 * Граница жёсткая: мини-игра получает готовое задание и контекст, и больше
 * ничего не знает — ни про контент, ни про прогресс, ни про карту.
 * Задания собирают генераторы из game/generators.
 */

import type { Rng } from '../core/rng';

export type ExerciseKind =
  | 'rule_card'
  | 'word_intro'
  | 'phrase_intro'
  | 'quiz_tg_ru'
  | 'quiz_ru_tg'
  | 'match_pairs'
  | 'build_phrase'
  | 'letter_wheel'
  | 'type_word'
  | 'type_phrase'
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
 * Правило грамматики: карточка в начале раздела, до первых заданий.
 * Не проверка — попыток не записывает и на звёзды не влияет.
 */
export interface RuleCardExercise extends ExerciseCommon {
  kind: 'rule_card';
  title: string;
  /** Текст правила; абзацы разделены пустой строкой. */
  body: string;
  examples: { tg: string; ru: string }[];
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
  /** Слово уже встречалось, карточка напоминает о нём — например, в восстановлении. */
  remind?: boolean;
}

/**
 * Знакомство с фразой или разговором: карточка перед первым заданием на них.
 * Не задание — попыток не записывает. Показывает перевод целиком и каждое
 * слово по отдельности: без этого «Ман ба хона меравам» — набор незнакомых
 * звуков, и собрать её можно только наугад.
 */
export interface PhraseIntroExercise extends ExerciseCommon {
  kind: 'phrase_intro';
  /** «p:id» для фразы, «d:id» для разговора — по нему отмечается «уже видел». */
  key: string;
  /**
   * Фразы урока, которые эта карточка показывает дословно: реплика разговора
   * «Ассалому алайкум!» и есть фраза урока. Они тоже отмечаются виденными —
   * второй карточки с тем же текстом не будет.
   */
  alsoKeys?: string[];
  /** Одна строка у фразы, две у разговора: реплика собеседника и ответ. */
  lines: { tg: string; ru: string; who?: 'them' | 'me' }[];
  /** Слова по отдельности, в словарной форме. */
  gloss: { tg: string; ru: string }[];
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
  /** Какая фраза — по нему перед заданием ставится карточка, если её не видели. */
  phraseId?: string;
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

/**
 * Напиши фразу: перевод предложения набирается целиком, без банка слов.
 *
 * Единственное задание курса, где нужно построить фразу с нуля: остальные
 * дают материал на экране — выбрать из четырёх, собрать из готовых слов.
 */
export interface TypePhraseExercise extends ExerciseCommon {
  kind: 'type_phrase';
  phraseId?: string;
  /** Что переводим. */
  ru: string;
  /** Эталонный перевод целиком — показываем при ошибке. */
  tg: string;
  /**
   * Верная последовательность слов. По ней рисуются ячейки (сколько слов
   * ждём) и строится разбор — какое слово на своём месте, какое нет.
   */
  answer: string[];
  /**
   * Другие допустимые переводы той же фразы, уже разобранные на слова.
   * Берутся из поля alt в контенте: там, где по-таджикски можно сказать
   * двумя способами, засчитывать только один — значит наказывать за знание.
   */
  alt?: string[][];
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
  /** Разбор для полосы обратной связи при ошибке. */
  explain?: string;
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

/**
 * Знакомство с буквой: карточка, затем проверка «найди эту букву».
 * Стоит перед первым словом урока с этой буквой. Попыток не записывает:
 * промах на букве, которую видят впервые, ничего не стоит.
 */
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
  /** Какой разговор — ответы до выбора видны только по-таджикски, его надо показать заранее. */
  dialogueId?: string;
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
  /** Разбор для полосы обратной связи при ошибке. */
  explain?: string;
}

export type Exercise =
  | RuleCardExercise
  | WordIntroExercise
  | PhraseIntroExercise
  | QuizExercise
  | MatchPairsExercise
  | BuildPhraseExercise
  | LetterWheelExercise
  | TypeWordExercise
  | TypePhraseExercise
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
  /**
   * Почему правильный ответ именно такой. Показывается при ошибке:
   * без разбора самый учебный момент урока проходит впустую.
   */
  explain?: string;
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
