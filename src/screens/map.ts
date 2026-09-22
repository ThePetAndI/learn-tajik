/**
 * Карта уровней: луг, песочная дорожка, узлы уровней, питомец над текущим.
 * Геометрия считается в domain/map-layout, здесь только отрисовка и реакция на тапы.
 */

import { clear, h, onTap, s } from '../core/dom';
import { haptics } from '../core/haptics';
import type { ScreenView } from '../core/router';
import { getState, subscribe } from '../core/store';
import { levels, sections, type FlatLevel } from '../data/content';
import {
  BOSS_SIZE,
  NODE_SIZE,
  layoutSection,
  nodeX,
  type MapNode,
  type SectionLayout,
} from '../domain/map-layout';
import { currentIndex, getLevelProgress, sectionSummary, statusOf, type LevelStatus } from '../domain/progress';
import { dueWordsFrom, introducedCount } from '../domain/srs';
import { openReviewSession } from './review';
import { MAX_STARS } from '../domain/stars';
import { button } from '../ui/button';
import { decorLayer } from '../ui/decor';
import { icon, type IconName } from '../ui/icons';
import { toast } from '../ui/toast';
import { breedOf, createPet, type PetHandle } from '../ui/pet';
import { now } from '../core/time';
import { canOpenChest, canSpinWheel } from '../domain/daily';
import { activeThemeId } from '../domain/shop';
import { visibleStreak } from '../domain/streak';
import { openChestModal, openWheelModal } from './rewards';
import { openLevelCard } from './level-card';

const BANNER_HEIGHT = 78;
/** Запас снизу, чтобы последний узел не прятался под кнопкой. */
const TAIL_SPACE = 150;

interface NodeRefs {
  root: HTMLElement;
  disc: HTMLElement;
  stars: HTMLElement;
  level: FlatLevel;
  node: MapNode;
}

export function createMapScreen(): ScreenView {
  const inner = h('div', { class: 'map__inner' });
  const scroll = h('div', { class: 'screen-body map__scroll' }, inner);

  const ctaLabel = h('span', { class: 'btn__label', text: 'Уровень 1' });
  const ctaSub = h('span', { class: 'btn__sub', text: '' });
  const cta = button({ tone: 'orange', size: 'big', wide: true, onTap: onCtaTap });
  cta.replaceChildren(h('span', { class: 'btn__text' }, ctaLabel, ctaSub));
  const ctaBar = h('div', { class: 'map__cta' }, cta);

  /* —————————————————— дневные награды сбоку —————————————————— */

  const chestBtn = h(
    'button',
    { class: 'map-daily__btn', attr: { type: 'button' }, aria: { label: 'Дневной сундук' } },
    icon('chest'),
    h('span', { class: 'map-daily__dot' }),
  );
  onTap(chestBtn, () => {
    haptics.tap();
    openChestModal();
  });

  const wheelBtn = h(
    'button',
    { class: 'map-daily__btn', attr: { type: 'button' }, aria: { label: 'Колесо удачи' } },
    icon('wheel'),
    h('span', { class: 'map-daily__dot' }),
  );
  onTap(wheelBtn, () => {
    haptics.tap();
    openWheelModal();
  });

  const streakChip = h('div', { class: 'map-daily__streak' }, icon('flame'), h('span', { text: '0' }));

  const dailyBar = h('div', { class: 'map-daily' }, streakChip, chestBtn, wheelBtn);

  const el = h('div', { class: 'screen screen--map' }, scroll, dailyBar, ctaBar);

  const nodeRefs = new Map<string, NodeRefs>();
  const bannerRefs = new Map<string, { root: HTMLElement; stars: HTMLElement }>();
  const reviewRefs = new Map<string, { root: HTMLElement; badge: HTMLElement }>();
  /** Слова каждого раздела — по ним собирается повторение. */
  const sectionWords = new Map<string, string[]>();
  for (const level of levels) {
    const list = sectionWords.get(level.sectionId) ?? [];
    for (const id of level.wordIds) if (!list.includes(id)) list.push(id);
    sectionWords.set(level.sectionId, list);
  }
  let pet: PetHandle | null = null;
  let builtWidth = 0;
  let currentLevel: FlatLevel | null = null;
  let currentVisible = true;

  /* —————————————————————— построение карты —————————————————————— */

  function build(width: number): void {
    builtWidth = width;
    nodeRefs.clear();
    bannerRefs.clear();
    reviewRefs.clear();
    pet = null;
    clear(inner);

    if (levels.length === 0) {
      inner.append(
        h(
          'div',
          { class: 'empty-state' },
          h('div', { class: 'empty-state__icon' }, icon('map')),
          h('h2', { class: 'h2', text: 'Карта пуста' }),
          h('p', { class: 'p', text: 'В content/course.json нет разделов.' }),
        ),
      );
      return;
    }

    inner.append(h('div', { class: 'map__sky' }));

    let startIndex = 0;
    sections.forEach((section, si) => {
      const count = section.levels.length;
      const prevX = startIndex > 0 ? nodeX(startIndex - 1, width) : null;
      const nextX = startIndex + count < levels.length ? nodeX(startIndex + count, width) : null;
      const layout = layoutSection({
        width,
        startIndex,
        count,
        bannerHeight: BANNER_HEIGHT,
        prevX,
        nextX,
        seed: si * 7919 + 13,
        reviewNode: true,
      });
      inner.append(buildSection(section.id, si, layout, width));
      startIndex += count;
    });

    inner.append(h('div', { class: 'map__tail', style: { height: TAIL_SPACE + 'px' } }));
    refreshStates();
  }

  function buildSection(
    sectionId: string,
    sectionIdx: number,
    layout: SectionLayout,
    width: number,
  ): HTMLElement {
    const section = sections[sectionIdx];
    const box = h('section', {
      class: 'map-section',
      data: { section: sectionId },
      style: {
        height: layout.height + 'px',
        // длинная карта: браузер не отрисовывает то, что за экраном
        containIntrinsicSize: layout.height + 'px',
      },
    });

    // дорожка и декор одним SVG-слоем
    const art = s('svg', {
      class: 'map-section__art',
      width: String(width),
      height: String(layout.height),
      viewBox: '0 0 ' + width + ' ' + layout.height,
      preserveAspectRatio: 'none',
    });
    art.append(
      s('path', { class: 'map__road-edge', d: layout.path }),
      s('path', { class: 'map__road', d: layout.path }),
      s('path', { class: 'map__road-dash', d: layout.path }),
      decorLayer(layout.decor),
    );
    box.append(art);

    box.append(buildBanner(sectionId, section?.title ?? '', section?.icon ?? 'book', section?.color ?? 'green'));

    for (const node of layout.nodes) {
      const level = levels[node.index];
      if (!level) continue;
      box.append(buildNode(level, node));
    }
    if (layout.review) box.append(buildReviewNode(sectionId, layout.review));
    return box;
  }

  /** Узел повторения: открывается, когда раздел пройден и есть что повторять. */
  function buildReviewNode(sectionId: string, node: MapNode): HTMLElement {
    const badge = h('span', { class: 'map-review__badge' });
    const root = h(
      'button',
      {
        class: 'map-review',
        attr: { type: 'button' },
        data: { review: sectionId },
        style: { left: node.x + 'px', top: node.y + 'px' },
      },
      h('span', { class: 'map-review__disc' }, icon('refresh')),
      badge,
    );
    onTap(root, () => onReviewTap(sectionId));
    reviewRefs.set(sectionId, { root, badge });
    return root;
  }

  function onReviewTap(sectionId: string): void {
    const state = getState();
    const words = sectionWords.get(sectionId) ?? [];
    const known = introducedCount(state, words);
    const summary = sectionSummary(state, levels, sectionId);

    if (summary.done < summary.total) {
      haptics.wrong();
      toast({ text: 'Сначала пройди все уровни раздела', iconName: 'lock' });
      return;
    }
    if (known < 4) {
      haptics.wrong();
      toast({ text: 'Слишком мало знакомых слов для повторения', iconName: 'bulb' });
      return;
    }
    haptics.tap();
    openReviewSession({
      title: summary.title,
      sessionId: 'review:' + sectionId,
      candidates: words,
    });
  }

  function buildBanner(sectionId: string, title: string, iconName: string, color: string): HTMLElement {
    const starsText = h('span', { class: 'map-banner__stars-text', text: '0/15' });
    const banner = h(
      'div',
      { class: 'map-banner t-' + color },
      h('span', { class: 'map-banner__icon' }, icon(iconName as IconName)),
      h(
        'span',
        { class: 'map-banner__text' },
        h('span', { class: 'map-banner__title', text: title }),
        h('span', { class: 'map-banner__sub' }, icon('star'), starsText),
      ),
    );
    bannerRefs.set(sectionId, { root: banner, stars: starsText });
    return banner;
  }

  function buildNode(level: FlatLevel, node: MapNode): HTMLElement {
    const size = level.boss ? BOSS_SIZE : NODE_SIZE;
    const disc = h('span', { class: 'map-node__disc' });
    const stars = h('span', { class: 'map-node__stars' });
    const root = h(
      'button',
      {
        class: 'map-node',
        attr: { type: 'button' },
        data: { level: level.id },
        style: {
          left: node.x + 'px',
          top: node.y + 'px',
          width: size + 'px',
          height: size + 'px',
        },
      },
      disc,
      stars,
    );
    onTap(root, () => onNodeTap(level));
    nodeRefs.set(level.id, { root, disc, stars, level, node });
    return root;
  }

  /* —————————————————————— состояние узлов —————————————————————— */

  function refreshStates(): void {
    const state = getState();
    const curIdx = currentIndex(state, levels);
    currentLevel = levels[curIdx] ?? null;

    for (const refs of nodeRefs.values()) {
      const status = statusOf(state, levels, refs.level.index, curIdx);
      const progress = getLevelProgress(state, refs.level.id);
      applyNodeState(refs, status, progress.stars);
    }

    for (const [sectionId, refs] of bannerRefs) {
      const sum = sectionSummary(state, levels, sectionId);
      refs.stars.textContent = sum.stars + '/' + sum.maxStars;
      refs.root.classList.toggle('is-locked', sum.locked);
    }

    updateReviewNodes(state);
    placePet();
    updateCta();
    updateDaily();
  }

  function updateReviewNodes(state: ReturnType<typeof getState>): void {
    const ts = now();
    for (const [sectionId, refs] of reviewRefs) {
      const words = sectionWords.get(sectionId) ?? [];
      const summary = sectionSummary(state, levels, sectionId);
      const ready = summary.done >= summary.total && introducedCount(state, words) >= 4;
      const due = ready ? dueWordsFrom(state, words, ts).length : 0;

      refs.root.classList.toggle('is-ready', ready);
      refs.root.classList.toggle('is-due', due > 0);
      refs.badge.textContent = due > 0 ? String(due) : '';
      refs.root.setAttribute(
        'aria-label',
        'Повторение раздела «' + summary.title + '»' +
          (ready ? (due > 0 ? ', слов к повторению: ' + due : ', готово') : ', закрыто'),
      );
    }
  }

  function updateDaily(): void {
    const state = getState();
    const ts = now();
    chestBtn.classList.toggle('is-ready', canOpenChest(state, ts));
    wheelBtn.classList.toggle('is-ready', canSpinWheel(state, ts));
    const streak = visibleStreak(state, ts);
    streakChip.classList.toggle('is-on', streak > 0);
    const label = streakChip.querySelector('span');
    if (label) label.textContent = String(streak);
    el.dataset.theme = activeThemeId(state);
  }

  function applyNodeState(refs: NodeRefs, status: LevelStatus, stars: number): void {
    const { root, disc, stars: starsEl, level } = refs;
    root.classList.toggle('is-done', status === 'done');
    root.classList.toggle('is-current', status === 'current');
    root.classList.toggle('is-open', status === 'open');
    root.classList.toggle('is-locked', status === 'locked');
    root.classList.toggle('is-boss', level.boss);
    root.classList.toggle('is-empty', !level.playable);
    root.setAttribute(
      'aria-label',
      'Уровень ' + (level.index + 1) + ': ' + level.title +
        (status === 'locked'
          ? ', закрыт'
          : status === 'done'
            ? ', пройден, звёзд ' + stars
            : status === 'open'
              ? ', заданий пока нет'
              : ', текущий'),
    );

    clear(disc);
    if (level.boss) {
      // сундук виден и закрытым: награда впереди — это мотивация
      disc.append(icon('chest'));
      if (status === 'locked') disc.append(h('span', { class: 'map-node__badge' }, icon('lock')));
    } else if (status === 'locked') {
      disc.append(icon('lock'));
    } else {
      disc.append(h('span', { class: 'map-node__num', text: String(level.index + 1) }));
    }

    clear(starsEl);
    if (status === 'done') {
      for (let i = 0; i < MAX_STARS; i++) {
        starsEl.append(icon(i < stars ? 'star' : 'starEmpty', i < stars ? 'is-on' : 'is-off'));
      }
    }
  }

  function placePet(): void {
    if (!currentLevel) return;
    const refs = nodeRefs.get(currentLevel.id);
    if (!refs) return;
    const breed = breedOf(getState().profile.petId);
    if (!pet) pet = createPet('idle', breed);
    else pet.setBreed(breed);
    const size = currentLevel.boss ? BOSS_SIZE : NODE_SIZE;
    // сбоку от узла, со стороны свободного поля — над узлом он закрывал бы баннер
    const side = refs.node.x < builtWidth / 2 ? 1 : -1;
    const x = Math.min(builtWidth - 40, Math.max(40, refs.node.x + side * (size / 2 + 22)));
    pet.el.style.left = x + 'px';
    pet.el.style.top = refs.node.y - 22 + 'px';
    pet.el.classList.toggle('pet--mirrored', side < 0);
    refs.root.parentElement?.append(pet.el);
  }

  /* —————————————————————— кнопка внизу —————————————————————— */

  function updateCta(): void {
    if (!currentLevel) {
      ctaLabel.textContent = 'Карта пуста';
      ctaSub.textContent = '';
      cta.disabled = true;
      return;
    }
    cta.disabled = false;
    if (!currentVisible) {
      ctaLabel.textContent = 'К уровню ' + (currentLevel.index + 1);
      ctaSub.textContent = 'вернуться';
      return;
    }
    const done = getLevelProgress(getState(), currentLevel.id).stars > 0;
    ctaLabel.textContent = (done ? 'Повторить ' : 'Уровень ') + (currentLevel.index + 1);
    ctaSub.textContent = currentLevel.title;
  }

  function onCtaTap(): void {
    if (!currentLevel) return;
    if (!currentVisible) {
      scrollToCurrent(true);
      return;
    }
    onNodeTap(currentLevel);
  }

  function onNodeTap(level: FlatLevel): void {
    const state = getState();
    const status = statusOf(state, levels, level.index);
    if (status === 'locked') {
      haptics.wrong();
      const refs = nodeRefs.get(level.id);
      refs?.root.classList.remove('is-shake');
      void refs?.root.offsetWidth;
      refs?.root.classList.add('is-shake');
      return;
    }
    haptics.tap();
    openLevelCard(level);
  }

  /* —————————————————————— прокрутка —————————————————————— */

  function currentNodeTop(): number | null {
    if (!currentLevel) return null;
    const refs = nodeRefs.get(currentLevel.id);
    if (!refs) return null;
    const section = refs.root.parentElement;
    if (!section) return null;
    return section.offsetTop + refs.node.y;
  }

  function scrollToCurrent(smooth: boolean): void {
    const top = currentNodeTop();
    if (top === null) return;
    const target = Math.max(0, top - scroll.clientHeight * 0.55);
    scroll.scrollTo({ top: target, behavior: smooth ? 'smooth' : 'auto' });
  }

  function checkCurrentVisible(): void {
    const top = currentNodeTop();
    if (top === null) return;
    const y = top - scroll.scrollTop;
    // ниже HUD и выше кнопки — иначе «виден» узел, наполовину спрятанный под панелью
    const visible = y > 80 && y < scroll.clientHeight - 110;
    if (visible !== currentVisible) {
      currentVisible = visible;
      updateCta();
    }
  }

  /* —————————————————————— жизненный цикл —————————————————————— */

  let scrollTimer: number | null = null;
  const onScroll = (): void => {
    if (scrollTimer !== null) return;
    scrollTimer = window.setTimeout(() => {
      scrollTimer = null;
      checkCurrentVisible();
    }, 120);
  };
  scroll.addEventListener('scroll', onScroll, { passive: true });

  const unsub = subscribe(() => {
    if (builtWidth > 0) refreshStates();
  });

  const resizeObserver =
    typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver((entries) => {
          const width = Math.round(entries[0]?.contentRect.width ?? 0);
          if (width > 0 && Math.abs(width - builtWidth) > 2) {
            build(width);
            scrollToCurrent(false);
          }
        })
      : null;

  return {
    el,
    onShow: () => {
      const width = scroll.clientWidth || el.clientWidth || 360;
      if (builtWidth === 0) {
        build(width);
        // ждём кадр, чтобы высоты успели примениться
        requestAnimationFrame(() => {
          scrollToCurrent(false);
          checkCurrentVisible();
        });
      } else {
        refreshStates();
        checkCurrentVisible();
      }
      resizeObserver?.observe(scroll);
    },
    onHide: () => {
      resizeObserver?.disconnect();
    },
    destroy: () => {
      unsub();
      resizeObserver?.disconnect();
      scroll.removeEventListener('scroll', onScroll);
      if (scrollTimer !== null) clearTimeout(scrollTimer);
    },
  };
}
