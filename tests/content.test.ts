/**
 * Интеграционный тест на реальном контенте курса.
 * Проверяет не код по отдельности, а то, что из написанных слов и фраз
 * действительно собираются играбельные уровни — все 103.
 */
import { describe, expect, it } from 'vitest';
import {
  allPhrases,
  allWords,
  contentStats,
  getPhrase,
  getWord,
  letters,
  levels,
  sections,
} from '../src/data/content';
import { tokenize } from '../src/domain/answer';
import {
  buildLevelExercises,
  CARD_KINDS,
  makePool,
  MAX_EXERCISES,
  MIN_EXERCISES,
} from '../src/game/generators';
import { isSupported } from '../src/game/registry';

const TAJIK_LETTERS = 'абвгғдеёжзиӣйкқлмнопрстуӯфхҳчҷшъэюя';
const ALLOWED = new Set([...TAJIK_LETTERS, ...TAJIK_LETTERS.toUpperCase(), ...' -–—?!.,:;()«»…0123456789']);

function poolFor(level: (typeof levels)[number]) {
  return makePool(
    level.wordIds.map(getWord).filter((w): w is NonNullable<typeof w> => Boolean(w)),
    level.phraseIds.map(getPhrase).filter((p): p is NonNullable<typeof p> => Boolean(p)),
    allWords(),
  );
}

describe('контент загрузился', () => {
  const stats = contentStats();

  it('разделы и уровни на месте', () => {
    expect(stats.sections).toBe(20);
    expect(stats.levels).toBe(103);
  });

  /*
   * Раньше курс открывался разделом «Алфавит»: пять уроков слов, подобранных
   * ради букв, — «хуб, хуш, худ», «ғоз, ғор», «чӣ, кӣ, сӣ». Похожие друг на друга,
   * случайные по смыслу, и до первого «салом» — пять уроков. Теперь буквы
   * объясняются по ходу, а начинается курс с того, что пригодится сразу.
   */
  it('курс начинается с приветствий, а не с алфавита', () => {
    expect(sections[0]?.title).toBe('Приветствия');
    expect(levels[0]?.wordIds).toContain('w_salom');
    expect(sections.some((sec) => sec.title === 'Алфавит')).toBe(false);
  });

  it('объём словаря не меньше заявленного', () => {
    expect(stats.words).toBeGreaterThanOrEqual(400);
    expect(stats.phrases).toBeGreaterThanOrEqual(150);
  });

  it('в алфавите 35 букв и шесть из них особые', () => {
    expect(letters).toHaveLength(35);
    expect(letters.filter((l) => l.special).map((l) => l.lower).join('')).toBe('ғӣқӯҳҷ');
  });

  it('у каждой буквы есть слова-примеры, и они существуют', () => {
    for (const letter of letters) {
      expect(letter.examples?.length ?? 0).toBeGreaterThan(0);
      for (const id of letter.examples ?? []) {
        expect(getWord(id), 'пример ' + id + ' для буквы ' + letter.lower).toBeDefined();
      }
    }
  });

  it('пример каждой буквы действительно содержит эту букву', () => {
    for (const letter of letters) {
      for (const id of letter.examples ?? []) {
        const word = getWord(id);
        expect(word?.tg.toLowerCase()).toContain(letter.lower);
      }
    }
  });
});

/* ————————————————————————— похожие слова ————————————————————————— */

/** Расстояние Левенштейна: сколько букв надо поменять, вставить или убрать. */
function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur.push(Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1)));
    }
    prev = cur;
  }
  return prev[b.length]!;
}

/**
 * Пары, которым место рядом: числа учат рядом, как считают, а «июн» и «июл»
 * похожи и по-русски. Всё остальное, что отличается одной буквой, — разводим
 * по разным урокам.
 */
const NEIGHBOURS = new Set(['ҳафт/ҳашт', 'июн/июл']);

describe('похожие слова не вводятся вместе', () => {
  /*
   * Короткие слова, отличающиеся одной буквой, в одном уроке — главный
   * источник путаницы у новичка: «хуб» и «хуш», «бо» и «бе», «ин» и «он»
   * запоминаются как одно пятно. Порознь каждое держится.
   */
  it('в одном уроке нет двух новых слов, отличающихся одной буквой', () => {
    const met = new Set<string>();
    const found: string[] = [];
    for (const level of levels) {
      const fresh = level.wordIds.filter((id) => !met.has(id));
      for (let i = 0; i < fresh.length; i++) {
        for (let j = i + 1; j < fresh.length; j++) {
          const a = getWord(fresh[i]!)!.tg.toLowerCase();
          const b = getWord(fresh[j]!)!.tg.toLowerCase();
          if (Math.min(a.length, b.length) > 5 || distance(a, b) > 1) continue;
          if (NEIGHBOURS.has(a + '/' + b) || NEIGHBOURS.has(b + '/' + a)) continue;
          found.push(level.id + ': ' + a + ' / ' + b);
        }
      }
      for (const id of level.wordIds) met.add(id);
    }
    expect(found).toEqual([]);
  });
});

describe('качество словаря', () => {
  it('идентификаторы уникальны', () => {
    const ids = allWords().map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
    const pids = allPhrases().map((p) => p.id);
    expect(new Set(pids).size).toBe(pids.length);
  });

  it('в таджикских написаниях нет букв ц щ ы ь', () => {
    const bad: string[] = [];
    for (const w of allWords()) {
      for (const ch of w.tg) if (!ALLOWED.has(ch)) bad.push(w.id + ': ' + ch);
    }
    for (const p of allPhrases()) {
      for (const ch of p.tg) if (!ALLOWED.has(ch)) bad.push(p.id + ': ' + ch);
    }
    expect(bad).toEqual([]);
  });

  it('все строки нормализованы в NFC', () => {
    for (const w of allWords()) expect(w.tg).toBe(w.tg.normalize('NFC'));
    for (const p of allPhrases()) expect(p.tg).toBe(p.tg.normalize('NFC'));
  });

  it('переводы и написания не пустые', () => {
    for (const w of allWords()) {
      expect(w.tg.trim().length).toBeGreaterThan(0);
      expect(w.ru.trim().length).toBeGreaterThan(0);
    }
  });

  it('ссылки фраз на слова ведут к существующим словам', () => {
    for (const p of allPhrases()) {
      for (const id of p.words ?? []) {
        expect(getWord(id), p.id + ' ссылается на ' + id).toBeDefined();
      }
    }
  });

  it('поле audio везде пустое — озвучки пока нет, но место под неё есть', () => {
    for (const w of allWords()) expect(w.audio ?? null).toBeNull();
  });
});

describe('уровни собираются', () => {
  it('во всех уровнях есть слова или фразы', () => {
    const empty = levels.filter((l) => !l.playable).map((l) => l.id);
    expect(empty).toEqual([]);
  });

  it('все ссылки уровней на контент разрешаются', () => {
    for (const level of levels) {
      for (const id of level.wordIds) expect(getWord(id), level.id + ' -> ' + id).toBeDefined();
      for (const id of level.phraseIds) expect(getPhrase(id), level.id + ' -> ' + id).toBeDefined();
    }
  });

  it('каждый уровень даёт от 6 до 10 заданий', () => {
    const broken: string[] = [];
    for (const level of levels) {
      // карточки знакомства — не задания: считаем только то, где можно ошибиться
      const list = buildLevelExercises(poolFor(level), level.id + ':0').filter(
        (ex) => !CARD_KINDS.has(ex.kind),
      );
      if (list.length < MIN_EXERCISES || list.length > MAX_EXERCISES) {
        broken.push(level.id + ' -> ' + list.length);
      }
    }
    expect(broken).toEqual([]);
  });

  it('все сгенерированные типы заданий поддерживаются движком', () => {
    for (const level of levels.slice(0, 30)) {
      for (const ex of buildLevelExercises(poolFor(level), level.id + ':0')) {
        expect(isSupported(ex.kind), ex.kind + ' в уровне ' + level.id).toBe(true);
      }
    }
  });

  it('повторное прохождение любого уровня тоже собирается', () => {
    for (const level of levels) {
      for (const attempt of [1, 2, 3]) {
        const list = buildLevelExercises(poolFor(level), level.id + ':' + attempt);
        expect(list.length, level.id + ' попытка ' + attempt).toBeGreaterThanOrEqual(MIN_EXERCISES);
      }
    }
  });

  it('в квизах верный вариант всегда на месте', () => {
    for (const level of levels) {
      for (const ex of buildLevelExercises(poolFor(level), level.id + ':0')) {
        if (ex.kind !== 'quiz_tg_ru' && ex.kind !== 'quiz_ru_tg') continue;
        expect(ex.options).toHaveLength(4);
        expect(ex.options[ex.correct]).toBeTruthy();
        expect(new Set(ex.options).size).toBe(4);
      }
    }
  });

  it('в «собери фразу» банк всегда содержит верный ответ', () => {
    for (const level of levels) {
      for (const ex of buildLevelExercises(poolFor(level), level.id + ':0')) {
        if (ex.kind !== 'build_phrase') continue;
        const bank = [...ex.bank];
        for (const token of ex.answer) {
          const i = bank.indexOf(token);
          expect(i, ex.ru + ' -> нет слова ' + token).toBeGreaterThanOrEqual(0);
          bank.splice(i, 1);
        }
        expect(ex.answer).toEqual(tokenize(ex.tg));
      }
    }
  });

  it('в колесе букв все слова собираются из выданных букв', () => {
    for (const level of levels) {
      for (const ex of buildLevelExercises(poolFor(level), level.id + ':0')) {
        if (ex.kind !== 'letter_wheel') continue;
        for (const target of ex.targets) {
          const pool = [...ex.letters];
          for (const ch of target.tg) {
            const i = pool.indexOf(ch);
            expect(i, target.tg + ': не хватает буквы ' + ch).toBeGreaterThanOrEqual(0);
            pool.splice(i, 1);
          }
        }
      }
    }
  });

  it('в «найди пары» нет одинаковых переводов', () => {
    for (const level of levels) {
      for (const ex of buildLevelExercises(poolFor(level), level.id + ':0')) {
        if (ex.kind !== 'match_pairs') continue;
        const rus = ex.pairs.map((p) => p.ru.toLowerCase());
        const tgs = ex.pairs.map((p) => p.tg.toLowerCase());
        expect(new Set(rus).size, level.id).toBe(rus.length);
        expect(new Set(tgs).size, level.id).toBe(tgs.length);
      }
    }
  });
});
