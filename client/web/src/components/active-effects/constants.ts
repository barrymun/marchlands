import { BALANCE, BuffId } from '@marchlands/core';
import type { Slot } from '@/components/active-effects/types';
import { percent, resourceLabel } from '@/lib/format';
import { i18n } from '@/lib/i18n';

export const production = `+${percent(BALANCE.resourceBuffBonus)}`;

/** The slots by group; labels (and the Truce's "On") are in the current locale. */
export const GROUPS: { label: string; slots: Slot[] }[] = [
  {
    get label() {
      return i18n.t('active-effects:groups.production');
    },
    slots: [
      {
        buff: BuffId.FOOD_PRODUCTION,
        get label() {
          return resourceLabel('food');
        },
        boost: production,
      },
      {
        buff: BuffId.WOOD_PRODUCTION,
        get label() {
          return resourceLabel('wood');
        },
        boost: production,
      },
      {
        buff: BuffId.STONE_PRODUCTION,
        get label() {
          return resourceLabel('stone');
        },
        boost: production,
      },
      {
        buff: BuffId.IRON_PRODUCTION,
        get label() {
          return resourceLabel('iron');
        },
        boost: production,
      },
      {
        buff: BuffId.GOLD_PRODUCTION,
        get label() {
          return resourceLabel('gold');
        },
        boost: production,
      },
    ],
  },
  {
    get label() {
      return i18n.t('active-effects:groups.military');
    },
    slots: [
      {
        buff: BuffId.ATTACK,
        get label() {
          return i18n.t('active-effects:slots.attack');
        },
        boost: '+20%',
      },
      {
        buff: BuffId.DEFENSE,
        get label() {
          return i18n.t('active-effects:slots.defense');
        },
        boost: '+20%',
      },
      {
        buff: BuffId.TRAIN_COST_REDUCE,
        get label() {
          return i18n.t('active-effects:slots.training');
        },
        boost: `-${percent(BALANCE.trainCostReduction)}`,
      },
      {
        buff: BuffId.UPKEEP_REDUCE,
        get label() {
          return i18n.t('active-effects:slots.upkeep');
        },
        boost: '-50%',
      },
      {
        buff: BuffId.WAR_ENSIGN,
        get label() {
          return i18n.t('active-effects:slots.army');
        },
        boost: `+${percent(BALANCE.warEnsignTroopBonus)}`,
      },
    ],
  },
  {
    get label() {
      return i18n.t('active-effects:groups.other');
    },
    slots: [
      {
        buff: BuffId.BUILDING_QUEUE,
        get label() {
          return i18n.t('active-effects:slots.buildQueue');
        },
        boost: '+1',
      },
      {
        buff: BuffId.TRUCE,
        get label() {
          return i18n.t('active-effects:slots.truce');
        },
        get boost() {
          return i18n.t('active-effects:on');
        },
        extend: false,
        items: ['player.peace.1'],
      },
    ],
  },
];

export const SLOT_BUFFS = new Set<BuffId>(GROUPS.flatMap((g) => g.slots.map((s) => s.buff)));

/** A timer turns amber in its last day. */
export const WARN_MS = 24 * 3_600_000;

export const STORE_KEY = 'marchlands-effects-collapsed';
