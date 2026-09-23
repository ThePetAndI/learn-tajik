/**
 * Выбери реплику: собеседник говорит — надо ответить.
 *
 * Неверные варианты по умолчанию берём из реплик других диалогов: они
 * правильные сами по себе, но не к этому вопросу. Это и есть проверка —
 * понял ли игрок, что у него спросили.
 */

import type { Rng } from '../../core/rng';
import { shuffle } from '../../core/rng';
import type { Dialogue, Example } from '../../data/content';
import type { DialogueChoiceExercise } from '../types';
import type { LevelPool } from './pool';

const OPTIONS = 3;

export function makeDialogue(
  pool: LevelPool,
  dialogue: Dialogue,
  rng: Rng,
): DialogueChoiceExercise | null {
  const wrong = collectWrong(pool, dialogue, rng);
  if (wrong.length < OPTIONS - 1) return null;

  const options = shuffle(rng, [dialogue.reply, ...wrong.slice(0, OPTIONS - 1)]);
  return {
    kind: 'dialogue_choice',
    dialogueId: dialogue.id,
    wordIds: dialogue.words ?? [],
    ask: dialogue.ask,
    options: options.map((o) => ({ tg: o.tg, ru: o.ru })),
    correct: options.indexOf(dialogue.reply),
  };
}

function collectWrong(pool: LevelPool, dialogue: Dialogue, rng: Rng): Example[] {
  const used = new Set([key(dialogue.reply)]);
  const out: Example[] = [];

  const take = (list: readonly Example[]): void => {
    for (const item of list) {
      if (out.length >= OPTIONS - 1) return;
      const k = key(item);
      if (used.has(k)) continue;
      used.add(k);
      out.push(item);
    }
  };

  take(dialogue.wrong ?? []);
  take(
    shuffle(
      rng,
      pool.dialogues.filter((d) => d.id !== dialogue.id).map((d) => d.reply),
    ),
  );
  // последний запас — фразы уровня: они тоже звучат как готовая реплика
  if (out.length < OPTIONS - 1) {
    take(shuffle(rng, pool.phrases.map((p) => ({ tg: p.tg, ru: p.ru }))));
  }
  return out;
}

function key(example: Example): string {
  return example.tg.trim().toLowerCase();
}
