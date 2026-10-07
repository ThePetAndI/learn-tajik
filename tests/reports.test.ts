import { describe, expect, it } from 'vitest';
import { levels } from '../src/data/content';
import { buildExport, parseImport, sanitizeState } from '../src/data/persist';
import { createInitialState, MAX_REPORTS, SAVE_VERSION, type Report } from '../src/data/state';
import {
  addReport,
  clearReports,
  formatReports,
  removeReport,
  reportTargets,
  REPORTS_EXPORT_KIND,
  type ReportDraft,
} from '../src/domain/reports';
import { buildLevelExercises } from '../src/game/generators';
import { poolForLevel } from '../src/game/level-pool';
import type { Exercise } from '../src/game/types';

const T0 = 1_790_000_000_000;

const draft = (over: Partial<ReportDraft> = {}): ReportDraft => ({
  where: 's01_l2',
  kind: 'quiz_tg_ru',
  ref: 'w:w_nagz',
  tg: 'нағз',
  ru: 'хорошо',
  reason: 'different',
  note: 'говорят хуб',
  ...over,
});

/*
 * Замечание должно указывать на конкретное: слово, фразу, реплику. Иначе
 * при разборе непонятно, что править, — «что-то не так в квизе» не поможет.
 */
describe('что в задании можно отметить', () => {
  it('квиз: слово с переводом, в какую бы сторону ни спрашивали', () => {
    const tgRu: Exercise = { kind: 'quiz_tg_ru', wordIds: ['w_nagz'], prompt: 'нағз', options: ['плохо', 'хорошо'], correct: 1 };
    const ruTg: Exercise = { kind: 'quiz_ru_tg', wordIds: ['w_nagz'], prompt: 'хорошо', options: ['бад', 'нағз'], correct: 1 };
    expect(reportTargets(tgRu)).toEqual([{ ref: 'w:w_nagz', tg: 'нағз', ru: 'хорошо' }]);
    expect(reportTargets(ruTg)).toEqual([{ ref: 'w:w_nagz', tg: 'нағз', ru: 'хорошо' }]);
  });

  it('карточка фразы: сама фраза и каждое её слово', () => {
    const ex: Exercise = {
      kind: 'phrase_intro',
      key: 'p:p_ha_rahmat',
      wordIds: ['w_ha', 'w_rahmat'],
      lines: [{ tg: 'Ҳо, раҳмат.', ru: 'Да, спасибо.' }],
      gloss: [
        { tg: 'ҳо', ru: 'да' },
        { tg: 'раҳмат', ru: 'спасибо' },
      ],
    };
    expect(reportTargets(ex).map((t) => t.ref)).toEqual(['p:p_ha_rahmat', 'w:w_ha', 'w:w_rahmat']);
  });

  it('карточка разговора: каждая реплика отдельно', () => {
    const ex: Exercise = {
      kind: 'phrase_intro',
      key: 'd:d_choy',
      wordIds: [],
      lines: [
        { tg: 'Чой менӯшен?', ru: 'Будете чай?', who: 'them' },
        { tg: 'Ҳо, раҳмат.', ru: 'Да, спасибо.', who: 'me' },
      ],
      gloss: [],
    };
    expect(reportTargets(ex).map((t) => t.ref)).toEqual(['d:d_choy/ask', 'd:d_choy/reply']);
  });

  it('пропущенная буква: слово целиком, а не с дыркой', () => {
    const ex: Exercise = {
      kind: 'missing_letter',
      wordIds: ['w_ruz'],
      before: 'р',
      after: 'з',
      ru: 'день',
      options: ['у', 'ӯ'],
      correct: 1,
      special: true,
    };
    expect(reportTargets(ex)).toEqual([{ ref: 'w:w_ruz', tg: 'рӯз', ru: 'день' }]);
  });

  it('в каждом задании настоящих уроков есть что отметить', () => {
    for (const level of levels.slice(0, 20)) {
      for (const ex of buildLevelExercises(poolForLevel(level), level.id + ':1')) {
        const targets = reportTargets(ex);
        expect(targets.length, level.id + ' / ' + ex.kind).toBeGreaterThan(0);
        for (const t of targets) {
          expect(t.ref, level.id + ' / ' + ex.kind).toMatch(/^[wxpdlrz]:./);
          expect(t.tg.trim(), level.id + ' / ' + ex.kind).not.toBe('');
        }
      }
    }
  });
});

describe('список замечаний', () => {
  it('добавляет с временем и без пробелов по краям', () => {
    const s = createInitialState(T0);
    const r = addReport(s, draft({ note: '  говорят хуб  ' }), T0);
    expect(r.at).toBe(T0);
    expect(r.note).toBe('говорят хуб');
    expect(s.reports).toHaveLength(1);
  });

  it('два замечания в одну миллисекунду не делят идентификатор', () => {
    const s = createInitialState(T0);
    addReport(s, draft(), T0);
    const second = addReport(s, draft({ ref: 'w:w_bad' }), T0);
    expect(second.at).toBe(T0 + 1);
  });

  it('сверх потолка уходят самые старые', () => {
    const s = createInitialState(T0);
    for (let i = 0; i < MAX_REPORTS + 5; i++) addReport(s, draft({ note: 'n' + i }), T0 + i);
    expect(s.reports).toHaveLength(MAX_REPORTS);
    expect(s.reports[0]?.note).toBe('n5');
  });

  it('пустая отметка и слишком длинный текст — ошибка, а не тихая обрезка', () => {
    const s = createInitialState(T0);
    expect(() => addReport(s, draft({ ref: '' }), T0)).toThrow();
    expect(() => addReport(s, draft({ note: 'а'.repeat(301) }), T0)).toThrow();
    expect(() => addReport(s, draft({ reason: 'whatever' as ReportDraft['reason'] }), T0)).toThrow();
    expect(s.reports).toHaveLength(0);
  });

  it('удаляет одно и все', () => {
    const s = createInitialState(T0);
    const a = addReport(s, draft(), T0);
    addReport(s, draft({ ref: 'w:w_bad' }), T0 + 5);
    expect(removeReport(s, a.at)).toBe(true);
    expect(removeReport(s, a.at)).toBe(false);
    expect(clearReports(s)).toBe(1);
    expect(s.reports).toEqual([]);
  });
});

describe('текст для Claude', () => {
  it('по строке на замечание и тот же список в JSON', () => {
    const s = createInitialState(T0);
    addReport(s, draft(), T0);
    addReport(s, draft({ ref: 'p:p_x', tg: 'Ин хона.', ru: 'Это дом.', reason: 'not_used', note: '' }), T0 + 1);
    const text = formatReports(s.reports, T0);
    expect(text).toContain('1. нағз — хорошо · s01_l2 · Говорят иначе: «говорят хуб»');
    expect(text).toContain('2. Ин хона. — Это дом. · s01_l2 · Так не говорят');
    const json = JSON.parse(text.slice(text.indexOf('JSON: ') + 6)) as { kind: string; reports: Report[] };
    expect(json.kind).toBe(REPORTS_EXPORT_KIND);
    expect(json.reports).toEqual(s.reports);
  });
});

describe('замечания в сохранении', () => {
  it('битые записи выбрасываются целиком, целые остаются', () => {
    const good: Report = { at: T0, where: 's01_l1', kind: 'quiz_tg_ru', ref: 'w:w_ha', tg: 'ҳа', ru: 'да', reason: 'pronounce', note: '' };
    const s = sanitizeState({
      reports: [good, { ...good, reason: 'nonsense' }, { ...good, ref: '' }, 'мусор', { ...good, at: 'вчера' }],
    });
    expect(s.reports).toEqual([good]);
  });

  it('сохранение пятой версии получает пустой список замечаний', () => {
    const old = buildExport(createInitialState(T0)) as unknown as { version: number; state: Record<string, unknown> };
    old.version = 5;
    old.state.version = 5;
    delete old.state.reports;
    const res = parseImport(JSON.stringify(old), T0);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.state.version).toBe(SAVE_VERSION);
      expect(res.state.reports).toEqual([]);
    }
  });
});
