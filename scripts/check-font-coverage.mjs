/**
 * Проверяет, что в локальных woff2 есть все нужные глифы:
 * таджикский алфавит (35 букв), русский алфавит, цифры и пунктуация.
 * Запуск: npm run fonts:check
 */
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { extractTable, cmapCodepoints } from './woff2.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FONT_DIR = join(ROOT, 'src/assets/fonts');

const TAJIK = 'абвгғдеёжзиӣйкқлмнопрстуӯфхҳчҷшъэюя';
const RUSSIAN = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя';
const EXTRA = '0123456789«»—–…!?.,:;()[]%+-=/№\'"*';

function withUpper(s) {
  return new Set([...s, ...s.toUpperCase()]);
}

const GROUPS = [
  ['таджикский алфавит', withUpper(TAJIK)],
  ['русский алфавит', withUpper(RUSSIAN)],
  ['цифры и пунктуация', new Set(EXTRA)],
];

const files = (await readdir(FONT_DIR)).filter((f) => f.endsWith('.woff2'));
if (files.length === 0) {
  console.error('В src/assets/fonts нет woff2. Сначала: npm run fonts');
  process.exit(1);
}

const covered = new Set();
for (const file of files) {
  const buf = await readFile(join(FONT_DIR, file));
  const cmap = extractTable(buf, 'cmap');
  if (!cmap) throw new Error(`${file}: нет таблицы cmap`);
  const cps = cmapCodepoints(cmap);
  for (const cp of cps) covered.add(cp);
  console.log(`${file.padEnd(28)} ${String(cps.size).padStart(4)} символов`);
}

let failed = false;
console.log('');
for (const [name, chars] of GROUPS) {
  const missing = [...chars].filter((ch) => !covered.has(ch.codePointAt(0)));
  if (missing.length) {
    failed = true;
    console.error(`НЕТ ГЛИФОВ — ${name}: ${missing.join(' ')}`);
  } else {
    console.log(`ok — ${name} (${chars.size} символов)`);
  }
}

// Отдельно и явно: шесть букв, которых нет в русском алфавите
const SPECIAL = 'ғӣқӯҳҷ';
const specialMissing = [...withUpper(SPECIAL)].filter((ch) => !covered.has(ch.codePointAt(0)));
if (specialMissing.length) {
  failed = true;
  console.error(`НЕТ ГЛИФОВ — особые таджикские буквы: ${specialMissing.join(' ')}`);
} else {
  console.log('ok — особые таджикские буквы Ғғ Ӣӣ Ққ Ӯӯ Ҳҳ Ҷҷ');
}

process.exit(failed ? 1 : 0);
