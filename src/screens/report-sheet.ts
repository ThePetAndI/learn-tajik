/**
 * Окно «Что не так?» — замечание к заданию, открытому в уроке.
 *
 * Отмечается конкретное: слово, фраза, реплика — и причина. «Как правильно»
 * можно не писать. Замечание сохраняется в прогрессе, а отправляется Claude
 * из Профиля — там все замечания копируются одним текстом.
 */

import { h, onTap } from '../core/dom';
import { update } from '../core/store';
import { now } from '../core/time';
import { MAX_REPORT_NOTE, REPORT_REASONS, type ReportReason } from '../data/state';
import { addReport, REASON_LABELS, reportTargets, WHOLE_EXERCISE, type ReportTarget } from '../domain/reports';
import type { Exercise } from '../game/types';
import { button } from '../ui/button';
import { modal } from '../ui/modal';
import { toast } from '../ui/toast';

/** Буквы, которых нет на русской раскладке, — как в заданиях на письмо. */
const PANEL = ['ғ', 'ӣ', 'қ', 'ӯ', 'ҳ', 'ҷ'];

/**
 * Открывает окно. true — замечание сохранено, false — закрыли без него.
 * where — id урока или режима: по нему потом видно, где это было.
 */
export function openReportSheet(exercise: Exercise, where: string): Promise<boolean> {
  const targets = reportTargets(exercise);
  // задание целиком — когда не так не слово, а само задание
  const whole: ReportTarget = { ref: WHOLE_EXERCISE, tg: targets.map((t) => t.tg).join(' · '), ru: '' };
  const options = [...targets, whole];
  let picked = 0;
  let reason: ReportReason | null = null;

  const targetBtns = options.map((t, i) => {
    const b = h(
      'button',
      { class: 'rsheet__target', attr: { type: 'button' } },
      h('span', { class: 'rsheet__tg', text: t === whole ? 'Всё задание' : t.tg }),
      t.ru ? h('span', { class: 'rsheet__ru', text: t.ru }) : null,
    );
    onTap(b, () => {
      picked = i;
      refresh();
    });
    return b;
  });

  const reasonBtns = REPORT_REASONS.map((r) => {
    const b = h('button', { class: 'rsheet__reason', attr: { type: 'button' }, text: REASON_LABELS[r] });
    onTap(b, () => {
      reason = r;
      refresh();
    });
    return b;
  });

  const note = h('textarea', {
    class: 'rsheet__note',
    attr: { rows: '2', maxlength: String(MAX_REPORT_NOTE), placeholder: 'Например: говорят «хубмӣ»' },
    aria: { label: 'Как правильно' },
  });

  const keys = PANEL.map((letter) => {
    const key = h('button', { class: 'rsheet__key', attr: { type: 'button' }, text: letter });
    // фокус остаётся в поле: иначе системная клавиатура закрывается на каждой букве
    key.addEventListener('pointerdown', (ev) => ev.preventDefault());
    key.addEventListener('mousedown', (ev) => ev.preventDefault());
    onTap(key, () => {
      const start = note.selectionStart ?? note.value.length;
      const end = note.selectionEnd ?? start;
      if (note.value.length - (end - start) >= MAX_REPORT_NOTE) return;
      note.setRangeText(letter, start, end, 'end');
      note.focus();
    });
    return key;
  });

  const save = button({ label: 'Сохранить', tone: 'orange', wide: true, disabled: true });
  const cancel = button({ label: 'Отмена', tone: 'white', wide: true });

  function refresh(): void {
    targetBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === picked)));
    reasonBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(REPORT_REASONS[i] === reason)));
    // без причины замечание при разборе ничего не скажет
    save.disabled = reason === null;
  }

  const body = h(
    'div',
    { class: 'rsheet' },
    h('p', {
      class: 'rsheet__intro',
      text: 'Замечание сохранится в приложении. В Профиле все замечания копируются одной кнопкой — для Claude.',
    }),
    h('div', { class: 'rsheet__label', text: 'Что именно' }),
    h('div', { class: 'rsheet__targets' }, ...targetBtns),
    h('div', { class: 'rsheet__label', text: 'Что не так' }),
    h('div', { class: 'rsheet__reasons' }, ...reasonBtns),
    h('div', { class: 'rsheet__label', text: 'Как правильно — если знаете' }),
    note,
    h('div', { class: 'rsheet__keys' }, ...keys),
    h('div', { class: 'rsheet__actions' }, save, cancel),
  );

  const m = modal({ title: 'Что не так?', body, closeButton: true, class: 'modal__card--report' });

  onTap(save, () => {
    const target = options[picked];
    if (reason === null || !target) return;
    const chosen = reason;
    update((s) => {
      addReport(
        s,
        { where, kind: exercise.kind, ref: target.ref, tg: target.tg, ru: target.ru, reason: chosen, note: note.value },
        now(),
      );
    });
    toast({ text: 'Замечание сохранено. Отправить — в Профиле', tone: 'good' });
    m.close('saved');
  });
  onTap(cancel, () => m.close(null));

  refresh();
  return m.result.then((v) => v === 'saved');
}
