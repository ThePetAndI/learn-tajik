/**
 * Снаряжение питомца: карточка вещи, выбор вещи для слота, инвентарь
 * и сундуки снаряжения. Сцену с питомцем собирает pets.ts.
 */

import { h, onTap, sleep, svgFrom } from '../core/dom';
import { haptics } from '../core/haptics';
import { rngFor } from '../core/rng';
import { getState, update } from '../core/store';
import { now, plural } from '../core/time';
import type { SaveState } from '../data/state';
import { perksOf } from '../domain/bonuses';
import { activePet } from '../domain/catalog';
import {
  canOpenGearChest,
  canUpgradeGear,
  equipGear,
  gearChestPrice,
  openGearChest,
  unequipGear,
  upgradeCost,
  upgradeGear,
  type GearDrop,
} from '../domain/gear';
import {
  GEAR,
  PITY_EVERY,
  RARITIES,
  RARITY_ORDER,
  SLOTS,
  chestOdds,
  gearLevel,
  gearValue,
  pityLeft,
  wornBy,
  type GearChest,
  type GearItem,
  type GearSlot,
} from '../domain/gear-items';
import { perkLabel } from '../domain/perks';
import { button } from '../ui/button';
import { confetti } from '../ui/confetti';
import { gearThumb } from '../ui/gear-art';
import { icon } from '../ui/icons';
import { modal } from '../ui/modal';
import { toast } from '../ui/toast';
import { oddsChips, poorToast, rarityChip } from './shop-bits';

/* ————————————————————————— мелочи ————————————————————————— */

export function thumb(item: GearItem, extra = ''): HTMLElement {
  return h('span', { class: 'gthumb r-' + item.rarity + (extra ? ' ' + extra : '') }, svgFrom(gearThumb(item.id, item.slot)));
}

function levelPips(item: GearItem, level: number): HTMLElement {
  const max = RARITIES[item.rarity].maxLevel;
  return h(
    'span',
    { class: 'gpips' },
    ...Array.from({ length: max }, (_, i) => h('span', { class: 'gpip' + (i < level ? ' is-on' : '') })),
  );
}

function bonusText(item: GearItem, level: number): string {
  return perkLabel(item.axis, gearValue(item, level));
}

/* ————————————————————————— карточка вещи ————————————————————————— */

export function openGearSheet(item: GearItem): void {
  const body = h('div', { class: 'gsheet' });
  const m = modal({ body, closeButton: true, class: 'modal__card--gear' });

  function render(): void {
    const state = getState();
    const pet = activePet(state);
    const level = gearLevel(state, item.id);
    const max = RARITIES[item.rarity].maxLevel;
    const worn = pet ? wornBy(state, pet.id)[item.slot] === item.id : false;
    const cost = level < max ? upgradeCost(item, level) : null;
    const check = canUpgradeGear(state, item.id);
    const slot = SLOTS.find((sl) => sl.id === item.slot);

    const upgrade = cost
      ? button({
          label: 'Улучшить',
          sub:
            cost.coins + ' ' + plural(cost.coins, 'монета', 'монеты', 'монет') + ' · ' +
            cost.shards + ' ' + plural(cost.shards, 'осколок', 'осколка', 'осколков'),
          tone: check === 'ok' ? 'purple' : 'lock',
          wide: true,
          onTap: () => {
            const c = canUpgradeGear(getState(), item.id);
            if (c === 'not-enough-coins') return poorToast('coins');
            if (c === 'not-enough-shards') return poorToast('shards');
            if (c !== 'ok') return;
            update((st) => {
              upgradeGear(st, item.id, now());
            });
            haptics.levelUp();
            toast({
              text: item.title + ': уровень ' + gearLevel(getState(), item.id),
              iconName: 'up',
              tone: 'gold',
            });
            render();
          },
        })
      : h('div', { class: 'gsheet__max', text: 'Максимальный уровень' });

    const wear = pet
      ? button({
          label: worn ? 'Снять' : 'Надеть на ' + pet.title,
          tone: worn ? 'white' : 'green',
          wide: true,
          onTap: () => {
            update((st) => {
              if (worn) unequipGear(st, pet.id, item.slot, now());
              else equipGear(st, pet.id, item.id, now());
            });
            haptics.reward();
            m.close('ok');
          },
        })
      : null;

    body.replaceChildren(
      h(
        'div',
        { class: 'gsheet__head' },
        thumb(item, 'gthumb--big'),
        h(
          'div',
          { class: 'gsheet__names' },
          h('div', { class: 'gsheet__title', text: item.title }),
          item.tg ? h('div', { class: 'gsheet__tg', text: item.tg }) : null,
          h(
            'div',
            { class: 'gsheet__meta' },
            rarityChip(item.rarity),
            h('span', { text: slot ? slot.title : '' }),
          ),
        ),
      ),
      h('p', { class: 'gsheet__about', text: item.about }),
      h(
        'div',
        { class: 'gsheet__level' },
        h('span', { class: 'gsheet__level-label', text: 'Уровень ' + level + ' из ' + max }),
        levelPips(item, level),
      ),
      h(
        'div',
        { class: 'gsheet__bonus' },
        icon('up'),
        h('span', { text: bonusText(item, level) }),
        cost ? h('span', { class: 'gsheet__next', text: '→ ' + bonusText(item, level + 1) }) : null,
      ),
      h(
        'div',
        { class: 'gsheet__actions' },
        upgrade,
        wear,
      ),
    );
  }
  render();
}

/* ————————————————————————— слот на сцене ————————————————————————— */

export function openSlotSheet(slot: GearSlot): void {
  const state = getState();
  const pet = activePet(state);
  if (!pet) return;
  const info = SLOTS.find((sl) => sl.id === slot)!;
  const current = wornBy(state, pet.id)[slot];
  const owned = GEAR.filter((g) => g.slot === slot && gearLevel(state, g.id) > 0).sort(
    (a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity),
  );

  const list = h('div', { class: 'gpick' });
  const m = modal({ title: info.title, body: list, closeButton: true, class: 'modal__card--gear' });

  if (owned.length === 0) {
    list.append(
      h('p', {
        class: 'p gpick__empty',
        text: 'Для этого слота пока ничего нет. Вещи находятся в сундуках снаряжения — ниже на этой странице.',
      }),
    );
    return;
  }

  for (const item of owned) {
    const level = gearLevel(state, item.id);
    const row = h(
      'button',
      { class: 'gpick__row' + (item.id === current ? ' is-worn' : ''), attr: { type: 'button' } },
      thumb(item),
      h(
        'span',
        { class: 'gpick__text' },
        h('span', { class: 'gpick__title', text: item.title }),
        h('span', { class: 'gpick__bonus', text: bonusText(item, level) + ' · ур. ' + level }),
      ),
      item.id === current ? h('span', { class: 'gpick__worn' }, icon('check')) : rarityChip(item.rarity),
    );
    onTap(row, () => {
      update((st) => {
        if (item.id === current) unequipGear(st, pet.id, slot, now());
        else equipGear(st, pet.id, item.id, now());
      });
      haptics.reward();
      m.close('ok');
    });
    list.append(row);
  }
}

/* ————————————————————————— инвентарь ————————————————————————— */

/** Собранные вещи: сначала редкие, внутри редкости — по слотам. */
export function gearCards(state: SaveState, wornIds: Set<string | undefined>): HTMLElement[] {
  const owned = GEAR.filter((g) => gearLevel(state, g.id) > 0).sort(
    (a, b) =>
      RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity) ||
      SLOTS.findIndex((sl) => sl.id === a.slot) - SLOTS.findIndex((sl) => sl.id === b.slot),
  );
  const cards: HTMLElement[] =
    owned.length === 0
      ? [h('p', { class: 'p gnote ggrid__empty', text: 'Пока пусто. Первая вещь — в сундуке странника.' })]
      : owned.map((item) => {
          const level = gearLevel(state, item.id);
          const canUp = canUpgradeGear(state, item.id) === 'ok';
          const card = h(
            'button',
            { class: 'gcard r-' + item.rarity + (wornIds.has(item.id) ? ' is-worn' : ''), attr: { type: 'button' } },
            thumb(item),
            h('span', { class: 'gcard__title', text: item.title }),
            h('span', { class: 'gcard__level', text: 'ур. ' + level }),
            wornIds.has(item.id) ? h('span', { class: 'gcard__badge' }, icon('check')) : null,
            canUp ? h('span', { class: 'gcard__up' }, icon('up')) : null,
          );
          onTap(card, () => {
            haptics.tap();
            openGearSheet(item);
          });
          return card;
        });
  cards.push(h('div', { class: 'ggrid__count', text: 'Собрано ' + owned.length + ' из ' + GEAR.length }));
  return cards;
}

/* ————————————————————————— сундук снаряжения ————————————————————————— */

/** Вещи из сундука — по одной. title — чем их достали: сундук, товар дня, награда. */
export function showDrops(title: string, drops: GearDrop[]): void {
  const box = h('div', { class: 'gdrops' });
  const done = button({ label: 'Забрать', tone: 'green', size: 'big', wide: true });
  done.classList.add('hidden');
  const m = modal({ title, body: h('div', {}, box, done), class: 'modal__card--gear' });
  onTap(done, () => m.close('ok'));

  // вещи появляются по одной: так видно каждую, а не сразу кучу
  void (async () => {
    for (const drop of drops) {
      const card = h(
        'div',
        { class: 'gdrop r-' + drop.item.rarity },
        thumb(drop.item, 'gthumb--big'),
        h('div', { class: 'gdrop__title', text: drop.item.title }),
        rarityChip(drop.item.rarity),
        h('div', {
          class: 'gdrop__note' + (drop.isNew ? ' is-new' : ''),
          text: drop.isNew
            ? 'Новое!'
            : '+' + drop.shards + ' ' + plural(drop.shards, 'осколок', 'осколка', 'осколков'),
        }),
      );
      box.append(card);
      if (drop.item.rarity === 'epic' || drop.item.rarity === 'legendary') {
        haptics.levelUp();
        const r = card.getBoundingClientRect();
        confetti({ x: r.left + r.width / 2, y: r.top + r.height / 3 });
      } else {
        haptics.reward();
      }
      await sleep(drops.length > 1 ? 420 : 200);
    }
    done.classList.remove('hidden');
  })();
}

export function gearChestCard(chest: GearChest): HTMLElement & { refresh: () => void } {
  const oddsLine = h('div', { class: 'gchest__odds' });
  /*
   * Подпись с ценой задаётся сразу. С пустой подписью фабрика кнопок делает
   * круглую кнопку-значок без места под текст — и цена потом некуда вписать:
   * так сундуки и стояли без цены.
   */
  const start = gearChestPrice(getState(), chest);
  const priceBtn = button({
    tone: chest.gems > 0 ? 'ruby' : 'orange',
    size: 'sm',
    label: String(chest.gems > 0 ? start.gems : start.coins),
    icon: chest.gems > 0 ? 'gem' : 'coin',
  });
  onTap(priceBtn, () => {
    const check = canOpenGearChest(getState(), chest.id);
    if (check === 'not-enough-coins') return poorToast('coins');
    if (check === 'not-enough-gems') return poorToast('gems');
    if (check !== 'ok') return;
    let drops: GearDrop[] | null = null;
    update((st) => {
      drops = openGearChest(st, chest.id, rngFor('gear:' + chest.id + ':' + now()), now());
    });
    if (drops) showDrops(chest.title, drops);
  });

  const el = h(
    'div',
    { class: 'gchest t-' + chest.tone, data: { chest: chest.id } },
    h(
      'div',
      { class: 'gchest__main' },
      h('span', { class: 'gchest__icon' }, icon('chest')),
      h(
        'div',
        { class: 'gchest__text' },
        h('div', { class: 'gchest__title', text: chest.title }),
        h('div', { class: 'gchest__about', text: chest.about }),
      ),
      priceBtn,
    ),
    oddsLine,
  );

  return Object.assign(el, {
    refresh(): void {
      const state = getState();
      oddsLine.replaceChildren(...oddsChips(chestOdds(chest, perksOf(state).luck)));
      const price = gearChestPrice(state, chest);
      const label = priceBtn.querySelector('.btn__label');
      if (label) label.textContent = String(price.gems > 0 ? price.gems : price.coins);
    },
  });
}

export function gearChestNote(state: SaveState): string {
  const left = pityLeft(state);
  return (
    'Повторная находка не пропадает — она становится осколками для улучшения. ' +
    'Шансы выше — ровно те, по которым идёт бросок; удачу поднимают ветка Бахт и обереги. ' +
    'Каждая ' + PITY_EVERY + '-я вещь без эпической — точно эпическая или лучше' +
    (left < PITY_EVERY ? ': до неё осталось ' + left + '.' : '.')
  );
}
