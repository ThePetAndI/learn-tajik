/**
 * Дарахти дониш — «древо знаний». Узлы, ветки и задания для открытия.
 *
 * Только данные и чтение состояния: открытие узла живёт в tree.ts. Разделено,
 * чтобы bonuses.ts мог читать бонусы открытых узлов, а tree.ts после открытия —
 * звать bonuses.applyPerks, и импорты не замкнулись в кольцо.
 *
 * Устройство. Из корня — Ниҳол, «росток» — растут четыре ветки, по семь узлов:
 * Зар (золото), Сипар (щит), Дониш (знание), Бахт (удача). В середине ветки
 * сплетаются: некоторым узлам нужен ещё и узел соседней ветки. Так дерево —
 * это не четыре независимые верёвки, а сеть, в которой приходится выбирать
 * путь. Все четыре вершины сходятся в одну — сам Дарахти дониш.
 *
 * Задания открытия — только настоящие учебные вехи: пройденные уровни, уровни
 * без ошибок, выученные слова, серия, повторения. Ни одно не выполняется
 * покупкой: дерево растёт вместе с языком, а не вместе с кошельком.
 */

import type { SaveState } from '../data/state';
import type { Perks } from './perks';

export type BranchId = 'zar' | 'sipar' | 'donish' | 'bakht';

export interface Branch {
  id: BranchId;
  /** Название по-таджикски — оно же и учит слову. */
  title: string;
  /** Перевод, мелко под названием. */
  ru: string;
  /** О чём ветка, одной строкой. */
  about: string;
  tone: string;
  icon: string;
  col: number;
}

export const BRANCHES: readonly Branch[] = [
  { id: 'zar', title: 'Зар', ru: 'золото', about: 'монеты за ответы и уровни', tone: 'gold', icon: 'bag', col: 0 },
  { id: 'sipar', title: 'Сипар', ru: 'щит', about: 'жизни и право на ошибку', tone: 'ruby', icon: 'shield', col: 1 },
  { id: 'donish', title: 'Дониш', ru: 'знание', about: 'подсказки, повторение, лаъл', tone: 'blue', icon: 'feather', col: 2 },
  { id: 'bakht', title: 'Бахт', ru: 'удача', about: 'сундуки, колесо, редкие находки', tone: 'teal', icon: 'horseshoe', col: 3 },
];

/* ————————————————————————— задания ————————————————————————— */

export type TaskKind =
  | 'levels'
  | 'perfect'
  | 'stars'
  | 'words'
  | 'mastered'
  | 'streak'
  | 'combo'
  | 'reviews'
  | 'recoveries'
  | 'cases'
  | 'gear';

export interface Task {
  kind: TaskKind;
  n: number;
}

/** Сколько по заданию уже сделано. */
export function taskProgress(state: SaveState, task: Task): number {
  switch (task.kind) {
    case 'levels':
      return state.stats.levelsDone;
    case 'perfect':
      return state.stats.perfect;
    case 'stars':
      return Object.values(state.levels).reduce((sum, p) => sum + p.stars, 0);
    case 'words':
      return Object.values(state.srs).filter((w) => w.introduced).length;
    case 'mastered':
      return state.stats.mastered;
    case 'streak':
      // лучшая серия, а не текущая: задание, которое уже выполнял, не отбирается
      return state.streak.best;
    case 'combo':
      return state.stats.bestCombo;
    case 'reviews':
      return state.stats.reviews;
    case 'recoveries':
      return state.stats.recoveries;
    case 'cases':
      return state.stats.cases;
    case 'gear':
      return Object.keys(state.inventory.gear).length;
  }
}

export function taskDone(state: SaveState, task: Task | undefined): boolean {
  return !task || taskProgress(state, task) >= task.n;
}

const words = (n: number, one: string, few: string, many: string): string => {
  const tail = n % 100;
  const last = n % 10;
  if (tail >= 11 && tail <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
};

/** «Пройди 10 уровней» — подпись задания. */
export function taskLabel(task: Task): string {
  const n = task.n;
  switch (task.kind) {
    case 'levels':
      return 'Пройди ' + n + ' ' + words(n, 'уровень', 'уровня', 'уровней');
    case 'perfect':
      return 'Пройди ' + n + ' ' + words(n, 'уровень', 'уровня', 'уровней') + ' без ошибок';
    case 'stars':
      return 'Набери ' + n + ' ' + words(n, 'звезду', 'звезды', 'звёзд');
    case 'words':
      return 'Выучи ' + n + ' ' + words(n, 'слово', 'слова', 'слов');
    case 'mastered':
      return 'Освой ' + n + ' ' + words(n, 'слово', 'слова', 'слов') + ' до конца';
    case 'streak':
      return 'Серия ' + n + ' ' + words(n, 'день', 'дня', 'дней') + ' подряд';
    case 'combo':
      return n + ' ' + words(n, 'верный ответ', 'верных ответа', 'верных ответов') + ' подряд';
    case 'reviews':
      return n + ' ' + words(n, 'сессия', 'сессии', 'сессий') + ' повторения';
    case 'recoveries':
      return n + ' ' + words(n, 'сессия', 'сессии', 'сессий') + ' восстановления';
    case 'cases':
      return 'Открой ' + n + ' ' + words(n, 'сундук', 'сундука', 'сундуков');
    case 'gear':
      return 'Собери ' + n + ' ' + words(n, 'аксессуар', 'аксессуара', 'аксессуаров');
  }
}

/* ————————————————————————— узлы ————————————————————————— */

export interface TreeNode {
  id: string;
  /** null — корень и вершина: они не принадлежат ни одной ветке. */
  branch: BranchId | null;
  /** Глубина: 0 — корень, 8 — вершина. */
  row: number;
  /** Колонка 0..3; корень и вершина — посередине, 1.5. */
  col: number;
  title: string;
  /** Короткая строка настроения — не описание бонуса, его строит perkLabels. */
  flavor: string;
  icon: string;
  coins: number;
  gems: number;
  /** Что должно быть открыто раньше. */
  parents: readonly string[];
  task?: Task;
  perks: Partial<Perks>;
}

export const TREE: readonly TreeNode[] = [
  {
    id: 'root', branch: null, row: 0, col: 1.5, title: 'Ниҳол',
    flavor: '«Росток». С него начинается всё дерево.',
    icon: 'tree', coins: 50, gems: 0, parents: [],
    task: { kind: 'levels', n: 1 }, perks: { coins: 0.05 },
  },

  /* ——— Зар: золото ——— */
  {
    id: 'z1', branch: 'zar', row: 1, col: 0, title: 'Копилка',
    flavor: 'Каждый ответ звенит чуть громче.',
    icon: 'coin', coins: 100, gems: 0, parents: ['root'], perks: { coins: 0.08 },
  },
  {
    id: 'z2', branch: 'zar', row: 2, col: 0, title: 'Мелочь к мелочи',
    flavor: 'Монета сверху за каждый верный ответ.',
    icon: 'coin', coins: 260, gems: 0, parents: ['z1'], perks: { flatCoins: 1 },
  },
  {
    id: 'z3', branch: 'zar', row: 3, col: 0, title: 'Награда за труд',
    flavor: 'Пройденный уровень стоит дороже.',
    icon: 'bag', coins: 480, gems: 0, parents: ['z2'],
    task: { kind: 'levels', n: 10 }, perks: { levelCoins: 0.15 },
  },
  {
    id: 'z4', branch: 'zar', row: 4, col: 0, title: 'Торговец',
    flavor: 'Лавочник узнаёт вас в лицо.',
    icon: 'shop', coins: 700, gems: 4, parents: ['z3'], perks: { shopDiscount: 0.1 },
  },
  {
    id: 'z5', branch: 'zar', row: 5, col: 0, title: 'Золотая серия',
    flavor: 'Длинная серия платит больше. Но до неё надо дожить — нужен щит.',
    icon: 'flame', coins: 1000, gems: 0, parents: ['z4', 's4'],
    task: { kind: 'combo', n: 15 }, perks: { combo: 2 },
  },
  {
    id: 'z6', branch: 'zar', row: 6, col: 0, title: 'Казначей',
    flavor: 'Счёт ведётся аккуратно, и в вашу пользу.',
    icon: 'bag', coins: 1500, gems: 8, parents: ['z5'],
    task: { kind: 'levels', n: 30 }, perks: { coins: 0.15 },
  },
  {
    id: 'z7', branch: 'zar', row: 7, col: 0, title: 'Золотая жила',
    flavor: 'Вершина ветки. Золото само идёт в руки.',
    icon: 'crown', coins: 2500, gems: 20, parents: ['z6'],
    task: { kind: 'stars', n: 150 }, perks: { levelCoins: 0.25, flatCoins: 1 },
  },

  /* ——— Сипар: щит ——— */
  {
    id: 's1', branch: 'sipar', row: 1, col: 1, title: 'Запасное сердце',
    flavor: 'Ещё одна жизнь в запасе.',
    icon: 'heart', coins: 130, gems: 0, parents: ['root'], perks: { lives: 1 },
  },
  {
    id: 's2', branch: 'sipar', row: 2, col: 1, title: 'Глубокий вдох',
    flavor: 'Жизни возвращаются быстрее.',
    icon: 'hourglass', coins: 300, gems: 0, parents: ['s1'], perks: { regen: 0.25 },
  },
  {
    id: 's3', branch: 'sipar', row: 3, col: 1, title: 'Щит',
    flavor: 'Одна ошибка за уровень не стоит жизни. Звезду она всё равно снимет.',
    icon: 'shield', coins: 600, gems: 4, parents: ['s2'],
    task: { kind: 'perfect', n: 5 }, perks: { shield: 1 },
  },
  {
    id: 's4', branch: 'sipar', row: 4, col: 1, title: 'Второе сердце',
    flavor: 'Ещё одна жизнь.',
    icon: 'heart', coins: 800, gems: 0, parents: ['s3'], perks: { lives: 1 },
  },
  {
    id: 's5', branch: 'sipar', row: 5, col: 1, title: 'Лекарь',
    flavor: 'Кто лечил других, и сам быстрее встаёт на ноги.',
    icon: 'hourglass', coins: 1100, gems: 0, parents: ['s4'],
    task: { kind: 'recoveries', n: 2 }, perks: { regen: 0.25 },
  },
  {
    id: 's6', branch: 'sipar', row: 6, col: 1, title: 'Двойной щит',
    flavor: 'Ещё одна ошибка без потери жизни. Щиту нужно знание — без него он пуст.',
    icon: 'shield', coins: 1700, gems: 12, parents: ['s5', 'd5'],
    task: { kind: 'streak', n: 14 }, perks: { shield: 1 },
  },
  {
    id: 's7', branch: 'sipar', row: 7, col: 1, title: 'Несокрушимый',
    flavor: 'Вершина ветки. Две жизни сверху и вдвое быстрее восстановление.',
    icon: 'crown', coins: 2700, gems: 20, parents: ['s6'],
    task: { kind: 'perfect', n: 20 }, perks: { lives: 2, regen: 0.5 },
  },

  /* ——— Дониш: знание ——— */
  {
    id: 'd1', branch: 'donish', row: 1, col: 2, title: 'Зоркий глаз',
    flavor: 'Подсказки дешевле.',
    icon: 'bulb', coins: 100, gems: 0, parents: ['root'], perks: { hintDiscount: 0.15 },
  },
  {
    id: 'd2', branch: 'donish', row: 2, col: 2, title: 'Повторение',
    flavor: 'Повторение — мать учения. Больше слов за одну сессию.',
    icon: 'refresh', coins: 260, gems: 0, parents: ['d1'],
    task: { kind: 'words', n: 30 }, perks: { review: 3 },
  },
  {
    id: 'd3', branch: 'donish', row: 3, col: 2, title: 'Искра',
    flavor: 'Лаъл находится чаще.',
    icon: 'gem', coins: 520, gems: 4, parents: ['d2'],
    task: { kind: 'words', n: 60 }, perks: { gems: 0.1 },
  },
  {
    id: 'd4', branch: 'donish', row: 4, col: 2, title: 'Мудрая подсказка',
    flavor: 'Подсказки ещё дешевле.',
    icon: 'bulb', coins: 720, gems: 0, parents: ['d3'], perks: { hintDiscount: 0.15 },
  },
  {
    id: 'd5', branch: 'donish', row: 5, col: 2, title: 'Хранитель слов',
    flavor: 'Кто довёл слова до конца, тот знает цену лаълу.',
    icon: 'book', coins: 1100, gems: 8, parents: ['d4'],
    task: { kind: 'mastered', n: 5 }, perks: { gems: 0.15 },
  },
  {
    id: 'd6', branch: 'donish', row: 6, col: 2, title: 'Книжник',
    flavor: 'Ещё больше слов в повторении. Знанию нужна удача, чтобы найти книги.',
    icon: 'feather', coins: 1500, gems: 0, parents: ['d5', 'b5'],
    task: { kind: 'reviews', n: 10 }, perks: { review: 4 },
  },
  {
    id: 'd7', branch: 'donish', row: 7, col: 2, title: 'Олим',
    flavor: '«Учёный». Вершина ветки: лаъл идёт в руки сам.',
    icon: 'crown', coins: 2500, gems: 25, parents: ['d6'],
    task: { kind: 'words', n: 250 }, perks: { gems: 0.25 },
  },

  /* ——— Бахт: удача ——— */
  {
    id: 'b1', branch: 'bakht', row: 1, col: 3, title: 'Подкова',
    flavor: 'Сундуки с бустерами отдают больше монет.',
    icon: 'horseshoe', coins: 130, gems: 0, parents: ['root'], perks: { loot: 0.2 },
  },
  {
    id: 'b2', branch: 'bakht', row: 2, col: 3, title: 'Второй оборот',
    flavor: 'Колесо удачи можно крутить дважды в день.',
    icon: 'wheel', coins: 380, gems: 0, parents: ['b1'],
    task: { kind: 'streak', n: 3 }, perks: { spins: 1 },
  },
  {
    id: 'b3', branch: 'bakht', row: 3, col: 3, title: 'Чутьё',
    flavor: 'В сундуках снаряжения чаще попадается редкое.',
    icon: 'sparkle', coins: 600, gems: 4, parents: ['b2'],
    task: { kind: 'cases', n: 3 }, perks: { luck: 0.25 },
  },
  {
    id: 'b4', branch: 'bakht', row: 4, col: 3, title: 'Щедрый день',
    flavor: 'Сундук дня отдаёт две награды вместо одной.',
    icon: 'chest', coins: 850, gems: 0, parents: ['b3'], perks: { chest: 1 },
  },
  {
    id: 'b5', branch: 'bakht', row: 5, col: 3, title: 'Везунчик',
    flavor: 'Ещё больше удачи. Везёт тому, кто знает, где искать.',
    icon: 'sparkle', coins: 1250, gems: 8, parents: ['b4', 'd4'],
    task: { kind: 'gear', n: 5 }, perks: { luck: 0.25 },
  },
  {
    id: 'b6', branch: 'bakht', row: 6, col: 3, title: 'Третий оборот',
    flavor: 'Колесо — трижды в день.',
    icon: 'wheel', coins: 1800, gems: 0, parents: ['b5'],
    task: { kind: 'streak', n: 10 }, perks: { spins: 1 },
  },
  {
    id: 'b7', branch: 'bakht', row: 7, col: 3, title: 'Бахти баланд',
    flavor: '«Высокая удача». Вершина ветки.',
    icon: 'crown', coins: 2700, gems: 20, parents: ['b6'],
    task: { kind: 'gear', n: 12 }, perks: { luck: 0.5, loot: 0.3 },
  },

  /* ——— вершина ——— */
  {
    id: 'crown', branch: null, row: 8, col: 1.5, title: 'Дарахти дониш',
    flavor: '«Древо знаний». Все четыре ветки сошлись.',
    icon: 'tree', coins: 4500, gems: 40, parents: ['z7', 's7', 'd7', 'b7'],
    task: { kind: 'levels', n: 60 }, perks: { coins: 0.1, levelCoins: 0.1, gems: 0.1, lives: 1 },
  },
];

const BY_ID = new Map(TREE.map((n) => [n.id, n]));

export function getNode(id: string): TreeNode | undefined {
  return BY_ID.get(id);
}

export function isNodeOwned(state: SaveState, id: string): boolean {
  return state.tree[id] !== undefined;
}

export function parentsOwned(state: SaveState, node: TreeNode): boolean {
  return node.parents.every((p) => isNodeOwned(state, p));
}

/** Бонусы всех открытых узлов — источник для bonuses.ts. */
export function treePerks(state: SaveState): Partial<Perks>[] {
  const out: Partial<Perks>[] = [];
  for (const node of TREE) if (isNodeOwned(state, node.id)) out.push(node.perks);
  return out;
}

/**
 * Что происходит с узлом прямо сейчас — от этого зависит, как он нарисован.
 *
 *  owned  — открыт;
 *  ready  — можно открыть сейчас;
 *  poor   — всё выполнено, не хватает монет или лаъл;
 *  task   — родители открыты, задание ещё нет;
 *  locked — не открыт кто-то из родителей.
 */
export type NodeStatus = 'owned' | 'ready' | 'poor' | 'task' | 'locked';

export function nodeStatus(state: SaveState, node: TreeNode): NodeStatus {
  if (isNodeOwned(state, node.id)) return 'owned';
  if (!parentsOwned(state, node)) return 'locked';
  if (!taskDone(state, node.task)) return 'task';
  if (state.wallet.coins < node.coins || state.wallet.gems < node.gems) return 'poor';
  return 'ready';
}

/** Сколько узлов открыто и сколько всего — для шапки экрана. */
export function treeProgress(state: SaveState): { owned: number; total: number } {
  return { owned: TREE.filter((n) => isNodeOwned(state, n.id)).length, total: TREE.length };
}
