/**
 * Питомцы и их снаряжение — вторая половина магазина.
 *
 * Сверху — сцена: активный питомец в полный рост, в своём наряде и со своими
 * звёздами, под ним три слота. Ниже — коллекция питомцев с ростом активного,
 * лона, откуда питомцы выходят, обмен копий, инвентарь снаряжения, сундуки
 * и в самом конце — коллекция с наградами за собранное.
 * Всё, что меняет питомца, сразу видно на сцене: ради этого наряд и звёзды
 * рисуются на нём, а не лежат строчкой в списке.
 */

import { h, onTap } from '../core/dom';
import { haptics } from '../core/haptics';
import { getState, subscribe } from '../core/store';
import { activePet, allPets, isOwned, petBonus, petRank } from '../domain/catalog';
import { COLLECTION, claimableCount, goalStatus } from '../domain/collection';
import { GEAR_CHESTS, SLOTS, gearLevel, gearPerk, getGear, wornBy } from '../domain/gear-items';
import { PET_CHESTS } from '../domain/pets';
import { combinePerks, perkLabels } from '../domain/perks';
import { icon, type IconName } from '../ui/icons';
import { breedOf, createPet } from '../ui/pet';
import { collectionRows } from './collection-cards';
import { mealRow } from './food-cards';
import { gearCards, gearChestCard, gearChestNote, openSlotSheet, thumb } from './gear-cards';
import { nestCard, nestNote, petProgress, petTile, starRow, swapRows } from './pet-cards';
import { rarityChip } from './shop-bits';

export interface PetsView {
  el: HTMLElement;
  refresh: () => void;
  destroy: () => void;
}

export function createPetsView(): PetsView {
  const state0 = getState();
  const pet = createPet('happy', breedOf(state0.profile.petId));
  const stageName = h('div', { class: 'pstage__name' });
  const stageMeta = h('div', { class: 'pstage__meta' });
  const stageBonus = h('div', { class: 'pstage__bonus' });
  const stageMeal = h('div', { class: 'pstage__meal' });
  const slotRow = h('div', { class: 'pstage__slots' });

  const petCount = h('span', { class: 'pcount' });
  const petGrid = h('div', { class: 'ppets' });
  const progress = h('div', { class: 'pprogress' });
  const nests = PET_CHESTS.map(nestCard);
  const nestNoteEl = h('p', { class: 'p gnote' });
  const swapList = h('div', { class: 'pswaps' });
  const shardsLine = h('span', { class: 'gshards' });
  const gearGrid = h('div', { class: 'ggrid' });
  const chests = GEAR_CHESTS.map(gearChestCard);
  const pityNote = h('p', { class: 'p gnote' });
  const goalCount = h('span', { class: 'pcount' });
  const goalList = h('div', { class: 'cgoals' });
  const goalPanel = h(
    'section',
    { class: 'panel', data: { panel: 'collection' } },
    h('div', { class: 'panel__head' }, h('div', { class: 'panel__title', text: 'Коллекция' }), goalCount),
    goalList,
  );
  // награда ждёт в самом низу страницы — наверху о ней напоминает полоска
  const claimBanner = h(
    'button',
    { class: 'cbanner hidden', attr: { type: 'button' } },
    icon('crown'),
    h('span', { class: 'cbanner__text' }),
    icon('chevronDown'),
  );
  onTap(claimBanner, () => {
    haptics.tap();
    goalPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  function refresh(): void {
    const state = getState();
    const active = activePet(state);
    if (!active) return;
    const outfit = wornBy(state, active.id);
    const rank = petRank(state, active.id);

    /* ——— сцена ——— */
    pet.setBreed(breedOf(active.id));
    pet.setOutfit(outfit);
    pet.setRank(rank);
    stageName.textContent = active.title;
    stageMeta.replaceChildren(rarityChip(active.rarity ?? 'common'), starRow(rank, 'pstage__stars'));

    // всё, что даёт питомец сейчас: ступень со звёздами и наряд, сложенные по тем
    // же правилам, что и настоящий расчёт, — «+16% монет» и «+3% монет» это «+19%»
    const sources = [petBonus(state, active.id)];
    for (const id of Object.values(outfit)) {
      const item = id ? getGear(id) : undefined;
      if (item) sources.push(gearPerk(item, gearLevel(state, item.id)));
    }
    const bonuses = perkLabels(combinePerks(sources));
    stageBonus.textContent = bonuses.length > 0 ? bonuses.join(' · ') : 'Пока просто друг';
    stageMeal.replaceChildren(mealRow(pet));

    slotRow.replaceChildren(
      ...SLOTS.map((slot) => {
        const id = outfit[slot.id];
        const item = id ? getGear(id) : undefined;
        const tile = h(
          'button',
          { class: 'pslot' + (item ? ' r-' + item.rarity + ' is-filled' : ''), attr: { type: 'button' } },
          item ? thumb(item) : h('span', { class: 'pslot__empty' }, icon(slot.icon as IconName)),
          h('span', { class: 'pslot__label', text: item ? item.title : slot.title }),
        );
        onTap(tile, () => {
          haptics.tap();
          openSlotSheet(slot.id);
        });
        return tile;
      }),
    );

    /* ——— коллекция ——— */
    const pets = allPets();
    petCount.textContent = 'собрано ' + pets.filter((p) => isOwned(state, p.id)).length + ' из ' + pets.length;
    petGrid.replaceChildren(...pets.map((item) => petTile(item, { onActiveTap: () => pet.cheer() })));
    progress.replaceChildren(...petProgress(active, pet));

    /* ——— лона и обмен ——— */
    for (const nest of nests) nest.refresh();
    nestNoteEl.textContent = nestNote(state);
    swapList.replaceChildren(...swapRows());

    /* ——— снаряжение ——— */
    shardsLine.replaceChildren(icon('shards'), h('span', { text: String(state.inventory.shards) }));
    gearGrid.replaceChildren(...gearCards(state, new Set(Object.values(outfit))));
    for (const chest of chests) chest.refresh();
    pityNote.textContent = gearChestNote(state);

    /* ——— коллекция ——— */
    const ready = claimableCount(state);
    const claimed = COLLECTION.filter((g) => goalStatus(state, g) === 'claimed').length;
    goalCount.textContent = claimed + ' из ' + COLLECTION.length;
    goalList.replaceChildren(...collectionRows());
    claimBanner.classList.toggle('hidden', ready === 0);
    const bannerText = claimBanner.querySelector('.cbanner__text');
    if (bannerText) {
      bannerText.textContent = ready === 1 ? 'Награда коллекции ждёт' : 'Награды коллекции ждут: ' + ready;
    }
  }

  const el = h(
    'div',
    { class: 'pets' },
    h(
      'section',
      { class: 'pstage' },
      h('div', { class: 'pstage__pet' }, pet.el),
      stageName,
      stageMeta,
      stageBonus,
      stageMeal,
      slotRow,
    ),
    claimBanner,
    h(
      'section',
      { class: 'panel' },
      h('div', { class: 'panel__head' }, h('div', { class: 'panel__title', text: 'Питомцы' }), petCount),
      petGrid,
      progress,
    ),
    h(
      'section',
      { class: 'panel', data: { panel: 'nests' } },
      h('div', { class: 'panel__title', text: 'Лона' }),
      h('p', {
        class: 'p gnote gnote--lead',
        text:
          'Из лоны выходит питомец. Новый — ваш, а знакомый приходит копией: ' +
          'копии соединяются в звёзды, и питомец становится сильнее.',
      }),
      ...nests,
      nestNoteEl,
      h('div', { class: 'pswaps__head' }, icon('swap'), h('span', { text: 'Обмен копий' })),
      h('p', {
        class: 'p gnote gnote--lead',
        text:
          'Три копии одной редкости можно обменять на питомца редкостью выше. ' +
          'Копии нужны и для звёзд — обменивайте лишние.',
      }),
      swapList,
    ),
    h(
      'section',
      { class: 'panel' },
      h('div', { class: 'panel__head' }, h('div', { class: 'panel__title', text: 'Снаряжение' }), shardsLine),
      gearGrid,
    ),
    h(
      'section',
      { class: 'panel' },
      h('div', { class: 'panel__title', text: 'Сундуки снаряжения' }),
      ...chests,
      pityNote,
    ),
    goalPanel,
  );

  const unsub = subscribe(refresh);
  refresh();
  return { el, refresh, destroy: unsub };
}
