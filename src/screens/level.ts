/**
 * Экран уровня. Сам проигрыватель заданий живёт в session-view,
 * здесь — правила уровня: жизни, награды, запись прогресса и статистики слов.
 */

import { h } from '../core/dom';
import { haptics } from '../core/haptics';
import { pop, replaceTop, type ScreenView } from '../core/router';
import { getState, update } from '../core/store';
import { now } from '../core/time';
import { type FlatLevel } from '../data/content';
import { coinsForLevel } from '../domain/economy';
import { computeLives, spendLife } from '../domain/lives';
import { getLevelProgress, recordLevelResult } from '../domain/progress';
import { applyCoinBonus, coinMultiplier, levelCoinMultiplier } from '../domain/shop';
import { recordAttemptWords } from '../domain/srs';
import { countDailyExercise, touchStreak } from '../domain/streak';
import { buildLevelExercises } from '../game/generators';
import { poolForLevel } from '../game/level-pool';
import { moduleFor } from '../game/registry';
import { icon } from '../ui/icons';
import { confirmModal } from '../ui/modal';
import { toast } from '../ui/toast';
import { createResultsScreen } from './results';
import { createSessionView } from './session-view';

export function createLevelScreen(level: FlatLevel): ScreenView {
  const attemptNo = getLevelProgress(getState(), level.id).attempts;
  const pool = poolForLevel(level);
  const exercises = buildLevelExercises(pool, level.id + ':' + attemptNo).filter((ex) =>
    moduleFor(ex.kind),
  );

  /* ——————————————————— сердечки в шапке ——————————————————— */

  const hearts = h('div', { class: 'level__hearts' });
  function renderHearts(): void {
    const lives = computeLives(getState().lives, now());
    hearts.replaceChildren();
    for (let i = 0; i < lives.max; i++) {
      const on = i < lives.count;
      const heart = h('span', { class: 'level__heart ' + (on ? 'is-on' : 'is-off') },
        icon(on ? 'heart' : 'heartEmpty'));
      hearts.append(heart);
    }
  }
  renderHearts();

  let outOfLives = false;

  const view = createSessionView({
    exercises,
    sessionId: level.id,
    seedKey: level.id + ':' + attemptNo,
    headerSlot: hearts,

    onAttempt: (attempt) => {
      const ts = now();
      update((s) => {
        recordAttemptWords(s, attempt.wordIds, attempt.correct, ts);
        countDailyExercise(s, ts);
        touchStreak(s, ts);
        if (!attempt.correct) {
          if (!spendLife(s, ts)) outOfLives = true;
          if (computeLives(s.lives, ts).count <= 0) outOfLives = true;
        }
      });
      renderHearts();
      if (!attempt.correct) {
        hearts.classList.remove('is-hit');
        void hearts.offsetWidth;
        hearts.classList.add('is-hit');
      }
    },

    stopAfterAttempt: () => outOfLives,

    onDone: (session, reason) => finish(session.result(), reason === 'stopped'),

    onExit: () => {
      const st = view.session.state;
      if (st.index === 0 && st.attempts === 0) {
        pop();
        return;
      }
      void confirmModal(
        'Выйти с уровня?',
        'Прогресс этой попытки не сохранится — уровень придётся начать сначала.',
        'Выйти',
        'red',
      ).then((ok) => {
        if (ok) pop();
      });
    },
  });

  /* ——————————————————— завершение ——————————————————— */

  function finish(result: ReturnType<typeof view.session.result>, failed: boolean): void {
    view.destroy();
    const ts = now();

    let levelCoins = 0;
    let firstClear = false;
    let answerCoins = result.coinsFromAnswers;

    update((s) => {
      const bonus = coinMultiplier(s);
      answerCoins = applyCoinBonus(result.coinsFromAnswers, bonus);

      if (!failed) {
        const outcome = recordLevelResult(
          s,
          level.id,
          result.correct,
          result.attempts,
          result.mistakes,
          ts,
        );
        firstClear = outcome.firstClear;
        // награда за уровень идёт со своим множителем: это бонус лиса,
        // а монеты за ответы — бонус кошки, и складывать их в один нельзя
        levelCoins = applyCoinBonus(
          coinsForLevel(outcome.stars, outcome.firstClear),
          levelCoinMultiplier(s),
        );
      }

      const total = answerCoins + levelCoins;
      s.wallet.coins += total;
      s.stats.coinsEarned += total;
      s.stats.answers += result.attempts;
      s.stats.correct += result.correct;
      if (result.bestCombo > s.stats.bestCombo) s.stats.bestCombo = result.bestCombo;
    });

    if (failed) haptics.fail();
    else haptics.levelUp();

    replaceTop(
      () =>
        createResultsScreen(level, { ...result, coinsFromAnswers: answerCoins }, {
          levelCoins,
          firstClear,
          failed,
        }),
      'results:' + level.id,
    );
  }

  return {
    el: view.el,
    onShow: () => {
      if (exercises.length === 0) {
        toast({ text: 'Для этого уровня пока нет заданий', iconName: 'bulb' });
        pop();
        return;
      }
      renderHearts();
      view.start();
    },
    destroy: () => view.destroy(),
  };
}
