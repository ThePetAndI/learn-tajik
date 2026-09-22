/**
 * Модель сохранения. Всё, что знает игра о пользователе, живёт здесь.
 * При изменении структуры: поднять SAVE_VERSION и добавить шаг в migrate() (persist.ts).
 */

export const SAVE_VERSION = 1;

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
  };
  lives: {
    count: number;
    max: number;
    /** момент, от которого отсчитывается регенерация */
    updatedAt: number;
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
  };
  /** achievementId -> когда получено */
  achievements: Record<string, number>;
  stats: {
    answers: number;
    correct: number;
    levelsDone: number;
    coinsEarned: number;
    bestCombo: number;
    /** число завершённых сессий восстановления */
    recoveries: number;
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
    wallet: { coins: 50 },
    lives: { count: 5, max: 5, updatedAt: ts },
    streak: { current: 0, best: 0, lastDayKey: null, freezes: 0 },
    daily: { lastChestDay: null, lastWheelDay: null, todayKey: null, todayCount: 0 },
    levels: {},
    srs: {},
    inventory: { items: {}, owned: [], petLevels: {} },
    achievements: {},
    stats: { answers: 0, correct: 0, levelsDone: 0, coinsEarned: 0, bestCombo: 0, recoveries: 0 },
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
  };
}
