/** Фабрика «жевательных» кнопок. Все кнопки игры создаются здесь. */

import { h, onTap } from '../core/dom';
import { haptics } from '../core/haptics';
import { icon, type IconName } from './icons';

export type Tone =
  | 'orange'
  | 'pink'
  | 'gold'
  | 'purple'
  | 'green'
  | 'blue'
  | 'red'
  | 'teal'
  | 'ruby'
  | 'lock'
  | 'white';

export interface ButtonOpts {
  label?: string;
  sub?: string;
  tone?: Tone;
  size?: 'sm' | 'md' | 'big';
  icon?: IconName;
  iconRight?: IconName;
  wide?: boolean;
  disabled?: boolean;
  class?: string;
  ariaLabel?: string;
  onTap?: (ev: PointerEvent | MouseEvent) => void;
}

export function button(opts: ButtonOpts): HTMLButtonElement {
  const classes = ['btn', 't-' + (opts.tone ?? 'orange')];
  if (opts.size === 'big') classes.push('btn--big');
  if (opts.size === 'sm') classes.push('btn--sm');
  if (opts.wide) classes.push('btn--wide');
  if (opts.tone === 'white' || opts.tone === 'gold') classes.push('btn--ink');
  if (!opts.label && opts.icon && !opts.sub) classes.push('btn--icon');
  if (opts.class) classes.push(opts.class);

  const el = h(
    'button',
    {
      class: classes.join(' '),
      attr: { type: 'button', disabled: opts.disabled ? 'disabled' : undefined },
      aria: { label: opts.ariaLabel ?? undefined },
    },
    opts.icon ? icon(opts.icon) : null,
    opts.label || opts.sub
      ? h(
          'span',
          { class: 'btn__text' },
          opts.label ? h('span', { class: 'btn__label', text: opts.label }) : null,
          opts.sub ? h('span', { class: 'btn__sub', text: opts.sub }) : null,
        )
      : null,
    opts.iconRight ? icon(opts.iconRight) : null,
  );

  if (opts.onTap) {
    const handler = (ev: PointerEvent | MouseEvent) => {
      if (el.disabled) return;
      haptics.tap();
      opts.onTap?.(ev);
    };
    onTap(el, handler);
  }
  return el;
}

/** Маленькая круглая кнопка-иконка (закрыть, назад, «+»). */
export function iconButton(
  name: IconName,
  opts: { tone?: Tone; onTap?: () => void; ariaLabel: string; class?: string } = {
    ariaLabel: '',
  },
): HTMLButtonElement {
  return button({
    icon: name,
    tone: opts.tone ?? 'white',
    class: 'btn--round ' + (opts.class ?? ''),
    ariaLabel: opts.ariaLabel,
    onTap: opts.onTap,
  });
}
