import { describe, expect, it } from 'vitest';
import {
  EXPORT_KIND,
  buildExport,
  exportFilename,
  parseImport,
  sanitizeState,
} from '../src/data/persist';
import { SAVE_VERSION, createInitialState, createWordStat } from '../src/data/state';

const T0 = Date.parse('2026-03-10T12:00:00Z');

function filledState() {
  const s = createInitialState(T0);
  s.wallet.coins = 340;
  s.streak = { current: 7, best: 12, lastDayKey: '2026-03-10', freezes: 1 };
  s.levels['s01_l1'] = { stars: 3, best: 1, attempts: 2, completedAt: T0 };
  s.levels['s01_l2'] = { stars: 2, best: 0.8, attempts: 1, completedAt: T0 };
  s.srs['w_salom'] = { ...createWordStat(T0), seen: 9, correct: 8, wrong: 1, box: 3, introduced: true };
  s.inventory.owned = ['pet_cat', 'theme_winter'];
  s.inventory.items = { hint: 3, fiftyfifty: 1 };
  s.stats.answers = 120;
  s.stats.correct = 101;
  return s;
}

describe('экспорт и импорт', () => {
  it('переживает полный круг без потерь', () => {
    const original = filledState();
    const file = buildExport(original);
    const result = parseImport(JSON.stringify(file));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state).toEqual(original);
  });

  it('кладёт в файл опознавательные поля', () => {
    const file = buildExport(filledState());
    expect(file.kind).toBe(EXPORT_KIND);
    expect(file.version).toBe(SAVE_VERSION);
  });

  it('читает «голый» SaveState без обёртки', () => {
    const original = filledState();
    const result = parseImport(JSON.stringify(original));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.wallet.coins).toBe(340);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('отказывается от файла чужого приложения', () => {
    const result = parseImport(JSON.stringify({ kind: 'other-app/save', state: {} }));
    expect(result.ok).toBe(false);
  });

  it('отказывается от мусора', () => {
    expect(parseImport('не json').ok).toBe(false);
    expect(parseImport('{"hello":1}').ok).toBe(false);
    expect(parseImport('[]').ok).toBe(false);
  });

  it('предупреждает о файле из будущей версии, но данные берёт', () => {
    const file = buildExport(filledState());
    file.version = SAVE_VERSION + 5;
    const result = parseImport(JSON.stringify(file));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.join(' ')).toContain('новой версией');
    expect(result.state.wallet.coins).toBe(340);
  });

  it('имя файла содержит дату', () => {
    expect(exportFilename(Date.parse('2026-03-10T12:05:00'))).toBe('tojiki-progress-20260310-1205.json');
  });
});

describe('sanitizeState', () => {
  it('подставляет значения по умолчанию для пустого объекта', () => {
    const s = sanitizeState({}, T0);
    expect(s.lives.count).toBe(5);
    expect(s.wallet.coins).toBe(50);
    expect(s.settings.haptics).toBe(true);
  });

  it('чинит испорченные числа', () => {
    const s = sanitizeState(
      { wallet: { coins: -900 }, lives: { count: 99, max: 5, updatedAt: 'нет' } },
      T0,
    );
    expect(s.wallet.coins).toBe(0);
    expect(s.lives.count).toBe(5);
    expect(s.lives.updatedAt).toBe(T0);
  });

  it('обрезает звёзды уровня диапазоном 0..3', () => {
    const s = sanitizeState({ levels: { a: { stars: 17, best: 5, attempts: -3 } } }, T0);
    expect(s.levels.a?.stars).toBe(3);
    expect(s.levels.a?.best).toBe(1);
    expect(s.levels.a?.attempts).toBe(0);
  });

  it('держит ease в рабочем диапазоне SM-2', () => {
    const s = sanitizeState({ srs: { w_a: { ease: 99 }, w_b: { ease: 0.1 } } }, T0);
    expect(s.srs.w_a?.ease).toBe(2.8);
    expect(s.srs.w_b?.ease).toBe(1.3);
  });

  it('выбрасывает мусор из массивов и словарей', () => {
    const s = sanitizeState(
      { inventory: { owned: ['pet_cat', 42, null, 'pet_cat'], items: { hint: 'нет', boost: 4 } } },
      T0,
    );
    expect(s.inventory.owned).toEqual(['pet_cat']);
    expect(s.inventory.items).toEqual({ boost: 4 });
  });

  it('не даёт count превысить max', () => {
    const s = sanitizeState({ lives: { count: 10, max: 3, updatedAt: T0 } }, T0);
    expect(s.lives.max).toBe(3);
    expect(s.lives.count).toBe(3);
  });
});
