/**
 * Мелочи, общие для питомцев и снаряжения: тост «не хватает» и строка шансов.
 */

import { h } from '../core/dom';
import { haptics } from '../core/haptics';
import { RARITY_ORDER, RARITY_TITLE, type Rarity } from '../domain/rarity';
import { toast } from '../ui/toast';

export function poorToast(what: 'coins' | 'gems' | 'shards'): void {
  haptics.wrong();
  const text = what === 'coins' ? 'Не хватает монет' : what === 'gems' ? 'Не хватает лаъл' : 'Не хватает осколков';
  toast({ text, iconName: what === 'coins' ? 'coin' : what === 'gems' ? 'gem' : 'shards', tone: 'bad' });
}

/** 62%, 2.4%, 0.4% — мелкие шансы с десятыми, чтобы не показывать «0%». */
export function fmtOdds(p: number): string {
  return (p >= 10 ? Math.round(p) : Math.round(p * 10) / 10) + '%';
}

/**
 * Шансы по редкостям: цветная метка, название и процент. Нулевые не
 * показываются — «легендарный 0%» только дразнит. Название рядом с цветом
 * нужно, чтобы цвета редкостей было откуда выучить.
 */
export function oddsChips(odds: Record<Rarity, number>): HTMLElement[] {
  return RARITY_ORDER.filter((r) => odds[r] > 0).map((r) =>
    h(
      'span',
      { class: 'godds r-' + r },
      h('span', { class: 'godds__dot' }),
      h('span', { text: RARITY_TITLE[r].toLowerCase() + ' ' + fmtOdds(odds[r]) }),
    ),
  );
}

export function rarityChip(rarity: Rarity): HTMLElement {
  return h('span', { class: 'rarity r-' + rarity, text: RARITY_TITLE[rarity] });
}
