/**
 * Питомцы и их снаряжение — вторая половина магазина.
 *
 * Сверху — сцена: активный питомец в полный рост и в своём наряде, под ним
 * три слота. Ниже — выбор питомца и его ступень, инвентарь снаряжения
 * и сундуки. Всё, что меняет наряд, сразу видно на сцене: ради этого
 * снаряжение и рисуется на питомце, а не лежит строчкой в списке.
 */

import { h, onTap, sleep, svgFrom } from '../core/dom';
import { haptics } from '../core/haptics';
import { rngFor } from '../core/rng';
import { getState, subscribe, update } from '../core/store';
import { now, plural } from '../core/time';
import { perksOf } from '../domain/bonuses';
import {
  MAX_PET_TIER,
  activePet,
  isOwned,
  itemsOfKind,
  nextTier,
  petBonus,
  petTier,
  type ShopItem,
} from '../domain/catalog';
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
  GEAR_CHESTS,
  PITY_EVERY,
  RARITIES,
  RARITY_ORDER,
  SLOTS,
  chestOdds,
  gearLevel,
  gearPerk,
  gearValue,
  getGear,
  pityLeft,
  wornBy,
  type GearChest,
  type GearItem,
  type GearSlot,
} from '../domain/gear-items';
import { combinePerks, perkLabel, perkLabels } from '../domain/perks';
import { buy, canBuy, canUpgradePet, equip, priceOf, upgradePet } from '../domain/shop';
import { button } from '../ui/button';
import { confetti } from '../ui/confetti';
import { gearThumb } from '../ui/gear-art';
import { icon, type IconName } from '../ui/icons';
import { modal } from '../ui/modal';
import { breedOf, createPet } from '../ui/pet';
import { toast } from '../ui/toast';

/* ————————————————————————— мелочи ————————————————————————— */

function thumb(item: GearItem, extra = ''): HTMLElement {
  return h('span', { class: 'gthumb r-' + item.rarity + (extra ? ' ' + extra : '') }, svgFrom(gearThumb(item.id, item.slot)));
}

function rarityChip(item: GearItem): HTMLElement {
  return h('span', { class: 'rarity r-' + item.rarity, text: RARITIES[item.rarity].title });
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

function poorToast(what: 'coins' | 'gems' | 'shards'): void {
  haptics.wrong();
  const text = what === 'coins' ? 'Не хватает монет' : what === 'gems' ? 'Не хватает лаъл' : 'Не хватает осколков';
  toast({ text, iconName: what === 'coins' ? 'coin' : what === 'gems' ? 'gem' : 'shards', tone: 'bad' });
}

/* ————————————————————————— карточка вещи ————————————————————————— */

function openGearSheet(item: GearItem): void {
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
            rarityChip(item),
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

function openSlotSheet(slot: GearSlot): void {
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
      item.id === current ? h('span', { class: 'gpick__worn' }, icon('check')) : rarityChip(item),
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

/* ————————————————————————— покупка питомца ————————————————————————— */

/**
 * Карточка некупленного питомца: как он выглядит, что даёт сразу и до чего
 * прокачивается. Покупка — только отдельной кнопкой с ценой.
 */
function openPetBuySheet(item: ShopItem): void {
  const state = getState();
  const price = priceOf(state, item.id);
  const lack = Math.max(0, price - state.wallet.coins);
  const tiers = item.tiers ?? [];
  const first = tiers[0];
  const last = tiers[tiers.length - 1];
  const preview = createPet('happy', breedOf(item.id));

  const body = h(
    'div',
    { class: 'pbuy t-' + item.tone },
    h('div', { class: 'pbuy__pet' }, preview.el),
    h('div', { class: 'pbuy__title', text: item.title }),
    h('p', { class: 'pbuy__about', text: item.description }),
    h(
      'div',
      { class: 'pbuy__perks' },
      first ? h('div', { class: 'pbuy__perk' }, icon('check'), h('span', { text: 'Сразу: ' + first.label })) : null,
      last && last !== first
        ? h('div', { class: 'pbuy__perk is-future' }, icon('up'), h('span', { text: 'На ' + tiers.length + '-й ступени: ' + last.label }))
        : null,
    ),
  );

  const buyBtn = button({
    label: lack > 0 ? 'Не хватает монет' : 'Купить за ' + price,
    sub: lack > 0 ? 'нужно ещё ' + lack : undefined,
    icon: lack > 0 ? undefined : 'coin',
    tone: lack > 0 ? 'lock' : 'orange',
    size: 'big',
    wide: true,
    disabled: lack > 0,
  });
  const m = modal({ body: h('div', {}, body, buyBtn), closeButton: true, class: 'modal__card--gear' });

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

/* ————————————————————————— сундук снаряжения ————————————————————————— */

function showDrops(chest: GearChest, drops: GearDrop[]): void {
  const box = h('div', { class: 'gdrops' });
  const done = button({ label: 'Забрать', tone: 'green', size: 'big', wide: true });
  done.classList.add('hidden');
  const m = modal({ title: chest.title, body: h('div', {}, box, done), class: 'modal__card--gear' });
  onTap(done, () => m.close('ok'));

  // вещи появляются по одной: так видно каждую, а не сразу кучу
  void (async () => {
    for (const drop of drops) {
      const card = h(
        'div',
        { class: 'gdrop r-' + drop.item.rarity },
        thumb(drop.item, 'gthumb--big'),
        h('div', { class: 'gdrop__title', text: drop.item.title }),
        rarityChip(drop.item),
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

function chestCard(chest: GearChest): HTMLElement & { refresh: () => void } {
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
    if (drops) showDrops(chest, drops);
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
      const odds = chestOdds(chest, perksOf(state).luck);
      oddsLine.replaceChildren(
        ...RARITY_ORDER.filter((r) => odds[r] > 0).map((r) =>
          h('span', { class: 'godds r-' + r }, h('span', { class: 'godds__dot' }), h('span', { text: fmtOdds(odds[r]) })),
        ),
      );
      const price = gearChestPrice(state, chest);
      const label = priceBtn.querySelector('.btn__label');
      if (label) label.textContent = String(price.gems > 0 ? price.gems : price.coins);
    },
  });
}

/** 62%, 2.4%, 0.4% — мелкие шансы с десятыми, чтобы не показывать «0%». */
function fmtOdds(p: number): string {
  return (p >= 10 ? Math.round(p) : Math.round(p * 10) / 10) + '%';
}

/* ————————————————————————— вид целиком ————————————————————————— */

export interface PetsView {
  el: HTMLElement;
  refresh: () => void;
  destroy: () => void;
}

export function createPetsView(): PetsView {
  const state0 = getState();
  const pet = createPet('happy', breedOf(state0.profile.petId));
  const stageName = h('div', { class: 'pstage__name' });
  const stageBonus = h('div', { class: 'pstage__bonus' });
  const slotRow = h('div', { class: 'pstage__slots' });

  const petRow = h('div', { class: 'ppets' });
  const tierRow = h('div', { class: 'ptier' });
  const shardsLine = h('span', { class: 'gshards' });
  const gearGrid = h('div', { class: 'ggrid' });
  const chests = GEAR_CHESTS.map(chestCard);
  const pityNote = h('p', { class: 'p gnote' });

  /* ——— выбор питомца ——— */
  function petChip(item: ShopItem): HTMLElement {
    const state = getState();
    const owned = isOwned(state, item.id);
    const active = activePet(state)?.id === item.id;
    /*
     * Купленный и некупленный питомец должны различаться с первого взгляда:
     * раньше оба были одинаковыми цветными плитками, и тап по чужому молча
     * списывал 350 монет. Теперь некупленный — белая плитка с замком и
     * ценником, а тап открывает карточку, где покупка — отдельная кнопка.
     */
    const chip = h(
      'button',
      {
        class: 'ppet t-' + item.tone + (active ? ' is-active' : '') + (owned ? '' : ' is-locked'),
        attr: { type: 'button' },
        aria: { label: owned ? item.title : item.title + ', купить за ' + priceOf(state, item.id) },
      },
      h('span', { class: 'ppet__icon' }, icon(item.icon as IconName)),
      owned ? null : h('span', { class: 'ppet__lock' }, icon('lock')),
      h('span', { class: 'ppet__name', text: item.title }),
      owned
        ? h('span', { class: 'ppet__tier', text: active ? 'с вами' : 'ступень ' + petTier(state, item.id) })
        : h('span', { class: 'ppet__price' }, icon('coin'), h('span', { text: String(priceOf(state, item.id)) })),
    );
    onTap(chip, () => {
      haptics.tap();
      if (!isOwned(getState(), item.id)) {
        openPetBuySheet(item);
        return;
      }
      if (active) return;
      update((s) => {
        equip(s, item.id, now());
      });
      haptics.reward();
    });
    return chip;
  }

  /* ——— ступень активного питомца ——— */
  function renderTier(item: ShopItem): void {
    const state = getState();
    const tier = petTier(state, item.id);
    const next = nextTier(state, item.id);
    const parts: Node[] = [
      h(
        'div',
        { class: 'ptier__info' },
        h(
          'span',
          { class: 'pet-tier__pips' },
          ...Array.from({ length: MAX_PET_TIER }, (_, i) => h('span', { class: 'pet-tier__pip' + (i < tier ? ' is-on' : '') })),
        ),
        h('span', { class: 'ptier__label', text: next ? 'дальше: ' + next.label : 'ступень максимальная' }),
      ),
    ];
    if (next) {
      parts.push(
        button({
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
              pet.cheer();
              toast({ text: item.title + ': ' + next.label, iconName: 'up', tone: 'gold' });
            },
          }),
      );
    }
    tierRow.replaceChildren(...parts);
  }

  function refresh(): void {
    const state = getState();
    const active = activePet(state);
    if (!active) return;
    const outfit = wornBy(state, active.id);

    pet.setBreed(breedOf(active.id));
    pet.setOutfit(outfit);
    stageName.textContent = active.title;

    // всё, что даёт питомец сейчас: ступень и наряд, сложенные по тем же
    // правилам, что и настоящий расчёт, — «+16% монет» и «+3% монет» это «+19%»
    const sources = [petBonus(state, active.id)];
    for (const id of Object.values(outfit)) {
      const item = id ? getGear(id) : undefined;
      if (item) sources.push(gearPerk(item, gearLevel(state, item.id)));
    }
    const bonuses = perkLabels(combinePerks(sources));
    stageBonus.textContent = bonuses.length > 0 ? bonuses.join(' · ') : 'Пока просто друг';

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

    petRow.replaceChildren(...itemsOfKind('pet').map(petChip));
    renderTier(active);

    /* ——— инвентарь ——— */
    shardsLine.replaceChildren(icon('shards'), h('span', { text: String(state.inventory.shards) }));
    const owned = GEAR.filter((g) => gearLevel(state, g.id) > 0).sort(
      (a, b) =>
        RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity) ||
        SLOTS.findIndex((sl) => sl.id === a.slot) - SLOTS.findIndex((sl) => sl.id === b.slot),
    );
    const wornIds = new Set(Object.values(outfit));
    gearGrid.replaceChildren(
      ...(owned.length === 0
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
          })),
    );
    gearGrid.append(
      h('div', {
        class: 'ggrid__count',
        text: 'Собрано ' + owned.length + ' из ' + GEAR.length,
      }),
    );

    for (const chest of chests) chest.refresh();
    const left = pityLeft(state);
    pityNote.textContent =
      'Повторная находка не пропадает — она становится осколками для улучшения. ' +
      'Шансы выше — ровно те, по которым идёт бросок; удачу поднимают ветка Бахт и обереги. ' +
      'Каждая ' + PITY_EVERY + '-я вещь без эпической — точно эпическая или лучше' +
      (left < PITY_EVERY ? ': до неё осталось ' + left + '.' : '.');
  }

  const el = h(
    'div',
    { class: 'pets' },
    h(
      'section',
      { class: 'pstage' },
      h('div', { class: 'pstage__pet' }, pet.el),
      stageName,
      stageBonus,
      slotRow,
    ),
    h('section', { class: 'panel' }, h('div', { class: 'panel__title', text: 'Питомцы' }), petRow, tierRow),
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
  );

  const unsub = subscribe(refresh);
  refresh();
  return { el, refresh, destroy: unsub };
}
