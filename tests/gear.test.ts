/**
 * Снаряжение питомцев. Кроме обычных правил здесь проверяется честность
 * сундуков: шансы сходятся в сто процентов и совпадают с тем, по чему идёт
 * бросок, гарантия срабатывает, повторная находка не пропадает.
 */

import { describe, expect, it } from 'vitest';
import { mulberry32, type Rng } from '../src/core/rng';
import { createInitialState, type SaveState } from '../src/data/state';
import { coinMultiplier, perksOf } from '../src/domain/bonuses';
import { buy } from '../src/domain/shop';
import {
  canUpgradeGear,
  equipGear,
  openGearChest,
  rollGear,
  unequipGear,
  upgradeCost,
  upgradeGear,
} from '../src/domain/gear';
import {
  GEAR,
  GEAR_CHESTS,
  PITY_EVERY,
  RARITIES,
  RARITY_ORDER,
  SLOTS,
  chestOdds,
  gearLevel,
  gearValue,
  getGear,
  getGearChest,
  wornBy,
  type GearItem,
} from '../src/domain/gear-items';

const T0 = Date.parse('2026-03-10T12:00:00Z');

function rich(): SaveState {
  const s = createInitialState(T0);
  s.wallet.coins = 1_000_000;
  s.wallet.gems = 10_000;
  s.inventory.shards = 100_000;
  return s;
}

const chest = (id: string) => getGearChest(id)!;

/* ————————————————————————— набор вещей ————————————————————————— */

describe('набор снаряжения', () => {
  it('id уникальны', () => {
    expect(new Set(GEAR.map((g) => g.id)).size).toBe(GEAR.length);
  });

  it('в каждом слоте есть вещи всех четырёх редкостей', () => {
    for (const slot of SLOTS) {
      const rarities = new Set(GEAR.filter((g) => g.slot === slot.id).map((g) => g.rarity));
      expect([...rarities].sort(), slot.id).toEqual([...RARITY_ORDER].sort());
    }
  });

  it('у каждой вещи ось, которая действительно что-то даёт', () => {
    for (const item of GEAR) expect(gearValue(item, 1), item.id).toBeGreaterThan(0);
  });
});

/* ————————————————————————— сила ————————————————————————— */

describe('сила вещей', () => {
  /** Вещь той же оси, но другой редкости — для честного сравнения. */
  function sameAxis(item: GearItem, rarity: GearItem['rarity']): GearItem {
    return { ...item, id: item.id + '_' + rarity, rarity };
  }

  it('каждое улучшение что-то добавляет', () => {
    for (const item of GEAR) {
      for (let l = 2; l <= RARITIES[item.rarity].maxLevel; l++) {
        expect(gearValue(item, l), item.id + ' ур.' + l).toBeGreaterThan(gearValue(item, l - 1));
      }
    }
  });

  it('редкая вещь сильнее обычной того же уровня', () => {
    for (const item of GEAR) {
      for (let i = 1; i < RARITY_ORDER.length; i++) {
        const lo = sameAxis(item, RARITY_ORDER[i - 1]!);
        const hi = sameAxis(item, RARITY_ORDER[i]!);
        expect(gearValue(hi, 1), item.id).toBeGreaterThan(gearValue(lo, 1));
      }
    }
  });

  it('вещь не прокачивается выше своего потолка', () => {
    const item = GEAR.find((g) => g.rarity === 'common')!;
    const max = RARITIES.common.maxLevel;
    expect(gearValue(item, max + 5)).toBe(gearValue(item, max));
  });

  it('улучшение дорожает с каждым уровнем', () => {
    for (const item of GEAR) {
      for (let l = 2; l < RARITIES[item.rarity].maxLevel; l++) {
        const a = upgradeCost(item, l - 1);
        const b = upgradeCost(item, l);
        expect(b.coins, item.id).toBeGreaterThan(a.coins);
        expect(b.shards, item.id).toBeGreaterThan(a.shards);
      }
    }
  });
});

/* ————————————————————————— шансы ————————————————————————— */

describe('шансы сундуков', () => {
  it('в каждом сундуке шансы сходятся в сто процентов', () => {
    for (const c of GEAR_CHESTS) {
      for (const luck of [0, 0.5, 1, 2]) {
        const odds = chestOdds(c, luck);
        const sum = RARITY_ORDER.reduce((a, r) => a + odds[r], 0);
        expect(sum, c.id + ' удача ' + luck).toBeCloseTo(100, 6);
      }
    }
  });

  it('в лаъловом ларце обычных вещей не бывает — ни по шансам, ни на деле', () => {
    expect(chestOdds(chest('gc_lal'), 0).common).toBe(0);
    const rng = mulberry32(11);
    for (let i = 0; i < 300; i++) {
      const { items } = rollGear(chest('gc_lal'), 0, 0, rng);
      for (const item of items) expect(item.rarity).not.toBe('common');
    }
  });

  it('удача делает обычное реже, а легендарное чаще', () => {
    const c = chest('gc_wanderer');
    expect(chestOdds(c, 1).common).toBeLessThan(chestOdds(c, 0).common);
    expect(chestOdds(c, 1).legendary).toBeGreaterThan(chestOdds(c, 0).legendary);
  });

  /*
   * Шансы на экране должны совпадать с тем, как на самом деле идёт бросок.
   * Десять тысяч бросков без гарантии: доли сходятся с объявленными.
   */
  it('объявленные шансы совпадают с настоящими', () => {
    const c = chest('gc_wanderer');
    const odds = chestOdds(c, 0);
    const rng = mulberry32(2024);
    const counts: Record<string, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
    const N = 10_000;
    for (let i = 0; i < N; i++) {
      // pity = 0 и сбрасывается каждый раз — меряем чистые шансы
      const { items } = rollGear(c, 0, 0, rng);
      counts[items[0]!.rarity]!++;
    }
    for (const r of RARITY_ORDER) {
      expect(Math.abs((counts[r]! / N) * 100 - odds[r]), r).toBeLessThan(1.5);
    }
  });
});

/* ————————————————————————— гарантия ————————————————————————— */

describe('гарантия эпической вещи', () => {
  /** Худшая удача на свете: бросок всегда выпадает в самое начало шкалы. */
  const unlucky: Rng = () => 0;

  it('даже при худшей удаче эпическая вещь приходит не реже раза в PITY_EVERY', () => {
    let pity = 0;
    const got: string[] = [];
    for (let i = 0; i < PITY_EVERY * 3; i++) {
      const r = rollGear(chest('gc_wanderer'), 0, pity, unlucky);
      pity = r.pity;
      got.push(r.items[0]!.rarity);
    }
    for (let i = 0; i + PITY_EVERY <= got.length; i++) {
      const window = got.slice(i, i + PITY_EVERY);
      expect(window.some((r) => r === 'epic' || r === 'legendary'), 'окно с ' + i).toBe(true);
    }
  });

  it('гарантия работает и внутри каравана из пяти вещей', () => {
    const r = rollGear(chest('gc_caravan'), 0, PITY_EVERY - 2, unlucky);
    expect(r.items.slice(0, 2).some((i) => i.rarity === 'epic' || i.rarity === 'legendary')).toBe(true);
  });

  it('эпическая вещь сбрасывает счётчик', () => {
    const r = rollGear(chest('gc_wanderer'), 0, PITY_EVERY - 1, unlucky);
    expect(['epic', 'legendary']).toContain(r.items[0]!.rarity);
    expect(r.pity).toBe(0);
  });
});

/* ————————————————————————— открытие ————————————————————————— */

describe('открытие сундука', () => {
  it('списывает цену и кладёт вещь первого уровня', () => {
    const s = rich();
    const coins = s.wallet.coins;
    const drops = openGearChest(s, 'gc_wanderer', mulberry32(1), T0)!;
    expect(drops).toHaveLength(1);
    expect(s.wallet.coins).toBe(coins - 250);
    expect(gearLevel(s, drops[0]!.item.id)).toBe(1);
    expect(drops[0]!.isNew).toBe(true);
    expect(s.stats.cases).toBe(1);
  });

  it('лаъловый ларец берёт лаъл, а не монеты', () => {
    const s = rich();
    const coins = s.wallet.coins;
    const gems = s.wallet.gems;
    openGearChest(s, 'gc_lal', mulberry32(1), T0);
    expect(s.wallet.coins).toBe(coins);
    expect(s.wallet.gems).toBe(gems - 12);
  });

  it('повторная находка превращается в осколки и уровень не трогает', () => {
    const s = rich();
    s.inventory.shards = 0;
    for (const item of GEAR) s.inventory.gear[item.id] = 1;
    const drops = openGearChest(s, 'gc_caravan', mulberry32(7), T0)!;
    const expected = drops.reduce((sum, d) => sum + RARITIES[d.item.rarity].shards, 0);
    expect(drops.every((d) => !d.isNew)).toBe(true);
    expect(s.inventory.shards).toBe(expected);
    for (const item of GEAR) expect(gearLevel(s, item.id)).toBe(1);
  });

  it('без денег сундук не открывается и ничего не списывает', () => {
    const s = createInitialState(T0);
    s.wallet.coins = 10;
    expect(openGearChest(s, 'gc_wanderer', mulberry32(1), T0)).toBeNull();
    expect(s.wallet.coins).toBe(10);
    expect(s.stats.cases).toBe(0);
  });

  it('караван дешевле пяти сундуков по одному', () => {
    expect(chest('gc_caravan').coins).toBeLessThan(chest('gc_wanderer').coins * 5);
  });
});

/* ————————————————————————— улучшение и наряд ————————————————————————— */

describe('улучшение', () => {
  it('списывает монеты и осколки, поднимает уровень', () => {
    const s = rich();
    s.inventory.gear['n_scarf'] = 1;
    const cost = upgradeCost(getGear('n_scarf')!, 1);
    const coins = s.wallet.coins;
    const shards = s.inventory.shards;
    expect(upgradeGear(s, 'n_scarf', T0)).toBe('ok');
    expect(gearLevel(s, 'n_scarf')).toBe(2);
    expect(s.wallet.coins).toBe(coins - cost.coins);
    expect(s.inventory.shards).toBe(shards - cost.shards);
  });

  it('без осколков не улучшается', () => {
    const s = rich();
    s.inventory.gear['n_scarf'] = 1;
    s.inventory.shards = 0;
    expect(canUpgradeGear(s, 'n_scarf')).toBe('not-enough-shards');
  });

  it('ненайденную вещь улучшить нельзя', () => {
    expect(canUpgradeGear(rich(), 'n_scarf')).toBe('not-owned');
  });

  it('на потолке улучшение останавливается', () => {
    const s = rich();
    s.inventory.gear['n_scarf'] = RARITIES.common.maxLevel;
    expect(canUpgradeGear(s, 'n_scarf')).toBe('maxed');
  });
});

describe('наряд питомца', () => {
  it('надетая вещь даёт бонус, снятая — нет', () => {
    const s = rich();
    s.inventory.gear['n_scarf'] = 1;
    const was = coinMultiplier(s);
    expect(equipGear(s, 'pet_fox', 'n_scarf', T0)).toBe(true);
    expect(coinMultiplier(s)).toBeGreaterThan(was);
    unequipGear(s, 'pet_fox', 'neck', T0);
    expect(coinMultiplier(s)).toBeCloseTo(was);
  });

  it('улучшение надетой вещи сразу усиливает бонус', () => {
    const s = rich();
    s.inventory.gear['n_scarf'] = 1;
    equipGear(s, 'pet_fox', 'n_scarf', T0);
    const was = perksOf(s).coins;
    upgradeGear(s, 'n_scarf', T0);
    expect(perksOf(s).coins).toBeGreaterThan(was);
  });

  it('работает только наряд активного питомца', () => {
    const s = rich();
    s.inventory.gear['n_scarf'] = 1;
    buy(s, 'pet_cat', T0); // кошка теперь активна
    equipGear(s, 'pet_fox', 'n_scarf', T0); // а шарф — на лисе
    expect(perksOf(s).coins).toBeCloseTo(0.1); // только бонус кошки
  });

  it('у каждого питомца свой наряд, и он возвращается вместе с питомцем', () => {
    const s = rich();
    s.inventory.gear['h_cap'] = 1;
    s.inventory.gear['h_wreath'] = 1;
    buy(s, 'pet_cat', T0);
    equipGear(s, 'pet_fox', 'h_cap', T0);
    equipGear(s, 'pet_cat', 'h_wreath', T0);
    expect(wornBy(s, 'pet_fox').head).toBe('h_cap');
    expect(wornBy(s, 'pet_cat').head).toBe('h_wreath');
  });

  it('вещь встаёт только в свой слот: новая шапка сменяет старую', () => {
    const s = rich();
    s.inventory.gear['h_cap'] = 1;
    s.inventory.gear['h_wreath'] = 1;
    equipGear(s, 'pet_fox', 'h_cap', T0);
    equipGear(s, 'pet_fox', 'h_wreath', T0);
    expect(wornBy(s, 'pet_fox')).toEqual({ head: 'h_wreath' });
  });

  it('ненайденную вещь надеть нельзя, как и надеть на некупленного питомца', () => {
    const s = rich();
    expect(equipGear(s, 'pet_fox', 'h_cap', T0)).toBe(false);
    s.inventory.gear['h_cap'] = 1;
    expect(equipGear(s, 'pet_bird', 'h_cap', T0)).toBe(false);
  });
});

/* ————————————————————————— экономика ————————————————————————— */

describe('экономика снаряжения', () => {
  /*
   * Собрать всё не должно быть ни мгновенным, ни невозможным. Меряем честно:
   * открываем сундуки странника, пока не соберём все вещи, на ста игроках.
   */
  it('полная коллекция — дело месяцев, а не вечности', () => {
    const runs: number[] = [];
    for (let seed = 1; seed <= 100; seed++) {
      const rng = mulberry32(seed);
      const have = new Set<string>();
      let pity = 0;
      let opened = 0;
      while (have.size < GEAR.length && opened < 5000) {
        const r = rollGear(chest('gc_wanderer'), 0, pity, rng);
        pity = r.pity;
        opened++;
        for (const item of r.items) have.add(item.id);
      }
      runs.push(opened);
    }
    runs.sort((a, b) => a - b);
    const median = runs[50]!;
    // сундук стоит 250 монет, курс даёт около 10 000 за проход
    expect(median).toBeGreaterThan(40);
    expect(median).toBeLessThan(400);
  });
});
