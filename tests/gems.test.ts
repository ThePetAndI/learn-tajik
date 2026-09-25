/**
 * Лаъл. Главное, что здесь проверяется, — что его нельзя намолотить:
 * каждая награда выдаётся один раз, и переигрывание не приносит ничего.
 * Если это сломается, вторая валюта превратится во вторые монеты.
 */

import { describe, expect, it } from 'vitest';
import type { FlatLevel } from '../src/data/content';
import { parseImport } from '../src/data/persist';
import { SAVE_VERSION, createInitialState, createWordStat, type SaveState } from '../src/data/state';
import {
  GEM_MASTERED,
  GEM_PERFECT,
  GEM_SECTION,
  GEM_SECTION_FULL,
  STREAK_MILESTONES,
  awardStreak,
  nextStreakMilestone,
  spendGems,
} from '../src/domain/gems';
import { awardSectionIfDone, recordLevelResult } from '../src/domain/progress';
import { reconcileGems } from '../src/domain/reconcile';
import { MAX_BOX, recordWordAttempt } from '../src/domain/srs';
import { touchStreak } from '../src/domain/streak';

const T0 = Date.parse('2026-03-10T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

function fresh(): SaveState {
  return createInitialState(T0);
}

/** Раздел из трёх уровней и один пустой, в который играть нельзя. */
function sectionLevels(): FlatLevel[] {
  const base = {
    title: '',
    wordIds: ['w_a'],
    phraseIds: [],
    exercises: 'auto' as const,
    boss: false,
    sectionId: 's05',
    sectionTitle: 'Числа',
    sectionColor: 'green',
    sectionIcon: 'num',
    sectionIndex: 5,
    playable: true,
  };
  return [
    { ...base, id: 's05_l1', index: 0, indexInSection: 0 },
    { ...base, id: 's05_l2', index: 1, indexInSection: 1 },
    { ...base, id: 's05_l3', index: 2, indexInSection: 2 },
    // пустой уровень не должен запирать награду за раздел навсегда
    { ...base, id: 's05_l4', index: 3, indexInSection: 3, playable: false, wordIds: [] },
  ];
}

/* ————————————————————————— освоенное слово ————————————————————————— */

describe('лаъл за освоенное слово', () => {
  function climb(s: SaveState, id: string, from: number): number {
    let ts = from;
    for (let i = 0; i < MAX_BOX; i++) {
      recordWordAttempt(s, id, true, ts);
      ts += 100 * DAY;
    }
    return ts;
  }

  it('до последней коробки — ничего', () => {
    const s = fresh();
    for (let i = 0; i < MAX_BOX - 1; i++) recordWordAttempt(s, 'w_a', true, T0 + i * DAY);
    expect(s.wallet.gems).toBe(0);
    expect(s.srs['w_a']!.mastered).toBe(false);
  });

  it('последняя коробка — лаъл и отметка «освоено»', () => {
    const s = fresh();
    climb(s, 'w_a', T0);
    expect(s.wallet.gems).toBe(GEM_MASTERED);
    expect(s.srs['w_a']!.mastered).toBe(true);
    expect(s.stats.mastered).toBe(1);
  });

  it('упал на ошибке и поднялся снова — второй раз не платят', () => {
    const s = fresh();
    const ts = climb(s, 'w_a', T0);
    recordWordAttempt(s, 'w_a', false, ts);
    climb(s, 'w_a', ts + DAY);
    expect(s.wallet.gems).toBe(GEM_MASTERED);
    expect(s.stats.mastered).toBe(1);
  });

  it('отметка «освоено» переживает ошибку: она про прошлое, а не про сейчас', () => {
    const s = fresh();
    const ts = climb(s, 'w_a', T0);
    recordWordAttempt(s, 'w_a', false, ts);
    expect(s.srs['w_a']!.box).toBe(0);
    expect(s.srs['w_a']!.mastered).toBe(true);
  });
});

/* ————————————————————————— уровень без ошибок ————————————————————————— */

describe('лаъл за уровень без ошибок', () => {
  it('без ошибок — платят', () => {
    const s = fresh();
    const r = recordLevelResult(s, 's01_l1', 8, 8, 0, T0);
    expect(r.gems).toBe(GEM_PERFECT);
    expect(s.wallet.gems).toBe(GEM_PERFECT);
    expect(s.stats.perfect).toBe(1);
  });

  it('с ошибкой — нет', () => {
    const s = fresh();
    expect(recordLevelResult(s, 's01_l1', 7, 8, 1, T0).gems).toBe(0);
    expect(s.wallet.gems).toBe(0);
  });

  it('переиграть идеальный уровень ещё раз — ничего', () => {
    const s = fresh();
    recordLevelResult(s, 's01_l1', 8, 8, 0, T0);
    for (let i = 1; i < 10; i++) {
      expect(recordLevelResult(s, 's01_l1', 8, 8, 0, T0 + i).gems).toBe(0);
    }
    expect(s.wallet.gems).toBe(GEM_PERFECT);
  });

  it('вернуться и дочистить старый уровень — платят, хоть и не с первой попытки', () => {
    const s = fresh();
    recordLevelResult(s, 's01_l1', 6, 8, 2, T0);
    expect(recordLevelResult(s, 's01_l1', 8, 8, 0, T0 + DAY).gems).toBe(GEM_PERFECT);
  });
});

/* ————————————————————————— раздел ————————————————————————— */

describe('лаъл за раздел', () => {
  const levels = sectionLevels();

  function clear(s: SaveState, id: string, stars: number): void {
    s.levels[id] = { stars, best: 1, attempts: 1, completedAt: T0 };
  }

  it('пока не пройден каждый уровень — ничего', () => {
    const s = fresh();
    clear(s, 's05_l1', 3);
    clear(s, 's05_l2', 3);
    expect(awardSectionIfDone(s, levels, 's05', T0)).toBe(0);
  });

  it('пустой уровень раздела не мешает его закрыть', () => {
    const s = fresh();
    for (const id of ['s05_l1', 's05_l2', 's05_l3']) clear(s, id, 2);
    expect(awardSectionIfDone(s, levels, 's05', T0)).toBe(GEM_SECTION);
  });

  it('все на три звезды — и обычная награда, и за полноту', () => {
    const s = fresh();
    for (const id of ['s05_l1', 's05_l2', 's05_l3']) clear(s, id, 3);
    expect(awardSectionIfDone(s, levels, 's05', T0)).toBe(GEM_SECTION + GEM_SECTION_FULL);
  });

  it('награда за полноту может прийти позже, и обычная второй раз не выдаётся', () => {
    const s = fresh();
    for (const id of ['s05_l1', 's05_l2', 's05_l3']) clear(s, id, 2);
    expect(awardSectionIfDone(s, levels, 's05', T0)).toBe(GEM_SECTION);
    for (const id of ['s05_l1', 's05_l2', 's05_l3']) clear(s, id, 3);
    expect(awardSectionIfDone(s, levels, 's05', T0 + DAY)).toBe(GEM_SECTION_FULL);
    expect(awardSectionIfDone(s, levels, 's05', T0 + 2 * DAY)).toBe(0);
  });
});

/* ————————————————————————— серия ————————————————————————— */

describe('лаъл за вехи серии', () => {
  it('веха берётся в тот день, когда серия до неё дошла', () => {
    const s = fresh();
    let got = 0;
    for (let d = 0; d < 3; d++) got += touchStreak(s, T0 + d * DAY).gems;
    expect(got).toBe(STREAK_MILESTONES[0]!.gems);
  });

  it('повторные занятия в тот же день не платят снова', () => {
    const s = fresh();
    for (let d = 0; d < 3; d++) touchStreak(s, T0 + d * DAY);
    const was = s.wallet.gems;
    for (let k = 0; k < 5; k++) touchStreak(s, T0 + 2 * DAY + k * 60_000);
    expect(s.wallet.gems).toBe(was);
  });

  it('серия прервалась и отросла заново — старые вехи второй раз не платят', () => {
    const s = fresh();
    for (let d = 0; d < 8; d++) touchStreak(s, T0 + d * DAY);
    const was = s.wallet.gems;
    expect(was).toBe(STREAK_MILESTONES[0]!.gems + STREAK_MILESTONES[1]!.gems);
    // пропуск в неделю, затем снова восемь дней подряд
    for (let d = 15; d < 23; d++) touchStreak(s, T0 + d * DAY);
    expect(s.wallet.gems).toBe(was);
  });

  it('перерос несколько вех сразу (старое сохранение) — выдаются все', () => {
    const s = fresh();
    const got = awardStreak(s, 31, T0);
    const expected = STREAK_MILESTONES.filter((m) => m.days <= 31).reduce((a, m) => a + m.gems, 0);
    expect(got).toBe(expected);
  });

  it('следующая веха — ближайшая сверху', () => {
    expect(nextStreakMilestone(0)?.days).toBe(3);
    expect(nextStreakMilestone(7)?.days).toBe(14);
    expect(nextStreakMilestone(10_000)).toBeNull();
  });
});

/* ————————————————————————— кошелёк ————————————————————————— */

describe('кошелёк лаъл', () => {
  it('без лаъл трата не проходит и кошелёк не трогает', () => {
    const s = fresh();
    s.wallet.gems = 3;
    expect(spendGems(s, 5)).toBe(false);
    expect(s.wallet.gems).toBe(3);
  });

  it('трата списывает ровно столько', () => {
    const s = fresh();
    s.wallet.gems = 10;
    expect(spendGems(s, 4)).toBe(true);
    expect(s.wallet.gems).toBe(6);
  });
});

/* ————————————————————————— старое сохранение ————————————————————————— */

describe('сохранение первой версии', () => {
  /**
   * Так выглядел файл до появления лаъл: ни кошелька лаъл, ни новых счётчиков,
   * ни отметки «освоено» у слов. У игрока на телефоне настоящий прогресс —
   * он обязан пережить обновление целиком.
   */
  const v1 = {
    kind: 'learn-tajik/progress',
    version: 1,
    exportedAt: T0,
    app: 'Тоҷикӣ',
    state: {
      version: 1,
      createdAt: T0,
      updatedAt: T0,
      profile: { name: 'Аня', petId: 'pet_cat', themeId: 'winter' },
      wallet: { coins: 1234 },
      lives: { count: 4, max: 6, updatedAt: T0 },
      streak: { current: 9, best: 12, lastDayKey: '2026-03-10', freezes: 2 },
      daily: { lastChestDay: null, lastWheelDay: null, todayKey: null, todayCount: 0 },
      levels: { s01_l1: { stars: 3, best: 1, attempts: 2, completedAt: T0 } },
      srs: {
        w_salom: {
          seen: 9, correct: 8, wrong: 1, streak: 3, box: 3, ease: 2.4,
          interval: 3, dueAt: T0, lastAt: T0, introduced: true,
        },
      },
      inventory: { items: { hint: 3 }, owned: ['pet_cat'], petLevels: { pet_cat: 3 } },
      achievements: {},
      stats: { answers: 120, correct: 101, levelsDone: 14, coinsEarned: 3000, bestCombo: 17, recoveries: 2 },
      settings: { haptics: true, reducedMotion: false, sound: false, dailyGoal: 20, showHints: true },
    },
  };

  it('читается, получает новую версию и пустой кошелёк лаъл', () => {
    const r = parseImport(JSON.stringify(v1), T0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.version).toBe(SAVE_VERSION);
    expect(r.state.wallet.gems).toBe(0);
    expect(r.state.stats.gemsEarned).toBe(0);
    expect(r.state.srs['w_salom']!.mastered).toBe(false);
  });

  it('ничего из старого прогресса не теряет', () => {
    const r = parseImport(JSON.stringify(v1), T0);
    if (!r.ok) throw new Error(r.error);
    expect(r.state.wallet.coins).toBe(1234);
    expect(r.state.profile.petId).toBe('pet_cat');
    expect(r.state.levels['s01_l1']!.stars).toBe(3);
    expect(r.state.srs['w_salom']!.box).toBe(3);
    expect(r.state.inventory.petLevels['pet_cat']).toBe(3);
    expect(r.state.streak.best).toBe(12);
    expect(r.state.stats.bestCombo).toBe(17);
  });
});

/* ————————————————————————— сверка с уже сделанным ————————————————————————— */

describe('сверка наград со старым прогрессом', () => {
  const levels = sectionLevels();

  /** Игрок, который всё это сделал до появления лаъл. */
  function veteran(): SaveState {
    const s = fresh();
    for (const id of ['s05_l1', 's05_l2', 's05_l3']) {
      s.levels[id] = { stars: 3, best: 1, attempts: 1, completedAt: T0 };
    }
    // слово в последней коробке, но отметки «освоено» у старого сохранения нет
    s.srs['w_a'] = { ...createWordStat(T0), box: MAX_BOX, introduced: true, mastered: false };
    s.streak.best = 9;
    return s;
  }

  it('выдаёт всё заслуженное: чистые уровни, раздел, освоенное слово, вехи', () => {
    const s = veteran();
    const got = reconcileGems(s, levels, T0);
    const streak = STREAK_MILESTONES.filter((m) => m.days <= 9).reduce((a, m) => a + m.gems, 0);
    expect(got).toBe(3 * GEM_PERFECT + GEM_SECTION + GEM_SECTION_FULL + GEM_MASTERED + streak);
    expect(s.srs['w_a']!.mastered).toBe(true);
  });

  it('второй вызов ничего не выдаёт — её можно звать на каждом старте', () => {
    const s = veteran();
    reconcileGems(s, levels, T0);
    const was = s.wallet.gems;
    expect(reconcileGems(s, levels, T0 + DAY)).toBe(0);
    expect(s.wallet.gems).toBe(was);
  });

  it('уровень на две звезды не считается чистым', () => {
    const s = fresh();
    s.levels['s05_l1'] = { stars: 2, best: 0.9, attempts: 1, completedAt: T0 };
    expect(reconcileGems(s, levels, T0)).toBe(0);
  });

  it('после сверки обычная награда за то же самое не выдаётся', () => {
    const s = veteran();
    reconcileGems(s, levels, T0);
    expect(recordLevelResult(s, 's05_l1', 8, 8, 0, T0 + DAY).gems).toBe(0);
  });
});
