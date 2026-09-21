/** Профиль: сводка по игроку, установка приложения, вход в настройки. */

import { h, onTap } from '../core/dom';
import { push, type ScreenView } from '../core/router';
import { getState, subscribe } from '../core/store';
import { plural } from '../core/time';
import { button } from '../ui/button';
import { icon, type IconName } from '../ui/icons';
import { toast } from '../ui/toast';
import { canInstall, isStandalone, onInstallAvailability, promptInstall } from '../pwa/install-prompt';
import { createSettingsScreen } from './settings';

function statCard(iconName: IconName, value: string, label: string, tone: string): HTMLElement {
  return h(
    'div',
    { class: 'stat-card t-' + tone },
    h('span', { class: 'stat-card__icon' }, icon(iconName)),
    h('span', { class: 'stat-card__value', text: value }),
    h('span', { class: 'stat-card__label', text: label }),
  );
}

export function createProfileScreen(): ScreenView {
  const grid = h('div', { class: 'stat-grid' });
  const installSlot = h('div', { class: 'profile__install' });

  function renderStats(): void {
    const st = getState();
    let stars = 0;
    let done = 0;
    for (const p of Object.values(st.levels)) {
      stars += p.stars;
      if (p.stars > 0) done++;
    }
    const known = Object.values(st.srs).filter((w) => w.introduced).length;
    const accuracy = st.stats.answers > 0 ? Math.round((st.stats.correct / st.stats.answers) * 100) : 0;

    grid.replaceChildren(
      statCard('flame', String(st.streak.current), plural(st.streak.current, 'день', 'дня', 'дней'), 'orange'),
      statCard('star', String(stars), 'звёзд', 'gold'),
      statCard('map', String(done), plural(done, 'уровень', 'уровня', 'уровней'), 'green'),
      statCard('book', String(known), plural(known, 'слово', 'слова', 'слов'), 'blue'),
      statCard('target', accuracy + '%', 'точность', 'pink'),
      statCard('coin', String(st.wallet.coins), 'монет', 'purple'),
    );
  }

  function renderInstall(): void {
    installSlot.replaceChildren();
    if (isStandalone() || !canInstall()) return;
    installSlot.append(
      button({
        label: 'Установить на телефон',
        sub: 'Ярлык на главном экране, работает офлайн',
        icon: 'install',
        tone: 'green',
        wide: true,
        onTap: () => {
          void promptInstall().then((res) => {
            if (res === 'accepted') {
              toast({ text: 'Готово, ярлык на главном экране', tone: 'good' });
              renderInstall();
            }
          });
        },
      }),
    );
  }

  const settingsBtn = h(
    'button',
    { class: 'topbar__btn', attr: { type: 'button' }, aria: { label: 'Настройки' } },
    icon('settings'),
  );
  onTap(settingsBtn, () => push(createSettingsScreen, 'settings'));

  const el = h(
    'div',
    { class: 'screen screen--profile' },
    h(
      'header',
      { class: 'topbar' },
      h('div', { class: 'topbar__spacer' }),
      h('div', { class: 'topbar__title', text: 'Профиль' }),
      settingsBtn,
    ),
    h(
      'div',
      { class: 'screen-body' },
      h(
        'div',
        { class: 'profile__head' },
        h('div', { class: 'profile__avatar' }, icon('paw')),
        h('div', { class: 'h2', text: 'Салом!' }),
        h('div', { class: 'p', text: 'Учим таджикский с нуля' }),
      ),
      h('section', { class: 'panel' }, h('div', { class: 'panel__title', text: 'Статистика' }), grid),
      h('div', { class: 'profile__actions' }, installSlot),
    ),
  );

  const unsub = subscribe(renderStats);
  const unsubInstall = onInstallAvailability(renderInstall);
  renderStats();
  renderInstall();

  return {
    el,
    onShow: () => {
      renderStats();
      renderInstall();
    },
    destroy: () => {
      unsub();
      unsubInstall();
    },
  };
}
