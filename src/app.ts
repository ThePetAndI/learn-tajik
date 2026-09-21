/** Сборка приложения: каркас, вкладки, HUD, запуск. */

import { h, qs } from './core/dom';
import { mountRouter, registerTab, seedHistory, showTab } from './core/router';
import { getState, initStore } from './core/store';
import { requestPersistentStorage } from './data/db';
import { setHapticsEnabled } from './core/haptics';
import { createHud } from './ui/hud';
import { createTabBar } from './ui/tabbar';
import { applyReducedMotion, systemPrefersReducedMotion } from './ui/motion';
import { modal } from './ui/modal';
import { initInstallPrompt } from './pwa/install-prompt';
import { initServiceWorker } from './pwa/register-sw';
import { createMapScreen } from './screens/map';
import { createProfileScreen } from './screens/profile';
import { createStubScreen } from './screens/stub';
import { formatDuration } from './core/time';
import { computeLives } from './domain/lives';
import { now } from './core/time';

export async function bootstrap(): Promise<void> {
  const root = qs<HTMLElement>('#app');

  await initStore();
  const state = getState();
  setHapticsEnabled(state.settings.haptics);
  applyReducedMotion(state.settings.reducedMotion || systemPrefersReducedMotion());

  // Просим браузер не удалять данные при нехватке места.
  void requestPersistentStorage();

  initInstallPrompt();
  initServiceWorker();

  const hud = createHud({
    onLives: showLivesInfo,
    onCoins: () => showTab('shop'),
    onStars: () => showTab('map'),
  });
  const stage = h('main', { class: 'app-stage' });
  const overlay = h('div', { class: 'app-overlay hidden' });
  const tabbar = createTabBar();

  root.replaceChildren(hud.el, stage, tabbar.el, overlay);

  mountRouter(stage, overlay);
  seedHistory();

  registerTab('map', createMapScreen);
  registerTab('shop', () =>
    createStubScreen('Магазин', 'shop', 'Питомцы, скины карты и бустеры появятся позже.'),
  );
  registerTab('words', () =>
    createStubScreen('Слова', 'book', 'Выученные слова и их прогресс появятся позже.'),
  );
  registerTab('profile', createProfileScreen);

  showTab('map');
  tabbar.setActive('map');

  // Заставку убираем только когда шрифт готов — иначе на секунду мелькает системный.
  await waitForFonts();
  hideBootSplash();
}

function showLivesInfo(): void {
  const lives = computeLives(getState().lives, now());
  const text = lives.full
    ? 'Запас полон: ' + lives.max + ' из ' + lives.max + '.'
    : 'Осталось ' +
      lives.count +
      ' из ' +
      lives.max +
      '. Следующая жизнь через ' +
      formatDuration(lives.msToNext) +
      '.';
  modal({
    title: 'Жизни',
    text,
    actions: [{ label: 'Понятно', tone: 'orange', value: 'ok', primary: true }],
  });
}

async function waitForFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await Promise.race([
      document.fonts.ready,
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch {
    /* шрифты не критичны для запуска */
  }
}

function hideBootSplash(): void {
  const boot = document.getElementById('boot');
  if (!boot) return;
  boot.classList.add('is-gone');
  setTimeout(() => boot.remove(), 600);
}
