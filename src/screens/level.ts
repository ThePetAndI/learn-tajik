/**
 * Экран уровня. Сам проигрыватель заданий живёт в session-view,
 * здесь — правила уровня: жизни, награды, запись прогресса и статистики слов.
 */

import { h } from '../core/dom';
import { haptics } from '../core/haptics';
import { pop, replaceTop, type ScreenView } from '../core/router';
import { getState, update } from '../core/store';
import { now } from '../core/time';
import { levels, type FlatLevel } from '../data/content';
import { coinsForLevel } from '../domain/economy';
import { currentMeal } from '../domain/foods';
import { computeLives, spendLife } from '../domain/lives';
import { consumeMeal } from '../domain/meals';
import { awardSectionIfDone, getLevelProgress, recordLevelResult } from '../domain/progress';
import { answerCoinsFor, applyCoinBonus, levelCoinMultiplier, shieldFor } from '../domain/bonuses';
import { recordAttemptWords } from '../domain/srs';
import { countDailyExercise, touchStreak } from '../domain/streak';
import { buildLevelExercises } from '../game/generators';
import { poolForLevel } from '../game/level-pool';
import { moduleFor } from '../game/registry';
import { icon } from '../ui/icons';
import { confirmModal } from '../ui/modal';
import { toast } from '../ui/toast';
import { createResultsScreen, type ResultsExtra } from './results';
import { createSessionView } from './session-view';

export function createLevelScreen(level: FlatLevel): ScreenView {
  const attemptNo = getLevelProgress(getState(), level.id).attempts;
  const pool = poolForLevel(level);
  const exercises = buildLevelExercises(pool, level.id + ':' + attemptNo).filter((ex) =>
    moduleFor(ex.kind),
  );

  /* ——————————————————— сердечки в шапке ——————————————————— */

  /*
   * Щит из дерева: столько ошибок за уровень не стоят жизни. Звезду ошибка
   * всё равно снимает — щит бережёт запас жизней, а не делает ошибку невидимой.
   */
  let shields = shieldFor(getState());

  const hearts = h('div', { class: 'level__hearts' });
  function renderHearts(): void {
    const lives = computeLives(getState().lives, now());
    hearts.replaceChildren();
    // щиты стоят перед сердечками: сначала удар примут они
    if (shields > 0) {
      hearts.append(
        h('span', { class: 'level__shield' }, icon('shield'), h('span', { text: String(shields) })),
      );
    }
    for (let i = 0; i < lives.max; i++) {
      const on = i < lives.count;
      const heart = h('span', { class: 'level__heart ' + (on ? 'is-on' : 'is-off') },
        icon(on ? 'heart' : 'heartEmpty'));
      hearts.append(heart);
    }
  }
  renderHearts();

  let outOfLives = false;
  /** Объяснили ли уже, почему ошибка не стоила жизни. Один раз за урок — дальше это шум. */
  let explainedFreeMistake = false;

  /*
   * Первое знакомство не наказывается. Ошибка на слове, фразе или разговоре,
   * которые игрок увидел впервые на этом же уровне, жизнь не отнимает: нельзя
   * штрафовать за то, чего человек не знал пять минут назад. Звезду она всё
   * равно снимает, а задание вернётся в конце урока — так слово и запоминается.
   *
   * Раньше каждая ошибка стоила жизнь, и новичок терял все пять в первом же
   * уроке, где почти всё было новым.
   */
  function firstMeeting(attemptWords: readonly string[]): boolean {
    if (attemptWords.some((id) => pool.freshWords.has(id))) return true;
    const ex = view.session.current();
    if ((ex?.kind === 'build_phrase' || ex?.kind === 'type_phrase') && ex.phraseId) {
      return !pool.seenPhrases.has('p:' + ex.phraseId);
    }
    if (ex?.kind === 'dialogue_choice' && ex.dialogueId) {
      return !pool.seenPhrases.has('d:' + ex.dialogueId);
    }
    return false;
  }

  /*
   * Лаъл приходит из разных мест: слово дошло до последней коробки прямо
   * посреди уровня, серия взяла веху на первом ответе дня. Считать каждое
   * по отдельности — значит протащить счётчик через все модули. Проще
   * снять показание в начале и сравнить в конце: так ничего не потеряется.
   */
  const gemsAtStart = getState().stats.gemsEarned;

  const view = createSessionView({
    exercises,
    sessionId: level.id,
    seedKey: level.id + ':' + attemptNo,
    headerSlot: hearts,
    // три задания с ошибкой вернутся в конце урока: верный ответ закрепляется сразу
    retryMistakes: 3,

    onAttempt: (attempt) => {
      const ts = now();
      let shielded = false;
      // повтор в конце урока — тренировка, а новое — знакомство: ни то ни другое не штрафуется
      const free = !attempt.correct && (view.session.isRetry() || firstMeeting(attempt.wordIds));
      update((s) => {
        recordAttemptWords(s, attempt.wordIds, attempt.correct, ts);
        countDailyExercise(s, ts);
        touchStreak(s, ts);
        if (!attempt.correct && !free) {
          if (shields > 0) {
            shields--;
            shielded = true;
          } else {
            if (!spendLife(s, ts)) outOfLives = true;
            if (computeLives(s.lives, ts).count <= 0) outOfLives = true;
          }
        }
      });
      renderHearts();
      if (free && !explainedFreeMistake && !view.session.isRetry()) {
        explainedFreeMistake = true;
        toast({ text: 'Это новое — жизнь не тратится. Повторим в конце урока', iconName: 'heart', ms: 2600 });
      } else if (shielded) {
        toast({
          text: shields > 0 ? 'Щит принял удар — жизнь цела' : 'Щит принял удар — больше щитов нет',
          iconName: 'shield',
          ms: 1800,
        });
      } else if (!attempt.correct && !free) {
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
    const gems = { total: 0, perfect: 0, section: 0 };
    let meal: ResultsExtra['meal'];

    update((s) => {
      answerCoins = answerCoinsFor(s, result.coinsFromAnswers, result.correct);

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
        gems.perfect = outcome.gems;
        gems.section = awardSectionIfDone(s, levels, level.sectionId, ts);
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
      gems.total = s.stats.gemsEarned - gemsAtStart;

      // угощение доедается последним: его бонус уже вошёл в награду за этот урок
      const eating = currentMeal(s);
      if (!failed && eating) {
        const done = consumeMeal(s, ts) !== null;
        meal = { food: eating.food, left: done ? 0 : eating.left - 1 };
      }
    });

    if (failed) haptics.fail();
    else haptics.levelUp();

    replaceTop(
      () =>
        createResultsScreen(level, { ...result, coinsFromAnswers: answerCoins }, {
          levelCoins,
          firstClear,
          failed,
          gems,
          meal,
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
