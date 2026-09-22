/**
 * Раздел «Слова»: всё, что игрок уже встречал, с прогрессом по каждому слову.
 * Отсюда же запускается «Повторить ошибки».
 */

import { clear, h, onTap } from '../core/dom';
import type { ScreenView } from '../core/router';
import { getState, subscribe } from '../core/store';
import { formatDuration, now, plural } from '../core/time';
import { allWords, getWord, type Word } from '../data/content';
import {
  MAX_BOX,
  getWordStat,
  isDue,
  wordDifficulty,
  wordsSummary,
  type WordsSummary,
} from '../domain/srs';
import type { WordStat } from '../data/state';
import { button } from '../ui/button';
import { hasSpecialLetters, specialLettersOf } from '../domain/answer';
import { icon, type IconName } from '../ui/icons';
import { modal } from '../ui/modal';
import { openReviewSession } from './review';

type FilterId = 'all' | 'learning' | 'learned' | 'hard' | 'due' | 'course';

interface FilterDef {
  id: FilterId;
  label: string;
  match: (stat: WordStat, ts: number) => boolean;
}

/** Слово считается выученным, начиная с четвёртой коробки — это интервал в две недели. */
const LEARNED_BOX = 4;

/*
 * «Весь курс» отличается от остальных: он показывает и то, чего игрок ещё
 * не видел. Раньше посмотреть слово наперёд или найти услышанное на улице
 * было негде — словарь показывал только пройденное.
 */
const FILTERS: FilterDef[] = [
  { id: 'all', label: 'Мои слова', match: () => true },
  { id: 'course', label: 'Весь курс', match: () => true },
  { id: 'learning', label: 'Учу', match: (s) => s.box < LEARNED_BOX },
  { id: 'learned', label: 'Выучено', match: (s) => s.box >= LEARNED_BOX },
  { id: 'hard', label: 'Трудные', match: (s) => wordDifficulty(s) >= 0.45 },
  { id: 'due', label: 'К повтору', match: (s, ts) => isDue(s, ts) },
];

function progressBar(stat: WordStat): HTMLElement {
  const bar = h('span', { class: 'word-row__bar' });
  for (let i = 0; i < MAX_BOX; i++) {
    bar.append(h('span', { class: 'word-row__seg' + (i < stat.box ? ' is-on' : '') }));
  }
  return bar;
}

function statLine(label: string, value: string): HTMLElement {
  return h(
    'div',
    { class: 'word-detail__row' },
    h('span', { class: 'word-detail__label', text: label }),
    h('span', { class: 'word-detail__value', text: value }),
  );
}

function openWordDetail(word: Word, stat: WordStat, ts: number): void {
  const rate = stat.seen > 0 ? Math.round((stat.correct / stat.seen) * 100) : 0;
  const due = isDue(stat, ts)
    ? 'сейчас'
    : stat.dueAt > ts
      ? 'через ' + formatDuration(stat.dueAt - ts)
      : 'сейчас';

  const body = h(
    'div',
    { class: 'word-detail' },
    h('div', { class: 'word-detail__tg', text: word.tg }),
    h('div', { class: 'word-detail__ru', text: word.ru }),
    hasSpecialLetters(word.tg)
      ? h('div', {
          class: 'word-detail__letters',
          text: 'особые буквы: ' + specialLettersOf(word.tg).join(' '),
        })
      : null,
    word.example
      ? h(
          'div',
          { class: 'word-detail__example' },
          h('div', { class: 'word-detail__example-tg', text: word.example.tg }),
          h('div', { class: 'word-detail__example-ru', text: word.example.ru }),
        )
      : null,
    h(
      'div',
      { class: 'word-detail__stats' },
      statLine('Показов', String(stat.seen)),
      statLine('Верных', stat.correct + ' (' + rate + '%)'),
      statLine('Ошибок', String(stat.wrong)),
      statLine('Ступень', stat.box + ' из ' + MAX_BOX),
      statLine('Следующий повтор', due),
    ),
    word.verified === false
      ? h('div', {
          class: 'word-detail__unverified',
          text: 'Это слово помечено на проверку носителем.',
        })
      : null,
  );

  modal({ body, closeButton: true, actions: [{ label: 'Закрыть', tone: 'white', value: 'ok' }] });
}

export function createWordsScreen(): ScreenView {
  let filter: FilterId = 'all';
  let query = '';

  const list = h('div', { class: 'words-list' });
  const summaryRow = h('div', { class: 'words-summary' });
  const chips = h('div', { class: 'words-filters' });
  const emptyBox = h('div', { class: 'empty-state' });

  const search = h('input', {
    class: 'words-search',
    attr: { type: 'search', placeholder: 'Найти слово', enterkeyhint: 'search' },
  }) as HTMLInputElement;
  search.addEventListener('input', () => {
    query = search.value.trim().toLowerCase();
    render();
  });

  const reviewBtn = button({
    label: 'Повторить ошибки',
    icon: 'refresh',
    tone: 'blue',
    wide: true,
    onTap: () => {
      openReviewSession({
        title: 'Повторение',
        sessionId: 'review:mistakes',
        candidates: [],
      });
    },
  });

  for (const def of FILTERS) {
    const chip = h('button', {
      class: 'words-chip',
      attr: { type: 'button' },
      text: def.label,
      data: { filter: def.id },
    });
    onTap(chip, () => {
      filter = def.id;
      render();
    });
    chips.append(chip);
  }

  function summaryChip(iconName: IconName, value: string, label: string, tone: string): HTMLElement {
    return h(
      'div',
      { class: 'words-summary__item t-' + tone },
      h('span', { class: 'words-summary__icon' }, icon(iconName)),
      h('span', { class: 'words-summary__value', text: value }),
      h('span', { class: 'words-summary__label', text: label }),
    );
  }

  function renderSummary(sum: WordsSummary): void {
    summaryRow.replaceChildren(
      summaryChip('book', String(sum.seen), 'встречено', 'blue'),
      summaryChip('check', String(sum.learned), 'выучено', 'green'),
      summaryChip('refresh', String(sum.due), 'к повтору', 'orange'),
    );
  }

  function wordRow(word: Word, stat: WordStat, ts: number): HTMLElement {
    const due = isDue(stat, ts);
    const unseen = stat.seen === 0;
    const row = h(
      'button',
      {
        class: 'word-row' + (due ? ' is-due' : '') + (unseen ? ' is-unseen' : ''),
        attr: { type: 'button' },
      },
      h(
        'span',
        { class: 'word-row__text' },
        h('span', { class: 'word-row__tg', text: word.tg }),
        h('span', { class: 'word-row__ru', text: word.ru }),
      ),
      h(
        'span',
        { class: 'word-row__meta' },
        progressBar(stat),
        due ? h('span', { class: 'word-row__due' }, icon('refresh')) : null,
      ),
    );
    onTap(row, () => openWordDetail(word, stat, ts));
    return row;
  }

  function render(): void {
    const state = getState();
    const ts = now();
    const sum = wordsSummary(state, ts);
    renderSummary(sum);

    for (const chip of chips.children) {
      chip.classList.toggle('is-on', (chip as HTMLElement).dataset.filter === filter);
    }

    const def = FILTERS.find((f) => f.id === filter) ?? FILTERS[0];
    const rows: HTMLElement[] = [];
    let total = 0;
    const whole = filter === 'course';

    const entries: { word: Word; stat: WordStat }[] = whole
      ? // порядок курса: так видно, что идёт за чем
        allWords().map((word) => ({ word, stat: getWordStat(state, word.id, ts) }))
      : Object.entries(state.srs)
          .filter(([, stat]) => stat.seen > 0)
          // то, что хуже усвоено, — выше
          .sort((a, b) => a[1].box - b[1].box || b[1].wrong - a[1].wrong)
          .map(([id, stat]) => ({ word: getWord(id) as Word, stat }))
          .filter((e) => Boolean(e.word));

    for (const { word, stat } of entries) {
      if (!whole && !def?.match(stat, ts)) continue;
      if (query && !word.tg.toLowerCase().includes(query) && !word.ru.toLowerCase().includes(query)) {
        continue;
      }
      total++;
      if (rows.length < 300) rows.push(wordRow(word, stat, ts));
    }

    clear(list);
    if (rows.length === 0) {
      clear(emptyBox);
      emptyBox.append(
        h('div', { class: 'empty-state__icon' }, icon('book')),
        h('h2', { class: 'h2', text: sum.seen === 0 && !whole ? 'Слов пока нет' : 'Ничего не нашлось' }),
        h('p', {
          class: 'p',
          text:
            sum.seen === 0 && !whole
              ? 'Пройди первый уровень — слова появятся здесь вместе с прогрессом. '
                + 'Или посмотри весь курс наперёд.'
              : 'Попробуй другой фильтр или поиск.',
        }),
      );
      list.append(emptyBox);
    } else {
      list.append(...rows);
      if (total > rows.length) {
        list.append(
          h('div', {
            class: 'words-more',
            text: 'Показано ' + rows.length + ' из ' + total + ' — уточни поиск',
          }),
        );
      }
    }

    const left = allWords().length - sum.seen;
    if (whole) {
      footer.textContent =
        'В курсе ' + allWords().length + ' ' +
        plural(allWords().length, 'слово', 'слова', 'слов') + ', встречено ' + sum.seen;
    } else {
      footer.textContent =
        left > 0
          ? 'Впереди ещё ' + left + ' ' + plural(left, 'слово', 'слова', 'слов') + ' курса'
          : 'Все слова курса уже встречались';
    }

    reviewBtn.disabled = sum.seen < 4;
  }

  const footer = h('div', { class: 'words-footer' });

  const el = h(
    'div',
    { class: 'screen screen--words' },
    h(
      'header',
      { class: 'topbar' },
      h('div', { class: 'topbar__spacer' }),
      h('div', { class: 'topbar__title', text: 'Слова' }),
      h('div', { class: 'topbar__spacer' }),
    ),
    h(
      'div',
      { class: 'words-head' },
      summaryRow,
      h('div', { class: 'words-actions' }, reviewBtn),
      search,
      chips,
    ),
    h('div', { class: 'screen-body words-body' }, list, footer),
  );

  const unsub = subscribe(render);
  render();

  return {
    el,
    onShow: render,
    destroy: () => unsub(),
  };
}
