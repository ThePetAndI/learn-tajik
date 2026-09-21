/**
 * Модалка-«карточка» с затемнением. Используется для подтверждений,
 * сундука, колеса удачи, покупок и предупреждений.
 */

import { h, onTap } from '../core/dom';
import { button, type Tone } from './button';
import { icon } from './icons';

export interface ModalAction {
  label: string;
  tone?: Tone;
  value?: string;
  primary?: boolean;
}

export interface ModalOpts {
  title?: string;
  text?: string;
  body?: Node;
  actions?: ModalAction[];
  /** Закрывать по тапу на затемнение и по кнопке «назад». */
  dismissable?: boolean;
  /** Крестик в правом верхнем углу. */
  closeButton?: boolean;
  class?: string;
}

export interface ModalHandle {
  el: HTMLElement;
  close: (value?: string | null) => void;
  result: Promise<string | null>;
}

let openCount = 0;

export function modal(opts: ModalOpts): ModalHandle {
  const dismissable = opts.dismissable !== false;
  let resolveResult: (v: string | null) => void = () => {};
  const result = new Promise<string | null>((res) => {
    resolveResult = res;
  });

  const card = h(
    'div',
    { class: 'modal__card ' + (opts.class ?? ''), aria: { role: 'dialog', modal: 'true' } },
    opts.closeButton
      ? h(
          'button',
          {
            class: 'modal__close pressable',
            attr: { type: 'button' },
            aria: { label: 'Закрыть' },
            tap: () => close(null),
          },
          icon('close'),
        )
      : null,
    opts.title ? h('h2', { class: 'h2 modal__title', text: opts.title }) : null,
    opts.text ? h('p', { class: 'p modal__text', text: opts.text }) : null,
    opts.body ?? null,
    opts.actions?.length
      ? h(
          'div',
          { class: 'modal__actions' },
          ...opts.actions.map((a) =>
            button({
              label: a.label,
              tone: a.tone ?? (a.primary ? 'orange' : 'white'),
              wide: true,
              onTap: () => close(a.value ?? a.label),
            }),
          ),
        )
      : null,
  );

  const backdrop = h('div', { class: 'modal' }, card);

  function close(value: string | null = null): void {
    if (!backdrop.isConnected) return;
    backdrop.classList.add('is-closing');
    document.removeEventListener('keydown', onKey);
    openCount = Math.max(0, openCount - 1);
    if (openCount === 0) document.body.classList.remove('is-modal-open');
    setTimeout(() => backdrop.remove(), 220);
    resolveResult(value);
  }

  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape' && dismissable) close(null);
  };

  if (dismissable) {
    onTap(backdrop, (ev) => {
      if (ev.target === backdrop) close(null);
    });
  }
  document.addEventListener('keydown', onKey);

  document.body.append(backdrop);
  document.body.classList.add('is-modal-open');
  openCount++;

  return { el: card, close, result };
}

/** Да/нет. Возвращает true, если пользователь подтвердил. */
export async function confirmModal(
  title: string,
  text: string,
  okLabel = 'Да',
  tone: Tone = 'orange',
): Promise<boolean> {
  const m = modal({
    title,
    text,
    actions: [
      { label: okLabel, tone, value: 'ok', primary: true },
      { label: 'Отмена', tone: 'white', value: 'cancel' },
    ],
  });
  return (await m.result) === 'ok';
}
