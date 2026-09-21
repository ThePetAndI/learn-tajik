/**
 * Установка на главный экран. Chrome на Android даёт событие
 * beforeinstallprompt — ловим его и показываем свою кнопку в профиле,
 * вместо невзрачной системной плашки.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(can: boolean) => void>();

export function initInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (ev) => {
    ev.preventDefault();
    deferred = ev as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

export function canInstall(): boolean {
  return deferred !== null;
}

/** Уже запущено как установленное приложение? */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function onInstallAvailability(fn: (can: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(): void {
  for (const fn of listeners) fn(deferred !== null);
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable';
  const ev = deferred;
  deferred = null;
  notify();
  try {
    await ev.prompt();
    const choice = await ev.userChoice;
    return choice.outcome;
  } catch {
    return 'dismissed';
  }
}
