/** Реестр мини-игр: тип задания -> модуль, который его показывает. */

import { buildPhraseModule } from './exercises/build-phrase';
import { letterWheelModule } from './exercises/letter-wheel';
import { matchPairsModule } from './exercises/match-pairs';
import { quizModule } from './exercises/quiz';
import type { Exercise, ExerciseKind, ExerciseModule } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyModule = ExerciseModule<any>;

const REGISTRY: Partial<Record<ExerciseKind, AnyModule>> = {
  quiz_tg_ru: quizModule,
  quiz_ru_tg: quizModule,
  match_pairs: matchPairsModule,
  build_phrase: buildPhraseModule,
  letter_wheel: letterWheelModule,
};

export function moduleFor(kind: ExerciseKind): AnyModule | undefined {
  return REGISTRY[kind];
}

export function isSupported(kind: ExerciseKind): boolean {
  return REGISTRY[kind] !== undefined;
}

/** Заголовок над карточкой задания. */
export function titleFor(exercise: Exercise): string {
  return moduleFor(exercise.kind)?.title(exercise) ?? '';
}

export const SUPPORTED_KINDS = Object.keys(REGISTRY) as ExerciseKind[];
