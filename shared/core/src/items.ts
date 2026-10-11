// Item effects. The original implemented only a handful of items (shop.useGoods /
// useCastleGoods / hero.useItem, speed-ups); the rest are defined here after Evony Age 1.
// Effects are declarative; the game service applies them.

import { z } from 'zod';
import { BALANCE, goldForCents } from './balance.ts';
import { experienceItemGain } from './heroes.ts';
import { DAY, HOUR } from './time.ts';
import { itemConfig } from './data/index.ts';
import { randInt, type Rng } from './rng.ts';
import { ResourceSetSchema, TroopCountsSchema, type ResourceSet, type TroopCounts } from './types.ts';
import { BuffId } from './constants.ts';
import { msg, ref, type Message } from './messages/index.ts';

export type ItemEffect =
  /** timed player buff (stacks by extending). `desc`: what it does, stored in the buff and worded by the client */
  | { kind: 'buff'; buff: BuffId; desc: Message; durationMs: number }
  /** immediate grant of items / resources (to the target city) / troops */
  | { kind: 'grant'; items?: Record<string, number>; resources?: Partial<ResourceSet>; troops?: TroopCounts }
  /** box opened with a key item */
  | { kind: 'chest'; key: string; contents: () => GrantContents }
  /** random contents */
  | { kind: 'box'; contents: (rng: Rng) => GrantContents }
  /** handled by a specific command (speed-ups, teleporters, hero items ...) */
  | { kind: 'command'; command: string }
  | { kind: 'special'; handler: 'civilCode' | 'cureInjured' | 'heroBox' };

export const GrantContentsSchema = z.object({
  items: z.record(z.string(), z.number().int()).optional().describe('itemId -> count'),
  resources: ResourceSetSchema.partial().optional(),
  troops: TroopCountsSchema.optional(),
});
export type GrantContents = z.infer<typeof GrantContentsSchema>;

const pct = (share: number) => Math.round(share * 100);
const BATTLE_BUFF_PERCENT = pct(BALANCE.battleBuffBonus);
const UPKEEP_BUFF_PERCENT = pct(BALANCE.upkeepBuffReduction);

/** What each kind of buff item does (stored in the buff, and the item description's effect). */
const production = (resource: 'food' | 'wood' | 'stone' | 'iron') =>
  msg('buff.production', { resource: ref.resource(resource), percent: pct(BALANCE.resourceBuffBonus) });
const BUFF_TEXT = {
  food: production('food'),
  wood: production('wood'),
  stone: production('stone'),
  iron: production('iron'),
  gold: msg('buff.goldIncome', { percent: pct(BALANCE.resourceBuffBonus) }),
  attack: msg('buff.troopAttack', { percent: BATTLE_BUFF_PERCENT }),
  defense: msg('buff.troopDefense', { percent: BATTLE_BUFF_PERCENT }),
  ensign: msg('buff.armySize', { percent: pct(BALANCE.warEnsignTroopBonus) }),
  queue: msg('buff.buildingQueue'),
  upkeep: msg('buff.upkeep', { percent: UPKEEP_BUFF_PERCENT }),
  trainCost: msg('buff.trainingCost', { percent: pct(BALANCE.trainCostReduction) }),
} satisfies Record<string, Message>;

const buff = (buffId: BuffId, desc: Message, durationMs: number): ItemEffect => ({ kind: 'buff', buff: buffId, desc, durationMs });

/** Medal boxes: the medal levels each holds, and how many of each (inclusive). */
export const MEDAL_BOXES: Record<string, readonly number[]> = {
  'player.box.special.1': [1, 2, 3],
  'player.box.special.2': [4, 5, 6],
  'player.box.special.3': [7, 8, 9],
};
export const MEDAL_BOX_COUNT = { min: 2, max: 4 };

/** Napoleon's Diary / Archimedes' Note: the share of a troop or fortification batch's total time they cut. */
export const BATCH_SPEEDUP_SHARE = 0.3;

/** Civil Code: adds this share of the city's maximum population, at least `min` people (capped at the maximum). */
export const CIVIL_CODE = { share: 0.2, min: 100 };

const EFFECTS: Record<string, ItemEffect> = {
  // ---- production buffs ----
  'player.resinc.1': buff(BuffId.FOOD_PRODUCTION, BUFF_TEXT.food, DAY),
  'player.resinc.1.b': buff(BuffId.FOOD_PRODUCTION, BUFF_TEXT.food, 7 * DAY),
  'player.resinc.2': buff(BuffId.WOOD_PRODUCTION, BUFF_TEXT.wood, DAY),
  'player.resinc.2.b': buff(BuffId.WOOD_PRODUCTION, BUFF_TEXT.wood, 7 * DAY),
  'player.resinc.3': buff(BuffId.STONE_PRODUCTION, BUFF_TEXT.stone, DAY),
  'player.resinc.3.b': buff(BuffId.STONE_PRODUCTION, BUFF_TEXT.stone, 7 * DAY),
  'player.resinc.4': buff(BuffId.IRON_PRODUCTION, BUFF_TEXT.iron, DAY),
  'player.resinc.4.b': buff(BuffId.IRON_PRODUCTION, BUFF_TEXT.iron, 7 * DAY),
  'player.gold.1.a': buff(BuffId.GOLD_PRODUCTION, BUFF_TEXT.gold, DAY),
  'player.gold.1.b': buff(BuffId.GOLD_PRODUCTION, BUFF_TEXT.gold, 7 * DAY),

  // ---- military buffs ----
  'player.attackinc.1': buff(BuffId.ATTACK, BUFF_TEXT.attack, DAY),
  'player.attackinc.1.b': buff(BuffId.ATTACK, BUFF_TEXT.attack, 7 * DAY),
  'player.defendinc.1': buff(BuffId.DEFENSE, BUFF_TEXT.defense, DAY),
  'player.defendinc.1.b': buff(BuffId.DEFENSE, BUFF_TEXT.defense, 7 * DAY),
  'player.troop.1.a': buff(BuffId.WAR_ENSIGN, BUFF_TEXT.ensign, DAY),
  'player.queue.building': buff(BuffId.BUILDING_QUEUE, BUFF_TEXT.queue, 7 * DAY),

  // ---- upkeep ----
  'player.reduce.troops.upkeep.1': buff(BuffId.UPKEEP_REDUCE, BUFF_TEXT.upkeep, DAY),
  'player.reduce.troops.upkeep.7': buff(BuffId.UPKEEP_REDUCE, BUFF_TEXT.upkeep, 7 * DAY),
  'player.reduce.troops.cost.1': buff(BuffId.TRAIN_COST_REDUCE, BUFF_TEXT.trainCost, DAY),
  'player.reduce.troops.cost.7': buff(BuffId.TRAIN_COST_REDUCE, BUFF_TEXT.trainCost, 7 * DAY),

  // ---- protection ----
  'player.peace.1': { kind: 'command', command: 'city.truce' },

  // ---- city items ----
  'player.pop.1.a': { kind: 'special', handler: 'civilCode' },
  'player.relive.1': { kind: 'special', handler: 'cureInjured' },

  // ---- boxes ----
  'player.box.special.1': { kind: 'box', contents: (rng) => medals(rng, MEDAL_BOXES['player.box.special.1']) },
  'player.box.special.2': { kind: 'box', contents: (rng) => medals(rng, MEDAL_BOXES['player.box.special.2']) },
  'player.box.special.3': { kind: 'box', contents: (rng) => medals(rng, MEDAL_BOXES['player.box.special.3']) },
  'player.box.currently.1': { kind: 'special', handler: 'heroBox' },
  'player.box.present.2': {
    kind: 'grant',
    items: { 'consume.2.a': 5, 'consume.2.b': 3 },
    resources: { food: 50_000, wood: 50_000, stone: 50_000, iron: 50_000 },
  },

  // ---- used through dedicated commands ----
  'consume.2.a': { kind: 'command', command: 'speedup' },
  'consume.2.b': { kind: 'command', command: 'speedup' },
  'consume.2.b.1': { kind: 'command', command: 'speedup' },
  'consume.2.c': { kind: 'command', command: 'speedup' },
  'consume.2.c.1': { kind: 'command', command: 'speedup' },
  'consume.2.d': { kind: 'command', command: 'speedup' },
  'player.troop.1.b': { kind: 'command', command: 'troops.speedup' },
  'player.fort.1.c': { kind: 'command', command: 'fortifications.speedup' },
  'consume.move.1': { kind: 'command', command: 'city.move' },
  'hero.reset.1': { kind: 'command', command: 'heroes.reset' },
  'hero.power.1': { kind: 'command', command: 'heroes.useItem' },
  'hero.management.1': { kind: 'command', command: 'heroes.useItem' },
  'hero.intelligence.1': { kind: 'command', command: 'heroes.useItem' },
  'player.experience.1.a': { kind: 'command', command: 'heroes.useItem' },
  'player.experience.1.b': { kind: 'command', command: 'heroes.useItem' },
  'player.experience.1.c': { kind: 'command', command: 'heroes.useItem' },
};
for (const l of [1, 2, 3, 4, 5, 6, 7, 8, 9]) EFFECTS[`hero.loyalty.${l}`] = { kind: 'command', command: 'heroes.useItem' };

function medals(rng: Rng, levels: readonly number[]): GrantContents {
  const items: Record<string, number> = {};
  for (const l of levels.slice(0, 3)) items[`hero.loyalty.${l}`] = randInt(rng, MEDAL_BOX_COUNT.min, MEDAL_BOX_COUNT.max);
  return { items };
}

/** Effect of using an item. */
export function itemEffect(itemId: string): ItemEffect | undefined {
  return EFFECTS[itemId];
}

/** Hero-attribute items (Excalibur etc.): +25% of the attribute for 24h as a buff bonus. */
export const HERO_ATTRIBUTE_ITEMS: Record<string, 'power' | 'management' | 'stratagem'> = {
  'hero.power.1': 'power',
  'hero.management.1': 'management',
  'hero.intelligence.1': 'stratagem',
};
export const HERO_ATTRIBUTE_BUFF = { bonus: 0.25, durationMs: DAY };
/** What a hero attribute boost does (heroes.buffs[].desc). */
export const heroBuffDesc = (attr: 'power' | 'management' | 'stratagem') =>
  msg('buff.heroStat', { stat: ref.stat(attr), percent: pct(HERO_ATTRIBUTE_BUFF.bonus) });
/** The army-size boost of the War Ensign (for battle reports). */
export const WAR_ENSIGN_DESC = BUFF_TEXT.ensign;

/** Hero box quality -> hero level and minimum base stat. */
export const HERO_BOX_QUALITY: Record<string, { level: number; minStat: number }> = {
  'player.box.currently.1': { level: 30, minStat: 55 },
};

export const TRUCE_DURATION_MS = 12 * HOUR;

/** Gold price of a hero item bought on use (BALANCE.heroItemGold), or null when it cannot be bought with gold. */
export function heroItemGoldPrice(itemId: string, upgradeExp: number): number | null {
  const gain = experienceItemGain(itemId, upgradeExp);
  if (gain > 0) return Math.ceil(gain * BALANCE.heroItemGold.perExp);
  if (itemId in HERO_ATTRIBUTE_ITEMS) return BALANCE.heroItemGold.attributeBoost;
  return null;
}

type BuffedHero = {
  power: number;
  management: number;
  stratagem: number;
  powerAdded: number;
  managementAdded: number;
  stratagemAdded: number;
  powerBuffAdded: number;
  managementBuffAdded: number;
  stratagemBuffAdded: number;
  buffs: { id: string; desc: Message; endTime: number; param?: number }[];
};

/** Points an attribute boost adds: HERO_ATTRIBUTE_BUFF.bonus of the attribute's points (gear included). */
export const heroBuffAmount = (attributePoints: number) => Math.ceil(attributePoints * HERO_ATTRIBUTE_BUFF.bonus);

/** The points an attribute boost works on: assigned points plus gear (marchlands: orig only the hero's own points). */
export const heroBuffBase = (h: Omit<BuffedHero, 'buffs'>, attr: 'power' | 'management' | 'stratagem') => h[attr] + h[`${attr}Added`];

/**
 * Keep active attribute boosts in step with the hero's current attributes (they grow as the hero
 * levels up, points are assigned and gear grows). Mutates the hero; returns true when anything changed.
 */
export function syncHeroBuffs(h: BuffedHero): boolean {
  let changed = false;
  h.buffs = h.buffs.map((b) => {
    const attr = b.id as 'power' | 'management' | 'stratagem';
    if (attr !== 'power' && attr !== 'management' && attr !== 'stratagem') return b;
    const amount = heroBuffAmount(heroBuffBase(h, attr));
    if (h[`${attr}BuffAdded`] !== amount) {
      h[`${attr}BuffAdded`] = amount;
      changed = true;
    }
    if (b.param === amount) return b;
    changed = true;
    return { ...b, param: amount };
  });
  return changed;
}

/** Medal item id of a level 1 (Cross) … 9 (Nation). */
export const medalId = (level: number) => `hero.loyalty.${Math.min(9, Math.max(1, level))}`;

/** Medal drop odds for a won attack on a city of `level` (BALANCE.medalDrops). */
export function medalOdds(level: number) {
  const c = BALANCE.medalDrops;
  const L = Math.min(10, Math.max(1, level));
  const chance = Math.min(1, c.base + c.perLevel * L);
  /** chance of a second medal once one dropped, and of a third once two did */
  const second = L >= c.secondFrom ? Math.min(1, (L - c.secondFrom + 1) * c.secondPerLevel) : 0;
  const third = L >= c.thirdFrom ? Math.min(1, (L - c.thirdFrom + 1) * c.thirdPerLevel) : 0;
  const main = [Math.max(1, L - 3), Math.max(1, Math.min(9, L - 1))] as const;
  return {
    chance,
    /** medal levels of the main drop */
    main,
    second,
    third,
    /** medal levels of the extra drops: every level below the main range, so no medal level is left out (level 10: 1-6 extra, 7-9 main) */
    extra: [1, Math.max(1, main[0] - 1)] as const,
  };
}

/**
 * Medals dropped by a won attack on a city of `level` (BALANCE.medalDrops): maybe one medal near the
 * city's level, and for very high cities one or two extra low-mid ones. Returns item id -> count.
 */
export function rollMedalDrops(level: number, rng: Rng): Record<string, number> {
  const o = medalOdds(level);
  const out: Record<string, number> = {};
  const add = (lvl: number) => {
    const id = medalId(lvl);
    out[id] = (out[id] ?? 0) + 1;
  };
  if (rng.next() >= o.chance) return out;
  add(randInt(rng, o.main[0], o.main[1]));
  if (o.second > 0 && rng.next() < o.second) {
    add(randInt(rng, o.extra[0], o.extra[1]));
    if (o.third > 0 && rng.next() < o.third) add(randInt(rng, o.extra[0], o.extra[1]));
  }
  return out;
}

/**
 * (marchlands) Gold price of an item in the shop (bought with a city's gold): its set price
 * (BALANCE.goldShop), or the original's cents price in gold (goldForCents); null when not for sale.
 */
export function itemGoldPrice(itemId: string): number | null {
  const set = BALANCE.goldShop[itemId];
  if (set != null) return set;
  const cfg = itemConfig(itemId);
  return cfg?.buyable && cfg.cost > 0 ? goldForCents(cfg.cost) : null;
}
