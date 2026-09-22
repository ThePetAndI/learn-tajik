/**
 * Питомец-проводник. Стоит над текущим уровнем и покачивается.
 *
 * У каждого зверя свои уши и свой цвет: раньше форма была одна на всех,
 * и купленная за 500 монет птица выглядела на карте тем же лисёнком,
 * только перекрашенным.
 */

import { svgFrom } from '../core/dom';

export type PetMood = 'idle' | 'happy' | 'sleepy';
export type PetBreed = 'fox' | 'cat' | 'dog' | 'bird';

/** id товара из магазина -> порода. */
const BREED_BY_ITEM: Record<string, PetBreed> = {
  pet_fox: 'fox',
  pet_cat: 'cat',
  pet_dog: 'dog',
  pet_bird: 'bird',
};

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
};

/** Нос: у птицы клюв, у остальных — мочка. */
const NOSE: Record<PetBreed, string> = {
  fox: '<path d="M32 37.5c1.8 0 3.2 1.1 3.2 2.1 0 1-1.4 1.9-3.2 1.9s-3.2-.9-3.2-1.9c0-1 1.4-2.1 3.2-2.1Z" class="p-nose"/>',
  cat: '<path d="M32 37.5c1.6 0 2.8 1 2.8 1.9 0 1.1-1.3 2.3-2.8 2.3s-2.8-1.2-2.8-2.3c0-.9 1.2-1.9 2.8-1.9Z" class="p-nose"/>',
  dog: '<ellipse cx="32" cy="39.4" rx="4" ry="3" class="p-nose"/>',
  bird: '<path d="M32 36.4 38.6 41 32 45.6 25.4 41Z" class="p-beak"/>',
};

const MOUTH: Record<PetBreed, string> = {
  fox: '<path d="M27.5 43.5c1.3 1.7 3 2.5 4.5 2.5s3.2-.8 4.5-2.5" class="p-mouth"/>',
  cat:
    '<path d="M27.5 43.5c1.3 1.7 3 2.5 4.5 2.5s3.2-.8 4.5-2.5" class="p-mouth"/>' +
    '<path d="M8 35h9M8 40h9M56 35h-9M56 40h-9" class="p-whisker"/>',
  dog: '<path d="M27 44.5c1.6 1.8 3.4 2.6 5 2.6s3.4-.8 5-2.6" class="p-mouth"/>',
  bird: '',
};

function petSvg(breed: PetBreed): string {
  return (
    '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" class="pet__svg" aria-hidden="true" focusable="false">' +
    '<ellipse cx="32" cy="58" rx="17" ry="4" class="p-shadow"/>' +
    EARS[breed] +
    '<ellipse cx="32" cy="35" rx="21" ry="20" class="p-fur"/>' +
    '<ellipse cx="32" cy="42" rx="13" ry="11" class="p-belly"/>' +
    '<circle cx="24" cy="32" r="4.6" class="p-eye"/>' +
    '<circle cx="40" cy="32" r="4.6" class="p-eye"/>' +
    '<circle cx="25.6" cy="30.4" r="1.7" class="p-eye-hi"/>' +
    '<circle cx="41.6" cy="30.4" r="1.7" class="p-eye-hi"/>' +
    '<ellipse cx="17" cy="39" rx="4" ry="2.8" class="p-cheek"/>' +
    '<ellipse cx="47" cy="39" rx="4" ry="2.8" class="p-cheek"/>' +
    NOSE[breed] +
    MOUTH[breed] +
    '</svg>'
  );
}

export interface PetHandle {
  el: HTMLElement;
  setMood: (mood: PetMood) => void;
  /** Сменить зверя — например, после покупки в магазине. */
  setBreed: (breed: PetBreed) => void;
  cheer: () => void;
}

export function createPet(mood: PetMood = 'idle', breed: PetBreed = 'fox'): PetHandle {
  const el = document.createElement('div');
  let current = breed;
  let currentMood = mood;

  function paint(): void {
    el.replaceChildren(svgFrom(petSvg(current)));
    el.className = 'pet pet--' + currentMood + ' pet--' + current;
  }
  paint();

  return {
    el,
    setMood: (next) => {
      if (next === currentMood) return;
      currentMood = next;
      el.className = 'pet pet--' + currentMood + ' pet--' + current;
    },
    setBreed: (next) => {
      if (next === current) return;
      current = next;
      paint();
    },
    cheer: () => {
      el.classList.remove('is-cheer');
      void el.offsetWidth;
      el.classList.add('is-cheer');
    },
  };
}
