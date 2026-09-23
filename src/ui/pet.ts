/**
 * Питомец-проводник. Стоит над текущим уровнем и покачивается.
 *
 * У каждого зверя свои уши и свой цвет: раньше форма была одна на всех,
 * и купленная за 500 монет птица выглядела на карте тем же лисёнком,
 * только перекрашенным.
 */

import { svgFrom } from '../core/dom';
import { GEAR_ART } from './gear-art';

export type PetMood = 'idle' | 'happy' | 'sleepy';
export type PetBreed = 'fox' | 'cat' | 'dog' | 'bird' | 'kabk' | 'bulbul' | 'hirs' | 'ohu' | 'uqob' | 'babr';

/** id товара из магазина -> порода. */
const BREED_BY_ITEM: Record<string, PetBreed> = {
  pet_fox: 'fox',
  pet_cat: 'cat',
  pet_dog: 'dog',
  pet_bird: 'bird',
  pet_kabk: 'kabk',
  pet_bulbul: 'bulbul',
  pet_hirs: 'hirs',
  pet_ohu: 'ohu',
  pet_uqob: 'uqob',
  pet_babr: 'babr',
};

/**
 * Лицо питомца для плиток и карточек: та же голова, что на карте, но без
 * покачивания и тени — для рядов, где зверей сразу несколько.
 */
export function petFace(breed: PetBreed, rank = 1, extra = ''): HTMLElement {
  const el = document.createElement('span');
  el.className = 'pet-face pet--' + breed + (rank > 1 ? ' pet--rank-' + Math.min(5, rank) : '') + (extra ? ' ' + extra : '');
  el.append(svgFrom(petSvg(breed)));
  return el;
}

/**
 * Яйцо из лоны: качается, трескается — и из него выходит питомец.
 * Трещина нарисована заранее и проявляется классом is-crack.
 */
export function eggSvg(): string {
  return (
    '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" class="egg__svg" aria-hidden="true" focusable="false">' +
    '<ellipse cx="32" cy="58" rx="16" ry="3.6" class="egg-shadow"/>' +
    '<path d="M32 5C43.5 5 51 22.5 51 35.5 51 47 42.6 56 32 56S13 47 13 35.5C13 22.5 20.5 5 32 5Z" class="egg-shell"/>' +
    '<circle cx="24" cy="27" r="3.6" class="egg-spot"/>' +
    '<circle cx="39.5" cy="19" r="2.6" class="egg-spot"/>' +
    '<circle cx="40.5" cy="39" r="4.2" class="egg-spot"/>' +
    '<circle cx="25.5" cy="45" r="2.4" class="egg-spot"/>' +
    '<path d="M22.5 16.5c-2.8 4-4.4 8.6-4.7 12.8" class="egg-shine"/>' +
    '<path d="M14.2 33.5 20 36.6l4.2-5 5 5.2 4.8-5.6 4.4 5.4 4.8-3.6 3.6 2.4" class="egg-crack"/>' +
    '</svg>'
  );
}

export function breedOf(petId: string | null | undefined): PetBreed {
  return BREED_BY_ITEM[petId ?? ''] ?? 'fox';
}

/** Уши (или их отсутствие) — то, по чему зверь узнаётся с одного взгляда. */
const EARS: Record<PetBreed, string> = {
  fox:
    '<path d="M14 22 12 8l13 6Z" class="p-fur-dark"/>' +
    '<path d="M50 22 52 8 39 14Z" class="p-fur-dark"/>' +
    '<path d="M16.5 20.5 15.5 12l8 3.7Z" class="p-ear-in"/>' +
    '<path d="M47.5 20.5 48.5 12l-8 3.7Z" class="p-ear-in"/>',
  cat:
    '<path d="M15 23 13 6l14 9Z" class="p-fur-dark"/>' +
    '<path d="M49 23 51 6 37 15Z" class="p-fur-dark"/>' +
    '<path d="M17.5 21 16.5 11l8.5 5.4Z" class="p-ear-in"/>' +
    '<path d="M46.5 21 47.5 11 39 16.4Z" class="p-ear-in"/>',
  dog:
    '<path d="M13 20c-4 0-6.2 4-6.2 10.5S9.4 44 13.6 44c3 0 4.8-2.4 4.8-6C18.4 32 17 20 13 20Z" class="p-fur-dark"/>' +
    '<path d="M51 20c4 0 6.2 4 6.2 10.5S54.6 44 50.4 44c-3 0-4.8-2.4-4.8-6C45.6 32 47 20 51 20Z" class="p-fur-dark"/>',
  bird:
    '<path d="M32 6c1.6 0 2.9 1.3 2.9 2.9 0 2-1.5 3.6-2.9 5.2-1.4-1.6-2.9-3.2-2.9-5.2C29.1 7.3 30.4 6 32 6Z" class="p-fur-dark"/>',
  // кабк — круглая голова без ушей: весь его характер в полосе через глаз
  kabk: '',
  // булбул — тёмный хохолок торчком
  bulbul:
    '<path d="M27.5 17 30.6 3.5 35.4 15.6Z" class="p-fur-dark"/>' +
    '<path d="M32.6 15.8 39.8 6.6 38.8 18.2Z" class="p-fur-dark"/>',
  // хирс — круглые уши по бокам макушки
  hirs:
    '<circle cx="14.5" cy="19" r="7.2" class="p-fur-dark"/><circle cx="49.5" cy="19" r="7.2" class="p-fur-dark"/>' +
    '<circle cx="14.8" cy="19.4" r="3.6" class="p-ear-in"/><circle cx="49.2" cy="19.4" r="3.6" class="p-ear-in"/>',
  // оҳу — длинные уши в стороны и маленькие рожки
  ohu:
    '<path d="M24.6 17.5c-1.6-4.6-1.2-9.2 1.4-12.4M25.3 11.4c-2-1.1-3.4-2.8-3.8-5" stroke="#6b4a2c" stroke-width="2.3" fill="none" stroke-linecap="round"/>' +
    '<path d="M39.4 17.5c1.6-4.6 1.2-9.2-1.4-12.4M38.7 11.4c2-1.1 3.4-2.8 3.8-5" stroke="#6b4a2c" stroke-width="2.3" fill="none" stroke-linecap="round"/>' +
    '<path d="M14.4 27.4C5.2 24.6 2.6 17.8 4.4 14.8c5.4 1.2 10.8 5.6 13.6 10.4Z" class="p-fur-dark"/>' +
    '<path d="M49.6 27.4c9.2-2.8 11.8-9.6 10-12.6-5.4 1.2-10.8 5.6-13.6 10.4Z" class="p-fur-dark"/>' +
    '<path d="M13 24.2C8 22.4 6.6 19.2 7.2 17.8c3 .9 5.9 3.2 7.6 5.8Z" class="p-ear-in"/>' +
    '<path d="M51 24.2c5-1.8 6.4-5 5.8-6.4-3 .9-5.9 3.2-7.6 5.8Z" class="p-ear-in"/>',
  // уқоб — перья, отведённые назад
  uqob:
    '<path d="M16.6 22.6 9.4 14.8l10.2 3.4Z" class="p-fur-dark"/><path d="M47.4 22.6l7.2-7.8-10.2 3.4Z" class="p-fur-dark"/>',
  // бабри барфӣ — маленькие круглые уши
  babr:
    '<circle cx="16" cy="19.5" r="6" class="p-fur-dark"/><circle cx="48" cy="19.5" r="6" class="p-fur-dark"/>' +
    '<circle cx="16.3" cy="19.9" r="3" class="p-ear-in"/><circle cx="47.7" cy="19.9" r="3" class="p-ear-in"/>',
};

/**
 * Отметины поверх головы, но под глазами: полоса кабка, пятна барса,
 * пятнышки оленёнка. Рисуются до глаз, чтобы не закрыть их.
 */
const MARKS: Partial<Record<PetBreed, string>> = {
  kabk:
    '<path d="M11 36.5c.6 11 8.4 16.4 21 16.6 12.6-.2 20.4-5.6 21-16.6" stroke="#2b2433" stroke-width="3.2" fill="none" stroke-linecap="round"/>' +
    '<path d="M11.4 28.6c4.2-3.2 9.6-3.4 14.2-.4M52.6 28.6c-4.2-3.2-9.6-3.4-14.2-.4" stroke="#2b2433" stroke-width="3" fill="none" stroke-linecap="round"/>',
  bulbul: '<ellipse cx="32" cy="22" rx="14" ry="6" class="p-fur-dark" opacity=".55"/>',
  ohu:
    '<circle cx="26" cy="21.5" r="1.5" fill="#fff" opacity=".75"/><circle cx="31.5" cy="19.2" r="1.3" fill="#fff" opacity=".75"/>' +
    '<circle cx="37.6" cy="21.2" r="1.5" fill="#fff" opacity=".75"/>',
  uqob:
    '<path d="M17.6 25.6 28.6 28.6M46.4 25.6 35.4 28.6" stroke="#3b2a1e" stroke-width="2.8" stroke-linecap="round"/>',
  babr:
    '<g fill="none" stroke="#5e6670" stroke-width="1.5" opacity=".75">' +
    '<circle cx="20.5" cy="24" r="2.3"/><circle cx="43.5" cy="24" r="2.3"/><circle cx="27" cy="19.4" r="1.8"/>' +
    '<circle cx="37" cy="19.4" r="1.8"/><circle cx="13.6" cy="33.6" r="2.2"/><circle cx="50.4" cy="33.6" r="2.2"/>' +
    '<circle cx="15.4" cy="44.6" r="1.8"/><circle cx="48.6" cy="44.6" r="1.8"/></g>',
};

/** Нос: у птицы клюв, у остальных — мочка. */
const NOSE: Record<PetBreed, string> = {
  fox: '<path d="M32 37.5c1.8 0 3.2 1.1 3.2 2.1 0 1-1.4 1.9-3.2 1.9s-3.2-.9-3.2-1.9c0-1 1.4-2.1 3.2-2.1Z" class="p-nose"/>',
  cat: '<path d="M32 37.5c1.6 0 2.8 1 2.8 1.9 0 1.1-1.3 2.3-2.8 2.3s-2.8-1.2-2.8-2.3c0-.9 1.2-1.9 2.8-1.9Z" class="p-nose"/>',
  dog: '<ellipse cx="32" cy="39.4" rx="4" ry="3" class="p-nose"/>',
  bird: '<path d="M32 36.4 38.6 41 32 45.6 25.4 41Z" class="p-beak"/>',
  kabk: '<path d="M32 36.6 37.8 40.6 32 44.8 26.2 40.6Z" class="p-beak"/>',
  bulbul: '<path d="M32 37.6 36.4 40.8 32 43.8 27.6 40.8Z" class="p-beak"/>',
  hirs: '<ellipse cx="32" cy="39.6" rx="4.8" ry="3.4" class="p-nose"/>',
  ohu: '<ellipse cx="32" cy="40.2" rx="3.4" ry="2.5" class="p-nose"/>',
  // клюв орла — крючком вниз
  uqob: '<path d="M25.8 37.2Q32 33.4 38.2 37.2q-.6 6.6-5.6 10.2-1.2-3.6-2.4-5.2-3.4-.6-4.4-5Z" class="p-beak"/>',
  babr: '<path d="M28.8 38.2h6.4L32 41.8Z" class="p-nose"/>',
};

const MOUTH: Record<PetBreed, string> = {
  fox: '<path d="M27.5 43.5c1.3 1.7 3 2.5 4.5 2.5s3.2-.8 4.5-2.5" class="p-mouth"/>',
  cat:
    '<path d="M27.5 43.5c1.3 1.7 3 2.5 4.5 2.5s3.2-.8 4.5-2.5" class="p-mouth"/>' +
    '<path d="M8 35h9M8 40h9M56 35h-9M56 40h-9" class="p-whisker"/>',
  dog: '<path d="M27 44.5c1.6 1.8 3.4 2.6 5 2.6s3.4-.8 5-2.6" class="p-mouth"/>',
  bird: '',
  kabk: '',
  bulbul: '',
  hirs: '<path d="M27 44.5c1.6 1.8 3.4 2.6 5 2.6s3.4-.8 5-2.6" class="p-mouth"/>',
  ohu: '<path d="M29 44.6c1 .9 2 1.3 3 1.3s2-.4 3-1.3" class="p-mouth"/>',
  uqob: '',
  babr:
    '<path d="M27.5 43.5c1.3 1.7 3 2.5 4.5 2.5s3.2-.8 4.5-2.5" class="p-mouth"/>' +
    '<path d="M8 35h9M8 40h9M56 35h-9M56 40h-9" class="p-whisker"/>',
};

/**
 * Наряд поверх питомца. Порядок слоёв важен: сначала шея (ложится на подбородок),
 * потом оберег (висит на ней), последней — шапка: она сидит поверх ушей.
 */
export interface Outfit {
  head?: string;
  neck?: string;
  charm?: string;
}

function outfitSvg(outfit: Outfit): string {
  return (
    (outfit.neck ? GEAR_ART[outfit.neck] ?? '' : '') +
    (outfit.charm ? GEAR_ART[outfit.charm] ?? '' : '') +
    (outfit.head ? GEAR_ART[outfit.head] ?? '' : '')
  );
}

export function petSvg(breed: PetBreed, outfit: Outfit = {}): string {
  return (
    '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" class="pet__svg" aria-hidden="true" focusable="false">' +
    '<ellipse cx="32" cy="58" rx="17" ry="4" class="p-shadow"/>' +
    EARS[breed] +
    '<ellipse cx="32" cy="35" rx="21" ry="20" class="p-fur"/>' +
    '<ellipse cx="32" cy="42" rx="13" ry="11" class="p-belly"/>' +
    (MARKS[breed] ?? '') +
    '<circle cx="24" cy="32" r="4.6" class="p-eye"/>' +
    '<circle cx="40" cy="32" r="4.6" class="p-eye"/>' +
    '<circle cx="25.6" cy="30.4" r="1.7" class="p-eye-hi"/>' +
    '<circle cx="41.6" cy="30.4" r="1.7" class="p-eye-hi"/>' +
    '<ellipse cx="17" cy="39" rx="4" ry="2.8" class="p-cheek"/>' +
    '<ellipse cx="47" cy="39" rx="4" ry="2.8" class="p-cheek"/>' +
    NOSE[breed] +
    MOUTH[breed] +
    outfitSvg(outfit) +
    '</svg>'
  );
}

export interface PetHandle {
  el: HTMLElement;
  setMood: (mood: PetMood) => void;
  /** Звёзды питомца: чем больше, тем ярче свечение; на пяти он золотой. */
  setRank: (rank: number) => void;
  /** Сменить зверя — например, после покупки в магазине. */
  setBreed: (breed: PetBreed) => void;
  /** Переодеть: что надето на голове, шее и оберегом. */
  setOutfit: (outfit: Outfit) => void;
  cheer: () => void;
}

function sameOutfit(a: Outfit, b: Outfit): boolean {
  return a.head === b.head && a.neck === b.neck && a.charm === b.charm;
}

/** Классы обёртки питомца: порода, настроение, звёзды. */
function petClass(breed: PetBreed, mood: PetMood, rank: number): string {
  return 'pet pet--' + mood + ' pet--' + breed + (rank > 1 ? ' pet--rank-' + Math.min(5, rank) : '');
}

export function createPet(
  mood: PetMood = 'idle',
  breed: PetBreed = 'fox',
  outfit: Outfit = {},
  rank = 1,
): PetHandle {
  const el = document.createElement('div');
  let current = breed;
  let currentMood = mood;
  let currentOutfit: Outfit = { ...outfit };
  let currentRank = rank;

  function paint(): void {
    el.replaceChildren(svgFrom(petSvg(current, currentOutfit)));
    el.className = petClass(current, currentMood, currentRank);
  }
  paint();

  return {
    el,
    setMood: (next) => {
      if (next === currentMood) return;
      currentMood = next;
      el.className = petClass(current, currentMood, currentRank);
    },
    setRank: (next) => {
      if (next === currentRank) return;
      currentRank = next;
      el.className = petClass(current, currentMood, currentRank);
    },
    setBreed: (next) => {
      if (next === current) return;
      current = next;
      paint();
    },
    setOutfit: (next) => {
      if (sameOutfit(next, currentOutfit)) return;
      currentOutfit = { ...next };
      paint();
    },
    cheer: () => {
      el.classList.remove('is-cheer');
      void el.offsetWidth;
      el.classList.add('is-cheer');
    },
  };
}
