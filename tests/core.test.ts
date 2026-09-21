import { describe, expect, it } from 'vitest';
import { hashSeed, mulberry32, pick, rngFor, sample, shuffle, weightedPick } from '../src/core/rng';
import { DAY, dayKey, daysBetween, formatClock, formatDuration, msUntilNextDay, plural } from '../src/core/time';

describe('генератор случайных чисел', () => {
  it('один seed — одна последовательность', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = [a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it('разные seed дают разные последовательности', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it('значения лежат в [0, 1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 500; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('rngFor детерминирован по строке', () => {
    expect(rngFor('s01_l1:0')()).toBe(rngFor('s01_l1:0')());
    expect(rngFor('s01_l1:0')()).not.toBe(rngFor('s01_l1:1')());
  });

  it('hashSeed различает похожие строки', () => {
    expect(hashSeed('level1')).not.toBe(hashSeed('level2'));
  });

  it('shuffle сохраняет состав и не трогает исходник', () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(mulberry32(3), src);
    expect(out).not.toBe(src);
    expect([...out].sort((a, b) => a - b)).toEqual(src);
    expect(src).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('sample не повторяет элементы и не просит лишнего', () => {
    const src = ['a', 'b', 'c'];
    const out = sample(mulberry32(9), src, 10);
    expect(out).toHaveLength(3);
    expect(new Set(out).size).toBe(3);
    expect(sample(mulberry32(9), src, 0)).toHaveLength(0);
  });

  it('pick на пустом массиве падает явно', () => {
    expect(() => pick(mulberry32(1), [])).toThrow();
  });

  it('weightedPick тянется к большему весу', () => {
    const items = ['редкий', 'частый'];
    const rng = mulberry32(42);
    let frequent = 0;
    for (let i = 0; i < 1000; i++) {
      if (weightedPick(rng, items, (x) => (x === 'частый' ? 9 : 1)) === 'частый') frequent++;
    }
    expect(frequent).toBeGreaterThan(820);
  });

  it('weightedPick с нулевыми весами не зависает', () => {
    expect(['a', 'b']).toContain(weightedPick(mulberry32(1), ['a', 'b'], () => 0));
  });
});

describe('время', () => {
  it('dayKey даёт локальную дату', () => {
    const ts = new Date(2026, 2, 10, 23, 30).getTime();
    expect(dayKey(ts)).toBe('2026-03-10');
  });

  it('daysBetween считает календарные дни', () => {
    expect(daysBetween('2026-03-10', '2026-03-11')).toBe(1);
    expect(daysBetween('2026-03-10', '2026-03-10')).toBe(0);
    expect(daysBetween('2026-03-11', '2026-03-10')).toBe(-1);
    expect(daysBetween('2026-02-28', '2026-03-01')).toBe(1);
  });

  it('daysBetween переживает переход через месяц и год', () => {
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1);
  });

  it('formatDuration округляет вверх', () => {
    expect(formatDuration(0)).toBe('0 мин');
    expect(formatDuration(1)).toBe('1 мин');
    expect(formatDuration(30 * 60_000)).toBe('30 мин');
    expect(formatDuration(90 * 60_000)).toBe('1 ч 30 мин');
    expect(formatDuration(120 * 60_000)).toBe('2 ч');
  });

  it('от суток формат переходит на дни', () => {
    expect(formatDuration(24 * 60 * 60_000)).toBe('1 день');
    expect(formatDuration(72 * 60 * 60_000)).toBe('3 дня');
    expect(formatDuration(90 * 24 * 60 * 60_000)).toBe('90 дней');
    // 23 часа — всё ещё часы
    expect(formatDuration(23 * 60 * 60_000)).toBe('23 ч');
  });

  it('formatClock', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(65_000)).toBe('01:05');
  });

  it('msUntilNextDay в пределах суток', () => {
    const ms = msUntilNextDay(new Date(2026, 2, 10, 23, 0).getTime());
    expect(ms).toBe(60 * 60 * 1000);
    expect(msUntilNextDay()).toBeGreaterThan(0);
    expect(msUntilNextDay()).toBeLessThanOrEqual(DAY);
  });

  it('склонения', () => {
    expect(plural(1, 'день', 'дня', 'дней')).toBe('день');
    expect(plural(2, 'день', 'дня', 'дней')).toBe('дня');
    expect(plural(5, 'день', 'дня', 'дней')).toBe('дней');
    expect(plural(11, 'день', 'дня', 'дней')).toBe('дней');
    expect(plural(21, 'день', 'дня', 'дней')).toBe('день');
    expect(plural(112, 'день', 'дня', 'дней')).toBe('дней'); // 11–14 — исключение
    expect(plural(122, 'день', 'дня', 'дней')).toBe('дня');
  });
});
