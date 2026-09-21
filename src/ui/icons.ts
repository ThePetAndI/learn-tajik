/**
 * Инлайн-SVG иконки. Никаких эмодзи и иконочных шрифтов:
 * эмодзи выглядят по-разному на разных прошивках и ломают «игровой» вид.
 * Все пути нарисованы в сетке 24x24, цвет берётся из currentColor.
 */

const S = (body: string, fill = 'none'): string =>
  '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="' + fill + '" ' +
  'stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>';

/** Заливка цветом текста — для «мультяшных» плотных иконок. */
const F = (body: string): string => S(body, 'currentColor');

export const ICONS = {
  /* ——— HUD ——— */
  heart: F(
    '<path d="M12 21.2c-.4 0-.8-.15-1.1-.42C6.3 16.7 3 13.6 3 9.9 3 6.9 5.3 4.6 8.2 4.6c1.6 0 3 .72 3.8 1.9.8-1.18 2.2-1.9 3.8-1.9C18.7 4.6 21 6.9 21 9.9c0 3.7-3.3 6.8-7.9 10.88-.3.27-.7.42-1.1.42Z"/>' +
      '<path d="M8.6 8.1c-.9.1-1.6.8-1.8 1.7" stroke="#fff" stroke-opacity=".6" stroke-width="1.6" fill="none"/>',
  ),
  heartEmpty: S(
    '<path d="M12 20.4C7.6 16.5 4.5 13.5 4.5 10.1c0-2.2 1.7-3.9 3.8-3.9 1.4 0 2.7.8 3.3 2 .6-1.2 1.9-2 3.3-2 2.1 0 3.8 1.7 3.8 3.9 0 3.4-3.1 6.4-7.5 10.3Z" stroke="currentColor" stroke-width="2.1"/>',
  ),
  // звезда вырезана через evenodd: на золотой монете и на белой иконке читается одинаково
  coin: F(
    '<path fill-rule="evenodd" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' +
      'm-9-4.4 1.3 2.7 3 .45-2.15 2.1.5 3-2.65-1.4-2.65 1.4.5-3L7.7 10.75l3-.45L12 7.6Z"/>' +
      '<circle cx="12" cy="12" r="7.1" fill="none" stroke="#000" stroke-opacity=".16" stroke-width="1.1"/>',
  ),
  star: F(
    '<path d="m12 3.4 2.6 5.3 5.9.86-4.25 4.15 1 5.87L12 16.8l-5.25 2.78 1-5.87L3.5 9.56l5.9-.86L12 3.4Z"/>',
  ),
  starEmpty: S(
    '<path d="m12 4.3 2.35 4.76 5.25.77-3.8 3.7.9 5.23L12 16.29l-4.7 2.47.9-5.23-3.8-3.7 5.25-.77L12 4.3Z" stroke="currentColor" stroke-width="2" />',
  ),
  gem: F('<path d="M7 3h10l4 6-9 12L3 9l4-6Z"/><path d="M3 9h18" stroke="#000" stroke-opacity=".28" stroke-width="1.4" fill="none"/>'),
  flame: F(
    '<path d="M12.6 2.2c2.5 3.2 1 5.1 2.6 6.3 1.2.9 2.3-.3 2.3-.3.9 1.5 1.5 3 1.5 4.8 0 4.3-3.6 7.8-8 7.8s-8-3.5-8-7.8c0-3.4 1.9-5.6 4-7.9 0 0 .3 2.2 1.7 2.6 1.6.4 1.3-3.2 3.9-5.5Z"/>' +
      '<path d="M12 20.3c-2 0-3.6-1.5-3.6-3.4 0-2 2-2.8 2.4-4.7 1.7 1 4.8 2.4 4.8 4.7 0 1.9-1.6 3.4-3.6 3.4Z" fill="#000" fill-opacity=".16"/>',
  ),
  plus: S('<path d="M12 6v12M6 12h12" stroke="currentColor" stroke-width="3.2"/>'),
  minus: S('<path d="M6 12h12" stroke="currentColor" stroke-width="3.2"/>'),

  /* ——— таб-бар ——— */
  shop: F(
    '<path d="M4.6 8h14.8l-1.1 11.3a2 2 0 0 1-2 1.8H7.7a2 2 0 0 1-2-1.8L4.6 8Z"/>' +
      '<path d="M8.8 8.6V6.4a3.2 3.2 0 0 1 6.4 0v2.2" stroke="currentColor" stroke-width="2.2" fill="none"/>' +
      '<circle cx="9.2" cy="12" r="1.15" fill="#000" fill-opacity=".22"/>' +
      '<circle cx="14.8" cy="12" r="1.15" fill="#000" fill-opacity=".22"/>',
  ),
  map: F(
    '<path d="M9 3.6 3.6 5.5v14.9L9 18.5l6 1.9 5.4-1.9V3.6L15 5.5 9 3.6Z"/>' +
      '<path d="M9 3.6v14.9M15 5.5v14.9" stroke="#000" stroke-opacity=".24" stroke-width="1.6" fill="none"/>',
  ),
  book: F(
    '<path d="M4 5.2A2.2 2.2 0 0 1 6.2 3H19a1 1 0 0 1 1 1v13.4a1 1 0 0 1-1 1H6.4a2.4 2.4 0 0 0-2.4 2.3V5.2Z"/>' +
      '<path d="M8 7.4h7M8 10.6h5" stroke="#000" stroke-opacity=".26" stroke-width="1.8" fill="none"/>',
  ),
  user: F(
    '<circle cx="12" cy="8.2" r="4.1"/>' +
      '<path d="M3.9 20.6c0-3.9 3.6-6.4 8.1-6.4s8.1 2.5 8.1 6.4a.9.9 0 0 1-.9.9H4.8a.9.9 0 0 1-.9-.9Z"/>',
  ),

  /* ——— действия ——— */
  close: S('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke="currentColor" stroke-width="3"/>'),
  check: S('<path d="m5 12.8 4.6 4.5L19 7.2" stroke="currentColor" stroke-width="3.2"/>'),
  cross: S('<path d="M7 7l10 10M17 7 7 17" stroke="currentColor" stroke-width="3.2"/>'),
  chevronLeft: S('<path d="M15 5 8 12l7 7" stroke="currentColor" stroke-width="3"/>'),
  chevronRight: S('<path d="m9 5 7 7-7 7" stroke="currentColor" stroke-width="3"/>'),
  chevronDown: S('<path d="m5 9 7 7 7-7" stroke="currentColor" stroke-width="3"/>'),
  download: S(
    '<path d="M12 3.5v11M7.5 10.5 12 15l4.5-4.5" stroke="currentColor" stroke-width="2.6"/>' +
      '<path d="M4 16.5v2.2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.2" stroke="currentColor" stroke-width="2.6"/>',
  ),
  upload: S(
    '<path d="M12 20.5v-11M7.5 13.5 12 9l4.5 4.5" stroke="currentColor" stroke-width="2.6"/>' +
      '<path d="M4 16.5v2.2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.2" stroke="currentColor" stroke-width="2.6"/>',
  ),
  trash: S(
    '<path d="M4.8 6.6h14.4M9.6 6.6V4.9a1.4 1.4 0 0 1 1.4-1.4h2a1.4 1.4 0 0 1 1.4 1.4v1.7" stroke="currentColor" stroke-width="2.4"/>' +
      '<path d="M6.6 6.6 7.6 19a2 2 0 0 0 2 1.9h4.8a2 2 0 0 0 2-1.9l1-12.4" stroke="currentColor" stroke-width="2.4"/>',
  ),
  settings: S(
    '<path d="M4 7.5h10M18 7.5h2M4 16.5h4M12 16.5h8" stroke="currentColor" stroke-width="2.6"/>' +
      '<circle cx="16" cy="7.5" r="2.4" stroke="currentColor" stroke-width="2.6"/>' +
      '<circle cx="10" cy="16.5" r="2.4" stroke="currentColor" stroke-width="2.6"/>',
  ),
  refresh: S(
    '<path d="M20 12a8 8 0 1 1-2.6-5.9" stroke="currentColor" stroke-width="2.8"/>' +
      '<path d="M20.2 3.8v4.6h-4.6" stroke="currentColor" stroke-width="2.8"/>',
  ),
  shuffle: S(
    '<path d="M3.5 6.5h3.2c1.6 0 2.6.9 3.6 2.3l3.4 5c1 1.4 2 2.3 3.6 2.3h3.2" stroke="currentColor" stroke-width="2.5"/>' +
      '<path d="M3.5 17.5h3.2c1.6 0 2.6-.9 3.6-2.3M14 8.8c1-1.4 2-2.3 3.6-2.3h3.2" stroke="currentColor" stroke-width="2.5"/>' +
      '<path d="M18.4 3.6 21.3 6.5l-2.9 2.9M18.4 14.1l2.9 2.9-2.9 2.9" stroke="currentColor" stroke-width="2.5"/>',
  ),
  bulb: F(
    '<path d="M12 2.6a6.7 6.7 0 0 0-4 12.1c.6.45.9 1.1.9 1.8v.4h6.2v-.4c0-.7.3-1.35.9-1.8a6.7 6.7 0 0 0-4-12.1Z"/>' +
      '<path d="M9.4 19h5.2M10.2 21.4h3.6" stroke="currentColor" stroke-width="2.2" fill="none"/>',
  ),
  lock: F(
    '<rect x="4.6" y="10" width="14.8" height="11" rx="3.1"/>' +
      '<path d="M8.4 10V7.6a3.6 3.6 0 0 1 7.2 0V10" stroke="currentColor" stroke-width="2.4" fill="none"/>' +
      '<circle cx="12" cy="15.4" r="1.7" fill="#000" fill-opacity=".3"/>',
  ),
  chest: F(
    '<path d="M3.4 10.4A4.4 4.4 0 0 1 7.8 6h8.4a4.4 4.4 0 0 1 4.4 4.4V12H3.4v-1.6Z"/>' +
      '<rect x="3.4" y="12" width="17.2" height="8" rx="1.8"/>' +
      '<rect x="10.2" y="9.6" width="3.6" height="5" rx="1.2" fill="#000" fill-opacity=".28"/>',
  ),
  wheel: F(
    '<circle cx="12" cy="12" r="9"/>' +
      '<path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" stroke="#000" stroke-opacity=".26" stroke-width="1.5" fill="none"/>' +
      '<circle cx="12" cy="12" r="2.4" fill="#000" fill-opacity=".3"/>',
  ),
  crown: F(
    '<path d="M3.2 7.6 6.6 11l3.2-5.4a2.6 2.6 0 0 1 4.4 0L17.4 11l3.4-3.4c1-1 2.6 0 2.2 1.3l-2.5 8.4a2 2 0 0 1-1.9 1.4H5.4a2 2 0 0 1-1.9-1.4L1 8.9c-.4-1.3 1.2-2.3 2.2-1.3Z" transform="translate(0.5,0.5) scale(0.95)"/>',
  ),
  backspace: S(
    '<path d="M8.4 4.8h10a2.4 2.4 0 0 1 2.4 2.4v9.6a2.4 2.4 0 0 1-2.4 2.4h-10L2.6 12l5.8-7.2Z" stroke="currentColor" stroke-width="2.3"/>' +
      '<path d="m11.6 9.4 4.8 5.2M16.4 9.4l-4.8 5.2" stroke="currentColor" stroke-width="2.3"/>',
  ),
  speaker: F(
    '<path d="M11 4.6 6.6 8.3H4a1.4 1.4 0 0 0-1.4 1.4v4.6A1.4 1.4 0 0 0 4 15.7h2.6L11 19.4a1 1 0 0 0 1.6-.8V5.4a1 1 0 0 0-1.6-.8Z"/>' +
      '<path d="M15.6 9a4.2 4.2 0 0 1 0 6M18.2 6.4a7.6 7.6 0 0 1 0 11.2" stroke="currentColor" stroke-width="2.2" fill="none"/>',
  ),
  clock: S(
    '<circle cx="12" cy="12" r="8.8" stroke="currentColor" stroke-width="2.4"/>' +
      '<path d="M12 6.8V12l3.4 2.2" stroke="currentColor" stroke-width="2.6"/>',
  ),
  target: S(
    '<circle cx="12" cy="12" r="8.6" stroke="currentColor" stroke-width="2.3"/>' +
      '<circle cx="12" cy="12" r="4.6" stroke="currentColor" stroke-width="2.3"/>' +
      '<circle cx="12" cy="12" r="1.3" fill="currentColor"/>',
  ),
  paw: F(
    '<ellipse cx="7.1" cy="9.2" rx="2.1" ry="2.6"/><ellipse cx="12" cy="7.4" rx="2.2" ry="2.8"/>' +
      '<ellipse cx="16.9" cy="9.2" rx="2.1" ry="2.6"/>' +
      '<path d="M12 12.2c3 0 5.4 2 5.4 4.4 0 2-1.6 3.3-3.6 3.3-.9 0-1.3-.3-1.8-.3s-.9.3-1.8.3c-2 0-3.6-1.3-3.6-3.3 0-2.4 2.4-4.4 5.4-4.4Z"/>',
  ),
  pencil: S(
    '<path d="m4.4 19.6.7-3.6L15.6 5.5a2.1 2.1 0 0 1 3 3L8 19l-3.6.6Z" stroke="currentColor" stroke-width="2.3"/>' +
      '<path d="m14.2 6.9 2.9 2.9" stroke="currentColor" stroke-width="2.3"/>',
  ),
  install: S(
    '<rect x="6.2" y="2.6" width="11.6" height="18.8" rx="2.6" stroke="currentColor" stroke-width="2.3"/>' +
      '<path d="M12 7.4v6.4M9.6 11.4 12 13.8l2.4-2.4" stroke="currentColor" stroke-width="2.3"/>',
  ),
  sparkle: F(
    '<path d="M12 2.6 13.7 9 20 10.7 13.7 12.4 12 18.8 10.3 12.4 4 10.7 10.3 9 12 2.6Z"/>' +
      '<path d="m19 15.2.85 2.6 2.6.85-2.6.85-.85 2.6-.85-2.6-2.6-.85 2.6-.85.85-2.6Z"/>',
  ),

  /* ——— значки разделов курса ——— */
  hand: F(
    '<path d="M6.4 14.6v-4.5a1.5 1.5 0 0 1 3 0v1.1V5.2a1.6 1.6 0 0 1 3.2 0v5.4V4.5a1.6 1.6 0 0 1 3.2 0v6.1V6.8a1.5 1.5 0 0 1 3 0v7.9c0 3.7-2.7 6.5-6.4 6.5s-6-2.7-6-6.6Z"/>' +
      '<path d="M9.6 11.4v3M12.8 10.8v3.2M16 10.9v3.1" stroke="#000" stroke-opacity=".18" stroke-width="1.3" fill="none"/>',
  ),
  family: F(
    '<circle cx="8.6" cy="7.4" r="3.4"/>' +
      '<path d="M2.6 20.2c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5a.8.8 0 0 1-.8.8H3.4a.8.8 0 0 1-.8-.8Z"/>' +
      '<circle cx="17.2" cy="10.4" r="2.6"/>' +
      '<path d="M13 21c0-2.7 1.9-4.6 4.2-4.6s4.2 1.9 4.2 4.6h-8.4Z"/>',
  ),
  num: F(
    '<rect x="3.4" y="15.6" width="4.6" height="5.4" rx="1.5"/>' +
      '<rect x="9.7" y="10.4" width="4.6" height="10.6" rx="1.5"/>' +
      '<rect x="16" y="4.4" width="4.6" height="16.6" rx="1.5"/>',
  ),
  apple: F(
    '<path d="M12 7.2c-1-1-2.3-1.6-3.7-1.6-3 0-5.1 2.6-5.1 6.2 0 4.6 3.4 9.4 5.9 9.4 1.1 0 1.7-.6 2.9-.6s1.8.6 2.9.6c2.5 0 5.9-4.8 5.9-9.4 0-3.6-2.1-6.2-5.1-6.2-1.4 0-2.7.6-3.7 1.6Z"/>' +
      '<path d="M12 6.6c0-2 1.3-3.6 3.4-4-.1 2.2-1.3 3.7-3.4 4Z" fill="#000" fill-opacity=".22"/>',
  ),
  house: F(
    '<path d="M11.2 2.9a1.3 1.3 0 0 1 1.6 0l8.4 6.7c.7.6.3 1.7-.6 1.7h-1.3v8.4a2 2 0 0 1-2 2H6.7a2 2 0 0 1-2-2v-8.4H3.4c-.9 0-1.3-1.1-.6-1.7l8.4-6.7Z"/>' +
      '<rect x="9.7" y="13.6" width="4.6" height="7.7" rx="1.2" fill="#000" fill-opacity=".22"/>',
  ),
  basket: F(
    '<path d="M3.6 9.4h16.8a1 1 0 0 1 1 1.2l-1.5 8.2a2.4 2.4 0 0 1-2.4 2H7.5a2.4 2.4 0 0 1-2.4-2L3.6 10.6a1 1 0 0 1 1-1.2Z"/>' +
      '<path d="M8 9.2 10.6 3M16 9.2 13.4 3" stroke="currentColor" stroke-width="2.2" fill="none"/>' +
      '<path d="M9.4 13v4.6M14.6 13v4.6" stroke="#000" stroke-opacity=".2" stroke-width="1.6" fill="none"/>',
  ),
  city: F(
    '<rect x="2.6" y="10.4" width="6" height="10.6" rx="1.2"/>' +
      '<rect x="9.4" y="5.2" width="5.6" height="15.8" rx="1.2"/>' +
      '<rect x="15.8" y="12.8" width="5.6" height="8.2" rx="1.2"/>' +
      '<path d="M4.6 13.4h2M4.6 16.6h2M11.4 8.2h1.8M11.4 11.4h1.8M11.4 14.6h1.8M17.8 15.6h1.6" stroke="#000" stroke-opacity=".26" stroke-width="1.5" fill="none"/>',
  ),
  run: F(
    '<circle cx="14.6" cy="4.7" r="2.5"/>' +
      '<path d="M13.4 8.2c1.3-.5 2.6.1 3.1 1.2l1.2 2.6 2.6 1.2a1.3 1.3 0 0 1-1 2.4l-3.2-1.4a2.4 2.4 0 0 1-1.2-1.2l-.3-.7-1.3 3.1 2.4 2.6c.4.4.5.9.4 1.4l-.9 3.3a1.35 1.35 0 0 1-2.6-.7l.7-2.6-3.1-3.3a2 2 0 0 1-.4-2l1.4-3.6-1.6.7-1.5 2.4a1.3 1.3 0 0 1-2.3-1.4l1.7-2.8c.2-.3.5-.6.8-.7l4.1-1.5Z"/>',
  ),
  sun: F(
    '<circle cx="12" cy="12" r="5"/>' +
      '<path d="M12 1.8v2.8M12 19.4v2.8M22.2 12h-2.8M4.6 12H1.8M19.2 4.8l-2 2M6.8 17.2l-2 2M19.2 19.2l-2-2M6.8 6.8l-2-2" stroke="currentColor" stroke-width="2.4" fill="none"/>',
  ),
  work: F(
    '<rect x="2.6" y="7.4" width="18.8" height="13" rx="2.6"/>' +
      '<path d="M8.8 7.2V5.8a2.2 2.2 0 0 1 2.2-2.2h2a2.2 2.2 0 0 1 2.2 2.2v1.4" stroke="currentColor" stroke-width="2.2" fill="none"/>' +
      '<path d="M2.6 12.6h18.8" stroke="#000" stroke-opacity=".22" stroke-width="1.8" fill="none"/>' +
      '<rect x="10.4" y="11.2" width="3.2" height="3.2" rx="1" fill="#000" fill-opacity=".26"/>',
  ),
  bus: F(
    '<rect x="3.2" y="3.4" width="17.6" height="14.2" rx="3"/>' +
      '<rect x="5.6" y="6.6" width="12.8" height="5.2" rx="1.4" fill="#000" fill-opacity=".24"/>' +
      '<circle cx="7.4" cy="19.4" r="2.2"/><circle cx="16.6" cy="19.4" r="2.2"/>' +
      '<circle cx="6.6" cy="14.8" r="1.1" fill="#000" fill-opacity=".24"/>' +
      '<circle cx="17.4" cy="14.8" r="1.1" fill="#000" fill-opacity=".24"/>',
  ),
  chat: F(
    '<path d="M2.6 8.2A3.6 3.6 0 0 1 6.2 4.6h7.6a3.6 3.6 0 0 1 3.6 3.6v3.6a3.6 3.6 0 0 1-3.6 3.6H9.2l-4.1 2.9a.8.8 0 0 1-1.3-.65V15.4a3.6 3.6 0 0 1-1.2-2.7V8.2Z"/>' +
      '<path d="M19.2 8.9a3.6 3.6 0 0 1 2.2 3.3v3a3.6 3.6 0 0 1-1.2 2.7v2.1a.8.8 0 0 1-1.3.65l-3.2-2.3h-2.4a3.6 3.6 0 0 1-2.9-1.5h3.4a5 5 0 0 0 5-5V8.9Z" fill="#000" fill-opacity=".26"/>',
  ),
  tree: F(
    '<path d="M12 2.4 4.4 12h3L3.2 18.6h17.6L16.6 12h3L12 2.4Z"/>' +
      '<rect x="10.5" y="17.8" width="3" height="4.2" rx="1" fill="#000" fill-opacity=".3"/>',
  ),
} as const;

export type IconName = keyof typeof ICONS;

/** Возвращает новый SVG-элемент. Размер задаётся font-size родителя (1em). */
export function icon(name: IconName, extraClass = ''): SVGSVGElement {
  const tpl = document.createElement('template');
  tpl.innerHTML = ICONS[name];
  const el = tpl.content.firstElementChild as SVGSVGElement;
  el.setAttribute('class', 'icon' + (extraClass ? ' ' + extraClass : ''));
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('focusable', 'false');
  return el;
}
