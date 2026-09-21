/**
 * Вибрация через navigator.vibrate. Выключатель — в настройках.
 * На desktop и в iOS Safari API нет: тихо ничего не делаем.
 */

let enabled = true;

export function setHapticsEnabled(on: boolean): void {
  enabled = on;
}

export function hapticsSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

function buzz(pattern: number | number[]): void {
  if (!enabled || !hapticsSupported()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // некоторые прошивки кидают исключение — это не повод ронять игру
  }
}

export const haptics = {
  tap: () => buzz(10),
  correct: () => buzz(18),
  wrong: () => buzz([30, 60, 30]),
  levelUp: () => buzz([14, 40, 14, 40, 45]),
  reward: () => buzz([10, 30, 10, 30, 10, 30, 35]),
  fail: () => buzz([50, 80, 120]),
};
