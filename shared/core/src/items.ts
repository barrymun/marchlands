// Item effects. The original implemented only a handful of items (shop.useGoods /
// useCastleGoods / hero.useItem, speed-ups); the rest are defined here after Evony Age 1.
// Effects are declarative; the game service applies them.

import { BALANCE, goldForCents } from '#/balance.ts';
import { type BasicResource, BuffId, HeroBuffId, ItemCommand, ItemEffectKind, ItemSpecialHandler, ResourceKey } from '#/constants.ts';
import { itemConfig } from '#/data/index.ts';
import { createRandomHero, experienceItemGain, type GeneratedHero, upgradeExpFor } from '#/heroes.ts';
import { ItemId } from '#/item-ids.ts';
import { type Message, msg, ref, share } from '#/messages/index.ts';
import { randInt, type Rng } from '#/rng.ts';
import type { GrantContents, ResourceSet, TroopCounts } from '#/types.ts';

export type ItemEffect =
  /** timed player buff (stacks by extending). `desc`: what it does, stored in the buff and worded by the client */
  | { kind: typeof ItemEffectKind.BUFF; buff: BuffId; desc: Message; durationMs: number }
  /** immediate grant of items / resources (to the target city) / troops */
  | { kind: typeof ItemEffectKind.GRANT; items?: Record<string, number>; resources?: Partial<ResourceSet>; troops?: TroopCounts }
  /** box opened with a key item */
  | { kind: typeof ItemEffectKind.CHEST; key: string; contents: () => GrantContents }
  /** random contents */
  | { kind: typeof ItemEffectKind.BOX; contents: (rng: Rng) => GrantContents }
  /** handled by a specific command (speed-ups, teleporters, hero items ...) */
  | { kind: typeof ItemEffectKind.COMMAND; command: ItemCommand }
  | { kind: typeof ItemEffectKind.SPECIAL; handler: ItemSpecialHandler };

const pct = share;
const BATTLE_BUFF_PERCENT = pct(BALANCE.battleBuffBonus);
const UPKEEP_BUFF_PERCENT = pct(BALANCE.upkeepBuffReduction);

/** What each kind of buff item does (stored in the buff, and the item description's effect). */
const production = (resource: BasicResource) => msg('buff.production', { resource: ref.resource(resource), percent: pct(BALANCE.resourceBuffBonus) });
const BUFF_TEXT = {
  food: production(ResourceKey.FOOD),
  wood: production(ResourceKey.WOOD),
  stone: production(ResourceKey.STONE),
  iron: production(ResourceKey.IRON),
  gold: msg('buff.goldIncome', { percent: pct(BALANCE.resourceBuffBonus) }),
  attack: msg('buff.troopAttack', { percent: BATTLE_BUFF_PERCENT }),
  defense: msg('buff.troopDefense', { percent: BATTLE_BUFF_PERCENT }),
  banner: msg('buff.armySize', { percent: pct(BALANCE.imperialBannerTroopBonus) }),
  queue: msg('buff.buildingQueue'),
  upkeep: msg('buff.upkeep', { percent: UPKEEP_BUFF_PERCENT }),
  trainCost: msg('buff.trainingCost', { percent: pct(BALANCE.trainCostReduction) }),
} satisfies Record<string, Message>;

const buff = (buffId: BuffId, desc: Message, durationMs: number): ItemEffect => ({ kind: ItemEffectKind.BUFF, buff: buffId, desc, durationMs });

const { buffDurationMs: BUFF_MS, medalBoxes: MEDAL_BOXES } = BALANCE.items;

const EFFECTS: Record<string, ItemEffect> = {
  // ---- production buffs ----
  [ItemId.PLOUGHSHARE]: buff(BuffId.FOOD_PRODUCTION, BUFF_TEXT.food, BUFF_MS.short),
  [ItemId.HEAVY_PLOUGH]: buff(BuffId.FOOD_PRODUCTION, BUFF_TEXT.food, BUFF_MS.long),
  [ItemId.BOW_SAW]: buff(BuffId.WOOD_PRODUCTION, BUFF_TEXT.wood, BUFF_MS.short),
  [ItemId.WATER_SAW]: buff(BuffId.WOOD_PRODUCTION, BUFF_TEXT.wood, BUFF_MS.long),
  [ItemId.MASONS_PICK]: buff(BuffId.STONE_PRODUCTION, BUFF_TEXT.stone, BUFF_MS.short),
  [ItemId.TREADWHEEL_CRANE]: buff(BuffId.STONE_PRODUCTION, BUFF_TEXT.stone, BUFF_MS.long),
  [ItemId.HAND_BELLOWS]: buff(BuffId.IRON_PRODUCTION, BUFF_TEXT.iron, BUFF_MS.short),
  [ItemId.WATER_BELLOWS]: buff(BuffId.IRON_PRODUCTION, BUFF_TEXT.iron, BUFF_MS.long),
  [ItemId.TOLL_RIGHT]: buff(BuffId.GOLD_PRODUCTION, BUFF_TEXT.gold, BUFF_MS.short),
  [ItemId.MINT_RIGHT]: buff(BuffId.GOLD_PRODUCTION, BUFF_TEXT.gold, BUFF_MS.long),

  // ---- military buffs ----
  [ItemId.WAR_HORN]: buff(BuffId.ATTACK, BUFF_TEXT.attack, BUFF_MS.short),
  [ItemId.OLIFANT]: buff(BuffId.ATTACK, BUFF_TEXT.attack, BUFF_MS.long),
  [ItemId.GAMBESON]: buff(BuffId.DEFENSE, BUFF_TEXT.defense, BUFF_MS.short),
  [ItemId.HAUBERK]: buff(BuffId.DEFENSE, BUFF_TEXT.defense, BUFF_MS.long),
  [ItemId.IMPERIAL_BANNER]: buff(BuffId.IMPERIAL_BANNER, BUFF_TEXT.banner, BUFF_MS.short),
  [ItemId.BERNWARDS_HAMMER]: buff(BuffId.BUILDING_QUEUE, BUFF_TEXT.queue, BUFF_MS.long),

  // ---- upkeep ----
  [ItemId.ELIZABETHS_BREAD]: buff(BuffId.UPKEEP_REDUCE, BUFF_TEXT.upkeep, BUFF_MS.short),
  [ItemId.ELIZABETHS_GRANARY]: buff(BuffId.UPKEEP_REDUCE, BUFF_TEXT.upkeep, BUFF_MS.long),
  [ItemId.MARSHALS_SEAL]: buff(BuffId.TRAIN_COST_REDUCE, BUFF_TEXT.trainCost, BUFF_MS.short),
  [ItemId.MARSHALS_CHARTER]: buff(BuffId.TRAIN_COST_REDUCE, BUFF_TEXT.trainCost, BUFF_MS.long),

  // ---- protection ----
  [ItemId.KINGS_PEACE]: { kind: ItemEffectKind.COMMAND, command: ItemCommand.CITY_TRUCE },

  // ---- city items ----
  [ItemId.MAGDEBURG_RIGHTS]: { kind: ItemEffectKind.SPECIAL, handler: ItemSpecialHandler.MAGDEBURG_RIGHTS },
  [ItemId.THERIAC]: { kind: ItemEffectKind.SPECIAL, handler: ItemSpecialHandler.CURE_INJURED },

  // ---- boxes ----
  [ItemId.BRONZE_COFFER]: { kind: ItemEffectKind.BOX, contents: (rng) => medals(rng, MEDAL_BOXES[ItemId.BRONZE_COFFER]) },
  [ItemId.SILVER_COFFER]: { kind: ItemEffectKind.BOX, contents: (rng) => medals(rng, MEDAL_BOXES[ItemId.SILVER_COFFER]) },
  [ItemId.GOLD_COFFER]: { kind: ItemEffectKind.BOX, contents: (rng) => medals(rng, MEDAL_BOXES[ItemId.GOLD_COFFER]) },
  [ItemId.OATH_OF_FEALTY]: { kind: ItemEffectKind.SPECIAL, handler: ItemSpecialHandler.HERO_BOX },
  [ItemId.FOUNDERS_GIFT]: {
    kind: ItemEffectKind.GRANT,
    items: { ...BALANCE.items.foundersGift.items },
    resources: { ...BALANCE.items.foundersGift.resources },
  },

  // ---- used through dedicated commands ----
  [ItemId.NOVICES_NOTES]: { kind: ItemEffectKind.COMMAND, command: ItemCommand.SPEEDUP },
  [ItemId.APPRENTICES_NOTES]: { kind: ItemEffectKind.COMMAND, command: ItemCommand.SPEEDUP },
  [ItemId.JOURNEYMANS_NOTES]: { kind: ItemEffectKind.COMMAND, command: ItemCommand.SPEEDUP },
  [ItemId.MASTERS_NOTES]: { kind: ItemEffectKind.COMMAND, command: ItemCommand.SPEEDUP },
  [ItemId.GRANDMASTERS_NOTES]: { kind: ItemEffectKind.COMMAND, command: ItemCommand.SPEEDUP },
  [ItemId.VILLARDS_SKETCHBOOK]: { kind: ItemEffectKind.COMMAND, command: ItemCommand.SPEEDUP },
  [ItemId.OTTOS_MUSTER_ROLL]: { kind: ItemEffectKind.COMMAND, command: ItemCommand.TROOPS_SPEEDUP },
  [ItemId.HENRYS_CASTLE_LAW]: { kind: ItemEffectKind.COMMAND, command: ItemCommand.FORTIFICATIONS_SPEEDUP },
  [ItemId.LOCATORS_CHARTER]: { kind: ItemEffectKind.COMMAND, command: ItemCommand.CITY_MOVE },
  [ItemId.HOLY_WATER]: { kind: ItemEffectKind.COMMAND, command: ItemCommand.HEROES_RESET },
  [ItemId.JOYEUSE]: { kind: ItemEffectKind.COMMAND, command: ItemCommand.HEROES_USE_ITEM },
  [ItemId.MIRROR_OF_KINGS]: { kind: ItemEffectKind.COMMAND, command: ItemCommand.HEROES_USE_ITEM },
  [ItemId.STRATAGEMS]: { kind: ItemEffectKind.COMMAND, command: ItemCommand.HEROES_USE_ITEM },
  [ItemId.DEEDS_OF_THE_SAXONS]: { kind: ItemEffectKind.COMMAND, command: ItemCommand.HEROES_USE_ITEM },
  [ItemId.EPITOME_OF_MILITARY_SCIENCE]: { kind: ItemEffectKind.COMMAND, command: ItemCommand.HEROES_USE_ITEM },
  [ItemId.NIBELUNGENLIED]: { kind: ItemEffectKind.COMMAND, command: ItemCommand.HEROES_USE_ITEM },
};
for (const l of [1, 2, 3, 4, 5, 6, 7, 8, 9]) EFFECTS[medalId(l)] = { kind: ItemEffectKind.COMMAND, command: ItemCommand.HEROES_USE_ITEM };

/** The medals in a medal box: each of its levels (BALANCE.items.medalBoxes, set for every box). */
function medals(rng: Rng, levels: readonly number[] = []): GrantContents {
  const items: Record<string, number> = {};
  for (const l of levels.slice(0, 3)) items[medalId(l)] = randInt(rng, BALANCE.items.medalBoxCount.min, BALANCE.items.medalBoxCount.max);
  return { items };
}

/** Effect of using an item. */
export function itemEffect(itemId: string): ItemEffect | undefined {
  return EFFECTS[itemId];
}

/** Hero-attribute items (Joyeuse etc.): +BALANCE.items.heroAttributeBuff.bonus of the attribute as a buff bonus. */
export const HERO_ATTRIBUTE_ITEMS: Record<string, HeroBuffId> = {
  [ItemId.JOYEUSE]: HeroBuffId.POWER,
  [ItemId.MIRROR_OF_KINGS]: HeroBuffId.MANAGEMENT,
  [ItemId.STRATAGEMS]: HeroBuffId.STRATAGEM,
};
/** What a hero attribute boost does (heroes.buffs[].desc). */
export const heroBuffDesc = (attr: HeroBuffId) => msg('buff.heroStat', { stat: ref.stat(attr), percent: pct(BALANCE.items.heroAttributeBuff.bonus) });
/** The army-size boost of the Imperial Banner (for battle reports). */
export const IMPERIAL_BANNER_DESC = BUFF_TEXT.banner;

/** The hero inside a hero box: its level and lowest base attribute (BALANCE.items.heroBoxes). */
export const heroBoxQuality = (itemId: string) => BALANCE.items.heroBoxes[itemId] ?? BALANCE.items.heroBoxFallback;

/**
 * The hero in a hero box: a random hero at the box's level with full loyalty and its level in unspent
 * points, each base attribute raised to at least minStat + 0 … heroBoxStatSpread. Named as the Inn of `city` would name it.
 */
export function createBoxHero(itemId: string, rng: Rng, city: { state: number; taken?: ReadonlySet<string> }): GeneratedHero {
  const q = heroBoxQuality(itemId);
  const g = createRandomHero(1, rng, city);
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

/** A city's population after a Magdeburg Rights (BALANCE.items.civilCode), never above its maximum. */
export function magdeburgRightsPopulation(population: number, maxPopulation: number): number {
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
export const heroBuffBase = (h: Omit<BuffedHero, 'buffs'>, attr: HeroBuffId) => h[attr] + h[`${attr}Added`];

/**
 * Keep active attribute boosts in step with the hero's current attributes (they grow as the hero
 * levels up, points are assigned and gear grows). Mutates the hero; returns true when anything changed.
 */
export function syncHeroBuffs(h: BuffedHero): boolean {
  let changed = false;
  h.buffs = h.buffs.map((b) => {
    const attr = b.id;
    if (attr !== HeroBuffId.POWER && attr !== HeroBuffId.MANAGEMENT && attr !== HeroBuffId.STRATAGEM) return b;
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

/** Medal item id of a level 1 (Cross) … 9 (Crown). */
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
 * (BALANCE.goldShop), or the original's cents price in gold (goldForCents); null when not for sale, as the
 * items in BALANCE.notInShop aren't.
 */
export function itemGoldPrice(itemId: string): number | null {
  if (BALANCE.notInShop.includes(itemId)) return null;
  const set = BALANCE.goldShop[itemId];
  if (set != null) return set;
  const cfg = itemConfig(itemId);
  return cfg?.buyable && cfg.cost > 0 ? goldForCents(cfg.cost) : null;
}
