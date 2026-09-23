import { describe, expect, it } from 'vitest';
import { DAY, MINUTE } from '../src/core/time';
import { createInitialState, type SaveState } from '../src/data/state';
import {
  BOX_INTERVALS,
  MAX_BOX,
  MAX_EASE,
  MIN_EASE,
  dueCount,
  dueWords,
  dueWordsFrom,
  getWordStat,
  hardestWords,
  introducedCount,
  isDue,
  recordAttemptWords,
  recordWordAttempt,
  reviewSelection,
  wordDifficulty,
  wordsSummary,
} from '../src/domain/srs';

const T0 = Date.parse('2026-03-10T12:00:00Z');

function fresh(): SaveState {
  return createInitialState(T0);
}

describe('запись попытки', () => {
  it('первый верный ответ вводит слово в оборот', () => {
    const s = fresh();
    const stat = recordWordAttempt(s, 'w_a', true, T0);
    expect(stat.seen).toBe(1);
    expect(stat.correct).toBe(1);
    expect(stat.streak).toBe(1);
    expect(stat.box).toBe(1);
    expect(stat.introduced).toBe(true);
  });

  it('ошибка не вводит слово в оборот', () => {
    const s = fresh();
    const stat = recordWordAttempt(s, 'w_a', false, T0);
    expect(stat.introduced).toBe(false);
    expect(stat.wrong).toBe(1);
    expect(stat.box).toBe(0);
  });

  it('верные ответы двигают слово по коробкам', () => {
    const s = fresh();
    for (let i = 0; i < 4; i++) recordWordAttempt(s, 'w_a', true, T0);
    expect(s.srs['w_a']?.box).toBe(4);
  });

  it('коробка не растёт выше максимума', () => {
    const s = fresh();
    for (let i = 0; i < 20; i++) recordWordAttempt(s, 'w_a', true, T0);
    expect(s.srs['w_a']?.box).toBe(MAX_BOX);
  });

  it('ошибка возвращает слово в нулевую коробку', () => {
    const s = fresh();
    for (let i = 0; i < 5; i++) recordWordAttempt(s, 'w_a', true, T0);
    recordWordAttempt(s, 'w_a', false, T0);
    expect(s.srs['w_a']?.box).toBe(0);
    expect(s.srs['w_a']?.streak).toBe(0);
  });

  it('интервал растёт с каждой ступенью', () => {
    const s = fresh();
    const seen: number[] = [];
    for (let i = 0; i < MAX_BOX; i++) {
      seen.push(recordWordAttempt(s, 'w_a', true, T0).interval);
    }
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]).toBeGreaterThan(seen[i - 1] as number);
    }
    expect(seen[seen.length - 1]).toBeGreaterThanOrEqual(BOX_INTERVALS[MAX_BOX] as number);
  });

  it('после ошибки слово возвращается в ближайшие минуты, а не через сутки', () => {
    const s = fresh();
    recordWordAttempt(s, 'w_a', true, T0);
    const stat = recordWordAttempt(s, 'w_a', false, T0);
    expect(stat.dueAt - T0).toBeLessThanOrEqual(15 * MINUTE);
    expect(stat.interval).toBe(0);
  });

  it('лёгкость держится в рабочем диапазоне', () => {
    const s = fresh();
    for (let i = 0; i < 40; i++) recordWordAttempt(s, 'w_up', true, T0);
    expect(s.srs['w_up']?.ease).toBeLessThanOrEqual(MAX_EASE);
    for (let i = 0; i < 40; i++) recordWordAttempt(s, 'w_down', false, T0);
    expect(s.srs['w_down']?.ease).toBeGreaterThanOrEqual(MIN_EASE);
  });

  it('трудное слово получает более короткий интервал, чем лёгкое', () => {
    const s = fresh();
    // лёгкое: только верные ответы
    for (let i = 0; i < 3; i++) recordWordAttempt(s, 'w_easy', true, T0);
    // трудное: ошибались, потом столько же верных
    recordWordAttempt(s, 'w_hard', false, T0);
    recordWordAttempt(s, 'w_hard', false, T0);
    for (let i = 0; i < 3; i++) recordWordAttempt(s, 'w_hard', true, T0);
    expect(s.srs['w_hard']?.interval).toBeLessThan(s.srs['w_easy']?.interval as number);
  });

  it('запись сразу по нескольким словам', () => {
    const s = fresh();
    recordAttemptWords(s, ['w_a', 'w_b', 'w_c'], true, T0);
    expect(Object.keys(s.srs)).toHaveLength(3);
  });

  it('статистика несуществующего слова — пустая заготовка', () => {
    const stat = getWordStat(fresh(), 'нет такого', T0);
    expect(stat.seen).toBe(0);
    expect(stat.introduced).toBe(false);
  });
});

describe('просроченность', () => {
  it('невведённое слово не считается просроченным', () => {
    const s = fresh();
    recordWordAttempt(s, 'w_a', false, T0);
    expect(isDue(s.srs['w_a']!, T0 + DAY)).toBe(false);
  });

  it('слово становится просроченным после интервала', () => {
    const s = fresh();
    recordWordAttempt(s, 'w_a', true, T0);
    const stat = s.srs['w_a']!;
    expect(isDue(stat, T0)).toBe(false);
    expect(isDue(stat, stat.dueAt)).toBe(true);
    expect(isDue(stat, stat.dueAt + DAY)).toBe(true);
  });

  it('счётчик и список просроченных совпадают', () => {
    const s = fresh();
    for (const id of ['w_a', 'w_b', 'w_c']) recordWordAttempt(s, id, true, T0);
    const later = T0 + 10 * DAY;
    expect(dueCount(s, later)).toBe(3);
    expect(dueWords(s, later)).toHaveLength(3);
  });

  it('просроченные сортируются по давности', () => {
    const s = fresh();
    recordWordAttempt(s, 'w_old', true, T0);
    recordWordAttempt(s, 'w_new', true, T0 + 2 * DAY);
    const list = dueWords(s, T0 + 30 * DAY);
    expect(list[0]).toBe('w_old');
  });

  it('dueWordsFrom смотрит только на свой набор', () => {
    const s = fresh();
    recordWordAttempt(s, 'w_a', true, T0);
    recordWordAttempt(s, 'w_b', true, T0);
    const later = T0 + 10 * DAY;
    expect(dueWordsFrom(s, ['w_a'], later)).toEqual(['w_a']);
    expect(dueWordsFrom(s, ['w_zzz'], later)).toEqual([]);
  });
});

describe('сложность слова', () => {
  it('ошибки делают слово труднее', () => {
    const s = fresh();
    recordWordAttempt(s, 'w_good', true, T0);
    recordWordAttempt(s, 'w_good', true, T0);
    recordWordAttempt(s, 'w_bad', false, T0);
    recordWordAttempt(s, 'w_bad', false, T0);
    expect(wordDifficulty(s.srs['w_bad']!)).toBeGreaterThan(wordDifficulty(s.srs['w_good']!));
  });

  it('оценка не выходит за 0..1', () => {
    const s = fresh();
    for (let i = 0; i < 30; i++) recordWordAttempt(s, 'w_x', i % 2 === 0, T0);
    const d = wordDifficulty(s.srs['w_x']!);
    expect(d).toBeGreaterThanOrEqual(0);
    expect(d).toBeLessThanOrEqual(1);
  });

  it('самые трудные идут первыми', () => {
    const s = fresh();
    for (let i = 0; i < 5; i++) recordWordAttempt(s, 'w_easy', true, T0);
    recordWordAttempt(s, 'w_hard', false, T0);
    recordWordAttempt(s, 'w_hard', false, T0);
    expect(hardestWords(s, 1, T0)).toEqual(['w_hard']);
  });

  it('незнакомые слова в подборку не попадают', () => {
    const s = fresh();
    recordWordAttempt(s, 'w_a', true, T0);
    expect(hardestWords(s, 10, T0)).toEqual(['w_a']);
  });
});

describe('подборка на повторение', () => {
  it('просроченное идёт раньше трудного, но свежего', () => {
    const s = fresh();
    // свежее и трудное, но ещё не просрочено
    recordWordAttempt(s, 'w_hard', false, T0);
    recordWordAttempt(s, 'w_hard', true, T0);
    // усвоенное, но давно просроченное
    for (let i = 0; i < 3; i++) recordWordAttempt(s, 'w_due', true, T0 - 60 * DAY);

    const list = reviewSelection(s, ['w_hard', 'w_due'], 2, T0);
    expect(list[0]).toBe('w_due');
  });

  it('незнакомые слова не берутся — повторение не учит новому', () => {
    const s = fresh();
    recordWordAttempt(s, 'w_known', true, T0);
    const list = reviewSelection(s, ['w_known', 'w_never_seen'], 5, T0);
    expect(list).toEqual(['w_known']);
  });

  it('ограничение по размеру соблюдается', () => {
    const s = fresh();
    const ids: string[] = [];
    for (let i = 0; i < 20; i++) {
      ids.push('w_' + i);
      recordWordAttempt(s, 'w_' + i, true, T0);
    }
    expect(reviewSelection(s, ids, 7, T0)).toHaveLength(7);
  });

  it('пустой набор даёт пустую подборку', () => {
    expect(reviewSelection(fresh(), [], 5, T0)).toEqual([]);
  });
});

describe('сводка по словам', () => {
  it('считает встреченные, выученные и просроченные', () => {
    const s = fresh();
    recordWordAttempt(s, 'w_new', false, T0);
    recordWordAttempt(s, 'w_learning', true, T0);
    for (let i = 0; i < 5; i++) recordWordAttempt(s, 'w_learned', true, T0);

    const sum = wordsSummary(s, T0);
    expect(sum.seen).toBe(3);
    expect(sum.introduced).toBe(2);
    expect(sum.learned).toBe(1);
    expect(sum.due).toBe(0);

    expect(wordsSummary(s, T0 + 3 * DAY).due).toBeGreaterThan(0);
  });

  it('introducedCount смотрит на свой набор', () => {
    const s = fresh();
    recordWordAttempt(s, 'w_a', true, T0);
    recordWordAttempt(s, 'w_b', false, T0);
    expect(introducedCount(s, ['w_a', 'w_b', 'w_c'])).toBe(1);
  });

  it('пустое состояние даёт нули', () => {
    const sum = wordsSummary(fresh(), T0);
    expect(sum).toEqual({ seen: 0, introduced: 0, learned: 0, due: 0 });
  });
});

describe('поведение на длинной дистанции', () => {
  it('слово, которое всегда знают, уходит в долгий интервал', () => {
    const s = fresh();
    let ts = T0;
    for (let i = 0; i < 8; i++) {
      recordWordAttempt(s, 'w_a', true, ts);
      ts = s.srs['w_a']!.dueAt;
    }
    expect(s.srs['w_a']!.interval).toBeGreaterThan(60);
  });

  it('слово, в котором постоянно ошибаются, остаётся в начале', () => {
    const s = fresh();
    let ts = T0;
    for (let i = 0; i < 10; i++) {
      recordWordAttempt(s, 'w_a', i % 3 === 0, ts);
      ts = s.srs['w_a']!.dueAt;
    }
    expect(s.srs['w_a']!.box).toBeLessThanOrEqual(2);
  });
});

describe('награда за повторение', () => {
  it('меньше, чем за уровень: повторение можно крутить бесконечно', async () => {
    // обе формулы — в домене: тесту не нужно тянуть за собой экран со всем интерфейсом
    const { reviewCoins } = await import('../src/domain/economy');
    const { recoveryCoins } = await import('../src/domain/recovery');
    // полный уровень с тремя звёздами даёт около 85 монет
    expect(reviewCoins(114)).toBeLessThan(85);
    expect(recoveryCoins(198)).toBeLessThan(85);
    expect(reviewCoins(0)).toBe(1);
  });
});
