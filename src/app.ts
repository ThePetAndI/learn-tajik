/** Сборка приложения: каркас, вкладки, HUD, запуск. */

import { h, qs } from './core/dom';
import { mountRouter, push, registerTab, seedHistory, showTab } from './core/router';
import { getState, initStore, update } from './core/store';
import { requestPersistentStorage } from './data/db';
import { setHapticsEnabled } from './core/haptics';
import { createHud } from './ui/hud';
import { createTabBar } from './ui/tabbar';
import { applyReducedMotion, systemPrefersReducedMotion } from './ui/motion';
import { setSoundEnabled } from './core/audio';
import { initInstallPrompt } from './pwa/install-prompt';
import { initServiceWorker } from './pwa/register-sw';
import { createLevelScreen } from './screens/level';
import { setLevelStartHandler, setLivesGate } from './screens/level-card';
import { createMapScreen } from './screens/map';
import { createProfileScreen } from './screens/profile';
import { openLivesModal } from './screens/rewards';
import { createShopScreen } from './screens/shop';
import { createWordsScreen } from './screens/words';
import { now } from './core/time';
import { levels } from './data/content';
import { reconcileGems } from './domain/reconcile';
import { applyPetEffects } from './domain/shop';
import { toast } from './ui/toast';

export async function bootstrap(): Promise<void> {
  const root = qs<HTMLElement>('#app');

  await initStore();
  const state = getState();
  setHapticsEnabled(state.settings.haptics);
  applyReducedMotion(state.settings.reducedMotion || systemPrefersReducedMotion());
  setSoundEnabled(state.settings.sound);

  // Просим браузер не удалять данные при нехватке места.
  void requestPersistentStorage();

  initInstallPrompt();
  initServiceWorker();

  // бонусы питомца применяются при старте: максимум жизней зависит от него
  update((st) => applyPetEffects(st, now()));

  // лаъл за уже сделанное: у старого сохранения ледгер пуст, а заслуги есть
  let backpay = 0;
  update((st) => {
    backpay = reconcileGems(st, levels, now());
  });

  const hud = createHud({
    onLives: openLivesModal,
    onCoins: () => showTab('shop'),
    onStars: () => showTab('map'),
  });
  const stage = h('main', { class: 'app-stage' });
  const overlay = h('div', { class: 'app-overlay hidden' });
  const tabbar = createTabBar();

  root.replaceChildren(hud.el, stage, tabbar.el, overlay);

  mountRouter(stage, overlay);
  seedHistory();

  // карта не знает про движок, движок не знает про карту — связь только здесь
  setLevelStartHandler((level) => push(() => createLevelScreen(level), 'level:' + level.id));
  setLivesGate(openLivesModal);

  registerTab('map', createMapScreen);
  registerTab('shop', createShopScreen);
  registerTab('words', createWordsScreen);
  registerTab('profile', createProfileScreen);

  showTab('map');
  tabbar.setActive('map');

  if (backpay > 0) {
    toast({ text: 'Лаъл за уже сделанное: +' + backpay, iconName: 'gem', tone: 'gold', ms: 4500 });
  }

  // Заставку убираем только когда шрифт готов — иначе на секунду мелькает системный.
  await waitForFonts();
  hideBootSplash();
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
