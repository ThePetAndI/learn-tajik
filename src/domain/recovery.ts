/**
 * Режим «Восстановление» — главный способ вернуть жизни.
 *
 * Идея простая: кончились жизни — не сиди и жди таймер, а прогони слова,
 * которые даются тебе хуже всего. Восемь верных подряд возвращают жизнь,
 * пройденная целиком сессия — весь запас.
 */

import type { SaveState } from '../data/state';
import { addLives, refillLives } from './lives';
import { hardestWords } from './srs';

/** Сколько заданий в сессии восстановления. */
export const RECOVERY_SIZE = 20;
/** Верных подряд, чтобы получить жизнь. */
export const STREAK_FOR_LIFE = 8;
/** Сколько слов берём в работу. */
export const RECOVERY_WORDS = 12;
/**
 * Доля монет от обычной ставки.
 * Награда восстановления — жизни, а не заработок: сессия длинная, серия в ней
 * почти не прерывается, и по полной ставке она приносила бы больше уровня.
 * Тогда выгоднее было бы терять жизни нарочно.
 */
export const RECOVERY_COIN_RATE = 0.35;

/** Монеты за сессию восстановления. */
export function recoveryCoins(answerCoins: number): number {
  return Math.max(1, Math.round(answerCoins * RECOVERY_COIN_RATE));
}

export interface RecoveryProgress {
  answered: number;
  correct: number;
  /** Верных подряд прямо сейчас. */
  streak: number;
  livesGained: number;
  completed: boolean;
}

export function createRecoveryProgress(): RecoveryProgress {
  return { answered: 0, correct: 0, streak: 0, livesGained: 0, completed: false };
}

export interface RecoveryStep {
  /** За этот ответ выдана жизнь. */
  grantedLife: boolean;
  /** Сессия завершена этим ответом. */
  finished: boolean;
  /** Сколько верных подряд осталось до следующей жизни. */
  toNextLife: number;
}

/**
 * Записывает ответ в сессии восстановления и выдаёт жизни.
 * Состояние меняется здесь же, чтобы правило жило в одном месте.
 */
export function recordRecoveryAnswer(
  state: SaveState,
  progress: RecoveryProgress,
  correct: boolean,
  ts: number,
): RecoveryStep {
  progress.answered += 1;
  let grantedLife = false;

  if (correct) {
    progress.correct += 1;
    progress.streak += 1;
    if (progress.streak >= STREAK_FOR_LIFE) {
      progress.streak = 0;
      const added = addLives(state, 1, ts);
      if (added > 0) {
        progress.livesGained += added;
        grantedLife = true;
      }
    }
  } else {
    // ошибка обнуляет серию, но жизней здесь не отнимает:
    // восстановление не должно загонять в тупик
    progress.streak = 0;
  }

  const finished = progress.answered >= RECOVERY_SIZE;
  if (finished && !progress.completed) {
    progress.completed = true;
    const added = refillLives(state, ts);
    progress.livesGained += added;
    state.stats.recoveries += 1;
  }

  return {
    grantedLife,
    finished,
    toNextLife: Math.max(0, STREAK_FOR_LIFE - progress.streak),
  };
}

/**
 * Слова для сессии: самые трудные по статистике.
 * Если играли мало и статистики нет, вернётся короткий список —
 * вызывающий код добирает материал сам.
 */
export function recoveryWordIds(state: SaveState, ts: number, limit = RECOVERY_WORDS): string[] {
  return hardestWords(state, limit, ts);
}

/** Есть ли из чего собрать сессию. */
export function hasRecoveryMaterial(state: SaveState, ts: number): boolean {
  return recoveryWordIds(state, ts, 4).length >= 4;
}
