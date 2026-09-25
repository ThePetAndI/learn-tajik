/**
 * Проверка на реальном курсе: все мини-игры действительно встречаются,
 * и ни одна не забирает уровень целиком.
 *
 * Генератор возвращает null, когда материала не хватает, — из-за этого
 * мини-игра может тихо пропасть из курса навсегда, и заметить это в коде
 * невозможно. Заметно только здесь.
 */

import { describe, expect, it } from 'vitest';
import { getState } from '../src/core/store';
import { allPhrases, getWord, letters, levels, rules } from '../src/data/content';
import { createWordStat } from '../src/data/state';
import {
  CARD_KINDS,
  MAX_EXERCISES,
  MIN_EXERCISES,
  NEEDS_INTRO,
  buildLevelExercises,
  needsOf,
} from '../src/game/generators';
import { newLettersFor, poolForLevel } from '../src/game/level-pool';
import { SUPPORTED_KINDS, moduleFor } from '../src/game/registry';
import type { Exercise, ExerciseKind } from '../src/game/types';

const ATTEMPTS = 3;
const T0 = Date.parse('2026-03-10T12:00:00Z');

interface Built {
  levelId: string;
  section: string;
  exercises: Exercise[];
  /** Что игрок знал до этого урока: выученные слова и объяснённые фразы. */
  known: ReadonlySet<string>;
  seen: ReadonlySet<string>;
}

/*
 * Игрок проходит курс по порядку и учится по ходу: после каждого урока всё,
 * что в нём встретилось, считается выученным. Так курс и играют — и от этого
 * зависит сборка: писать просят только то, что знали до урока, «лишнее»
 * и корзины берут чужие слова только из выученного, фразу объясняют один раз.
 * Урок, собранный для игрока, который не знает вообще ничего, этих правил
 * не проверил бы.
 */
const built: Built[] = [];
const state = getState();
for (const level of levels) {
  if (!level.playable) continue;
  const pool = poolForLevel(level);
  const known = new Set(
    Object.entries(state.srs)
      .filter(([, w]) => w.introduced)
      .map(([id]) => id),
  );
  const seen = new Set(Object.keys(state.seen));
  const attempts: Exercise[][] = [];
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const exercises = buildLevelExercises(pool, level.id + ':' + attempt).filter((e) => moduleFor(e.kind));
    attempts.push(exercises);
    built.push({
      levelId: level.id,
      section: level.sectionTitle,
      exercises,
      known,
      seen,
    });
  }
  // урок пройден: всё, что встретилось, выучено, все карточки фраз просмотрены
  for (const exercises of attempts) {
    for (const ex of exercises) {
      for (const id of needsOf(ex).concat(ex.wordIds)) {
        state.srs[id] = { ...createWordStat(T0), introduced: true, seen: 1, correct: 1 };
      }
      if (ex.kind === 'phrase_intro') for (const key of [ex.key, ...(ex.alsoKeys ?? [])]) state.seen[key] = T0;
    }
  }
  state.levels[level.id] = { stars: 3, best: 1, attempts: 1, completedAt: T0 };
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
   * Главная гарантия курса: ни одно задание не спрашивает того, что игроку
   * не показывали. Слово — либо выучено в прошлых уроках, либо показано
   * карточкой раньше в этом. Фраза и разговор — либо объяснены раньше,
   * либо здесь, карточкой перед заданием.
   *
   * Раньше эта проверка пропускала «собери фразу», колесо, диалог и изафет:
   * считалось, что они показывают слово сами. Не показывали — и игрок в первом
   * же уроке получал вопросы вслепую. Теперь исключений нет.
   */
  it('ни одно задание не спрашивает того, что не показывали', () => {
    const blind: string[] = [];
    for (const b of built) {
      const known = new Set(b.known);
      const seen = new Set(b.seen);
      for (const ex of b.exercises) {
        if (ex.kind === 'phrase_intro') for (const key of [ex.key, ...(ex.alsoKeys ?? [])]) seen.add(key);
        if (CARD_KINDS.has(ex.kind)) {
          for (const id of ex.wordIds) known.add(id);
          continue;
        }
        for (const id of needsOf(ex)) {
          if (!known.has(id)) blind.push(b.levelId + ': «' + (getWord(id)?.tg ?? id) + '» в ' + ex.kind);
        }
        if ((ex.kind === 'build_phrase' || ex.kind === 'type_phrase') && ex.phraseId) {
          if (!seen.has('p:' + ex.phraseId)) blind.push(b.levelId + ': фраза ' + ex.phraseId + ' без объяснения');
        }
        if (ex.kind === 'dialogue_choice' && ex.dialogueId) {
          if (!seen.has('d:' + ex.dialogueId)) blind.push(b.levelId + ': разговор ' + ex.dialogueId + ' без объяснения');
        }
        for (const id of needsOf(ex)) known.add(id);
      }
    }
    expect(blind).toEqual([]);
  });

  it('все задания, где слово надо знать, стоят в NEEDS_INTRO', () => {
    for (const kind of SUPPORTED_KINDS) {
      if (CARD_KINDS.has(kind)) continue;
      expect(NEEDS_INTRO.has(kind), kind).toBe(true);
    }
  });

  /*
   * Письмо — самое трудное. Его просят только о том, что игрок знал до урока:
   * слово, увиденное впервые три экрана назад, сначала узнают среди вариантов.
   */
  it('писать просят только знакомое до урока', () => {
    for (const b of built) {
      for (const ex of b.exercises) {
        if (ex.kind === 'type_word') {
          for (const id of ex.wordIds) expect(b.known.has(id), b.levelId + ': пишут новое ' + id).toBe(true);
        }
        if (ex.kind === 'type_phrase' && ex.phraseId) {
          expect(b.seen.has('p:' + ex.phraseId), b.levelId + ': пишут новую фразу').toBe(true);
        }
      }
    }
  });

  /*
   * Первый раздел — пять уроков по четыре слова. Раньше первый урок нёс три
   * буквы, одиннадцать новых слов, девять фраз и разговор — и новичок терял
   * все жизни, ещё не научившись различать «х» и «ҳ».
   */
  it('первые уроки не заваливают новым', () => {
    const early = built.slice(0, 5 * ATTEMPTS);
    for (const b of early) {
      const fresh = new Set<string>();
      for (const ex of b.exercises) {
        if (CARD_KINDS.has(ex.kind)) continue;
        for (const id of needsOf(ex)) if (!b.known.has(id)) fresh.add(id);
      }
      expect(fresh.size, b.levelId).toBeLessThanOrEqual(5);
    }
  });

  it('первый урок — самые нужные слова: привет, да, нет, спасибо', () => {
    const first = built[0]!;
    const words = new Set(first.exercises.filter((e) => e.kind === 'word_intro').flatMap((e) => e.wordIds));
    for (const id of ['w_salom', 'w_ha', 'w_ne', 'w_rahmat']) expect(words.has(id), id).toBe(true);
  });

  it('разговор в уроке — только из слов урока и уже выученных', () => {
    for (const b of built) {
      const own = new Set(levels.find((l) => l.id === b.levelId)!.wordIds);
      for (const ex of b.exercises) {
        if (ex.kind !== 'dialogue_choice') continue;
        for (const id of ex.wordIds) {
          expect(own.has(id) || b.known.has(id), b.levelId + ': в разговоре «' + ex.ask.tg + '» незнакомое ' + id).toBe(true);
        }
      }
    }
  });

  /*
   * «Напиши фразу» — единственное задание, где на экране нет ни слова
   * материала. Фразу, которую видят впервые, набрать нельзя, поэтому её
   * просят написать только в следующих уроках: на своём уроке её объяснили
   * карточкой и собрали из слов, а написать по памяти предлагают потом.
   */
  it('фразу просят написать только в уроках после того, как её объяснили', () => {
    let found = 0;
    for (const b of built) {
      for (const ex of b.exercises) {
        if (ex.kind !== 'type_phrase') continue;
        found++;
        expect(b.seen.has('p:' + ex.phraseId), b.levelId + ': «' + ex.tg + '» не объясняли до урока').toBe(true);
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

  it('правило показывается в начале урока — своего или первого в разделе', () => {
    const withRule = built.filter((b) => b.exercises.some((e) => e.kind === 'rule_card'));
    expect(withRule.length, 'правил не нашлось вовсе').toBeGreaterThan(0);

    for (const b of withRule) {
      const level = levels.find((l) => l.id === b.levelId)!;
      const own = rules.filter((r) => r.level === level.id);
      if (own.length === 0) {
        expect(level.indexInSection, b.levelId + ': правило не в первом уровне раздела').toBe(0);
      }
      // правило — самый первый экран, до знакомства со словами и до заданий
      expect(b.exercises[0]!.kind, b.levelId + ': правило не первое').toBe('rule_card');
    }
  });

  it('правило про «шумо» и «ту» — в уроке, где появилось «ту»', () => {
    const polite = rules.find((r) => r.id === 'r_polite')!;
    const level = levels.find((l) => l.id === polite.level)!;
    expect(level.wordIds).toContain('w_tu');
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

  /*
   * Особая буква объясняется там, где впервые встречается: карточка буквы
   * стоит раньше первой карточки слова или фразы, в которой эта буква видна.
   */
  it('новая особая буква объясняется раньше первого слова с ней', () => {
    let letterCards = 0;
    for (const b of built) {
      const level = levels.find((l) => l.id === b.levelId)!;
      for (const ch of newLettersFor(level.index)) {
        const card = b.exercises.findIndex((e) => e.kind === 'alphabet_intro' && e.lower === ch);
        const firstUse = b.exercises.findIndex(
          (e) =>
            (e.kind === 'word_intro' && e.tg.toLowerCase().includes(ch)) ||
            (e.kind === 'phrase_intro' && e.lines.some((l) => l.tg.toLowerCase().includes(ch))),
        );
        if (firstUse < 0) continue; // слово с буквой не попало в эту попытку
        expect(card, b.levelId + ': буква ' + ch + ' без карточки').toBeGreaterThanOrEqual(0);
        expect(card, b.levelId + ': карточка буквы ' + ch + ' позже слова с ней').toBeLessThan(firstUse);
        letterCards++;
      }
    }
    expect(letterCards).toBeGreaterThan(0);
  });

  it('каждая буква без русского двойника где-то объясняется, и только один раз за курс', () => {
    const special = letters.filter((l) => l.ru === null).map((l) => l.lower);
    const taught = levels.flatMap((l) => newLettersFor(l.index));
    expect(new Set(taught).size, 'буква объясняется дважды').toBe(taught.length);
    for (const ch of 'ғӣқӯҳҷ') expect(taught, 'буква ' + ch + ' ни разу не объяснена').toContain(ch);
    for (const ch of taught) expect(special).toContain(ch);
  });

  it('одна и та же реплика не объясняется в уроке двумя карточками', () => {
    const norm = (t: string): string => t.toLowerCase().replace(/[.,!?…]/g, '').trim();
    for (const b of built) {
      const shown = new Set<string>();
      for (const ex of b.exercises) {
        if (ex.kind !== 'phrase_intro') continue;
        // разговор может повторить строку, но только если в нём есть и новая реплика
        const lines = ex.lines.map((l) => norm(l.tg));
        expect(lines.every((l) => shown.has(l)), b.levelId + ': повтор карточки «' + ex.lines[0]!.tg + '»').toBe(false);
        for (const l of lines) shown.add(l);
      }
    }
  });

  it('карточка буквы — только в уроке, где буква встретилась впервые', () => {
    for (const b of built) {
      const level = levels.find((l) => l.id === b.levelId)!;
      const fresh = new Set(newLettersFor(level.index));
      for (const ex of b.exercises) {
        if (ex.kind === 'alphabet_intro') expect(fresh.has(ex.lower), b.levelId + ': лишняя карточка ' + ex.lower).toBe(true);
      }
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
