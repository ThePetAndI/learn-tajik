/**
 * Питомцы из лоны: выпадение, копии, звёзды, обмен — и честность лоны.
 */

import { describe, expect, it } from 'vitest';
import { mulberry32, type Rng } from '../src/core/rng';
import { createInitialState, type SaveState } from '../src/data/state';
import { coinMultiplier, maxLivesFor, perksOf } from '../src/domain/bonuses';
import {
  MAX_PET_RANK,
  RANK_MULT,
  allPets,
  getItem,
  isOwned,
  petBonus,
  petCopies,
  petRank,
  rankedBonus,
  tierLabel,
} from '../src/domain/catalog';
import {
  FUSE_COPIES,
  PET_CHESTS,
  PET_PITY,
  canFuse,
  canRankUp,
  fuse,
  fusionPlan,
  getPetChest,
  openPetChest,
  petChestOdds,
  petsOfRarity,
  rankUp,
  rankUpCost,
  rollPet,
  spareCopies,
} from '../src/domain/pets';
import { RARITY_ORDER } from '../src/domain/rarity';
import { buy, canBuy, equip } from '../src/domain/shop';

const T0 = Date.parse('2026-03-10T12:00:00Z');

function rich(): SaveState {
  const s = createInitialState(T0);
  s.wallet.coins = 1_000_000;
  s.wallet.gems = 10_000;
  return s;
}

const lona = getPetChest('pc_lona')!;
const lonaLal = getPetChest('pc_lona_lal')!;

/* ————————————————————————— каталог ————————————————————————— */

describe('питомцы в каталоге', () => {
  it('у каждого питомца есть редкость и порода', () => {
    for (const pet of allPets()) {
      expect(pet.rarity, pet.id).toBeTruthy();
      expect(pet.breed, pet.id).toBeTruthy();
    }
  });

  it('у каждой редкости есть питомцы — иначе шанс указан на пустоту', () => {
    for (const r of RARITY_ORDER) expect(petsOfRarity(r).length, r).toBeGreaterThan(0);
  });

  it('питомца из лона нельзя купить — цена у него 0, и даром он не достаётся', () => {
    const s = rich();
    for (const pet of allPets().filter((p) => p.chestOnly)) {
      expect(canBuy(s, pet.id), pet.id).toBe('chest-only');
      expect(buy(s, pet.id, T0)).toBe('chest-only');
      expect(isOwned(s, pet.id)).toBe(false);
    }
  });

  it('у каждой ступени каждого питомца есть подпись', () => {
    for (const pet of allPets()) {
      for (const tier of pet.tiers ?? []) {
        if (Object.keys(tier.bonus).length > 0) expect(tierLabel(tier).length, pet.id).toBeGreaterThan(0);
      }
    }
  });
});

/* ————————————————————————— лона ————————————————————————— */

describe('лона', () => {
  it('шансы сходятся в сто процентов при любой удаче', () => {
    for (const chest of PET_CHESTS) {
      for (const luck of [0, 0.5, 1, 2]) {
        const odds = petChestOdds(chest, luck);
        expect(RARITY_ORDER.reduce((a, r) => a + odds[r], 0), chest.id).toBeCloseTo(100, 6);
      }
    }
  });

  it('в рубиновой лоне обычных питомцев не бывает — ни по шансам, ни на деле', () => {
    expect(petChestOdds(lonaLal, 0).common).toBe(0);
    const rng = mulberry32(3);
    for (let i = 0; i < 300; i++) expect(rollPet(lonaLal, 0, 0, rng)!.pet.rarity).not.toBe('common');
  });

  it('объявленные шансы совпадают с настоящими', () => {
    const odds = petChestOdds(lona, 0);
    const rng = mulberry32(99);
    const counts: Record<string, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
    const N = 10_000;
    for (let i = 0; i < N; i++) counts[rollPet(lona, 0, 0, rng)!.pet.rarity!]!++;
    for (const r of RARITY_ORDER) expect(Math.abs((counts[r]! / N) * 100 - odds[r]), r).toBeLessThan(1.5);
  });

  it('гарантия: при худшей удаче эпический приходит не реже раза в PET_PITY', () => {
    const unlucky: Rng = () => 0;
    let pity = 0;
    const got: string[] = [];
    for (let i = 0; i < PET_PITY * 3; i++) {
      const r = rollPet(lona, 0, pity, unlucky)!;
      pity = r.pity;
      got.push(r.pet.rarity!);
    }
    for (let i = 0; i + PET_PITY <= got.length; i++) {
      expect(got.slice(i, i + PET_PITY).some((r) => r === 'epic' || r === 'legendary'), 'окно ' + i).toBe(true);
    }
  });

  it('новый питомец становится вашим, повторный — копией', () => {
    const s = rich();
    const first = openPetChest(s, 'pc_lona', () => 0, T0)!; // обычный, первый в списке — лис
    expect(first.isNew).toBe(false); // лис у всех с начала
    expect(first.copies).toBe(1);
    expect(petCopies(s, first.pet.id)).toBe(1);
  });

  it('незнакомый питомец из лоны — ваш, а не копия', () => {
    const s = rich();
    // бросок в самый конец шкалы: легендарный
    const drop = openPetChest(s, 'pc_lona', () => 0.9999, T0)!;
    expect(drop.pet.rarity).toBe('legendary');
    expect(drop.isNew).toBe(true);
    expect(isOwned(s, drop.pet.id)).toBe(true);
    expect(petCopies(s, drop.pet.id)).toBe(0);
  });

  it('лона списывает свою цену: монеты или лаъл', () => {
    const s = rich();
    const coins = s.wallet.coins;
    const gems = s.wallet.gems;
    openPetChest(s, 'pc_lona', mulberry32(1), T0);
    expect(s.wallet.coins).toBe(coins - lona.coins);
    openPetChest(s, 'pc_lona_lal', mulberry32(2), T0);
    expect(s.wallet.gems).toBe(gems - lonaLal.gems);
    expect(s.stats.cases).toBe(2);
  });

  it('без денег лона не открывается и ничего не меняет', () => {
    const s = createInitialState(T0);
    s.wallet.coins = 10;
    expect(openPetChest(s, 'pc_lona', mulberry32(1), T0)).toBeNull();
    expect(s.wallet.coins).toBe(10);
    expect(s.stats.cases).toBe(0);
  });
});

/* ————————————————————————— звёзды ————————————————————————— */

describe('звёзды питомца', () => {
  it('звёзды умножают бонус ступени', () => {
    const s = rich();
    buy(s, 'pet_cat', T0);
    const one = petBonus(s, 'pet_cat').coins!;
    s.inventory.petRanks['pet_cat'] = 3;
    expect(petBonus(s, 'pet_cat').coins).toBeCloseTo(one * RANK_MULT[2]!);
  });

  it('счётные оси округляются: «+2,9 жизни» не бывает', () => {
    const ranked = rankedBonus({ lives: 2, shield: 1, coins: 0.1 }, 3);
    expect(Number.isInteger(ranked.lives)).toBe(true);
    expect(Number.isInteger(ranked.shield)).toBe(true);
  });

  it('соединение копий даёт звезду и сразу усиливает бонус', () => {
    const s = rich();
    buy(s, 'pet_cat', T0);
    s.inventory.petCopies['pet_cat'] = 1;
    const was = coinMultiplier(s);
    expect(rankUp(s, 'pet_cat', T0)).toBe('ok');
    expect(petRank(s, 'pet_cat')).toBe(2);
    expect(petCopies(s, 'pet_cat')).toBe(0);
    expect(coinMultiplier(s)).toBeGreaterThan(was);
  });

  it('звезда пса сразу добавляет жизни', () => {
    const s = rich();
    buy(s, 'pet_dog', T0);
    s.inventory.petLevels['pet_dog'] = 5; // пять жизней сверху
    equip(s, 'pet_dog', T0);
    const was = maxLivesFor(s);
    s.inventory.petCopies['pet_dog'] = 10;
    rankUp(s, 'pet_dog', T0);
    expect(maxLivesFor(s)).toBeGreaterThan(was);
    expect(s.lives.max).toBe(maxLivesFor(s));
  });

  it('без копий звезды нет, и монеты не списываются', () => {
    const s = rich();
    buy(s, 'pet_cat', T0);
    const coins = s.wallet.coins;
    expect(canRankUp(s, 'pet_cat')).toBe('not-enough-copies');
    expect(rankUp(s, 'pet_cat', T0)).toBe('not-enough-copies');
    expect(s.wallet.coins).toBe(coins);
  });

  it('каждая следующая звезда дороже, редкий питомец дороже обычного', () => {
    const s = rich();
    buy(s, 'pet_cat', T0);
    const costs: number[] = [];
    for (let r = 1; r < MAX_PET_RANK; r++) {
      s.inventory.petRanks['pet_cat'] = r;
      costs.push(rankUpCost(s, 'pet_cat')!.coins);
    }
    for (let i = 1; i < costs.length; i++) expect(costs[i]).toBeGreaterThan(costs[i - 1]!);
    s.inventory.owned.push('pet_babr');
    expect(rankUpCost(s, 'pet_babr')!.coins).toBeGreaterThan(rankUpCost(s, 'pet_fox')!.coins);
  });

  it('выше пяти звёзд не поднять', () => {
    const s = rich();
    s.inventory.petRanks['pet_fox'] = MAX_PET_RANK;
    s.inventory.petCopies['pet_fox'] = 50;
    expect(canRankUp(s, 'pet_fox')).toBe('maxed');
  });

  it('звёзды чужого питомца не усиливают активного', () => {
    const s = rich();
    buy(s, 'pet_cat', T0); // кошка активна
    const was = perksOf(s).coins;
    s.inventory.petRanks['pet_fox'] = 5;
    expect(perksOf(s).coins).toBe(was);
  });
});

/* ————————————————————————— обмен копий ————————————————————————— */

describe('обмен копий', () => {
  it('три копии одной редкости — питомец редкостью выше', () => {
    const s = rich();
    s.inventory.petCopies['pet_fox'] = 2;
    buy(s, 'pet_cat', T0);
    s.inventory.petCopies['pet_cat'] = 1;
    expect(spareCopies(s, 'common')).toBe(FUSE_COPIES);
    const drop = fuse(s, 'common', mulberry32(4), T0)!;
    expect(drop.pet.rarity).toBe('rare');
    expect(spareCopies(s, 'common')).toBe(0);
  });

  it('сначала уходят копии тех, у кого их больше', () => {
    const s = rich();
    s.inventory.petCopies['pet_fox'] = 4;
    s.inventory.petCopies['pet_cat'] = 1;
    expect(fusionPlan(s, 'common')).toEqual([{ id: 'pet_fox', n: 3 }]);
  });

  it('копий не хватает — не плавится и ничего не тратит', () => {
    const s = rich();
    s.inventory.petCopies['pet_fox'] = 2;
    const coins = s.wallet.coins;
    expect(canFuse(s, 'common')).toBe('not-enough-copies');
    expect(fuse(s, 'common', mulberry32(1), T0)).toBeNull();
    expect(petCopies(s, 'pet_fox')).toBe(2);
    expect(s.wallet.coins).toBe(coins);
  });

  it('легендарного выше нет — обменивать не на что', () => {
    expect(canFuse(rich(), 'legendary')).toBe('top-rarity');
  });

  /*
   * Питомец из обмена, которого у игрока ещё нет, становится его
   * питомцем, а не копией: первые редкие и эпические уходят на пополнение
   * коллекции. Поэтому путь к легендарному длиннее, чем 27 → 9 → 3 → 1,
   * но он есть — повторки не копятся мёртвым грузом.
   */
  it('из обычных повторок можно дойти до легендарного', () => {
    const s = rich();
    s.inventory.petCopies['pet_fox'] = 120;
    const rng = mulberry32(8);
    let best = 'common';
    for (const r of ['common', 'rare', 'epic'] as const) {
      while (canFuse(s, r) === 'ok') {
        const d = fuse(s, r, rng, T0)!;
        if (RARITY_ORDER.indexOf(d.pet.rarity!) > RARITY_ORDER.indexOf(best as never)) best = d.pet.rarity!;
      }
    }
    expect(best).toBe('legendary');
    expect(getItem('pet_babr')).toBeTruthy();
  });
});
