// Item effects. The original implemented only a handful of items (shop.useGoods /
// useCastleGoods / hero.useItem, speed-ups); the rest are defined here after Evony Age 1.
// Effects are declarative; the game service applies them.

import { z } from 'zod';
import { BALANCE, goldForCents } from './balance.ts';
import { experienceItemGain } from './heroes.ts';
import { DAY, HOUR } from './time.ts';
import { ITEMS, itemConfig } from './data/index.ts';
import { pick, randInt, type Rng } from './rng.ts';
import { ResourceSetSchema, TroopCountsSchema, type ResourceSet, type TroopCounts } from './types.ts';

export type ItemEffect =
  /** timed player buff (stacks by extending) */
  | { kind: 'buff'; buff: string; desc: string; durationMs: number }
  /** immediate grant of items / resources (to the target city) / troops */
  | { kind: 'grant'; items?: Record<string, number>; resources?: Partial<ResourceSet>; troops?: TroopCounts }
  /** box opened with a key item */
  | { kind: 'chest'; key: string; contents: () => GrantContents }
  /** random contents */
  | { kind: 'box'; contents: (rng: Rng) => GrantContents }
  /** Amulet gamble */
  | { kind: 'amulet' }
  /** handled by a specific command (speed-ups, teleporters, hero items ...) */
  | { kind: 'command'; command: string }
  | { kind: 'special'; handler: 'speechText' | 'civilCode' | 'cureInjured' | 'heroBox' | 'chatIcon' };

export const GrantContentsSchema = z.object({
  items: z.record(z.string(), z.number().int()).optional().describe('itemId -> count'),
  resources: ResourceSetSchema.partial().optional(),
  troops: TroopCountsSchema.optional(),
});
export type GrantContents = z.infer<typeof GrantContentsSchema>;

const buff = (buffId: string, desc: string, durationMs: number): ItemEffect => ({ kind: 'buff', buff: buffId, desc, durationMs });

const EFFECTS: Record<string, ItemEffect> = {
  // ---- chat ----
  'consume.1.b': { kind: 'grant', items: { 'consume.1.a': 10 } },
  'consume.1.c': { kind: 'grant', items: { 'consume.1.a': 100 } },
  'player.speak.bronze_publicity_ambassador.permanent': { kind: 'special', handler: 'chatIcon' },
  'player.speak.bronze_publicity_ambassador.permanent.15': { kind: 'special', handler: 'chatIcon' },
  'player.speak.silver_publicity_ambassador.15': { kind: 'special', handler: 'chatIcon' },
  'player.speak.silver_publicity_ambassador.permanent': { kind: 'special', handler: 'chatIcon' },
  'player.speak.gold_publicity_ambassador.15': { kind: 'special', handler: 'chatIcon' },
  'player.speak.gold_publicity_ambassador.permanent': { kind: 'special', handler: 'chatIcon' },

  // ---- production buffs ----
  'player.resinc.1': buff('FoodProductionBuff', 'Food production +25%', DAY),
  'player.resinc.1.b': buff('FoodProductionBuff', 'Food production +25%', 7 * DAY),
  'player.resinc.2': buff('WoodProductionBuff', 'Lumber production +25%', DAY),
  'player.resinc.2.b': buff('WoodProductionBuff', 'Lumber production +25%', 7 * DAY),
  'player.resinc.3': buff('StoneProductionBuff', 'Stone production +25%', DAY),
  'player.resinc.3.b': buff('StoneProductionBuff', 'Stone production +25%', 7 * DAY),
  'player.resinc.4': buff('IronProductionBuff', 'Iron production +25%', DAY),
  'player.resinc.4.b': buff('IronProductionBuff', 'Iron production +25%', 7 * DAY),
  'player.gold.1.a': buff('GoldProductionBuff', 'Gold income +25%', DAY),
  'player.gold.1.b': buff('GoldProductionBuff', 'Gold income +25%', 7 * DAY),

  // ---- military buffs ----
  'player.attackinc.1': buff('AttackBuff', 'Troop attack +20%', DAY),
  'player.attackinc.1.b': buff('AttackBuff', 'Troop attack +20%', 7 * DAY),
  'player.defendinc.1': buff('DefenseBuff', 'Troop defense +20%', DAY),
  'player.defendinc.1.b': buff('DefenseBuff', 'Troop defense +20%', 7 * DAY),
  'player.troop.1.a': buff('WarEnsignBuff', 'Armies may hold 25% more troops', DAY),
  'player.queue.building': buff('BuildingQueueBuff', 'One extra construction queue', 7 * DAY),

  // ---- upkeep ----
  'player.reduce.troops.upkeep.1': buff('UpkeepReduceBuff', 'Troop upkeep -50%', DAY),
  'player.reduce.troops.upkeep.7': buff('UpkeepReduceBuff', 'Troop upkeep -50%', 7 * DAY),
  'player.reduce.troops.cost.1': buff('TrainCostReduceBuff', `Troop training cost -${BALANCE.trainCostReduction * 100}%`, DAY),
  'player.reduce.troops.cost.7': buff('TrainCostReduceBuff', `Troop training cost -${BALANCE.trainCostReduction * 100}%`, 7 * DAY),

  // ---- protection ----
  'player.peace.1': { kind: 'command', command: 'city.truce' },

  // ---- city items ----
  'player.heart.1.a': { kind: 'special', handler: 'speechText' },
  'player.pop.1.a': { kind: 'special', handler: 'civilCode' },
  'player.relive.1': { kind: 'special', handler: 'cureInjured' },

  // ---- boxes ----
  'player.box.gambling.3': { kind: 'amulet' },
  'player.box.special.1': { kind: 'box', contents: (rng) => medals(rng, [1, 2, 3]) },
  'player.box.special.2': { kind: 'box', contents: (rng) => medals(rng, [4, 5, 6]) },
  'player.box.special.3': { kind: 'box', contents: (rng) => medals(rng, [7, 8, 9]) },
  'player.box.troop.a': { kind: 'grant', troops: { militia: 1000, archer: 500 } },
  'player.box.troop.b': { kind: 'grant', troops: { pikemen: 2000, swordsmen: 1000 } },
  'player.box.troop.c': { kind: 'grant', troops: { lightCavalry: 1000, heavyCavalry: 500 } },
  'player.box.troop.d': { kind: 'grant', troops: { ballista: 100, batteringRam: 50, catapult: 50 } },
  'player.box.hero.a': { kind: 'special', handler: 'heroBox' },
  'player.box.hero.b': { kind: 'special', handler: 'heroBox' },
  'player.box.hero.c': { kind: 'special', handler: 'heroBox' },
  'player.box.hero.d': { kind: 'special', handler: 'heroBox' },
  'player.box.currently.1': { kind: 'special', handler: 'heroBox' },
  'player.box.present.2': {
    kind: 'grant',
    items: { 'consume.2.a': 5, 'consume.2.b': 3, 'consume.refreshtavern.1': 2, 'player.box.gambling.3': 3, 'consume.1.a': 20 },
    resources: { food: 50_000, wood: 50_000, stone: 50_000, iron: 50_000 },
  },

  // ---- used through dedicated commands ----
  'consume.2.a': { kind: 'command', command: 'speedup' },
  'consume.2.b': { kind: 'command', command: 'speedup' },
  'consume.2.b.1': { kind: 'command', command: 'speedup' },
  'consume.2.c': { kind: 'command', command: 'speedup' },
  'consume.2.c.1': { kind: 'command', command: 'speedup' },
  'consume.2.d': { kind: 'command', command: 'speedup' },
  'player.destroy.1.a': { kind: 'command', command: 'speedup' },
  'player.troop.1.b': { kind: 'command', command: 'troops.speedup' },
  'player.fort.1.c': { kind: 'command', command: 'fortifications.speedup' },
  'consume.move.1': { kind: 'command', command: 'city.move' },
  'player.more.castle.1.a': { kind: 'command', command: 'city.move' },
  'consume.changeflag.1': { kind: 'command', command: 'player.flag' },
  'player.name.1.a': { kind: 'command', command: 'player.rename' },
  'consume.refreshtavern.1': { kind: 'command', command: 'heroes.tavern.refresh' },
  'hero.reset.1': { kind: 'command', command: 'heroes.reset' },
  'hero.reset.1.a': { kind: 'grant', items: { 'hero.reset.1': 5 } },
  'hero.power.1': { kind: 'command', command: 'heroes.useItem' },
  'hero.management.1': { kind: 'command', command: 'heroes.useItem' },
  'hero.intelligence.1': { kind: 'command', command: 'heroes.useItem' },
  'player.experience.1.a': { kind: 'command', command: 'heroes.useItem' },
  'player.experience.1.b': { kind: 'command', command: 'heroes.useItem' },
  'player.experience.1.c': { kind: 'command', command: 'heroes.useItem' },
  'consume.blueprint.1': { kind: 'command', command: 'building.prerequisite' },
  'consume.hegemony.1': { kind: 'command', command: 'alliance.useItem' },
  'alliance.ritual_of_pact.advanced': { kind: 'command', command: 'alliance.useItem' },
  'alliance.ritual_of_pact.premium': { kind: 'command', command: 'alliance.useItem' },
  'alliance.ritual_of_pact.ultimate': { kind: 'command', command: 'alliance.useItem' },
};
for (const l of [1, 2, 3, 4, 5, 6, 7, 8, 9]) EFFECTS[`hero.loyalty.${l}`] = { kind: 'command', command: 'heroes.useItem' };

function medals(rng: Rng, levels: number[]): GrantContents {
  const items: Record<string, number> = {};
  for (const l of levels.slice(0, 3)) items[`hero.loyalty.${l}`] = 2 + randInt(rng, 0, 2);
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

/** Hero box quality -> hero level and minimum base stat. */
export const HERO_BOX_QUALITY: Record<string, { level: number; minStat: number }> = {
  'player.box.hero.a': { level: 10, minStat: 40 },
  'player.box.hero.b': { level: 20, minStat: 50 },
  'player.box.hero.c': { level: 35, minStat: 60 },
  'player.box.hero.d': { level: 50, minStat: 70 },
  'player.box.currently.1': { level: 30, minStat: 55 },
};

export const CHAT_ICONS: Record<string, { icon: number; durationMs: number }> = {
  'player.speak.bronze_publicity_ambassador.permanent': { icon: 1, durationMs: 3650 * DAY },
  'player.speak.bronze_publicity_ambassador.permanent.15': { icon: 1, durationMs: 15 * DAY },
  'player.speak.silver_publicity_ambassador.15': { icon: 2, durationMs: 15 * DAY },
  'player.speak.silver_publicity_ambassador.permanent': { icon: 2, durationMs: 3650 * DAY },
  'player.speak.gold_publicity_ambassador.15': { icon: 3, durationMs: 15 * DAY },
  'player.speak.gold_publicity_ambassador.permanent': { icon: 3, durationMs: 3650 * DAY },
};

/** Alliance items: member limit 1000 for N days (orig item XML descriptions). */
export const ALLIANCE_PACT_ITEMS: Record<string, number> = {
  'alliance.ritual_of_pact.advanced': 15 * DAY,
  'alliance.ritual_of_pact.premium': 30 * DAY,
  'alliance.ritual_of_pact.ultimate': 90 * DAY,
  'consume.hegemony.1': 30 * DAY,
};

// ---------------------------------------------------------------------------------------------
// Amulet (orig GenerateGamble / GetGambleCount)
// ---------------------------------------------------------------------------------------------

export interface GambleSlot {
  id: string;
  count: number;
  /** 0 ultra rare .. 4 common */
  kind: number;
}

const buckets = (() => {
  const b: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const i of ITEMS) {
    if (!i.canGamble) continue;
    const r = i.rarity >= 1 && i.rarity <= 4 ? i.rarity : 5;
    b[r].push(i.id);
  }
  return b;
})();

function gambleCount(id: string, rng: Rng): number {
  const p = randInt(rng, 0, 4) === 1;
  const q = randInt(rng, 0, 1) === 1;
  if (['consume.1.a', 'consume.2.a', 'consume.2.b', 'consume.2.b.1', 'consume.blueprint.1'].includes(id)) return p ? 5 : 1;
  if (id === 'consume.refreshtavern.1') return p ? 10 : 5;
  if (/^hero\.loyalty\.[1-6]$/.test(id)) return p ? 5 : 1;
  if (id === 'hero.loyalty.7') return p ? 4 : 1;
  if (id === 'hero.loyalty.8') return p ? 3 : 1;
  if (id === 'hero.loyalty.9') return p ? 2 : 1;
  if (id === 'player.box.gambling.food' || id === 'player.box.gambling.wood') return q ? 250_000 : 500_000;
  if (id === 'player.box.gambling.stone' || id === 'player.box.gambling.gold') return q ? 150_000 : 300_000;
  if (id === 'player.box.gambling.iron') return q ? 100_000 : 200_000;
  if (['player.heart.1.a', 'player.queue.building', 'player.gold.1.a', 'player.gold.1.b'].includes(id)) return p ? 10 : 5;
  return 1;
}

function slot(rarity: number, rng: Rng): GambleSlot {
  const pool = buckets[rarity].length ? buckets[rarity] : buckets[5];
  const id = pick(rng, pool);
  return { id, count: gambleCount(id, rng), kind: rarity - 1 };
}

/** 24 candidate slots and the winning index (60/25/10/5% for common/special/rare/top). */
export function rollAmulet(rng: Rng): { slots: GambleSlot[]; winner: number } {
  const slots: GambleSlot[] = [];
  for (let i = 0; i < 16; i++) slots.push(slot(5, rng));
  for (let i = 0; i < 4; i++) slots.push(slot(4, rng));
  for (let i = 0; i < 3; i++) slots.push(slot(3, rng));
  slots.push(slot(randInt(rng, 0, 99) < 95 ? 2 : 1, rng));
  const v = randInt(rng, 0, 99_999);
  const winner = v < 60_000 ? randInt(rng, 0, 15) : v < 85_000 ? 16 + randInt(rng, 0, 3) : v < 95_000 ? 20 + randInt(rng, 0, 2) : 23;
  return { slots, winner };
}

/** Winning-slot odds by item rarity (rollAmulet): 60% one of the 16 common slots, 25% one of 4 special, 10% one of 3 rare, 5% the top slot (rarity 2, or 1 one time in 20). */
const AMULET_RARITY_SHARE: Record<number, number> = { 5: 0.6, 4: 0.25, 3: 0.1, 2: 0.05 * 0.95, 1: 0.05 * 0.05 };

/**
 * Chance one Amulet pays out `itemId`, and how many it pays (rollAmulet: every slot is a random item of
 * its rarity), or null when it is never a prize.
 */
export function amuletPrize(itemId: string): { chance: number; min: number; max: number } | null {
  const cfg = itemConfig(itemId);
  if (!cfg?.canGamble) return null;
  const r = cfg.rarity >= 1 && cfg.rarity <= 4 ? cfg.rarity : 5;
  if (!buckets[r].length) return null;
  const counts = [0, 0.25, 0.75].map((x) => gambleCount(itemId, { next: () => x }));
  return { chance: AMULET_RARITY_SHARE[r] / buckets[r].length, min: Math.min(...counts), max: Math.max(...counts) };
}

/** Resources an amulet slot pays out directly instead of as an item. */
export function amuletDirectPayout(slotId: string): { resource?: keyof ResourceSet } | undefined {
  const m = /^player\.box\.gambling\.(food|wood|stone|iron|gold)$/.exec(slotId);
  if (m) return { resource: m[1] as keyof ResourceSet };
  return undefined;
}

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
  buffs: { id: string; desc: string; endTime: number; param?: number }[];
};

/** Points an attribute boost adds: HERO_ATTRIBUTE_BUFF.bonus of the attribute's points (gear included). */
export const heroBuffAmount = (attributePoints: number) => Math.ceil(attributePoints * HERO_ATTRIBUTE_BUFF.bonus);

/** The points an attribute boost works on: assigned points plus gear (evony-re: orig only the hero's own points). */
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
 * (evony-re) Gold price of an item in the shop (bought with a city's gold): its set price
 * (BALANCE.goldShop), or the original's cents price in gold (goldForCents); null when not for sale.
 */
export function itemGoldPrice(itemId: string): number | null {
  const set = BALANCE.goldShop[itemId];
  if (set != null) return set;
  const cfg = itemConfig(itemId);
  return cfg?.buyable && cfg.cost > 0 ? goldForCents(cfg.cost) : null;
}
