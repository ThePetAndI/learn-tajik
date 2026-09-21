/**
 * Генерирует иконки приложения из SVG.
 * Текста в иконке нет намеренно: растеризатор не знает про наш woff2,
 * и на разных машинах подставился бы разный системный шрифт.
 *
 * Запуск: npm run icons
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public/icons');

/** Путь звезды с заданным числом лучей. */
function starPath(cx, cy, rOuter, rInner, points = 5, rotation = -Math.PI / 2) {
  const parts = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = rotation + (i * Math.PI) / points;
    const x = (cx + r * Math.cos(a)).toFixed(1);
    const y = (cy + r * Math.sin(a)).toFixed(1);
    parts.push((i === 0 ? 'M' : 'L') + x + ' ' + y);
  }
  return parts.join(' ') + ' Z';
}

/**
 * @param {{ maskable?: boolean }} opts
 * maskable — фон во весь холст, содержимое ужато в безопасный круг (80%).
 */
function iconSvg({ maskable = false } = {}) {
  const S = 512;
  // у maskable-иконки Android срезает углы — содержимое уменьшаем
  const k = maskable ? 0.78 : 1;
  const cx = S / 2;
  const cy = S / 2;

  const tile = maskable
    ? '<rect width="512" height="512" fill="url(#bg)"/>'
    : '<rect x="16" y="16" width="480" height="480" rx="112" fill="url(#bg)" stroke="#fff" stroke-width="16"/>';

  // Книга: две страницы, расходящиеся от корешка
  const book =
    '<path d="M100 196 C154 166 222 168 256 206 L256 400 C222 366 154 364 100 386 Z" fill="#fff"/>' +
    '<path d="M412 196 C358 166 290 168 256 206 L256 400 C290 366 358 364 412 386 Z" fill="#fff" fill-opacity="0.92"/>' +
    '<path d="M256 206 L256 400" stroke="#e8a86a" stroke-width="10" stroke-linecap="round"/>' +
    '<path d="M138 232 C176 216 212 220 234 240" stroke="#f0c79a" stroke-width="12" stroke-linecap="round" fill="none"/>' +
    '<path d="M138 288 C176 272 212 276 234 296" stroke="#f0c79a" stroke-width="12" stroke-linecap="round" fill="none"/>' +
    '<path d="M374 232 C336 216 300 220 278 240" stroke="#f0c79a" stroke-width="12" stroke-linecap="round" fill="none"/>';

  const star =
    '<path d="' +
    starPath(256, 120, 78, 33) +
    '" fill="url(#gold)" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>';

  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">' +
    '<defs>' +
    '<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#FFB84D"/><stop offset="1" stop-color="#FF7A1A"/>' +
    '</linearGradient>' +
    '<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#FFE066"/><stop offset="1" stop-color="#FFB000"/>' +
    '</linearGradient>' +
    '</defs>' +
    tile +
    '<g transform="translate(' +
    (cx - cx * k).toFixed(1) +
    ' ' +
    (cy - cy * k + (maskable ? 6 : 0)).toFixed(1) +
    ') scale(' +
    k +
    ')">' +
    star +
    book +
    '</g>' +
    '</svg>'
  );
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const plain = iconSvg();
  const maskable = iconSvg({ maskable: true });
  await writeFile(join(OUT, 'favicon.svg'), plain, 'utf8');

  let render;
  try {
    const sharp = (await import('sharp')).default;
    render = async (svg, size) =>
      sharp(Buffer.from(svg)).resize(size, size, { fit: 'contain' }).png({ compressionLevel: 9 }).toBuffer();
  } catch {
    const { Resvg } = await import('@resvg/resvg-js');
    render = async (svg, size) =>
      new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  }

  const jobs = [
    ['icon-192.png', plain, 192],
    ['icon-512.png', plain, 512],
    ['maskable-192.png', maskable, 192],
    ['maskable-512.png', maskable, 512],
    ['apple-touch-icon.png', plain, 180],
  ];

  for (const [name, svg, size] of jobs) {
    const png = await render(svg, size);
    await writeFile(join(OUT, name), png);
    console.log(name.padEnd(24) + (png.length / 1024).toFixed(1) + ' КБ');
  }
  console.log('favicon.svg              ' + (plain.length / 1024).toFixed(1) + ' КБ');
}

main().catch((e) => {
  console.error('Не удалось собрать иконки:', e.message);
  process.exit(1);
});
