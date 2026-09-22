/// <reference lib="webworker" />
/**
 * Service worker. Стратегия простая и под задачу: всё приложение
 * (код, стили, шрифты, иконки, контент) кладётся в precache при установке,
 * дальше игра работает офлайн целиком. Сети в рантайме не требуется вообще.
 */

import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

// Список файлов подставляет vite-plugin-pwa на сборке.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Любая навигация внутри приложения отдаёт index.html из кэша.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

/*
 * Озвучка кэшируется по мере проигрывания, а не кладётся в precache целиком:
 * четыреста файлов раздули бы установку, а нужны из них единицы за сеанс.
 * Один раз услышанное слово дальше доступно офлайн.
 */
registerRoute(
  ({ url }) => url.pathname.includes('/audio/'),
  new CacheFirst({
    cacheName: 'audio',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 600, maxAgeSeconds: 180 * 24 * 60 * 60 }),
    ],
  }),
);

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(self.clients.claim());
});
