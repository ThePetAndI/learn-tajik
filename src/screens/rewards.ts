/**
 * Дневные награды и окно жизней: сундук, колесо удачи, «жизни кончились».
 */

import { h, onTap, s, sleep } from '../core/dom';
import { haptics } from '../core/haptics';
import { rngFor } from '../core/rng';
import { getState, update } from '../core/store';
import { formatDuration, now } from '../core/time';
import {
  WHEEL_SECTORS,
  canOpenChest,
  canSpinWheel,
  chestOpenedToday,
  openChest,
  spinWheel,
  wheelSpunToday,
  type Reward,
} from '../domain/daily';
import { computeLives, refillLives } from '../domain/lives';
import { hasRecoveryMaterial } from '../domain/recovery';
import { boosterCount, getItem, useBooster } from '../domain/shop';
import { dailyGoalReached, todayCount } from '../domain/streak';
import { button } from '../ui/button';
import { confetti } from '../ui/confetti';
import { icon, type IconName } from '../ui/icons';
import { modal } from '../ui/modal';
import { toast } from '../ui/toast';
import { openRecovery } from './recovery';

function rewardIcon(reward: Reward): IconName {
  switch (reward.kind) {
    case 'coins':
      return 'coin';
    case 'life':
    case 'lives_full':
      return 'heart';
    case 'freeze':
      return 'sparkle';
    case 'booster':
      return (getItem(reward.itemId ?? '')?.icon as IconName) ?? 'bulb';
  }
}

function rewardTitle(reward: Reward): string {
  switch (reward.kind) {
    case 'coins':
      return '+' + reward.amount + ' монет';
    case 'life':
      return '+' + reward.amount + ' жизнь';
    case 'lives_full':
      return 'Полный запас жизней';
    case 'freeze':
      return 'Заморозка стрика';
    case 'booster':
      return getItem(reward.itemId ?? '')?.title ?? reward.label;
  }
}

/* ————————————————————————— сундук ————————————————————————— */

export function openChestModal(): void {
  const state = getState();
  const ts = now();

  if (chestOpenedToday(state, ts)) {
    modal({
      title: 'Сундук уже открыт',
      text: 'Следующий — завтра. Выполни дневную цель, и он снова появится.',
      actions: [{ label: 'Понятно', tone: 'orange', value: 'ok', primary: true }],
    });
    return;
  }

  if (!dailyGoalReached(state, ts)) {
    const done = todayCount(state, ts);
    const goal = state.settings.dailyGoal;
    modal({
      title: 'Сундук закрыт',
      text:
        'Сегодня сделано упражнений: ' + done + ' из ' + goal +
        '. Выполни дневную цель — и сундук откроется.',
      actions: [{ label: 'Понятно', tone: 'orange', value: 'ok', primary: true }],
    });
    return;
  }

  const chest = h('button', { class: 'chest', attr: { type: 'button' }, aria: { label: 'Открыть сундук' } }, icon('chest'));
  const prize = h('div', { class: 'prize' });
  const body = h('div', { class: 'reward-body' }, chest, prize);
  const m = modal({ title: 'Дневной сундук', text: 'Нажми, чтобы открыть', body, closeButton: true });

  let opened = false;
  onTap(chest, () => {
    if (opened) return;
    opened = true;
    chest.classList.add('is-open');
    haptics.reward();

    let reward: Reward | null = null;
    update((st) => {
      reward = openChest(st, rngFor('chest:' + ts), now());
    });
    if (!reward) {
      m.close(null);
      return;
    }
    const got = reward as Reward;

    void sleep(280).then(() => {
      prize.replaceChildren(
        h('span', { class: 'prize__icon' }, icon(rewardIcon(got))),
        h('span', { class: 'prize__title', text: rewardTitle(got) }),
      );
      prize.classList.add('is-shown');
      const rect = chest.getBoundingClientRect();
      confetti({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      body.append(
        button({ label: 'Забрать', tone: 'green', size: 'big', wide: true, onTap: () => m.close('ok') }),
      );
    });
  });
}

/* ————————————————————————— колесо удачи ————————————————————————— */

const SECTOR_ANGLE = 360 / WHEEL_SECTORS.length;

function labelRotation(index: number): number {
  const angle = index * SECTOR_ANGLE;
  return angle > 90 && angle < 270 ? angle + 180 : angle;
}

function wheelSvg(): SVGSVGElement {
  const svg = s('svg', { class: 'wheel-fortune__disc', viewBox: '0 0 200 200' });
  const colors = ['#ffb84d', '#ff8fc0', '#7fd3ff', '#8fe36b', '#ffd12e', '#b98bff', '#ff9182', '#7ceccd'];
  WHEEL_SECTORS.forEach((sector, i) => {
    const a0 = ((i * SECTOR_ANGLE - 90 - SECTOR_ANGLE / 2) * Math.PI) / 180;
    const a1 = (((i + 1) * SECTOR_ANGLE - 90 - SECTOR_ANGLE / 2) * Math.PI) / 180;
    const x0 = 100 + 96 * Math.cos(a0);
    const y0 = 100 + 96 * Math.sin(a0);
    const x1 = 100 + 96 * Math.cos(a1);
    const y1 = 100 + 96 * Math.sin(a1);
    svg.append(
      s('path', {
        d: 'M100 100 L' + x0.toFixed(1) + ' ' + y0.toFixed(1) + ' A96 96 0 0 1 ' + x1.toFixed(1) + ' ' + y1.toFixed(1) + ' Z',
        fill: colors[i % colors.length] as string,
        stroke: '#fff',
        'stroke-width': '2',
      }),
    );
    const mid = (a0 + a1) / 2;
    const tx = 100 + 62 * Math.cos(mid);
    const ty = 100 + 62 * Math.sin(mid);
    const label = s(
      'text',
      {
        x: tx.toFixed(1),
        y: ty.toFixed(1),
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
        class: 'wheel-fortune__label',
        // подписи следуют за сектором, но в нижней половине переворачиваются,
        // иначе их пришлось бы читать вверх ногами
        transform:
          'rotate(' + labelRotation(i) + ' ' + tx.toFixed(1) + ' ' + ty.toFixed(1) + ')',
      },
      sector.label,
    );
    svg.append(label);
  });
  svg.append(s('circle', { cx: '100', cy: '100', r: '16', fill: '#fff', stroke: '#e3d8ff', 'stroke-width': '3' }));
  return svg;
}

export function openWheelModal(): void {
  const ts = now();
  if (wheelSpunToday(getState(), ts)) {
    modal({
      title: 'Колесо уже крутили',
      text: 'Приходи завтра — будет новый бросок.',
      actions: [{ label: 'Понятно', tone: 'orange', value: 'ok', primary: true }],
    });
    return;
  }

  const disc = wheelSvg();
  const wrap = h('div', { class: 'wheel-fortune' }, h('span', { class: 'wheel-fortune__pin' }), disc);
  const prize = h('div', { class: 'prize' });
  const spinBtn = button({ label: 'Крутить!', tone: 'orange', size: 'big', wide: true });
  const body = h('div', { class: 'reward-body' }, wrap, prize, spinBtn);
  const m = modal({ title: 'Колесо удачи', text: 'Раз в день — бесплатно', body, closeButton: true });

  let spun = false;
  onTap(spinBtn, () => {
    if (spun) return;
    spun = true;
    spinBtn.disabled = true;
    haptics.tap();

    let result: { index: number; reward: Reward } | null = null;
    update((st) => {
      result = spinWheel(st, rngFor('wheel:' + ts), now());
    });
    if (!result) {
      m.close(null);
      return;
    }
    const { index, reward } = result as { index: number; reward: Reward };

    // пять полных оборотов и остановка на выпавшем секторе
    const target = 360 * 5 - index * SECTOR_ANGLE;
    disc.style.transition = 'transform 3.4s cubic-bezier(0.17, 0.85, 0.3, 1)';
    requestAnimationFrame(() => {
      disc.style.transform = 'rotate(' + target + 'deg)';
    });

    void sleep(3500).then(() => {
      haptics.reward();
      prize.replaceChildren(
        h('span', { class: 'prize__icon' }, icon(rewardIcon(reward))),
        h('span', { class: 'prize__title', text: rewardTitle(reward) }),
      );
      prize.classList.add('is-shown');
      const rect = wrap.getBoundingClientRect();
      confetti({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      spinBtn.replaceWith(
        button({ label: 'Забрать', tone: 'green', size: 'big', wide: true, onTap: () => m.close('ok') }),
      );
    });
  });
}

/* ————————————————————————— жизни ————————————————————————— */

export function openLivesModal(): void {
  const ts = now();
  const state = getState();
  const lives = computeLives(state.lives, ts);

  const hearts = h(
    'div',
    { class: 'lives-modal__hearts' },
    ...Array.from({ length: lives.max }, (_, i) =>
      h(
        'span',
        { class: 'lives-modal__heart ' + (i < lives.count ? 'is-on' : 'is-off') },
        icon(i < lives.count ? 'heart' : 'heartEmpty'),
      ),
    ),
  );

  const timer = h('div', {
    class: 'lives-modal__timer',
    text: lives.full
      ? 'Запас полон'
      : 'Следующая жизнь через ' + formatDuration(lives.msToNext),
  });

  const body = h('div', { class: 'lives-modal' }, hearts, timer);
  const m = modal({
    title: lives.count === 0 ? 'Жизни кончились' : 'Жизни',
    text:
      lives.count === 0
        ? 'Верни их в «Восстановлении» — это быстрее, чем ждать.'
        : 'Ошибка стоит одной жизни. Одна жизнь восстанавливается за полчаса.',
    body,
    closeButton: true,
  });

  const actions = h('div', { class: 'modal__actions' });

  if (hasRecoveryMaterial(state, ts) && !lives.full) {
    actions.append(
      button({
        label: 'Восстановление',
        sub: 'повторить трудные слова',
        tone: 'green',
        size: 'big',
        wide: true,
        onTap: () => {
          m.close('recovery');
          openRecovery();
        },
      }),
    );
  }

  const refills = boosterCount(state, 'refill');
  if (!lives.full && refills > 0) {
    actions.append(
      button({
        label: 'Полный запас (×' + refills + ')',
        tone: 'red',
        wide: true,
        onTap: () => {
          update((st) => {
            if (useBooster(st, 'refill')) refillLives(st, now());
          });
          haptics.reward();
          toast({ text: 'Жизни восстановлены', iconName: 'heart', tone: 'good' });
          m.close('refill');
        },
      }),
    );
  }

  actions.append(button({ label: 'Закрыть', tone: 'white', wide: true, onTap: () => m.close(null) }));
  body.append(actions);

  // обратный отсчёт тикает, пока окно открыто
  if (!lives.full) {
    const id = window.setInterval(() => {
      if (!body.isConnected) {
        clearInterval(id);
        return;
      }
      const cur = computeLives(getState().lives, now());
      timer.textContent = cur.full
        ? 'Запас полон'
        : 'Следующая жизнь через ' + formatDuration(cur.msToNext);
    }, 1000);
  }
}

/** Сундук и колесо доступны? Нужно для точки-индикатора на вкладках. */
export function hasDailyReward(): boolean {
  const ts = now();
  const state = getState();
  return canOpenChest(state, ts) || canSpinWheel(state, ts);
}
