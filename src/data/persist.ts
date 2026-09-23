/**
 * Загрузка, сохранение, миграции и экспорт/импорт прогресса.
 * Файл экспорта — обычный JSON, его можно открыть и поправить руками.
 */

import { kvGet, kvSet } from './db';
import {
  DEFAULT_SETTINGS,
  SAVE_VERSION,
  createInitialState,
  createWordStat,
  type LevelProgress,
  type Meal,
  type SaveState,
  type Settings,
  type WordStat,
} from './state';
import { now } from '../core/time';

const KEY = 'save';
export const EXPORT_KIND = 'learn-tajik/progress';

/* ——————————————————————————— вспомогательные проверки ——————————————————————————— */

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(v: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.min(max, Math.max(min, n));
}

function int(v: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  return Math.round(num(v, fallback, min, max));
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function str(v: unknown, fallback: string, maxLen = 64): string {
  return typeof v === 'string' ? v.slice(0, maxLen) : fallback;
}

function strOrNull(v: unknown, maxLen = 64): string | null {
  return typeof v === 'string' ? v.slice(0, maxLen) : null;
}

/* ——————————————————————————————— миграции ——————————————————————————————— */

type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/**
 * Ключ — версия, ИЗ которой мигрируем. Применяются подряд, пока не дойдём
 * до SAVE_VERSION. Когда поменяется структура: поднять SAVE_VERSION в state.ts
 * и добавить сюда шаг с прошлым номером.
 */
const MIGRATIONS: Record<number, Migration> = {
  /*
   * 1 -> 2: лаъл, дерево прокачки, снаряжение питомцев. Всё новое начинается
   * с нуля: кошелёк лаъл пуст, дерево не посажено, сундуки не открыты.
   * Лаъл за уже сделанное выдаёт сверка на старте (domain/reconcile) —
   * по тем же ключам, что и обычные награды, так что дважды не заплатит.
   */
  1: (raw) => {
    const wallet = isObj(raw.wallet) ? raw.wallet : {};
    raw.wallet = { ...wallet, gems: num(wallet.gems, 0, 0, 1e9), gemDust: 0 };
    const inventory = isObj(raw.inventory) ? raw.inventory : {};
    raw.inventory = { ...inventory, gear: {}, shards: 0, worn: {}, pity: 0 };
    raw.tree = {};
    const stats = isObj(raw.stats) ? raw.stats : {};
    raw.stats = {
      ...stats,
      perfect: int(stats.perfect, 0, 0, 1e6),
      reviews: int(stats.reviews, 0, 0, 1e6),
      mastered: int(stats.mastered, 0, 0, 1e6),
      gemsEarned: int(stats.gemsEarned, 0, 0, 1e9),
      cases: int(stats.cases, 0, 0, 1e6),
    };
    raw.version = 2;
    return raw;
  },
  /*
   * 2 -> 3: отметки «эту фразу уже объясняли». Старому игроку объяснят заново
   * каждую фразу при первой встрече — лишняя карточка лучше вопроса вслепую.
   */
  2: (raw) => {
    raw.seen = isObj(raw.seen) ? raw.seen : {};
    raw.version = 3;
    return raw;
  },
  /*
   * 3 -> 4: у питомцев появились звёзды и копии. У всех, кто уже есть, —
   * одна звезда и ни одной копии: соединять пока нечего.
   */
  3: (raw) => {
    const inventory = isObj(raw.inventory) ? raw.inventory : {};
    raw.inventory = { ...inventory, petRanks: {}, petCopies: {}, petPity: 0 };
    raw.version = 4;
    return raw;
  },
  /*
   * 4 -> 5: угощения и товар дня. Питомец ничего не ест, сегодня ничего
   * не куплено, счётчики с нуля.
   */
  4: (raw) => {
    const inventory = isObj(raw.inventory) ? raw.inventory : {};
    raw.inventory = { ...inventory, meal: null };
    const daily = isObj(raw.daily) ? raw.daily : {};
    raw.daily = { ...daily, dealDay: null, dealsBought: [] };
    const stats = isObj(raw.stats) ? raw.stats : {};
    raw.stats = { ...stats, meals: 0, deals: 0 };
    raw.version = 5;
    return raw;
  },
};

function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  let state = raw;
  let guard = 0;
  while (int(state.version, 0) < SAVE_VERSION && guard++ < 50) {
    const from = int(state.version, 0);
    const step = MIGRATIONS[from];
    if (!step) {
      // Нет шага — просто помечаем версией и полагаемся на sanitize.
      state.version = SAVE_VERSION;
      break;
    }
    state = step(state);
    if (int(state.version, 0) <= from) break;
  }
  return state;
}

/* ——————————————————————————————— нормализация ——————————————————————————————— */

function sanitizeSettings(v: unknown): Settings {
  const o = isObj(v) ? v : {};
  return {
    haptics: bool(o.haptics, DEFAULT_SETTINGS.haptics),
    reducedMotion: bool(o.reducedMotion, DEFAULT_SETTINGS.reducedMotion),
    sound: bool(o.sound, DEFAULT_SETTINGS.sound),
    dailyGoal: int(o.dailyGoal, DEFAULT_SETTINGS.dailyGoal, 5, 200),
    showHints: bool(o.showHints, DEFAULT_SETTINGS.showHints),
  };
}

function sanitizeLevels(v: unknown): Record<string, LevelProgress> {
  const out: Record<string, LevelProgress> = {};
  if (!isObj(v)) return out;
  for (const [id, raw] of Object.entries(v)) {
    if (!isObj(raw)) continue;
    out[id] = {
      stars: int(raw.stars, 0, 0, 3),
      best: num(raw.best, 0, 0, 1),
      attempts: int(raw.attempts, 0, 0, 1e6),
      completedAt: typeof raw.completedAt === 'number' ? raw.completedAt : null,
    };
  }
  return out;
}

function sanitizeSrs(v: unknown, ts: number): Record<string, WordStat> {
  const out: Record<string, WordStat> = {};
  if (!isObj(v)) return out;
  const base = createWordStat(ts);
  for (const [id, raw] of Object.entries(v)) {
    if (!isObj(raw)) continue;
    out[id] = {
      seen: int(raw.seen, base.seen, 0, 1e7),
      correct: int(raw.correct, base.correct, 0, 1e7),
      wrong: int(raw.wrong, base.wrong, 0, 1e7),
      streak: int(raw.streak, base.streak, 0, 1e4),
      box: int(raw.box, base.box, 0, 6),
      ease: num(raw.ease, base.ease, 1.3, 2.8),
      interval: num(raw.interval, base.interval, 0, 3650),
      dueAt: num(raw.dueAt, ts, 0, Number.MAX_SAFE_INTEGER),
      lastAt: num(raw.lastAt, 0, 0, Number.MAX_SAFE_INTEGER),
      introduced: bool(raw.introduced, false),
      mastered: bool(raw.mastered, false),
    };
  }
  return out;
}

function sanitizeStringMapToNumber(v: unknown, min = 0): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObj(v)) return out;
  for (const [k, raw] of Object.entries(v)) {
    if (typeof raw === 'number' && Number.isFinite(raw)) out[k] = Math.max(min, raw);
  }
  return out;
}

/** id питомца -> слот -> id аксессуара. Всё, что не строка, выбрасывается. */
function sanitizeWorn(v: unknown): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  if (!isObj(v)) return out;
  for (const [petId, slots] of Object.entries(v)) {
    if (!isObj(slots) || petId.length > 32) continue;
    const clean: Record<string, string> = {};
    for (const [slot, gearId] of Object.entries(slots)) {
      if (typeof gearId === 'string' && gearId.length <= 32 && slot.length <= 16) clean[slot] = gearId;
    }
    out[petId] = clean;
  }
  return out;
}

/** Угощение: id строкой и сколько уроков осталось; съеденное — null. */
function sanitizeMeal(v: unknown): Meal | null {
  if (!isObj(v) || typeof v.id !== 'string' || v.id.length > 32) return null;
  const left = int(v.left, 0, 0, 50);
  return left > 0 ? { id: v.id, left } : null;
}

function sanitizeStringArray(v: unknown, maxItems = 500): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  for (const item of v) {
    if (typeof item === 'string' && item.length <= 64) seen.add(item);
    if (seen.size >= maxItems) break;
  }
  return [...seen];
}

/** Приводит произвольный объект к валидному SaveState, дополняя значениями по умолчанию. */
export function sanitizeState(raw: unknown, ts: number = now()): SaveState {
  const base = createInitialState(ts);
  if (!isObj(raw)) return base;

  const profile = isObj(raw.profile) ? raw.profile : {};
  const wallet = isObj(raw.wallet) ? raw.wallet : {};
  const lives = isObj(raw.lives) ? raw.lives : {};
  const streak = isObj(raw.streak) ? raw.streak : {};
  const daily = isObj(raw.daily) ? raw.daily : {};
  const inventory = isObj(raw.inventory) ? raw.inventory : {};
  const stats = isObj(raw.stats) ? raw.stats : {};

  const maxLives = int(lives.max, base.lives.max, 1, 20);

  return {
    version: SAVE_VERSION,
    createdAt: num(raw.createdAt, ts, 0, Number.MAX_SAFE_INTEGER),
    updatedAt: num(raw.updatedAt, ts, 0, Number.MAX_SAFE_INTEGER),
    profile: {
      name: str(profile.name, base.profile.name, 24),
      petId: strOrNull(profile.petId, 32),
      themeId: str(profile.themeId, base.profile.themeId, 32),
    },
    wallet: {
      coins: int(wallet.coins, base.wallet.coins, 0, 1e9),
      gems: int(wallet.gems, base.wallet.gems, 0, 1e9),
      gemDust: num(wallet.gemDust, 0, 0, 0.999),
    },
    lives: {
      max: maxLives,
      count: int(lives.count, base.lives.count, 0, maxLives),
      updatedAt: num(lives.updatedAt, ts, 0, Number.MAX_SAFE_INTEGER),
      // от пяти минут до получаса: быстрее дерево не разгоняет, медленнее не бывает
      ...(typeof lives.regenMs === 'number' && Number.isFinite(lives.regenMs)
        ? { regenMs: num(lives.regenMs, 30 * 60_000, 5 * 60_000, 30 * 60_000) }
        : {}),
    },
    streak: {
      current: int(streak.current, base.streak.current, 0, 1e5),
      best: int(streak.best, base.streak.best, 0, 1e5),
      lastDayKey: strOrNull(streak.lastDayKey, 10),
      freezes: int(streak.freezes, base.streak.freezes, 0, 99),
    },
    daily: {
      lastChestDay: strOrNull(daily.lastChestDay, 10),
      lastWheelDay: strOrNull(daily.lastWheelDay, 10),
      todayKey: strOrNull(daily.todayKey, 10),
      todayCount: int(daily.todayCount, 0, 0, 1e5),
      spins: int(daily.spins, 0, 0, 10),
      dealDay: strOrNull(daily.dealDay, 10),
      dealsBought: sanitizeStringArray(daily.dealsBought, 20),
    },
    levels: sanitizeLevels(raw.levels),
    srs: sanitizeSrs(raw.srs, ts),
    inventory: {
      items: sanitizeStringMapToNumber(inventory.items),
      owned: sanitizeStringArray(inventory.owned),
      // старые сохранения поля не знают: пустая карта означает первую ступень
      petLevels: sanitizeStringMapToNumber(inventory.petLevels),
      gear: sanitizeStringMapToNumber(inventory.gear, 1),
      shards: int(inventory.shards, 0, 0, 1e7),
      worn: sanitizeWorn(inventory.worn),
      pity: int(inventory.pity, 0, 0, 1000),
      petRanks: sanitizeStringMapToNumber(inventory.petRanks, 1),
      petCopies: sanitizeStringMapToNumber(inventory.petCopies),
      petPity: int(inventory.petPity, 0, 0, 1000),
      meal: sanitizeMeal(inventory.meal),
    },
    tree: sanitizeStringMapToNumber(raw.tree),
    seen: sanitizeStringMapToNumber(raw.seen),
    // ледгер разовых наград: ключей много (по одному на слово), потолок выше
    achievements: sanitizeStringMapToNumber(raw.achievements),
    stats: {
      answers: int(stats.answers, 0, 0, 1e9),
      correct: int(stats.correct, 0, 0, 1e9),
      levelsDone: int(stats.levelsDone, 0, 0, 1e6),
      coinsEarned: int(stats.coinsEarned, 0, 0, 1e9),
      bestCombo: int(stats.bestCombo, 0, 0, 1e5),
      recoveries: int(stats.recoveries, 0, 0, 1e6),
      perfect: int(stats.perfect, 0, 0, 1e6),
      reviews: int(stats.reviews, 0, 0, 1e6),
      mastered: int(stats.mastered, 0, 0, 1e6),
      gemsEarned: int(stats.gemsEarned, 0, 0, 1e9),
      cases: int(stats.cases, 0, 0, 1e6),
      meals: int(stats.meals, 0, 0, 1e6),
      deals: int(stats.deals, 0, 0, 1e6),
    },
    settings: sanitizeSettings(raw.settings),
  };
}

/* ——————————————————————————————— чтение и запись ——————————————————————————————— */

export async function loadState(): Promise<SaveState> {
  const raw = await kvGet<unknown>(KEY);
  if (raw === undefined) return createInitialState(now());
  const migrated = migrate(isObj(raw) ? { ...raw } : {});
  return sanitizeState(migrated);
}

export async function saveState(state: SaveState): Promise<void> {
  state.updatedAt = now();
  // структурированное клонирование не переваривает прокси и функции — кладём чистый объект
  await kvSet(KEY, JSON.parse(JSON.stringify(state)) as SaveState);
}

/* ——————————————————————————————— экспорт и импорт ——————————————————————————————— */

export interface ExportFile {
  kind: string;
  version: number;
  exportedAt: number;
  app: string;
  state: SaveState;
}

export function buildExport(state: SaveState): ExportFile {
  return {
    kind: EXPORT_KIND,
    version: SAVE_VERSION,
    exportedAt: now(),
    app: 'Тоҷикӣ',
    state: JSON.parse(JSON.stringify(state)) as SaveState,
  };
}

export function exportFilename(ts: number = now()): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    'tojiki-progress-' +
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    '-' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    '.json'
  );
}

export type ImportResult =
  | { ok: true; state: SaveState; warnings: string[] }
  | { ok: false; error: string };

/** Разбирает содержимое файла экспорта. Принимает и «голый» SaveState. */
export function parseImport(text: string, ts: number = now()): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Это не JSON — файл повреждён или выбран не тот.' };
  }
  if (!isObj(parsed)) {
    return { ok: false, error: 'В файле ожидался объект с прогрессом.' };
  }

  const warnings: string[] = [];
  let payload: unknown;

  if (isObj(parsed.state) && typeof parsed.kind === 'string') {
    if (parsed.kind !== EXPORT_KIND) {
      return { ok: false, error: 'Файл от другого приложения (' + parsed.kind + ').' };
    }
    payload = parsed.state;
    const fileVersion = int(parsed.version, 0);
    if (fileVersion > SAVE_VERSION) {
      warnings.push(
        'Файл сделан более новой версией игры (' + fileVersion + '). Часть данных может не примениться.',
      );
    }
  } else if (isObj(parsed.levels) || isObj(parsed.srs) || isObj(parsed.wallet)) {
    payload = parsed;
    warnings.push('Файл без заголовка — прочитан как прогресс напрямую.');
  } else {
    return { ok: false, error: 'Не похоже на файл прогресса: нет ни state, ни levels.' };
  }

  const migrated = migrate({ ...(payload as Record<string, unknown>) });
  const state = sanitizeState(migrated, ts);
  return { ok: true, state, warnings };
}

/** Кладёт JSON в файл и отдаёт браузеру на скачивание. */
export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  // Revoke откладываем: Android Chrome иначе успевает отменить скачивание.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Открывает системный выбор файла и возвращает его текст. */
export function pickJsonFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.display = 'none';
    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(value);
    };
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return finish(null);
      file
        .text()
        .then(finish)
        .catch(() => finish(null));
    });
    // Пользователь может закрыть диалог — событие change не придёт.
    window.addEventListener(
      'focus',
      () => setTimeout(() => finish(null), 1500),
      { once: true },
    );
    document.body.append(input);
    input.click();
  });
}
