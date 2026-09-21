/**
 * Колесо букв. Буквы по кругу, слова собираются свайпом: палец тянет линию
 * от буквы к букве. Сверху ячейки слов с русскими подсказками.
 *
 * Про ошибки: свайп мимо — часть игры, а не ошибка. Первые три промаха
 * бесплатны, дальше считаются: иначе три звезды здесь были бы недостижимы.
 */

import { clear, h, onTap, s } from '../../core/dom';
import { haptics } from '../../core/haptics';
import { shuffle } from '../../core/rng';
import { icon } from '../../ui/icons';
import { toast } from '../../ui/toast';
import type {
  ExerciseContext,
  ExerciseInstance,
  ExerciseModule,
  LetterWheelExercise,
} from '../types';

const LETTER_SIZE = 46;
const PLATE_MAX = 290;
const HIT_RADIUS = 30;
/** Промахи сверх этого числа идут в счёт ошибок. */
const FREE_MISSES = 3;
const HINT_COST = 15;

interface TargetState {
  tg: string;
  ru: string;
  wordId: string;
  found: boolean;
  /** Сколько первых букв открыто подсказкой. */
  revealed: number;
  boxes: HTMLElement[];
  row: HTMLElement;
}

export const letterWheelModule: ExerciseModule<LetterWheelExercise> = {
  title: () => 'Собери слова',

  mount(ex: LetterWheelExercise, ctx: ExerciseContext): ExerciseInstance {
    let letters = [...ex.letters];
    let misses = 0;
    let countedMistakes = 0;
    let hintsUsed = 0;
    let finished = false;

    /* ——————————————— ячейки слов ——————————————— */

    const targets: TargetState[] = ex.targets.map((t) => {
      const boxes: HTMLElement[] = [...t.tg].map(() => h('span', { class: 'wheel-box' }));
      const row = h(
        'div',
        { class: 'wheel-word' },
        h('span', { class: 'wheel-word__ru', text: t.ru }),
        h('span', { class: 'wheel-word__boxes' }, ...boxes),
      );
      return { ...t, found: false, revealed: 0, boxes, row };
    });

    const wordsList = h('div', { class: 'wheel-words' }, ...targets.map((t) => t.row));

    function paintTarget(target: TargetState): void {
      const chars = [...target.tg];
      target.boxes.forEach((box, i) => {
        const show = target.found || i < target.revealed;
        box.textContent = show ? (chars[i] ?? '') : '';
        box.classList.toggle('is-filled', show);
        box.classList.toggle('is-hint', !target.found && i < target.revealed);
      });
      target.row.classList.toggle('is-found', target.found);
    }

    /* ——————————————— колесо ——————————————— */

    const current = h('div', { class: 'wheel__current' });
    const plate = h('div', { class: 'wheel__plate' });
    const line = s('svg', { class: 'wheel__line', viewBox: '0 0 100 100', preserveAspectRatio: 'none' });
    const poly = s('polyline', { class: 'wheel__stroke', points: '' });
    line.append(poly);
    plate.append(line);

    let letterEls: HTMLElement[] = [];
    let plateSize = PLATE_MAX;

    function layoutWheel(): void {
      clear(plate);
      plate.append(line);
      letterEls = [];
      const radius = plateSize / 2 - LETTER_SIZE / 2 - 8;
      const step = (Math.PI * 2) / letters.length;
      letters.forEach((ch, i) => {
        const angle = -Math.PI / 2 + i * step;
        const x = plateSize / 2 + radius * Math.cos(angle);
        const y = plateSize / 2 + radius * Math.sin(angle);
        const el = h('span', {
          class: 'wheel__letter',
          text: ch,
          data: { index: i },
          style: {
            left: x + 'px',
            top: y + 'px',
            width: LETTER_SIZE + 'px',
            height: LETTER_SIZE + 'px',
          },
        });
        letterEls.push(el);
        plate.append(el);
      });
      line.setAttribute('viewBox', '0 0 ' + plateSize + ' ' + plateSize);
    }

    function setPlateSize(width: number): void {
      plateSize = Math.max(200, Math.min(PLATE_MAX, width - 40));
      plate.style.width = plateSize + 'px';
      plate.style.height = plateSize + 'px';
      layoutWheel();
    }

    /* ——————————————— свайп ——————————————— */

    const picked: number[] = [];

    function centerOf(index: number): { x: number; y: number } {
      const el = letterEls[index];
      if (!el) return { x: 0, y: 0 };
      return { x: parseFloat(el.style.left), y: parseFloat(el.style.top) };
    }

    function drawLine(tip?: { x: number; y: number }): void {
      const pts = picked.map(centerOf);
      if (tip) pts.push(tip);
      poly.setAttribute('points', pts.map((p) => p.x + ',' + p.y).join(' '));
      current.textContent = picked.map((i) => letters[i] ?? '').join('');
      current.classList.toggle('is-on', picked.length > 0);
    }

    function localPoint(ev: PointerEvent): { x: number; y: number } {
      const rect = plate.getBoundingClientRect();
      return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    }

    function hitTest(p: { x: number; y: number }): number {
      for (let i = 0; i < letterEls.length; i++) {
        const c = centerOf(i);
        if (Math.hypot(p.x - c.x, p.y - c.y) <= HIT_RADIUS) return i;
      }
      return -1;
    }

    function addLetter(index: number): void {
      if (index < 0) return;
      const last = picked[picked.length - 1];
      if (index === last) return;
      // шаг назад по линии — обычный жест исправления
      if (picked.length >= 2 && index === picked[picked.length - 2]) {
        const removed = picked.pop();
        if (removed !== undefined) letterEls[removed]?.classList.remove('is-picked');
        return;
      }
      if (picked.includes(index)) return;
      picked.push(index);
      letterEls[index]?.classList.add('is-picked');
      haptics.tap();
    }

    let dragging = false;

    const onDown = (ev: PointerEvent): void => {
      if (finished) return;
      dragging = true;
      plate.setPointerCapture?.(ev.pointerId);
      picked.length = 0;
      for (const el of letterEls) el.classList.remove('is-picked');
      const p = localPoint(ev);
      addLetter(hitTest(p));
      drawLine(p);
    };

    const onMove = (ev: PointerEvent): void => {
      if (!dragging || finished) return;
      ev.preventDefault();
      const p = localPoint(ev);
      addLetter(hitTest(p));
      drawLine(p);
    };

    const onUp = (): void => {
      if (!dragging) return;
      dragging = false;
      submitWord();
      picked.length = 0;
      for (const el of letterEls) el.classList.remove('is-picked');
      drawLine();
    };

    plate.addEventListener('pointerdown', onDown);
    plate.addEventListener('pointermove', onMove);
    plate.addEventListener('pointerup', onUp);
    plate.addEventListener('pointercancel', onUp);

    /* ——————————————— проверка слова ——————————————— */

    function submitWord(): void {
      const word = picked.map((i) => letters[i] ?? '').join('');
      if (word.length < 2) return;

      const target = targets.find((t) => t.tg === word);
      if (target && !target.found) {
        target.found = true;
        paintTarget(target);
        target.row.classList.remove('is-pop');
        void target.row.offsetWidth;
        target.row.classList.add('is-pop');
        haptics.correct();
        ctx.attempt({ correct: true, wordIds: [target.wordId] });
        checkComplete();
        return;
      }

      if (target?.found) {
        flashCurrent('is-known');
        return;
      }

      misses++;
      flashCurrent('is-bad');
      haptics.wrong();
      if (misses > FREE_MISSES) {
        countedMistakes++;
        ctx.attempt({ correct: false, wordIds: ex.wordIds });
      }
    }

    function flashCurrent(cls: string): void {
      current.classList.add(cls);
      window.setTimeout(() => current.classList.remove(cls), 420);
    }

    function checkComplete(): void {
      if (targets.some((t) => !t.found)) return;
      finished = true;
      const clean = countedMistakes === 0 && hintsUsed === 0;
      ctx.finish({
        correct: clean,
        message: clean
          ? 'Все слова собраны!'
          : 'Слова собраны' + (hintsUsed > 0 ? ', подсказок: ' + hintsUsed : ''),
      });
    }

    /* ——————————————— кнопки ——————————————— */

    const shuffleBtn = h(
      'button',
      { class: 'wheel__tool', attr: { type: 'button' }, aria: { label: 'Перемешать буквы' } },
      icon('shuffle'),
    );
    onTap(shuffleBtn, () => {
      if (finished) return;
      letters = shuffle(ctx.rng, letters);
      layoutWheel();
      drawLine();
      haptics.tap();
    });

    const hintCost = h('span', { class: 'wheel__tool-cost', text: String(HINT_COST) });
    const hintBtn = h(
      'button',
      { class: 'wheel__tool wheel__tool--hint', attr: { type: 'button' }, aria: { label: 'Подсказка' } },
      icon('bulb'),
      hintCost,
    );
    onTap(hintBtn, () => {
      if (finished) return;
      const target = targets.find((t) => !t.found && t.revealed < t.tg.length - 1);
      if (!target) {
        toast({ text: 'Подсказывать больше нечего', iconName: 'bulb' });
        return;
      }
      if (!ctx.spend(HINT_COST)) {
        toast({ text: 'Не хватает монет', iconName: 'coin', tone: 'bad' });
        return;
      }
      hintsUsed++;
      target.revealed++;
      paintTarget(target);
      haptics.reward();
    });

    for (const t of targets) paintTarget(t);

    const el = h(
      'div',
      { class: 'ex ex--wheel' },
      wordsList,
      current,
      h(
        'div',
        { class: 'wheel__area' },
        plate,
        h('div', { class: 'wheel__tools' }, shuffleBtn, hintBtn),
      ),
    );

    // Раскладываем сразу по прикидке ширины экрана: ResizeObserver срабатывает
    // через кадр, и без этого колесо успевало показаться пустым.
    setPlateSize(Math.min(window.innerWidth || 360, 520) - 2 * 16);
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver((entries) => {
            const width = Math.round(entries[0]?.contentRect.width ?? 0);
            if (width > 0) setPlateSize(width);
          })
        : null;
    ro?.observe(el);

    return {
      el,
      destroy: () => {
        ro?.disconnect();
        plate.removeEventListener('pointerdown', onDown);
        plate.removeEventListener('pointermove', onMove);
        plate.removeEventListener('pointerup', onUp);
        plate.removeEventListener('pointercancel', onUp);
      },
    };
  },
};
