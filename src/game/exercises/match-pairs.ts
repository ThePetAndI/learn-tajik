/** Найди пары: столбец таджикских слов и столбец переводов. */

import { h, onTap } from '../../core/dom';
import { haptics } from '../../core/haptics';
import { shuffle } from '../../core/rng';
import type {
  ExerciseContext,
  ExerciseInstance,
  ExerciseModule,
  MatchPairsExercise,
} from '../types';

interface Cell {
  el: HTMLButtonElement;
  wordId: string;
  side: 'tg' | 'ru';
  matched: boolean;
}

export const matchPairsModule: ExerciseModule<MatchPairsExercise> = {
  title: () => 'Найди пары',

  mount(ex: MatchPairsExercise, ctx: ExerciseContext): ExerciseInstance {
    let selected: Cell | null = null;
    let matchedCount = 0;
    let mistakes = 0;
    let busy = false;
    const timers: number[] = [];

    const makeCell = (wordId: string, text: string, side: 'tg' | 'ru'): Cell => {
      const el = h('button', {
        class: 'pair' + (side === 'tg' ? ' pair--tg' : ''),
        attr: { type: 'button' },
        text,
      });
      const cell: Cell = { el, wordId, side, matched: false };
      onTap(el, () => pick(cell));
      return cell;
    };

    // Столбцы перемешиваются независимо, иначе пары стояли бы напротив друг друга
    const left = shuffle(ctx.rng, ex.pairs).map((p) => makeCell(p.wordId, p.tg, 'tg'));
    const right = shuffle(ctx.rng, ex.pairs).map((p) => makeCell(p.wordId, p.ru, 'ru'));

    function pick(cell: Cell): void {
      if (busy || cell.matched) return;

      if (selected === cell) {
        cell.el.classList.remove('is-picked');
        selected = null;
        return;
      }

      if (!selected || selected.side === cell.side) {
        selected?.el.classList.remove('is-picked');
        selected = cell;
        cell.el.classList.add('is-picked');
        haptics.tap();
        return;
      }

      const first = selected;
      selected = null;

      if (first.wordId === cell.wordId) {
        matchedCount++;
        first.matched = true;
        cell.matched = true;
        for (const c of [first, cell]) {
          c.el.classList.remove('is-picked');
          c.el.classList.add('is-matched');
          c.el.disabled = true;
        }
        haptics.correct();
        ctx.attempt({ correct: true, wordIds: [cell.wordId] });

        if (matchedCount === ex.pairs.length) {
          ctx.finish({
            correct: mistakes === 0,
            message:
              mistakes === 0
                ? 'Все пары верны!'
                : 'Пары собраны, ошибок: ' + mistakes,
          });
        }
        return;
      }

      mistakes++;
      haptics.wrong();
      ctx.attempt({ correct: false, wordIds: [first.wordId, cell.wordId] });
      busy = true;
      first.el.classList.add('is-bad');
      cell.el.classList.add('is-bad');
      const timer = window.setTimeout(() => {
        first.el.classList.remove('is-bad', 'is-picked');
        cell.el.classList.remove('is-bad', 'is-picked');
        busy = false;
      }, 520);
      timers.push(timer);
    }

    const el = h(
      'div',
      { class: 'ex ex--pairs' },
      h(
        'div',
        { class: 'pairs__grid' },
        h('div', { class: 'pairs__col' }, ...left.map((c) => c.el)),
        h('div', { class: 'pairs__col' }, ...right.map((c) => c.el)),
      ),
    );

    return {
      el,
      destroy: () => {
        for (const t of timers) clearTimeout(t);
      },
    };
  },
};
