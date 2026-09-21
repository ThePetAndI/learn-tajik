/**
 * Конфетти для наград. Немного бумажек, которые разлетаются и падают.
 * Через Web Animations API — так браузер считает их на композиторе.
 */

import { h } from '../core/dom';

const COLORS = ['#ffd12e', '#ff7a1a', '#ff3d7f', '#3fc23a', '#2e9be6', '#b98bff'];

export interface ConfettiOptions {
  /** Откуда разлетается, в координатах окна. По умолчанию — центр экрана. */
  x?: number;
  y?: number;
  count?: number;
}

export function confetti(opts: ConfettiOptions = {}): void {
  if (document.documentElement.classList.contains('reduced-motion')) return;

  const x = opts.x ?? window.innerWidth / 2;
  const y = opts.y ?? window.innerHeight * 0.4;
  const count = opts.count ?? 26;

  const host = h('div', { class: 'confetti' });
  document.body.append(host);

  for (let i = 0; i < count; i++) {
    const piece = h('span', {
      class: 'confetti__piece',
      style: {
        left: x + 'px',
        top: y + 'px',
        background: COLORS[i % COLORS.length] as string,
        width: 7 + Math.random() * 7 + 'px',
        height: 10 + Math.random() * 8 + 'px',
      },
    });
    host.append(piece);

    const angle = Math.random() * Math.PI * 2;
    const power = 120 + Math.random() * 190;
    const dx = Math.cos(angle) * power;
    const dy = Math.sin(angle) * power - 140;
    const spin = (Math.random() - 0.5) * 900;
    const life = 1100 + Math.random() * 700;

    piece.animate(
      [
        { transform: 'translate3d(0,0,0) rotate(0deg)', opacity: 1 },
        {
          transform:
            'translate3d(' + dx + 'px,' + (dy + 260) + 'px,0) rotate(' + spin + 'deg)',
          opacity: 0,
        },
      ],
      { duration: life, easing: 'cubic-bezier(0.18, 0.7, 0.4, 1)', fill: 'forwards' },
    );
  }

  setTimeout(() => host.remove(), 2200);
}
