import { describe, expect, it } from 'vitest';
import { HOUR, MINUTE } from '../src/core/time';
import {
  LIFE_REGEN_MS,
  addLives,
  computeLives,
  hasLives,
  refillLives,
  setMaxLives,
  spendLife,
  syncLives,
} from '../src/domain/lives';
import { createInitialState } from '../src/data/state';

const T0 = Date.parse('2026-03-10T12:00:00Z');

function stateWith(count: number, updatedAt: number, max = 5) {
  const s = createInitialState(T0);
  s.lives = { count, max, updatedAt };
  return s;
}

describe('computeLives', () => {
  it('полный запас не тикает', () => {
    const v = computeLives({ count: 5, max: 5, updatedAt: T0 - HOUR }, T0);
    expect(v.count).toBe(5);
    expect(v.full).toBe(true);
    expect(v.msToNext).toBe(0);
  });

  it('одна жизнь за 30 минут', () => {
    const v = computeLives({ count: 2, max: 5, updatedAt: T0 }, T0 + LIFE_REGEN_MS);
    expect(v.count).toBe(3);
  });

  it('не выдаёт жизнь раньше срока', () => {
    const v = computeLives({ count: 0, max: 5, updatedAt: T0 }, T0 + LIFE_REGEN_MS - 1);
    expect(v.count).toBe(0);
    expect(v.msToNext).toBe(1);
  });

  it('копит несколько жизней за долгий перерыв', () => {
    const v = computeLives({ count: 0, max: 5, updatedAt: T0 }, T0 + 3 * LIFE_REGEN_MS + 5 * MINUTE);
    expect(v.count).toBe(3);
    // 5 минут уже прошли в счёт следующей
    expect(v.msToNext).toBe(LIFE_REGEN_MS - 5 * MINUTE);
  });

  it('не превышает максимум при очень долгом перерыве', () => {
    const v = computeLives({ count: 1, max: 5, updatedAt: T0 }, T0 + 40 * HOUR);
    expect(v.count).toBe(5);
    expect(v.full).toBe(true);
  });

  it('остаток времени переносится, а не сгорает', () => {
    const start = { count: 0, max: 5, updatedAt: T0 };
    const mid = computeLives(start, T0 + LIFE_REGEN_MS + 10 * MINUTE);
    expect(mid.count).toBe(1);
    // ещё 20 минут — и вторая жизнь на месте
    const later = computeLives(
      { count: mid.count, max: mid.max, updatedAt: mid.updatedAt },
      T0 + 2 * LIFE_REGEN_MS,
    );
    expect(later.count).toBe(2);
  });

  it('перевод часов назад не подвешивает таймер', () => {
    const v = computeLives({ count: 2, max: 5, updatedAt: T0 }, T0 - 5 * HOUR);
    expect(v.count).toBe(2);
    expect(v.updatedAt).toBe(T0 - 5 * HOUR);
    expect(v.msToNext).toBe(LIFE_REGEN_MS);
  });
});

describe('spendLife', () => {
  it('списывает жизнь и запускает отсчёт', () => {
    const s = stateWith(5, T0 - HOUR);
    expect(spendLife(s, T0)).toBe(true);
    expect(s.lives.count).toBe(4);
    expect(s.lives.updatedAt).toBe(T0);
  });

  it('на нуле возвращает false и не уходит в минус', () => {
    const s = stateWith(0, T0);
    expect(spendLife(s, T0)).toBe(false);
    expect(s.lives.count).toBe(0);
  });

  it('не сбрасывает накопленное время при неполном запасе', () => {
    const s = stateWith(3, T0 - 10 * MINUTE);
    spendLife(s, T0);
    expect(s.lives.count).toBe(2);
    // точка отсчёта осталась прежней — 10 минут не пропали
    expect(s.lives.updatedAt).toBe(T0 - 10 * MINUTE);
  });
});

describe('addLives и refillLives', () => {
  it('добавляет не больше максимума', () => {
    const s = stateWith(4, T0);
    expect(addLives(s, 3, T0)).toBe(1);
    expect(s.lives.count).toBe(5);
  });

  it('refill возвращает полный запас', () => {
    const s = stateWith(1, T0);
    expect(refillLives(s, T0)).toBe(4);
    expect(s.lives.count).toBe(5);
    expect(s.lives.updatedAt).toBe(T0);
  });

  it('учитывает восстановившиеся по таймеру перед выдачей', () => {
    const s = stateWith(0, T0 - LIFE_REGEN_MS);
    // одна уже накапала, добавляем ещё одну
    expect(addLives(s, 1, T0)).toBe(1);
    expect(s.lives.count).toBe(2);
  });
});

describe('setMaxLives', () => {
  it('новый слот от питомца сразу заполнен', () => {
    const s = stateWith(5, T0);
    setMaxLives(s, 6, T0);
    expect(s.lives.max).toBe(6);
    expect(s.lives.count).toBe(6);
  });

  it('уменьшение максимума обрезает текущее значение', () => {
    const s = stateWith(6, T0, 6);
    setMaxLives(s, 5, T0);
    expect(s.lives.count).toBe(5);
  });
});

describe('syncLives и hasLives', () => {
  it('sync записывает накопленное в состояние', () => {
    const s = stateWith(1, T0 - 2 * LIFE_REGEN_MS);
    syncLives(s, T0);
    expect(s.lives.count).toBe(3);
  });

  it('hasLives учитывает восстановление', () => {
    const s = stateWith(0, T0 - LIFE_REGEN_MS);
    expect(hasLives(s, T0)).toBe(true);
    expect(hasLives(stateWith(0, T0), T0)).toBe(false);
  });
});
