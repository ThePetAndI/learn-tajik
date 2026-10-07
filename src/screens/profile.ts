/** Профиль: сводка по игроку, установка приложения, вход в настройки. */

import { h, onTap } from '../core/dom';
import { push, type ScreenView } from '../core/router';
import { getState, subscribe, update } from '../core/store';
import { plural } from '../core/time';
import { button } from '../ui/button';
import { icon, type IconName } from '../ui/icons';
import { confirmModal, modal } from '../ui/modal';
import { toast } from '../ui/toast';
import { clearReports, formatReports, REASON_LABELS, removeReport } from '../domain/reports';
import { canInstall, isStandalone, onInstallAvailability, promptInstall } from '../pwa/install-prompt';
import { now } from '../core/time';
import { visibleStreak } from '../domain/streak';
import {
  GEM_MASTERED,
  GEM_PERFECT,
  GEM_SECTION,
  GEM_SECTION_FULL,
  nextStreakMilestone,
} from '../domain/gems';
import { activePet, petBonus, petRank } from '../domain/catalog';
import { perkLabels } from '../domain/perks';
import { levels, sections } from '../data/content';
import { breedOf, petFace } from '../ui/pet';
import { createSettingsScreen } from './settings';

function statCard(iconName: IconName, value: string, label: string, tone: string): HTMLElement {
  return h(
    'div',
    { class: 'stat-card t-' + tone },
    h('span', { class: 'stat-card__icon' }, icon(iconName)),
    h('span', { class: 'stat-card__value', text: value }),
    h('span', { class: 'stat-card__label', text: label }),
  );
}

/** Иконка питомца для аватара — та же, что в магазине. */
export function createProfileScreen(): ScreenView {
  const grid = h('div', { class: 'stat-grid' });
  const petLine = h('div', { class: 'p' });
  const installSlot = h('div', { class: 'profile__install' });
  const avatar = h('div', { class: 'profile__avatar' });
  const courseBar = h('span', { class: 'course-bar__fill' });
  const courseText = h('div', { class: 'course-bar__text' });
  const courseNote = h('div', { class: 'course-note' });
  const gemBalance = h('span', { class: 'gem-panel__value' });
  const gemRows = h('div', { class: 'gem-panel__rows' });

  /** Строка «за что платят лаъл»: повод, награда, сколько уже взято. */
  function gemRow(iconName: IconName, what: string, reward: string, progress: string): HTMLElement {
    return h(
      'div',
      { class: 'gem-row' },
      h('span', { class: 'gem-row__icon' }, icon(iconName)),
      h(
        'span',
        { class: 'gem-row__text' },
        h('span', { class: 'gem-row__what', text: what }),
        h('span', { class: 'gem-row__progress', text: progress }),
      ),
      h('span', { class: 'gem-row__reward' }, icon('gem'), h('span', { text: reward })),
    );
  }

  function renderStats(): void {
    const st = getState();
    let stars = 0;
    let done = 0;
    for (const p of Object.values(st.levels)) {
      stars += p.stars;
      if (p.stars > 0) done++;
    }
    const known = Object.values(st.srs).filter((w) => w.introduced).length;
    const streak = visibleStreak(st, now());
    const accuracy = st.stats.answers > 0 ? Math.round((st.stats.correct / st.stats.answers) * 100) : 0;

    const pet = activePet(st);
    // бонус на текущей ступени, а не описание из каталога: оно про первую ступень
    const bonus = pet ? perkLabels(petBonus(st, pet.id)) : [];
    petLine.textContent = pet
      ? 'Питомец: ' + pet.title + (bonus.length > 0 ? ' · ' + bonus.join(', ') : '')
      : 'Учим таджикский с нуля';
    // в аватаре — лицо самого питомца, со звёздами: значков на каждого зверя не напасёшься
    avatar.replaceChildren(petFace(breedOf(st.profile.petId), pet ? petRank(st, pet.id) : 1, 'profile__face'));

    /* ——— прогресс по курсу ——— */
    const playable = levels.filter((l) => l.playable);
    const share = playable.length > 0 ? done / playable.length : 0;
    courseBar.style.transform = 'scaleX(' + Math.min(1, share) + ')';
    courseText.textContent =
      done + ' из ' + playable.length + ' ' + plural(playable.length, 'уровня', 'уровней', 'уровней');

    const openSections = sections.filter((sec) =>
      sec.levels.some((l) => (st.levels[l.id]?.stars ?? 0) > 0),
    ).length;
    const maxStars = playable.length * 3;
    courseNote.textContent =
      'Разделов начато: ' + openSections + ' из ' + sections.length +
      ' · звёзд ' + stars + ' из ' + maxStars;

    /* ——— лаъл: за что платят и сколько уже взято ——— */
    gemBalance.textContent = String(st.wallet.gems);
    const sectionsClosed = Object.keys(st.achievements).filter((k) => k.startsWith('section:')).length;
    const milestone = nextStreakMilestone(st.streak.best);
    gemRows.replaceChildren(
      gemRow('book', 'Слово освоено до конца', '+' + GEM_MASTERED,
        'освоено ' + st.stats.mastered + ' · это месяцы повторений'),
      gemRow('target', 'Уровень без единой ошибки', '+' + GEM_PERFECT,
        'таких уровней ' + st.stats.perfect),
      gemRow('map', 'Раздел пройден', '+' + GEM_SECTION + ' / +' + GEM_SECTION_FULL,
        'закрыто ' + sectionsClosed + ' из ' + sections.length + ' · второе — за все звёзды'),
      gemRow('flame', 'Веха серии', milestone ? '+' + milestone.gems : '—',
        milestone ? 'следующая — ' + milestone.days + ' ' + plural(milestone.days, 'день', 'дня', 'дней') : 'все вехи взяты'),
    );

    grid.replaceChildren(
      statCard('flame', String(streak), plural(streak, 'день', 'дня', 'дней'), 'orange'),
      statCard('star', String(stars), 'звёзд', 'gold'),
      statCard('map', String(done), plural(done, 'уровень', 'уровня', 'уровней'), 'green'),
      statCard('book', String(known), plural(known, 'слово', 'слова', 'слов'), 'blue'),
      statCard('target', accuracy + '%', 'точность', 'pink'),
      statCard('coin', String(st.wallet.coins), 'монет', 'purple'),
    );
  }

  /* ——— замечания к урокам ——— */

  const reportsNote = h('p', { class: 'reports__note' });
  const reportsList = h('div', { class: 'reports__list' });
  const reportsActions = h('div', { class: 'reports__actions' });

  /** Буфер обмена есть не везде: тогда показываем текст, чтобы скопировать руками. */
  function showDump(text: string): void {
    const area = h('textarea', { class: 'reports__dump', attr: { readonly: 'readonly' } });
    area.value = text;
    modal({
      title: 'Замечания для Claude',
      text: 'Выделите текст целиком, скопируйте и вставьте в чат.',
      body: area,
      closeButton: true,
      actions: [{ label: 'Готово', tone: 'white' }],
    });
    setTimeout(() => area.select(), 50);
  }

  function copyReports(): void {
    const text = formatReports(getState().reports, now());
    const n = getState().reports.length;
    if (!navigator.clipboard?.writeText) {
      showDump(text);
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => toast({ text: 'Скопировано: ' + n + ' — вставьте в чат с Claude', tone: 'good', ms: 3200 }),
      () => showDump(text),
    );
  }

  function shareReports(): void {
    const text = formatReports(getState().reports, now());
    navigator.share({ title: 'Замечания к курсу «Тоҷикӣ»', text }).catch((err: unknown) => {
      // отменённое «Поделиться» — не ошибка
      if (err instanceof DOMException && err.name === 'AbortError') return;
      showDump(text);
    });
  }

  function renderReports(): void {
    const reports = getState().reports;
    const n = reports.length;
    reportsNote.textContent =
      n === 0
        ? 'Пока нет. Нашли в уроке слово, которое так не говорят или произносят иначе, — нажмите флажок вверху урока.'
        : n + ' ' + plural(n, 'замечание', 'замечания', 'замечаний') +
          '. Скопируйте и вставьте в чат с Claude — он сверит их с курсом и поправит уроки.';

    // свежие сверху
    reportsList.replaceChildren(
      ...[...reports].reverse().map((r) => {
        const del = h(
          'button',
          { class: 'report-row__del', attr: { type: 'button' }, aria: { label: 'Удалить замечание' } },
          icon('close'),
        );
        onTap(del, () => update((s) => void removeReport(s, r.at)));
        return h(
          'div',
          { class: 'report-row' },
          h(
            'div',
            { class: 'report-row__text' },
            h('span', { class: 'report-row__what', text: r.ru ? r.tg + ' — ' + r.ru : r.tg }),
            h('span', {
              class: 'report-row__why',
              text: REASON_LABELS[r.reason] + (r.note ? ': «' + r.note + '»' : '') + ' · ' + r.where,
            }),
          ),
          del,
        );
      }),
    );

    reportsActions.replaceChildren();
    if (n === 0) return;
    reportsActions.append(
      button({ label: 'Скопировать для Claude', icon: 'flag', tone: 'orange', wide: true, onTap: copyReports }),
    );
    if (typeof navigator.share === 'function') {
      reportsActions.append(button({ label: 'Поделиться', tone: 'white', wide: true, onTap: shareReports }));
    }
    reportsActions.append(
      button({
        label: 'Удалить все',
        tone: 'white',
        wide: true,
        onTap: () => {
          void confirmModal('Удалить все замечания?', 'Если вы их ещё не отправили, они пропадут.', 'Удалить').then(
            (ok) => {
              if (ok) update((s) => void clearReports(s));
            },
          );
        },
      }),
    );
  }

  function renderInstall(): void {
    installSlot.replaceChildren();
    if (isStandalone() || !canInstall()) return;
    installSlot.append(
      button({
        label: 'Установить на телефон',
        sub: 'Ярлык на главном экране, работает офлайн',
        icon: 'install',
        tone: 'green',
        wide: true,
        onTap: () => {
          void promptInstall().then((res) => {
            if (res === 'accepted') {
              toast({ text: 'Готово, ярлык на главном экране', tone: 'good' });
              renderInstall();
            }
          });
        },
      }),
    );
  }

  const settingsBtn = h(
    'button',
    { class: 'topbar__btn', attr: { type: 'button' }, aria: { label: 'Настройки' } },
    icon('settings'),
  );
  onTap(settingsBtn, () => push(createSettingsScreen, 'settings'));

  const el = h(
    'div',
    { class: 'screen screen--profile' },
    h(
      'header',
      { class: 'topbar' },
      h('div', { class: 'topbar__spacer' }),
      h('div', { class: 'topbar__title', text: 'Профиль' }),
      settingsBtn,
    ),
    h(
      'div',
      { class: 'screen-body' },
      h(
        'div',
        { class: 'profile__head' },
        avatar,
        h('div', { class: 'h2', text: 'Салом!' }),
        petLine,
      ),
      h(
        'section',
        { class: 'panel' },
        h('div', { class: 'panel__title', text: 'Курс' }),
        h('div', { class: 'course-bar' }, courseBar),
        courseText,
        courseNote,
      ),
      h(
        'section',
        { class: 'panel gem-panel' },
        h(
          'div',
          { class: 'gem-panel__head' },
          h('div', { class: 'panel__title', text: 'Лаъл' }),
          h('div', { class: 'gem-panel__balance' }, icon('gem'), gemBalance),
        ),
        h('p', {
          class: 'p gem-panel__note',
          text:
            'Лаъл — по-таджикски рубин: его добывают на Памире, в горе Кӯҳи Лаъл. ' +
            'Монеты даются за каждый ответ, лаъл — только за то, что сделано всерьёз, ' +
            'и каждый раз один раз.',
        }),
        gemRows,
      ),
      h('section', { class: 'panel' }, h('div', { class: 'panel__title', text: 'Статистика' }), grid),
      h(
        'section',
        { class: 'panel' },
        h('div', { class: 'panel__title', text: 'Замечания к урокам' }),
        reportsNote,
        reportsList,
        reportsActions,
      ),
      h('div', { class: 'profile__actions' }, installSlot),
    ),
  );

  const unsub = subscribe(() => {
    renderStats();
    renderReports();
  });
  const unsubInstall = onInstallAvailability(renderInstall);
  renderStats();
  renderReports();
  renderInstall();

  return {
    el,
    onShow: () => {
      renderStats();
      renderReports();
      renderInstall();
    },
    destroy: () => {
      unsub();
      unsubInstall();
    },
  };
}
