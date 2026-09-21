/**
 * Регистрация service worker и мягкое предложение обновиться.
 * registerType: 'prompt' — не перезагружаем игру посреди уровня.
 */

import { registerSW } from 'virtual:pwa-register';
import { toast } from '../ui/toast';
import { modal } from '../ui/modal';

let updateFn: ((reload?: boolean) => Promise<void>) | null = null;
let updateReady = false;

export function initServiceWorker(): void {
  if (import.meta.env.DEV) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  updateFn = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateReady = true;
      void offerUpdate();
    },
    onOfflineReady() {
      toast({ text: 'Игра сохранена — теперь работает без интернета', iconName: 'check', tone: 'good' });
    },
    onRegisterError(err) {
      console.error('Service worker не зарегистрировался:', err);
    },
  });
}

export function hasUpdate(): boolean {
  return updateReady;
}

/** Показать предложение обновиться. Вызывается и из настроек. */
export async function offerUpdate(): Promise<void> {
  if (!updateFn || !updateReady) return;
  const m = modal({
    title: 'Есть обновление',
    text: 'Новая версия игры уже скачана. Обновить сейчас? Прогресс сохранится.',
    actions: [
      { label: 'Обновить', tone: 'green', value: 'yes', primary: true },
      { label: 'Позже', tone: 'white', value: 'no' },
    ],
  });
  if ((await m.result) === 'yes') {
    await updateFn(true);
  }
}
