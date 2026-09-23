/**
 * Открытие узлов дерева. Что за узлы — в tree-nodes.ts.
 */

import type { SaveState } from '../data/state';
import { applyPerks } from './bonuses';
import { getNode, isNodeOwned, parentsOwned, taskDone } from './tree-nodes';

export type UnlockResult =
  | 'ok'
  | 'no-such-node'
  | 'owned'
  | 'locked'
  | 'task'
  | 'not-enough-coins'
  | 'not-enough-gems';

export function canUnlock(state: SaveState, id: string): UnlockResult {
  const node = getNode(id);
  if (!node) return 'no-such-node';
  if (isNodeOwned(state, id)) return 'owned';
  if (!parentsOwned(state, node)) return 'locked';
  if (!taskDone(state, node.task)) return 'task';
  if (state.wallet.coins < node.coins) return 'not-enough-coins';
  if (state.wallet.gems < node.gems) return 'not-enough-gems';
  return 'ok';
}

/**
 * Открывает узел: списывает цену и сразу применяет бонус.
 * «Запасное сердце» должно добавить жизнь в ту же секунду, а не после перезапуска.
 */
export function unlockNode(state: SaveState, id: string, ts: number): UnlockResult {
  const check = canUnlock(state, id);
  if (check !== 'ok') return check;
  const node = getNode(id)!;
  state.wallet.coins -= node.coins;
  state.wallet.gems -= node.gems;
  state.tree[id] = ts;
  applyPerks(state, ts);
  return 'ok';
}
