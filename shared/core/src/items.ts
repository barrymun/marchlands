// Item effects. The original implemented only a handful of items (shop.useGoods /
// useCastleGoods / hero.useItem, speed-ups); the rest are defined here after Evony Age 1.
// Effects are declarative; the game service applies them.

import { BALANCE, goldForCents } from '#/balance.ts';
import { BuffId } from '#/constants.ts';
import { itemConfig } from '#/data/index.ts';
import { createRandomHero, experienceItemGain, type GeneratedHero, upgradeExpFor } from '#/heroes.ts';
import { ItemId } from '#/item-ids.ts';
import { type Message, msg, ref, share } from '#/messages/index.ts';
import { randInt, type Rng } from '#/rng.ts';
import type { GrantContents, ResourceSet, TroopCounts } from '#/types.ts';

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

const pct = share;
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

const { buffDurationMs: BUFF_MS, medalBoxes: MEDAL_BOXES } = BALANCE.items;

const EFFECTS: Record<string, ItemEffect> = {
  // ---- production buffs ----
  [ItemId.PLOWSHARES]: buff(BuffId.FOOD_PRODUCTION, BUFF_TEXT.food, BUFF_MS.short),
  [ItemId.IRON_RAKE]: buff(BuffId.FOOD_PRODUCTION, BUFF_TEXT.food, BUFF_MS.long),
  [ItemId.ARCH_SAW]: buff(BuffId.WOOD_PRODUCTION, BUFF_TEXT.wood, BUFF_MS.short),
  [ItemId.DOUBLE_SAW]: buff(BuffId.WOOD_PRODUCTION, BUFF_TEXT.wood, BUFF_MS.long),
  [ItemId.QUARRYING_TOOLS]: buff(BuffId.STONE_PRODUCTION, BUFF_TEXT.stone, BUFF_MS.short),
  [ItemId.ADV_QUARRYING_TOOLS]: buff(BuffId.STONE_PRODUCTION, BUFF_TEXT.stone, BUFF_MS.long),
  [ItemId.BLOWER]: buff(BuffId.IRON_PRODUCTION, BUFF_TEXT.iron, BUFF_MS.short),
  [ItemId.BLAST_FURNACE]: buff(BuffId.IRON_PRODUCTION, BUFF_TEXT.iron, BUFF_MS.long),
  [ItemId.TAX_POLICY]: buff(BuffId.GOLD_PRODUCTION, BUFF_TEXT.gold, BUFF_MS.short),
  [ItemId.ADV_TAX_POLICY]: buff(BuffId.GOLD_PRODUCTION, BUFF_TEXT.gold, BUFF_MS.long),

  // ---- military buffs ----
  [ItemId.WAR_HORN]: buff(BuffId.ATTACK, BUFF_TEXT.attack, BUFF_MS.short),
  [ItemId.IVORY_HORN]: buff(BuffId.ATTACK, BUFF_TEXT.attack, BUFF_MS.long),
  [ItemId.CORSELET]: buff(BuffId.DEFENSE, BUFF_TEXT.defense, BUFF_MS.short),
  [ItemId.ULTRA_CORSELET]: buff(BuffId.DEFENSE, BUFF_TEXT.defense, BUFF_MS.long),
  [ItemId.WAR_ENSIGN]: buff(BuffId.WAR_ENSIGN, BUFF_TEXT.ensign, BUFF_MS.short),
  [ItemId.BERNINIS_HAMMER]: buff(BuffId.BUILDING_QUEUE, BUFF_TEXT.queue, BUFF_MS.long),

  // ---- upkeep ----
  [ItemId.VESTAS_BLESSING]: buff(BuffId.UPKEEP_REDUCE, BUFF_TEXT.upkeep, BUFF_MS.short),
  [ItemId.VESTAS_GRAND_BLESSING]: buff(BuffId.UPKEEP_REDUCE, BUFF_TEXT.upkeep, BUFF_MS.long),
  [ItemId.QUARTERMASTERS_SEAL]: buff(BuffId.TRAIN_COST_REDUCE, BUFF_TEXT.trainCost, BUFF_MS.short),
  [ItemId.QUARTERMASTERS_CHARTER]: buff(BuffId.TRAIN_COST_REDUCE, BUFF_TEXT.trainCost, BUFF_MS.long),

  // ---- protection ----
  [ItemId.TRUCE_AGREEMENT]: { kind: 'command', command: 'city.truce' },

  // ---- city items ----
  [ItemId.CIVIL_CODE]: { kind: 'special', handler: 'civilCode' },
  [ItemId.PENICILLIN]: { kind: 'special', handler: 'cureInjured' },

  // ---- boxes ----
  [ItemId.JUNIOR_MEDAL_BOX]: { kind: 'box', contents: (rng) => medals(rng, MEDAL_BOXES[ItemId.JUNIOR_MEDAL_BOX]) },
  [ItemId.MEDIUM_MEDAL_BOX]: { kind: 'box', contents: (rng) => medals(rng, MEDAL_BOXES[ItemId.MEDIUM_MEDAL_BOX]) },
  [ItemId.SENIOR_MEDAL_BOX]: { kind: 'box', contents: (rng) => medals(rng, MEDAL_BOXES[ItemId.SENIOR_MEDAL_BOX]) },
  [ItemId.HERO_PACKAGE]: { kind: 'special', handler: 'heroBox' },
  [ItemId.WELCOME_PACKAGE]: {
    kind: 'grant',
    items: { ...BALANCE.items.welcomePackage.items },
    resources: { ...BALANCE.items.welcomePackage.resources },
  },

  // ---- used through dedicated commands ----
  [ItemId.BEGINNER_GUIDELINES]: { kind: 'command', command: 'speedup' },
  [ItemId.PRIMARY_GUIDELINES]: { kind: 'command', command: 'speedup' },
  [ItemId.INTERMEDIATE_GUIDELINES]: { kind: 'command', command: 'speedup' },
  [ItemId.SENIOR_GUIDELINES]: { kind: 'command', command: 'speedup' },
  [ItemId.MASTER_GUIDELINES]: { kind: 'command', command: 'speedup' },
  [ItemId.ULTIMATE_GUIDELINES]: { kind: 'command', command: 'speedup' },
  [ItemId.NAPOLEONS_DIARY]: { kind: 'command', command: 'troops.speedup' },
  [ItemId.ARCHIMEDES_NOTE]: { kind: 'command', command: 'fortifications.speedup' },
  [ItemId.CITY_TELEPORTER]: { kind: 'command', command: 'city.move' },
  [ItemId.HOLY_WATER]: { kind: 'command', command: 'heroes.reset' },
  [ItemId.EXCALIBUR]: { kind: 'command', command: 'heroes.useItem' },
  [ItemId.WEALTH_OF_NATIONS]: { kind: 'command', command: 'heroes.useItem' },
  [ItemId.ART_OF_WAR]: { kind: 'command', command: 'heroes.useItem' },
  [ItemId.ANABASIS]: { kind: 'command', command: 'heroes.useItem' },
  [ItemId.EPITOME_OF_MILITARY_SCIENCE]: { kind: 'command', command: 'heroes.useItem' },
  [ItemId.ON_WAR]: { kind: 'command', command: 'heroes.useItem' },
};
for (const l of [1, 2, 3, 4, 5, 6, 7, 8, 9]) EFFECTS[medalId(l)] = { kind: 'command', command: 'heroes.useItem' };

function medals(rng: Rng, levels: readonly number[]): GrantContents {
  const items: Record<string, number> = {};
  for (const l of levels.slice(0, 3)) items[medalId(l)] = randInt(rng, BALANCE.items.medalBoxCount.min, BALANCE.items.medalBoxCount.max);
  return { items };
}

/** Effect of using an item. */
export function itemEffect(itemId: string): ItemEffect | undefined {
  return EFFECTS[itemId];
}

/** Hero-attribute items (Excalibur etc.): +BALANCE.items.heroAttributeBuff.bonus of the attribute as a buff bonus. */
export const HERO_ATTRIBUTE_ITEMS: Record<string, 'power' | 'management' | 'stratagem'> = {
  [ItemId.EXCALIBUR]: 'power',
  [ItemId.WEALTH_OF_NATIONS]: 'management',
  [ItemId.ART_OF_WAR]: 'stratagem',
};
/** What a hero attribute boost does (heroes.buffs[].desc). */
export const heroBuffDesc = (attr: 'power' | 'management' | 'stratagem') =>
  msg('buff.heroStat', { stat: ref.stat(attr), percent: pct(BALANCE.items.heroAttributeBuff.bonus) });
/** The army-size boost of the War Ensign (for battle reports). */
export const WAR_ENSIGN_DESC = BUFF_TEXT.ensign;

/** The hero inside a hero box: its level and lowest base attribute (BALANCE.items.heroBoxes). */
export const heroBoxQuality = (itemId: string) => BALANCE.items.heroBoxes[itemId] ?? BALANCE.items.heroBoxFallback;

/**
 * The hero in a hero box: a random hero at the box's level with full loyalty and its level in unspent
 * points, each base attribute raised to at least minStat + 0 … heroBoxStatSpread.
 */
export function createBoxHero(itemId: string, rng: Rng): GeneratedHero {
  const q = heroBoxQuality(itemId);
  const g = createRandomHero(1, rng);
  const bump = (v: number) => Math.max(v, q.minStat + randInt(rng, 0, BALANCE.items.heroBoxStatSpread));
  const basePower = bump(g.basePower);
  const baseManagement = bump(g.baseManagement);
  const baseStratagem = bump(g.baseStratagem);
  return {
    ...g,
    level: q.level,
    upgradeExp: upgradeExpFor(q.level),
    basePower,
    baseManagement,
    baseStratagem,
    power: basePower,
    management: baseManagement,
    stratagem: baseStratagem,
    remainPoint: q.level,
    loyalty: BALANCE.heroMaxLoyalty,
  };
}

/** A city's population after a Civil Code (BALANCE.items.civilCode), never above its maximum. */
export function civilCodePopulation(population: number, maxPopulation: number): number {
  const { share, min } = BALANCE.items.civilCode;
  return Math.min(maxPopulation, population + Math.max(min, Math.floor(maxPopulation * share)));
}

/** When a hero attribute boost used at `now` ends: another use adds its time to a boost still running (`runningEnd`). */
export function heroAttributeBuffEnd(now: number, runningEnd?: number): number {
  return (runningEnd ?? now) + BALANCE.items.heroAttributeBuff.durationMs;
}

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

/** Points an attribute boost adds: BALANCE.items.heroAttributeBuff.bonus of the attribute's points (gear included). */
export const heroBuffAmount = (attributePoints: number) => Math.ceil(attributePoints * BALANCE.items.heroAttributeBuff.bonus);

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
export function medalId(level: number): string {
  return `hero.loyalty.${Math.min(9, Math.max(1, level))}`;
}

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
