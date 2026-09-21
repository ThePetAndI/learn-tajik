/**
 * Единственный источник правды о прогрессе.
 * Мутируем состояние внутри update(), подписчики получают уведомление,
 * запись на диск — с задержкой, чтобы не дёргать IndexedDB на каждый тап.
 */

import { loadState, saveState } from '../data/persist';
import { createInitialState, type SaveState } from '../data/state';
import { setHapticsEnabled } from './haptics';
import { now } from './time';

const SAVE_DEBOUNCE_MS = 400;

type Listener = (state: SaveState) => void;

let state: SaveState = createInitialState(now());
let ready = false;
const listeners = new Set<Listener>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSave: Promise<void> | null = null;

export function getState(): SaveState {
  return state;
}

export function isReady(): boolean {
  return ready;
}

export async function initStore(): Promise<SaveState> {
  state = await loadState();
  ready = true;
  setHapticsEnabled(state.settings.haptics);
  installLifecycleHooks();
  notify();
  return state;
}

/** Полностью заменить состояние — используется импортом и сбросом прогресса. */
export async function replaceState(next: SaveState): Promise<void> {
  state = next;
  setHapticsEnabled(state.settings.haptics);
  notify();
  await flushSave();
}

/**
 * Изменить состояние. Мутировать напрямую — осознанно: объект большой,
 * а иммутабельные копии на каждый ответ дали бы лишний мусор в GC.
 */
export function update(fn: (draft: SaveState) => void): SaveState {
  fn(state);
  notify();
  scheduleSave();
  return state;
}

/** Тихое изменение без перерисовки — например, счётчики внутри сессии. */
export function updateQuiet(fn: (draft: SaveState) => void): SaveState {
  fn(state);
  scheduleSave();
  return state;
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(): void {
  for (const fn of listeners) {
    try {
      fn(state);
    } catch (err) {
      console.error('Подписчик store упал:', err);
    }
  }
}

function scheduleSave(): void {
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    pendingSave = saveState(state).catch((err) => {
      console.error('Не удалось сохранить прогресс:', err);
    });
  }, SAVE_DEBOUNCE_MS);
}

/** Записать немедленно: перед экспортом, при уходе со страницы. */
export async function flushSave(): Promise<void> {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  pendingSave = saveState(state).catch((err) => {
    console.error('Не удалось сохранить прогресс:', err);
  });
  await pendingSave;
}

let hooksInstalled = false;

function installLifecycleHooks(): void {
  if (hooksInstalled || typeof document === 'undefined') return;
  hooksInstalled = true;
  // pagehide надёжнее beforeunload на Android: срабатывает при сворачивании
  const onLeave = () => {
    void flushSave();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') onLeave();
  });
  window.addEventListener('pagehide', onLeave);
}

/** Только для тестов: вернуть store в исходное состояние. */
export function __resetStoreForTests(next?: SaveState): void {
  state = next ?? createInitialState(now());
  ready = false;
  listeners.clear();
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
}
