/**
 * Навигация: четыре корневые вкладки плюс стек поверх них
 * (уровень, результаты, настройки, магазинные окна).
 * Аппаратная кнопка «назад» на Android разбирает стек через history API.
 */

import { afterAnimation } from './dom';

export type TabId = 'shop' | 'map' | 'words' | 'profile';

export interface ScreenView {
  el: HTMLElement;
  /** Вызывается каждый раз, когда экран становится видимым. */
  onShow?: () => void;
  onHide?: () => void;
  /** Освобождение таймеров и слушателей при закрытии. */
  destroy?: () => void;
}

export type ViewFactory = () => ScreenView;

interface StackEntry {
  view: ScreenView;
  /** Ключ, чтобы не открывать один и тот же экран дважды подряд. */
  key: string;
}

let stage: HTMLElement | null = null;
let overlayHost: HTMLElement | null = null;
const tabs = new Map<TabId, ViewFactory>();
const tabViews = new Map<TabId, ScreenView>();
let activeTab: TabId | null = null;
const stack: StackEntry[] = [];
const tabListeners = new Set<(tab: TabId) => void>();
const stackListeners = new Set<(depth: number) => void>();

export function mountRouter(stageEl: HTMLElement, overlayEl: HTMLElement): void {
  stage = stageEl;
  overlayHost = overlayEl;
  window.addEventListener('popstate', onPopState);
}

export function registerTab(id: TabId, factory: ViewFactory): void {
  tabs.set(id, factory);
}

export function onTabChange(fn: (tab: TabId) => void): () => void {
  tabListeners.add(fn);
  return () => tabListeners.delete(fn);
}

export function onStackChange(fn: (depth: number) => void): () => void {
  stackListeners.add(fn);
  return () => stackListeners.delete(fn);
}

export function currentTab(): TabId | null {
  return activeTab;
}

export function stackDepth(): number {
  return stack.length;
}

export function showTab(id: TabId): void {
  if (!stage) throw new Error('Роутер не смонтирован');
  if (activeTab === id && tabViews.has(id)) {
    closeAll();
    return;
  }
  closeAll();

  const prev = activeTab !== null ? tabViews.get(activeTab) : undefined;
  prev?.onHide?.();

  let view = tabViews.get(id);
  if (!view) {
    const factory = tabs.get(id);
    if (!factory) throw new Error('Вкладка не зарегистрирована: ' + id);
    view = factory();
    tabViews.set(id, view);
  }

  /*
   * Старый экран остаётся лежать под новым, пока тот проявляется.
   * Раньше он убирался сразу, и в промежутке был виден фиолетовый фон
   * приложения: зелёная карта — тёмный фиолетовый — белый список слов.
   * Именно эта вспышка и била по глазам.
   */
  const next = view;
  next.el.classList.add('screen--enter');
  stage.append(next.el);
  activeTab = id;
  next.onShow?.();
  void afterAnimation(next.el, 320).then(() => {
    next.el.classList.remove('screen--enter');
    // за время перехода могли успеть вернуться назад — тогда старый экран снова активен
    const stillActive = activeTab !== null && tabViews.get(activeTab) === prev;
    if (prev && prev !== next && !stillActive) prev.el.remove();
  });
  for (const fn of tabListeners) fn(id);
}

/** Открыть экран поверх текущего. key защищает от двойного открытия по дабл-тапу. */
export function push(factory: ViewFactory, key = ''): ScreenView | null {
  if (!overlayHost) throw new Error('Роутер не смонтирован');
  if (key && stack.some((e) => e.key === key)) return null;
  const view = factory();
  view.el.classList.add('screen--push');
  overlayHost.append(view.el);
  overlayHost.classList.remove('hidden');
  stack.push({ view, key });
  view.onShow?.();
  void afterAnimation(view.el, 320).then(() => view.el.classList.remove('screen--push'));
  // своя запись в истории, чтобы системная «назад» закрывала именно этот экран
  history.pushState({ depth: stack.length }, '');
  notifyStack();
  return view;
}

/** Закрыть верхний экран. Если pushedByUser, синхронизируем историю. */
export function pop(syncHistory = true): void {
  const entry = stack.pop();
  if (!entry) return;
  const { view } = entry;
  view.onHide?.();
  view.el.classList.add('screen--pop');
  void afterAnimation(view.el, 320).then(() => {
    view.el.remove();
    view.destroy?.();
    if (stack.length === 0 && overlayHost) overlayHost.classList.add('hidden');
  });
  if (syncHistory && history.state?.depth === stack.length + 1) history.back();
  notifyStack();
}

/** Закрыть все поверхности разом (например, при переходе на другую вкладку). */
export function closeAll(): void {
  while (stack.length) {
    const entry = stack.pop();
    if (!entry) break;
    entry.view.onHide?.();
    entry.view.el.remove();
    entry.view.destroy?.();
  }
  if (overlayHost) overlayHost.classList.add('hidden');
  notifyStack();
}

/** Заменить верхний экран — переход «уровень → результаты» без лишней истории. */
export function replaceTop(factory: ViewFactory, key = ''): ScreenView | null {
  if (!overlayHost) throw new Error('Роутер не смонтирован');
  const top = stack.pop();
  top?.view.onHide?.();

  const view = factory();
  view.el.classList.add('screen--enter');
  overlayHost.append(view.el);
  overlayHost.classList.remove('hidden');
  stack.push({ view, key });
  view.onShow?.();
  void afterAnimation(view.el, 320).then(() => {
    view.el.classList.remove('screen--enter');
    // прежний экран убираем под уже проявившимся новым: иначе на переходе
    // «уровень — итоги» сквозь него на мгновение видна карта
    if (top) {
      top.view.el.remove();
      top.view.destroy?.();
    }
  });
  notifyStack();
  return view;
}

function notifyStack(): void {
  for (const fn of stackListeners) fn(stack.length);
}

function onPopState(): void {
  if (stack.length > 0) {
    pop(false);
  } else if (activeTab !== null && activeTab !== 'map') {
    // с любой вкладки «назад» возвращает на карту, а не закрывает игру
    history.pushState({ depth: 0 }, '');
    showTab('map');
  }
}

/** Начальная запись истории, чтобы первый «назад» не выкидывал из приложения. */
export function seedHistory(): void {
  history.replaceState({ depth: 0 }, '');
}
