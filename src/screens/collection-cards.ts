/**
 * Коллекция: вехи собирательства и награды за них.
 *
 * Выполненная веха не начисляется молча — её забирают кнопкой, и если
 * в награде лона или караван, они тут же и открываются: забрать награду —
 * маленький праздник, а не строчка в журнале.
 */

import { h } from '../core/dom';
import { haptics } from '../core/haptics';
import { rngFor } from '../core/rng';
import { getState, update } from '../core/store';
import { now, plural } from '../core/time';
import type { SaveState } from '../data/state';
import { COLLECTION, claimGoal, goalStatus, type Claimed, type CollectionGoal, type CollectionReward } from '../domain/collection';
import { getGearChest } from '../domain/gear-items';
import { getPetChest } from '../domain/pets';
import { button } from '../ui/button';
import { icon, type IconName } from '../ui/icons';
import { toast } from '../ui/toast';
import { showDrops } from './gear-cards';
import { showPetDrop } from './pet-cards';

/** «Лона и 500 монет» — чем наградят. */
export function rewardWords(reward: CollectionReward): string {
  const parts: string[] = [];
  if (reward.nest) parts.push(getPetChest(reward.nest)?.title ?? 'лона');
  if (reward.chest) parts.push(getGearChest(reward.chest)?.title ?? 'сундук');
  if (reward.shards) parts.push(reward.shards + ' ' + plural(reward.shards, 'осколок', 'осколка', 'осколков'));
  if (reward.coins) parts.push(reward.coins + ' ' + plural(reward.coins, 'монета', 'монеты', 'монет'));
  return parts.join(' и ');
}

function celebrate(got: Claimed): void {
  haptics.levelUp();
  const title = 'Награда: ' + got.goal.title.toLowerCase();
  const loose: string[] = [];
  if (got.coins > 0) loose.push('+' + got.coins + ' монет');
  if (got.shards > 0) loose.push('+' + got.shards + ' ' + plural(got.shards, 'осколок', 'осколка', 'осколков'));
  if (loose.length > 0) toast({ text: loose.join(', '), iconName: got.coins > 0 ? 'coin' : 'shards', tone: 'gold' });
  // лона и сундук открываются тут же — так видно, что именно досталось
  if (got.petDrop) showPetDrop(got.petDrop, title);
  else if (got.gearDrops) showDrops(title, got.gearDrops);
}

function goalRow(state: SaveState, goal: CollectionGoal): HTMLElement {
  const status = goalStatus(state, goal);
  const have = Math.min(goal.n, goal.progress(state));
  const right =
    status === 'ready'
      ? button({
          label: 'Забрать',
          tone: 'green',
          size: 'sm',
          onTap: () => {
            let got: Claimed | null = null;
            update((s) => {
              got = claimGoal(s, goal.id, rngFor('collection:' + goal.id + ':' + now()), now());
            });
            if (got) celebrate(got);
          },
        })
      : status === 'claimed'
        ? h('span', { class: 'cgoal__done' }, icon('check'))
        : null;

  return h(
    'div',
    { class: 'cgoal is-' + status },
    h('span', { class: 'cgoal__icon' }, icon(goal.icon as IconName)),
    h(
      'div',
      { class: 'cgoal__text' },
      h('div', { class: 'cgoal__title', text: goal.title }),
      status === 'claimed'
        ? h('div', { class: 'cgoal__reward', text: 'получено: ' + rewardWords(goal.reward) })
        : h(
            'div',
            { class: 'cgoal__progress' },
            h(
              'span',
              { class: 'cgoal__bar' },
              h('span', { class: 'cgoal__fill', style: { transform: 'scaleX(' + (goal.n > 0 ? have / goal.n : 1) + ')' } }),
            ),
            h('span', { class: 'cgoal__count', text: have + ' / ' + goal.n }),
          ),
      status === 'claimed' ? null : h('div', { class: 'cgoal__reward', text: 'награда: ' + rewardWords(goal.reward) }),
    ),
    right,
  );
}

/** Вехи по порядку: сначала то, что можно забрать, потом начатое, в конце — полученное. */
export function collectionRows(): HTMLElement[] {
  const state = getState();
  const order = { ready: 0, progress: 1, claimed: 2 } as const;
  return [...COLLECTION]
    .sort((a, b) => order[goalStatus(state, a)] - order[goalStatus(state, b)])
    .map((goal) => goalRow(state, goal));
}
