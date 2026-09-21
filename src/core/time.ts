/**
 * Время. Приложение офлайновое, сервера нет — «день» это локальный день устройства.
 * now() вынесено в переменную, чтобы тесты могли двигать часы.
 */

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

let nowProvider: () => number = () => Date.now();

export function now(): number {
  return nowProvider();
}

export function setNowProvider(fn: () => number): void {
  nowProvider = fn;
}

export function resetNowProvider(): void {
  nowProvider = () => Date.now();
}

/** Локальная дата YYYY-MM-DD — ключ стрика и дневных наград. */
export function dayKey(ts: number = now()): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

/** Разница в календарных днях между двумя ключами дат (toKey минус fromKey). */
export function daysBetween(fromKey: string, toKey: string): number {
  const a = Date.parse(fromKey + 'T00:00:00');
  const b = Date.parse(toKey + 'T00:00:00');
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / DAY);
}

/** «5 мин», «1 ч 20 мин» — подпись под таймером жизней. */
export function formatDuration(ms: number): string {
  if (ms <= 0) return '0 мин';
  const totalMin = Math.ceil(ms / MINUTE);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return m + ' мин';
  if (m === 0) return h + ' ч';
  return h + ' ч ' + m + ' мин';
}

/** «04:31» — для обратного отсчёта. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / SECOND));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

/** Сколько осталось до локальной полуночи. */
export function msUntilNextDay(ts: number = now()): number {
  const d = new Date(ts);
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
  return next.getTime() - ts;
}

/** Склонение: 1 день, 2 дня, 5 дней. */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
