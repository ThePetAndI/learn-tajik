import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/rng';
import type { Dialogue, Izafet, Letter, Phrase, Word } from '../src/data/content';
import { isSpecialLetter, lookalikesOf } from '../src/domain/answer';
import {
  makeAlphabetIntro,
  makeCategorySort,
  makeDialogue,
  makeIzafet,
  makeMissingLetter,
  makeNumberWord,
  makeOddOneOut,
  makePool,
  makeTrueFalse,
  makeTypePhrase,
  makeTypeWord,
} from '../src/game/generators';
import type {
  AlphabetIntroExercise,
  CategorySortExercise,
  DialogueChoiceExercise,
  IzafetBuilderExercise,
  MissingLetterExercise,
  OddOneOutExercise,
  TrueFalseExercise,
  TypePhraseExercise,
  TypeWordExercise,
} from '../src/game/types';

const word = (
  id: string,
  tg: string,
  ru: string,
  theme = 'greetings',
  extra: Partial<Word> = {},
): Word => ({ id, tg, ru, pos: 'noun', theme, audio: null, verified: true, ...extra });

const GREET: Word[] = [
  word('w_salom', 'салом', 'привет'),
  word('w_khayr', 'хайр', 'пока'),
  word('w_nom', 'ном', 'имя'),
  word('w_dust', 'дӯст', 'друг'),
  word('w_rahmat', 'раҳмат', 'спасибо'),
];

const FAMILY: Word[] = [
  word('w_padar', 'падар', 'отец', 'family'),
  word('w_modar', 'модар', 'мать', 'family'),
  word('w_barodar', 'бародар', 'брат', 'family'),
  word('w_khohar', 'хоҳар', 'сестра', 'family'),
];

const NUMS: Word[] = [
  word('w_yak', 'як', 'один', 'num', { pos: 'num', num: 1 }),
  word('w_haft', 'ҳафт', 'семь', 'num', { pos: 'num', num: 7 }),
  word('w_sad', 'сад', 'сто', 'num', { pos: 'num', num: 100 }),
];

const VOCAB = [...GREET, ...FAMILY, ...NUMS];

const PHRASES: Phrase[] = [
  { id: 'p_1', tg: 'Субҳ ба хайр!', ru: 'Доброе утро!', theme: 'greetings', words: [], verified: true },
];

function pool(words: Word[] = GREET, extras: Parameters<typeof makePool>[3] = {}) {
  return makePool(words, PHRASES, VOCAB, {
    themeTitles: { greetings: 'Приветствия', family: 'Семья', num: 'Числа' },
    ...extras,
  });
}

const rng = () => mulberry32(7);

/* ————————————————————————— напиши слово ————————————————————————— */

describe('напиши слово', () => {
  it('берёт короткое слово из одной части', () => {
    const ex = makeTypeWord(pool(), GREET[0] as Word, rng()) as TypeWordExercise;
    expect(ex.tg).toBe('салом');
    expect(ex.ru).toBe('привет');
  });

  it('отказывается от составных слов: их набирать мучительно', () => {
    expect(makeTypeWord(pool(), word('w_x', 'гап задан', 'говорить'), rng())).toBeNull();
  });

  it('отказывается от длинных слов', () => {
    expect(makeTypeWord(pool(), word('w_x', 'муносибатҳо', 'отношения'), rng())).toBeNull();
  });

  it('не берёт слово с несколькими переводами — набирать нечего', () => {
    expect(makeTypeWord(pool(), word('w_x', 'нағз', 'хороший, хорошо'), rng())).toBeNull();
  });
});

/* ————————————————————————— напиши фразу ————————————————————————— */

const phrase = (tg: string, ru = 'Доброе утро!', extra: Partial<Phrase> = {}): Phrase => ({
  id: 'p_x',
  tg,
  ru,
  theme: 'greetings',
  words: ['w_khayr'],
  verified: true,
  ...extra,
});

describe('напиши фразу', () => {
  it('разбирает эталон на слова: по ним рисуются ячейки', () => {
    const ex = makeTypePhrase(pool(), phrase('Субҳ ба хайр!'), rng()) as TypePhraseExercise;
    expect(ex.answer).toEqual(['Субҳ', 'ба', 'хайр']);
    // знаки препинания в ячейки не попадают, а в эталоне остаются
    expect(ex.tg).toBe('Субҳ ба хайр!');
  });

  it('отказывается от длинных фраз: их набирают, а не переводят', () => {
    expect(makeTypePhrase(pool(), phrase('Ман ҳар рӯз забони тоҷикиро меомӯзам'), rng())).toBeNull();
  });

  it('отказывается от одного слова — это уже «напиши слово»', () => {
    expect(makeTypePhrase(pool(), phrase('Салом!'), rng())).toBeNull();
  });

  /*
   * Самое строгое задание курса не имеет права опираться на форму,
   * в которой мы сами не уверены: ошибкой будет засчитано отклонение
   * от строки, которую ещё не проверил носитель.
   */
  it('не берёт непроверенную фразу', () => {
    expect(makeTypePhrase(pool(), phrase('Субҳ ба хайр!', 'Доброе утро!', { verified: false }), rng()))
      .toBeNull();
  });

  it('разбирает и запасные переводы — по ним ответ тоже засчитают', () => {
    const ex = makeTypePhrase(
      pool(),
      phrase('Ман ба хона меравам.', 'Я иду домой.', { alt: ['Ба хона меравам.'] }),
      rng(),
    ) as TypePhraseExercise;
    expect(ex.alt).toEqual([['Ба', 'хона', 'меравам']]);
  });

  it('без поля alt его нет и в задании', () => {
    const ex = makeTypePhrase(pool(), phrase('Субҳ ба хайр!'), rng()) as TypePhraseExercise;
    expect(ex.alt).toBeUndefined();
  });
});

/* ————————————————————————— пропущенная буква ————————————————————————— */

describe('пропущенная буква', () => {
  it('вырезает особую букву, когда она есть', () => {
    const ex = makeMissingLetter(pool(), word('w_x', 'раҳмат', 'спасибо'), rng()) as MissingLetterExercise;
    expect(ex.before + ex.after).toBe('рамат');
    expect(ex.options[ex.correct]).toBe('ҳ');
    expect(ex.special).toBe(true);
  });

  it('среди вариантов есть похожая буква, а не случайные', () => {
    const ex = makeMissingLetter(pool(), word('w_x', 'раҳмат', 'спасибо'), rng()) as MissingLetterExercise;
    expect(ex.options).toContain('х');
  });

  it('варианты не повторяются и содержат верный', () => {
    for (const w of VOCAB) {
      const ex = makeMissingLetter(pool(), w, rng());
      if (!ex) continue;
      expect(new Set(ex.options).size).toBe(ex.options.length);
      expect(ex.correct).toBeGreaterThanOrEqual(0);
      expect(ex.options[ex.correct]).toBeTruthy();
    }
  });

  it('слово целиком восстанавливается из частей и ответа', () => {
    const ex = makeMissingLetter(pool(), word('w_x', 'китоб', 'книга'), rng()) as MissingLetterExercise;
    expect(ex.before + ex.options[ex.correct] + ex.after).toBe('китоб');
  });

  it('слишком короткое слово не берём', () => {
    expect(makeMissingLetter(pool(), word('w_x', 'мо', 'мы'), rng())).toBeNull();
  });
});

/* ————————————————————————— правда или ложь ————————————————————————— */

describe('правда или ложь', () => {
  it('иногда даёт верную пару, иногда подставную', () => {
    const seen = new Set<boolean>();
    for (let i = 0; i < 30; i++) {
      const ex = makeTrueFalse(pool(), GREET[0] as Word, mulberry32(i)) as TrueFalseExercise;
      seen.add(ex.truth);
      if (ex.truth) expect(ex.ru).toBe(ex.realRu);
      else expect(ex.ru).not.toBe(ex.realRu);
    }
    expect(seen).toEqual(new Set([true, false]));
  });

  it('настоящий перевод сохранён — его показывают после ошибки', () => {
    for (let i = 0; i < 20; i++) {
      const ex = makeTrueFalse(pool(), GREET[1] as Word, mulberry32(i)) as TrueFalseExercise;
      expect(ex.realRu).toBe('пока');
    }
  });

  it('на ответ даётся ощутимое время', () => {
    const ex = makeTrueFalse(pool(), GREET[0] as Word, rng()) as TrueFalseExercise;
    expect(ex.seconds).toBeGreaterThanOrEqual(5);
  });
});

/* ————————————————————————— знакомство с буквой ————————————————————————— */

const letterHa: Letter = {
  lower: 'ҳ',
  upper: 'Ҳ',
  name: 'ҳе',
  sound: 'лёгкий выдох',
  ru: null,
  special: true,
  examples: ['w_rahmat'],
  verified: true,
};

describe('знакомство с буквой', () => {
  it('собирает карточку с примерами и проверкой', () => {
    const ex = makeAlphabetIntro(pool(), letterHa, rng()) as AlphabetIntroExercise;
    expect(ex.examples[0]?.tg).toBe('раҳмат');
    expect(ex.options[ex.correct]).toBe('ҳ');
  });

  it('среди плиток есть двойник буквы', () => {
    const ex = makeAlphabetIntro(pool(), letterHa, rng()) as AlphabetIntroExercise;
    expect(ex.options).toContain('х');
    expect(new Set(ex.options).size).toBe(ex.options.length);
  });

  it('примеры действительно содержат свою букву', () => {
    const ex = makeAlphabetIntro(pool(), letterHa, rng()) as AlphabetIntroExercise;
    for (const e of ex.examples) expect(e.tg.toLowerCase()).toContain('ҳ');
  });

  it('пример, в котором буквы нет, отбрасывается', () => {
    const broken: Letter = { ...letterHa, examples: ['w_salom'] };
    // в «салом» буквы ҳ нет — генератор ищет замену среди слов уровня
    const ex = makeAlphabetIntro(pool(), broken, rng());
    if (ex) for (const e of ex.examples) expect(e.tg.toLowerCase()).toContain('ҳ');
  });

  it('без примеров карточки не будет', () => {
    const lonely: Letter = { ...letterHa, lower: 'щ', upper: 'Щ', examples: [] };
    expect(makeAlphabetIntro(makePool([], [], []), lonely, rng())).toBeNull();
  });
});

/* ————————————————————————— лишнее слово ————————————————————————— */

describe('лишнее слово', () => {
  it('лишнее — из другой темы', () => {
    const ex = makeOddOneOut(pool(GREET, { priorWords: FAMILY }), rng()) as OddOneOutExercise;
    expect(ex.options).toHaveLength(4);
    const odd = ex.options[ex.correct];
    expect(FAMILY.some((w) => w.id === odd?.wordId)).toBe(true);
  });

  it('без пройденных слов задания нет: лишним оказалось бы просто незнакомое', () => {
    expect(makeOddOneOut(pool(GREET, { priorWords: [] }), rng())).toBeNull();
  });

  it('подписывает тему по-русски', () => {
    const ex = makeOddOneOut(pool(GREET, { priorWords: FAMILY }), rng()) as OddOneOutExercise;
    expect(ex.theme).toBe('Приветствия');
  });
});

/* ————————————————————————— выбери реплику ————————————————————————— */

const dialogue = (id: string, ask: string, reply: string): Dialogue => ({
  id,
  theme: 'greetings',
  ask: { tg: ask, ru: 'вопрос' },
  reply: { tg: reply, ru: 'ответ' },
  words: [],
  audio: null,
  verified: true,
});

const DIALOGUES = [
  dialogue('d_1', 'Салом!', 'Салом!'),
  dialogue('d_2', 'Аҳволат чӣ хел?', 'Раҳмат, нағз.'),
  dialogue('d_3', 'Хайр!', 'То боздид!'),
];

describe('выбери реплику', () => {
  it('три варианта, верный среди них', () => {
    const ex = makeDialogue(
      pool(GREET, { dialogues: DIALOGUES }),
      DIALOGUES[1] as Dialogue,
      rng(),
    ) as DialogueChoiceExercise;
    expect(ex.options).toHaveLength(3);
    expect(ex.options[ex.correct]?.tg).toBe('Раҳмат, нағз.');
  });

  it('неверные варианты — чужие реплики, а не выдумка', () => {
    const ex = makeDialogue(
      pool(GREET, { dialogues: DIALOGUES }),
      DIALOGUES[1] as Dialogue,
      rng(),
    ) as DialogueChoiceExercise;
    const others = ex.options.filter((_, i) => i !== ex.correct).map((o) => o.tg);
    for (const o of others) {
      expect(DIALOGUES.some((d) => d.reply.tg === o)).toBe(true);
    }
  });

  it('варианты не повторяются', () => {
    const ex = makeDialogue(
      pool(GREET, { dialogues: DIALOGUES }),
      DIALOGUES[0] as Dialogue,
      rng(),
    ) as DialogueChoiceExercise;
    expect(new Set(ex.options.map((o) => o.tg)).size).toBe(3);
  });

  it('свои неверные варианты из контента идут первыми', () => {
    const custom: Dialogue = {
      ...(DIALOGUES[0] as Dialogue),
      wrong: [{ tg: 'Шаб ба хайр!', ru: 'Спокойной ночи!' }],
    };
    const ex = makeDialogue(
      pool(GREET, { dialogues: DIALOGUES }),
      custom,
      rng(),
    ) as DialogueChoiceExercise;
    expect(ex.options.map((o) => o.tg)).toContain('Шаб ба хайр!');
  });
});

/* ————————————————————————— число и слово ————————————————————————— */

describe('число и слово', () => {
  it('берёт числовое значение из контента', () => {
    const ex = makeNumberWord(pool(NUMS), NUMS[1] as Word, rng());
    expect(ex?.value).toBe(7);
    expect(ex?.tg).toBe('ҳафт');
  });

  it('без поля num задания нет', () => {
    expect(makeNumberWord(pool(), GREET[0] as Word, rng())).toBeNull();
  });
});

/* ————————————————————————— по корзинам ————————————————————————— */

describe('по корзинам', () => {
  it('шесть слов поровну в двух корзинах', () => {
    const ex = makeCategorySort(
      pool(GREET, { priorWords: FAMILY }),
      rng(),
    ) as CategorySortExercise;
    expect(ex.items).toHaveLength(6);
    expect(ex.items.filter((i) => i.basket === 0)).toHaveLength(3);
    expect(ex.items.filter((i) => i.basket === 1)).toHaveLength(3);
  });

  it('корзины подписаны по-русски и разными словами', () => {
    const ex = makeCategorySort(
      pool(GREET, { priorWords: FAMILY }),
      rng(),
    ) as CategorySortExercise;
    expect(ex.baskets).toEqual(['Приветствия', 'Семья']);
  });

  it('слова лежат в своих корзинах', () => {
    const ex = makeCategorySort(
      pool(GREET, { priorWords: FAMILY }),
      rng(),
    ) as CategorySortExercise;
    for (const item of ex.items) {
      const w = VOCAB.find((v) => v.id === item.wordId) as Word;
      expect(w.theme).toBe(item.basket === 0 ? 'greetings' : 'family');
    }
  });

  it('без пройденной чужой темы задания нет', () => {
    expect(makeCategorySort(pool(GREET, { priorWords: [] }), rng())).toBeNull();
  });
});

/* ————————————————————————— изафет ————————————————————————— */

const izafet = (head: string, mod: string, tg: string): Izafet => ({
  id: 'iz_test',
  theme: 'family',
  head,
  mod,
  tg,
  ru: 'мой отец',
  words: ['w_padar'],
  audio: null,
  verified: true,
});

describe('изафет', () => {
  it('в банке есть оба слова и лишние', () => {
    const ex = makeIzafet(
      pool(FAMILY),
      izafet('падар', 'ман', 'падари ман'),
      rng(),
    ) as IzafetBuilderExercise;
    expect(ex.bank).toContain('падар');
    expect(ex.bank).toContain('ман');
    expect(ex.bank.length).toBeGreaterThan(2);
  });

  it('собранная форма совпадает с эталоном', () => {
    const ex = makeIzafet(
      pool(FAMILY),
      izafet('падар', 'ман', 'падари ман'),
      rng(),
    ) as IzafetBuilderExercise;
    expect(ex.head + ex.suffix + ' ' + ex.mod).toBe(ex.tg);
  });

  it('если эталон собирается иначе — задания нет, а не кривой ответ', () => {
    // «зиндагӣ» + изафет пишется «зиндагии», а не «зиндагӣи»:
    // склеить по общему правилу нельзя, значит задание не собирается
    expect(makeIzafet(pool(FAMILY), izafet('зиндагӣ', 'ман', 'зиндагии ман'), rng())).toBeNull();
  });

  it('склейка после гласной проходит: «чойи сабз» собирается как есть', () => {
    expect(makeIzafet(pool(FAMILY), izafet('чой', 'сабз', 'чойи сабз'), rng())).not.toBeNull();
  });

  it('составные части не берём', () => {
    expect(makeIzafet(pool(FAMILY), izafet('гап задан', 'ман', 'гап заданӣ ман'), rng())).toBeNull();
  });
});

/* ————————————————————————— общий инвариант ————————————————————————— */

describe('буквы-двойники', () => {
  it('у каждой особой буквы есть русский двойник', () => {
    for (const letter of ['ғ', 'ӣ', 'қ', 'ӯ', 'ҳ', 'ҷ']) {
      expect(isSpecialLetter(letter)).toBe(true);
      expect(lookalikesOf(letter).length).toBeGreaterThan(0);
    }
  });

  it('буква не считается двойником самой себя', () => {
    for (const letter of Object.keys({ ғ: 1, ҳ: 1, қ: 1, у: 1, х: 1 })) {
      expect(lookalikesOf(letter)).not.toContain(letter);
    }
  });
});
