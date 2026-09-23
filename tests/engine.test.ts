import { describe, expect, it, vi } from 'vitest';
import {
  COINS_PER_CORRECT,
  COMBO_BONUS_MAX,
  FIRST_CLEAR_MULTIPLIER,
  coinsForAnswer,
  coinsForLevel,
  sessionRewards,
} from '../src/domain/economy';
import { createSession } from '../src/game/engine';
import type { Exercise } from '../src/game/types';

function quiz(id: string): Exercise {
  return {
    kind: 'quiz_tg_ru',
    wordIds: [id],
    prompt: 'салом',
    options: ['привет', 'нет', 'день', 'друг'],
    correct: 0,
  };
}

function session(count = 3) {
  return createSession({
    sessionId: 's01_l1',
    exercises: Array.from({ length: count }, (_, i) => quiz('w_' + i)),
  });
}

describe('сессия уровня', () => {
  it('стартует с первого задания', () => {
    const s = session(3);
    expect(s.state.index).toBe(0);
    expect(s.state.total).toBe(3);
    expect(s.state.finished).toBe(false);
    expect(s.current()?.wordIds).toEqual(['w_0']);
  });

  it('пустой список сразу считается законченным', () => {
    const s = createSession({ sessionId: 'x', exercises: [] });
    expect(s.state.finished).toBe(true);
    expect(s.current()).toBeUndefined();
    expect(s.progress()).toBe(1);
    expect(s.advance()).toBe(false);
  });

  it('advance двигает индекс и в конце возвращает false', () => {
    const s = session(2);
    expect(s.advance()).toBe(true);
    expect(s.state.index).toBe(1);
    expect(s.advance()).toBe(false);
    expect(s.state.finished).toBe(true);
    // повторный вызов после конца ничего не ломает
    expect(s.advance()).toBe(false);
    expect(s.state.index).toBe(2);
  });

  it('прогресс растёт от 0 до 1', () => {
    const s = session(4);
    expect(s.progress()).toBe(0);
    s.advance();
    expect(s.progress()).toBe(0.25);
    s.advance();
    s.advance();
    s.advance();
    expect(s.progress()).toBe(1);
  });
});

describe('счёт и серии', () => {
  it('верный ответ увеличивает серию, неверный сбрасывает', () => {
    const s = session(5);
    s.attempt({ correct: true, wordIds: [] });
    s.attempt({ correct: true, wordIds: [] });
    expect(s.state.combo).toBe(2);
    s.attempt({ correct: false, wordIds: [] });
    expect(s.state.combo).toBe(0);
    expect(s.state.mistakes).toBe(1);
    expect(s.state.correct).toBe(2);
    expect(s.state.attempts).toBe(3);
  });

  it('лучшая серия запоминается после сброса', () => {
    const s = session(5);
    for (let i = 0; i < 4; i++) s.attempt({ correct: true, wordIds: [] });
    s.attempt({ correct: false, wordIds: [] });
    s.attempt({ correct: true, wordIds: [] });
    expect(s.state.bestCombo).toBe(4);
    expect(s.state.combo).toBe(1);
  });

  it('монеты капают за каждый верный ответ', () => {
    const s = session(5);
    s.attempt({ correct: true, wordIds: [] });
    expect(s.state.coinsFromAnswers).toBe(COINS_PER_CORRECT);
    s.attempt({ correct: false, wordIds: [] });
    expect(s.state.coinsFromAnswers).toBe(COINS_PER_CORRECT);
  });

  it('onAttempt получает каждую попытку — на это подключится повторение', () => {
    const seen: boolean[] = [];
    const s = createSession({
      sessionId: 'x',
      exercises: [quiz('w_1')],
      onAttempt: (a) => seen.push(a.correct),
    });
    s.attempt({ correct: true, wordIds: ['w_1'] });
    s.attempt({ correct: false, wordIds: ['w_1'] });
    expect(seen).toEqual([true, false]);
  });
});

describe('итог сессии', () => {
  it('без ошибок — три звезды и полная точность', () => {
    const s = session(3);
    for (let i = 0; i < 3; i++) s.attempt({ correct: true, wordIds: [] });
    const r = s.result();
    expect(r.stars).toBe(3);
    expect(r.accuracy).toBe(1);
    expect(r.mistakes).toBe(0);
  });

  it('две ошибки — две звезды', () => {
    const s = session(5);
    s.attempt({ correct: false, wordIds: [] });
    s.attempt({ correct: false, wordIds: [] });
    for (let i = 0; i < 3; i++) s.attempt({ correct: true, wordIds: [] });
    expect(s.result().stars).toBe(2);
  });

  it('три ошибки — одна звезда', () => {
    const s = session(5);
    for (let i = 0; i < 3; i++) s.attempt({ correct: false, wordIds: [] });
    s.attempt({ correct: true, wordIds: [] });
    const r = s.result();
    expect(r.stars).toBe(1);
    expect(r.accuracy).toBeCloseTo(0.25);
  });
});

describe('монеты', () => {
  it('базовая награда без серии', () => {
    expect(coinsForAnswer(0)).toBe(COINS_PER_CORRECT);
    expect(coinsForAnswer(1)).toBe(COINS_PER_CORRECT);
  });

  it('каждые три подряд добавляют бонус', () => {
    expect(coinsForAnswer(2)).toBe(COINS_PER_CORRECT + 1); // третий подряд
    expect(coinsForAnswer(5)).toBe(COINS_PER_CORRECT + 2); // шестой подряд
    expect(coinsForAnswer(8)).toBe(COINS_PER_CORRECT + 3);
  });

  it('бонус упирается в потолок', () => {
    expect(coinsForAnswer(1000)).toBe(COINS_PER_CORRECT + COMBO_BONUS_MAX);
  });

  it('отрицательная серия не ломает счёт', () => {
    expect(coinsForAnswer(-5)).toBe(COINS_PER_CORRECT);
  });

  it('награда за уровень растёт со звёздами', () => {
    expect(coinsForLevel(1, false)).toBeLessThan(coinsForLevel(3, false));
    expect(coinsForLevel(0, false)).toBe(0);
  });

  it('первое прохождение стоит вдвое дороже', () => {
    expect(coinsForLevel(3, true)).toBe(coinsForLevel(3, false) * FIRST_CLEAR_MULTIPLIER);
  });

  it('звёзды вне диапазона не ломают награду', () => {
    expect(coinsForLevel(99, false)).toBe(coinsForLevel(3, false));
    expect(coinsForLevel(-3, false)).toBe(0);
  });

  it('итог складывает ответы и уровень', () => {
    const r = sessionRewards(35, 3, true);
    expect(r.answers).toBe(35);
    expect(r.level).toBe(coinsForLevel(3, true));
    expect(r.total).toBe(35 + r.level);
  });

  it('сумма за десять верных подряд совпадает с ручным счётом', () => {
    const s = session(10);
    for (let i = 0; i < 10; i++) s.attempt({ correct: true, wordIds: [] });
    // 2+2+3+3+3+4+4+4+5+5
    expect(s.state.coinsFromAnswers).toBe(35);
  });
});

describe('устойчивость', () => {
  it('current не падает за пределами списка', () => {
    const s = session(1);
    s.advance();
    expect(s.current()).toBeUndefined();
  });

  it('ошибка в onAttempt не должна ронять сессию молча', () => {
    const spy = vi.fn(() => {
      throw new Error('подписчик упал');
    });
    const s = createSession({ sessionId: 'x', exercises: [quiz('w')], onAttempt: spy });
    // сейчас исключение пробрасывается — фиксируем поведение явно
    expect(() => s.attempt({ correct: true, wordIds: [] })).toThrow();
    expect(s.state.correct).toBe(1);
  });
});

/* ————————————————————————— повтор ошибок в конце ————————————————————————— */

describe('повтор ошибок в конце урока', () => {
  function withRetry(count: number, cap: number, onAttempt?: (a: { correct: boolean }) => void) {
    return createSession({
      sessionId: 'x',
      exercises: Array.from({ length: count }, (_, i) => quiz('w_' + i)),
      retryMistakes: cap,
      onAttempt,
    });
  }

  it('задание с ошибкой возвращается в конце', () => {
    const s = withRetry(3, 3);
    s.attempt({ correct: false, wordIds: ['w_0'] });
    expect(s.willRetry()).toBe(true);
    expect(s.state.total).toBe(4);
    s.advance();
    s.advance();
    s.advance();
    expect(s.isRetry()).toBe(true);
    expect(s.current()?.wordIds).toEqual(['w_0']);
  });

  it('повторов не больше потолка', () => {
    const s = withRetry(5, 2);
    for (let i = 0; i < 5; i++) {
      s.attempt({ correct: false, wordIds: ['w_' + i] });
      s.advance();
    }
    expect(s.state.total).toBe(7);
  });

  it('одно задание возвращается один раз, сколько бы ошибок в нём ни было', () => {
    const s = withRetry(3, 3);
    // «найди пары»: несколько попыток внутри одного задания
    s.attempt({ correct: false, wordIds: ['w_0'] });
    s.attempt({ correct: false, wordIds: ['w_0'] });
    expect(s.state.total).toBe(4);
  });

  /*
   * Повтор — тренировка: верный ответ уже показали. Звезду за ошибку снимает
   * первый проход, второй раз наказывать за то же самое нельзя.
   */
  it('повтор не влияет на звёзды и счёт, но слово запоминается', () => {
    const seen: boolean[] = [];
    const s = withRetry(2, 3, (a) => seen.push(a.correct));
    s.attempt({ correct: false, wordIds: ['w_0'] });
    s.advance();
    s.attempt({ correct: true, wordIds: ['w_1'] });
    s.advance();
    expect(s.isRetry()).toBe(true);
    s.attempt({ correct: false, wordIds: ['w_0'] });
    expect(s.state.mistakes).toBe(1);
    expect(s.state.attempts).toBe(2);
    // но в статистику слова повтор идёт — ради неё он и нужен
    expect(seen).toEqual([false, true, false]);
  });

  it('без повторов сессия ведёт себя как раньше', () => {
    const s = session(2);
    s.attempt({ correct: false, wordIds: ['w_0'] });
    expect(s.state.total).toBe(2);
    expect(s.willRetry()).toBe(false);
  });
});
