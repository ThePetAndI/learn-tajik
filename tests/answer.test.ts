import { describe, expect, it } from 'vitest';
import {
  compareAnswer,
  compareTokens,
  foldTajik,
  hasSpecialLetters,
  isCorrect,
  normalizeAnswer,
  specialLettersOf,
  tokenize,
} from '../src/domain/answer';

describe('нормализация', () => {
  it('убирает регистр, лишние пробелы и знаки', () => {
    expect(normalizeAnswer('  Салом,  Дӯст! ')).toBe('салом дӯст');
    expect(normalizeAnswer('«Хуш омадед!»')).toBe('хуш омадед');
  });

  it('приводит к NFC', () => {
    // «ӣ» можно записать как «и» + комбинируемый макрон
    const decomposed = 'ч' + 'ӣ';
    expect(normalizeAnswer(decomposed)).toBe('чӣ');
  });

  it('пустая строка остаётся пустой', () => {
    expect(normalizeAnswer('   ')).toBe('');
    expect(normalizeAnswer('...')).toBe('');
  });
});

describe('свёртка таджикских букв', () => {
  it('сводит шесть особых букв к русским', () => {
    expect(foldTajik('ғӣқӯҳҷ')).toBe('гикухч');
  });

  it('ё приравнивается к е', () => {
    expect(foldTajik('ёр')).toBe('ер');
  });

  it('обычные буквы не трогает', () => {
    expect(foldTajik('салом')).toBe('салом');
  });
});

describe('сверка ответа', () => {
  it('точное совпадение', () => {
    expect(compareAnswer('салом', 'салом')).toBe('exact');
    expect(compareAnswer('  САЛОМ! ', 'салом')).toBe('exact');
  });

  it('русские буквы вместо таджикских — засчитываем, но помечаем', () => {
    expect(compareAnswer('рахмат', 'раҳмат')).toBe('lenient');
    expect(compareAnswer('нагз', 'нағз')).toBe('lenient');
    expect(compareAnswer('чи', 'чӣ')).toBe('lenient');
    expect(compareAnswer('руз', 'рӯз')).toBe('lenient');
    expect(compareAnswer('китоб', 'китоб')).toBe('exact');
  });

  it('и наоборот: таджикские вместо русских тоже засчитываются', () => {
    expect(compareAnswer('раҳмат', 'рахмат')).toBe('lenient');
  });

  it('несколько особых букв сразу', () => {
    expect(compareAnswer('точики', 'тоҷикӣ')).toBe('lenient');
  });

  it('неверный ответ остаётся неверным', () => {
    expect(compareAnswer('хайр', 'салом')).toBe('wrong');
    expect(compareAnswer('', 'салом')).toBe('wrong');
    expect(compareAnswer('саломат', 'салом')).toBe('wrong');
  });

  it('свёртка не склеивает разные слова', () => {
    // «хар» (осёл) и «ҳар» (каждый) — разные слова, но отличаются только
    // особой буквой: мягкое совпадение здесь неизбежно и это осознанный размен
    expect(compareAnswer('хар', 'ҳар')).toBe('lenient');
    expect(compareAnswer('бар', 'ҳар')).toBe('wrong');
  });

  it('isCorrect считает мягкое совпадение верным', () => {
    expect(isCorrect('рахмат', 'раҳмат')).toBe(true);
    expect(isCorrect('салом', 'хайр')).toBe(false);
  });
});

describe('сверка по словам', () => {
  it('точный порядок', () => {
    expect(compareTokens(['субҳ', 'ба', 'хайр'], ['субҳ', 'ба', 'хайр'])).toBe('exact');
  });

  it('другой порядок — ошибка', () => {
    expect(compareTokens(['ба', 'субҳ', 'хайр'], ['субҳ', 'ба', 'хайр'])).toBe('wrong');
  });

  it('другая длина — ошибка', () => {
    expect(compareTokens(['субҳ', 'ба'], ['субҳ', 'ба', 'хайр'])).toBe('wrong');
    expect(compareTokens([], ['субҳ'])).toBe('wrong');
  });

  it('одно мягкое совпадение делает мягким весь ответ', () => {
    expect(compareTokens(['субх', 'ба', 'хайр'], ['субҳ', 'ба', 'хайр'])).toBe('lenient');
  });
});

describe('разбор фразы на слова', () => {
  it('убирает знаки по краям', () => {
    expect(tokenize('Субҳ ба хайр!')).toEqual(['Субҳ', 'ба', 'хайр']);
    expect(tokenize('Номи шумо чист?')).toEqual(['Номи', 'шумо', 'чист']);
  });

  it('схлопывает лишние пробелы', () => {
    expect(tokenize('  Раҳмат,   нағз!  ')).toEqual(['Раҳмат', 'нағз']);
  });

  it('пустая строка даёт пустой список', () => {
    expect(tokenize('   ')).toEqual([]);
  });
});

describe('особые буквы', () => {
  it('находит их в слове', () => {
    expect(hasSpecialLetters('раҳмат')).toBe(true);
    expect(hasSpecialLetters('салом')).toBe(false);
  });

  it('перечисляет без повторов', () => {
    expect(specialLettersOf('тоҷикӣ')).toEqual(['ҷ', 'ӣ']);
    expect(specialLettersOf('ҳаҳ')).toEqual(['ҳ']);
    expect(specialLettersOf('салом')).toEqual([]);
  });
});
