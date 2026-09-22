/**
 * Отчёт о покрытии озвучкой. Записи не обязательны — без них приложение
 * работает как сейчас, просто молча. Скрипт показывает, что уже озвучено
 * и что осталось.
 *
 * Запуск: npm run audio:check
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = join(ROOT, 'content');
const AUDIO = join(ROOT, 'public', 'audio');

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function listJson(dir) {
  if (!(await exists(dir))) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isFile() && e.name.endsWith('.json')).map((e) => join(dir, e.name));
}

async function readAll(files, field) {
  const out = [];
  for (const f of files) {
    const data = JSON.parse(await readFile(f, 'utf8'));
    if (Array.isArray(data[field])) out.push(...data[field]);
  }
  return out;
}

const words = await readAll(await listJson(join(CONTENT, 'words')), 'words');
const letters = await readAll([join(CONTENT, 'alphabet.json')], 'letters');

const withAudio = (list) => list.filter((x) => typeof x.audio === 'string' && x.audio.length > 0);
const missingFiles = [];

for (const item of [...withAudio(words), ...withAudio(letters)]) {
  const path = join(ROOT, 'public', item.audio.replace(/^\/+/, ''));
  if (!(await exists(path))) missingFiles.push(item.audio);
}

const pct = (a, b) => (b === 0 ? 0 : Math.round((a / b) * 100));

console.log('Озвучка');
console.log('  буквы: ' + withAudio(letters).length + ' из ' + letters.length +
  ' (' + pct(withAudio(letters).length, letters.length) + '%)');
console.log('  слова: ' + withAudio(words).length + ' из ' + words.length +
  ' (' + pct(withAudio(words).length, words.length) + '%)');

if (!(await exists(AUDIO))) {
  console.log('\nПапки public/audio пока нет — это нормально, записей ещё не делали.');
  console.log('Как добавить: положите файл в public/audio/words/, а в JSON слова');
  console.log('укажите "audio": "audio/words/w_salom.mp3".');
} else if (missingFiles.length > 0) {
  console.error('\nВ контенте есть ссылки на файлы, которых нет:');
  for (const m of missingFiles.slice(0, 20)) console.error('  ' + m);
  process.exitCode = 1;
} else {
  console.log('\nВсе ссылки на озвучку ведут на существующие файлы.');
}
