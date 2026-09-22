/**
 * Изафет: «падар» + и + «ман» = «падари ман».
 *
 * Главное, чему учит задание, — порядок: «и» клеится к главному слову,
 * а определение идёт после. По-русски наоборот, и это самая частая ошибка.
 *
 * Собранную форму сверяем с полем tg из контента: если «голова + и + хвост»
 * не сходится со строкой (а так бывает: чойи, хонаи, зиндагии), задание
 * не собирается. Показать игроку неверное написание хуже, чем не показать
 * задание вовсе.
 */

import type { Rng } from '../../core/rng';
import { shuffle } from '../../core/rng';
import type { Izafet } from '../../data/content';
import { normalizeAnswer } from '../../domain/answer';
import type { IzafetBuilderExercise } from '../types';
import { isSingleToken, type LevelPool } from './pool';

const SUFFIX = 'и';
const DISTRACTORS = 2;

export function makeIzafet(
  pool: LevelPool,
  item: Izafet,
  rng: Rng,
): IzafetBuilderExercise | null {
  const head = item.head.normalize('NFC');
  const mod = item.mod.normalize('NFC');
  if (!isSingleToken(head) || !isSingleToken(mod)) return null;

  const built = head + SUFFIX + ' ' + mod;
  if (normalizeAnswer(built) !== normalizeAnswer(item.tg)) return null;

  const used = new Set([head.toLowerCase(), mod.toLowerCase()]);
  const extras: string[] = [];
  for (const word of shuffle(rng, [...pool.words])) {
    if (extras.length >= DISTRACTORS) break;
    const token = word.tg.normalize('NFC');
    if (!isSingleToken(token) || used.has(token.toLowerCase())) continue;
    used.add(token.toLowerCase());
    extras.push(token);
  }

  return {
    kind: 'izafet_builder',
    wordIds: item.words ?? [],
    ru: item.ru,
    tg: item.tg,
    head,
    mod,
    suffix: SUFFIX,
    bank: shuffle(rng, [head, mod, ...extras]),
    // правило одно и то же для любой пары, поэтому собирается здесь,
    // а не дублируется в контенте у каждой записи
    explain:
      'Определение идёт после определяемого: «' + head + 'и ' + mod + '» — дословно «' +
      head + ' ' + mod + '». По-русски порядок обратный.',
  };
}
