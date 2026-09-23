import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/rng';
import { DAY, HOUR } from '../src/core/time';
import { createInitialState, type SaveState } from '../src/data/state';
import {
  WHEEL_SECTORS,
  applyReward,
  canOpenChest,
  canSpinWheel,
  openChest,
  rollChest,
  rollWheel,
  spinWheel,
} from '../src/domain/daily';
import { computeLives, spendLife } from '../src/domain/lives';
import {
  RECOVERY_SIZE,
  CORRECT_FOR_LIFE,
  createRecoveryProgress,
  hasRecoveryMaterial,
  recordRecoveryAnswer,
  recoveryCoins,
  recoveryWordIds,
} from '../src/domain/recovery';
import {
  applyCoinBonus,
  applyPerks,
  BASE_MAX_LIVES,
  coinMultiplier,
  hintCost,
  maxLivesFor,
} from '../src/domain/bonuses';
import { boosterCount, isOwned } from '../src/domain/catalog';
import { buy, canBuy, equip, useBooster } from '../src/domain/shop';
import { recordWordAttempt } from '../src/domain/srs';
import {
  countDailyExercise,
  dailyGoalReached,
  practicedToday,
  todayCount,
  touchStreak,
  visibleStreak,
} from '../src/domain/streak';

/** Полдень 10 марта по местному времени — чтобы ключ даты был предсказуем. */
const T0 = new Date(2026, 2, 10, 12, 0, 0).getTime();
const day = (n: number) => T0 + n * DAY;

function fresh(): SaveState {
  return createInitialState(T0);
}

/* ————————————————————————— стрик ————————————————————————— */

describe('стрик', () => {
  it('первый день даёт единицу', () => {
    const s = fresh();
    const r = touchStreak(s, T0);
    expect(r.advanced).toBe(true);
    expect(r.current).toBe(1);
    expect(s.streak.best).toBe(1);
  });

  it('повторный заход в тот же день ничего не меняет', () => {
    const s = fresh();
    touchStreak(s, T0);
    const r = touchStreak(s, T0 + 3 * HOUR);
    expect(r.advanced).toBe(false);
    expect(s.streak.current).toBe(1);
  });

  it('каждый следующий день увеличивает счётчик', () => {
    const s = fresh();
    touchStreak(s, day(0));
    touchStreak(s, day(1));
    touchStreak(s, day(2));
    expect(s.streak.current).toBe(3);
    expect(s.streak.best).toBe(3);
  });

  it('пропуск дня сбрасывает стрик', () => {
    const s = fresh();
    touchStreak(s, day(0));
    touchStreak(s, day(1));
    const r = touchStreak(s, day(3));
    expect(r.broken).toBe(true);
    expect(s.streak.current).toBe(1);
    expect(s.streak.best).toBe(2);
  });

  it('заморозка прикрывает ровно один пропущенный день', () => {
    const s = fresh();
    s.streak.freezes = 1;
    touchStreak(s, day(0));
    touchStreak(s, day(1));
    const r = touchStreak(s, day(3));
    expect(r.frozen).toBe(true);
    expect(r.broken).toBe(false);
    expect(s.streak.current).toBe(3);
    expect(s.streak.freezes).toBe(0);
  });

  it('два пропущенных дня заморозка не спасает', () => {
    const s = fresh();
    s.streak.freezes = 1;
    touchStreak(s, day(0));
    const r = touchStreak(s, day(4));
    expect(r.broken).toBe(true);
    expect(s.streak.freezes).toBe(1);
  });

  it('часы назад не ломают и не накручивают стрик', () => {
    const s = fresh();
    touchStreak(s, day(2));
    const before = s.streak.current;
    const r = touchStreak(s, day(1));
    expect(r.advanced).toBe(false);
    expect(s.streak.current).toBe(before);
  });

  it('видимый стрик обнуляется, если давно не заходили', () => {
    const s = fresh();
    touchStreak(s, day(0));
    expect(visibleStreak(s, day(0))).toBe(1);
    expect(visibleStreak(s, day(1))).toBe(1);
    expect(visibleStreak(s, day(5))).toBe(0);
  });

  it('practicedToday отражает сегодняшний заход', () => {
    const s = fresh();
    expect(practicedToday(s, T0)).toBe(false);
    touchStreak(s, T0);
    expect(practicedToday(s, T0)).toBe(true);
    expect(practicedToday(s, day(1))).toBe(false);
  });
});

describe('дневной счётчик упражнений', () => {
  it('считает за сегодня и обнуляется назавтра', () => {
    const s = fresh();
    countDailyExercise(s, T0);
    countDailyExercise(s, T0);
    expect(todayCount(s, T0)).toBe(2);
    countDailyExercise(s, day(1));
    expect(todayCount(s, day(1))).toBe(1);
  });

  it('цель считается выполненной по настройке', () => {
    const s = fresh();
    s.settings.dailyGoal = 3;
    expect(dailyGoalReached(s, T0)).toBe(false);
    for (let i = 0; i < 3; i++) countDailyExercise(s, T0);
    expect(dailyGoalReached(s, T0)).toBe(true);
  });
});

/* ————————————————————————— сундук и колесо ————————————————————————— */

describe('дневной сундук', () => {
  it('закрыт, пока цель не выполнена', () => {
    const s = fresh();
    s.settings.dailyGoal = 2;
    expect(canOpenChest(s, T0)).toBe(false);
    countDailyExercise(s, T0);
    countDailyExercise(s, T0);
    expect(canOpenChest(s, T0)).toBe(true);
  });

  it('открывается один раз в день', () => {
    const s = fresh();
    s.settings.dailyGoal = 1;
    countDailyExercise(s, T0);
    expect(openChest(s, mulberry32(1), T0)).not.toBeNull();
    expect(canOpenChest(s, T0)).toBe(false);
    expect(openChest(s, mulberry32(2), T0)).toBeNull();
  });

  it('назавтра снова доступен', () => {
    const s = fresh();
    s.settings.dailyGoal = 1;
    countDailyExercise(s, T0);
    openChest(s, mulberry32(1), T0);
    countDailyExercise(s, day(1));
    expect(canOpenChest(s, day(1))).toBe(true);
  });

  it('любая награда из сундука что-то даёт', () => {
    for (let seed = 1; seed < 60; seed++) {
      const reward = rollChest(mulberry32(seed));
      expect(reward.amount).toBeGreaterThan(0);
      expect(reward.label.length).toBeGreaterThan(0);
    }
  });
});

describe('колесо удачи', () => {
  it('крутится раз в сутки', () => {
    const s = fresh();
    expect(canSpinWheel(s, T0)).toBe(true);
    expect(spinWheel(s, mulberry32(1), T0)).not.toBeNull();
    expect(canSpinWheel(s, T0)).toBe(false);
    expect(spinWheel(s, mulberry32(1), T0)).toBeNull();
    expect(canSpinWheel(s, day(1))).toBe(true);
  });

  it('выпадает существующий сектор', () => {
    for (let seed = 1; seed < 80; seed++) {
      const i = rollWheel(mulberry32(seed));
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(WHEEL_SECTORS.length);
    }
  });

  it('крупные награды выпадают реже мелких', () => {
    const counts = new Array(WHEEL_SECTORS.length).fill(0);
    const rng = mulberry32(7);
    for (let i = 0; i < 4000; i++) counts[rollWheel(rng)]++;
    // сектор 0 (20 монет) должен встречаться заметно чаще сектора 7 (полный запас)
    expect(counts[0]).toBeGreaterThan(counts[7] * 4);
  });
});

describe('выдача наград', () => {
  it('монеты идут и в кошелёк, и в статистику', () => {
    const s = fresh();
    const before = s.wallet.coins;
    applyReward(s, { kind: 'coins', amount: 40, label: '40' }, T0);
    expect(s.wallet.coins).toBe(before + 40);
    expect(s.stats.coinsEarned).toBe(40);
  });

  it('жизнь не даётся сверх максимума', () => {
    const s = fresh();
    applyReward(s, { kind: 'life', amount: 3, label: 'жизнь' }, T0);
    expect(s.lives.count).toBe(s.lives.max);
  });

  it('бустер попадает в инвентарь', () => {
    const s = fresh();
    applyReward(s, { kind: 'booster', amount: 2, itemId: 'hint', label: 'подсказка' }, T0);
    expect(boosterCount(s, 'hint')).toBe(2);
  });

  it('заморозка идёт в счётчик стрика', () => {
    const s = fresh();
    applyReward(s, { kind: 'freeze', amount: 1, label: 'заморозка' }, T0);
    expect(s.streak.freezes).toBe(1);
  });
});

/* ————————————————————————— магазин ————————————————————————— */

describe('магазин', () => {
  it('стартовые предметы уже свои', () => {
    const s = fresh();
    expect(isOwned(s, 'pet_fox')).toBe(true);
    expect(isOwned(s, 'theme_meadow')).toBe(true);
    expect(isOwned(s, 'pet_cat')).toBe(false);
  });

  it('без монет купить нельзя', () => {
    const s = fresh();
    s.wallet.coins = 10;
    expect(canBuy(s, 'pet_cat')).toBe('not-enough-coins');
    expect(buy(s, 'pet_cat', T0)).toBe('not-enough-coins');
    expect(s.wallet.coins).toBe(10);
  });

  it('покупка списывает монеты и надевает питомца', () => {
    const s = fresh();
    s.wallet.coins = 1000;
    expect(buy(s, 'pet_cat', T0)).toBe('ok');
    expect(s.wallet.coins).toBe(800);
    expect(isOwned(s, 'pet_cat')).toBe(true);
    expect(s.profile.petId).toBe('pet_cat');
  });

  it('дважды один питомец не покупается', () => {
    const s = fresh();
    s.wallet.coins = 1000;
    buy(s, 'pet_cat', T0);
    expect(canBuy(s, 'pet_cat')).toBe('already-owned');
  });

  it('бустеры покупаются сколько угодно раз', () => {
    const s = fresh();
    s.wallet.coins = 1000;
    buy(s, 'hint', T0);
    buy(s, 'hint', T0);
    expect(boosterCount(s, 'hint')).toBe(2);
    expect(canBuy(s, 'hint')).toBe('ok');
  });

  it('несуществующий предмет не покупается', () => {
    expect(canBuy(fresh(), 'нет такого')).toBe('no-such-item');
  });

  it('кошка добавляет 10% к монетам', () => {
    const s = fresh();
    s.wallet.coins = 1000;
    buy(s, 'pet_cat', T0);
    expect(coinMultiplier(s)).toBeCloseTo(1.1);
    expect(applyCoinBonus(100, coinMultiplier(s))).toBe(110);
    expect(applyCoinBonus(35, coinMultiplier(s))).toBe(38);
  });

  it('пёс поднимает максимум жизней и сразу заполняет новый слот', () => {
    const s = fresh();
    s.wallet.coins = 1000;
    expect(maxLivesFor(s)).toBe(BASE_MAX_LIVES);
    buy(s, 'pet_dog', T0);
    expect(maxLivesFor(s)).toBe(BASE_MAX_LIVES + 1);
    expect(s.lives.max).toBe(BASE_MAX_LIVES + 1);
    expect(s.lives.count).toBe(BASE_MAX_LIVES + 1);
  });

  it('смена питомца обратно возвращает максимум жизней', () => {
    const s = fresh();
    s.wallet.coins = 1000;
    buy(s, 'pet_dog', T0);
    buy(s, 'pet_cat', T0);
    expect(s.lives.max).toBe(BASE_MAX_LIVES);
    expect(s.lives.count).toBeLessThanOrEqual(BASE_MAX_LIVES);
  });

  it('птица делает подсказки дешевле', () => {
    const s = fresh();
    s.wallet.coins = 1000;
    expect(hintCost(s, 15)).toBe(15);
    buy(s, 'pet_bird', T0);
    expect(hintCost(s, 15)).toBe(9);
  });

  it('скин карты надевается и запоминается', () => {
    const s = fresh();
    s.wallet.coins = 1000;
    buy(s, 'theme_winter', T0);
    expect(s.profile.themeId).toBe('winter');
  });

  it('ненадетый предмет надеть нельзя', () => {
    const s = fresh();
    expect(equip(s, 'theme_night', T0)).toBe(false);
  });

  it('бустер тратится и не уходит в минус', () => {
    const s = fresh();
    s.inventory.items['fifty'] = 1;
    expect(useBooster(s, 'fifty')).toBe(true);
    expect(useBooster(s, 'fifty')).toBe(false);
    expect(boosterCount(s, 'fifty')).toBe(0);
  });

  it('заморозка при покупке идёт сразу в стрик', () => {
    const s = fresh();
    s.wallet.coins = 1000;
    buy(s, 'freeze', T0);
    expect(s.streak.freezes).toBe(1);
    expect(boosterCount(s, 'freeze')).toBe(0);
  });

  it('applyPerks согласует максимум жизней с питомцем', () => {
    const s = fresh();
    s.profile.petId = 'pet_dog';
    s.inventory.owned.push('pet_dog');
    applyPerks(s, T0);
    expect(s.lives.max).toBe(BASE_MAX_LIVES + 1);
  });
});

/* ————————————————————————— восстановление ————————————————————————— */

function withHardWords(s: SaveState, n: number): void {
  for (let i = 0; i < n; i++) {
    recordWordAttempt(s, 'w_' + i, false, T0);
    recordWordAttempt(s, 'w_' + i, i % 2 === 0, T0 + 1000);
  }
}

describe('восстановление', () => {
  it('каждые три верных ответа возвращают жизнь', () => {
    const s = fresh();
    s.lives.count = 0;
    const p = createRecoveryProgress();
    for (let i = 0; i < CORRECT_FOR_LIFE - 1; i++) {
      expect(recordRecoveryAnswer(s, p, true, T0).grantedLife).toBe(false);
    }
    const step = recordRecoveryAnswer(s, p, true, T0);
    expect(step.grantedLife).toBe(true);
    expect(s.lives.count).toBe(1);
    expect(p.livesGained).toBe(1);
  });

  /*
   * Раньше жизнь давали за восемь верных подряд, и ошибка обнуляла счёт.
   * На словах, которые как раз не даются, это почти невыполнимо — человек,
   * потерявший жизни, застревал и в восстановлении. Теперь ошибка не сжигает
   * накопленное: верные ответы не обязаны идти подряд.
   */
  it('ошибка не сжигает накопленные верные ответы и жизней не отнимает', () => {
    const s = fresh();
    s.lives.count = 0;
    const p = createRecoveryProgress();
    recordRecoveryAnswer(s, p, true, T0);
    recordRecoveryAnswer(s, p, false, T0);
    recordRecoveryAnswer(s, p, true, T0);
    recordRecoveryAnswer(s, p, false, T0);
    const step = recordRecoveryAnswer(s, p, true, T0);
    expect(step.grantedLife).toBe(true);
    expect(s.lives.count).toBe(1);
  });

  it('даже при половине ошибок сессия возвращает больше одной жизни ещё до конца', () => {
    const s = fresh();
    s.lives.count = 0;
    const p = createRecoveryProgress();
    for (let i = 0; i < RECOVERY_SIZE - 1; i++) recordRecoveryAnswer(s, p, i % 2 === 0, T0);
    expect(p.livesGained).toBeGreaterThanOrEqual(2);
  });

  it('пройденная сессия возвращает полный запас', () => {
    const s = fresh();
    s.lives.count = 0;
    const p = createRecoveryProgress();
    for (let i = 0; i < RECOVERY_SIZE; i++) recordRecoveryAnswer(s, p, i % 3 !== 0, T0);
    expect(p.completed).toBe(true);
    expect(s.lives.count).toBe(s.lives.max);
    expect(s.stats.recoveries).toBe(1);
  });

  it('полный запас не выдаётся дважды', () => {
    const s = fresh();
    s.lives.count = 0;
    const p = createRecoveryProgress();
    for (let i = 0; i < RECOVERY_SIZE + 5; i++) recordRecoveryAnswer(s, p, true, T0);
    expect(s.stats.recoveries).toBe(1);
  });

  it('сессия набирается из слов с ошибками', () => {
    const s = fresh();
    withHardWords(s, 10);
    const ids = recoveryWordIds(s, T0, 5);
    expect(ids).toHaveLength(5);
    // слова, где ошибались и серия сорвана, идут первыми
    const worst = s.srs[ids[0] as string];
    expect(worst?.wrong).toBeGreaterThan(0);
  });

  it('монеты за восстановление меньше, чем за уровень', () => {
    // иначе выгоднее нарочно терять жизни, чем проходить карту
    expect(recoveryCoins(200)).toBeLessThan(100);
    expect(recoveryCoins(0)).toBe(1);
    expect(recoveryCoins(100)).toBe(35);
  });

  it('без статистики восстанавливать нечего', () => {
    expect(hasRecoveryMaterial(fresh(), T0)).toBe(false);
  });

  it('после нескольких уровней материал появляется', () => {
    const s = fresh();
    withHardWords(s, 6);
    expect(hasRecoveryMaterial(s, T0)).toBe(true);
  });
});

/* ————————————————————————— жизни в уровне ————————————————————————— */

describe('жизни по ходу уровня', () => {
  it('пять ошибок обнуляют запас', () => {
    const s = fresh();
    for (let i = 0; i < BASE_MAX_LIVES; i++) expect(spendLife(s, T0)).toBe(true);
    expect(computeLives(s.lives, T0).count).toBe(0);
    expect(spendLife(s, T0)).toBe(false);
  });

  it('с псом ошибок можно допустить на одну больше', () => {
    const s = fresh();
    s.wallet.coins = 1000;
    buy(s, 'pet_dog', T0);
    let spent = 0;
    while (spendLife(s, T0)) spent++;
    expect(spent).toBe(BASE_MAX_LIVES + 1);
  });
});
