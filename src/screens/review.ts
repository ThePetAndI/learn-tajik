/**
 * Сессия повторения: уровень-повторение на карте и «Повторить ошибки»
 * из раздела «Слова».
 *
 * Отличия от обычного уровня: жизни не тратятся и звёзды не начисляются.
 * Повторение — тренировка, а не испытание; если за него отнимать жизни,
 * возвращаться к старым словам станет невыгодно.
 */

import { h } from '../core/dom';
import { haptics } from '../core/haptics';
import { pop, push, replaceTop, type ScreenView } from '../core/router';
import { getState, update } from '../core/store';
import { now, plural } from '../core/time';
import { allPhrases, allWords, getWord, type Phrase, type Word } from '../data/content';
import { applyCoinBonus, coinMultiplier } from '../domain/shop';
import { recordAttemptWords, reviewSelection } from '../domain/srs';
import { countDailyExercise, touchStreak } from '../domain/streak';
import { buildLevelExercises } from '../game/generators';
import { poolForWords } from '../game/level-pool';
import { moduleFor } from '../game/registry';
import type { Exercise } from '../game/types';
import { button } from '../ui/button';
import { icon } from '../ui/icons';
import { confirmModal } from '../ui/modal';
import { toast } from '../ui/toast';
import { createSessionView } from './session-view';

/** Сколько заданий в одной сессии повторения. */
export const REVIEW_SIZE = 12;
/** Сколько слов берём в работу. */
export const REVIEW_WORDS = 10;
/**
 * Доля монет от обычной ставки.
 * Повторение можно запускать сколько угодно раз и оно не тратит жизни —
 * по полной ставке оно приносило бы больше уровня, и выгоднее было бы
 * не проходить карту, а крутить одно и то же. Награда повторения — память.
 */
export const REVIEW_COIN_RATE = 0.5;

export function reviewCoins(answerCoins: number): number {
  return Math.max(1, Math.round(answerCoins * REVIEW_COIN_RATE));
}

export interface ReviewOptions {
  title: string;
  /** Подпись под заголовком на экране итога. */
  subtitle?: string;
  sessionId: string;
  /** Из каких слов выбирать. Пустой список — берём весь словарь. */
  candidates: readonly string[];
}

export function openReviewSession(opts: ReviewOptions): void {
  push(() => createReviewScreen(opts), 'review:' + opts.sessionId);
}

function collectPhrases(words: readonly Word[]): Phrase[] {
  const ids = new Set(words.map((w) => w.id));
  return allPhrases()
    .filter((p) => (p.words ?? []).some((id) => ids.has(id)))
    .slice(0, 6);
}

function buildReviewExercises(words: Word[], phrases: Phrase[], seed: string): Exercise[] {
  const pool = poolForWords(words, phrases);
  const out: Exercise[] = [];
  for (let batch = 0; batch < 3 && out.length < REVIEW_SIZE; batch++) {
    out.push(...buildLevelExercises(pool, seed + ':' + batch).filter((ex) => moduleFor(ex.kind)));
  }
  return out.slice(0, REVIEW_SIZE);
}

export function createReviewScreen(opts: ReviewOptions): ScreenView {
  const ts = now();
  const candidates =
    opts.candidates.length > 0 ? opts.candidates : allWords().map((w) => w.id);
  const wordIds = reviewSelection(getState(), candidates, REVIEW_WORDS, ts);
  const words = wordIds.map(getWord).filter((w): w is Word => Boolean(w));
  const phrases = collectPhrases(words);
  const seed = opts.sessionId + ':' + ts;
  const exercises = buildReviewExercises(words, phrases, seed);

  const badge = h(
    'div',
    { class: 'review__badge' },
    icon('refresh'),
    h('span', { text: 'повторение' }),
  );

  const view = createSessionView({
    exercises,
    sessionId: opts.sessionId,
    seedKey: seed,
    headerSlot: badge,

    onAttempt: (attempt) => {
      const at = now();
      update((s) => {
        recordAttemptWords(s, attempt.wordIds, attempt.correct, at);
        countDailyExercise(s, at);
        touchStreak(s, at);
      });
    },

    onDone: (session) => {
      const result = session.result();
      view.destroy();
      let coins = result.coinsFromAnswers;
      update((s) => {
        coins = applyCoinBonus(reviewCoins(result.coinsFromAnswers), coinMultiplier(s));
        s.wallet.coins += coins;
        s.stats.coinsEarned += coins;
        s.stats.answers += result.attempts;
        s.stats.correct += result.correct;
      });
      haptics.levelUp();
      replaceTop(
        () =>
          createReviewDoneScreen({
            title: opts.title,
            words: words.length,
            correct: result.correct,
            attempts: result.attempts,
            coins,
          }),
        'review-done',
      );
    },

    onExit: () => {
      if (view.session.state.attempts === 0) {
        pop();
        return;
      }
      void confirmModal(
        'Прервать повторение?',
        'Слова, которые уже повторили, останутся засчитанными.',
        'Выйти',
        'red',
      ).then((ok) => {
        if (ok) pop();
      });
    },
  });

  return {
    el: view.el,
    onShow: () => {
      if (exercises.length === 0) {
        toast({ text: 'Пока нечего повторять — пройди несколько уровней', iconName: 'bulb' });
        pop();
        return;
      }
      view.start();
    },
    destroy: () => view.destroy(),
  };
}

/* ——————————————————— экран итога ——————————————————— */

interface ReviewDone {
  title: string;
  words: number;
  correct: number;
  attempts: number;
  coins: number;
}

export function createReviewDoneScreen(done: ReviewDone): ScreenView {
  const accuracy = done.attempts > 0 ? Math.round((done.correct / done.attempts) * 100) : 0;
  const el = h(
    'div',
    { class: 'screen screen--results screen--review-done' },
    h(
      'div',
      { class: 'results__body' },
      h('div', { class: 'results__section', text: done.title }),
      h('h1', { class: 'h1 results__title', text: 'Повторение закончено' }),
      h('div', { class: 'review__done-icon' }, icon('refresh')),
      h(
        'div',
        { class: 'results__coins' },
        icon('coin'),
        h('span', { text: '+' + done.coins }),
      ),
      h(
        'div',
        { class: 'results__stats' },
        h(
          'div',
          { class: 'results__stat' },
          h('span', { class: 'results__stat-icon' }, icon('book')),
          h('span', { class: 'results__stat-label', text: 'Повторено слов' }),
          h('span', {
            class: 'results__stat-value',
            text: done.words + ' ' + plural(done.words, 'слово', 'слова', 'слов'),
          }),
        ),
        h(
          'div',
          { class: 'results__stat' },
          h('span', { class: 'results__stat-icon' }, icon('target')),
          h('span', { class: 'results__stat-label', text: 'Точность' }),
          h('span', { class: 'results__stat-value', text: accuracy + '%' }),
        ),
        h(
          'div',
          { class: 'results__stat' },
          h('span', { class: 'results__stat-icon' }, icon('check')),
          h('span', { class: 'results__stat-label', text: 'Верных ответов' }),
          h('span', { class: 'results__stat-value', text: done.correct + ' из ' + done.attempts }),
        ),
      ),
      h('p', {
        class: 'p results__note',
        text: 'Слова, в которых ошиблись, вернутся в повторение скоро. Те, что ответили верно, — через несколько дней.',
      }),
    ),
    h(
      'div',
      { class: 'results__actions' },
      button({ label: 'Готово', tone: 'orange', size: 'big', wide: true, onTap: () => pop() }),
    ),
  );
  return { el };
}
