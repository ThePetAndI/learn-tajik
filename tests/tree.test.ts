/**
 * Дерево прокачки: форма дерева, правила открытия и то, что узлы
 * действительно меняют игру, а не только рисуются.
 */

import { describe, expect, it } from 'vitest';
import { createInitialState, type SaveState } from '../src/data/state';
import {
  BASE_MAX_LIVES,
  chestRewardsFor,
  coinMultiplier,
  comboCapFor,
  hintCost,
  maxLivesFor,
  perksOf,
  regenMsFor,
  reviewExtraFor,
  shieldFor,
  spinsPerDay,
} from '../src/domain/bonuses';
import { canSpinWheel, openChest, spinWheel, spinsLeftToday } from '../src/domain/daily';
import { COMBO_BONUS_MAX } from '../src/domain/economy';
import { addGems } from '../src/domain/gems';
import { LIFE_REGEN_MS, computeLives, spendLife } from '../src/domain/lives';
import { mulberry32 } from '../src/core/rng';
import { dayKey } from '../src/core/time';
import { canUnlock, unlockNode } from '../src/domain/tree';
import {
  BRANCHES,
  TREE,
  getNode,
  nodeStatus,
  taskLabel,
  taskProgress,
  type TreeNode,
} from '../src/domain/tree-nodes';

const T0 = Date.parse('2026-03-10T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

function rich(): SaveState {
  const s = createInitialState(T0);
  s.wallet.coins = 1_000_000;
  s.wallet.gems = 10_000;
  // все задания выполнены — проверяем только правила открытия
  s.stats.levelsDone = 500;
  s.stats.perfect = 500;
  s.stats.mastered = 500;
  s.stats.bestCombo = 500;
  s.stats.reviews = 500;
  s.stats.recoveries = 500;
  s.stats.cases = 500;
  s.streak.best = 500;
  for (let i = 0; i < 300; i++) {
    s.levels['l' + i] = { stars: 3, best: 1, attempts: 1, completedAt: T0 };
    s.srs['w' + i] = { seen: 1, correct: 1, wrong: 0, streak: 1, box: 1, ease: 2.5, interval: 1, dueAt: T0, lastAt: T0, introduced: true, mastered: false };
  }
  for (let i = 0; i < 30; i++) s.inventory.gear['g' + i] = 1;
  return s;
}

/** Открывает узел вместе со всеми предками, по порядку. */
function unlockWithAncestors(s: SaveState, id: string): void {
  const node = getNode(id)!;
  for (const p of node.parents) if (s.tree[p] === undefined) unlockWithAncestors(s, p);
  expect(unlockNode(s, id, T0), id).toBe('ok');
}

/* ————————————————————————— форма ————————————————————————— */

describe('форма дерева', () => {
  it('у каждого узла уникальный id, и все родители существуют', () => {
    const ids = new Set(TREE.map((n) => n.id));
    expect(ids.size).toBe(TREE.length);
    for (const node of TREE) for (const p of node.parents) expect(ids.has(p), node.id + ' <- ' + p).toBe(true);
  });

  it('родитель всегда выше ребёнка — циклов нет', () => {
    for (const node of TREE) {
      for (const p of node.parents) expect(getNode(p)!.row, node.id).toBeLessThan(node.row);
    }
  });

  it('корень один, и из него достижим каждый узел', () => {
    const roots = TREE.filter((n) => n.parents.length === 0);
    expect(roots.map((r) => r.id)).toEqual(['root']);
    const reach = new Set(['root']);
    let grew = true;
    while (grew) {
      grew = false;
      for (const n of TREE) {
        if (!reach.has(n.id) && n.parents.every((p) => reach.has(p))) {
          reach.add(n.id);
          grew = true;
        }
      }
    }
    expect(reach.size).toBe(TREE.length);
  });

  it('вершина требует вершины всех четырёх веток', () => {
    const crown = getNode('crown')!;
    const tips = BRANCHES.map((b) => TREE.filter((n) => n.branch === b.id).sort((a, c) => c.row - a.row)[0]!.id);
    expect([...crown.parents].sort()).toEqual([...tips].sort());
  });

  /*
   * Перекрёстные связи рисуются диагональю между колонками. Через колонку
   * она перечеркнула бы соседнюю ветку, и дерево стало бы нечитаемым.
   */
  it('перекрёстные связи — только между соседними ветками', () => {
    for (const node of TREE) {
      if (node.branch === null) continue;
      for (const p of node.parents) {
        const parent = getNode(p)!;
        if (parent.branch === null) continue;
        expect(Math.abs(parent.col - node.col), node.id + ' <- ' + p).toBeLessThanOrEqual(1);
      }
    }
  });

  it('в каждой ветке семь узлов, и каждый дальше по ветке дороже', () => {
    for (const b of BRANCHES) {
      const chain = TREE.filter((n) => n.branch === b.id).sort((a, c) => a.row - c.row);
      expect(chain.length, b.id).toBe(7);
      for (let i = 1; i < chain.length; i++) {
        expect(chain[i]!.coins, chain[i]!.id).toBeGreaterThan(chain[i - 1]!.coins);
      }
    }
  });

  it('каждый узел что-то даёт', () => {
    for (const node of TREE) expect(Object.keys(node.perks).length, node.id).toBeGreaterThan(0);
  });

  it('первые узлы по карману новичку — дешевле двух пройденных уровней', () => {
    // первое прохождение уровня на три звезды приносит около 70 монет
    for (const node of TREE.filter((n) => n.row <= 1)) expect(node.coins, node.id).toBeLessThanOrEqual(140);
  });
});

/* ————————————————————————— правила открытия ————————————————————————— */

describe('открытие узлов', () => {
  it('без родителей — нельзя', () => {
    expect(canUnlock(rich(), 'z1')).toBe('locked');
  });

  it('без выполненного задания — нельзя, даже с полным кошельком', () => {
    const s = createInitialState(T0);
    s.wallet.coins = 10_000;
    expect(canUnlock(s, 'root')).toBe('task');
    s.stats.levelsDone = 1;
    expect(canUnlock(s, 'root')).toBe('ok');
  });

  it('без монет — нельзя, и ничего не списывается', () => {
    const s = rich();
    s.wallet.coins = 10;
    expect(unlockNode(s, 'root', T0)).toBe('not-enough-coins');
    expect(s.wallet.coins).toBe(10);
    expect(s.tree['root']).toBeUndefined();
  });

  it('без лаъл — нельзя', () => {
    const s = rich();
    unlockWithAncestors(s, 's2');
    s.wallet.gems = 1;
    expect(canUnlock(s, 's3')).toBe('not-enough-gems');
  });

  it('открытие списывает ровно цену — и монеты, и лаъл', () => {
    const s = rich();
    unlockWithAncestors(s, 's2');
    const coins = s.wallet.coins;
    const gems = s.wallet.gems;
    const node = getNode('s3')!;
    expect(unlockNode(s, 's3', T0)).toBe('ok');
    expect(s.wallet.coins).toBe(coins - node.coins);
    expect(s.wallet.gems).toBe(gems - node.gems);
  });

  it('второй раз тот же узел не открывается и не списывает', () => {
    const s = rich();
    unlockWithAncestors(s, 'root');
    const coins = s.wallet.coins;
    expect(unlockNode(s, 'root', T0)).toBe('owned');
    expect(s.wallet.coins).toBe(coins);
  });

  it('перекрёстный узел ждёт обоих родителей', () => {
    const s = rich();
    unlockWithAncestors(s, 'z4');
    expect(canUnlock(s, 'z5')).toBe('locked'); // нужен ещё s4
    unlockWithAncestors(s, 's4');
    expect(canUnlock(s, 'z5')).toBe('ok');
  });

  it('открывается всё дерево целиком', () => {
    const s = rich();
    for (const node of TREE) if (s.tree[node.id] === undefined) unlockWithAncestors(s, node.id);
    expect(Object.keys(s.tree).length).toBe(TREE.length);
  });

  it('состояние узла на экране соответствует правилам', () => {
    const s = createInitialState(T0);
    const root = getNode('root') as TreeNode;
    expect(nodeStatus(s, root)).toBe('task');
    s.stats.levelsDone = 1;
    s.wallet.coins = 0;
    expect(nodeStatus(s, root)).toBe('poor');
    s.wallet.coins = 1000;
    expect(nodeStatus(s, root)).toBe('ready');
    expect(nodeStatus(s, getNode('z1')!)).toBe('locked');
    unlockNode(s, 'root', T0);
    expect(nodeStatus(s, root)).toBe('owned');
  });
});

/* ————————————————————————— узлы меняют игру ————————————————————————— */

describe('узлы действительно работают', () => {
  it('«Запасное сердце» добавляет жизнь сразу, а не после перезапуска', () => {
    const s = rich();
    unlockWithAncestors(s, 'root');
    expect(s.lives.max).toBe(BASE_MAX_LIVES);
    unlockNode(s, 's1', T0);
    expect(maxLivesFor(s)).toBe(BASE_MAX_LIVES + 1);
    expect(s.lives.max).toBe(BASE_MAX_LIVES + 1);
    expect(s.lives.count).toBe(BASE_MAX_LIVES + 1);
  });

  it('монетные узлы поднимают множитель', () => {
    const s = rich();
    const was = coinMultiplier(s);
    unlockWithAncestors(s, 'z1');
    expect(coinMultiplier(s)).toBeGreaterThan(was);
  });

  it('щит считается по открытым узлам', () => {
    const s = rich();
    expect(shieldFor(s)).toBe(0);
    unlockWithAncestors(s, 's3');
    expect(shieldFor(s)).toBe(1);
    unlockWithAncestors(s, 's6');
    expect(shieldFor(s)).toBe(2);
  });

  it('«Глубокий вдох» ускоряет восстановление жизней', () => {
    const s = rich();
    unlockWithAncestors(s, 's2');
    expect(regenMsFor(s)).toBeLessThan(LIFE_REGEN_MS);
    expect(s.lives.regenMs).toBe(regenMsFor(s));
    // проверка на деле: жизнь возвращается раньше получаса
    spendLife(s, T0);
    expect(computeLives(s.lives, T0 + regenMsFor(s)).count).toBe(s.lives.max);
  });

  it('ускорение не дарит жизни задним числом', () => {
    const s = rich();
    unlockWithAncestors(s, 's1');
    spendLife(s, T0);
    spendLife(s, T0);
    const before = computeLives(s.lives, T0 + 20 * 60_000).count;
    // спустя 20 минут открываем ускорение: прошедшее время считается по старой скорости
    unlockNode(s, 's2', T0 + 20 * 60_000);
    expect(computeLives(s.lives, T0 + 20 * 60_000).count).toBe(before);
  });

  it('подсказки дешевеют с «Зорким глазом»', () => {
    const s = rich();
    const was = hintCost(s, 20);
    unlockWithAncestors(s, 'd1');
    expect(hintCost(s, 20)).toBeLessThan(was);
  });

  it('«Золотая серия» поднимает потолок бонуса серии', () => {
    const s = rich();
    expect(comboCapFor(s)).toBe(COMBO_BONUS_MAX);
    unlockWithAncestors(s, 'z5');
    expect(comboCapFor(s)).toBe(COMBO_BONUS_MAX + 2);
  });

  it('«Повторение» удлиняет сессию повторения', () => {
    const s = rich();
    unlockWithAncestors(s, 'd2');
    expect(reviewExtraFor(s)).toBe(3);
  });

  it('«Второй оборот» даёт второе вращение колеса в тот же день', () => {
    const s = rich();
    expect(spinsPerDay(s)).toBe(1);
    spinWheel(s, mulberry32(1), T0);
    expect(canSpinWheel(s, T0)).toBe(false);
    unlockWithAncestors(s, 'b2');
    expect(spinsLeftToday(s, T0)).toBe(1);
    expect(spinWheel(s, mulberry32(2), T0)).not.toBeNull();
    expect(canSpinWheel(s, T0)).toBe(false);
    // назавтра счётчик сбрасывается
    expect(spinsLeftToday(s, T0 + DAY)).toBe(2);
  });

  it('«Щедрый день» кладёт в сундук дня вторую награду', () => {
    const s = rich();
    s.daily.todayKey = null;
    unlockWithAncestors(s, 'b4');
    expect(chestRewardsFor(s)).toBe(2);
    // сундук открывается за дневную цель
    s.settings.dailyGoal = 5;
    s.daily.todayKey = dayKey(T0);
    s.daily.todayCount = 5;
    const got = openChest(s, mulberry32(3), T0);
    expect(got).not.toBeNull();
    expect(got!.length).toBe(2);
  });

  /*
   * Бонус +10% к награде в один лаъл без накопления дробной части
   * округлялся бы обратно в один — и не работал бы вовсе.
   */
  it('бонус к лаъл работает и на наградах в один лаъл', () => {
    const s = rich();
    unlockWithAncestors(s, 'd3');
    expect(perksOf(s).gems).toBeCloseTo(0.1);
    const was = s.wallet.gems;
    let got = 0;
    for (let i = 0; i < 10; i++) got += addGems(s, 1);
    expect(got).toBe(11);
    expect(s.wallet.gems).toBe(was + 11);
  });
});

/* ————————————————————————— задания ————————————————————————— */

describe('задания открытия', () => {
  it('подписи по-русски и с верным склонением', () => {
    expect(taskLabel({ kind: 'levels', n: 1 })).toBe('Пройди 1 уровень');
    expect(taskLabel({ kind: 'levels', n: 3 })).toBe('Пройди 3 уровня');
    expect(taskLabel({ kind: 'levels', n: 10 })).toBe('Пройди 10 уровней');
    expect(taskLabel({ kind: 'streak', n: 14 })).toBe('Серия 14 дней подряд');
    expect(taskLabel({ kind: 'words', n: 21 })).toBe('Выучи 21 слово');
  });

  it('у каждого задания в дереве своя подпись', () => {
    for (const node of TREE) if (node.task) expect(taskLabel(node.task).length, node.id).toBeGreaterThan(5);
  });

  it('серия считается по лучшей: однажды выполненное задание не отбирается', () => {
    const s = createInitialState(T0);
    s.streak.best = 20;
    s.streak.current = 1;
    expect(taskProgress(s, { kind: 'streak', n: 14 })).toBe(20);
  });

  it('звёзды и слова считаются по прогрессу, а не по счётчикам', () => {
    const s = createInitialState(T0);
    s.levels['a'] = { stars: 3, best: 1, attempts: 1, completedAt: T0 };
    s.levels['b'] = { stars: 2, best: 1, attempts: 1, completedAt: T0 };
    expect(taskProgress(s, { kind: 'stars', n: 1 })).toBe(5);
  });
});
