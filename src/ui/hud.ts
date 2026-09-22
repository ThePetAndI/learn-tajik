/** Верхняя панель: жизни, монеты с «плюсом», звёзды. Живёт над вкладками. */

import { h, onTap } from '../core/dom';
import { getState, subscribe } from '../core/store';
import { now } from '../core/time';
import { computeLives } from '../domain/lives';
import { icon } from './icons';

export interface HudHandle {
  el: HTMLElement;
  refresh: () => void;
  destroy: () => void;
  /** Подсветить счётчик монет после награды. */
  pulse: (what: 'coins' | 'gems' | 'lives' | 'stars') => void;
}

export interface HudOpts {
  onLives?: () => void;
  onCoins?: () => void;
  onStars?: () => void;
}

function pill(cls: string, iconEl: SVGSVGElement, valueEl: HTMLElement, extra?: Node): HTMLElement {
  return h('div', { class: 'hud__pill ' + cls }, iconEl, valueEl, extra ?? null);
}

export function createHud(opts: HudOpts = {}): HudHandle {
  const livesValue = h('span', { class: 'hud__value', text: '5' });
  const coinsValue = h('span', { class: 'hud__value', text: '0' });
  const gemsValue = h('span', { class: 'hud__value', text: '0' });
  const starsValue = h('span', { class: 'hud__value', text: '0' });

  const plus = h(
    'button',
    { class: 'hud__plus', attr: { type: 'button' }, aria: { label: 'Пополнить монеты' } },
    icon('plus'),
  );

  const livesPill = pill('hud__pill--lives', icon('heart'), livesValue);
  const coinsPill = pill('hud__pill--coins', icon('coin'), coinsValue, plus);
  const gemsPill = pill('hud__pill--gems', icon('gem'), gemsValue);
  gemsPill.setAttribute('title', 'Лаъл — за освоенные слова, уровни без ошибок и серию');
  const starsPill = pill('hud__pill--stars', icon('star'), starsValue);

  const el = h('header', { class: 'hud' }, livesPill, coinsPill, gemsPill, starsPill);

  if (opts.onLives) onTap(livesPill, opts.onLives);
  if (opts.onCoins) onTap(plus, opts.onCoins);
  if (opts.onStars) onTap(starsPill, opts.onStars);

  function refresh(): void {
    const st = getState();
    const lives = computeLives(st.lives, now());
    livesValue.textContent = String(lives.count);
    livesPill.classList.toggle('is-empty', lives.count === 0);
    coinsValue.textContent = String(st.wallet.coins);
    gemsValue.textContent = String(st.wallet.gems);
    let stars = 0;
    for (const p of Object.values(st.levels)) stars += p.stars;
    starsValue.textContent = String(stars);
  }

  function pulse(what: 'coins' | 'gems' | 'lives' | 'stars'): void {
    const target =
      what === 'coins' ? coinsPill : what === 'gems' ? gemsPill : what === 'lives' ? livesPill : starsPill;
    target.classList.remove('is-pulse');
    void target.offsetWidth; // перезапуск анимации
    target.classList.add('is-pulse');
  }

  const unsub = subscribe(refresh);
  // жизни капают по таймеру — раз в полминуты сверяем счётчик
  const ticker = window.setInterval(refresh, 30_000);
  refresh();

  return {
    el,
    refresh,
    pulse,
    destroy: () => {
      unsub();
      clearInterval(ticker);
      el.remove();
    },
  };
}
