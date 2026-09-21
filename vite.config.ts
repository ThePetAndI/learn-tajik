import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

// База для GitHub Pages подставляется в CI: VITE_BASE=/<имя-репозитория>/
// Локально всегда '/', поэтому ничего хардкодить не нужно.
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    // ассеты мельче 4кб инлайнятся — меньше запросов на старте
    assetsInlineLimit: 4096,
  },
  server: {
    host: true,
    port: 5173,
  },
  plugins: [
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src/pwa',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: null,
      injectManifest: {
        // всё, что нужно для офлайна: код, стили, шрифты, иконки
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,json,webmanifest}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
      devOptions: {
        enabled: false,
        type: 'module',
      },
      manifest: {
        id: 'learn-tajik',
        name: 'Тоҷикӣ — таджикский с нуля',
        short_name: 'Тоҷикӣ',
        description: 'Игра-тренажёр таджикского языка: уровни, слова, повторение.',
        lang: 'ru',
        dir: 'ltr',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait',
        background_color: '#4E32B0',
        theme_color: '#4E32B0',
        categories: ['education', 'games'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
