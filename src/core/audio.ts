/**
 * Проигрывание озвучки. Записей в проекте пока нет — поле audio у слов
 * и букв пустое, и кнопка звука нигде не появляется. Когда файлы лягут
 * в public/audio, всё заработает само.
 *
 * Своего синтеза речи здесь нет и не будет: русский голос прочитает
 * «ҳавз» как «хавз» и закрепит неверное произношение — ровно то, от чего
 * защищает задание «пропущенная буква».
 */

let enabled = true;
let current: HTMLAudioElement | null = null;

export function setSoundEnabled(on: boolean): void {
  enabled = on;
  if (!on) stop();
}

export function soundEnabled(): boolean {
  return enabled;
}

export function stop(): void {
  if (!current) return;
  try {
    current.pause();
  } catch {
    // некоторые прошивки кидают на pause() уже остановленного — это не повод падать
  }
  current = null;
}

/**
 * Проигрывает файл озвучки. Путь относительный — база подставится сама,
 * чтобы работало и на GitHub Pages в подкаталоге.
 * Ошибки глушим: нет файла или запрещено автовоспроизведение — не беда.
 */
export function play(src: string | null | undefined): void {
  if (!enabled || !src) return;
  stop();
  try {
    const audio = new Audio(new URL(src, document.baseURI).href);
    current = audio;
    void audio.play().catch(() => {
      current = null;
    });
  } catch {
    current = null;
  }
}

/** Есть ли что проигрывать — по этому прячется кнопка. */
export function hasAudio(src: string | null | undefined): boolean {
  return typeof src === 'string' && src.length > 0;
}
