/**
 * Проверка файлов курса в /content. Запускается перед сборкой и в CI.
 * Тут же зафиксирован формат данных — если добавляете поля, правьте здесь.
 *
 * Запуск: npm run validate:content
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = join(ROOT, 'content');

/** Таджикский алфавит, 35 букв. Всё, что вне его, — подозрительно. */
export const TAJIK_LETTERS = 'абвгғдеёжзиӣйкқлмнопрстуӯфхҳчҷшъэюя';
const ALLOWED_TG = new Set([
  ...TAJIK_LETTERS,
  ...TAJIK_LETTERS.toUpperCase(),
  ...' -–—?!.,:;()«»…\'’0123456789',
]);
/** Буквы русского алфавита, которых нет в таджикском: частая опечатка. */
const FOREIGN_IN_TG = new Set([...'цщыь', ...'ЦЩЫЬ']);

const POS = new Set([
  'noun', 'verb', 'adj', 'adv', 'pron', 'num', 'prep', 'conj', 'part', 'interj', 'phrase',
]);

const errors = [];
const warnings = [];
const unverified = [];

function err(file, msg) {
  errors.push(relative(ROOT, file) + ': ' + msg);
}
function warn(file, msg) {
  warnings.push(relative(ROOT, file) + ': ' + msg);
}

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function readJson(file) {
  const text = await readFile(file, 'utf8');
  try {
    return JSON.parse(text);
  } catch (e) {
    err(file, 'битый JSON — ' + e.message);
    return null;
  }
}

async function listJson(dir) {
  if (!(await exists(dir))) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.json'))
    .map((e) => join(dir, e.name))
    .sort();
}

function checkTajik(file, id, field, value) {
  if (typeof value !== 'string' || value.trim() === '') {
    err(file, id + '.' + field + ': пустая строка');
    return;
  }
  const bad = new Set();
  for (const ch of value) {
    if (FOREIGN_IN_TG.has(ch)) bad.add(ch);
    else if (!ALLOWED_TG.has(ch)) bad.add(ch);
  }
  if (bad.size) {
    err(file, id + '.' + field + ' содержит чужие символы: ' + [...bad].join(' ') + ' — «' + value + '»');
  }
  if (value !== value.normalize('NFC')) {
    err(file, id + '.' + field + ': строку нужно нормализовать в NFC');
  }
}

function checkRu(file, id, field, value) {
  if (typeof value !== 'string' || value.trim() === '') {
    err(file, id + '.' + field + ': пустая строка');
  }
}

/* ————————————————————————————— основная проверка ————————————————————————————— */

const wordIds = new Map();
const phraseIds = new Map();
const levelIds = new Set();
const sectionIds = new Set();
const usedWordIds = new Set();

async function checkWords() {
  const files = await listJson(join(CONTENT, 'words'));
  for (const file of files) {
    const data = await readJson(file);
    if (!data) continue;
    if (!Array.isArray(data.words)) {
      err(file, 'ожидалось поле words: []');
      continue;
    }
    for (const w of data.words) {
      const id = typeof w.id === 'string' ? w.id : '(без id)';
      if (!/^w_[a-z0-9_]+$/.test(id)) err(file, id + ': id должен быть вида w_slug (латиница, нижний регистр)');
      if (wordIds.has(id)) err(file, id + ': такой id уже есть в ' + relative(ROOT, wordIds.get(id)));
      wordIds.set(id, file);

      checkTajik(file, id, 'tg', w.tg);
      checkRu(file, id, 'ru', w.ru);
      if (!POS.has(w.pos)) err(file, id + ': неизвестная часть речи «' + w.pos + '»');
      if (typeof w.theme !== 'string' || !w.theme) err(file, id + ': нет темы (theme)');
      if (typeof w.verified !== 'boolean') err(file, id + ': нужно поле verified: true|false');
      if (w.verified === false) unverified.push({ id, file, tg: w.tg, ru: w.ru, note: w.note ?? '' });
      if (w.audio !== null && w.audio !== undefined && typeof w.audio !== 'string') {
        err(file, id + ': audio должно быть null или строкой');
      }
      if (w.example !== undefined && w.example !== null) {
        if (typeof w.example !== 'object') err(file, id + ': example должен быть объектом {tg, ru}');
        else {
          checkTajik(file, id, 'example.tg', w.example.tg);
          checkRu(file, id, 'example.ru', w.example.ru);
        }
      }
    }
  }
}

async function checkPhrases() {
  const files = await listJson(join(CONTENT, 'phrases'));
  for (const file of files) {
    const data = await readJson(file);
    if (!data) continue;
    if (!Array.isArray(data.phrases)) {
      err(file, 'ожидалось поле phrases: []');
      continue;
    }
    for (const p of data.phrases) {
      const id = typeof p.id === 'string' ? p.id : '(без id)';
      if (!/^p_[a-z0-9_]+$/.test(id)) err(file, id + ': id должен быть вида p_slug');
      if (phraseIds.has(id)) err(file, id + ': дубликат id');
      phraseIds.set(id, file);
      checkTajik(file, id, 'tg', p.tg);
      checkRu(file, id, 'ru', p.ru);
      if (typeof p.theme !== 'string' || !p.theme) err(file, id + ': нет темы');
      if (typeof p.verified !== 'boolean') err(file, id + ': нужно поле verified');
      if (p.verified === false) unverified.push({ id, file, tg: p.tg, ru: p.ru, note: p.note ?? '' });
      if (Array.isArray(p.words)) {
        for (const wid of p.words) {
          if (!wordIds.has(wid)) err(file, id + ': ссылается на несуществующее слово ' + wid);
        }
      }
    }
  }
}

async function checkAlphabet() {
  const file = join(CONTENT, 'alphabet.json');
  if (!(await exists(file))) {
    warn(file, 'файла нет — раздел «Алфавит» не соберётся');
    return;
  }
  const data = await readJson(file);
  if (!data) return;
  if (!Array.isArray(data.letters)) {
    err(file, 'ожидалось поле letters: []');
    return;
  }
  if (data.letters.length !== 35) {
    warn(file, 'в таджикском алфавите 35 букв, в файле ' + data.letters.length);
  }
  const seen = new Set();
  for (const l of data.letters) {
    const id = l.lower ?? '(?)';
    if (seen.has(id)) err(file, 'буква ' + id + ' встречается дважды');
    seen.add(id);
    if (typeof l.lower !== 'string' || l.lower.length !== 1) err(file, id + ': поле lower — одна буква');
    if (typeof l.upper !== 'string' || l.upper.length !== 1) err(file, id + ': поле upper — одна буква');
    if (typeof l.sound !== 'string' || !l.sound) err(file, id + ': нужно описание звука (sound)');
    if (typeof l.verified !== 'boolean') err(file, id + ': нужно поле verified');
    if (l.verified === false) unverified.push({ id: 'буква ' + id, file, tg: l.lower, ru: l.sound, note: l.note ?? '' });
    if (Array.isArray(l.examples)) {
      for (const wid of l.examples) {
        if (!wordIds.has(wid)) err(file, 'буква ' + id + ': пример ссылается на несуществующее слово ' + wid);
        else usedWordIds.add(wid);
      }
    }
  }
}

async function checkCourse() {
  const file = join(CONTENT, 'course.json');
  if (!(await exists(file))) {
    warn(file, 'файла нет — карта уровней пустая');
    return;
  }
  const data = await readJson(file);
  if (!data) return;
  if (!Array.isArray(data.sections)) {
    err(file, 'ожидалось поле sections: []');
    return;
  }
  for (const sec of data.sections) {
    const sid = sec.id ?? '(без id)';
    if (sectionIds.has(sid)) err(file, 'раздел ' + sid + ': дубликат id');
    sectionIds.add(sid);
    if (typeof sec.title !== 'string' || !sec.title) err(file, sid + ': нет названия');
    if (!Array.isArray(sec.levels) || sec.levels.length === 0) {
      err(file, sid + ': нет уровней');
      continue;
    }
    for (const lvl of sec.levels) {
      const lid = lvl.id ?? '(без id)';
      if (levelIds.has(lid)) err(file, 'уровень ' + lid + ': дубликат id');
      levelIds.add(lid);
      const words = Array.isArray(lvl.words) ? lvl.words : [];
      const phrases = Array.isArray(lvl.phrases) ? lvl.phrases : [];
      for (const wid of words) {
        if (!wordIds.has(wid)) err(file, lid + ': нет слова ' + wid);
        else usedWordIds.add(wid);
      }
      for (const pid of phrases) {
        if (!phraseIds.has(pid)) err(file, lid + ': нет фразы ' + pid);
      }
      if (lvl.kind !== 'alphabet' && words.length === 0 && phrases.length === 0) {
        err(file, lid + ': уровень без слов и фраз');
      }
      if (lvl.exercises !== undefined && lvl.exercises !== 'auto' && !Array.isArray(lvl.exercises)) {
        err(file, lid + ': exercises должно быть "auto" или массивом');
      }
    }
  }
}

function checkReviewFile(reviewText) {
  for (const u of unverified) {
    if (!reviewText.includes(u.id)) {
      warn(join(CONTENT, 'REVIEW.md'), 'не описан непроверенный элемент ' + u.id);
    }
  }
}

async function main() {
  if (!(await exists(CONTENT))) {
    console.log('Папки content пока нет — пропускаю проверку (появится на вехе 4).');
    return;
  }

  await checkWords();
  await checkPhrases();
  await checkAlphabet();
  await checkCourse();

  const reviewPath = join(CONTENT, 'REVIEW.md');
  if (unverified.length > 0) {
    if (await exists(reviewPath)) checkReviewFile(await readFile(reviewPath, 'utf8'));
    else warn(reviewPath, 'есть непроверенные элементы, но файла REVIEW.md нет');
  }

  console.log(
    'Слов: ' + wordIds.size +
      ', фраз: ' + phraseIds.size +
      ', разделов: ' + sectionIds.size +
      ', уровней: ' + levelIds.size +
      ', на проверку: ' + unverified.length,
  );

  const orphans = [...wordIds.keys()].filter((id) => !usedWordIds.has(id));
  if (orphans.length > 0) {
    warn(join(CONTENT, 'course.json'), 'слова не используются ни в одном уровне: ' + orphans.length + ' шт. — ' + orphans.slice(0, 8).join(', ') + (orphans.length > 8 ? '…' : ''));
  }

  for (const w of warnings) console.warn('предупреждение — ' + w);
  for (const e of errors) console.error('ОШИБКА — ' + e);

  if (errors.length > 0) {
    console.error('\nНайдено ошибок: ' + errors.length);
    process.exit(1);
  }
  console.log('Контент в порядке.');
}

main().catch((e) => {
  console.error('Проверка упала:', e);
  process.exit(1);
});
