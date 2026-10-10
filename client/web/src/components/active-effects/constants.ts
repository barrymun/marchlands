import { BALANCE, BuffId } from '@marchlands/core';
import type { Slot } from '@/components/active-effects/types';
import { percent } from '@/lib/format';

export const production = `+${percent(BALANCE.resourceBuffBonus)}`;

export const GROUPS: { label: string; slots: Slot[] }[] = [
  {
    label: 'Production',
    slots: [
      { buff: BuffId.FOOD_PRODUCTION, label: 'Food', boost: production },
      { buff: BuffId.WOOD_PRODUCTION, label: 'Lumber', boost: production },
      { buff: BuffId.STONE_PRODUCTION, label: 'Stone', boost: production },
      { buff: BuffId.IRON_PRODUCTION, label: 'Iron', boost: production },
      { buff: BuffId.GOLD_PRODUCTION, label: 'Gold', boost: production },
    ],
  },
  {
    label: 'Military',
    slots: [
      { buff: BuffId.ATTACK, label: 'Attack', boost: '+20%' },
      { buff: BuffId.DEFENSE, label: 'Defense', boost: '+20%' },
      { buff: BuffId.TRAIN_COST_REDUCE, label: 'Training', boost: `-${percent(BALANCE.trainCostReduction)}` },
      { buff: BuffId.UPKEEP_REDUCE, label: 'Upkeep', boost: '-50%' },
      { buff: BuffId.WAR_ENSIGN, label: 'Army', boost: `+${percent(BALANCE.warEnsignTroopBonus)}` },
    ],
  },
  {
    label: 'Other',
    slots: [
      { buff: BuffId.BUILDING_QUEUE, label: 'Build queue', boost: '+1' },
      { buff: BuffId.TRUCE, label: 'Truce', boost: 'On', extend: false, items: ['player.peace.1'] },
    ],
  },
];

export const SLOT_BUFFS = new Set<BuffId>(GROUPS.flatMap((g) => g.slots.map((s) => s.buff)));

/** Timed states that are not bonuses, shown as one line under the slots. */
export const OTHER_LABELS: Partial<Record<BuffId, string>> = {
  [BuffId.HOLIDAY]: 'Holiday',
  [BuffId.TRUCE_COOLDOWN]: 'Truce cooldown',
  [BuffId.TELEPORT_COOLDOWN]: 'Teleport cooldown',
};

/** A timer turns amber in its last day. */
export const WARN_MS = 24 * 3_600_000;

export const STORE_KEY = 'marchlands-effects-collapsed';
