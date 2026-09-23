/**
 * Рисунки снаряжения — в той же сетке 64×64, что и сам питомец (ui/pet.ts),
 * поэтому надетая вещь просто накладывается поверх и садится куда надо:
 *
 *  голова — над макушкой, между ушами: y от 1 до 20;
 *  шея    — дугой по низу морды: от (15, 48) через (32, 57.5) к (49, 48);
 *  оберег — висит справа на шнурке, около (50, 56).
 *
 * Та же разметка служит значком вещи в инвентаре: для каждого слота своё
 * окно просмотра, в которое вещь помещается целиком.
 */

import type { GearSlot } from '../domain/gear-items';

/** Окно, в которое вещь помещается без питомца, — для карточек инвентаря. */
export const SLOT_VIEWBOX: Record<GearSlot, string> = {
  head: '15 0 34 22',
  neck: '11 44 42 21',
  charm: '40 44 18 20',
};

/** Точка на дуге шеи: t от 0 (левый край) до 1 (правый). */
function neckPoint(t: number, sag = 9.5): [number, number] {
  const a = (1 - t) * (1 - t);
  const b = 2 * (1 - t) * t;
  const c = t * t;
  return [a * 15 + b * 32 + c * 49, a * 48 + b * (48 + sag) + c * 48];
}

/** Бусины по дуге шеи. */
function beads(n: number, r: number, fill: string, shine = 'rgba(255,255,255,.55)'): string {
  let out = '';
  for (let i = 0; i < n; i++) {
    const [x, y] = neckPoint(i / (n - 1));
    out +=
      '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + r + '" fill="' + fill + '"/>' +
      '<circle cx="' + (x - r * 0.35).toFixed(1) + '" cy="' + (y - r * 0.35).toFixed(1) + '" r="' + (r * 0.35).toFixed(2) + '" fill="' + shine + '"/>';
  }
  return out;
}

/** Звенья цепи по дуге шеи. */
function chain(n: number, fill: string, edge: string): string {
  let out = '';
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const [x, y] = neckPoint(t);
    const [x2, y2] = neckPoint(Math.min(1, t + 0.01));
    const angle = (Math.atan2(y2 - y, x2 - x) * 180) / Math.PI;
    out +=
      '<ellipse cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" rx="2.3" ry="1.4" fill="none" stroke="' +
      (i % 2 ? edge : fill) + '" stroke-width="1.3" transform="rotate(' + angle.toFixed(0) + ' ' +
      x.toFixed(1) + ' ' + y.toFixed(1) + ')"/>';
  }
  return out;
}

/** Листья венка по верхней дуге головы. */
function wreath(): string {
  let out = '';
  const angles = [-152, -130, -108, -72, -50, -28];
  angles.forEach((deg, i) => {
    const a = (deg * Math.PI) / 180;
    const x = 32 + 21.5 * Math.cos(a);
    const y = 35 + 21.5 * Math.sin(a);
    out +=
      '<ellipse cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" rx="3.9" ry="2" fill="' +
      (i % 2 ? '#7cc576' : '#3f9a45') + '" transform="rotate(' + (deg + 90) + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')"/>';
  });
  return (
    out +
    '<circle cx="32" cy="13" r="3.1" fill="#ff8fc0"/><circle cx="32" cy="13" r="1.3" fill="#ffe066"/>'
  );
}

const CORD = '<path d="M45.5 46.5 49.5 51.5" stroke="#6a5a8c" stroke-width="1.1" fill="none"/>';

/** Разметка вещи по id. Пустая строка — рисунка нет (вещь всё равно работает). */
export const GEAR_ART: Record<string, string> = {
  /* ——— голова ——— */
  h_cap:
    '<path d="M24 18 32 2l8 16Z" fill="#ff7a59"/>' +
    '<path d="M27.2 11.6h9.6M25.6 15h12.8" stroke="#fff" stroke-width="2"/>' +
    '<rect x="22.5" y="16.8" width="19" height="3" rx="1.5" fill="#fff"/>' +
    '<circle cx="32" cy="2.8" r="2.6" fill="#fff"/>',

  h_wreath: wreath(),

  h_bow:
    '<path d="m42 15.5-7.4-5.2.6 10.6Z" fill="#ff5c8a"/>' +
    '<path d="m42 15.5 7.4-5.2-.6 10.6Z" fill="#ff5c8a"/>' +
    '<path d="m42 15.5-7.4-5.2.3 5Z" fill="#fff" fill-opacity=".25"/>' +
    '<circle cx="42" cy="15.5" r="2.5" fill="#e0336a"/>',

  // тоқӣ: чёрный четырёхклинный купол, белые «бодом» и зубчатый край
  h_toqi:
    '<path d="M20.5 18.6 21.6 9.9Q32 3.6 42.4 9.9l1.1 8.7Z" fill="#1f1b2e"/>' +
    '<path d="M32 4.7v13.9" stroke="#3d3654" stroke-width=".8"/>' +
    '<path d="M26.4 15q-1.6-3.3 1.3-4.8 1.6 2.1-1.3 4.8Z" fill="#fff"/>' +
    '<path d="M37.6 15q1.6-3.3-1.3-4.8-1.6 2.1 1.3 4.8Z" fill="#fff"/>' +
    '<path d="m20.9 17.2 1.8-1.4 1.8 1.4 1.8-1.4 1.8 1.4 1.8-1.4 1.8 1.4 1.8-1.4 1.8 1.4 1.8-1.4 1.8 1.4 1.8-1.4 1.8 1.4 1 .8" stroke="#fff" stroke-width=".9" fill="none"/>',

  // салла: намотанная ткань, складки наискось, камень спереди
  h_salla:
    '<path d="M18.5 19Q17 8 32 5q15 3 13.5 14-13.5 3.5-27 0Z" fill="#f4efe4"/>' +
    '<path d="M20 15q12-6 24.5-2M19.5 18q12.5-6.5 25.5-1M24 8.6q10 .9 19.5 5.4" stroke="#d6c9ae" stroke-width="1.3" fill="none"/>' +
    '<circle cx="32" cy="12.6" r="2.5" fill="#2e9be6"/>' +
    '<circle cx="31.2" cy="11.8" r=".85" fill="#fff" fill-opacity=".75"/>',

  h_crown:
    '<path d="M21 19 20 7.5l6 5 6-8 6 8 6-5-1 11.5Z" fill="#ffc21a"/>' +
    '<path d="M21 19 20 7.5l6 5 6-8V19Z" fill="#ffd95a"/>' +
    '<rect x="20.5" y="16" width="23" height="3.6" rx="1" fill="#e89a00"/>' +
    '<circle cx="20" cy="7.5" r="1.6" fill="#ffe89a"/><circle cx="32" cy="4.5" r="1.8" fill="#ffe89a"/>' +
    '<circle cx="44" cy="7.5" r="1.6" fill="#ffe89a"/>' +
    '<circle cx="32" cy="12.8" r="1.9" fill="#2e9be6"/>',

  h_helmet:
    '<path d="M29.4 6.8Q32-1 38.6 3q-3.2.6-3.8 3.8Z" fill="#f04438"/>' +
    '<path d="M19 19q0-13 13-13t13 13Z" fill="#a9b6c8"/>' +
    '<path d="M19 19q0-13 13-13v13Z" fill="#c9d4e2"/>' +
    '<rect x="18" y="17" width="28" height="3.2" rx="1.6" fill="#7b8da3"/>' +
    '<circle cx="22" cy="18.6" r=".9" fill="#dfe6ef"/><circle cx="42" cy="18.6" r=".9" fill="#dfe6ef"/>',

  // корона Кӯҳи Лаъл: крупнее обычной и с рубином
  h_lal_crown:
    '<path d="M19.5 19.5 18.5 6l7 5.5L32 2.5l6.5 9 7-5.5-1 13.5Z" fill="#ffc21a"/>' +
    '<path d="M19.5 19.5 18.5 6l7 5.5L32 2.5v17Z" fill="#ffda5c"/>' +
    '<rect x="19" y="16" width="26" height="4.2" rx="1.2" fill="#d98a00"/>' +
    '<path d="M32 8.2 35.4 12 32 16.4 28.6 12Z" fill="#d61f5a"/>' +
    '<path d="M32 8.2 35.4 12H32Z" fill="#ff7aa2"/>' +
    '<circle cx="24" cy="18.1" r="1.15" fill="#3fa9f5"/><circle cx="40" cy="18.1" r="1.15" fill="#3fa9f5"/>' +
    '<path d="m45.5 3 .7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7Z" fill="#fff"/>',

  /* ——— шея ——— */
  n_scarf:
    '<path d="M14.5 47q17.5 10 35 0l1 4.5Q32 62 13.5 51.5Z" fill="#e8483d"/>' +
    '<path d="m18 50.6 1 2.8m5-.4.6 2.8m5.4-1.4.2 2.8m5.8-3-.4 2.8m6.4-4.6-.8 2.8m5.3-5.2-.9 2.6" stroke="#b72b22" stroke-width="1.1"/>' +
    // хвост слева: справа висит оберег, и вдвоём они сливались в одно пятно
    '<path d="m23 54-3.5 9-4.5-1.5 3.5-9Z" fill="#e8483d"/>' +
    '<path d="m19.5 63-4.5-1.5" stroke="#fff" stroke-width="1.5"/>',

  n_bell:
    '<path d="M15 48q17 9.5 34 0" stroke="#8a5a2b" stroke-width="3" fill="none"/>' +
    '<path d="M28.6 58.6q0-5.6 3.4-5.6t3.4 5.6Z" fill="#ffc21a"/>' +
    '<rect x="27.6" y="58.1" width="8.8" height="1.9" rx=".95" fill="#e89a00"/>' +
    '<circle cx="32" cy="60.8" r="1.15" fill="#b57500"/>' +
    '<path d="M30.2 55.2q.8-1.2 1.8-1.3" stroke="#fff" stroke-opacity=".6" stroke-width=".8" fill="none"/>',

  n_beads:
    '<path d="M15 48q17 9.5 34 0" stroke="#6a4a2b" stroke-width=".8" fill="none"/>' +
    beads(9, 1.9, '#b9773e', 'rgba(255,255,255,.35)'),

  // атлас: шёлк икат — полосы, зубцы, будто размытые ветром
  n_atlas:
    '<path d="M14.5 47q17.5 10 35 0l1 4.5Q32 62 13.5 51.5Z" fill="#d6246e"/>' +
    '<path d="M14 49.3q18 10 36 0" stroke="#ffd12e" stroke-width="1.6" fill="none" stroke-dasharray="3 1.6"/>' +
    '<path d="M14.2 51q17.8 10.4 35.6 0" stroke="#3fa9f5" stroke-width="1.1" fill="none" stroke-dasharray="1.4 2.2"/>' +
    '<path d="m23 54-3.5 9-4.5-1.5 3.5-9Z" fill="#d6246e"/>' +
    '<path d="m21.8 56.6-3.7-1.3m2.5 4.4-3.7-1.3" stroke="#ffd12e" stroke-width="1.1"/>',

  n_pearls:
    beads(13, 1.35, '#fbf6ff', 'rgba(170,150,210,.55)') +
    '<circle cx="32" cy="60.4" r="2.2" fill="#fbf6ff"/><circle cx="31.3" cy="59.7" r=".8" fill="#fff"/>',

  n_chain:
    chain(15, '#ffc21a', '#e89a00') +
    '<rect x="29.2" y="56.4" width="5.6" height="5.6" rx="1.2" fill="#ffc21a" transform="rotate(45 32 59.2)"/>',

  n_medal:
    '<path d="m19 47.5 10 11.4 3-1.2Z" fill="#2e9be6"/>' +
    '<path d="m45 47.5-10 11.4-3-1.2Z" fill="#f04438"/>' +
    '<circle cx="32" cy="60" r="3.9" fill="#ffc21a"/>' +
    '<circle cx="32" cy="60" r="2.7" fill="#e89a00"/>' +
    '<path d="m32 57.9.6 1.3 1.5.2-1.1 1 .3 1.4-1.3-.7-1.3.7.3-1.4-1.1-1 1.5-.2Z" fill="#ffe89a"/>',

  // гарданбанд с лаълом: золотая цепь и рубин-подвеска
  n_lal:
    chain(13, '#ffc21a', '#e89a00') +
    '<path d="M32 56.2 35.6 60 32 64.4 28.4 60Z" fill="#d61f5a"/>' +
    '<path d="M32 56.2 35.6 60H32Z" fill="#ff7aa2"/>' +
    '<circle cx="24.6" cy="54.2" r="1" fill="#ffc21a"/><circle cx="39.4" cy="54.2" r="1" fill="#ffc21a"/>',

  /* ——— оберег ——— */
  c_feather:
    CORD +
    '<path d="M50 51.5q5.6 3.4 3.4 11.3-6.2-3.8-3.4-11.3Z" fill="#7fd3ff"/>' +
    '<path d="M50.2 52.2q1.8 5.2 3 10.4" stroke="#2e9be6" stroke-width=".8" fill="none"/>',

  c_key:
    CORD +
    '<circle cx="50" cy="54" r="2.6" fill="none" stroke="#ffc21a" stroke-width="1.6"/>' +
    '<path d="M50 56.6v6.2m0-2h2.2m-2.2 2h1.6" stroke="#ffc21a" stroke-width="1.6" fill="none"/>',

  c_pebble:
    CORD +
    '<ellipse cx="50.4" cy="56.4" rx="3.6" ry="4.4" fill="#8f9bb0" transform="rotate(-18 50.4 56.4)"/>' +
    '<ellipse cx="49.3" cy="54.9" rx="1.2" ry="1.7" fill="#fff" fill-opacity=".45" transform="rotate(-18 49.3 54.9)"/>',

  // анор — гранат с короной
  c_anor:
    CORD +
    '<circle cx="50.6" cy="57" r="4.4" fill="#d6284a"/>' +
    '<path d="m48.8 52.8-.3-2 1.2.8.9-1.3.9 1.3 1.2-.8-.3 2Z" fill="#a51533"/>' +
    '<ellipse cx="49.1" cy="55.6" rx="1.2" ry="1.6" fill="#fff" fill-opacity=".4"/>',

  // тумор — треугольный оберег остриём вниз
  c_tumor:
    CORD +
    '<path d="M46.4 51.6h8.4L50.6 60.8Z" fill="#c9d4e2"/>' +
    '<path d="M48.4 53h4.4l-2.2 4.8Z" fill="#d61f5a"/>' +
    '<circle cx="50.6" cy="62" r="1.1" fill="#c9d4e2"/>',

  // калам — тростниковое перо
  c_qalam:
    CORD +
    '<path d="m47.6 51.6 7.4 9.4-1.6 1.2-7.4-9.4Z" fill="#c68a4a"/>' +
    '<path d="m53.4 62.2 1.6-1.2 1 2.6Z" fill="#2b1d10"/>' +
    '<path d="m47.6 51.6 1.6 2" stroke="#8a5a2b" stroke-width="1.2"/>',

  c_star:
    CORD +
    '<path d="m50.6 51.4 1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5Z" fill="#ffc21a"/>' +
    '<path d="m50.6 51.4 1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7Z" fill="#e89a00"/>',

  // сам лаъл — гранёный рубин с бликом
  c_lal:
    CORD +
    '<path d="M47 54.2h7.2l1.6 2.2-5.2 6.6-5.2-6.6Z" fill="#d61f5a"/>' +
    '<path d="M47 54.2h7.2l1.6 2.2H45.4Z" fill="#ff7aa2"/>' +
    '<path d="m50.6 63 1.8-6.6h-3.6Z" fill="#8f0f38" fill-opacity=".45"/>' +
    '<path d="m55.6 50.2.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5Z" fill="#fff"/>',
};

/** SVG-значок вещи для карточки: только сама вещь, в окне своего слота. */
export function gearThumb(id: string, slot: GearSlot): string {
  return (
    '<svg viewBox="' + SLOT_VIEWBOX[slot] + '" xmlns="http://www.w3.org/2000/svg" ' +
    'class="gear-thumb" aria-hidden="true" focusable="false">' +
    (GEAR_ART[id] ?? '') +
    '</svg>'
  );
}
