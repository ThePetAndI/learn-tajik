/**
 * Модель сохранения. Всё, что знает игра о пользователе, живёт здесь.
 * При изменении структуры: поднять SAVE_VERSION и добавить шаг в migrate() (persist.ts).
 */

export const SAVE_VERSION = 5;

/** Прогресс по одному уровню карты. */
export interface LevelProgress {
  /** 0 — не пройден, 1..3 — звёзды за лучшую попытку. */
  stars: number;
  /** Лучшая доля верных ответов, 0..1. */
  best: number;
  attempts: number;
  completedAt: number | null;
}

/** Статистика одного слова для интервального повторения. */
export interface WordStat {
  /** сколько раз показывали */
  seen: number;
  correct: number;
  wrong: number;
  /** текущая серия верных ответов подряд */
  streak: number;
  /** коробка Лейтнера 0..6 — определяет базовый интервал */
  box: number;
  /** коэффициент лёгкости SM-2, 1.3..2.8 */
  ease: number;
  /** текущий интервал в днях */
  interval: number;
  /** когда слово снова нужно показать (мс) */
  dueAt: number;
  /** когда последний раз показывали (мс) */
  lastAt: number;
  /** true после первого верного ответа — слово попало в «Слова» */
  introduced: boolean;
  /**
   * Слово дошло до последней коробки повторения хотя бы раз.
   * Флаг, а не вычисление по box: лаъл за освоение выдаётся один раз,
   * а коробка может и просесть после ошибки.
   */
  mastered: boolean;
}

/** Угощение, которое питомец сейчас ест: id еды и сколько уроков осталось. */
export interface Meal {
  id: string;
  left: number;
}

export interface Settings {
  haptics: boolean;
  /** Уменьшенные анимации — дублирует системную настройку, но явным тумблером. */
  reducedMotion: boolean;
  /** Зарезервировано: звук и озвучка появятся позже. */
  sound: boolean;
  /** Сколько упражнений в день считается выполненной целью. */
  dailyGoal: number;
  /** Показывать подсказку-транскрипцию под таджикскими словами. */
  showHints: boolean;
}

export interface SaveState {
  version: number;
  createdAt: number;
  updatedAt: number;
  profile: {
    name: string;
    /** id активного питомца из магазина, null — стандартный */
    petId: string | null;
    /** id скина карты */
    themeId: string;
  };
  wallet: {
    coins: number;
    /** Лаъл — вторая валюта, за глубину, а не за объём (см. domain/gems). */
    gems: number;
    /**
     * Дробная часть лаъл, 0..1. Бонус +10% к награде в один лаъл без неё
     * терялся бы при округлении целиком; так он копится и честно доходит.
     */
    gemDust: number;
  };
  lives: {
    count: number;
    max: number;
    /** момент, от которого отсчитывается регенерация */
    updatedAt: number;
    /**
     * Сколько миллисекунд восстанавливается одна жизнь. Производное от бонусов,
     * как и max: хранится, чтобы модуль жизней оставался чистым. Нет — 30 минут.
     */
    regenMs?: number;
  };
  streak: {
    current: number;
    best: number;
    lastDayKey: string | null;
    /** заморозки стрика из магазина */
    freezes: number;
  };
  daily: {
    lastChestDay: string | null;
    lastWheelDay: string | null;
    /** сколько упражнений сделано сегодня */
    todayKey: string | null;
    todayCount: number;
    /** сколько раз колесо крутили в день lastWheelDay: дерево даёт лишние вращения */
    spins: number;
    /** день, к которому относится dealsBought: товар дня меняется в полночь */
    dealDay: string | null;
    /** какие товары дня уже куплены сегодня — каждый продаётся один раз */
    dealsBought: string[];
  };
  /** levelId -> прогресс */
  levels: Record<string, LevelProgress>;
  /** wordId -> статистика повторения */
  srs: Record<string, WordStat>;
  inventory: {
    /** id -> количество (бустеры) */
    items: Record<string, number>;
    /** купленные навсегда: питомцы, скины */
    owned: string[];
    /** id питомца -> ступень прокачки, 1..5. Нет записи — первая ступень. */
    petLevels: Record<string, number>;
    /** id аксессуара -> его уровень. Нет записи — аксессуар не найден. */
    gear: Record<string, number>;
    /** Осколки: из повторных находок и разобранного снаряжения, идут на улучшение. */
    shards: number;
    /** id питомца -> слот -> id надетого аксессуара. У каждого питомца свой наряд. */
    worn: Record<string, Record<string, string>>;
    /** Сколько вещей подряд выпало без эпической — для гарантии (gear-items.PITY_EVERY). */
    pity: number;
    /** id питомца -> звёзды, 1..5. Нет записи — одна звезда. */
    petRanks: Record<string, number>;
    /** id питомца -> лишние копии: из лона, когда такой питомец уже есть. */
    petCopies: Record<string, number>;
    /** Сколько питомцев подряд выпало без эпического — для гарантии в лоне. */
    petPity: number;
    /** Что питомец сейчас ест. null — ничего: угощение кончилось или его не было. */
    meal: Meal | null;
  };
  /** id узла дерева прокачки -> когда открыт. */
  tree: Record<string, number>;
  /**
   * Фразы и диалоги, которые игроку уже объясняли карточкой: «p:id» или «d:id»
   * -> когда впервые. Слова учитываются в srs, а у фраз своей статистики нет —
   * без этой отметки нельзя понять, видел ли игрок фразу, прежде чем
   * просить собрать её или выбрать её в разговоре.
   */
  seen: Record<string, number>;
  /**
   * Разовые достижения: ключ -> когда получено. Заодно служит ледгером
   * наград в лаъл — по нему видно, что за это уже платили (domain/gems).
   */
  achievements: Record<string, number>;
  stats: {
    answers: number;
    correct: number;
    levelsDone: number;
    coinsEarned: number;
    bestCombo: number;
    /** число завершённых сессий восстановления */
    recoveries: number;
    /** уровней пройдено с первого раза без ошибок */
    perfect: number;
    /** завершённых сессий повторения */
    reviews: number;
    /** слов доведено до последней коробки */
    mastered: number;
    /** сколько лаъл добыто за всё время */
    gemsEarned: number;
    /** сколько сундуков открыто в лавке */
    cases: number;
    /** сколько раз питомца угощали */
    meals: number;
    /** сколько товаров дня куплено за всё время */
    deals: number;
  };
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  haptics: true,
  reducedMotion: false,
  sound: false,
  dailyGoal: 20,
  showHints: true,
};

export function createInitialState(ts: number): SaveState {
  return {
    version: SAVE_VERSION,
    createdAt: ts,
    updatedAt: ts,
    profile: { name: '', petId: null, themeId: 'meadow' },
    wallet: { coins: 50, gems: 0, gemDust: 0 },
    lives: { count: 5, max: 5, updatedAt: ts },
    streak: { current: 0, best: 0, lastDayKey: null, freezes: 0 },
    daily: {
      lastChestDay: null,
      lastWheelDay: null,
      todayKey: null,
      todayCount: 0,
      spins: 0,
      dealDay: null,
      dealsBought: [],
    },
    levels: {},
    srs: {},
    inventory: {
      items: {},
      owned: [],
      petLevels: {},
      gear: {},
      shards: 0,
      worn: {},
      pity: 0,
      petRanks: {},
      petCopies: {},
      petPity: 0,
      meal: null,
    },
    tree: {},
    seen: {},
    achievements: {},
    stats: {
      answers: 0,
      correct: 0,
      levelsDone: 0,
      coinsEarned: 0,
      bestCombo: 0,
      recoveries: 0,
      perfect: 0,
      reviews: 0,
      mastered: 0,
      gemsEarned: 0,
      cases: 0,
      meals: 0,
      deals: 0,
    },
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function createWordStat(ts: number): WordStat {
  return {
    seen: 0,
    correct: 0,
    wrong: 0,
    streak: 0,
    box: 0,
    ease: 2.5,
    interval: 0,
    dueAt: ts,
    lastAt: 0,
    introduced: false,
    mastered: false,
  };
}
