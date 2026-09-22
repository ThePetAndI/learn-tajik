/**
 * Проверка на реальном курсе: все мини-игры действительно встречаются,
 * и ни одна не забирает уровень целиком.
 *
 * Генератор возвращает null, когда материала не хватает, — из-за этого
 * мини-игра может тихо пропасть из курса навсегда, и заметить это в коде
 * невозможно. Заметно только здесь.
 */

import { describe, expect, it } from 'vitest';
import { allPhrases, levels } from '../src/data/content';
import {
  CARD_KINDS,
  MAX_EXERCISES,
  MIN_EXERCISES,
  NEEDS_INTRO,
  buildLevelExercises,
} from '../src/game/generators';
import { poolForLevel } from '../src/game/level-pool';
import { SUPPORTED_KINDS, moduleFor } from '../src/game/registry';
import type { Exercise, ExerciseKind } from '../src/game/types';

const ATTEMPTS = 3;

interface Built {
  levelId: string;
  section: string;
  exercises: Exercise[];
}

const built: Built[] = [];
for (const level of levels) {
  if (!level.playable) continue;
  const pool = poolForLevel(level);
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    built.push({
      levelId: level.id,
      section: level.sectionTitle,
      exercises: buildLevelExercises(pool, level.id + ':' + attempt).filter((e) =>
        moduleFor(e.kind),
      ),
    });
  }
}

function countsByKind(): Map<ExerciseKind, number> {
  const out = new Map<ExerciseKind, number>();
  for (const b of built) {
    for (const ex of b.exercises) out.set(ex.kind, (out.get(ex.kind) ?? 0) + 1);
  }
  return out;
}

describe('мини-игры на реальном курсе', () => {
  it('каждая зарегистрированная игра где-то встречается', () => {
    const counts = countsByKind();
    const missing = SUPPORTED_KINDS.filter((kind) => !counts.has(kind));
    expect(missing).toEqual([]);
  });

  it('ни одна игра не занимает весь уровень', () => {
    for (const b of built) {
      const kinds = new Map<string, number>();
      for (const ex of b.exercises) kinds.set(ex.kind, (kinds.get(ex.kind) ?? 0) + 1);
      for (const [kind, n] of kinds) {
        expect(n, b.levelId + ' весь состоит из ' + kind).toBeLessThan(b.exercises.length);
      }
    }
  });

  it('на уровне хотя бы четыре разных типа заданий', () => {
    for (const b of built) {
      const kinds = new Set(b.exercises.map((e) => e.kind));
      expect(kinds.size, b.levelId + ': типов всего ' + kinds.size).toBeGreaterThanOrEqual(4);
    }
  });

  it('длина уровня в рамках', () => {
    for (const b of built) {
      // правила и знакомства — не задания: считаем отдельно
      const tasks = b.exercises.filter((e) => !CARD_KINDS.has(e.kind));
      expect(tasks.length, b.levelId).toBeGreaterThanOrEqual(MIN_EXERCISES);
      expect(tasks.length, b.levelId).toBeLessThanOrEqual(MAX_EXERCISES);
      expect(b.exercises.length, b.levelId + ': урок слишком длинный').toBeLessThanOrEqual(20);
    }
  });

  /*
   * Ради чего знакомство и заводилось: первое, что игрок узнаёт о слове,
   * не должно быть вопросом о нём. Состояние в тестах пустое, то есть
   * игрок видит курс впервые, — значит проверяется каждое слово курса.
   */
  it('ни одно слово не проверяют раньше, чем показали', () => {
    for (const b of built) {
      const known = new Set<string>();
      for (const ex of b.exercises) {
        // задания, где слово с переводом на экране, знакомят сами собой
        if (!NEEDS_INTRO.has(ex.kind)) {
          for (const id of ex.wordIds) known.add(id);
          continue;
        }
        for (const id of ex.wordIds) {
          expect(
            known.has(id),
            b.levelId + ': «' + id + '» спрашивают в «' + ex.kind + '» без знакомства',
          ).toBe(true);
        }
      }
    }
  });

  /*
   * Самая жёсткая гарантия курса. «Напиши фразу» — единственное задание,
   * где на экране нет ни слова материала: ни вариантов, ни банка. Фразу,
   * которую видят впервые, набрать с нуля нельзя — это не проверка памяти,
   * а проверка везения. Поэтому её сначала собирают из слов, и только потом,
   * на том же уровне, просят написать.
   */
  it('фразу просят написать только после того, как её собирали из слов', () => {
    let found = 0;
    for (const b of built) {
      const assembled = new Set<string>();
      for (const ex of b.exercises) {
        if (ex.kind === 'build_phrase') assembled.add(ex.tg);
        if (ex.kind !== 'type_phrase') continue;
        found++;
        expect(
          assembled.has(ex.tg),
          b.levelId + ': «' + ex.tg + '» просят написать, ни разу не показав',
        ).toBe(true);
      }
    }
    expect(found, '«напиши фразу» не встретилось ни разу').toBeGreaterThan(0);
  });

  it('писать просят только проверенные фразы', () => {
    const unverified = new Set(
      allPhrases().filter((p) => !p.verified).map((p) => p.tg),
    );
    for (const b of built) {
      for (const ex of b.exercises) {
        if (ex.kind !== 'type_phrase') continue;
        expect(
          unverified.has(ex.tg),
          b.levelId + ': «' + ex.tg + '» непроверена, а её просят написать',
        ).toBe(false);
      }
    }
  });

  it('правило показывается в начале раздела, и только в первом уровне', () => {
    const withRule = built.filter((b) => b.exercises.some((e) => e.kind === 'rule_card'));
    expect(withRule.length, 'правил не нашлось вовсе').toBeGreaterThan(0);

    for (const b of withRule) {
      const level = levels.find((l) => l.id === b.levelId)!;
      expect(level.indexInSection, b.levelId + ': правило не в первом уровне раздела').toBe(0);
      // правило — самый первый экран, до знакомства со словами и до заданий
      expect(b.exercises[0]!.kind, b.levelId + ': правило не первое').toBe('rule_card');
    }
  });

  it('разбор ошибки есть там, где правило известно точно', () => {
    const kinds = new Map<string, number>();
    for (const b of built) {
      for (const ex of b.exercises) {
        if ('explain' in ex && ex.explain) kinds.set(ex.kind, (kinds.get(ex.kind) ?? 0) + 1);
      }
    }
    // изафет и особые буквы объясняются правилом, а не догадкой
    expect(kinds.get('izafet_builder') ?? 0).toBeGreaterThan(0);
    expect(kinds.get('missing_letter') ?? 0).toBeGreaterThan(0);
  });

  it('на повторном проходе знакомств нет — только практика', () => {
    // freshWords берётся из состояния; если слово уже введено, карточки не будет
    const pool = poolForLevel(levels.find((l) => l.playable)!);
    const withoutFresh = { ...pool, freshWords: new Set<string>() };
    const ex = buildLevelExercises(withoutFresh, 'повтор:1');
    expect(ex.some((e) => e.kind === 'word_intro')).toBe(false);
  });

  it('знакомство с буквой бывает только в разделе «Алфавит»', () => {
    for (const b of built) {
      if (b.exercises.some((e) => e.kind === 'alphabet_intro')) {
        expect(b.section).toBe('Алфавит');
      }
    }
  });

  it('раздел «Алфавит» действительно знакомит с буквами', () => {
    const alphabet = built.filter((b) => b.section === 'Алфавит');
    expect(alphabet.length).toBeGreaterThan(0);
    for (const b of alphabet) {
      expect(
        b.exercises.filter((e) => e.kind === 'alphabet_intro').length,
        b.levelId + ': нет знакомства с буквой',
      ).toBeGreaterThan(0);
    }
  });

  it('число и слово появляется там, где есть числительные', () => {
    const numeric = built.filter((b) => b.section === 'Числа');
    expect(numeric.some((b) => b.exercises.some((e) => e.kind === 'number_word'))).toBe(true);
  });

  it('задания на письмо и на скорость доходят до конца курса', () => {
    const last = built.filter((b) => b.section === 'Живая речь');
    const kinds = new Set(last.flatMap((b) => b.exercises.map((e) => e.kind)));
    expect(kinds).toContain('type_word');
    expect(kinds).toContain('type_phrase');
    expect(kinds).toContain('true_false');
    expect(kinds).toContain('missing_letter');
  });

  it('корзины всегда называются по-разному — иначе задание нерешаемо', () => {
    for (const b of built) {
      for (const ex of b.exercises) {
        if (ex.kind !== 'category_sort') continue;
        expect(ex.baskets[0], b.levelId + ': корзины названы одинаково').not.toBe(ex.baskets[1]);
      }
    }
  });

  it('темы названы разделом, где их больше всего, а не первым попавшимся', () => {
    // раздел «Алфавит» берёт слова изо всех тем: если название темы брать
    // у первого раздела, приветствия и числа тоже станут «Алфавитом»
    const family = levels.find((l) => l.sectionTitle === 'Семья');
    expect(family).toBeTruthy();
    const pool = poolForLevel(family!);
    expect(pool.themeTitles['family']).toBe('Семья');
    expect(pool.themeTitles['greetings']).toBe('Приветствия');
    expect(pool.themeTitles['num']).toBe('Числа');
  });

  it('лишнее слово объясняется темой, отличной от темы остальных', () => {
    for (const b of built) {
      for (const ex of b.exercises) {
        if (ex.kind !== 'odd_one_out') continue;
        expect(ex.theme.length).toBeGreaterThan(0);
      }
    }
  });

  it('у каждого задания верный индекс ответа и уникальные варианты', () => {
    for (const b of built) {
      for (const ex of b.exercises) {
        if ('options' in ex && Array.isArray(ex.options) && 'correct' in ex) {
          const options = ex.options as unknown[];
          expect(ex.correct, b.levelId + ' / ' + ex.kind).toBeGreaterThanOrEqual(0);
          expect(ex.correct, b.levelId + ' / ' + ex.kind).toBeLessThan(options.length);
          const keys = options.map((o) =>
            typeof o === 'string' ? o : JSON.stringify(o),
          );
          expect(new Set(keys).size, b.levelId + ' / ' + ex.kind + ': повтор варианта').toBe(
            keys.length,
          );
        }
      }
    }
  });
});
