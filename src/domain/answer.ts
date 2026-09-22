/**
 * Сверка ответов. Главная сложность — шесть таджикских букв, которых нет
 * на русской клавиатуре: ғ ӣ қ ӯ ҳ ҷ.
 *
 * Правило такое: точное совпадение засчитывается молча, совпадение
 * с точностью до этих букв — засчитывается, но с подсказкой, как пишется
 * правильно. Отказывать за ӣ вместо и значит наказывать за клавиатуру,
 * а не за незнание.
 */

/** Замены для «мягкого» сравнения: особая буква -> ближайшая русская. */
const FOLD_MAP: Record<string, string> = {
  ғ: 'г',
  ӣ: 'и',
  қ: 'к',
  ӯ: 'у',
  ҳ: 'х',
  ҷ: 'ч',
  // ё на русской раскладке набирают как е — распространённый ввод
  ё: 'е',
  // апостроф иногда ставят вместо ъ (айн)
  ъ: 'ъ',
};

/** Знаки, которые не влияют на правильность ответа. */
const PUNCTUATION = /[.,!?;:«»"'’‘`()\[\]…—–\-]/g;

/** Приводит строку к виду, в котором её можно сравнивать. */
export function normalizeAnswer(input: string): string {
  return input
    .normalize('NFC')
    .toLowerCase()
    .replace(PUNCTUATION, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Дополнительно сводит особые таджикские буквы к русским аналогам. */
export function foldTajik(input: string): string {
  let out = '';
  for (const ch of normalizeAnswer(input)) {
    out += FOLD_MAP[ch] ?? ch;
  }
  return out;
}

export type MatchResult = 'exact' | 'lenient' | 'wrong';

/**
 * 'exact'   — ответ верный;
 * 'lenient' — верный, но с русскими буквами вместо таджикских: засчитываем и показываем написание;
 * 'wrong'   — неверный.
 */
export function compareAnswer(given: string, expected: string): MatchResult {
  const g = normalizeAnswer(given);
  const e = normalizeAnswer(expected);
  if (g === e) return 'exact';
  if (g.length > 0 && foldTajik(g) === foldTajik(e)) return 'lenient';
  return 'wrong';
}

/** Верный ли ответ (мягкое совпадение тоже считается верным). */
export function isCorrect(given: string, expected: string): boolean {
  return compareAnswer(given, expected) !== 'wrong';
}

/** Сравнение собранной фразы по словам — для «Собери фразу». */
export function compareTokens(given: readonly string[], expected: readonly string[]): MatchResult {
  if (given.length !== expected.length) return 'wrong';
  let lenient = false;
  for (let i = 0; i < given.length; i++) {
    const res = compareAnswer(given[i] ?? '', expected[i] ?? '');
    if (res === 'wrong') return 'wrong';
    if (res === 'lenient') lenient = true;
  }
  return lenient ? 'lenient' : 'exact';
}

/** Разбивает таджикскую фразу на слова для банка слов. */
export function tokenize(phrase: string): string[] {
  return phrase
    .normalize('NFC')
    .split(/\s+/)
    .map((w) => w.replace(/^[«"'‘]+|[».,!?;:"'’…]+$/g, ''))
    .filter((w) => w.length > 0);
}

/** Есть ли в слове буквы, которых нет в русском алфавите. */
export function hasSpecialLetters(word: string): boolean {
  return /[ғӣқӯҳҷ]/i.test(word.normalize('NFC'));
}

/** Шесть букв, которых нет в русском алфавите. */
export const SPECIAL_LETTERS = ['ғ', 'ӣ', 'қ', 'ӯ', 'ҳ', 'ҷ'] as const;

/**
 * Пары, которые путают: особая буква и её русский двойник.
 * На этом держатся «пропущенная буква» и проверка в знакомстве с буквой —
 * выбирать между ҳ и х осмысленно, между ҳ и б нет.
 */
export const LOOKALIKES: Record<string, string[]> = {
  ғ: ['г'],
  г: ['ғ'],
  ӣ: ['и', 'й'],
  и: ['ӣ', 'й'],
  й: ['и', 'ӣ'],
  қ: ['к'],
  к: ['қ'],
  ӯ: ['у'],
  у: ['ӯ'],
  ҳ: ['х'],
  х: ['ҳ'],
  ҷ: ['ч'],
  ч: ['ҷ'],
  // ь и щ в таджикском алфавите нет вовсе — как вариант ответа это честная ловушка
  ъ: ['ь', 'э'],
  о: ['а', 'у'],
  а: ['о', 'я'],
  е: ['ё', 'э'],
  ё: ['е', 'э'],
  э: ['е', 'ё'],
  з: ['с'],
  с: ['з'],
  ш: ['щ', 'ч'],
  б: ['п', 'в'],
  п: ['б', 'ф'],
};

/** Буквы, похожие на данную — для вариантов ответа. */
export function lookalikesOf(letter: string): string[] {
  const key = letter.normalize('NFC').toLowerCase();
  return (LOOKALIKES[key] ?? []).filter((l) => l !== key);
}

/** Есть ли такая буква среди шести особых. */
export function isSpecialLetter(letter: string): boolean {
  return (SPECIAL_LETTERS as readonly string[]).includes(letter.normalize('NFC').toLowerCase());
}

/** Список особых букв слова — для подсказки под ответом. */
export function specialLettersOf(word: string): string[] {
  const found = new Set<string>();
  for (const ch of word.normalize('NFC').toLowerCase()) {
    if ('ғӣқӯҳҷ'.includes(ch)) found.add(ch);
  }
  return [...found];
}
