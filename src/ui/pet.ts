/**
 * Питомец-проводник. Стоит над текущим уровнем и покачивается.
 * Скины из магазина меняют только цвета (классы p-fur-*), форма одна.
 */

import { svgFrom } from '../core/dom';

export type PetMood = 'idle' | 'happy' | 'sleepy';

const PET_SVG = `
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" class="pet__svg" aria-hidden="true" focusable="false">
  <ellipse cx="32" cy="58" rx="17" ry="4" class="p-shadow"/>
  <path d="M14 22 12 8l13 6Z" class="p-fur-dark"/>
  <path d="M50 22 52 8 39 14Z" class="p-fur-dark"/>
  <path d="M16.5 20.5 15.5 12l8 3.7Z" class="p-ear-in"/>
  <path d="M47.5 20.5 48.5 12l-8 3.7Z" class="p-ear-in"/>
  <ellipse cx="32" cy="35" rx="21" ry="20" class="p-fur"/>
  <ellipse cx="32" cy="42" rx="13" ry="11" class="p-belly"/>
  <circle cx="24" cy="32" r="4.6" class="p-eye"/>
  <circle cx="40" cy="32" r="4.6" class="p-eye"/>
  <circle cx="25.6" cy="30.4" r="1.7" class="p-eye-hi"/>
  <circle cx="41.6" cy="30.4" r="1.7" class="p-eye-hi"/>
  <ellipse cx="17" cy="39" rx="4" ry="2.8" class="p-cheek"/>
  <ellipse cx="47" cy="39" rx="4" ry="2.8" class="p-cheek"/>
  <path d="M32 37.5c1.8 0 3.2 1.1 3.2 2.1 0 1-1.4 1.9-3.2 1.9s-3.2-.9-3.2-1.9c0-1 1.4-2.1 3.2-2.1Z" class="p-nose"/>
  <path d="M27.5 43.5c1.3 1.7 3 2.5 4.5 2.5s3.2-.8 4.5-2.5" class="p-mouth"/>
</svg>`;

export interface PetHandle {
  el: HTMLElement;
  setMood: (mood: PetMood) => void;
  cheer: () => void;
}

export function createPet(mood: PetMood = 'idle'): PetHandle {
  const svg = svgFrom(PET_SVG);
  const el = document.createElement('div');
  el.className = 'pet pet--' + mood;
  el.append(svg);

  return {
    el,
    setMood: (next) => {
      el.className = 'pet pet--' + next;
    },
    cheer: () => {
      el.classList.remove('is-cheer');
      void el.offsetWidth;
      el.classList.add('is-cheer');
    },
  };
}
