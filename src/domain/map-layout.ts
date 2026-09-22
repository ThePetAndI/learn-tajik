/**
 * Геометрия карты: где стоят узлы уровней, как идёт дорожка и куда падает декор.
 * Чистые вычисления без DOM — проверяются тестами и не зависят от отрисовки.
 */

import { mulberry32 } from '../core/rng';

/** Расстояние между узлами по вертикали. */
export const NODE_SPACING = 116;
export const NODE_SIZE = 70;
export const BOSS_SIZE = 84;
/** Отступы внутри раздела: сверху под баннером и снизу до следующего.
 *  TOP_PAD учитывает питомца — он стоит сбоку от узла и не должен лезть на баннер. */
export const TOP_PAD = 60;
export const BOTTOM_PAD = 34;
/** Шаг синусоиды: полный цикл примерно за шесть узлов. */
const WAVE_STEP = 1.02;
const WAVE_PHASE = -0.45;

export interface Pt {
  x: number;
  y: number;
}

export interface MapNode extends Pt {
  /** Сквозной номер уровня с нуля. */
  index: number;
}

export type DecorKind = 'tree' | 'bush' | 'rock' | 'flower' | 'cloud';

export interface DecorItem extends Pt {
  kind: DecorKind;
  scale: number;
  flip: boolean;
}

export interface SectionLayout {
  height: number;
  nodes: MapNode[];
  /** Узел повторения в конце раздела, если он запрошен. */
  review: MapNode | null;
  /** Готовый атрибут d для дорожки. */
  path: string;
  decor: DecorItem[];
}

/** Горизонтальное положение узла — змейка по синусу. */
export function nodeX(globalIndex: number, width: number): number {
  const amplitude = Math.min(width * 0.27, 104);
  return width / 2 + amplitude * Math.sin(globalIndex * WAVE_STEP + WAVE_PHASE);
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Гладкая кривая через точки (Катмулл–Ром, переведённый в кубические Безье).
 * Дорожка должна выглядеть нарисованной от руки, а не ломаной.
 */
export function smoothPath(
  points: readonly Pt[],
  ghostBefore?: Pt | null,
  ghostAfter?: Pt | null,
): string {
  if (points.length === 0) return '';
  const first = points[0] as Pt;
  if (points.length === 1) return 'M' + round(first.x) + ' ' + round(first.y);

  let d = 'M' + round(first.x) + ' ' + round(first.y);
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i] as Pt;
    const p2 = points[i + 1] as Pt;
    // призрачные точки задают наклон на стыках разделов, но не рисуются
    const p0 = points[i - 1] ?? ghostBefore ?? p1;
    const p3 = points[i + 2] ?? ghostAfter ?? p2;
    const t = 1 / 6;
    const c1x = p1.x + (p2.x - p0.x) * t;
    const c1y = p1.y + (p2.y - p0.y) * t;
    const c2x = p2.x - (p3.x - p1.x) * t;
    const c2y = p2.y - (p3.y - p1.y) * t;
    d +=
      ' C' + round(c1x) + ' ' + round(c1y) +
      ' ' + round(c2x) + ' ' + round(c2y) +
      ' ' + round(p2.x) + ' ' + round(p2.y);
  }
  return d;
}

export interface LayoutOptions {
  width: number;
  /** Сквозной индекс первого узла раздела. */
  startIndex: number;
  count: number;
  /** Высота баннера раздела — узлы начинаются под ним. */
  bannerHeight: number;
  /** x последнего узла предыдущего раздела, чтобы дорожка не рвалась. */
  prevX: number | null;
  /** x первого узла следующего раздела. */
  nextX: number | null;
  /** Сеять декор детерминированно. */
  seed?: number;
  /** Добавить в конце раздела узел повторения. */
  reviewNode?: boolean;
}

export function layoutSection(opts: LayoutOptions): SectionLayout {
  const { width, startIndex, count, bannerHeight, prevX, nextX } = opts;
  const nodes: MapNode[] = [];
  for (let i = 0; i < count; i++) {
    const index = startIndex + i;
    nodes.push({
      index,
      x: round(nodeX(index, width)),
      y: bannerHeight + TOP_PAD + i * NODE_SPACING,
    });
  }

  // Узел повторения встаёт на полшага дальше последнего уровня —
  // так он читается как продолжение дорожки, а не как ещё один уровень.
  let review: MapNode | null = null;
  if (opts.reviewNode && nodes.length > 0) {
    const last = nodes[nodes.length - 1] as MapNode;
    review = {
      index: -1,
      x: round(nodeX(startIndex + count - 0.5, width)),
      y: last.y + NODE_SPACING,
    };
  }

  const lastY = review ? review.y : nodes.length > 0 ? (nodes[nodes.length - 1] as MapNode).y : bannerHeight;
  const height = lastY + BOTTOM_PAD;

  // Дорожка целиком внутри блока раздела: иначе content-visibility её обрежет.
  // На стыке разделов соседние кривые приходят в одну точку — середину
  // между последним узлом сверху и первым узлом снизу.
  const firstX = nodes.length > 0 ? (nodes[0] as MapNode).x : width / 2;
  const lastX = review ? review.x : nodes.length > 0 ? (nodes[nodes.length - 1] as MapNode).x : width / 2;

  const points: Pt[] = [];
  if (prevX !== null) points.push({ x: round((prevX + firstX) / 2), y: 0 });
  for (const n of nodes) points.push({ x: n.x, y: n.y });
  if (review) points.push({ x: review.x, y: review.y });
  if (nextX !== null) points.push({ x: round((lastX + nextX) / 2), y: height });

  /*
   * Призрачные точки задают наклон дорожки на стыке. Они обязаны стоять
   * ровно там, где у соседнего раздела стоит его крайний узел, — иначе
   * касательные с двух сторон стыка разные, кривая приходит под одним углом,
   * а уходит под другим, и на границе видно излом и ступеньку в обводке.
   *
   * Сверху: последний узел предыдущего раздела на BOTTOM_PAD выше границы.
   * Снизу: первый узел следующего раздела на bannerHeight + TOP_PAD ниже.
   */
  const ghostBefore = prevX !== null ? { x: prevX, y: -BOTTOM_PAD } : null;
  const ghostAfter =
    nextX !== null ? { x: nextX, y: height + bannerHeight + TOP_PAD } : null;

  return {
    height,
    nodes,
    review,
    path: smoothPath(points, ghostBefore, ghostAfter),
    decor: layoutDecor(review ? [...nodes, review] : nodes, width, height, opts.seed ?? startIndex + 1),
  };
}

const GROUND_DECOR: DecorKind[] = ['tree', 'tree', 'bush', 'rock', 'flower', 'flower'];
/** Самое высокое дерево поднимается над своей точкой примерно на 34px. */
const GROUND_MARGIN_TOP = 40;
const GROUND_MARGIN_BOTTOM = 22;
/** Пустая зона вокруг узла уровня и вокруг дорожки. */
const NODE_CLEAR_X = 74;
const NODE_CLEAR_Y = 60;
const ROAD_CLEAR = 64;
/** Насколько предметы декора держатся друг от друга: иначе камень ложится на цветок. */
const DECOR_CLEAR = 40;
/** Облако широкое: от края блока держим больше, чем для наземного декора. */
const CLOUD_MARGIN = 46;

/**
 * Где проходит дорожка на высоте y — линейная прикидка между соседними узлами.
 * Кривая отходит от этой линии на единицы пикселей, для расстановки декора хватает.
 */
export function roadXAt(nodes: readonly MapNode[], y: number): number {
  if (nodes.length === 0) return NaN;
  const first = nodes[0] as MapNode;
  const last = nodes[nodes.length - 1] as MapNode;
  if (y <= first.y) return first.x;
  if (y >= last.y) return last.x;
  for (let i = 1; i < nodes.length; i++) {
    const a = nodes[i - 1] as MapNode;
    const b = nodes[i] as MapNode;
    if (y <= b.y) return a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y);
  }
  return last.x;
}

function spotIsFree(
  x: number,
  y: number,
  nodes: readonly MapNode[],
  placed: readonly DecorItem[] = [],
): boolean {
  for (const node of nodes) {
    if (Math.abs(x - node.x) < NODE_CLEAR_X && Math.abs(y - node.y) < NODE_CLEAR_Y) return false;
  }
  for (const item of placed) {
    if (Math.hypot(x - item.x, y - item.y) < DECOR_CLEAR) return false;
  }
  return Math.abs(x - roadXAt(nodes, y)) >= ROAD_CLEAR;
}

/**
 * Декор ставится в свободном поле сбоку от дорожки.
 * Кандидат отбраковывается, если задевает любой узел или саму дорожку:
 * змейка виляет, и место, свободное у своего узла, бывает занято соседним.
 */
export function layoutDecor(
  nodes: readonly MapNode[],
  width: number,
  height: number,
  seed: number,
): DecorItem[] {
  const rng = mulberry32(seed >>> 0);
  const items: DecorItem[] = [];
  const margin = 24;

  for (const node of nodes) {
    const onRight = width - margin - node.x > node.x - margin;
    const count = rng() < 0.45 ? 2 : 1;

    for (let k = 0; k < count; k++) {
      // несколько попыток: если место занято, пробуем другое
      for (let attempt = 0; attempt < 6; attempt++) {
        const side = attempt < 4 ? onRight : !onRight;
        const space = side ? width - margin - node.x : node.x - margin;
        const offset = 80 + rng() * Math.max(8, space - 80);
        const x = round(side ? node.x + offset : node.x - offset);
        const y = round(node.y + (rng() * 2 - 1) * 56 + (k === 1 ? 32 : 0));

        if (x < margin || x > width - margin) continue;
        // Держим декор внутри блока раздела: содержимое обрезается по его границам,
        // а половина дерева на стыке выглядит как артефакт.
        if (y < GROUND_MARGIN_TOP || y > height - GROUND_MARGIN_BOTTOM) continue;
        if (!spotIsFree(x, y, nodes, items)) continue;

        const kind = GROUND_DECOR[Math.floor(rng() * GROUND_DECOR.length)] as DecorKind;
        items.push({
          kind,
          x,
          y,
          scale: round(kind === 'tree' ? 0.85 + rng() * 0.4 : 0.7 + rng() * 0.45),
          flip: rng() < 0.5,
        });
        break;
      }
    }
  }

  /*
   * Облака рисуются поверх остального, но не над дорожкой: белое облако
   * на песчаной дорожке читается не как облако, а как дырка в ней.
   * По краям тоже держим запас — облако широкое и свисало за границу блока.
   */
  const clouds = 1 + Math.floor(rng() * 2);
  const cloudTop = 34;
  const cloudSpan = Math.max(30, height - cloudTop - 34);
  for (let i = 0; i < clouds; i++) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const x = round(CLOUD_MARGIN + rng() * Math.max(8, width - CLOUD_MARGIN * 2));
      const y = round(cloudTop + rng() * cloudSpan);
      if (Math.abs(x - roadXAt(nodes, y)) < ROAD_CLEAR) continue;
      items.push({
        kind: 'cloud',
        x,
        y,
        scale: round(0.8 + rng() * 0.6),
        flip: rng() < 0.5,
      });
      break;
    }
  }

  return items;
}
