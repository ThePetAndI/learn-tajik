/**
 * Деревья прокачки — экран вкладки «Древо».
 *
 * Деревьев три: Дониш (учёба), Ҳайвонот (питомцы), Бозор (лавка и угощения).
 * Переключатель сверху, как половины магазина. Бонусы всех деревьев
 * складываются вместе — переключатель только выбирает, какое показать.
 *
 * Узлы стоят по сетке: колонки — ветки, ряд — глубина. Горизонталь задана
 * в процентах, вертикаль — в пикселях: так дерево тянется по ширине любого
 * телефона, а рёбра, нарисованные в SVG с той же системой координат (viewBox
 * по ширине — 100 единиц), совпадают с узлами без пересчёта при повороте.
 *
 * Рёбра — кривые, а не прямые: прямоугольная схема читается как блок-схема
 * из учебника, дерево должно ветвиться.
 */

import { h, onTap, s } from '../core/dom';
import { haptics } from '../core/haptics';
import type { ScreenView } from '../core/router';
import { getState, subscribe, update } from '../core/store';
import { now, plural } from '../core/time';
import { perkLabels } from '../domain/perks';
import { canUnlock, unlockNode } from '../domain/tree';
import {
  TREES,
  getBranch,
  getNode,
  getTree,
  nodeStatus,
  taskLabel,
  taskProgress,
  treeProgress,
  type NodeStatus,
  type TreeDef,
  type TreeId,
  type TreeNode,
} from '../domain/tree-nodes';
import { button } from '../ui/button';
import { confetti } from '../ui/confetti';
import { icon, type IconName } from '../ui/icons';
import { modal } from '../ui/modal';
import { toast } from '../ui/toast';

/** Расстояние между рядами и отступы холста, в пикселях. */
const ROW_H = 124;
const TOP = 58;
const BOTTOM = 96;
/** Радиус кружка узла — рёбра начинаются и кончаются на его краю, а не в центре. */
const ORB_R = 30;

function toneOf(node: TreeNode): string {
  return getBranch(node.branch)?.tone ?? 'green';
}

function heightOf(def: TreeDef): number {
  const rows = Math.max(...def.nodes.map((n) => n.row)) + 1;
  return TOP + (rows - 1) * ROW_H + BOTTOM;
}

/** Центр узла: x — в процентах ширины, y — в пикселях. */
function center(node: TreeNode, cols: number): { x: number; y: number } {
  return { x: ((node.col + 0.5) / cols) * 100, y: TOP + node.row * ROW_H };
}

/* ————————————————————————— рёбра ————————————————————————— */

type EdgeState = 'owned' | 'open' | 'locked';

function edgePath(from: TreeNode, to: TreeNode, cols: number): string {
  const a = center(from, cols);
  const b = center(to, cols);
  const y1 = a.y + ORB_R;
  const y2 = b.y - ORB_R - 8;
  const bend = (y2 - y1) * 0.55;
  return (
    'M' + a.x.toFixed(2) + ' ' + y1 +
    ' C' + a.x.toFixed(2) + ' ' + (y1 + bend) +
    ' ' + b.x.toFixed(2) + ' ' + (y2 - bend) +
    ' ' + b.x.toFixed(2) + ' ' + y2
  );
}

function edgeState(from: NodeStatus, to: NodeStatus): EdgeState {
  if (from === 'owned' && to === 'owned') return 'owned';
  if (from === 'owned') return 'open';
  return 'locked';
}

/* ————————————————————————— подпись цены ————————————————————————— */

function costChips(node: TreeNode, coins: number, gems: number): HTMLElement {
  return h(
    'span',
    { class: 'tnode__cost' },
    node.coins > 0
      ? h(
          'span',
          { class: 'tcost' + (coins < node.coins ? ' is-short' : '') },
          icon('coin'),
          h('span', { text: String(node.coins) }),
        )
      : null,
    node.gems > 0
      ? h(
          'span',
          { class: 'tcost tcost--gem' + (gems < node.gems ? ' is-short' : '') },
          icon('gem'),
          h('span', { text: String(node.gems) }),
        )
      : null,
  );
}

const BADGE: Partial<Record<NodeStatus, IconName>> = {
  owned: 'check',
  task: 'target',
  locked: 'lock',
};

/* ————————————————————————— карточка узла ————————————————————————— */

function openNodeSheet(node: TreeNode, onUnlocked: (node: TreeNode) => void): void {
  const state = getState();
  const status = nodeStatus(state, node);
  const branch = getBranch(node.branch);
  const perks = perkLabels(node.perks);

  const parents = node.parents
    .map(getNode)
    .filter((p): p is TreeNode => Boolean(p))
    .map((p) => ({ node: p, owned: nodeStatus(state, p) === 'owned' }));

  const task = node.task;
  const have = task ? Math.min(task.n, taskProgress(state, task)) : 0;

  const body = h(
    'div',
    { class: 'tsheet t-' + toneOf(node) },
    h(
      'div',
      { class: 'tsheet__head' },
      h('span', { class: 'tsheet__orb' + (status === 'owned' ? ' is-owned' : '') }, icon(node.icon as IconName)),
      h(
        'div',
        { class: 'tsheet__names' },
        h('div', { class: 'tsheet__title', text: node.title }),
        h('div', {
          class: 'tsheet__branch',
          text: branch ? branch.title + ' · ' + branch.ru : node.row === 0 ? 'корень дерева' : 'вершина дерева',
        }),
      ),
    ),
    h('p', { class: 'tsheet__flavor', text: node.flavor }),
    h(
      'div',
      { class: 'tsheet__perks' },
      ...perks.map((label) => h('span', { class: 'tsheet__perk' }, icon('up'), h('span', { text: label }))),
    ),

    // что нужно, чтобы открыть: родители и задание
    status === 'owned'
      ? h('div', { class: 'tsheet__done' }, icon('check'), h('span', { text: 'Открыто' }))
      : h(
          'div',
          { class: 'tsheet__needs' },
          ...parents.map((p) =>
            h(
              'div',
              { class: 'tneed' + (p.owned ? ' is-met' : '') },
              icon(p.owned ? 'check' : 'lock'),
              h('span', { text: 'Сначала: ' + p.node.title }),
            ),
          ),
          task
            ? h(
                'div',
                { class: 'tneed tneed--task' + (have >= task.n ? ' is-met' : '') },
                icon(have >= task.n ? 'check' : 'target'),
                h(
                  'span',
                  { class: 'tneed__text' },
                  h('span', { text: taskLabel(task) }),
                  h(
                    'span',
                    { class: 'tneed__bar' },
                    h('span', {
                      class: 'tneed__fill',
                      style: { transform: 'scaleX(' + (task.n > 0 ? have / task.n : 1) + ')' },
                    }),
                  ),
                  h('span', { class: 'tneed__count', text: have + ' / ' + task.n }),
                ),
              )
            : null,
        ),
  );

  const actions: HTMLElement[] = [];
  if (status !== 'owned') {
    const check = canUnlock(state, node.id);
    const priceText =
      (node.coins > 0 ? node.coins + ' ' + plural(node.coins, 'монета', 'монеты', 'монет') : '') +
      (node.coins > 0 && node.gems > 0 ? ' и ' : '') +
      (node.gems > 0 ? node.gems + ' лаъл' : '');
    const reason: Record<string, string> = {
      locked: 'Сначала узлы выше',
      task: 'Сначала задание',
      'not-enough-coins': 'Не хватает монет',
      'not-enough-gems': 'Не хватает лаъл',
    };
    const btn = button({
      label: check === 'ok' ? 'Открыть' : (reason[check] ?? 'Недоступно'),
      sub: check === 'ok' || check === 'not-enough-coins' || check === 'not-enough-gems' ? priceText : undefined,
      tone: check === 'ok' ? 'green' : 'lock',
      size: 'big',
      wide: true,
      disabled: check !== 'ok',
    });
    actions.push(btn);
    onTap(btn, () => {
      let result = canUnlock(getState(), node.id);
      if (result !== 'ok') return;
      update((st) => {
        result = unlockNode(st, node.id, now());
      });
      if (result !== 'ok') return;
      m.close('ok');
      onUnlocked(node);
    });
  }

  const m = modal({ body: h('div', {}, body, ...actions), closeButton: true, class: 'modal__card--tree' });
}

/* ————————————————————————— одно дерево ————————————————————————— */

interface TreeView {
  def: TreeDef;
  heads: HTMLElement;
  canvas: HTMLElement;
  render: () => void;
}

function buildTree(def: TreeDef): TreeView {
  const cols = def.branches.length;
  const height = heightOf(def);
  const edgesLayer = s('svg', {
    class: 'tree__edges',
    viewBox: '0 0 100 ' + height,
    preserveAspectRatio: 'none',
    'aria-hidden': 'true',
  });

  const nodeEls = new Map<string, HTMLButtonElement>();
  const canvas = h('div', { class: 'tree__canvas', style: { height: height + 'px' } }, edgesLayer);

  /** Праздник на открытие: вспышка на узле и тост с тем, что он дал. */
  function celebrate(node: TreeNode): void {
    haptics.levelUp();
    const el = nodeEls.get(node.id);
    if (el) {
      el.classList.remove('is-fresh');
      void el.offsetWidth;
      el.classList.add('is-fresh');
      const rect = el.getBoundingClientRect();
      confetti({ x: rect.left + rect.width / 2, y: rect.top + ORB_R });
    }
    toast({ text: node.title + ': ' + perkLabels(node.perks).join(', '), iconName: 'up', tone: 'gold', ms: 3200 });
  }

  for (const node of def.nodes) {
    const c = center(node, cols);
    const btn = h('button', {
      class: 'tnode t-' + toneOf(node) + (node.branch === null ? ' tnode--big' : ''),
      attr: { type: 'button' },
      data: { node: node.id },
      aria: { label: node.title },
      style: { left: c.x + '%', top: c.y + 'px' },
    });
    onTap(btn, () => {
      haptics.tap();
      openNodeSheet(node, celebrate);
    });
    nodeEls.set(node.id, btn);
    canvas.append(btn);
  }

  function render(): void {
    const state = getState();
    const status = new Map(def.nodes.map((n) => [n.id, nodeStatus(state, n)]));

    // рёбра: сначала закрытые, поверх — открытые, чтобы открытый путь не прятался
    const edges: { d: string; st: EdgeState; tone: string }[] = [];
    for (const node of def.nodes) {
      for (const pid of node.parents) {
        const parent = getNode(pid);
        if (!parent) continue;
        edges.push({
          d: edgePath(parent, node, cols),
          st: edgeState(status.get(pid) ?? 'locked', status.get(node.id) ?? 'locked'),
          tone: toneOf(node.branch ? node : parent),
        });
      }
    }
    const order: Record<EdgeState, number> = { locked: 0, open: 1, owned: 2 };
    edges.sort((a, b) => order[a.st] - order[b.st]);
    edgesLayer.replaceChildren(
      ...edges.map((e) =>
        s('path', {
          d: e.d,
          class: 'tedge is-' + e.st + ' t-' + e.tone,
          'vector-effect': 'non-scaling-stroke',
        }),
      ),
    );

    for (const node of def.nodes) {
      const el = nodeEls.get(node.id);
      if (!el) continue;
      const st = status.get(node.id) ?? 'locked';
      el.classList.remove('is-owned', 'is-ready', 'is-poor', 'is-task', 'is-locked');
      el.classList.add('is-' + st);
      const badge = BADGE[st];
      const parts: Node[] = [
        h(
          'span',
          { class: 'tnode__orb' },
          icon(node.icon as IconName),
          badge ? h('span', { class: 'tnode__badge' }, icon(badge)) : null,
        ),
        h('span', { class: 'tnode__title', text: node.title }),
      ];
      // у открытого узла цена уже не нужна
      if (st !== 'owned') parts.push(costChips(node, state.wallet.coins, state.wallet.gems));
      el.replaceChildren(...parts);
    }
  }

  const heads = h(
    'div',
    { class: 'tree__branches' },
    ...def.branches.map((b) =>
      h(
        'div',
        { class: 'tbranch t-' + b.tone },
        h('span', { class: 'tbranch__icon' }, icon(b.icon as IconName)),
        h('span', { class: 'tbranch__title', text: b.title }),
        h('span', { class: 'tbranch__ru', text: b.ru }),
      ),
    ),
  );

  return { def, heads, canvas, render };
}

/* ————————————————————————— экран ————————————————————————— */

/** Какое дерево открыто — между заходами на вкладку оно запоминается. */
let currentTree: TreeId = 'donish';

export function createTreeScreen(): ScreenView {
  const title = h('span');
  const intro = h('p', { class: 'p tree__intro' });
  const body = h('div', { class: 'screen-body tree__body' });
  const views = new Map<TreeId, TreeView>();
  const segButtons = new Map<TreeId, HTMLButtonElement>();

  function viewOf(id: TreeId): TreeView {
    let view = views.get(id);
    if (!view) {
      view = buildTree(getTree(id));
      views.set(id, view);
    }
    return view;
  }

  function render(): void {
    const state = getState();
    viewOf(currentTree).render();
    // на кнопке дерева — сколько узлов в нём открыто: видно, где ещё не начинали
    for (const [id, btn] of segButtons) {
      const q = treeProgress(state, id);
      const count = btn.querySelector('.segbar__count');
      if (count) count.textContent = q.owned + '/' + q.total;
    }
  }

  function show(id: TreeId): void {
    currentTree = id;
    const view = viewOf(id);
    title.textContent = view.def.title;
    intro.textContent = view.def.intro;
    body.style.setProperty('--cols', String(view.def.branches.length));
    body.replaceChildren(intro, view.heads, view.canvas);
    body.scrollTop = 0;
    for (const [tid, btn] of segButtons) {
      btn.classList.toggle('is-active', tid === id);
      btn.setAttribute('aria-selected', tid === id ? 'true' : 'false');
    }
    render();
  }

  const segBar = h(
    'div',
    { class: 'segbar segbar--3', aria: { role: 'tablist' } },
    ...TREES.map((def) => {
      const btn = h(
        'button',
        { class: 'segbar__btn', attr: { type: 'button' }, aria: { role: 'tab' } },
        icon(def.icon as IconName),
        h('span', { class: 'segbar__label' }, h('span', { text: def.short }), h('span', { class: 'segbar__count' })),
      );
      onTap(btn, () => {
        if (currentTree === def.id) return;
        haptics.tap();
        show(def.id);
      });
      segButtons.set(def.id, btn);
      return btn;
    }),
  );

  const el = h(
    'div',
    { class: 'screen screen--tree' },
    h(
      'header',
      { class: 'topbar topbar--seg' },
      h('div', { class: 'topbar__title tree__title' }, title),
      segBar,
    ),
    body,
  );

  const unsub = subscribe(render);
  show(currentTree);

  return {
    el,
    onShow: render,
    destroy: () => unsub(),
  };
}

