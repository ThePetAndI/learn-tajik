/**
 * Деревья прокачки: форма каждого дерева, правила открытия и то, что узлы
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
import { allPets } from '../src/domain/catalog';
import { BASE_DEALS, dealsFor } from '../src/domain/deals';
import { getFood } from '../src/domain/foods';
import { feed, mealLength } from '../src/domain/meals';
import { rankUpCost } from '../src/domain/pets';
import { buy, equip } from '../src/domain/shop';
import { canUnlock, unlockNode } from '../src/domain/tree';
import {
  ALL_NODES,
  TREE,
  TREES,
  getNode,
  nodeStatus,
  taskLabel,
  taskProgress,
  treeOf,
  treeProgress,
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
  // вехи двух других деревьев: вся коллекция, звёзды, ступени, угощения, покупки
  s.inventory.gear['g0'] = 9;
  s.inventory.owned = allPets().map((p) => p.id);
  s.inventory.petRanks['pet_fox'] = 5;
  s.inventory.petLevels['pet_fox'] = 5;
  s.stats.meals = 500;
  s.stats.deals = 500;
  return s;
}

/** Открывает узел вместе со всеми предками, по порядку. */
function unlockWithAncestors(s: SaveState, id: string): void {
  const node = getNode(id)!;
  for (const p of node.parents) if (s.tree[p] === undefined) unlockWithAncestors(s, p);
  expect(unlockNode(s, id, T0), id).toBe('ok');
}

/* ————————————————————————— форма ————————————————————————— */

describe('форма деревьев', () => {
  it('id узлов уникальны во всех деревьях сразу: открытые лежат в одной карте', () => {
    const ids = new Set(ALL_NODES.map((n) => n.id));
    expect(ids.size).toBe(ALL_NODES.length);
  });

  it('родители существуют и растут в том же дереве', () => {
    for (const tree of TREES) {
      const own = new Set(tree.nodes.map((n) => n.id));
      for (const node of tree.nodes) {
        for (const p of node.parents) expect(own.has(p), tree.id + ': ' + node.id + ' <- ' + p).toBe(true);
      }
    }
  });

  it('родитель всегда выше ребёнка — циклов нет', () => {
    for (const node of ALL_NODES) {
      for (const p of node.parents) expect(getNode(p)!.row, node.id).toBeLessThan(node.row);
    }
  });

  it('у каждого дерева один корень, и из него достижим каждый узел', () => {
    for (const tree of TREES) {
      const roots = tree.nodes.filter((n) => n.parents.length === 0);
      expect(roots.length, tree.id).toBe(1);
      const reach = new Set([roots[0]!.id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const n of tree.nodes) {
          if (!reach.has(n.id) && n.parents.every((p) => reach.has(p))) {
            reach.add(n.id);
            grew = true;
          }
        }
      }
      expect(reach.size, tree.id).toBe(tree.nodes.length);
    }
  });

  it('вершина дерева требует вершины всех его веток', () => {
    for (const tree of TREES) {
      const crown = tree.nodes.filter((n) => n.branch === null).sort((a, c) => c.row - a.row)[0]!;
      const tips = tree.branches.map(
        (b) => tree.nodes.filter((n) => n.branch === b.id).sort((a, c) => c.row - a.row)[0]!.id,
      );
      expect([...crown.parents].sort(), tree.id).toEqual([...tips].sort());
    }
  });

  it('узел стоит в колонке своей ветки, корень и вершина — посередине', () => {
    for (const tree of TREES) {
      const middle = (tree.branches.length - 1) / 2;
      for (const node of tree.nodes) {
        const branch = tree.branches.find((b) => b.id === node.branch);
        expect(node.col, tree.id + ': ' + node.id).toBe(branch ? branch.col : middle);
      }
    }
  });

  /*
   * Перекрёстные связи рисуются диагональю между колонками. Через колонку
   * она перечеркнула бы соседнюю ветку, и дерево стало бы нечитаемым.
   */
  it('перекрёстные связи — только между соседними ветками', () => {
    for (const node of ALL_NODES) {
      if (node.branch === null) continue;
      for (const p of node.parents) {
        const parent = getNode(p)!;
        if (parent.branch === null) continue;
        expect(Math.abs(parent.col - node.col), node.id + ' <- ' + p).toBeLessThanOrEqual(1);
      }
    }
  });

  it('в ветке не меньше пяти узлов, и каждый дальше по ветке дороже', () => {
    for (const tree of TREES) {
      for (const b of tree.branches) {
        const chain = tree.nodes.filter((n) => n.branch === b.id).sort((a, c) => a.row - c.row);
        expect(chain.length, b.id).toBeGreaterThanOrEqual(5);
        for (let i = 1; i < chain.length; i++) {
          expect(chain[i]!.coins, chain[i]!.id).toBeGreaterThan(chain[i - 1]!.coins);
        }
      }
    }
  });

  it('в Дарахти дониш четыре ветки по семь узлов', () => {
    const donish = TREES.find((t) => t.id === 'donish')!;
    expect(donish.nodes).toBe(TREE);
    expect(donish.branches.length).toBe(4);
    for (const b of donish.branches) expect(TREE.filter((n) => n.branch === b.id).length, b.id).toBe(7);
  });

  it('каждый узел что-то даёт', () => {
    for (const node of ALL_NODES) expect(Object.keys(node.perks).length, node.id).toBeGreaterThan(0);
  });

  it('первые узлы по карману новичку — дешевле двух пройденных уровней', () => {
    // первое прохождение уровня на три звезды приносит около 70 монет
    for (const node of ALL_NODES.filter((n) => n.row <= 1)) expect(node.coins, node.id).toBeLessThanOrEqual(140);
  });

  it('узел знает своё дерево', () => {
    expect(treeOf('z1')?.id).toBe('donish');
    expect(treeOf('h_l2')?.id).toBe('hayvonot');
    expect(treeOf('q_crown')?.id).toBe('bozor');
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

  it('открываются все деревья целиком', () => {
    const s = rich();
    for (const node of ALL_NODES) if (s.tree[node.id] === undefined) unlockWithAncestors(s, node.id);
    expect(Object.keys(s.tree).length).toBe(ALL_NODES.length);
    for (const tree of TREES) expect(treeProgress(s, tree.id), tree.id).toEqual({ owned: tree.nodes.length, total: tree.nodes.length });
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

/* ————————————————————————— Ҳайвонот и Бозор ————————————————————————— */

describe('Дарахти ҳайвонот и Дарахти бозор работают', () => {
  it('бонусы всех деревьев складываются вместе', () => {
    const s = rich();
    unlockWithAncestors(s, 'h_root');
    unlockWithAncestors(s, 'q_root');
    expect(perksOf(s).petPower).toBeCloseTo(0.05);
    expect(perksOf(s).dealDiscount).toBeCloseTo(0.05);
  });

  it('«Ласка» усиливает бонус питомца', () => {
    const s = rich();
    s.inventory.owned = s.inventory.owned.filter((id) => id !== 'pet_cat');
    buy(s, 'pet_cat', T0);
    unlockWithAncestors(s, 'h_root');
    const was = coinMultiplier(s);
    unlockNode(s, 'h_m1', T0);
    expect(coinMultiplier(s)).toBeGreaterThan(was);
  });

  it('«Забота» удешевляет звёзды', () => {
    const s = rich();
    equip(s, 'pet_cat', T0);
    const was = rankUpCost(s, 'pet_cat')!.coins;
    unlockWithAncestors(s, 'h_m2');
    expect(rankUpCost(s, 'pet_cat')!.coins).toBeLessThan(was);
  });

  it('«Тёплое гнездо» и «Блеск» — удача лоны и сила снаряжения', () => {
    const s = rich();
    unlockWithAncestors(s, 'h_l1');
    unlockWithAncestors(s, 'h_z1');
    expect(perksOf(s).petLuck).toBeGreaterThan(0);
    expect(perksOf(s).gearPower).toBeGreaterThan(0);
  });

  it('«Второй прилавок» добавляет товар дня, торговец снижает цену', () => {
    const s = rich();
    const before = dealsFor(s, T0);
    unlockWithAncestors(s, 'q_s2');
    const after = dealsFor(s, T0);
    expect(after.length).toBe(BASE_DEALS + 1);
    // прежние товары на месте — прилавок дописывается в конец
    expect(after.slice(0, before.length).map((d) => d.id)).toEqual(before.map((d) => d.id));
    expect(after[0]!.price).toBeLessThan(before[0]!.price);
  });

  it('«Долгий обед» удлиняет угощение, «Щедрая рука» его усиливает', () => {
    const s = rich();
    const tea = getFood('food_choy')!;
    const was = mealLength(s, tea);
    unlockWithAncestors(s, 'q_d2');
    expect(mealLength(s, tea)).toBe(was + 1);
    feed(s, tea.id, T0);
    expect(perksOf(s).hintDiscount).toBeCloseTo(0.5 * 1.15);
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

  it('у каждого задания в деревьях своя подпись', () => {
    for (const node of ALL_NODES) if (node.task) expect(taskLabel(node.task).length, node.id).toBeGreaterThan(5);
  });

  it('подписи новых заданий', () => {
    expect(taskLabel({ kind: 'pets', n: 2 })).toBe('Собери 2 питомцев');
    expect(taskLabel({ kind: 'petRank', n: 3 })).toBe('Подними питомца до 3 звёзд');
    expect(taskLabel({ kind: 'petTier', n: 3 })).toBe('Прокачай питомца до 3-й ступени');
    expect(taskLabel({ kind: 'gearLevel', n: 5 })).toBe('Улучши вещь до 5-го уровня');
    expect(taskLabel({ kind: 'meals', n: 3 })).toBe('Угости питомца 3 раза');
    expect(taskLabel({ kind: 'deals', n: 2 })).toBe('Купи 2 товара дня');
    expect(taskLabel({ kind: 'deals', n: 5 })).toBe('Купи 5 товаров дня');
  });

  it('новые задания считаются по коллекции, а не по активному питомцу', () => {
    const s = createInitialState(T0);
    expect(taskProgress(s, { kind: 'pets', n: 1 })).toBe(1); // лис с самого начала
    expect(taskProgress(s, { kind: 'gearLevel', n: 1 })).toBe(0);
    s.inventory.owned.push('pet_cat');
    s.inventory.petRanks['pet_cat'] = 3;
    s.profile.petId = 'pet_fox';
    expect(taskProgress(s, { kind: 'petRank', n: 3 })).toBe(3);
    // звёзды чужого, не купленного питомца не считаются
    s.inventory.petRanks['pet_babr'] = 5;
    expect(taskProgress(s, { kind: 'petRank', n: 3 })).toBe(3);
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
