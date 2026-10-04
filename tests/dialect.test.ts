import { describe, expect, it } from 'vitest';
import dialect from '../content/dushanbe.json';
import {
  allDialogues,
  allIzafets,
  allPhrases,
  allWords,
  getPhrase,
  rules,
  words,
} from '../src/data/content';
import { formInText, makePhraseIntro } from '../src/game/generators/phrase-intro';

/*
 * Курс учит душанбинской речи, а не книжной норме: литературный таджикский
 * вырос из северных говоров, и носитель из Душанбе слышит в нём Худжанд.
 * content/dushanbe.json — книжные слова, которых в Душанбе не говорят;
 * собран из ответов носителя на проверку всего курса.
 */

function pattern(book: string): RegExp {
  const escaped = book.normalize('NFC').toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(?<!\\p{L})' + escaped + '(?!\\p{L})', 'u');
}

/** Всё, что игрок видит в уроках. Книжные формы, сохранённые нарочно (lit, alt), — не в счёт. */
function lessonTexts(): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [];
  for (const w of allWords()) {
    out.push({ where: w.id, text: w.tg });
    for (const form of w.also ?? []) out.push({ where: w.id + '.also', text: form });
    if (w.example) out.push({ where: w.id + '.example', text: w.example.tg });
  }
  for (const p of allPhrases()) out.push({ where: p.id, text: p.tg });
  for (const d of allDialogues()) {
    out.push({ where: d.id + '.ask', text: d.ask.tg }, { where: d.id + '.reply', text: d.reply.tg });
    for (const w of d.wrong ?? []) out.push({ where: d.id + '.wrong', text: w.tg });
  }
  for (const z of allIzafets()) out.push({ where: z.id, text: z.tg });
  for (const r of rules) for (const e of r.examples) out.push({ where: r.id, text: e.tg });
  return out;
}

describe('душанбинская речь', () => {
  it('в уроках нет книжных слов, которых в Душанбе не говорят', () => {
    const texts = lessonTexts();
    const found: string[] = [];
    for (const { book, say } of dialect.replace) {
      const re = pattern(book);
      for (const t of texts) {
        if (re.test(t.text.normalize('NFC').toLowerCase())) found.push(t.where + ': «' + book + '» → «' + say + '»');
      }
    }
    expect(found).toEqual([]);
  });

  it('проверка ловит книжное слово целиком, а не кусок другого', () => {
    expect(pattern('лутфан').test('як пиёла чой, лутфан.')).toBe(true);
    expect(pattern('чӣ тавр').test('ин чӣ тавр аст?')).toBe(true);
    expect(pattern('оре').test('хореограф')).toBe(false);
  });

  it('книжная форма и «ещё говорят» не повторяют само слово', () => {
    for (const w of allWords()) {
      if (w.lit !== undefined) expect(w.lit, w.id).not.toBe(w.tg);
      for (const form of w.also ?? []) {
        expect(form, w.id).not.toBe(w.tg);
        expect(form, w.id).not.toBe(w.lit);
      }
    }
  });

  it('разбор фразы показывает слово в той форме, что стоит во фразе', () => {
    const phrase = getPhrase('p_padari_man_kor');
    expect(phrase?.tg).toContain('Отаи');
    const shown = makePhraseIntro(phrase!, words).gloss.map((g) => g.tg);
    expect(shown).toContain('ота');
    expect(shown).not.toContain('падар');
  });

  it('если формы из «ещё говорят» во фразе нет, показывается словарная', () => {
    const padar = words.get('w_padar')!;
    expect(formInText(padar, 'Падарат кор мекунад?')).toBe('падар');
    expect(formInText(padar, 'Отаву оча')).toBe('ота');
    // хвост длиннее двух букв — уже другое слово: «ман» не находится в «манзил»
    expect(formInText({ ...padar, also: ['ман'] }, 'Манзил дур.')).toBe('падар');
  });
});
