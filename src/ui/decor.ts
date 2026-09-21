/**
 * Декорации карты: деревья, кусты, камни, цветы, облака.
 * Рисуются инлайн-SVG в локальных координатах вокруг нуля,
 * цвета берутся из CSS-классов — чтобы скины карты могли их перекрашивать.
 */

import { s } from '../core/dom';
import type { DecorItem, DecorKind } from '../domain/map-layout';

function el(markup: string): SVGGElement {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.innerHTML = markup;
  return g as SVGGElement;
}

const SHAPES: Record<DecorKind, string> = {
  tree:
    '<ellipse cx="0" cy="7" rx="14" ry="4" class="d-shadow"/>' +
    '<rect x="-3.2" y="-7" width="6.4" height="15" rx="3.2" class="d-trunk"/>' +
    '<circle cx="-8.5" cy="-10" r="9" class="d-leaf-2"/>' +
    '<circle cx="8.5" cy="-10" r="9" class="d-leaf-3"/>' +
    '<circle cx="0" cy="-16" r="11.5" class="d-leaf-1"/>' +
    '<circle cx="-4" cy="-20" r="5.5" class="d-leaf-hi"/>',
  bush:
    '<ellipse cx="0" cy="5" rx="12" ry="3.4" class="d-shadow"/>' +
    '<circle cx="-6.5" cy="-1" r="7" class="d-leaf-2"/>' +
    '<circle cx="6.5" cy="-1" r="7" class="d-leaf-3"/>' +
    '<circle cx="0" cy="-6" r="8" class="d-leaf-1"/>' +
    '<circle cx="-3" cy="-8.5" r="3.4" class="d-leaf-hi"/>',
  rock:
    '<ellipse cx="0" cy="5.5" rx="12" ry="3.2" class="d-shadow"/>' +
    '<path d="M-11 5.5 -6.5-6 1.5-9.5 11 1.5 8.5 5.5Z" class="d-rock"/>' +
    '<path d="M-6.5-6 1.5-9.5 3.5-2.5-3.5-.5Z" class="d-rock-hi"/>',
  flower:
    '<path d="M0 7V-1.5" class="d-stem"/>' +
    '<circle cx="0" cy="-8.5" r="3.6" class="d-petal"/>' +
    '<circle cx="-5" cy="-5.5" r="3.2" class="d-petal"/>' +
    '<circle cx="5" cy="-5.5" r="3.2" class="d-petal"/>' +
    '<circle cx="-3.2" cy="-11.5" r="3" class="d-petal"/>' +
    '<circle cx="3.2" cy="-11.5" r="3" class="d-petal"/>' +
    '<circle cx="0" cy="-8" r="2.4" class="d-petal-core"/>',
  cloud:
    '<ellipse cx="-9" cy="1" rx="9.5" ry="7.5" class="d-cloud"/>' +
    '<ellipse cx="3" cy="-3" rx="12" ry="10" class="d-cloud"/>' +
    '<ellipse cx="13" cy="1.5" rx="8.5" ry="6.5" class="d-cloud"/>' +
    '<rect x="-18" y="-1" width="32" height="9" rx="4.5" class="d-cloud"/>',
};

/** Собирает слой декора для раздела карты. */
export function decorLayer(items: readonly DecorItem[]): SVGGElement {
  const layer = s('g', { class: 'map__decor' });
  // облака рисуем последними, чтобы они были поверх дорожки
  const ordered = [...items].sort((a, b) => {
    if (a.kind === 'cloud' && b.kind !== 'cloud') return 1;
    if (b.kind === 'cloud' && a.kind !== 'cloud') return -1;
    return a.y - b.y;
  });
  for (const item of ordered) {
    const g = el(SHAPES[item.kind]);
    const flip = item.flip ? ' scale(-1 1)' : '';
    g.setAttribute(
      'transform',
      'translate(' + item.x + ' ' + item.y + ') scale(' + item.scale + ')' + flip,
    );
    g.setAttribute('class', 'decor decor--' + item.kind);
    layer.append(g);
  }
  return layer;
}
