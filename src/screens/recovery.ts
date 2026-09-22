/**
 * Режим «Восстановление»: мини-сессия на самых трудных словах.
 * Восемь верных подряд возвращают жизнь, вся сессия — полный запас.
 */

import { h } from '../core/dom';
import { haptics } from '../core/haptics';
import { pop, push, replaceTop, type ScreenView } from '../core/router';
import { getState, update } from '../core/store';
import { now } from '../core/time';
import { allPhrases, getWord, type Phrase, type Word } from '../data/content';
import { computeLives } from '../domain/lives';
import {
  RECOVERY_SIZE,
  STREAK_FOR_LIFE,
  createRecoveryProgress,
  recordRecoveryAnswer,
  recoveryCoins,
  recoveryWordIds,
} from '../domain/recovery';
import { applyCoinBonus, coinMultiplier } from '../domain/bonuses';
import { recordAttemptWords } from '../domain/srs';
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

/** Открыть экран восстановления поверх текущего. */
export function openRecovery(): void {
  push(createRecoveryScreen, 'recovery');
}

/** Слова сессии: трудные по статистике, при нехватке — добираем знакомыми. */
function collectWords(): Word[] {
  const state = getState();
  const ts = now();
  const ids = recoveryWordIds(state, ts);
  const words = ids.map(getWord).filter((w): w is Word => Boolean(w));
  if (words.length >= 6) return words;

  // играли мало — берём всё, что вообще показывали
  const seen = new Set(words.map((w) => w.id));
  for (const [id, stat] of Object.entries(state.srs)) {
    if (words.length >= 10) break;
    if (seen.has(id) || stat.seen === 0) continue;
    const word = getWord(id);
    if (word) {
      words.push(word);
      seen.add(id);
    }
  }
  return words;
}

function collectPhrases(words: readonly Word[]): Phrase[] {
  const ids = new Set(words.map((w) => w.id));
  return allPhrases().filter((p) => (p.words ?? []).some((id) => ids.has(id))).slice(0, 6);
}

/** Набирает длинную очередь заданий: одного прохода генератора не хватает. */
function buildRecoveryExercises(words: Word[], phrases: Phrase[], seed: string): Exercise[] {
  const pool = poolForWords(words, phrases);
  const out: Exercise[] = [];
  for (let batch = 0; batch < 4 && out.length < RECOVERY_SIZE; batch++) {
    out.push(...buildLevelExercises(pool, seed + ':' + batch).filter((ex) => moduleFor(ex.kind)));
  }
  return out.slice(0, RECOVERY_SIZE);
}

export function createRecoveryScreen(): ScreenView {
  const words = collectWords();
  const phrases = collectPhrases(words);
  const seed = 'recovery:' + now();
  const exercises = buildRecoveryExercises(words, phrases, seed);
  const progress = createRecoveryProgress();

  /* ——————————————————— индикатор в шапке ——————————————————— */

  const livesLabel = h('span', { class: 'recovery__lives-value', text: '0' });
  const toNext = h('span', { class: 'recovery__to-next', text: String(STREAK_FOR_LIFE) });
  const headerSlot = h(
    'div',
    { class: 'recovery__meter' },
    h('span', { class: 'recovery__lives' }, icon('heart'), livesLabel),
    h('span', { class: 'recovery__chain' }, icon('flame'), toNext),
  );

  function renderMeter(step?: { toNextLife: number }): void {
    livesLabel.textContent = '+' + progress.livesGained;
    toNext.textContent = String(step?.toNextLife ?? STREAK_FOR_LIFE - progress.streak);
  }
  renderMeter();

  const view = createSessionView({
    exercises,
    sessionId: 'recovery',
    seedKey: seed,
    showCombo: false,
    headerSlot,

    onAttempt: (attempt) => {
      const ts = now();
      let step: { grantedLife: boolean; toNextLife: number } | null = null;
      update((s) => {
        recordAttemptWords(s, attempt.wordIds, attempt.correct, ts);
        countDailyExercise(s, ts);
        touchStreak(s, ts);
        step = recordRecoveryAnswer(s, progress, attempt.correct, ts);
      });
      renderMeter(step ?? undefined);
      if (step && (step as { grantedLife: boolean }).grantedLife) {
        haptics.reward();
        toast({ text: 'Жизнь восстановлена!', iconName: 'heart', tone: 'good' });
        headerSlot.classList.remove('is-pop');
        void headerSlot.offsetWidth;
        headerSlot.classList.add('is-pop');
      }
    },

    onDone: (session) => finish(session.result().coinsFromAnswers),

    onExit: () => {
      if (progress.answered === 0) {
        pop();
        return;
      }
      void confirmModal(
        'Выйти из восстановления?',
        'Возвращённые жизни останутся, но сессия не будет засчитана целиком.',
        'Выйти',
        'red',
      ).then((ok) => {
        if (ok) pop();
      });
    },
  });

  function finish(answerCoins: number): void {
    view.destroy();
    let coins = answerCoins;
    update((s) => {
      coins = applyCoinBonus(recoveryCoins(answerCoins), coinMultiplier(s));
      s.wallet.coins += coins;
      s.stats.coinsEarned += coins;
      s.stats.answers += progress.answered;
      s.stats.correct += progress.correct;
    });
    haptics.levelUp();
    replaceTop(() => createRecoveryDoneScreen(progress.livesGained, coins), 'recovery-done');
  }

  return {
    el: view.el,
    onShow: () => {
      if (exercises.length === 0) {
        toast({ text: 'Пока нечего повторять — пройди хотя бы один уровень', iconName: 'bulb' });
        pop();
        return;
      }
      view.start();
    },
    destroy: () => view.destroy(),
  };
}

/* ——————————————————— экран после сессии ——————————————————— */

export function createRecoveryDoneScreen(livesGained: number, coins: number): ScreenView {
  const lives = computeLives(getState().lives, now());
  const el = h(
    'div',
    { class: 'screen screen--results screen--recovery-done' },
    h(
      'div',
      { class: 'results__body' },
      h('div', { class: 'results__section', text: 'Восстановление' }),
      h('h1', { class: 'h1 results__title', text: livesGained > 0 ? 'Жизни вернулись!' : 'Сессия окончена' }),
      h(
        'div',
        { class: 'recovery__hearts' },
        ...Array.from({ length: lives.max }, (_, i) =>
          h(
            'span',
            { class: 'recovery__heart ' + (i < lives.count ? 'is-on' : 'is-off') },
            icon(i < lives.count ? 'heart' : 'heartEmpty'),
          ),
        ),
      ),
      h(
        'div',
        { class: 'results__stats' },
        h(
          'div',
          { class: 'results__stat' },
          h('span', { class: 'results__stat-icon' }, icon('heart')),
          h('span', { class: 'results__stat-label', text: 'Возвращено жизней' }),
          h('span', { class: 'results__stat-value', text: '+' + livesGained }),
        ),
        h(
          'div',
          { class: 'results__stat' },
          h('span', { class: 'results__stat-icon' }, icon('coin')),
          h('span', { class: 'results__stat-label', text: 'Монет за ответы' }),
          h('span', { class: 'results__stat-value', text: '+' + coins }),
        ),
      ),
    ),
    h(
      'div',
      { class: 'results__actions' },
      button({ label: 'На карту', tone: 'orange', size: 'big', wide: true, onTap: () => pop() }),
    ),
  );
  return { el };
}
