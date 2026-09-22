/** Настройки: тумблеры, экспорт/импорт прогресса, установка, сброс. */

import { h, onTap } from '../core/dom';
import { haptics, hapticsSupported, setHapticsEnabled } from '../core/haptics';
import { pop, type ScreenView } from '../core/router';
import { flushSave, getState, replaceState, update } from '../core/store';
import { storageBackend, storageEstimate } from '../data/db';
import {
  buildExport,
  downloadJson,
  exportFilename,
  parseImport,
  pickJsonFile,
} from '../data/persist';
import { createInitialState } from '../data/state';
import { now } from '../core/time';
import { button } from '../ui/button';
import { icon, type IconName } from '../ui/icons';
import { confirmModal, modal } from '../ui/modal';
import { toast } from '../ui/toast';
import { canInstall, isStandalone, onInstallAvailability, promptInstall } from '../pwa/install-prompt';
import { applyReducedMotion, systemPrefersReducedMotion } from '../ui/motion';
import { setSoundEnabled } from '../core/audio';

function switchRow(
  iconName: IconName,
  label: string,
  hint: string,
  get: () => boolean,
  set: (v: boolean) => void,
  disabled = false,
): HTMLElement {
  const sw = h('button', {
    class: 'switch' + (get() ? ' is-on' : ''),
    attr: { type: 'button', disabled: disabled ? 'disabled' : undefined },
    aria: { role: 'switch', checked: get() ? 'true' : 'false', label },
  });
  const row = h(
    'div',
    { class: 'row-item' },
    h('span', { class: 'row-item__icon' }, icon(iconName)),
    h(
      'div',
      { class: 'row-item__text' },
      h('div', { class: 'row-item__label', text: label }),
      hint ? h('div', { class: 'row-item__hint', text: hint }) : null,
    ),
    sw,
  );
  if (!disabled) {
    onTap(sw, () => {
      const next = !get();
      set(next);
      sw.classList.toggle('is-on', next);
      sw.setAttribute('aria-checked', next ? 'true' : 'false');
      haptics.tap();
    });
  } else {
    sw.style.opacity = '0.45';
  }
  return row;
}

function stepperRow(
  iconName: IconName,
  label: string,
  hint: string,
  get: () => number,
  set: (v: number) => void,
  step: number,
  min: number,
  max: number,
): HTMLElement {
  const value = h('span', { class: 'stepper__value', text: String(get()) });
  const mk = (sign: -1 | 1, name: IconName) => {
    const b = h(
      'button',
      { class: 'stepper__btn', attr: { type: 'button' }, aria: { label: sign > 0 ? 'Больше' : 'Меньше' } },
      icon(name),
    );
    onTap(b, () => {
      const next = Math.min(max, Math.max(min, get() + sign * step));
      set(next);
      value.textContent = String(next);
      haptics.tap();
    });
    return b;
  };
  return h(
    'div',
    { class: 'row-item' },
    h('span', { class: 'row-item__icon' }, icon(iconName)),
    h(
      'div',
      { class: 'row-item__text' },
      h('div', { class: 'row-item__label', text: label }),
      hint ? h('div', { class: 'row-item__hint', text: hint }) : null,
    ),
    h('div', { class: 'stepper' }, mk(-1, 'minus'), value, mk(1, 'plus')),
  );
}

async function doExport(): Promise<void> {
  await flushSave();
  const data = buildExport(getState());
  downloadJson(exportFilename(), data);
  toast({ text: 'Файл прогресса сохранён', iconName: 'download', tone: 'good' });
}

async function doImport(): Promise<void> {
  const text = await pickJsonFile();
  if (text === null) return;
  const parsed = parseImport(text);
  if (!parsed.ok) {
    modal({ title: 'Не получилось', text: parsed.error, actions: [{ label: 'Понятно', value: 'ok' }] });
    return;
  }
  const st = parsed.state;
  let levels = 0;
  let stars = 0;
  for (const p of Object.values(st.levels)) {
    if (p.stars > 0) levels++;
    stars += p.stars;
  }
  const words = Object.keys(st.srs).length;
  const ok = await confirmModal(
    'Заменить прогресс?',
    'В файле: пройдено уровней — ' +
      levels +
      ', звёзд — ' +
      stars +
      ', слов в повторении — ' +
      words +
      ', монет — ' +
      st.wallet.coins +
      '. Текущий прогресс будет перезаписан.',
    'Заменить',
    'red',
  );
  if (!ok) return;
  await replaceState(st);
  setHapticsEnabled(st.settings.haptics);
  applyReducedMotion(st.settings.reducedMotion || systemPrefersReducedMotion());
  for (const w of parsed.warnings) toast({ text: w, tone: 'default', ms: 4000 });
  toast({ text: 'Прогресс загружен', iconName: 'check', tone: 'good' });
}

async function doReset(): Promise<void> {
  const ok = await confirmModal(
    'Начать заново?',
    'Уровни, звёзды, монеты и статистика слов будут стёрты. Это не отменить — сначала лучше сохранить файл прогресса.',
    'Стереть всё',
    'red',
  );
  if (!ok) return;
  await replaceState(createInitialState(now()));
  toast({ text: 'Прогресс сброшен', iconName: 'refresh' });
}

export function createSettingsScreen(): ScreenView {
  const installRow = h('div', { class: 'settings__install' });
  const storageInfo = h('div', { class: 'row-item__hint', text: 'Проверяю хранилище…' });

  function renderInstall(): void {
    installRow.replaceChildren();
    if (isStandalone()) {
      installRow.append(
        h('div', { class: 'row-item__hint', text: 'Игра уже установлена на устройство.' }),
      );
    } else if (canInstall()) {
      installRow.append(
        button({
          label: 'Установить на телефон',
          icon: 'install',
          tone: 'green',
          wide: true,
          onTap: () => {
            void promptInstall().then((res) => {
              if (res === 'accepted') toast({ text: 'Готово, ярлык на экране', tone: 'good' });
            });
          },
        }),
      );
    } else {
      installRow.append(
        h('div', {
          class: 'row-item__hint',
          text: 'Чтобы установить: меню Chrome (три точки) → «Добавить на главный экран».',
        }),
      );
    }
  }

  renderInstall();
  const unsubInstall = onInstallAvailability(renderInstall);

  void storageEstimate().then((est) => {
    const backend = storageBackend() === 'indexeddb' ? 'IndexedDB' : 'localStorage';
    if (!est || est.quota === 0) {
      storageInfo.textContent = 'Хранилище: ' + backend;
      return;
    }
    const mb = (n: number) => (n / 1024 / 1024).toFixed(1);
    storageInfo.textContent =
      'Хранилище: ' + backend + ' — занято ' + mb(est.usage) + ' МБ из ' + mb(est.quota) + ' МБ';
  });

  const body = h(
    'div',
    { class: 'screen-body' },
    h(
      'section',
      { class: 'panel' },
      h('div', { class: 'panel__title', text: 'Игра' }),
      switchRow(
        'vibrate',
        'Вибрация',
        hapticsSupported()
          ? 'Короткий отклик на верный и неверный ответ'
          : 'Это устройство не умеет вибрировать',
        () => getState().settings.haptics,
        (v) => {
          update((s) => {
            s.settings.haptics = v;
          });
          setHapticsEnabled(v);
          if (v) haptics.correct();
        },
        !hapticsSupported(),
      ),
      switchRow(
        'sparkle',
        'Спокойные анимации',
        // Если покой просит сама система, движения не будет при любом положении
        // переключателя — молчать об этом значит врать выключенным тумблером
        systemPrefersReducedMotion()
          ? 'Включено в настройках системы — движения не будет в любом случае'
          : 'Меньше движения на экране',
        () => getState().settings.reducedMotion,
        (v) => {
          update((s) => {
            s.settings.reducedMotion = v;
          });
          applyReducedMotion(v || systemPrefersReducedMotion());
        },
      ),
      switchRow(
        'speaker',
        'Звук',
        'Проигрывать озвучку слов и букв там, где она есть',
        () => getState().settings.sound,
        (v) => {
          update((s) => {
            s.settings.sound = v;
          });
          setSoundEnabled(v);
        },
      ),
      switchRow(
        'bulb',
        'Подсказки к словам',
        'Показывать разбор особых букв под таджикскими словами',
        () => getState().settings.showHints,
        (v) =>
          update((s) => {
            s.settings.showHints = v;
          }),
      ),
      stepperRow(
        'target',
        'Цель на день',
        'Сколько упражнений в день считается выполненной целью',
        () => getState().settings.dailyGoal,
        (v) =>
          update((s) => {
            s.settings.dailyGoal = v;
          }),
        5,
        5,
        100,
      ),
    ),
    h(
      'section',
      { class: 'panel' },
      h('div', { class: 'panel__title', text: 'Прогресс' }),
      h('p', {
        class: 'row-item__hint',
        text: 'Прогресс хранится только на этом устройстве. Файл экспорта можно перенести на другой телефон или держать как резервную копию.',
      }),
      h(
        'div',
        { class: 'settings__buttons' },
        button({
          label: 'Сохранить в файл',
          icon: 'download',
          tone: 'blue',
          wide: true,
          onTap: () => void doExport(),
        }),
        button({
          label: 'Загрузить из файла',
          icon: 'upload',
          tone: 'purple',
          wide: true,
          onTap: () => void doImport(),
        }),
      ),
    ),
    h(
      'section',
      { class: 'panel' },
      h('div', { class: 'panel__title', text: 'Приложение' }),
      installRow,
      storageInfo,
      h('div', {
        class: 'row-item__hint settings__version',
        text: 'Версия ' + __APP_VERSION__ + ' · сборка ' + __BUILD_DATE__,
      }),
    ),
    h(
      'section',
      { class: 'panel panel--danger' },
      h('div', { class: 'panel__title', text: 'Опасная зона' }),
      button({
        label: 'Начать заново',
        icon: 'trash',
        tone: 'red',
        wide: true,
        onTap: () => void doReset(),
      }),
    ),
  );

  const back = h(
    'button',
    { class: 'topbar__btn', attr: { type: 'button' }, aria: { label: 'Назад' } },
    icon('chevronLeft'),
  );
  onTap(back, () => pop());

  const el = h(
    'div',
    { class: 'screen screen--settings' },
    h(
      'header',
      { class: 'topbar' },
      back,
      h('div', { class: 'topbar__title', text: 'Настройки' }),
      h('div', { class: 'topbar__spacer' }),
    ),
    body,
  );

  return {
    el,
    destroy: () => unsubInstall(),
  };
}
