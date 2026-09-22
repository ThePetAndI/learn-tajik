/**
 * Сложение бонусов. Источников станет три — питомец, дерево, снаряжение, —
 * и правила сложения должны быть одними на всех, иначе итоговые числа
 * будут зависеть от того, откуда пришёл бонус.
 */

import { describe, expect, it } from 'vitest';
import { NO_PERKS, PERK_CAPS, combinePerks, perkLabel, perkLabels } from '../src/domain/perks';

describe('сложение бонусов', () => {
  it('без источников — ноль по всем осям', () => {
    expect(combinePerks([])).toEqual(NO_PERKS);
  });

  it('доли складываются, а не перемножаются: +10% и +20% — это +30%', () => {
    expect(combinePerks([{ coins: 0.1 }, { coins: 0.2 }]).coins).toBeCloseTo(0.3);
  });

  it('счётчики складываются', () => {
    expect(combinePerks([{ lives: 1 }, { lives: 2 }]).lives).toBe(3);
  });

  it('скидки идут одна поверх другой: 50% и 50% — это 75%, а не бесплатно', () => {
    expect(combinePerks([{ hintDiscount: 0.5 }, { hintDiscount: 0.5 }]).hintDiscount).toBeCloseTo(0.75);
  });

  it('скидки не доходят до ста процентов, сколько их ни складывай', () => {
    const many = Array.from({ length: 20 }, () => ({ hintDiscount: 0.9 }));
    expect(combinePerks(many).hintDiscount).toBeLessThanOrEqual(PERK_CAPS.hintDiscount);
  });

  it('каждая ось упирается в свой потолок', () => {
    const huge = Object.fromEntries(Object.keys(NO_PERKS).map((k) => [k, 1000]));
    expect(combinePerks([huge])).toEqual({ ...PERK_CAPS });
  });

  it('мусор в источнике не портит итог', () => {
    const bad = { coins: Number.NaN, lives: -3, gems: Infinity } as unknown as Record<string, number>;
    expect(combinePerks([bad])).toEqual(NO_PERKS);
  });
});

describe('подписи бонусов', () => {
  it('говорят по-русски и с верным числом', () => {
    expect(perkLabel('coins', 0.1)).toBe('+10% монет');
    expect(perkLabel('lives', 1)).toBe('+1 жизнь');
    expect(perkLabel('lives', 2)).toBe('+2 жизни');
    expect(perkLabel('lives', 5)).toBe('+5 жизней');
    expect(perkLabel('hintDiscount', 0.4)).toBe('подсказки −40%');
  });

  it('у каждой оси своя подпись', () => {
    for (const key of Object.keys(NO_PERKS) as (keyof typeof NO_PERKS)[]) {
      expect(perkLabel(key, 1).length, key).toBeGreaterThan(0);
    }
  });

  it('пустые оси в список не попадают', () => {
    expect(perkLabels({ coins: 0.1, lives: 0 })).toEqual(['+10% монет']);
  });
});
