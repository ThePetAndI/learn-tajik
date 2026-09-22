/**
 * Лаъл — вторая валюта.
 *
 * Лаъл (ла'л) — рубин-шпинель. Копи Кӯҳи Лаъл на Памире известны тысячу лет,
 * и слово это в таджикском живое. Заодно игрок его выучит.
 *
 * Смысл второй валюты не в том, чтобы удвоить счётчики, а в том, чтобы
 * награждать другое поведение. Монеты идут за объём: чем больше ответов,
 * тем больше монет, и их можно намолотить, переигрывая первый уровень.
 * Лаъл идёт за глубину, и намолотить его нельзя:
 *
 *  — слово доведено до последней коробки повторения (это месяцы, не часы);
 *  — уровень пройден без единой ошибки — впервые для этого уровня;
 *  — раздел закрыт целиком, и отдельно — закрыт на все звёзды;
 *  — серия дожила до вехи.
 *
 * Каждая награда выдаётся один раз: ведётся по ключам в state.achievements,
 * который для этого и заводился. Поэтому переигрывание не приносит лаъл
 * вовсе — только первое настоящее достижение.
 */

import type { SaveState } from '../data/state';

export const GEM_MASTERED = 1;
export const GEM_PERFECT = 2;
export const GEM_SECTION = 5;
/** Сверх обычной награды за раздел, если все уровни на три звезды. */
export const GEM_SECTION_FULL = 10;

/** Вехи серии. Дальше 365 не идём: год — это уже всё, что можно обещать. */
export const STREAK_MILESTONES: readonly { days: number; gems: number }[] = [
  { days: 3, gems: 2 },
  { days: 7, gems: 5 },
  { days: 14, gems: 8 },
  { days: 30, gems: 12 },
  { days: 60, gems: 20 },
  { days: 100, gems: 30 },
  { days: 200, gems: 40 },
  { days: 365, gems: 60 },
];

/* ————————————————————————— ледгер разовых наград ————————————————————————— */

/** Выдавали ли уже награду с таким ключом. */
export function hasGrant(state: SaveState, key: string): boolean {
  return state.achievements[key] !== undefined;
}

/**
 * Выдаёт награду по ключу ровно один раз. Возвращает сколько выдано —
 * 0 означает «уже было», и это нормальный путь, а не ошибка.
 */
export function grantOnce(state: SaveState, key: string, gems: number, ts: number): number {
  if (hasGrant(state, key)) return 0;
  state.achievements[key] = ts;
  return addGems(state, gems);
}

/* ————————————————————————— кошелёк ————————————————————————— */

/**
 * Единственная дверь, через которую лаъл попадает в кошелёк.
 * Множители из дерева прокачки применяются здесь, а не у каждого вызова.
 */
export function addGems(state: SaveState, n: number): number {
  const amount = Math.max(0, Math.floor(n));
  if (amount === 0) return 0;
  state.wallet.gems += amount;
  state.stats.gemsEarned += amount;
  return amount;
}

/** Списывает лаъл. false — не хватило, кошелёк не тронут. */
export function spendGems(state: SaveState, n: number): boolean {
  const amount = Math.max(0, Math.floor(n));
  if (state.wallet.gems < amount) return false;
  state.wallet.gems -= amount;
  return true;
}

/* ————————————————————————— поводы ————————————————————————— */

/** Слово дошло до последней коробки. Один раз на слово — навсегда. */
export function awardMastery(state: SaveState, wordId: string, ts: number): number {
  const gained = grantOnce(state, 'master:' + wordId, GEM_MASTERED, ts);
  if (gained > 0) state.stats.mastered += 1;
  return gained;
}

/**
 * Уровень пройден без ошибок. Не обязательно с первой попытки: вернуться
 * к старому уровню и дочистить его — хорошее поведение, его и поощряем.
 * Выдаётся один раз на уровень, так что фармить нечего.
 */
export function awardPerfect(state: SaveState, levelId: string, ts: number): number {
  const gained = grantOnce(state, 'perfect:' + levelId, GEM_PERFECT, ts);
  if (gained > 0) state.stats.perfect += 1;
  return gained;
}

/**
 * Раздел закрыт. Две отдельные награды: за «пройден» и за «пройден на все
 * звёзды». Вторая может прийти много позже первой — и это правильно,
 * у игрока остаётся повод вернуться к старым уровням.
 */
export function awardSection(
  state: SaveState,
  sectionId: string,
  full: boolean,
  ts: number,
): number {
  let gained = grantOnce(state, 'section:' + sectionId, GEM_SECTION, ts);
  if (full) gained += grantOnce(state, 'section-full:' + sectionId, GEM_SECTION_FULL, ts);
  return gained;
}

/** Серия дожила до вехи. Выдаются все вехи, которые серия переросла. */
export function awardStreak(state: SaveState, days: number, ts: number): number {
  let gained = 0;
  for (const milestone of STREAK_MILESTONES) {
    if (days < milestone.days) break;
    gained += grantOnce(state, 'streak:' + milestone.days, milestone.gems, ts);
  }
  return gained;
}

/** Следующая веха серии — для подписи в профиле. */
export function nextStreakMilestone(days: number): { days: number; gems: number } | null {
  return STREAK_MILESTONES.find((m) => m.days > days) ?? null;
}
