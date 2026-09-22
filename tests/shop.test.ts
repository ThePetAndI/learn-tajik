import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/rng';
import { createInitialState, type SaveState } from '../src/data/state';
import {
  BASE_MAX_LIVES,
  MAX_PET_TIER,
  SHOP_ITEMS,
  buy,
  canUpgradePet,
  coinMultiplier,
  equip,
  getItem,
  hintCost,
  levelCoinMultiplier,
  maxLivesFor,
  nextTier,
  openCase,
  petTier,
  rollCase,
  upgradePet,
} from '../src/domain/shop';

const T0 = Date.parse('2026-03-10T12:00:00Z');

function rich(coins = 50000): SaveState {
  const s = createInitialState(T0);
  s.wallet.coins = coins;
  return s;
}

/* ————————————————————————— прокачка ————————————————————————— */

describe('прокачка питомца', () => {
  it('без записи в сохранении питомец на первой ступени', () => {
    expect(petTier(createInitialState(T0), 'pet_cat')).toBe(1);
  });

  it('прокачка списывает монеты и поднимает ступень', () => {
    const s = rich();
    buy(s, 'pet_cat', T0);
    const before = s.wallet.coins;
    const price = nextTier(s, 'pet_cat')?.price ?? 0;

    expect(upgradePet(s, 'pet_cat', T0)).toBe('ok');
    expect(petTier(s, 'pet_cat')).toBe(2);
    expect(s.wallet.coins).toBe(before - price);
  });

  it('некупленного питомца прокачать нельзя', () => {
    expect(canUpgradePet(rich(), 'pet_bird')).toBe('not-owned');
  });

  it('без монет прокачки нет', () => {
    const s = rich(0);
    s.inventory.owned.push('pet_cat');
    expect(canUpgradePet(s, 'pet_cat')).toBe('not-enough-coins');
  });

  it('выше максимума не поднять', () => {
    const s = rich();
    buy(s, 'pet_cat', T0);
    for (let i = 0; i < 10; i++) upgradePet(s, 'pet_cat', T0);
    expect(petTier(s, 'pet_cat')).toBe(MAX_PET_TIER);
    expect(canUpgradePet(s, 'pet_cat')).toBe('maxed');
  });

  it('каждая следующая ступень дороже предыдущей', () => {
    for (const item of SHOP_ITEMS.filter((i) => i.tiers)) {
      const prices = (item.tiers ?? []).map((t) => t.price);
      for (let i = 2; i < prices.length; i++) {
        expect(prices[i], item.id).toBeGreaterThan(prices[i - 1] as number);
      }
    }
  });

  it('бонус растёт вместе со ступенью', () => {
    const s = rich();
    buy(s, 'pet_cat', T0);
    const was = coinMultiplier(s);
    upgradePet(s, 'pet_cat', T0);
    expect(coinMultiplier(s)).toBeGreaterThan(was);
  });

  it('пёс добавляет жизни, и прокачанный добавляет больше', () => {
    const s = rich();
    buy(s, 'pet_dog', T0);
    const was = maxLivesFor(s);
    expect(was).toBeGreaterThan(BASE_MAX_LIVES);
    upgradePet(s, 'pet_dog', T0);
    expect(maxLivesFor(s)).toBeGreaterThan(was);
  });

  it('птица удешевляет подсказки, и чем выше ступень, тем сильнее', () => {
    const s = rich();
    buy(s, 'pet_bird', T0);
    const was = hintCost(s, 100);
    upgradePet(s, 'pet_bird', T0);
    expect(hintCost(s, 100)).toBeLessThan(was);
  });

  it('лис влияет на награду за уровень, а не за ответы', () => {
    const s = rich();
    equip(s, 'pet_fox', T0);
    expect(levelCoinMultiplier(s)).toBe(1);
    expect(coinMultiplier(s)).toBe(1);
    upgradePet(s, 'pet_fox', T0);
    expect(levelCoinMultiplier(s)).toBeGreaterThan(1);
    // множители у разных питомцев разные оси: складывать их в один нельзя
    expect(coinMultiplier(s)).toBe(1);
  });

  it('прокачка чужого питомца не меняет бонус активного', () => {
    const s = rich();
    buy(s, 'pet_cat', T0);
    buy(s, 'pet_dog', T0); // покупка сразу надевает — активен пёс
    const was = coinMultiplier(s);
    upgradePet(s, 'pet_cat', T0);
    expect(coinMultiplier(s)).toBe(was);
  });
});

/* ————————————————————————— сундуки ————————————————————————— */

describe('сундуки', () => {
  const cases = SHOP_ITEMS.filter((i) => i.kind === 'case');

  it('сундуки вообще есть', () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  it('выпадает ровно столько бустеров, сколько обещано', () => {
    for (const c of cases) {
      for (let seed = 1; seed < 40; seed++) {
        const r = rollCase(c.id, mulberry32(seed));
        expect(r, c.id).not.toBeNull();
        const total = Object.values(r!.boosters).reduce((a, b) => a + b, 0);
        expect(total, c.id + ', seed ' + seed).toBe(c.loot?.boosters);
      }
    }
  });

  it('гарантированное выпадает всегда', () => {
    for (const c of cases) {
      for (const id of c.loot?.guaranteed ?? []) {
        for (let seed = 1; seed < 40; seed++) {
          const r = rollCase(c.id, mulberry32(seed));
          expect(r!.boosters[id], c.id + ' без ' + id).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it('монеты обратно не ниже обещанного минимума', () => {
    for (const c of cases) {
      const [lo] = c.loot!.coins;
      for (let seed = 1; seed < 60; seed++) {
        expect(rollCase(c.id, mulberry32(seed))!.coins).toBeGreaterThanOrEqual(lo);
      }
    }
  });

  /*
   * Обещание в описании магазина: сундук отдаёт больше, чем стоит.
   * Если оно перестанет выполняться, открывать его будет незачем,
   * и это превратится в отъём монет.
   */
  it('содержимое всегда дороже цены сундука', () => {
    const priceOf = (id: string): number => getItem(id)?.price ?? 0;
    for (const c of cases) {
      for (let seed = 1; seed < 60; seed++) {
        const r = rollCase(c.id, mulberry32(seed))!;
        const worth =
          r.coins +
          Object.entries(r.boosters).reduce((sum, [id, n]) => sum + priceOf(id) * n, 0);
        expect(worth, c.id + ', seed ' + seed).toBeGreaterThan(c.price);
      }
    }
  });

  it('покупка списывает цену и выдаёт содержимое', () => {
    const s = rich(1000);
    const before = s.wallet.coins;
    const r = openCase(s, 'case_bronze', mulberry32(5));
    expect(r).not.toBeNull();
    expect(s.wallet.coins).toBe(before - 150 + r!.coins);
  });

  it('заморозка уходит в свой счётчик, а не в бустеры', () => {
    const s = rich(1000);
    const was = s.streak.freezes;
    const r = openCase(s, 'case_silver', mulberry32(3))!;
    expect(s.streak.freezes).toBe(was + (r.boosters['freeze'] ?? 0));
    expect(s.inventory.items['freeze'] ?? 0).toBe(0);
  });

  it('без монет сундук не открывается и ничего не списывает', () => {
    const s = rich(10);
    expect(openCase(s, 'case_gold', mulberry32(1))).toBeNull();
    expect(s.wallet.coins).toBe(10);
  });
});
