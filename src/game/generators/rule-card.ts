/**
 * Карточка правила. Ставится в начале раздела, до первых заданий.
 *
 * Без неё грамматика существовала только внутри упражнений: игрок собирал
 * «падари ман», нигде не прочитав, что определение в таджикском идёт после
 * определяемого. Догадаться можно, но это не обучение, а разгадывание.
 */

import type { Rule } from '../../data/content';
import type { RuleCardExercise } from '../types';

export function makeRuleCard(rule: Rule): RuleCardExercise {
  return {
    kind: 'rule_card',
    // правило не про конкретные слова — в статистику повторения не идёт
    wordIds: [],
    title: rule.title,
    body: rule.body,
    examples: rule.examples.map((e) => ({ tg: e.tg, ru: e.ru })),
  };
}
