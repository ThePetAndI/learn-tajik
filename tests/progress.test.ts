import { describe, expect, it } from 'vitest';
import type { FlatLevel } from '../src/data/content';
import { createInitialState, type SaveState } from '../src/data/state';
import {
  courseSummary,
  currentIndex,
  getLevelProgress,
  isDone,
  isUnlocked,
  recordLevelResult,
  sectionSummary,
  statusOf,
  totalStars,
} from '../src/domain/progress';
import { accuracy, starsFor, starsTitle } from '../src/domain/stars';

const T0 = Date.parse('2026-03-10T12:00:00Z');

/** Два раздела по три уровня. */
function makeLevels(): FlatLevel[] {
  const out: FlatLevel[] = [];
  for (const [si, sid] of [[0, 's00'], [1, 's01']] as [number, string][]) {
    for (let i = 0; i < 3; i++) {
      out.push({
        id: sid + '_l' + (i + 1),
        title: 'Уровень ' + (i + 1),
        wordIds: ['w_a', 'w_b'],
        phraseIds: [],
        exercises: 'auto',
        boss: i === 2,
        sectionId: sid,
        sectionTitle: sid === 's00' ? 'Приветствия' : 'Знакомство',
        sectionColor: 'green',
        sectionIcon: 'book',
        index: out.length,
        indexInSection: i,
        sectionIndex: si,
        playable: true,
      });
    }
  }
  return out;
}

function complete(state: SaveState, id: string, stars: number): void {
  state.levels[id] = { stars, best: stars / 3, attempts: 1, completedAt: T0 };
}

describe('открытие уровней', () => {
  const levels = makeLevels();

  it('первый уровень открыт всегда', () => {
    expect(isUnlocked(createInitialState(T0), levels, 0)).toBe(true);
  });

  it('следующий открывается только после предыдущего', () => {
    const state = createInitialState(T0);
    expect(isUnlocked(state, levels, 1)).toBe(false);
    complete(state, 's00_l1', 1);
    expect(isUnlocked(state, levels, 1)).toBe(true);
    expect(isUnlocked(state, levels, 2)).toBe(false);
  });

  it('уровень с нулём звёзд не считается пройденным', () => {
    const state = createInitialState(T0);
    state.levels['s00_l1'] = { stars: 0, best: 0.4, attempts: 3, completedAt: null };
    expect(isDone(state, 's00_l1')).toBe(false);
    expect(isUnlocked(state, levels, 1)).toBe(false);
  });

  it('цепочка открытия переходит через границу раздела', () => {
    const state = createInitialState(T0);
    complete(state, 's00_l1', 3);
    complete(state, 's00_l2', 3);
    complete(state, 's00_l3', 3);
    expect(isUnlocked(state, levels, 3)).toBe(true);
    expect(levels[3]!.sectionId).toBe('s01');
  });

  it('индекс за пределами списка закрыт', () => {
    expect(isUnlocked(createInitialState(T0), levels, 99)).toBe(false);
  });
});

describe('текущий уровень', () => {
  const levels = makeLevels();

  it('в начале — первый', () => {
    expect(currentIndex(createInitialState(T0), levels)).toBe(0);
  });

  it('первый непройденный', () => {
    const state = createInitialState(T0);
    complete(state, 's00_l1', 3);
    complete(state, 's00_l2', 2);
    expect(currentIndex(state, levels)).toBe(2);
  });

  it('когда всё пройдено — последний', () => {
    const state = createInitialState(T0);
    for (const l of levels) complete(state, l.id, 3);
    expect(currentIndex(state, levels)).toBe(levels.length - 1);
  });

  it('пропуск в середине возвращает именно дыру', () => {
    const state = createInitialState(T0);
    complete(state, 's00_l1', 3);
    complete(state, 's00_l3', 3); // вручную отредактированный импорт
    expect(currentIndex(state, levels)).toBe(1);
  });
});

describe('статус узла', () => {
  const levels = makeLevels();

  it('пройден / текущий / закрыт', () => {
    const state = createInitialState(T0);
    complete(state, 's00_l1', 2);
    expect(statusOf(state, levels, 0)).toBe('done');
    expect(statusOf(state, levels, 1)).toBe('current');
    expect(statusOf(state, levels, 2)).toBe('locked');
  });

  it('текущий ровно один', () => {
    const state = createInitialState(T0);
    const statuses = levels.map((_, i) => statusOf(state, levels, i));
    expect(statuses.filter((st) => st === 'current')).toHaveLength(1);
  });

  it('несуществующий индекс закрыт', () => {
    expect(statusOf(createInitialState(T0), levels, 42)).toBe('locked');
  });
});

describe('сводка по разделу', () => {
  const levels = makeLevels();

  it('считает звёзды и пройденные уровни', () => {
    const state = createInitialState(T0);
    complete(state, 's00_l1', 3);
    complete(state, 's00_l2', 1);
    const sum = sectionSummary(state, levels, 's00');
    expect(sum.stars).toBe(4);
    expect(sum.maxStars).toBe(9);
    expect(sum.done).toBe(2);
    expect(sum.total).toBe(3);
    expect(sum.locked).toBe(false);
  });

  it('следующий раздел закрыт, пока не пройден предыдущий', () => {
    const state = createInitialState(T0);
    expect(sectionSummary(state, levels, 's01').locked).toBe(true);
    complete(state, 's00_l1', 3);
    complete(state, 's00_l2', 3);
    complete(state, 's00_l3', 3);
    expect(sectionSummary(state, levels, 's01').locked).toBe(false);
  });

  it('первый раздел открыт с самого начала', () => {
    expect(sectionSummary(createInitialState(T0), levels, 's00').locked).toBe(false);
  });
});

describe('звёзды', () => {
  it('3 без ошибок, 2 за одну-две, 1 дальше', () => {
    expect(starsFor(0)).toBe(3);
    expect(starsFor(1)).toBe(2);
    expect(starsFor(2)).toBe(2);
    expect(starsFor(3)).toBe(1);
    expect(starsFor(99)).toBe(1);
  });

  it('точность в пределах 0..1', () => {
    expect(accuracy(8, 10)).toBeCloseTo(0.8);
    expect(accuracy(0, 0)).toBe(0);
    expect(accuracy(12, 10)).toBe(1);
  });

  it('подпись зависит от числа звёзд', () => {
    expect(starsTitle(3)).toBe('Идеально!');
    expect(starsTitle(1)).toBe('Уровень пройден');
  });
});

describe('запись результата уровня', () => {
  it('первое прохождение', () => {
    const state = createInitialState(T0);
    const res = recordLevelResult(state, 's00_l1', 8, 8, 0, T0);
    expect(res.stars).toBe(3);
    expect(res.firstClear).toBe(true);
    expect(res.improved).toBe(true);
    expect(state.levels['s00_l1']?.stars).toBe(3);
    expect(state.stats.levelsDone).toBe(1);
  });

  it('худший повтор не портит звёзды и точность', () => {
    const state = createInitialState(T0);
    recordLevelResult(state, 's00_l1', 8, 8, 0, T0);
    const second = recordLevelResult(state, 's00_l1', 4, 8, 4, T0 + 1000);
    expect(second.stars).toBe(1);
    expect(second.improved).toBe(false);
    expect(second.firstClear).toBe(false);
    expect(state.levels['s00_l1']?.stars).toBe(3);
    expect(state.levels['s00_l1']?.best).toBe(1);
  });

  it('улучшение поднимает звёзды', () => {
    const state = createInitialState(T0);
    recordLevelResult(state, 's00_l1', 5, 8, 3, T0);
    expect(state.levels['s00_l1']?.stars).toBe(1);
    const again = recordLevelResult(state, 's00_l1', 8, 8, 0, T0 + 1000);
    expect(again.improved).toBe(true);
    expect(state.levels['s00_l1']?.stars).toBe(3);
  });

  it('попытки копятся, дата первого прохождения не сдвигается', () => {
    const state = createInitialState(T0);
    recordLevelResult(state, 's00_l1', 8, 8, 0, T0);
    recordLevelResult(state, 's00_l1', 8, 8, 1, T0 + 5000);
    expect(state.levels['s00_l1']?.attempts).toBe(2);
    expect(state.levels['s00_l1']?.completedAt).toBe(T0);
    expect(state.stats.levelsDone).toBe(1);
  });
});

describe('сводка по курсу', () => {
  it('складывает звёзды и пройденные уровни', () => {
    const levels = makeLevels();
    const state = createInitialState(T0);
    complete(state, 's00_l1', 3);
    complete(state, 's01_l1', 2);
    const sum = courseSummary(state, levels);
    expect(sum.done).toBe(2);
    expect(sum.total).toBe(6);
    expect(sum.stars).toBe(5);
    expect(sum.maxStars).toBe(18);
    expect(totalStars(state)).toBe(5);
  });

  it('пустое состояние даёт нули', () => {
    const sum = courseSummary(createInitialState(T0), makeLevels());
    expect(sum.done).toBe(0);
    expect(sum.stars).toBe(0);
  });

  it('прогресс несуществующего уровня — нули', () => {
    expect(getLevelProgress(createInitialState(T0), 'нет такого').stars).toBe(0);
  });
});
