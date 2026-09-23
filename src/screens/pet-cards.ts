/**
 * Питомцы: плитки коллекции, карточки, лона, звёзды и обмен копий.
 *
 * Здесь всё, что касается самих зверей; сцену и снаряжение собирает pets.ts.
 * Правила живут в domain/pets.ts и domain/catalog.ts, здесь только показ.
 */

import { h, onTap, sleep, svgFrom } from '../core/dom';
import { haptics } from '../core/haptics';
import { rngFor } from '../core/rng';
import { getState, update } from '../core/store';
import { now, plural } from '../core/time';
import type { SaveState } from '../data/state';
import { perksOf } from '../domain/bonuses';
import {
  MAX_PET_RANK,
  MAX_PET_TIER,
  activePet,
  getItem,
  isOwned,
  nextTier,
  petCopies,
  petRank,
  petTier,
  rankedBonus,
  tierLabel,
  type ShopItem,
} from '../domain/catalog';
import {
  FUSE_COPIES,
  PET_CHESTS,
  PET_PITY,
  canFuse,
  canOpenPetChest,
  canRankUp,
  fuse,
  fusionCost,
  fusionPlan,
  openPetChest,
  petChestOdds,
  petChestPrice,
  petPityLeft,
  petsOfRarity,
  rankUp,
  rankUpCost,
  spareCopies,
  type PetChest,
  type PetDrop,
} from '../domain/pets';
import { perkLabels } from '../domain/perks';
import { RARITY_ORDER, RARITY_TITLE, nextRarity, type Rarity } from '../domain/rarity';
import { buy, canBuy, canUpgradePet, equip, priceOf, upgradePet } from '../domain/shop';
import { button } from '../ui/button';
import { confetti } from '../ui/confetti';
import { icon } from '../ui/icons';
import { modal } from '../ui/modal';
import { breedOf, createPet, eggSvg, petFace, type PetHandle } from '../ui/pet';
import { toast } from '../ui/toast';
import { fmtOdds, oddsChips, poorToast, rarityChip } from './shop-bits';

/* ————————————————————————— мелочи ————————————————————————— */

function rarityOf(item: ShopItem): Rarity {
  return item.rarity ?? 'common';
}

const RARITY_MANY: Record<Rarity, string> = {
  common: 'Обычные',
  rare: 'Редкие',
  epic: 'Эпические',
  legendary: 'Легендарные',
};

/** «три копии обычных питомцев» */
const RARITY_OF_MANY: Record<Rarity, string> = {
  common: 'обычных',
  rare: 'редких',
  epic: 'эпических',
  legendary: 'легендарных',
};

function starWord(n: number): string {
  return plural(n, 'звезда', 'звезды', 'звёзд');
}

function copyWord(n: number): string {
  return plural(n, 'копия', 'копии', 'копий');
}

/** «Кабк или Булбул», «Хирс, Оҳу или Уқоб». */
function orList(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return names.slice(0, -1).join(', ') + ' или ' + names[names.length - 1];
}

/** Звёзды питомца: закрашенные и пустые, всего MAX_PET_RANK. */
export function starRow(rank: number, cls: string): HTMLElement {
  return h(
    'span',
    { class: cls, aria: { label: rank + ' ' + starWord(rank) + ' из ' + MAX_PET_RANK } },
    ...Array.from({ length: MAX_PET_RANK }, (_, i) =>
      icon(i < rank ? 'star' : 'starEmpty', i < rank ? 'is-on' : 'is-off'),
    ),
  );
}

/**
 * Что даёт питомец на ступени tier при звёздах rank — словами и с учётом
 * звёзд. Подписи ступеней из каталога звёзд не знают: у кошки с тремя
 * звёздами «+16% монет» на деле «+23%».
 */
function bonusWords(item: ShopItem, tier: number, rank: number): string {
  const bonus = item.tiers?.[tier - 1]?.bonus ?? {};
  return perkLabels(rankedBonus(bonus, rank)).join(', ');
}

/** Шанс вытянуть именно этого питомца: шанс его редкости, делённый на её питомцев. */
function petOddsIn(chest: PetChest, item: ShopItem, luck: number): number {
  const rarity = rarityOf(item);
  return petChestOdds(chest, luck)[rarity] / Math.max(1, petsOfRarity(rarity).length);
}

/* ————————————————————————— плитка питомца ————————————————————————— */

export interface PetTileOpts {
  /** Тап по питомцу, который уже с вами. */
  onActiveTap?: () => void;
}

export function petTile(item: ShopItem, opts: PetTileOpts = {}): HTMLElement {
  const state = getState();
  const owned = isOwned(state, item.id);
  const active = owned && activePet(state)?.id === item.id;
  const rank = owned ? petRank(state, item.id) : 1;
  const copies = owned ? petCopies(state, item.id) : 0;
  const ready = owned && canRankUp(state, item.id) === 'ok';
  const hidden = !owned && Boolean(item.chestOnly);
  const price = priceOf(state, item.id);

  /*
   * Три вида плитки, и различаться они должны с первого взгляда: свой
   * питомец — цветной, со звёздами; тот, что продаётся, — бледный, с замком
   * и ценником; тот, что бывает только в лоне, — силуэт с яйцом. Раньше
   * купленный и некупленный были одинаковыми плитками, и тап по чужому
   * молча списывал монеты.
   */
  const tile = h(
    'button',
    {
      class:
        'ppet r-' + rarityOf(item) + ' t-' + item.tone +
        (active ? ' is-active' : '') +
        (owned ? '' : hidden ? ' is-hidden' : ' is-locked'),
      attr: { type: 'button' },
      data: { pet: item.id },
      aria: {
        label: owned
          ? item.title + ', ' + rank + ' ' + starWord(rank) + (active ? ', с вами' : '')
          : hidden
            ? item.title + ', выпадает из лоны'
            : item.title + ', купить за ' + price,
      },
    },
    h('span', { class: 'ppet__face' }, petFace(breedOf(item.id), rank)),
    h('span', { class: 'ppet__name', text: item.title }),
    owned
      ? starRow(rank, 'ppet__stars')
      : hidden
        ? h('span', { class: 'ppet__where' }, icon('egg'), h('span', { text: 'из лоны' }))
        : h('span', { class: 'ppet__price' }, icon('coin'), h('span', { text: String(price) })),
    !owned && !hidden ? h('span', { class: 'ppet__lock' }, icon('lock')) : null,
    active ? h('span', { class: 'ppet__on' }, icon('check')) : null,
    // запас копий виден прямо на плитке, а зелёный — когда их хватает на звезду
    copies > 0 ? h('span', { class: 'ppet__copies' + (ready ? ' is-ready' : ''), text: '+' + copies }) : null,
  );

  onTap(tile, () => {
    haptics.tap();
    const st = getState();
    if (!isOwned(st, item.id)) {
      if (item.chestOnly) openPetInfoSheet(item);
      else openPetBuySheet(item);
      return;
    }
    if (activePet(st)?.id === item.id) {
      opts.onActiveTap?.();
      return;
    }
    update((s) => {
      equip(s, item.id, now());
    });
    haptics.reward();
  });
  return tile;
}

/* ————————————————————————— карточки ————————————————————————— */

/** Шапка карточки: питомец в полный рост, имя, редкость, описание. */
function sheetHead(item: ShopItem): HTMLElement {
  const preview = createPet('happy', breedOf(item.id));
  return h(
    'div',
    { class: 'pbuy t-' + item.tone },
    h('div', { class: 'pbuy__pet' }, preview.el),
    h('div', { class: 'pbuy__title', text: item.title }),
    rarityChip(rarityOf(item)),
    h('p', { class: 'pbuy__about', text: item.description }),
    tierPerks(item),
  );
}

/** «Сразу: …» и «На 5-й ступени: …» — от чего стартует питомец и до чего растёт. */
function tierPerks(item: ShopItem): HTMLElement {
  const tiers = item.tiers ?? [];
  const first = tiers[0];
  const last = tiers[tiers.length - 1];
  return h(
    'div',
    { class: 'pbuy__perks' },
    first ? h('div', { class: 'pbuy__perk' }, icon('check'), h('span', { text: 'Сразу: ' + tierLabel(first) })) : null,
    last && last !== first
      ? h(
          'div',
          { class: 'pbuy__perk is-future' },
          icon('up'),
          h('span', { text: 'На ' + tiers.length + '-й ступени: ' + tierLabel(last) }),
        )
      : null,
  );
}

/**
 * Карточка некупленного питомца: как он выглядит, что даёт сразу и до чего
 * прокачивается. Покупка — только отдельной кнопкой с ценой.
 */
function openPetBuySheet(item: ShopItem): void {
  const state = getState();
  const price = priceOf(state, item.id);
  const lack = Math.max(0, price - state.wallet.coins);

  const buyBtn = button({
    label: lack > 0 ? 'Не хватает монет' : 'Купить за ' + price,
    sub: lack > 0 ? 'нужно ещё ' + lack : undefined,
    icon: lack > 0 ? undefined : 'coin',
    tone: lack > 0 ? 'lock' : 'orange',
    size: 'big',
    wide: true,
    disabled: lack > 0,
  });
  const m = modal({ body: h('div', {}, sheetHead(item), buyBtn), closeButton: true, class: 'modal__card--gear' });

  onTap(buyBtn, () => {
    if (canBuy(getState(), item.id) !== 'ok') return;
    update((s) => {
      buy(s, item.id, now());
    });
    haptics.reward();
    m.close('ok');
    toast({ text: item.title + ' теперь с вами', iconName: 'paw', tone: 'gold' });
  });
}

/**
 * Карточка питомца, которого можно только найти: кто он, что даёт и где
 * искать — с шансом именно на него, а не на всю редкость.
 */
function openPetInfoSheet(item: ShopItem): void {
  const state = getState();
  const rarity = rarityOf(item);
  const luck = perksOf(state).petLuck;
  const below = RARITY_ORDER[RARITY_ORDER.indexOf(rarity) - 1];

  const rows = PET_CHESTS.map((chest) => ({ chest, odds: petOddsIn(chest, item, luck) }))
    .filter((r) => r.odds > 0)
    .map((r) =>
      h(
        'div',
        { class: 'pwhere__row' },
        icon('nest'),
        h('span', { class: 'pwhere__name', text: r.chest.title }),
        h('span', { class: 'pwhere__odds', text: fmtOdds(r.odds) }),
      ),
    );
  if (below) {
    rows.push(
      h(
        'div',
        { class: 'pwhere__row' },
        icon('swap'),
        h('span', {
          class: 'pwhere__name',
          text: 'Обмен: ' + FUSE_COPIES + ' копии ' + RARITY_OF_MANY[below] + ' питомцев',
        }),
      ),
    );
  }

  const body = h(
    'div',
    {},
    sheetHead(item),
    h('div', { class: 'pwhere' }, h('div', { class: 'pwhere__title', text: 'Где найти' }), ...rows),
  );
  const m = modal({ body, closeButton: true, class: 'modal__card--gear' });
  body.append(button({ label: 'Понятно', tone: 'white', wide: true, onTap: () => m.close('ok') }));
}

/* ————————————————————————— ступень и звёзды ————————————————————————— */

/**
 * Две оси роста активного питомца. Ступень — тренировка за монеты, звёзды —
 * копии того же питомца, соединённые вместе. У каждой своя кнопка, и рядом
 * написано, что именно даст следующий шаг — с учётом другой оси.
 */
export function petProgress(item: ShopItem, stagePet: PetHandle): HTMLElement[] {
  const state = getState();
  const tier = petTier(state, item.id);
  const rank = petRank(state, item.id);
  const next = nextTier(state, item.id);
  const nextWords = next ? bonusWords(item, tier + 1, rank) : '';

  const tierRow = h(
    'div',
    { class: 'ptier' },
    h(
      'div',
      { class: 'ptier__info' },
      h(
        'div',
        { class: 'ptier__head' },
        h('span', { class: 'ptier__title', text: 'Ступень ' + tier + ' из ' + MAX_PET_TIER }),
        h(
          'span',
          { class: 'pet-tier__pips' },
          ...Array.from({ length: MAX_PET_TIER }, (_, i) => h('span', { class: 'pet-tier__pip' + (i < tier ? ' is-on' : '') })),
        ),
      ),
      h('span', { class: 'ptier__label', text: next ? 'дальше: ' + nextWords : 'ступень максимальная' }),
    ),
    next
      ? button({
          label: String(next.price),
          icon: 'coin',
          tone: 'purple',
          size: 'sm',
          onTap: () => {
            const check = canUpgradePet(getState(), item.id);
            if (check === 'not-enough-coins') return poorToast('coins');
            if (check !== 'ok') return;
            update((s) => {
              upgradePet(s, item.id, now());
            });
            haptics.levelUp();
            stagePet.cheer();
            toast({ text: item.title + ': ' + nextWords, iconName: 'up', tone: 'gold' });
          },
        })
      : null,
  );

  const cost = rankUpCost(state, item.id);
  const copies = petCopies(state, item.id);
  const rankWords = cost ? bonusWords(item, tier, rank + 1) : '';
  const rankLabel = !cost
    ? 'звёзд максимум — копии пригодятся для обмена'
    : (copies >= cost.copies ? 'копий хватает' : 'копий ' + copies + ' из ' + cost.copies) +
      (rankWords ? ' · дальше: ' + rankWords : ' · звёзды усилят бонус ступени');
  const check = canRankUp(state, item.id);

  const rankRow = h(
    'div',
    { class: 'ptier ptier--rank' },
    h(
      'div',
      { class: 'ptier__info' },
      h(
        'div',
        { class: 'ptier__head' },
        h('span', { class: 'ptier__title', text: 'Звёзды ' + rank + ' из ' + MAX_PET_RANK }),
        starRow(rank, 'ptier__stars'),
      ),
      h('span', { class: 'ptier__label', text: rankLabel }),
    ),
    cost
      ? button({
          label: 'Соединить',
          sub: cost.coins + ' ' + plural(cost.coins, 'монета', 'монеты', 'монет'),
          tone: check === 'ok' ? 'gold' : 'lock',
          size: 'sm',
          class: 'ptier__merge',
          onTap: () => {
            const c = canRankUp(getState(), item.id);
            if (c === 'not-enough-copies') {
              haptics.wrong();
              const need = cost.copies - petCopies(getState(), item.id);
              toast({
                text: 'Нужна ещё ' + need + ' ' + copyWord(need) + ' — они выпадают из лоны',
                iconName: 'egg',
                tone: 'bad',
              });
              return;
            }
            if (c === 'not-enough-coins') return poorToast('coins');
            if (c !== 'ok') return;
            update((s) => {
              rankUp(s, item.id, now());
            });
            haptics.levelUp();
            stagePet.cheer();
            const r = stagePet.el.getBoundingClientRect();
            confetti({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
            const got = petRank(getState(), item.id);
            toast({ text: item.title + ': ' + got + ' ' + starWord(got), iconName: 'star', tone: 'gold' });
          },
        })
      : null,
  );

  return [tierRow, rankRow];
}

/* ————————————————————————— лона ————————————————————————— */

export function nestCard(chest: PetChest): HTMLElement & { refresh: () => void } {
  const oddsLine = h('div', { class: 'gchest__odds' });
  // подпись с ценой — сразу: с пустой подписью кнопка вышла бы круглой, без места под цену
  const start = petChestPrice(getState(), chest);
  const priceBtn = button({
    tone: chest.gems > 0 ? 'ruby' : 'orange',
    size: 'sm',
    label: String(chest.gems > 0 ? start.gems : start.coins),
    icon: chest.gems > 0 ? 'gem' : 'coin',
  });
  onTap(priceBtn, () => {
    const check = canOpenPetChest(getState(), chest.id);
    if (check === 'not-enough-coins') return poorToast('coins');
    if (check === 'not-enough-gems') return poorToast('gems');
    if (check !== 'ok') return;
    let drop: PetDrop | null = null;
    update((st) => {
      drop = openPetChest(st, chest.id, rngFor('pet:' + chest.id + ':' + now()), now());
    });
    if (drop) showPetDrop(drop, chest.title);
  });

  const el = h(
    'div',
    { class: 'gchest t-' + chest.tone, data: { chest: chest.id } },
    h(
      'div',
      { class: 'gchest__main' },
      h('span', { class: 'gchest__icon' }, icon('nest')),
      h(
        'div',
        { class: 'gchest__text' },
        h(
          'div',
          { class: 'gchest__title' },
          h('span', { text: chest.title }),
          h('span', { class: 'gchest__ru', text: chest.ru }),
        ),
        h('div', { class: 'gchest__about', text: chest.about }),
      ),
      priceBtn,
    ),
    oddsLine,
  );

  return Object.assign(el, {
    refresh(): void {
      const state = getState();
      oddsLine.replaceChildren(...oddsChips(petChestOdds(chest, perksOf(state).petLuck)));
      const price = petChestPrice(state, chest);
      const label = priceBtn.querySelector('.btn__label');
      if (label) label.textContent = String(price.gems > 0 ? price.gems : price.coins);
    },
  });
}

export function nestNote(state: SaveState): string {
  const left = petPityLeft(state);
  return (
    'Шансы — ровно те, по которым идёт бросок; удачу лоны поднимают орёл Уқоб и дерево. ' +
    'Каждый ' + PET_PITY + '-й питомец без эпического — точно эпический или лучше' +
    (left < PET_PITY ? ': до него осталось ' + left + '.' : '.')
  );
}

/* ————————————————————————— обмен копий ————————————————————————— */

/**
 * Строки обмена: по одной на редкость, которую есть во что обменять.
 * Кнопка серая, пока копий или монет не хватает, но тап по ней объясняет,
 * чего именно не хватает, — а не молчит.
 */
export function swapRows(): HTMLElement[] {
  const state = getState();
  return RARITY_ORDER.filter((r) => nextRarity(r) !== null).map((rarity) => {
    const have = spareCopies(state, rarity);
    const target = nextRarity(rarity) as Rarity;
    const check = canFuse(state, rarity);
    return h(
      'div',
      { class: 'pswap r-' + rarity },
      h('span', { class: 'pswap__dot' }),
      h(
        'div',
        { class: 'pswap__text' },
        h('div', { class: 'pswap__title', text: RARITY_MANY[rarity] + ': ' + have + ' ' + copyWord(have) }),
        h('div', {
          class: 'pswap__sub',
          text: FUSE_COPIES + ' копии → ' + RARITY_TITLE[target].toLowerCase() + ' питомец',
        }),
      ),
      button({
        label: String(fusionCost(state, rarity)),
        icon: 'coin',
        tone: check === 'ok' ? 'purple' : 'lock',
        size: 'sm',
        onTap: () => {
          const c = canFuse(getState(), rarity);
          if (c === 'not-enough-copies') {
            haptics.wrong();
            toast({
              text: 'Нужно ' + FUSE_COPIES + ' копии, а есть ' + spareCopies(getState(), rarity),
              iconName: 'swap',
              tone: 'bad',
            });
            return;
          }
          if (c === 'not-enough-coins') return poorToast('coins');
          if (c !== 'ok') return;
          openSwapSheet(rarity);
        },
      }),
    );
  });
}

/** Подтверждение обмена: какие копии уйдут и кто может прийти взамен. */
function openSwapSheet(rarity: Rarity): void {
  const state = getState();
  const target = nextRarity(rarity);
  if (!target) return;
  const plan = fusionPlan(state, rarity);
  const cost = fusionCost(state, rarity);
  const pool = petsOfRarity(target);
  const titleOf = (id: string): string => getItem(id)?.title ?? id;

  const give = plan.map(({ id, n }) =>
    h(
      'span',
      { class: 'pswapsheet__give' },
      petFace(breedOf(id), petRank(state, id)),
      h('span', { class: 'pswapsheet__n', text: '×' + n }),
    ),
  );

  const confirm = button({
    label: 'Обменять за ' + cost,
    icon: 'coin',
    tone: 'purple',
    size: 'big',
    wide: true,
  });
  const body = h(
    'div',
    { class: 'pswapsheet' },
    h(
      'div',
      { class: 'pswapsheet__row' },
      ...give,
      h('span', { class: 'pswapsheet__arrow' }, icon('chevronRight')),
      h('span', { class: 'pswapsheet__get r-' + target }, svgFrom(eggSvg())),
    ),
    h('p', {
      class: 'pswapsheet__text',
      text:
        'Уйдут копии: ' + plan.map(({ id, n }) => titleOf(id) + ' ×' + n).join(', ') + '. ' +
        'Взамен — ' + RARITY_TITLE[target].toLowerCase() + ' питомец: ' +
        orList(pool.map((p) => p.title)) + '. Если такой уже есть, придёт его копия.',
    }),
    confirm,
  );
  const m = modal({ title: 'Обмен копий', body, closeButton: true, class: 'modal__card--gear' });

  onTap(confirm, () => {
    if (canFuse(getState(), rarity) !== 'ok') return;
    let drop: PetDrop | null = null;
    update((s) => {
      drop = fuse(s, rarity, rngFor('fuse:' + rarity + ':' + now()), now());
    });
    m.close('ok');
    if (drop) showPetDrop(drop, 'Обмен копий');
  });
}

/* ————————————————————————— кто вылупился ————————————————————————— */

function dropNote(drop: PetDrop): string {
  if (drop.isNew) return 'Новый питомец!';
  return drop.copies > 1 ? '+' + drop.copies + ' ' + copyWord(drop.copies) + ' — двойня!' : '+1 копия';
}

/** Что делать с копией: сколько ещё до звезды, или что копий уже хватает. */
function copiesHint(state: SaveState, pet: ShopItem): string {
  const cost = rankUpCost(state, pet.id);
  const copies = petCopies(state, pet.id);
  if (!cost) return 'Звёзд уже пять — копии пригодятся для обмена.';
  if (copies >= cost.copies) {
    return activePet(state)?.id === pet.id
      ? 'Копий хватает на звезду — нажмите «Соединить» под питомцами.'
      : 'Копий хватает на звезду: выберите питомца и нажмите «Соединить».';
  }
  return 'До новой звезды: копий ' + copies + ' из ' + cost.copies + '.';
}

/**
 * Яйцо качается, трескается, вспыхивает цветом редкости — и выходит питомец.
 * Секунда ожидания и есть весь азарт; со спокойными анимациями её нет.
 */
export function showPetDrop(drop: PetDrop, title: string): void {
  const rarity = rarityOf(drop.pet);
  const egg = h('div', { class: 'pdrop__egg' }, svgFrom(eggSvg()));
  const stage = h('div', { class: 'pdrop__stage' }, egg);
  const info = h('div', { class: 'pdrop__info' });
  const actions = h('div', { class: 'pdrop__actions' });
  const m = modal({
    title,
    body: h('div', { class: 'pdrop' }, stage, info, actions),
    class: 'modal__card--gear',
  });
  const calm = document.documentElement.classList.contains('reduced-motion');

  void (async () => {
    if (!calm) {
      egg.classList.add('is-wobble');
      haptics.tap();
      await sleep(950);
      egg.classList.add('is-crack', 'r-' + rarity);
      haptics.tap();
      await sleep(380);
    }
    const state = getState();
    const pet = createPet('happy', breedOf(drop.pet.id), {}, petRank(state, drop.pet.id));
    stage.replaceChildren(h('div', { class: 'pdrop__pet r-' + rarity }, pet.el));

    const lines: HTMLElement[] = [
      rarityChip(rarity),
      h('div', { class: 'pdrop__title', text: drop.pet.title }),
      h('div', { class: 'pdrop__note' + (drop.isNew ? ' is-new' : ''), text: dropNote(drop) }),
    ];
    if (!drop.isNew) lines.push(h('div', { class: 'pdrop__hint', text: copiesHint(state, drop.pet) }));
    info.replaceChildren(...lines);

    if (drop.isNew || rarity === 'epic' || rarity === 'legendary') {
      haptics.levelUp();
      const r = stage.getBoundingClientRect();
      confetti({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    } else {
      haptics.reward();
    }

    const takeAlong = drop.isNew && activePet(state)?.id !== drop.pet.id;
    const btns: HTMLElement[] = [];
    if (takeAlong) {
      btns.push(
        button({
          label: 'Взять с собой',
          tone: 'green',
          size: 'big',
          wide: true,
          onTap: () => {
            update((s) => {
              equip(s, drop.pet.id, now());
            });
            m.close('ok');
          },
        }),
      );
    }
    btns.push(
      button({
        label: takeAlong ? 'Потом' : 'Отлично',
        tone: takeAlong ? 'white' : 'green',
        size: takeAlong ? undefined : 'big',
        wide: true,
        onTap: () => m.close('ok'),
      }),
    );
    actions.replaceChildren(...btns);
  })();
}
