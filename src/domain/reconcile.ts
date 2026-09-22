/**
 * Сверка наград лаъл с тем, что игрок уже сделал.
 *
 * Лаъл появился, когда у кого-то на телефоне уже пройдены десятки уровней.
 * Обычные поводы наград срабатывают только на новом событии: доведи слово
 * до конца, пройди уровень без ошибок. Без сверки старый игрок получил бы
 * лаъл за раздел, только переиграв его заново, — наказание за то, что он
 * начал раньше.
 *
 * Сверка выдаёт всё, что уже заслужено, по тем же ключам ледгера, что и
 * обычные награды. Поэтому её можно звать на каждом старте: второй раз
 * она ничего не выдаст.
 */

import type { FlatLevel } from '../data/content';
import type { SaveState } from '../data/state';
import { awardMastery, awardPerfect, awardStreak } from './gems';
import { awardSectionIfDone } from './progress';
import { MAX_STARS } from './stars';
import { MAX_BOX } from './srs';

/** Выдаёт заслуженное. Возвращает, сколько лаъл пришло этим вызовом. */
export function reconcileGems(state: SaveState, levels: readonly FlatLevel[], ts: number): number {
  let gained = 0;

  // три звезды возможны только без ошибок — значит уровень уже был пройден чисто
  for (const [levelId, progress] of Object.entries(state.levels)) {
    if (progress.stars >= MAX_STARS) gained += awardPerfect(state, levelId, ts);
  }

  for (const sectionId of new Set(levels.map((l) => l.sectionId))) {
    gained += awardSectionIfDone(state, levels, sectionId, ts);
  }

  for (const [wordId, stat] of Object.entries(state.srs)) {
    if (stat.box >= MAX_BOX || stat.mastered) {
      stat.mastered = true;
      gained += awardMastery(state, wordId, ts);
    }
  }

  // лучшая серия, а не текущая: веху, до которой когда-то дошёл, уже взял
  gained += awardStreak(state, state.streak.best, ts);
  return gained;
}
