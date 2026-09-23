/**
 * Сборка материала уровня. Единственное место, где генераторы встречаются
 * с контентом: сами они — чистые функции над готовым пулом.
 *
 * Диалоги и изафеты цепляются к уровню по теме его слов, а не списком в
 * course.json: дописал диалог с темой «family» — он сам появится на семейных
 * уровнях, править код не нужно.
 */

import {
  allWords,
  dialoguesOfThemes,
  getLetter,
  getPhrase,
  getWord,
  izafetsOfThemes,
  letters as alphabet,
  levels,
  rulesOfSection,
  sections,
  type FlatLevel,
  type Letter,
  type Phrase,
  type Word,
} from '../data/content';
import { getState } from '../core/store';
import { isDone } from '../domain/progress';
import { makePool, type LevelPool } from './generators';

/**
 * Названия тем по-русски берём из заголовков разделов курса — но не у первого
 * раздела, который тему задел, а у того, где её слов больше всего.
 *
 * Раздел «Алфавит» на примерах занимает слова изо всех тем сразу, и по правилу
 * «первый попавшийся» приветствия, семья и числа разом получали бы название
 * «Алфавит». Две корзины с одинаковой подписью — задание, которое нельзя решить.
 */
const themeTitles: Record<string, string> = (() => {
  const counts = new Map<string, Map<string, number>>();
  for (const section of sections) {
    for (const level of section.levels) {
      for (const id of level.words ?? []) {
        const word = getWord(id);
        if (!word) continue;
        const perSection = counts.get(word.theme) ?? new Map<string, number>();
        perSection.set(section.title, (perSection.get(section.title) ?? 0) + 1);
        counts.set(word.theme, perSection);
      }
    }
  }

  const out: Record<string, string> = {};
  for (const [theme, perSection] of counts) {
    let best = '';
    let bestN = 0;
    for (const [title, n] of perSection) {
      if (n > bestN) {
        best = title;
        bestN = n;
      }
    }
    if (best) out[theme] = best;
  }
  return out;
})();

/** Слова, введённые до каждого уровня. Считается один раз при первом обращении. */
let priorCache: Word[][] | null = null;

function priorWordsFor(index: number): readonly Word[] {
  if (!priorCache) {
    priorCache = [];
    const seen = new Set<string>();
    const running: Word[] = [];
    for (const level of levels) {
      priorCache.push([...running]);
      for (const id of level.wordIds) {
        if (seen.has(id)) continue;
        const word = getWord(id);
        if (!word) continue;
        seen.add(id);
        running.push(word);
      }
    }
  }
  return priorCache[index] ?? [];
}

function themesOf(words: readonly Word[]): string[] {
  return [...new Set(words.map((w) => w.theme))];
}

/**
 * Тема урока — самая частая среди его слов. Разговоры и изафеты берутся
 * только по ней: раньше брались по всем темам слов урока, и урок про буквы,
 * где слова-примеры собраны со всего курса, получал разговор про «шаб ба хайр».
 */
function mainThemeOf(words: readonly Word[]): string[] {
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w.theme, (counts.get(w.theme) ?? 0) + 1);
  let best = '';
  let bestN = 0;
  for (const [theme, n] of counts) {
    if (n > bestN) {
      best = theme;
      bestN = n;
    }
  }
  return best ? [best] : [];
}

/** Фразы и разговоры, которые игроку уже объясняли. */
function seenPhrases(): Set<string> {
  return new Set(Object.keys(getState().seen));
}

/** Особые буквы, которые к этому уровню уже прошли в разделе «Алфавит». */
function taughtLettersUpTo(index: number): Set<string> {
  const out = new Set<string>();
  for (const level of levels) {
    if (level.index > index) break;
    for (const ch of level.letterChars) out.add(ch);
  }
  return out;
}

/** Фразы прошлых уроков этого раздела, которые игрок уже видел. */
function pastPhrasesOf(level: FlatLevel): Phrase[] {
  const seen = getState().seen;
  const out: Phrase[] = [];
  for (const other of levels) {
    if (other.sectionId !== level.sectionId || other.index >= level.index) continue;
    for (const id of other.phraseIds) {
      const phrase = getPhrase(id);
      if (phrase && seen['p:' + id] !== undefined && !out.some((p) => p.id === id)) out.push(phrase);
    }
  }
  return out;
}

/** Сколько слов проверяет урок алфавита. Урок учит буквам, а не словарю. */
const ALPHABET_WORDS = 6;

/**
 * Слова урока алфавита: те, что показывают его буквы, — и только с теми
 * особыми буквами, которые уже прошли. Иначе «пропущенная буква» спросила бы
 * «ҷ» в уроке про «о», за три урока до того, как «ҷ» объяснят.
 */
function alphabetWords(level: FlatLevel, letters: readonly Letter[], listed: readonly Word[]): Word[] {
  const taught = taughtLettersUpTo(level.index);
  const own = new Set(letters.map((l) => l.lower));
  const readable = (w: Word): boolean =>
    [...w.tg.normalize('NFC').toLowerCase()].every((ch) => !'ғӣқӯҳҷ'.includes(ch) || taught.has(ch));
  const shows = (w: Word): boolean => [...w.tg.normalize('NFC').toLowerCase()].some((ch) => own.has(ch));

  const out: Word[] = [];
  const add = (w: Word | undefined): void => {
    if (!w || out.length >= ALPHABET_WORDS || out.some((x) => x.id === w.id)) return;
    if (readable(w) && shows(w)) out.push(w);
  };
  // сначала слова из примеров к буквам: их игрок видит прямо на карточке буквы
  for (const letter of letters) for (const id of letter.examples ?? []) add(getWord(id));
  for (const w of listed) add(w);
  return out;
}

/**
 * С какими словами игрок ещё не знаком. Незнакомо всё, что он ни разу
 * не назвал верно: и то, что видит впервые, и то, что пока не даётся.
 *
 * Считаем по всему словарю, а не только по словам уровня: задания
 * подтягивают слова и со стороны — пара из соседней темы, лишнее слово
 * из пройденного раздела, — и их тоже нельзя спрашивать вслепую.
 */
function freshWords(): Set<string> {
  const srs = getState().srs;
  const out = new Set<string>();
  for (const word of allWords()) {
    if (!srs[word.id]?.introduced) out.add(word.id);
  }
  return out;
}

/** Пул уровня карты. */
export function poolForLevel(level: FlatLevel): LevelPool {
  const words = level.wordIds
    .map(getWord)
    .filter((w): w is Word => Boolean(w));
  const phrases = level.phraseIds
    .map(getPhrase)
    .filter((p): p is Phrase => Boolean(p));
  const letters = level.letterChars
    .map(getLetter)
    .filter((l): l is Letter => Boolean(l));
  const isAlphabet = letters.length > 0;
  const themes = mainThemeOf(words);

  /*
   * Правило показываем в первом уровне раздела и только пока он не пройден.
   * Отдельное поле в сохранении для этого не нужно: пройденный первый уровень
   * и означает, что правило уже читали.
   */
  const rules =
    level.indexInSection === 0 && !isDone(getState(), level.id)
      ? rulesOfSection(level.sectionId)
      : [];

  /*
   * Урок алфавита — только буквы и слова, которые их показывают. Фраз,
   * разговоров и изафетов в нём нет: первый урок раньше нёс три буквы,
   * восемь слов, девять фраз и разговор — для человека, который ещё
   * не умеет читать эти буквы.
   */
  /*
   * Чужие слова для «лишнего», корзин и колеса — только из тех, что игрок
   * действительно выучил. По порядку курса «пройденными» числились и слова
   * из списков алфавита, которые уроки алфавита теперь не проверяют, — и во
   * втором уроке приветствий корзины просили разложить «жизнь» и «победу».
   */
  const fresh = freshWords();
  const prior = priorWordsFor(level.index).filter((w) => !fresh.has(w.id));

  if (isAlphabet) {
    return makePool(alphabetWords(level, letters, words), [], allWords(), {
      priorWords: prior,
      rules,
      letters,
      alphabet,
      themeTitles,
      freshWords: fresh,
      seenPhrases: seenPhrases(),
    });
  }

  return makePool(words, phrases, allWords(), {
    priorWords: prior,
    rules,
    letters,
    alphabet,
    dialogues: dialoguesOfThemes(themes),
    izafets: izafetsOfThemes(themes),
    themeTitles,
    freshWords: fresh,
    seenPhrases: seenPhrases(),
    pastPhrases: pastPhrasesOf(level),
  });
}

/**
 * Пул для сессий повторения и восстановления: слова берутся отовсюду,
 * букв и «пройденного раньше» здесь нет — на карте они уже позади.
 *
 * remind — слова, которые перед заданиями стоит показать заново. Восстановление
 * работает на словах, которые не даются: человек их видел, но не запомнил,
 * и спрашивать их без напоминания — то же, что спрашивать вслепую.
 */
export function poolForWords(words: Word[], phrases: Phrase[], remind: readonly string[] = []): LevelPool {
  const themes = themesOf(words);
  return makePool(words, phrases, allWords(), {
    priorWords: words,
    alphabet,
    dialogues: dialoguesOfThemes(themes),
    izafets: izafetsOfThemes(themes),
    themeTitles,
    freshWords: new Set(remind),
    seenPhrases: seenPhrases(),
    reminder: remind.length > 0,
  });
}
