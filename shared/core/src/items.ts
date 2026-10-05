// Item effects. The original implemented only a handful of items (shop.useGoods /
// useCastleGoods / hero.useItem, speed-ups); the rest are defined here after Evony Age 1.
// Effects are declarative; the game service applies them.

import { z } from 'zod';
import { DAY, HOUR } from './time.ts';
import { ITEMS, itemConfig } from './data/index.ts';
import { pick, randInt, type Rng } from './rng.ts';
import { ResourceSetSchema, TroopCountsSchema, type ResourceSet, type TroopCounts } from './types.ts';

export type ItemEffect =
  /** timed player buff (stacks by extending) */
  | { kind: 'buff'; buff: string; desc: string; durationMs: number }
  /** immediate grant of items / resources (to the target city) / troops / cents */
  | { kind: 'grant'; items?: Record<string, number>; resources?: Partial<ResourceSet>; troops?: TroopCounts; cents?: number }
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
  cents: z.number().int().optional(),
});
export type GrantContents = z.infer<typeof GrantContentsSchema>;

const buff = (buffId: string, desc: string, durationMs: number): ItemEffect => ({ kind: 'buff', buff: buffId, desc, durationMs });

/** Common gamble-pool items used as filler in packages. */
const COMMON_FILLER = ['consume.2.a', 'consume.2.b', 'consume.refreshtavern.1', 'player.resinc.1', 'player.resinc.2', 'player.resinc.3', 'player.resinc.4', 'hero.loyalty.1', 'hero.loyalty.2'];

function randomItems(rng: Rng, n: number, pool = COMMON_FILLER): Record<string, number> {
  const out: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const id = pick(rng, pool);
    out[id] = (out[id] ?? 0) + 1;
  }
  return out;
}

const PACKAGE_DEFAULT = (rng: Rng): GrantContents => ({
  items: randomItems(rng, 3),
  resources: { food: 50_000, wood: 50_000, stone: 25_000, iron: 20_000 },
});

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
  'player.troop.1.a': buff('WarEnsignBuff', 'One extra army may march', DAY),
  'player.queue.building': buff('BuildingQueueBuff', 'Second construction queue', 7 * DAY),
  'consume.transaction.1': buff('MerchantFleetBuff', 'Marketplace shipments twice as fast', DAY),

  // ---- upkeep ----
  'player.reduce.troops.upkeep.1': buff('UpkeepReduceBuff', 'Troop upkeep -50%', DAY),
  'player.running.shoes': buff('UpkeepReduceBuff', 'Troop upkeep -50%', DAY),
  'player.santa.stoptoopsupkeep': buff('UpkeepReduceBuff', 'Troop upkeep -50%', DAY),
  'player.newyear.stoptoopsupkeep': buff('UpkeepReduceBuff', 'Troop upkeep -50%', DAY),

  // ---- protection ----
  'player.peace.1': { kind: 'command', command: 'city.truce' },
  'player.truce.dream': { kind: 'command', command: 'city.truce' },

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
  'player.box.troop.1': { kind: 'grant', troops: { archer: 5000, lightCavalry: 2000 } },
  'player.box.hero.a': { kind: 'special', handler: 'heroBox' },
  'player.box.hero.b': { kind: 'special', handler: 'heroBox' },
  'player.box.hero.c': { kind: 'special', handler: 'heroBox' },
  'player.box.hero.d': { kind: 'special', handler: 'heroBox' },
  'player.box.currently.1': { kind: 'special', handler: 'heroBox' },
  'player.box.resource.1': { kind: 'grant', resources: { gold: 100_000, food: 500_000, wood: 500_000, stone: 300_000, iron: 200_000 } },
  'player.box.wood.1': { kind: 'box', contents: (rng) => ({ items: randomItems(rng, 2) }) },
  'player.box.gambling.medal.300': { kind: 'grant', cents: 300 },
  'player.box.present.medal.50': { kind: 'grant', cents: 50 },
  'player.box.present.medal.500': { kind: 'grant', cents: 500 },
  'player.box.present.medal.3500': { kind: 'grant', cents: 3500 },
  'player.box.present.2': {
    kind: 'grant',
    items: { 'consume.2.a': 5, 'consume.2.b': 3, 'consume.refreshtavern.1': 2, 'player.box.gambling.3': 3, 'consume.1.a': 20 },
    resources: { food: 50_000, wood: 50_000, stone: 50_000, iron: 50_000 },
  },
  'player.box.present.5': { kind: 'grant', items: { 'hero.loyalty.1': 3, 'hero.loyalty.2': 2, 'hero.loyalty.3': 1 } },
  'player.box.present.6': { kind: 'grant', items: { 'player.resinc.1': 1, 'player.resinc.2': 1, 'player.resinc.3': 1, 'player.resinc.4': 1 } },
  'player.box.present.7': { kind: 'grant', items: { 'player.attackinc.1': 1, 'player.defendinc.1': 1, 'player.troop.1.b': 1 } },
  'player.box.present.10': { kind: 'box', contents: (rng) => medals(rng, [1, 2, 3, 4]) },
  'player.box.1': { kind: 'chest', key: 'consume.key.1', contents: () => ({ items: { 'consume.2.b': 2, 'player.box.gambling.3': 1 } }) },
  'player.box.2': { kind: 'chest', key: 'consume.key.2', contents: () => ({ items: { 'consume.2.c': 1, 'player.box.gambling.3': 3, 'hero.loyalty.4': 1 } }) },
  'player.box.3': { kind: 'chest', key: 'consume.key.3', contents: () => ({ items: { 'consume.2.d': 1, 'player.box.gambling.3': 5, 'hero.loyalty.7': 1 } }) },

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
  'player.move.castle.1.b': { kind: 'command', command: 'city.move' },
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
for (let i = 1; i <= 12; i++) if (i !== 3) EFFECTS[`player.box.gambling.${i}`] = { kind: 'amulet' };
for (const l of [1, 2, 3, 4, 5, 6, 7, 8, 9]) EFFECTS[`hero.loyalty.${l}`] = { kind: 'command', command: 'heroes.useItem' };

function medals(rng: Rng, levels: number[]): GrantContents {
  const items: Record<string, number> = {};
  for (const l of levels.slice(0, 3)) items[`hero.loyalty.${l}`] = 2 + randInt(rng, 0, 2);
  return { items };
}

/** Effect of using an item, or a generic package for unknown `player.box.present.*` ids. */
export function itemEffect(itemId: string): ItemEffect | undefined {
  const e = EFFECTS[itemId];
  if (e) return e;
  if (/^player\.box\.(present|compensation|evony|toolbarbonus|merger)/.test(itemId) && itemConfig(itemId)) {
    return { kind: 'box', contents: PACKAGE_DEFAULT };
  }
  return undefined;
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
  if (['consume.refreshtavern.1', 'consume.transaction.1'].includes(id)) return p ? 10 : 5;
  if (/^hero\.loyalty\.[1-6]$/.test(id)) return p ? 5 : 1;
  if (id === 'hero.loyalty.7') return p ? 4 : 1;
  if (id === 'hero.loyalty.8') return p ? 3 : 1;
  if (id === 'hero.loyalty.9') return p ? 2 : 1;
  if (id === 'player.box.gambling.food' || id === 'player.box.gambling.wood') return q ? 250_000 : 500_000;
  if (id === 'player.box.gambling.stone' || id === 'player.box.gambling.gold') return q ? 150_000 : 300_000;
  if (id === 'player.box.gambling.iron') return q ? 100_000 : 200_000;
  if (id === 'player.box.gambling.medal.10') return 10;
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

/** Resources/cents an amulet slot pays out directly instead of as an item. */
export function amuletDirectPayout(slotId: string): { resource?: keyof ResourceSet; cents?: boolean } | undefined {
  const m = /^player\.box\.gambling\.(food|wood|stone|iron|gold)$/.exec(slotId);
  if (m) return { resource: m[1] as keyof ResourceSet };
  if (slotId === 'player.box.gambling.medal.10') return { cents: true };
  return undefined;
}

export const TRUCE_DURATION_MS = 12 * HOUR;
