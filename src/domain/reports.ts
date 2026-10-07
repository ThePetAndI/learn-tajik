/**
 * Замечания к урокам. Игрок отмечает в уроке слово или фразу, которые так не
 * говорят или произносят иначе; замечания копятся в сохранении, а потом одним
 * текстом уходят Claude — он сверяет их с курсом и правит контент.
 *
 * Сервера у приложения нет и не будет, поэтому путь такой: копились —
 * скопировал в Профиле — вставил в чат.
 */

import {
  MAX_REPORTS,
  MAX_REPORT_NOTE,
  REPORT_REASONS,
  type Report,
  type ReportReason,
  type SaveState,
} from '../data/state';
import type { Exercise } from '../game/types';

export const REASON_LABELS: Record<ReportReason, string> = {
  not_used: 'Так не говорят',
  different: 'Говорят иначе',
  pronounce: 'Произносят иначе',
  translation: 'Неверный перевод',
  other: 'Другое',
};

/** Что в задании можно отметить: слово, фразу, реплику, букву, правило. */
export interface ReportTarget {
  /** Ссылка на контент — формат описан у Report.ref. */
  ref: string;
  tg: string;
  ru: string;
}

/** Отметка «всё задание целиком» — когда не так не слово, а само задание. */
export const WHOLE_EXERCISE = 'all';

function word(id: string | undefined, tg: string, ru: string): ReportTarget[] {
  return id ? [{ ref: 'w:' + id, tg, ru }] : [];
}

/**
 * Что в этом задании можно отметить. Берётся только из самого задания: в нём
 * уже есть и id, и то, что игрок видел на экране, — контент заново не читаем.
 */
export function reportTargets(ex: Exercise): ReportTarget[] {
  switch (ex.kind) {
    case 'rule_card':
      return [{ ref: 'r:' + ex.title, tg: ex.title, ru: 'правило' }];
    case 'word_intro':
      return [
        ...word(ex.wordIds[0], ex.tg, ex.ru),
        ...(ex.example && ex.wordIds[0] ? [{ ref: 'x:' + ex.wordIds[0], tg: ex.example.tg, ru: ex.example.ru }] : []),
      ];
    case 'phrase_intro': {
      // «p:id» — фраза, «d:id» — разговор: у разговора каждая реплика отдельно
      const isDialogue = ex.key.startsWith('d:');
      const lines = ex.lines.map((l, i) => ({
        ref: isDialogue ? ex.key + (i === 0 ? '/ask' : '/reply') : ex.key,
        tg: l.tg,
        ru: l.ru,
      }));
      // слова разбора идут в том же порядке, что wordIds
      const glossWords =
        ex.gloss.length === ex.wordIds.length
          ? ex.gloss.map((g, i) => ({ ref: 'w:' + ex.wordIds[i], tg: g.tg, ru: g.ru }))
          : [];
      return [...lines, ...glossWords];
    }
    case 'quiz_tg_ru':
      return word(ex.wordIds[0], ex.prompt, ex.options[ex.correct] ?? '');
    case 'quiz_ru_tg':
      return word(ex.wordIds[0], ex.options[ex.correct] ?? '', ex.prompt);
    case 'match_pairs':
      return ex.pairs.map((p) => ({ ref: 'w:' + p.wordId, tg: p.tg, ru: p.ru }));
    case 'build_phrase':
    case 'type_phrase':
      return [{ ref: ex.phraseId ? 'p:' + ex.phraseId : 'z:' + ex.tg, tg: ex.tg, ru: ex.ru }];
    case 'letter_wheel':
      return ex.targets.map((t) => ({ ref: 'w:' + t.wordId, tg: t.tg, ru: t.ru }));
    case 'type_word':
    case 'number_word':
      return word(ex.wordIds[0], ex.tg, ex.ru);
    case 'missing_letter':
      return word(ex.wordIds[0], ex.before + (ex.options[ex.correct] ?? '') + ex.after, ex.ru);
    case 'true_false':
      return word(ex.wordIds[0], ex.tg, ex.realRu);
    case 'alphabet_intro':
      return [{ ref: 'l:' + ex.lower, tg: ex.upper + ex.lower, ru: ex.sound }];
    case 'dialogue_choice': {
      const base = ex.dialogueId ? 'd:' + ex.dialogueId : 'z:' + ex.ask.tg;
      const reply = ex.options[ex.correct];
      return [
        { ref: ex.dialogueId ? base + '/ask' : base, tg: ex.ask.tg, ru: ex.ask.ru },
        ...(reply ? [{ ref: ex.dialogueId ? base + '/reply' : 'z:' + reply.tg, tg: reply.tg, ru: reply.ru }] : []),
      ];
    }
    case 'category_sort':
      return ex.items.map((i) => ({ ref: 'w:' + i.wordId, tg: i.tg, ru: i.ru }));
    case 'izafet_builder':
      return [{ ref: 'z:' + ex.tg, tg: ex.tg, ru: ex.ru }];
  }
}

/** Новое замечание: всё, кроме времени, — его ставит addReport. */
export type ReportDraft = Omit<Report, 'at'>;

/**
 * Добавляет замечание и возвращает его. Время — идентификатор: если в ту же
 * миллисекунду уже есть замечание, сдвигаем на одну вперёд. Сверх MAX_REPORTS
 * уходят самые старые.
 *
 * Пустая отметка или слишком длинный текст — ошибка вызывающего (форма
 * этого не допускает), а не повод тихо обрезать: бросаем.
 */
export function addReport(state: SaveState, draft: ReportDraft, ts: number): Report {
  if (!REPORT_REASONS.includes(draft.reason)) throw new Error('Неизвестная причина замечания: ' + draft.reason);
  if (draft.ref === '') throw new Error('Замечание ни к чему не относится: пустой ref');
  const note = draft.note.trim();
  if (note.length > MAX_REPORT_NOTE) {
    throw new Error('Текст замечания длиннее ' + MAX_REPORT_NOTE + ' знаков: ' + note.length);
  }
  let at = ts;
  while (state.reports.some((r) => r.at === at)) at++;
  const report: Report = { ...draft, note, at };
  state.reports.push(report);
  if (state.reports.length > MAX_REPORTS) state.reports.splice(0, state.reports.length - MAX_REPORTS);
  return report;
}

/** Удаляет одно замечание. false — такого нет. */
export function removeReport(state: SaveState, at: number): boolean {
  const i = state.reports.findIndex((r) => r.at === at);
  if (i < 0) return false;
  state.reports.splice(i, 1);
  return true;
}

/** Удаляет все замечания, возвращает, сколько было. */
export function clearReports(state: SaveState): number {
  const n = state.reports.length;
  state.reports = [];
  return n;
}

export const REPORTS_EXPORT_KIND = 'learn-tajik/reports';

function dateLabel(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear();
}

/**
 * Текст для чата с Claude: сверху по строке на замечание — чтобы человек видел,
 * что отправляет, — снизу то же самое в JSON, чтобы разбор был точным.
 */
export function formatReports(reports: readonly Report[], ts: number): string {
  const lines = reports.map((r, i) => {
    const what = r.ru ? r.tg + ' — ' + r.ru : r.tg;
    const note = r.note ? ': «' + r.note + '»' : '';
    return i + 1 + '. ' + what + ' · ' + r.where + ' · ' + REASON_LABELS[r.reason] + note;
  });
  const payload = JSON.stringify({ kind: REPORTS_EXPORT_KIND, version: 1, reports });
  return (
    'Замечания к курсу «Тоҷикӣ» — ' + reports.length + ', ' + dateLabel(ts) + '\n' +
    lines.join('\n') + '\n\n' +
    'JSON: ' + payload
  );
}
