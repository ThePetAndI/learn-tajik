import { describe, expect, it } from 'vitest';
import { mulberry32, rngFor } from '../src/core/rng';
import type { Phrase, Word } from '../src/data/content';
import { tokenize } from '../src/domain/answer';
import {
  MAX_EXERCISES,
  MIN_EXERCISES,
  buildLevelExercises,
  makeBuildPhrase,
  makeLetterWheel,
  makeMatchPairs,
  makePool,
  makeQuiz,
} from '../src/game/generators';
import { canSpell, letterCounts } from '../src/game/generators/pool';
import type { BuildPhraseExercise, LetterWheelExercise, MatchPairsExercise, QuizExercise } from '../src/game/types';

const word = (id: string, tg: string, ru: string, theme = 'greetings'): Word => ({
  id,
  tg,
  ru,
  pos: 'noun',
  theme,
  audio: null,
  verified: true,
});

const VOCAB: Word[] = [
  word('w_salom', 'салом', 'привет'),
  word('w_khayr', 'хайр', 'пока'),
  word('w_mo', 'мо', 'мы'),
  word('w_man', 'ман', 'я'),
  word('w_shumo', 'шумо', 'вы'),
  word('w_nom', 'ном', 'имя'),
  word('w_dust', 'дӯст', 'друг'),
  word('w_ruz', 'рӯз', 'день'),
  word('w_shab', 'шаб', 'ночь'),
  word('w_padar', 'падар', 'отец', 'family'),
  word('w_modar', 'модар', 'мать', 'family'),
  word('w_dar', 'дар', 'в', 'family'),
  word('w_barodar', 'бародар', 'брат', 'family'),
  word('w_khohar', 'хоҳар', 'сестра', 'family'),
];

const PHRASES: Phrase[] = [
  { id: 'p_1', tg: 'Субҳ ба хайр!', ru: 'Доброе утро!', theme: 'greetings', words: ['w_khayr'], verified: true },
  { id: 'p_2', tg: 'Шаб ба хайр!', ru: 'Спокойной ночи!', theme: 'greetings', words: ['w_shab'], verified: true },
  { id: 'p_3', tg: 'Номи шумо чист?', ru: 'Как вас зовут?', theme: 'greetings', words: ['w_nom'], verified: true },
];

function pool(words: Word[] = VOCAB.slice(0, 5), phrases: Phrase[] = PHRASES) {
  return makePool(words, phrases, VOCAB);
}

describe('квиз', () => {
  it('даёт четыре варианта с верным среди них', () => {
    const ex = makeQuiz(pool(), VOCAB[0] as Word, 'tg_ru', mulberry32(1)) as QuizExercise;
    expect(ex).not.toBeNull();
    expect(ex.options).toHaveLength(4);
    expect(ex.options[ex.correct]).toBe('привет');
    expect(ex.prompt).toBe('салом');
    expect(ex.wordIds).toEqual(['w_salom']);
  });

  it('обратное направление спрашивает таджикское слово', () => {
    const ex = makeQuiz(pool(), VOCAB[0] as Word, 'ru_tg', mulberry32(2)) as QuizExercise;
    expect(ex.kind).toBe('quiz_ru_tg');
    expect(ex.prompt).toBe('привет');
    expect(ex.options[ex.correct]).toBe('салом');
  });

  it('варианты не повторяются', () => {
    for (let seed = 1; seed < 40; seed++) {
      const ex = makeQuiz(pool(), VOCAB[1] as Word, 'tg_ru', mulberry32(seed)) as QuizExercise;
      expect(new Set(ex.options).size).toBe(ex.options.length);
    }
  });

  it('неверные варианты берутся из той же темы, пока их хватает', () => {
    const target = VOCAB.find((w) => w.id === 'w_padar') as Word;
    const familyPool = makePool([target], [], VOCAB);
    const themeWords = VOCAB.filter((w) => w.theme === 'family').map((w) => w.ru);
    for (let seed = 1; seed < 20; seed++) {
      const ex = makeQuiz(familyPool, target, 'tg_ru', mulberry32(seed)) as QuizExercise;
      const others = ex.options.filter((o) => o !== 'отец');
      expect(others.every((o) => themeWords.includes(o))).toBe(true);
    }
  });

  it('если слов темы не хватает, добирает из остального словаря', () => {
    const target = word('w_solo', 'танҳо', 'один-единственный', 'rare');
    const vocab = [target, ...VOCAB];
    const ex = makeQuiz(makePool([target], [], vocab), target, 'tg_ru', mulberry32(1));
    expect(ex).not.toBeNull();
    expect((ex as QuizExercise).options).toHaveLength(4);
  });

  it('без материала для вариантов возвращает null', () => {
    const lonely = word('w_x', 'ягона', 'единственный', 'nowhere');
    expect(makeQuiz(makePool([lonely], [], [lonely]), lonely, 'tg_ru', mulberry32(1))).toBeNull();
  });
});

describe('найди пары', () => {
  it('собирает не меньше четырёх пар', () => {
    const ex = makeMatchPairs(pool(), mulberry32(1)) as MatchPairsExercise;
    expect(ex).not.toBeNull();
    expect(ex.pairs.length).toBeGreaterThanOrEqual(4);
  });

  it('не допускает одинаковых переводов — иначе задание нерешаемо', () => {
    const dup = [
      word('w_a', 'хуб', 'хорошо'),
      word('w_b', 'нағз', 'хорошо'),
      word('w_c', 'бад', 'плохо'),
      word('w_d', 'салом', 'привет'),
      word('w_e', 'хайр', 'пока'),
    ];
    for (let seed = 1; seed < 30; seed++) {
      const ex = makeMatchPairs(makePool(dup, [], dup), mulberry32(seed));
      if (!ex) continue;
      const rus = (ex as MatchPairsExercise).pairs.map((p) => p.ru);
      expect(new Set(rus).size).toBe(rus.length);
    }
  });

  it('на двух словах не собирается', () => {
    const small = VOCAB.slice(0, 2);
    expect(makeMatchPairs(makePool(small, [], small), mulberry32(1))).toBeNull();
  });

  it('добирает слова темы, если в уровне их мало', () => {
    const ex = makeMatchPairs(makePool(VOCAB.slice(0, 2), [], VOCAB), mulberry32(5));
    expect(ex).not.toBeNull();
    expect((ex as MatchPairsExercise).pairs.length).toBeGreaterThanOrEqual(4);
  });
});

describe('собери фразу', () => {
  it('банк содержит все нужные слова и лишние сверху', () => {
    const ex = makeBuildPhrase(pool(), PHRASES[0] as Phrase, mulberry32(1)) as BuildPhraseExercise;
    expect(ex).not.toBeNull();
    expect(ex.answer).toEqual(tokenize('Субҳ ба хайр!'));
    for (const token of ex.answer) expect(ex.bank).toContain(token);
    expect(ex.bank.length).toBeGreaterThan(ex.answer.length);
  });

  it('лишние слова не совпадают с нужными', () => {
    for (let seed = 1; seed < 30; seed++) {
      const ex = makeBuildPhrase(pool(), PHRASES[2] as Phrase, mulberry32(seed)) as BuildPhraseExercise;
      const extra = [...ex.bank];
      for (const token of ex.answer) extra.splice(extra.indexOf(token), 1);
      for (const e of extra) {
        expect(ex.answer.map((t) => t.toLowerCase())).not.toContain(e.toLowerCase());
      }
    }
  });

  it('фраза из одного слова не годится', () => {
    const single: Phrase = { id: 'p_x', tg: 'Салом', ru: 'Привет', theme: 'greetings', verified: true };
    expect(makeBuildPhrase(pool(), single, mulberry32(1))).toBeNull();
  });

  it('слишком длинная фраза не годится', () => {
    const long: Phrase = {
      id: 'p_y',
      tg: 'як ду се чор панҷ шаш ҳафт ҳашт',
      ru: 'один два три четыре пять шесть семь восемь',
      theme: 'num',
      verified: true,
    };
    expect(makeBuildPhrase(pool(), long, mulberry32(1))).toBeNull();
  });
});

describe('колесо букв', () => {
  it('все цели собираются из букв колеса', () => {
    const ex = makeLetterWheel(pool(VOCAB.slice(0, 6)), mulberry32(1)) as LetterWheelExercise;
    expect(ex).not.toBeNull();
    const available = letterCounts(ex.letters.join(''));
    for (const target of ex.targets) {
      expect(canSpell(target.tg, available)).toBe(true);
    }
  });

  it('целей минимум две, иначе это не головоломка', () => {
    const ex = makeLetterWheel(pool(VOCAB.slice(0, 6)), mulberry32(1)) as LetterWheelExercise;
    expect(ex.targets.length).toBeGreaterThanOrEqual(2);
  });

  it('ключевое слово есть среди целей', () => {
    const ex = makeLetterWheel(pool(VOCAB.slice(0, 6)), mulberry32(7)) as LetterWheelExercise;
    const longest = ex.targets.reduce((a, b) => (b.tg.length > a.tg.length ? b : a));
    expect(longest.tg.length).toBe(ex.letters.length);
  });

  it('цели не повторяются', () => {
    for (let seed = 1; seed < 20; seed++) {
      const ex = makeLetterWheel(pool(VOCAB), mulberry32(seed));
      if (!ex) continue;
      const tgs = (ex as LetterWheelExercise).targets.map((t) => t.tg);
      expect(new Set(tgs).size).toBe(tgs.length);
    }
  });

  it('если подходящих слов нет — возвращает null', () => {
    const odd = [word('w_z', 'зумуррад', 'изумруд', 'x')];
    expect(makeLetterWheel(makePool(odd, [], odd), mulberry32(1))).toBeNull();
  });
});

describe('canSpell', () => {
  it('учитывает количество одинаковых букв', () => {
    const available = letterCounts('салом');
    expect(canSpell('мо', available)).toBe(true);
    expect(canSpell('сом', available)).toBe(true);
    expect(canSpell('мама', available)).toBe(false);
  });
});

describe('сборка уровня', () => {
  const p = pool(VOCAB.slice(0, 6), PHRASES);

  it('длина в заданных рамках', () => {
    const list = buildLevelExercises(p, 's01_l1:0');
    expect(list.length).toBeGreaterThanOrEqual(MIN_EXERCISES);
    expect(list.length).toBeLessThanOrEqual(MAX_EXERCISES);
  });

  it('каждое слово уровня встречается хотя бы раз', () => {
    const list = buildLevelExercises(p, 's01_l1:0');
    const covered = new Set(list.flatMap((ex) => ex.wordIds));
    for (const w of p.words) expect(covered.has(w.id)).toBe(true);
  });

  it('типы заданий разные, а не один квиз десять раз', () => {
    const kinds = new Set(buildLevelExercises(p, 's01_l1:0').map((ex) => ex.kind));
    expect(kinds.size).toBeGreaterThanOrEqual(3);
  });

  it('один seed — одна и та же сборка', () => {
    expect(buildLevelExercises(p, 's01_l1:0')).toEqual(buildLevelExercises(p, 's01_l1:0'));
  });

  it('повторное прохождение собирается иначе', () => {
    expect(buildLevelExercises(p, 's01_l1:0')).not.toEqual(buildLevelExercises(p, 's01_l1:1'));
  });

  it('пустой уровень даёт пустой список, а не падение', () => {
    expect(buildLevelExercises(makePool([], [], VOCAB), 'x')).toEqual([]);
  });

  it('уровень из одних фраз собирается только из фраз', () => {
    const list = buildLevelExercises(makePool([], PHRASES, VOCAB), 'p:0');
    expect(list.length).toBeGreaterThan(0);
    // ни пар, ни колеса: своих слов у уровня нет, чужие подставлять нельзя
    expect(list.every((ex) => ex.kind === 'build_phrase')).toBe(true);
  });

  it('на разных ключах стабильно укладывается в рамки', () => {
    for (let i = 0; i < 40; i++) {
      const list = buildLevelExercises(p, 'lvl:' + i);
      expect(list.length).toBeGreaterThanOrEqual(MIN_EXERCISES);
      expect(list.length).toBeLessThanOrEqual(MAX_EXERCISES);
    }
  });

  it('rngFor и сборка согласованы по ключу', () => {
    expect(rngFor('s01_l1:0')()).toBe(rngFor('s01_l1:0')());
  });
});
