/**
 * Угощения, товар дня и коллекция: всё, что покупается и забирается
 * вокруг питомцев, — и что ни одна покупка не срабатывает дважды.
 */

import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/rng';
import { dayKey } from '../src/core/time';
import { parseImport } from '../src/data/persist';
import { getWord } from '../src/data/content';
import { SAVE_VERSION, createInitialState, type SaveState } from '../src/data/state';
import { hintCost, perksOf, regenMsFor, shieldFor } from '../src/domain/bonuses';
import { isOwned, petCopies } from '../src/domain/catalog';
import { COLLECTION, claimGoal, claimableCount, goalStatus } from '../src/domain/collection';
import {
  BASE_DEALS,
  DEAL_KINDS,
  buyDeal,
  canBuyDeal,
  dealsFor,
  isDealBought,
  type Deal,
} from '../src/domain/deals';
import { FOODS, currentMeal, getFood } from '../src/domain/foods';
import { GEAR } from '../src/domain/gear-items';
import { LIFE_REGEN_MS } from '../src/domain/lives';
import { canFeed, consumeMeal, feed, foodPrice } from '../src/domain/meals';

const T0 = Date.parse('2026-03-10T12:00:00');
const DAY = 24 * 60 * 60 * 1000;

function rich(): SaveState {
  const s = createInitialState(T0);
  s.wallet.coins = 1_000_000;
  s.wallet.gems = 10_000;
  return s;
}

/* ————————————————————————— угощения ————————————————————————— */

describe('угощения', () => {
  it('каждое угощение — слово из курса, и написано так же, как в уроке', () => {
    for (const food of FOODS) {
      const word = getWord(food.wordId);
      expect(word, food.id).toBeTruthy();
      expect(word!.tg, food.id).toBe(food.tg);
    }
  });

  it('у каждого угощения есть бонус, и он не про жизни', () => {
    for (const food of FOODS) {
      expect(Object.keys(food.perks).length, food.id).toBeGreaterThan(0);
      // жизни, пропадающие вместе с угощением, отнимали бы сердце посреди дня
      expect(food.perks.lives, food.id).toBeUndefined();
    }
  });

  it('кормление списывает цену и сразу даёт бонус', () => {
    const s = rich();
    const coins = s.wallet.coins;
    const soup = getFood('food_shurbo')!;
    expect(shieldFor(s)).toBe(0);
    expect(feed(s, soup.id, T0)).toBe('ok');
    expect(s.wallet.coins).toBe(coins - foodPrice(s, soup));
    expect(shieldFor(s)).toBe(1);
    expect(currentMeal(s)!.left).toBe(soup.lessons);
    expect(s.stats.meals).toBe(1);
  });

  it('одно угощение за раз: второе не продаётся и не списывается', () => {
    const s = rich();
    feed(s, 'food_non', T0);
    const coins = s.wallet.coins;
    expect(canFeed(s, 'food_osh')).toBe('eating');
    expect(feed(s, 'food_osh', T0)).toBe('eating');
    expect(s.wallet.coins).toBe(coins);
    expect(currentMeal(s)!.food.id).toBe('food_non');
  });

  it('без денег — не кормит', () => {
    const s = createInitialState(T0);
    s.wallet.coins = 5;
    expect(feed(s, 'food_osh', T0)).toBe('not-enough-coins');
    expect(s.inventory.meal).toBeNull();
  });

  it('угощение доедается по уроку и кончается вместе с бонусом', () => {
    const s = rich();
    feed(s, 'food_shurbo', T0);
    const lessons = getFood('food_shurbo')!.lessons;
    for (let i = 1; i < lessons; i++) {
      expect(consumeMeal(s, T0)).toBeNull();
      expect(shieldFor(s)).toBe(1);
    }
    expect(consumeMeal(s, T0)!.id).toBe('food_shurbo');
    expect(s.inventory.meal).toBeNull();
    expect(shieldFor(s)).toBe(0);
    // съеденное — съедено: следующий урок ничего не трогает
    expect(consumeMeal(s, T0)).toBeNull();
  });

  it('молоко ускоряет жизни, а когда кончилось — скорость обычная', () => {
    const s = rich();
    feed(s, 'food_shir', T0);
    expect(regenMsFor(s)).toBeLessThan(LIFE_REGEN_MS);
    expect(s.lives.regenMs).toBe(regenMsFor(s));
    while (s.inventory.meal) consumeMeal(s, T0);
    expect(regenMsFor(s)).toBe(LIFE_REGEN_MS);
  });

  it('чай удешевляет подсказки', () => {
    const s = rich();
    const was = hintCost(s, 20);
    feed(s, 'food_choy', T0);
    expect(hintCost(s, 20)).toBeLessThan(was);
  });
});

/* ————————————————————————— товар дня ————————————————————————— */

/** Первый день начиная с T0, в который среди товаров есть такой вид. */
function dayWith(kind: string, s: SaveState): { ts: number; deal: Deal } {
  for (let d = 0; d < 400; d++) {
    const ts = T0 + d * DAY;
    const deal = dealsFor(s, ts).find((x) => x.kind === kind);
    if (deal) return { ts, deal };
  }
  throw new Error('за 400 дней ни разу не было ' + kind);
}

describe('товар дня', () => {
  it('в один день — один и тот же набор, сколько ни открывай', () => {
    const s = rich();
    const a = dealsFor(s, T0).map((d) => d.id);
    const b = dealsFor(s, T0 + 3 * 60 * 60 * 1000).map((d) => d.id);
    expect(a).toEqual(b);
    expect(a.length).toBe(BASE_DEALS);
  });

  it('за год встречается каждый вид товара', () => {
    const s = rich();
    for (const kind of DEAL_KINDS) expect(dayWith(kind, s).deal.kind).toBe(kind);
  });

  it('скидка настоящая: цена ниже обычной и круглая', () => {
    const s = rich();
    for (let d = 0; d < 30; d++) {
      for (const deal of dealsFor(s, T0 + d * DAY)) {
        expect(deal.price, deal.id).toBeLessThan(deal.base);
        expect(deal.price % 5, deal.id).toBe(0);
      }
    }
  });

  it('каждый товар продаётся один раз в день, назавтра — снова', () => {
    const s = rich();
    const deal = dealsFor(s, T0).find((d) => d.kind !== 'food')!;
    expect(buyDeal(s, deal.id, mulberry32(1), T0)).not.toBeNull();
    expect(isDealBought(s, deal.kind, T0)).toBe(true);
    const coins = s.wallet.coins;
    expect(canBuyDeal(s, deal.id, T0)).toBe('bought');
    expect(buyDeal(s, deal.id, mulberry32(2), T0)).toBeNull();
    expect(s.wallet.coins).toBe(coins);
    expect(isDealBought(s, deal.kind, T0 + DAY)).toBe(false);
    expect(s.stats.deals).toBe(1);
  });

  it('лона по товару дня стоит ровно цену товара', () => {
    const s = rich();
    const { ts, deal } = dayWith('nest', s);
    const coins = s.wallet.coins;
    const got = buyDeal(s, deal.id, mulberry32(3), ts);
    expect(got?.kind).toBe('nest');
    expect(s.wallet.coins).toBe(coins - deal.price);
  });

  it('копия — всегда знакомого питомца, и она добавляется', () => {
    const s = rich();
    const { ts, deal } = dayWith('copy', s);
    expect(isOwned(s, deal.pet!.id)).toBe(true);
    const was = petCopies(s, deal.pet!.id);
    buyDeal(s, deal.id, mulberry32(4), ts);
    expect(petCopies(s, deal.pet!.id)).toBe(was + 1);
  });

  it('угощение по товару дня не продаётся, пока питомец ест', () => {
    const s = rich();
    const { ts, deal } = dayWith('food', s);
    const other = FOODS.find((f) => f.id !== deal.food!.id)!;
    feed(s, other.id, ts);
    expect(canBuyDeal(s, deal.id, ts)).toBe('eating');
    const coins = s.wallet.coins;
    expect(buyDeal(s, deal.id, mulberry32(5), ts)).toBeNull();
    expect(s.wallet.coins).toBe(coins);
  });

  it('без денег товар не покупается', () => {
    const s = createInitialState(T0);
    s.wallet.coins = 1;
    const deal = dealsFor(s, T0)[0]!;
    expect(canBuyDeal(s, deal.id, T0)).toBe('not-enough-coins');
    expect(buyDeal(s, deal.id, mulberry32(6), T0)).toBeNull();
  });

  it('старая отметка о покупке не мешает в новый день', () => {
    const s = rich();
    s.daily.dealDay = dayKey(T0 - DAY);
    s.daily.dealsBought = [...DEAL_KINDS];
    const deal = dealsFor(s, T0).find((d) => d.kind !== 'food')!;
    expect(canBuyDeal(s, deal.id, T0)).toBe('ok');
    buyDeal(s, deal.id, mulberry32(7), T0);
    expect(s.daily.dealDay).toBe(dayKey(T0));
    expect(s.daily.dealsBought).toEqual([deal.kind]);
  });
});

/* ————————————————————————— коллекция ————————————————————————— */

describe('коллекция', () => {
  it('награды — вещи и монеты, но не лаъл', () => {
    for (const goal of COLLECTION) {
      expect(Object.keys(goal.reward).length, goal.id).toBeGreaterThan(0);
      expect(goal.reward, goal.id).not.toHaveProperty('gems');
    }
  });

  it('у новичка забирать нечего', () => {
    const s = createInitialState(T0);
    expect(claimableCount(s)).toBe(0);
    expect(claimGoal(s, 'pets4', mulberry32(1), T0)).toBeNull();
  });

  it('выполненная веха забирается один раз', () => {
    const s = rich();
    s.inventory.owned.push('pet_cat', 'pet_dog', 'pet_bird');
    const goal = COLLECTION.find((g) => g.id === 'pets4')!;
    expect(goalStatus(s, goal)).toBe('ready');
    expect(claimableCount(s)).toBeGreaterThan(0);
    const coins = s.wallet.coins;
    const got = claimGoal(s, 'pets4', mulberry32(2), T0);
    expect(got?.petDrop).toBeTruthy();
    // лона в награду — бесплатная
    expect(s.wallet.coins).toBe(coins);
    expect(goalStatus(s, goal)).toBe('claimed');
    expect(claimGoal(s, 'pets4', mulberry32(3), T0)).toBeNull();
  });

  it('монеты и осколки из награды приходят в кошелёк', () => {
    const s = rich();
    s.stats.meals = 10;
    const coins = s.wallet.coins;
    const got = claimGoal(s, 'meals10', mulberry32(4), T0)!;
    expect(got.coins).toBeGreaterThan(0);
    expect(s.wallet.coins).toBe(coins + got.coins);
  });

  it('вещи считаются только настоящие, из каталога', () => {
    const s = rich();
    for (let i = 0; i < 16; i++) s.inventory.gear['g' + i] = 1;
    expect(goalStatus(s, COLLECTION.find((g) => g.id === 'gear16')!)).toBe('progress');
  });

  it('караван в награду открывается бесплатно', () => {
    const s = rich();
    const gear = COLLECTION.find((g) => g.id === 'gear16')!;
    for (const item of GEAR.slice(0, 16)) s.inventory.gear[item.id] = 1;
    expect(goalStatus(s, gear)).toBe('ready');
    const coins = s.wallet.coins;
    const got = claimGoal(s, 'gear16', mulberry32(9), T0)!;
    expect(got.gearDrops?.length).toBeGreaterThan(1);
    expect(s.wallet.coins).toBe(coins);
  });
});

/* ————————————————————————— сохранение ————————————————————————— */

describe('сохранение четвёртой версии', () => {
  it('получает пустые угощения и товары дня, ничего не теряя', () => {
    const s = createInitialState(T0);
    s.wallet.coins = 777;
    s.inventory.petCopies = { pet_fox: 3 };
    const raw = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    raw.version = 4;
    delete (raw.inventory as Record<string, unknown>).meal;
    delete (raw.daily as Record<string, unknown>).dealDay;
    delete (raw.daily as Record<string, unknown>).dealsBought;
    delete (raw.stats as Record<string, unknown>).meals;
    delete (raw.stats as Record<string, unknown>).deals;
    const r = parseImport(JSON.stringify({ kind: 'learn-tajik/progress', version: 4, state: raw }), T0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.version).toBe(SAVE_VERSION);
    expect(r.state.inventory.meal).toBeNull();
    expect(r.state.daily.dealsBought).toEqual([]);
    expect(r.state.stats.meals).toBe(0);
    expect(r.state.wallet.coins).toBe(777);
    expect(r.state.inventory.petCopies['pet_fox']).toBe(3);
    expect(perksOf(r.state).shield).toBe(0);
  });

  it('битое угощение в файле отбрасывается', () => {
    const s = createInitialState(T0);
    const raw = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    (raw.inventory as Record<string, unknown>).meal = { id: 42, left: 'много' };
    const r = parseImport(JSON.stringify({ kind: 'learn-tajik/progress', version: SAVE_VERSION, state: raw }), T0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.inventory.meal).toBeNull();
  });
});
