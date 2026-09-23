/**
 * Проигрыватель сессии заданий: верхняя панель с прогрессом, область
 * мини-игры и полоса обратной связи.
 *
 * Общий для уровня и для режима восстановления — правила у них разные,
 * а экран один и тот же.
 */

import { clear, h, onTap } from '../core/dom';
import { rngFor } from '../core/rng';
import { getState, update } from '../core/store';
import { comboCapFor, hintCost as petHintCost } from '../domain/bonuses';
import { boosterCount } from '../domain/catalog';
import { useBooster } from '../domain/shop';
import { createSession, type Session } from '../game/engine';
import { moduleFor } from '../game/registry';
import type { Attempt, ExerciseContext, ExerciseInstance, ExerciseOutcome } from '../game/types';
import type { Exercise } from '../game/types';
import { button } from '../ui/button';
import { icon } from '../ui/icons';

export interface SessionViewOptions {
  exercises: Exercise[];
  /** Ключ для детерминированных перемешиваний внутри заданий. */
  seedKey: string;
  /** Идентификатор для движка (для уровня — его id). */
  sessionId: string;
  /** Показывать счётчик серии верных ответов. */
  showCombo?: boolean;
  /** Вызывается после каждой записанной попытки. */
  onAttempt?: (attempt: Attempt, session: Session) => void;
  /**
   * Вызывается после попытки. true — оборвать сессию, не доигрывая:
   * так уровень заканчивается, когда кончились жизни.
   */
  stopAfterAttempt?: (attempt: Attempt, session: Session) => boolean;
  /** Сессия закончилась: либо задания кончились, либо её оборвали. */
  onDone: (session: Session, reason: 'complete' | 'stopped') => void;
  /** Нажат крестик. Подтверждение — на стороне вызывающего. */
  onExit: () => void;
  /** Свой блок справа в верхней панели — например, сердечки. */
  headerSlot?: HTMLElement | null;
}

export interface SessionView {
  el: HTMLElement;
  session: Session;
  start: () => void;
  destroy: () => void;
}

const PRAISE = ['Верно!', 'Отлично!', 'Точно!', 'Так и есть!', 'Молодец!'];

export function createSessionView(opts: SessionViewOptions): SessionView {
  // потолок бонуса серии поднимает дерево — касается любой сессии, не только уровня
  const session = createSession({
    sessionId: opts.sessionId,
    exercises: opts.exercises,
    comboCap: comboCapFor(getState()),
  });

  let instance: ExerciseInstance | null = null;
  let awaitingContinue = false;
  let stopRequested = false;
  let praiseIndex = 0;

  const barFill = h('span', { class: 'level__bar-fill' });
  const comboBadge = h('div', { class: 'level__combo' });
  const closeBtn = h(
    'button',
    { class: 'level__close', attr: { type: 'button' }, aria: { label: 'Выйти' } },
    icon('close'),
  );
  onTap(closeBtn, () => opts.onExit());

  const titleEl = h('div', { class: 'level__task' });
  const host = h('div', { class: 'level__host' });

  const feedbackTitle = h('div', { class: 'feedback__title' });
  const feedbackText = h('div', { class: 'feedback__text' });
  const feedbackWhy = h('div', { class: 'feedback__why' });
  const feedbackIcon = h('div', { class: 'feedback__icon' });
  const continueBtn = button({ label: 'Продолжить', tone: 'green', size: 'big', wide: true });
  const feedback = h(
    'div',
    { class: 'feedback' },
    h(
      'div',
      { class: 'feedback__row' },
      feedbackIcon,
      h('div', { class: 'grow' }, feedbackTitle, feedbackText),
    ),
    feedbackWhy,
    continueBtn,
  );

  const el = h(
    'div',
    { class: 'screen screen--level' },
    h(
      'header',
      { class: 'level__top' },
      closeBtn,
      h('div', { class: 'level__bar' }, barFill),
      opts.showCombo === false ? null : comboBadge,
      opts.headerSlot ?? null,
    ),
    titleEl,
    host,
    feedback,
  );

  /* ——————————————————————— контекст мини-игры ——————————————————————— */

  function makeContext(index: number): ExerciseContext {
    return {
      attempt: (attempt) => {
        session.attempt(attempt);
        renderCombo();
        opts.onAttempt?.(attempt, session);
        if (opts.stopAfterAttempt?.(attempt, session)) stopRequested = true;
      },
      finish: (outcome) => showFeedback(outcome),
      spend: (cost) => spendForHint(cost),
      useItem: (itemId) => {
        let ok = false;
        update((s) => {
          ok = useBooster(s, itemId);
        });
        return ok;
      },
      itemCount: (itemId) => boosterCount(getState(), itemId),
      coins: () => getState().wallet.coins,
      rng: rngFor(opts.seedKey + ':' + index),
      settings: { showHints: getState().settings.showHints },
    };
  }

  /** Подсказка сначала берётся из купленных, потом за монеты со скидкой питомца. */
  function spendForHint(baseCost: number): boolean {
    const state = getState();
    if (useBooster(state, 'hint')) {
      update(() => {});
      return true;
    }
    const cost = petHintCost(state, baseCost);
    if (state.wallet.coins < cost) return false;
    update((s) => {
      s.wallet.coins = Math.max(0, s.wallet.coins - cost);
    });
    return true;
  }

  /* ——————————————————————— показ задания ——————————————————————— */

  function mountCurrent(): void {
    const exercise = session.current();
    if (!exercise) {
      opts.onDone(session, 'complete');
      return;
    }
    const mod = moduleFor(exercise.kind);
    if (!mod) {
      // неизвестный тип не должен ломать сессию — просто пропускаем
      if (session.advance()) mountCurrent();
      else opts.onDone(session, 'complete');
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
    if (opts.showCombo === false) return;
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
      praiseIndex = (praiseIndex + 1) % PRAISE.length;
      feedbackTitle.textContent = outcome.message ?? (PRAISE[praiseIndex] as string);
      feedbackText.textContent =
        outcome.lenient && outcome.expected ? 'Правильно пишется: ' + outcome.expected : '';
    } else {
      feedbackTitle.textContent = outcome.message ?? 'Не угадал';
      feedbackText.textContent = outcome.expected ? 'Правильно: ' + outcome.expected : '';
    }
    feedbackText.classList.toggle('hidden', feedbackText.textContent === '');

    /*
     * Разбор показываем только при ошибке. На верном ответе он лишний:
     * человек и так справился, а лишний текст удлиняет урок. Ошибка же —
     * самый учебный момент, и оставлять его без объяснения жалко.
     */
    feedbackWhy.textContent = !outcome.correct && outcome.explain ? outcome.explain : '';
    feedbackWhy.classList.toggle('hidden', feedbackWhy.textContent === '');

    continueBtn.classList.remove('t-green', 't-red');
    continueBtn.classList.add(outcome.correct ? 't-green' : 't-red');
  }

  onTap(continueBtn, () => {
    if (!awaitingContinue) return;
    awaitingContinue = false;
    if (stopRequested) {
      renderProgress();
      opts.onDone(session, 'stopped');
      return;
    }
    if (session.advance()) mountCurrent();
    else {
      renderProgress();
      opts.onDone(session, 'complete');
    }
  });

  return {
    el,
    session,
    start: () => {
      if (!instance) mountCurrent();
    },
    destroy: () => {
      instance?.destroy?.();
      instance = null;
    },
  };
}
