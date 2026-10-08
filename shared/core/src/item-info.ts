// Player-facing item descriptions, derived from the declared effects (items.ts) and the rules
// that consume items elsewhere (speed-ups, hero items, teleporters ...), so the numbers shown
// always match what the server does. The original data has names but no descriptions.

import { BALANCE } from './balance.ts';
import { TROOP_ID_BY_KEY, TROOP_NAMES, type TroopKey } from './constants.ts';
import { ITEMS, itemConfig } from './data/index.ts';
import { LOYALTY_MEDALS } from './heroes.ts';
import {
  ALLIANCE_PACT_ITEMS,
  amuletPrize,
  CHAT_ICONS,
  HERO_ATTRIBUTE_BUFF,
  HERO_ATTRIBUTE_ITEMS,
  HERO_BOX_QUALITY,
  itemEffect,
  medalId,
  medalOdds,
  type GrantContents,
} from './items.ts';
import { QUEST_CATALOGUE } from './quests.ts';
import { seededRng } from './rng.ts';
import { DAY, HOUR } from './time.ts';

/** Shop categories (orig item `type`). */
export const ITEM_CATEGORIES: Record<number, string> = {
  0: 'Hero medals',
  1: 'Speed-ups',
  2: 'Chests & packages',
  3: 'Production',
  4: 'Treasures',
};

export interface ItemInfo {
  id: string;
  name: string;
  category: string;
  description: string;
  /**
   * `direct`: used from the inventory (POST /player/items/{id}/use, with the current city);
   * `elsewhere`: consumed by another action, see `howTo`; `none`: no effect on this server.
   */
  use: 'direct' | 'elsewhere' | 'none';
  howTo?: string;
  /** shop price in cents (0 = not sold) */
  price: number;
}

const fmt = (n: number) => n.toLocaleString('en');
const RES_NAMES = { gold: 'gold', food: 'food', wood: 'lumber', stone: 'stone', iron: 'iron' } as const;

function duration(ms: number): string {
  if (ms >= 365 * DAY) return 'permanently';
  if (ms >= DAY) return `for ${ms / DAY} day${ms === DAY ? '' : 's'}`;
  return `for ${ms / HOUR} hours`;
}

function list(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

function contents(c: GrantContents): string {
  const parts: string[] = [];
  for (const [id, n] of Object.entries(c.items ?? {})) parts.push(`${n} × ${itemConfig(id)?.name.trim() ?? id}`);
  for (const [r, n] of Object.entries(c.resources ?? {})) if (n) parts.push(`${fmt(n)} ${RES_NAMES[r as keyof typeof RES_NAMES]}`);
  for (const [k, n] of Object.entries(c.troops ?? {})) if (n) parts.push(`${fmt(n)} ${TROOP_NAMES[TROOP_ID_BY_KEY[k as TroopKey]]}`);
  if (c.cents) parts.push(`${fmt(c.cents)} cents`);
  return list(parts);
}

const MEDAL_BOXES: Record<string, number[]> = {
  'player.box.special.1': [1, 2, 3],
  'player.box.special.2': [4, 5, 6],
  'player.box.special.3': [7, 8, 9],
  'player.box.present.10': [1, 2, 3, 4],
};

const SPEEDUPS: Record<string, string> = {
  'consume.2.a': 'Cuts 15 minutes off a construction or research.',
  'consume.2.b': 'Cuts 1 hour off a construction or research.',
  'consume.2.b.1': 'Cuts 2½ hours off a construction or research.',
  'consume.2.c': 'Cuts 8 hours off a construction or research.',
  'consume.2.c.1': 'Cuts 10–30 hours (random) off a construction or research.',
  'consume.2.d': 'Cuts 30% of the remaining time off a construction or research.',
  'player.destroy.1.a': 'Finishes a demolition at once and removes the whole building, whatever its level.',
  'player.troop.1.b': 'Cuts 30% off the remaining time of one troop-training batch.',
  'player.fort.1.c': 'Cuts 30% off the remaining time of one fortification batch.',
};

const HOW_TO: Record<string, string> = {
  speedup: 'Use from a construction (City tab) or research (Research tab) in progress.',
  'troops.speedup': 'Use on a batch in the Military tab training queue.',
  'fortifications.speedup': 'Use on a batch in the Military tab fortification queue.',
  'city.move': 'Use from City settings (city name menu), or "Move city here" on a free flat in the Map tab.',
  'player.flag': 'Use from Lord settings (top-right menu).',
  'player.rename': 'Use from Lord settings (top-right menu).',
  'heroes.tavern.refresh': 'Use from the Inn in the Heroes tab.',
  'heroes.reset': "Use from a hero's Points dialog in the Heroes tab.",
  'heroes.useItem': "Use from a hero's Items button in the Heroes tab.",
  'alliance.useItem': 'Used by the alliance leader on the alliance (API only for now: POST /api/v1/alliance/items).',
  'city.truce': 'Use from Lord settings (top-right menu).',
};

const ATTRIBUTE_NAMES = { power: 'Attack', management: 'Politics', stratagem: 'Intelligence' };

function describe(id: string): Pick<ItemInfo, 'description' | 'use' | 'howTo'> {
  const name = (x: string) => itemConfig(x)?.name.trim() ?? x;
  if (SPEEDUPS[id]) {
    const howTo =
      id === 'player.destroy.1.a'
        ? 'Use on a building that is being demolished.'
        : HOW_TO[id.startsWith('player.troop') ? 'troops.speedup' : id.startsWith('player.fort') ? 'fortifications.speedup' : 'speedup'];
    return { description: SPEEDUPS[id], use: 'elsewhere', howTo };
  }
  if (LOYALTY_MEDALS[id])
    return { description: `Raises a hero's loyalty by ${LOYALTY_MEDALS[id]} (max 100).`, use: 'elsewhere', howTo: HOW_TO['heroes.useItem'] };
  if (HERO_ATTRIBUTE_ITEMS[id]) {
    const attr = ATTRIBUTE_NAMES[HERO_ATTRIBUTE_ITEMS[id]];
    return {
      description: `Raises one hero's ${attr} by ${HERO_ATTRIBUTE_BUFF.bonus * 100}% ${duration(HERO_ATTRIBUTE_BUFF.durationMs)}.`,
      use: 'elsewhere',
      howTo: HOW_TO['heroes.useItem'],
    };
  }
  const books: Record<string, string> = {
    'player.experience.1.a': '8% of the next level, at least 1,000',
    'player.experience.1.b': '30% of the next level, at least 10,000',
    'player.experience.1.c': 'a full level, at least 100,000',
  };
  if (books[id]) return { description: `Gives a hero experience: ${books[id]}.`, use: 'elsewhere', howTo: HOW_TO['heroes.useItem'] };
  if (ALLIANCE_PACT_ITEMS[id])
    return {
      description: `Raises your alliance's member limit to 1,000 ${duration(ALLIANCE_PACT_ITEMS[id])}.`,
      use: 'elsewhere',
      howTo: HOW_TO['alliance.useItem'],
    };
  if (id === 'consume.1.a')
    return {
      description: `Lets you post one message in the World chat channel (${BALANCE.worldChatSpeakerCost} Speaker per message).`,
      use: 'elsewhere',
      howTo: 'Used automatically when you chat in World.',
    };
  const chestFor = ITEMS.find((i) => {
    const e = itemEffect(i.id);
    return e?.kind === 'chest' && e.key === id;
  });
  if (chestFor)
    return { description: `Opens a ${chestFor.name.trim()}.`, use: 'elsewhere', howTo: `Use the ${chestFor.name.trim()}; the key is taken automatically.` };
  const payout = /^player\.box\.gambling\.(food|wood|stone|iron|gold)$/.exec(id);
  if (payout) return { description: `Amulet prize, paid straight into your city as ${RES_NAMES[payout[1] as keyof typeof RES_NAMES]}.`, use: 'none' };
  if (id === 'player.box.gambling.medal.10') return { description: 'Amulet prize, paid straight to you as cents.', use: 'none' };

  if (id === 'consume.transaction.1' && BALANCE.marketShipmentBaseMs <= 0)
    return { description: 'No effect on this server: market trades are already instant.', use: 'none' };
  const e = itemEffect(id);
  if (!e) return { description: 'Event item with no effect on this server.', use: 'none' };
  switch (e.kind) {
    case 'buff':
      return { description: `${e.desc} ${duration(e.durationMs)}. Using another extends the time.`, use: 'direct' };
    case 'grant':
      return { description: `Gives ${contents(e)}${e.resources || e.troops ? ' to the current city' : ''}.`, use: 'direct' };
    case 'chest':
      return { description: `Locked chest: needs a ${name(e.key)}. Contains ${contents(e.contents())}.`, use: 'direct' };
    case 'box':
      if (MEDAL_BOXES[id]) return { description: `Contains 2–4 each of ${list(MEDAL_BOXES[id].map((l) => name(`hero.loyalty.${l}`)))}.`, use: 'direct' };
      if (id === 'player.box.wood.1')
        return { description: 'Contains 2 random common items (speed-ups, Hero Hunting, production items or medals).', use: 'direct' };
      return {
        description: 'Package: 3 random common items plus 50,000 food, 50,000 lumber, 25,000 stone and 20,000 iron for the current city.',
        use: 'direct',
      };
    case 'amulet':
      return { description: 'Spin the Amulet: win one of 24 prizes (items, resources or cents); rarer prizes are less likely.', use: 'direct' };
    case 'special':
      switch (e.handler) {
        case 'speechText':
          return { description: "Restores the current city's loyalty to 100 and clears grievance.", use: 'direct' };
        case 'civilCode':
          return { description: 'Adds 20% of the maximum population (at least 100) to the current city.', use: 'direct' };
        case 'cureInjured':
          return { description: 'Heals every injured troop in the current city at once.', use: 'direct' };
        case 'heroBox': {
          const q = HERO_BOX_QUALITY[id] ?? { level: 10, minStat: 40 };
          return {
            description: `Recruits a level ${q.level} hero with every base stat at least ${q.minStat}. Needs a free Feasting Hall slot.`,
            use: 'direct',
          };
        }
        case 'chatIcon': {
          const c = CHAT_ICONS[id];
          const tier = ['', 'bronze', 'silver', 'gold'][c?.icon ?? 0];
          return { description: `Shows a ${tier} badge next to your name in chat ${duration(c?.durationMs ?? DAY)}.`, use: 'direct' };
        }
      }
      break;
    case 'command': {
      const text: Record<string, string> = {
        'consume.move.1': 'Moves your city to a random free spot in a state you choose.',
        'player.more.castle.1.a': 'Moves your city to a free flat tile of your choice.',
        'consume.changeflag.1': 'Changes the flag shown on your cities.',
        'player.name.1.a': "Changes your lord's name.",
        'consume.refreshtavern.1': "Replaces the Inn's hero offers for free.",
        'hero.reset.1': "Un-assigns all of a hero's level points so you can spend them again.",
        'player.peace.1': `Truce: your cities cannot be attacked ${duration(BALANCE.truceDurationMs)}, but you cannot attack either.`,
        'player.truce.dream': `Truce: your cities cannot be attacked ${duration(BALANCE.truceDurationMs)}, but you cannot attack either.`,
      };
      if (text[id]) return { description: text[id], use: 'elsewhere', howTo: HOW_TO[e.command] };
      return { description: 'Not usable on this server yet.', use: 'none' };
    }
  }
  return { description: 'Event item with no effect on this server.', use: 'none' };
}

/** Description and usage of one item (undefined for unknown ids). */
export function itemInfo(id: string): ItemInfo | undefined {
  const cfg = itemConfig(id);
  if (!cfg) return undefined;
  return { id, name: cfg.name.trim(), category: ITEM_CATEGORIES[cfg.type] ?? 'Other', price: cfg.buyable ? cfg.cost : 0, ...describe(id) };
}

/** Amulet prizes paid out directly (never held) and the test item are left out. */
const NOT_HELD = /^player\.box\.(gambling\.(food|wood|stone|iron|gold|medal\.10)|test\.1)$/;

/** Every item a lord can hold, by category and name. */
export const ITEM_INFO: ItemInfo[] = ITEMS.filter((i) => !NOT_HELD.test(i.id))
  .map((i) => itemInfo(i.id)!)
  .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

/** Where a medal comes from (Items tab): every number is computed from the same rules the server uses. */
export interface MedalSources {
  /** won attacks: chance per win of getting this medal (expected medals per win), by city level */
  attacks: { cityLevel: number; chance: number }[];
  /** as an Amulet prize (the daily gift is an Amulet) */
  amulet: { chance: number; min: number; max: number } | null;
  /** boxes and chests a lord can get (shop or Amulet) that hold it */
  containers: { id: string; name: string; min: number; max: number; always: boolean; price: number; amulet: boolean; key: string | null }[];
  /** one-off quest rewards */
  quests: { name: string; count: number }[];
}

export function medalSources(level: number): MedalSources {
  const id = medalId(level);
  const inRange = (r: readonly [number, number]) => (level >= r[0] && level <= r[1] ? 1 / (r[1] - r[0] + 1) : 0);
  const attacks: MedalSources['attacks'] = [];
  for (let L = 1; L <= 10; L++) {
    const o = medalOdds(L);
    // the main drop, then maybe a second extra drop and a third
    const chance = o.chance * (inRange(o.main) + o.second * inRange(o.extra) * (1 + o.third));
    if (chance > 0) attacks.push({ cityLevel: L, chance });
  }
  const containers: MedalSources['containers'] = [];
  for (const item of ITEMS) {
    const e = itemEffect(item.id);
    if (!e || (e.kind !== 'box' && e.kind !== 'chest')) continue;
    const price = item.buyable ? item.cost : 0;
    if (!price && !item.canGamble) continue;
    // random contents: look at many openings
    const rng = seededRng(`medal-sources:${item.id}`);
    const counts = Array.from({ length: e.kind === 'box' ? 200 : 1 }, () => (e.kind === 'box' ? e.contents(rng) : e.contents())?.items?.[id] ?? 0);
    const held = counts.filter((n) => n > 0);
    if (!held.length) continue;
    containers.push({
      id: item.id,
      name: item.name.trim(),
      min: Math.min(...held),
      max: Math.max(...held),
      always: held.length === counts.length,
      price,
      amulet: item.canGamble,
      key: e.kind === 'chest' ? (itemConfig(e.key)?.name.trim() ?? e.key) : null,
    });
  }
  const quests = QUEST_CATALOGUE.filter((q) => q.award.items?.[id]).map((q) => ({ name: q.name, count: q.award.items![id] }));
  return { attacks, amulet: amuletPrize(id), containers, quests };
}
