/** Реестр мини-игр: тип задания -> модуль, который его показывает. */

import { alphabetIntroModule } from './exercises/alphabet-intro';
import { buildPhraseModule } from './exercises/build-phrase';
import { categorySortModule } from './exercises/category-sort';
import { dialogueModule } from './exercises/dialogue';
import { izafetModule } from './exercises/izafet';
import { letterWheelModule } from './exercises/letter-wheel';
import { matchPairsModule } from './exercises/match-pairs';
import { missingLetterModule } from './exercises/missing-letter';
import { numberWordModule } from './exercises/number-word';
import { oddOneOutModule } from './exercises/odd-one-out';
import { phraseIntroModule } from './exercises/phrase-intro';
import { quizModule } from './exercises/quiz';
import { ruleCardModule } from './exercises/rule-card';
import { trueFalseModule } from './exercises/true-false';
import { typePhraseModule } from './exercises/type-phrase';
import { typeWordModule } from './exercises/type-word';
import { wordIntroModule } from './exercises/word-intro';
import type { Exercise, ExerciseKind, ExerciseModule } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyModule = ExerciseModule<any>;

const REGISTRY: Partial<Record<ExerciseKind, AnyModule>> = {
  rule_card: ruleCardModule,
  word_intro: wordIntroModule,
  phrase_intro: phraseIntroModule,
  quiz_tg_ru: quizModule,
  quiz_ru_tg: quizModule,
  match_pairs: matchPairsModule,
  build_phrase: buildPhraseModule,
  letter_wheel: letterWheelModule,
  type_word: typeWordModule,
  type_phrase: typePhraseModule,
  missing_letter: missingLetterModule,
  true_false: trueFalseModule,
  alphabet_intro: alphabetIntroModule,
  odd_one_out: oddOneOutModule,
  dialogue_choice: dialogueModule,
  number_word: numberWordModule,
  category_sort: categorySortModule,
  izafet_builder: izafetModule,
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
