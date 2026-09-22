import { describe, expect, it } from 'vitest';
import {
  BOTTOM_PAD,
  NODE_SPACING,
  TOP_PAD,
  layoutDecor,
  layoutSection,
  nodeX,
  roadXAt,
  smoothPath,
} from '../src/domain/map-layout';

const WIDTH = 375;
const BANNER = 78;

function section(startIndex: number, count: number, prevX: number | null, nextX: number | null) {
  return layoutSection({
    width: WIDTH,
    startIndex,
    count,
    bannerHeight: BANNER,
    prevX,
    nextX,
    seed: startIndex + 1,
  });
}

/** Конечные точки кривых — последняя пара координат каждого сегмента C. */
function anchors(d: string): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const move = /^M(-?[\d.]+) (-?[\d.]+)/.exec(d);
  if (move) out.push({ x: Number(move[1]), y: Number(move[2]) });
  const re = /C-?[\d.]+ -?[\d.]+ -?[\d.]+ -?[\d.]+ (-?[\d.]+) (-?[\d.]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d)) !== null) out.push({ x: Number(m[1]), y: Number(m[2]) });
  return out;
}

describe('положение узлов', () => {
  it('не выходит за пределы экрана', () => {
    for (let i = 0; i < 200; i++) {
      const x = nodeX(i, WIDTH);
      expect(x).toBeGreaterThan(50);
      expect(x).toBeLessThan(WIDTH - 50);
    }
  });

  it('змейка ходит в обе стороны', () => {
    const xs = Array.from({ length: 12 }, (_, i) => nodeX(i, WIDTH));
    expect(Math.min(...xs)).toBeLessThan(WIDTH / 2 - 40);
    expect(Math.max(...xs)).toBeGreaterThan(WIDTH / 2 + 40);
  });

  it('дорожка нигде не идёт прямо подолгу', () => {
    // На вершине синусоиды пара соседей может встать почти в вертикаль —
    // это нормальный вид поворота. Важно другое: на любом отрезке
    // из четырёх узлов дорожка заметно смещается вбок.
    for (let i = 0; i + 3 < 60; i++) {
      const window = [0, 1, 2, 3].map((k) => nodeX(i + k, WIDTH));
      expect(Math.max(...window) - Math.min(...window)).toBeGreaterThan(70);
    }
  });

  it('на узком экране амплитуда сжимается', () => {
    const narrow = Array.from({ length: 12 }, (_, i) => nodeX(i, 320));
    for (const x of narrow) {
      expect(x).toBeGreaterThan(30);
      expect(x).toBeLessThan(290);
    }
  });
});

describe('раскладка раздела', () => {
  it('даёт запрошенное число узлов с возрастающим y', () => {
    const layout = section(0, 5, null, 200);
    expect(layout.nodes).toHaveLength(5);
    for (let i = 1; i < layout.nodes.length; i++) {
      const prev = layout.nodes[i - 1]!;
      const cur = layout.nodes[i]!;
      expect(cur.y - prev.y).toBe(NODE_SPACING);
    }
  });

  it('первый узел стоит под баннером', () => {
    const layout = section(0, 5, null, 200);
    expect(layout.nodes[0]!.y).toBe(BANNER + TOP_PAD);
  });

  it('высота вмещает последний узел и нижний отступ', () => {
    const layout = section(0, 5, null, 200);
    expect(layout.height).toBe(layout.nodes[4]!.y + BOTTOM_PAD);
  });

  it('нумерация узлов сквозная', () => {
    const layout = section(10, 5, 180, 200);
    expect(layout.nodes.map((n) => n.index)).toEqual([10, 11, 12, 13, 14]);
  });

  it('дорожка целиком внутри блока раздела', () => {
    const layout = section(5, 5, 190, 210);
    for (const a of anchors(layout.path)) {
      expect(a.y).toBeGreaterThanOrEqual(0);
      expect(a.y).toBeLessThanOrEqual(layout.height);
    }
  });

  it('дорожка стыкуется между разделами в одной точке', () => {
    const first = section(0, 5, null, nodeX(5, WIDTH));
    const second = section(5, 5, nodeX(4, WIDTH), nodeX(10, WIDTH));
    const firstAnchors = anchors(first.path);
    const secondAnchors = anchors(second.path);
    const exit = firstAnchors[firstAnchors.length - 1]!;
    const entry = secondAnchors[0]!;
    expect(exit.y).toBe(first.height);
    expect(entry.y).toBe(0);
    // выход снизу и вход сверху совпадают по горизонтали
    expect(Math.abs(exit.x - entry.x)).toBeLessThanOrEqual(0.2);
  });

  it('у первого раздела нет входа сверху, у последнего — выхода вниз', () => {
    const only = section(0, 5, null, null);
    const a = anchors(only.path);
    expect(a[0]!.y).toBe(BANNER + TOP_PAD);
    expect(a[a.length - 1]!.y).toBe(only.nodes[4]!.y);
  });

  it('одинаковый seed даёт одинаковую раскладку', () => {
    expect(section(0, 5, null, 200)).toEqual(section(0, 5, null, 200));
  });
});

describe('smoothPath', () => {
  it('пустой список даёт пустую строку', () => {
    expect(smoothPath([])).toBe('');
  });

  it('одна точка — только M', () => {
    expect(smoothPath([{ x: 10, y: 20 }])).toBe('M10 20');
  });

  it('число сегментов на единицу меньше числа точек', () => {
    const d = smoothPath([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 0 },
      { x: 30, y: 10 },
    ]);
    expect((d.match(/C/g) ?? []).length).toBe(3);
  });

  it('кривая проходит ровно через заданные точки', () => {
    const pts = [
      { x: 5, y: 0 },
      { x: 40, y: 60 },
      { x: 12, y: 120 },
    ];
    expect(anchors(smoothPath(pts))).toEqual(pts);
  });
});

describe('декор', () => {
  const nodes = [
    { index: 0, x: 120, y: 138 },
    { index: 1, x: 250, y: 254 },
    { index: 2, x: 140, y: 370 },
  ];

  it('не вылезает за границы раздела', () => {
    for (let seed = 1; seed < 60; seed++) {
      for (const item of layoutDecor(nodes, WIDTH, 500, seed)) {
        expect(item.y).toBeGreaterThanOrEqual(20);
        expect(item.y).toBeLessThanOrEqual(500);
        expect(item.x).toBeGreaterThanOrEqual(0);
        expect(item.x).toBeLessThanOrEqual(WIDTH);
      }
    }
  });

  it('не ставится поверх узлов', () => {
    for (let seed = 1; seed < 80; seed++) {
      for (const item of layoutDecor(nodes, WIDTH, 500, seed)) {
        if (item.kind === 'cloud') continue;
        for (const node of nodes) {
          const close = Math.abs(item.y - node.y) < 50 && Math.abs(item.x - node.x) < 70;
          expect(close).toBe(false);
        }
      }
    }
  });

  it('не ложится на дорожку', () => {
    for (let seed = 1; seed < 80; seed++) {
      for (const item of layoutDecor(nodes, WIDTH, 500, seed)) {
        if (item.kind === 'cloud') continue;
        expect(Math.abs(item.x - roadXAt(nodes, item.y))).toBeGreaterThanOrEqual(60);
      }
    }
  });

  it('предметы не ложатся друг на друга', () => {
    for (let seed = 1; seed < 80; seed++) {
      const items = layoutDecor(nodes, WIDTH, 500, seed).filter((d) => d.kind !== 'cloud');
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i]!;
          const b = items[j]!;
          expect(
            Math.hypot(a.x - b.x, a.y - b.y),
            'seed ' + seed + ': ' + a.kind + ' и ' + b.kind + ' в одной точке',
          ).toBeGreaterThanOrEqual(40);
        }
      }
    }
  });

  it('декор всё-таки появляется, а не отбраковывается целиком', () => {
    let total = 0;
    for (let seed = 1; seed < 40; seed++) {
      total += layoutDecor(nodes, WIDTH, 500, seed).filter((d) => d.kind !== 'cloud').length;
    }
    expect(total).toBeGreaterThan(40);
  });

  it('детерминирован по seed', () => {
    expect(layoutDecor(nodes, WIDTH, 500, 42)).toEqual(layoutDecor(nodes, WIDTH, 500, 42));
    expect(layoutDecor(nodes, WIDTH, 500, 42)).not.toEqual(layoutDecor(nodes, WIDTH, 500, 43));
  });
});
