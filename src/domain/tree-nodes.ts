/**
 * Деревья прокачки: Дарахти дониш («древо знаний»), Дарахти ҳайвонот
 * («древо зверей») и Дарахти бозор («древо базара»). Узлы, ветки и задания.
 *
 * Только данные и чтение состояния: открытие узла живёт в tree.ts. Разделено,
 * чтобы bonuses.ts мог читать бонусы открытых узлов, а tree.ts после открытия —
 * звать bonuses.applyPerks, и импорты не замкнулись в кольцо.
 *
 * Устройство Дарахти дониш. Из корня — Ниҳол, «росток» — растут четыре ветки, по семь узлов:
 * Зар (золото), Сипар (щит), Дониш (знание), Бахт (удача). В середине ветки
 * сплетаются: некоторым узлам нужен ещё и узел соседней ветки. Так дерево —
 * это не четыре независимые верёвки, а сеть, в которой приходится выбирать
 * путь. Все четыре вершины сходятся в одну — сам Дарахти дониш.
 *
 * Задания открытия Дарахти дониш — только настоящие учебные вехи: пройденные
 * уровни, уровни без ошибок, выученные слова, серия, повторения. Ни одно не
 * выполняется покупкой: дерево растёт вместе с языком, а не вместе с кошельком.
 * У двух других деревьев задания — вехи своей части игры: коллекция питомцев,
 * угощения, покупки дня.
 *
 * id узлов уникальны во всех деревьях сразу: открытые узлы лежат в одной
 * карте state.tree, и дерево узла узнаётся по самому узлу.
 */

import type { SaveState } from '../data/state';
import { allPets, isOwned, petRank, petTier } from './catalog';
import type { Perks } from './perks';

export type BranchId =
  | 'zar' | 'sipar' | 'donish' | 'bakht'
  | 'mehr' | 'lona' | 'zevar'
  | 'savdo' | 'dastarkhon' | 'khazina';

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

export const HAYVONOT_BRANCHES: readonly Branch[] = [
  { id: 'mehr', title: 'Меҳр', ru: 'любовь', about: 'сила питомца и дешёвые звёзды', tone: 'pink', icon: 'heart', col: 0 },
  { id: 'lona', title: 'Лона', ru: 'гнездо', about: 'удача в лоне и двойные копии', tone: 'orange', icon: 'nest', col: 1 },
  { id: 'zevar', title: 'Зевар', ru: 'украшения', about: 'снаряжение и осколки', tone: 'purple', icon: 'necklace', col: 2 },
];

export const BOZOR_BRANCHES: readonly Branch[] = [
  { id: 'savdo', title: 'Савдо', ru: 'торговля', about: 'товар дня: скидка и прилавки', tone: 'gold', icon: 'tag', col: 0 },
  { id: 'dastarkhon', title: 'Дастархон', ru: 'угощение', about: 'угощения сильнее и дольше', tone: 'green', icon: 'osh', col: 1 },
  { id: 'khazina', title: 'Хазина', ru: 'казна', about: 'сундуки и монеты', tone: 'ruby', icon: 'chest', col: 2 },
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
  | 'gear'
  | 'pets'
  | 'petRank'
  | 'petTier'
  | 'gearLevel'
  | 'meals'
  | 'deals';

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
    case 'pets':
      return allPets().filter((p) => isOwned(state, p.id)).length;
    case 'petRank':
      // лучший из своих: звёзды одного питомца не отнимаются, когда выбран другой
      return Math.max(0, ...allPets().filter((p) => isOwned(state, p.id)).map((p) => petRank(state, p.id)));
    case 'petTier':
      return Math.max(0, ...allPets().filter((p) => isOwned(state, p.id)).map((p) => petTier(state, p.id)));
    case 'gearLevel':
      return Math.max(0, ...Object.values(state.inventory.gear));
    case 'meals':
      return state.stats.meals;
    case 'deals':
      return state.stats.deals;
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
    case 'pets':
      // «собери двух питомцев»: одушевлённое — в винительном, как родительный
      return 'Собери ' + n + ' ' + words(n, 'питомца', 'питомцев', 'питомцев');
    case 'petRank':
      return 'Подними питомца до ' + n + ' ' + words(n, 'звезды', 'звёзд', 'звёзд');
    case 'petTier':
      return 'Прокачай питомца до ' + n + '-й ступени';
    case 'gearLevel':
      return 'Улучши вещь до ' + n + '-го уровня';
    case 'meals':
      return 'Угости питомца ' + n + ' ' + words(n, 'раз', 'раза', 'раз');
    case 'deals':
      return 'Купи ' + n + ' ' + words(n, 'товар', 'товара', 'товаров') + ' дня';
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

/* ————————————————————————— Дарахти ҳайвонот ————————————————————————— */

/*
 * «Древо зверей»: всё о питомцах. Три ветки — Меҳр (забота: сила питомца
 * и дешёвые звёзды), Лона (гнездо: удача и двойные копии), Зевар (украшения:
 * снаряжение и осколки). Посередине ветки держатся за Лону: и родня, и узор
 * для украшений находятся в гнезде. Задания — вехи коллекции, а не покупки
 * ради покупок: питомцы, звёзды, ступени, улучшенные вещи.
 */
export const HAYVONOT: readonly TreeNode[] = [
  {
    id: 'h_root', branch: null, row: 0, col: 1, title: 'Тухм',
    flavor: '«Яйцо» — и «семя»: по-таджикски это одно слово. С него всё и вылупляется.',
    icon: 'egg', coins: 80, gems: 0, parents: [],
    task: { kind: 'pets', n: 2 }, perks: { petPower: 0.05 },
  },

  /* ——— Меҳр: забота ——— */
  {
    id: 'h_m1', branch: 'mehr', row: 1, col: 0, title: 'Ласка',
    flavor: 'Питомец чувствует, что его любят, — и старается.',
    icon: 'heart', coins: 120, gems: 0, parents: ['h_root'], perks: { petPower: 0.05 },
  },
  {
    id: 'h_m2', branch: 'mehr', row: 2, col: 0, title: 'Забота',
    flavor: 'Копии соединяются в звезду дешевле.',
    icon: 'star', coins: 320, gems: 0, parents: ['h_m1'],
    task: { kind: 'petRank', n: 2 }, perks: { mergeDiscount: 0.1 },
  },
  {
    id: 'h_m3', branch: 'mehr', row: 3, col: 0, title: 'Верность',
    flavor: 'Старый друг помогает сильнее.',
    icon: 'paw', coins: 650, gems: 4, parents: ['h_m2'],
    task: { kind: 'petTier', n: 3 }, perks: { petPower: 0.08 },
  },
  {
    id: 'h_m4', branch: 'mehr', row: 4, col: 0, title: 'Родство',
    flavor: 'Звёзды ещё дешевле. Родню ищут в гнезде — сначала «Высиживание».',
    icon: 'star', coins: 1100, gems: 0, parents: ['h_m3', 'h_l3'],
    task: { kind: 'petRank', n: 3 }, perks: { mergeDiscount: 0.15 },
  },
  {
    id: 'h_m5', branch: 'mehr', row: 5, col: 0, title: 'Меҳр',
    flavor: '«Любовь, привязанность». Вершина ветки.',
    icon: 'crown', coins: 2000, gems: 15, parents: ['h_m4'],
    task: { kind: 'pets', n: 7 }, perks: { petPower: 0.15, mergeDiscount: 0.1 },
  },

  /* ——— Лона: гнездо ——— */
  {
    id: 'h_l1', branch: 'lona', row: 1, col: 1, title: 'Тёплое гнездо',
    flavor: 'В лоне чаще попадаются редкие.',
    icon: 'nest', coins: 130, gems: 0, parents: ['h_root'], perks: { petLuck: 0.1 },
  },
  {
    id: 'h_l2', branch: 'lona', row: 2, col: 1, title: 'Двойня',
    flavor: 'Иногда знакомый питомец приходит сразу двумя копиями.',
    icon: 'egg', coins: 380, gems: 0, parents: ['h_l1'],
    task: { kind: 'cases', n: 3 }, perks: { extraCopy: 0.1 },
  },
  {
    id: 'h_l3', branch: 'lona', row: 3, col: 1, title: 'Высиживание',
    flavor: 'Ещё больше удачи в лоне.',
    icon: 'nest', coins: 700, gems: 4, parents: ['h_l2'],
    task: { kind: 'pets', n: 5 }, perks: { petLuck: 0.15 },
  },
  {
    id: 'h_l4', branch: 'lona', row: 4, col: 1, title: 'Выводок',
    flavor: 'Двойня — чаще.',
    icon: 'egg', coins: 1200, gems: 0, parents: ['h_l3'],
    task: { kind: 'cases', n: 15 }, perks: { extraCopy: 0.15 },
  },
  {
    id: 'h_l5', branch: 'lona', row: 5, col: 1, title: 'Лонаи тилло',
    flavor: '«Золотое гнездо». Вершина ветки.',
    icon: 'crown', coins: 2200, gems: 15, parents: ['h_l4'],
    task: { kind: 'pets', n: 9 }, perks: { petLuck: 0.3, extraCopy: 0.1 },
  },

  /* ——— Зевар: украшения ——— */
  {
    id: 'h_z1', branch: 'zevar', row: 1, col: 2, title: 'Блеск',
    flavor: 'Снаряжение сидит лучше и помогает сильнее.',
    icon: 'necklace', coins: 130, gems: 0, parents: ['h_root'], perks: { gearPower: 0.05 },
  },
  {
    id: 'h_z2', branch: 'zevar', row: 2, col: 2, title: 'Ювелир',
    flavor: 'Повторная вещь даёт больше осколков.',
    icon: 'shards', coins: 380, gems: 0, parents: ['h_z1'],
    task: { kind: 'gear', n: 4 }, perks: { shardBonus: 0.2 },
  },
  {
    id: 'h_z3', branch: 'zevar', row: 3, col: 2, title: 'Огранка',
    flavor: 'Снаряжение ещё сильнее.',
    icon: 'gem', coins: 700, gems: 4, parents: ['h_z2'],
    task: { kind: 'gearLevel', n: 3 }, perks: { gearPower: 0.08 },
  },
  {
    id: 'h_z4', branch: 'zevar', row: 4, col: 2, title: 'Чеканщик',
    flavor: 'Осколков ещё больше. Узор чеканщик подсмотрел в гнезде — нужно «Высиживание».',
    icon: 'hat', coins: 1200, gems: 0, parents: ['h_z3', 'h_l3'],
    task: { kind: 'gearLevel', n: 5 }, perks: { shardBonus: 0.3 },
  },
  {
    id: 'h_z5', branch: 'zevar', row: 5, col: 2, title: 'Зевар',
    flavor: '«Украшение». Вершина ветки.',
    icon: 'crown', coins: 2200, gems: 15, parents: ['h_z4'],
    task: { kind: 'gear', n: 16 }, perks: { gearPower: 0.15, shardBonus: 0.2 },
  },

  /* ——— вершина ——— */
  {
    id: 'h_crown', branch: null, row: 6, col: 1, title: 'Шоҳи ҳайвонот',
    flavor: '«Царь зверей». Все три ветки сошлись.',
    icon: 'crown', coins: 3800, gems: 30, parents: ['h_m5', 'h_l5', 'h_z5'],
    task: { kind: 'pets', n: 10 }, perks: { petPower: 0.1, gearPower: 0.1, petLuck: 0.2, extraCopy: 0.1 },
  },
];

/* ————————————————————————— Дарахти бозор ————————————————————————— */

/*
 * «Древо базара»: лавка, угощения и казна. Ветки — Савдо (торговля: товар
 * дня дешевле и больше), Дастархон (угощения сильнее и дольше), Хазина
 * (казна: сундуки и монеты). Посередине ветки держатся за Дастархон: опт
 * и казна растут из щедрого стола.
 */
export const BOZOR: readonly TreeNode[] = [
  {
    id: 'q_root', branch: null, row: 0, col: 1, title: 'Дӯкон',
    flavor: '«Лавка». С неё начинается базар.',
    icon: 'shop', coins: 80, gems: 0, parents: [],
    task: { kind: 'levels', n: 3 }, perks: { dealDiscount: 0.05 },
  },

  /* ——— Савдо: торговля ——— */
  {
    id: 'q_s1', branch: 'savdo', row: 1, col: 0, title: 'Знакомый торговец',
    flavor: 'Товар дня дешевле.',
    icon: 'tag', coins: 120, gems: 0, parents: ['q_root'], perks: { dealDiscount: 0.05 },
  },
  {
    id: 'q_s2', branch: 'savdo', row: 2, col: 0, title: 'Второй прилавок',
    flavor: 'Ещё один товар дня.',
    icon: 'shop', coins: 350, gems: 0, parents: ['q_s1'],
    task: { kind: 'deals', n: 2 }, perks: { dealSlots: 1 },
  },
  {
    id: 'q_s3', branch: 'savdo', row: 3, col: 0, title: 'Постоянный покупатель',
    flavor: 'Вся лавка чуть дешевле.',
    icon: 'bag', coins: 700, gems: 4, parents: ['q_s2'],
    task: { kind: 'deals', n: 5 }, perks: { shopDiscount: 0.05 },
  },
  {
    id: 'q_s4', branch: 'savdo', row: 4, col: 0, title: 'Оптовик',
    flavor: 'Товар дня ещё дешевле. Опт начинается с большого стола — нужны «Пряности».',
    icon: 'tag', coins: 1200, gems: 0, parents: ['q_s3', 'q_d3'],
    task: { kind: 'deals', n: 10 }, perks: { dealDiscount: 0.1 },
  },
  {
    id: 'q_s5', branch: 'savdo', row: 5, col: 0, title: 'Савдогар',
    flavor: '«Купец». Вершина ветки.',
    icon: 'crown', coins: 2200, gems: 15, parents: ['q_s4'],
    task: { kind: 'deals', n: 20 }, perks: { dealSlots: 1, shopDiscount: 0.05 },
  },

  /* ——— Дастархон: угощение ——— */
  {
    id: 'q_d1', branch: 'dastarkhon', row: 1, col: 1, title: 'Щедрая рука',
    flavor: 'Угощения помогают сильнее.',
    icon: 'non', coins: 130, gems: 0, parents: ['q_root'], perks: { foodPower: 0.15 },
  },
  {
    id: 'q_d2', branch: 'dastarkhon', row: 2, col: 1, title: 'Долгий обед',
    flavor: 'Угощения хватает на урок дольше.',
    icon: 'choy', coins: 380, gems: 0, parents: ['q_d1'],
    task: { kind: 'meals', n: 3 }, perks: { foodLength: 1 },
  },
  {
    id: 'q_d3', branch: 'dastarkhon', row: 3, col: 1, title: 'Пряности',
    flavor: 'Угощения ещё сильнее.',
    icon: 'halvo', coins: 700, gems: 4, parents: ['q_d2'],
    task: { kind: 'meals', n: 8 }, perks: { foodPower: 0.2 },
  },
  {
    id: 'q_d4', branch: 'dastarkhon', row: 4, col: 1, title: 'Хлебосольство',
    flavor: 'Угощения хватает ещё на урок дольше.',
    icon: 'shurbo', coins: 1200, gems: 0, parents: ['q_d3'],
    task: { kind: 'meals', n: 14 }, perks: { foodLength: 1 },
  },
  {
    id: 'q_d5', branch: 'dastarkhon', row: 5, col: 1, title: 'Дастархони пур',
    flavor: '«Полный дастархон». Вершина ветки.',
    icon: 'crown', coins: 2200, gems: 15, parents: ['q_d4'],
    task: { kind: 'meals', n: 25 }, perks: { foodPower: 0.3, foodLength: 1 },
  },

  /* ——— Хазина: казна ——— */
  {
    id: 'q_h1', branch: 'khazina', row: 1, col: 2, title: 'Кошелёк',
    flavor: 'Сундуки с бустерами отдают больше монет.',
    icon: 'bag', coins: 130, gems: 0, parents: ['q_root'], perks: { loot: 0.15 },
  },
  {
    id: 'q_h2', branch: 'khazina', row: 2, col: 2, title: 'Сдача',
    flavor: 'Монета сверху за каждый верный ответ.',
    icon: 'coin', coins: 380, gems: 0, parents: ['q_h1'],
    task: { kind: 'levels', n: 15 }, perks: { flatCoins: 1 },
  },
  {
    id: 'q_h3', branch: 'khazina', row: 3, col: 2, title: 'Ключник',
    flavor: 'Сундуки ещё щедрее.',
    icon: 'key', coins: 700, gems: 4, parents: ['q_h2'],
    task: { kind: 'cases', n: 10 }, perks: { loot: 0.2 },
  },
  {
    id: 'q_h4', branch: 'khazina', row: 4, col: 2, title: 'Казна',
    flavor: 'Награда за уровень выше. Казну пополняет щедрый стол — нужны «Пряности».',
    icon: 'chest', coins: 1200, gems: 0, parents: ['q_h3', 'q_d3'],
    task: { kind: 'stars', n: 60 }, perks: { levelCoins: 0.12 },
  },
  {
    id: 'q_h5', branch: 'khazina', row: 5, col: 2, title: 'Хазина',
    flavor: '«Сокровищница». Вершина ветки.',
    icon: 'crown', coins: 2200, gems: 15, parents: ['q_h4'],
    task: { kind: 'stars', n: 120 }, perks: { coins: 0.1, levelCoins: 0.1 },
  },

  /* ——— вершина ——— */
  {
    id: 'q_crown', branch: null, row: 6, col: 1, title: 'Корвонсарой',
    flavor: '«Караван-сарай»: здесь сходятся все дороги базара.',
    icon: 'crown', coins: 3800, gems: 30, parents: ['q_s5', 'q_d5', 'q_h5'],
    task: { kind: 'levels', n: 50 }, perks: { dealSlots: 1, dealDiscount: 0.1, foodPower: 0.2, coins: 0.05 },
  },
];

/* ————————————————————————— все деревья ————————————————————————— */

export type TreeId = 'donish' | 'hayvonot' | 'bozor';

export interface TreeDef {
  id: TreeId;
  /** Название по-таджикски — и заголовок экрана. */
  title: string;
  ru: string;
  /** Коротко — для переключателя деревьев. */
  short: string;
  intro: string;
  icon: string;
  branches: readonly Branch[];
  nodes: readonly TreeNode[];
}

export const TREES: readonly TreeDef[] = [
  {
    id: 'donish', title: 'Дарахти дониш', ru: 'древо знаний', short: 'Дониш', icon: 'feather',
    intro:
      '«Древо знаний». Узлы открываются за монеты и лаъл, а у многих есть ещё и задание — ' +
      'настоящая веха в учёбе. Купить её нельзя, только пройти.',
    branches: BRANCHES,
    nodes: TREE,
  },
  {
    id: 'hayvonot', title: 'Дарахти ҳайвонот', ru: 'древо зверей', short: 'Ҳайвонот', icon: 'paw',
    intro:
      '«Древо зверей». Сила питомцев и их звёзды, удача в лоне, снаряжение. ' +
      'Задания — вехи коллекции: питомцы, звёзды, ступени, улучшенные вещи.',
    branches: HAYVONOT_BRANCHES,
    nodes: HAYVONOT,
  },
  {
    id: 'bozor', title: 'Дарахти бозор', ru: 'древо базара', short: 'Бозор', icon: 'shop',
    intro:
      '«Древо базара». Товар дня, угощения и казна. ' +
      'Задания — покупки дня, угощения, звёзды и пройденные уровни.',
    branches: BOZOR_BRANCHES,
    nodes: BOZOR,
  },
];

/** Все узлы всех деревьев: бонусы складываются из каждого. */
export const ALL_NODES: readonly TreeNode[] = TREES.flatMap((t) => t.nodes);

const BY_ID = new Map(ALL_NODES.map((n) => [n.id, n]));
const TREE_OF = new Map(TREES.flatMap((t) => t.nodes.map((n) => [n.id, t] as const)));
const BRANCH_BY_ID = new Map(TREES.flatMap((t) => t.branches.map((b) => [b.id, b] as const)));

export function getNode(id: string): TreeNode | undefined {
  return BY_ID.get(id);
}

export function getTree(id: TreeId): TreeDef {
  return TREES.find((t) => t.id === id) ?? (TREES[0] as TreeDef);
}

/** Дерево, которому принадлежит узел. */
export function treeOf(nodeId: string): TreeDef | undefined {
  return TREE_OF.get(nodeId);
}

export function getBranch(id: BranchId | null): Branch | undefined {
  return id ? BRANCH_BY_ID.get(id) : undefined;
}

export function isNodeOwned(state: SaveState, id: string): boolean {
  return state.tree[id] !== undefined;
}

export function parentsOwned(state: SaveState, node: TreeNode): boolean {
  return node.parents.every((p) => isNodeOwned(state, p));
}

/** Бонусы всех открытых узлов всех деревьев — источник для bonuses.ts. */
export function treePerks(state: SaveState): Partial<Perks>[] {
  const out: Partial<Perks>[] = [];
  for (const node of ALL_NODES) if (isNodeOwned(state, node.id)) out.push(node.perks);
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

/** Сколько узлов дерева открыто и сколько всего — для шапки экрана. */
export function treeProgress(state: SaveState, id: TreeId = 'donish'): { owned: number; total: number } {
  const nodes = getTree(id).nodes;
  return { owned: nodes.filter((n) => isNodeOwned(state, n.id)).length, total: nodes.length };
}
