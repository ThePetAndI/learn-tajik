/**
 * Экран уровня: очередь заданий, полоса прогресса, обратная связь после
 * каждого задания. Сам не знает, как устроены мини-игры — берёт их из реестра.
 */

import { clear, h, onTap } from '../core/dom';
import { haptics } from '../core/haptics';
import { pop, replaceTop, type ScreenView } from '../core/router';
import { rngFor } from '../core/rng';
import { getState, update } from '../core/store';
import { now } from '../core/time';
import { allWords, getPhrase, getWord, type FlatLevel } from '../data/content';
import { coinsForLevel } from '../domain/economy';
import { getLevelProgress, recordLevelResult } from '../domain/progress';
import { createSession, type SessionResult } from '../game/engine';
import { buildLevelExercises, makePool } from '../game/generators';
import { moduleFor } from '../game/registry';
import type { ExerciseContext, ExerciseInstance, ExerciseOutcome } from '../game/types';
import { button } from '../ui/button';
import { icon } from '../ui/icons';
import { confirmModal } from '../ui/modal';
import { toast } from '../ui/toast';
import { createResultsScreen } from './results';

export function createLevelScreen(level: FlatLevel): ScreenView {
  const attemptNo = getLevelProgress(getState(), level.id).attempts;
  const pool = makePool(
    level.wordIds.map(getWord).filter((w): w is NonNullable<typeof w> => Boolean(w)),
    level.phraseIds.map(getPhrase).filter((p): p is NonNullable<typeof p> => Boolean(p)),
    allWords(),
  );
  const exercises = buildLevelExercises(pool, level.id + ':' + attemptNo).filter((ex) =>
    moduleFor(ex.kind),
  );

  const session = createSession({ levelId: level.id, exercises });

  /* ——————————————————————— каркас экрана ——————————————————————— */

  const barFill = h('span', { class: 'level__bar-fill' });
  const comboBadge = h('div', { class: 'level__combo' });
  const closeBtn = h(
    'button',
    { class: 'level__close', attr: { type: 'button' }, aria: { label: 'Выйти с уровня' } },
    icon('close'),
  );

  const titleEl = h('div', { class: 'level__task' });
  const host = h('div', { class: 'level__host' });

  const feedbackTitle = h('div', { class: 'feedback__title' });
  const feedbackText = h('div', { class: 'feedback__text' });
  const feedbackIcon = h('div', { class: 'feedback__icon' });
  const continueBtn = button({ label: 'Продолжить', tone: 'green', size: 'big', wide: true });
  const feedback = h(
    'div',
    { class: 'feedback' },
    h('div', { class: 'feedback__row' }, feedbackIcon, h('div', { class: 'grow' }, feedbackTitle, feedbackText)),
    continueBtn,
  );

  const el = h(
    'div',
    { class: 'screen screen--level' },
    h('header', { class: 'level__top' }, closeBtn, h('div', { class: 'level__bar' }, barFill), comboBadge),
    titleEl,
    host,
    feedback,
  );

  let instance: ExerciseInstance | null = null;
  let awaitingContinue = false;

  /* ——————————————————————— контекст мини-игры ——————————————————————— */

  function makeContext(index: number): ExerciseContext {
    return {
      attempt: (attempt) => {
        session.attempt(attempt);
        renderCombo();
      },
      finish: (outcome) => showFeedback(outcome),
      spend: (cost) => {
        if (getState().wallet.coins < cost) return false;
        update((s) => {
          s.wallet.coins = Math.max(0, s.wallet.coins - cost);
        });
        return true;
      },
      coins: () => getState().wallet.coins,
      rng: rngFor(level.id + ':' + attemptNo + ':' + index),
      settings: { showHints: getState().settings.showHints },
    };
  }

  /* ——————————————————————— показ задания ——————————————————————— */

  function mountCurrent(): void {
    const exercise = session.current();
    if (!exercise) {
      finishLevel();
      return;
    }
    const mod = moduleFor(exercise.kind);
    if (!mod) {
      // тип задания появится позже — просто пропускаем, не ломая уровень
      if (!session.advance()) finishLevel();
      else mountCurrent();
      return;
    }

    instance?.destroy?.();
    clear(host);
    awaitingContinue = false;
    feedback.classList.remove('is-shown', 'is-right', 'is-wrong');

    titleEl.textContent = mod.title(exercise);
    instance = mod.mount(exercise, makeContext(session.state.index));
    instance.el.classList.add('ex--enter');
    host.append(instance.el);
    host.scrollTop = 0;
    renderProgress();
  }

  function renderProgress(): void {
    barFill.style.transform = 'scaleX(' + session.progress() + ')';
  }

  function renderCombo(): void {
    const combo = session.state.combo;
    comboBadge.classList.toggle('is-on', combo >= 3);
    if (combo >= 3) {
      comboBadge.textContent = '×' + combo;
      comboBadge.classList.remove('is-pop');
      void comboBadge.offsetWidth;
      comboBadge.classList.add('is-pop');
    }
  }

  function showFeedback(outcome: ExerciseOutcome): void {
    awaitingContinue = true;
    clear(feedbackIcon);
    feedbackIcon.append(icon(outcome.correct ? 'check' : 'cross'));
    feedback.classList.add('is-shown', outcome.correct ? 'is-right' : 'is-wrong');

    if (outcome.correct) {
      feedbackTitle.textContent = outcome.message ?? pickPraise();
      feedbackText.textContent = outcome.lenient && outcome.expected
        ? 'Правильно пишется: ' + outcome.expected
        : '';
    } else {
      feedbackTitle.textContent = outcome.message ?? 'Не угадал';
      feedbackText.textContent = outcome.expected ? 'Правильно: ' + outcome.expected : '';
    }
    feedbackText.classList.toggle('hidden', feedbackText.textContent === '');
    continueBtn.className = continueBtn.className
      .replace(/\bt-(green|red)\b/g, '')
      .trim() + (outcome.correct ? ' t-green' : ' t-red');
  }

  const PRAISE = ['Верно!', 'Отлично!', 'Точно!', 'Так и есть!', 'Молодец!'];
  let praiseIndex = 0;
  function pickPraise(): string {
    praiseIndex = (praiseIndex + 1) % PRAISE.length;
    return PRAISE[praiseIndex] as string;
  }

  onTap(continueBtn, () => {
    if (!awaitingContinue) return;
    awaitingContinue = false;
    if (session.advance()) mountCurrent();
    else finishLevel();
  });

  /* ——————————————————————— завершение ——————————————————————— */

  function finishLevel(): void {
    const result = session.result();
    renderProgress();
    instance?.destroy?.();
    instance = null;

    let levelCoins = 0;
    let firstClear = false;
    update((s) => {
      const outcome = recordLevelResult(
        s,
        level.id,
        result.correct,
        result.attempts,
        result.mistakes,
        now(),
      );
      firstClear = outcome.firstClear;
      levelCoins = coinsForLevel(outcome.stars, outcome.firstClear);
      const total = result.coinsFromAnswers + levelCoins;
      s.wallet.coins += total;
      s.stats.coinsEarned += total;
      s.stats.answers += result.attempts;
      s.stats.correct += result.correct;
      if (result.bestCombo > s.stats.bestCombo) s.stats.bestCombo = result.bestCombo;
    });

    haptics.levelUp();
    replaceTop(
      () => createResultsScreen(level, result, { levelCoins, firstClear }),
      'results:' + level.id,
    );
  }

  onTap(closeBtn, () => {
    if (session.state.index === 0 && session.state.attempts === 0) {
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
  });

  return {
    el,
    onShow: () => {
      if (exercises.length === 0) {
        toast({ text: 'Для этого уровня пока нет заданий', iconName: 'bulb' });
        pop();
        return;
      }
      if (!instance) mountCurrent();
    },
    destroy: () => {
      instance?.destroy?.();
      instance = null;
    },
  };
}

/** Итог уровня — используется и экраном результатов. */
export type { SessionResult };
