/**
 * Режим «Восстановление» — главный способ вернуть жизни.
 *
 * Кончились жизни — не сиди и жди таймер, а прогони слова, которые даются
 * хуже всего. Сначала они показываются заново, потом по ним задания. Каждые
 * три верных ответа возвращают жизнь, пройденная целиком сессия — весь запас.
 *
 * Раньше жизнь давали за восемь верных подряд, и первая же ошибка обнуляла
 * счёт. На словах, которые как раз и не даются, это почти невыполнимо:
 * человек, потерявший жизни в первом уроке, застревал и здесь.
 */

import type { SaveState } from '../data/state';
import { addLives, refillLives } from './lives';
import { hardestWords } from './srs';

/** Сколько заданий в сессии восстановления. */
export const RECOVERY_SIZE = 12;
/** Сколько верных ответов — не обязательно подряд — возвращают жизнь. */
export const CORRECT_FOR_LIFE = 3;
/** Сколько слов берём в работу: меньше слов — каждое успевает запомниться. */
export const RECOVERY_WORDS = 6;
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
  /** Верных ответов, накопленных к следующей жизни. Ошибка их не сжигает. */
  toward: number;
  livesGained: number;
  completed: boolean;
}

export function createRecoveryProgress(): RecoveryProgress {
  return { answered: 0, correct: 0, toward: 0, livesGained: 0, completed: false };
}

export interface RecoveryStep {
  /** За этот ответ выдана жизнь. */
  grantedLife: boolean;
  /** Сессия завершена этим ответом. */
  finished: boolean;
  /** Сколько верных ответов осталось до следующей жизни. */
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

  // ошибка ничего не отнимает — ни жизней, ни накопленного: восстановление
  // не должно загонять в тупик того, кто и так застрял
  if (correct) {
    progress.correct += 1;
    progress.toward += 1;
    if (progress.toward >= CORRECT_FOR_LIFE) {
      progress.toward = 0;
      const added = addLives(state, 1, ts);
      if (added > 0) {
        progress.livesGained += added;
        grantedLife = true;
      }
    }
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
    toNextLife: Math.max(0, CORRECT_FOR_LIFE - progress.toward),
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
