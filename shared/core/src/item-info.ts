// Player-facing item descriptions, derived from the declared effects (items.ts) and the rules
// that consume items elsewhere (speed-ups, hero items, teleporters ...), so the numbers shown
// always match what the server does. The original data has names but no descriptions.
// Descriptions are messages (messages/item-info.ts), worded by the client; item and category
// names come from the client's locale files by id.

import { BALANCE } from '#/balance.ts';
import { BuildingType, TROOP_ID_BY_KEY, type TroopKey } from '#/constants.ts';
import { SPEEDUP_ITEMS } from '#/construction.ts';
import { itemConfig, ITEMS } from '#/data/index.ts';
import { experienceItemGain } from '#/heroes.ts';
import { ItemId } from '#/item-ids.ts';
import { HERO_ATTRIBUTE_ITEMS, heroBoxQuality, itemEffect, itemGoldPrice, medalId, medalOdds } from '#/items.ts';
import { type Message, msg, ref, share } from '#/messages/index.ts';
import { QUEST_CATALOGUE } from '#/quests.ts';
import { seededRng } from '#/rng.ts';
import { DAY, HOUR, MINUTE } from '#/time.ts';
import type { GrantContents } from '#/types.ts';

export interface ItemInfo {
  id: string;
  /** shop category: the item's `type` (named by the client, data-item-categories) */
  category: number;
  description: Message;
  /**
   * `direct`: used from the inventory (POST /player/items/{id}/use, with the current city);
   * `elsewhere`: consumed by another action, see `howTo`; `none`: no effect on this server.
   */
  use: 'direct' | 'elsewhere' | 'none';
  howTo?: Message;
  /** shop price in city gold (0 = not sold; itemGoldPrice) */
  price: number;
}

/** A share param (0.3, shown as 30%). */
const pct = share;

/** A length of time as a phrase: whole days, else hours, else minutes. */
function period(ms: number): Message {
  if (ms >= DAY && ms % DAY === 0) return msg('itemInfo.period.days', { count: ms / DAY });
  if (ms >= HOUR) return msg('itemInfo.period.hours', { count: ms / HOUR });
  return msg('itemInfo.period.minutes', { count: ms / MINUTE });
}

function contents(c: GrantContents): Message[] {
  const parts: Message[] = [];
  for (const [id, n] of Object.entries(c.items ?? {})) parts.push(msg('itemInfo.contents.item', { amount: n, item: ref.item(id) }));
  for (const [r, n] of Object.entries(c.resources ?? {}))
    if (n) parts.push(msg('itemInfo.contents.amount', { amount: n, name: ref.resource(r as 'gold' | 'food' | 'wood' | 'stone' | 'iron') }));
  for (const [k, n] of Object.entries(c.troops ?? {}))
    if (n) parts.push(msg('itemInfo.contents.amount', { amount: n, name: ref.troop(TROOP_ID_BY_KEY[k as TroopKey]) }));
  return parts;
}

/** A construction / research speed-up, from what it actually cuts (construction.ts SPEEDUP_ITEMS). */
function speedupDescription(id: string): Message | undefined {
  const s = SPEEDUP_ITEMS[id];
  if (!s) return undefined;
  const low = s.reduce(0, () => 0);
  const high = s.reduce(0, () => 0.999_999);
  if (low === 0) return msg('itemInfo.speedup.percent', { percent: pct(s.reduce(1, () => 0)) });
  if (low !== high) return msg('itemInfo.speedup.hours', { min: low / HOUR, count: Math.round(high / HOUR) });
  return msg('itemInfo.speedup.time', { time: period(low) });
}

const HOW_TO = {
  speedup: msg('itemInfo.howTo.speedup'),
  'troops.speedup': msg('itemInfo.howTo.troopsSpeedup'),
  'fortifications.speedup': msg('itemInfo.howTo.fortificationsSpeedup'),
  'city.move': msg('itemInfo.howTo.cityMove'),
  'heroes.reset': msg('itemInfo.howTo.heroesReset'),
  'heroes.useItem': msg('itemInfo.howTo.heroesUseItem'),
  'city.truce': msg('itemInfo.howTo.cityTruce'),
} satisfies Record<string, Message>;
const howToFor = (command: string): Message | undefined => HOW_TO[command as keyof typeof HOW_TO];

/** Experience books: a share of the next level, at least a minimum (experienceItemGain). */
function experienceDescription(id: string): Message | undefined {
  const min = experienceItemGain(id, 0);
  if (!min) return undefined;
  const big = 1e9;
  const fraction = experienceItemGain(id, big) / big;
  return fraction >= 1 ? msg('itemInfo.experience.level', { min }) : msg('itemInfo.experience.share', { percent: pct(fraction), min });
}

const noEffect = (): Pick<ItemInfo, 'description' | 'use' | 'howTo'> => ({ description: msg('itemInfo.noEffect'), use: 'none' });

function describe(id: string): Pick<ItemInfo, 'description' | 'use' | 'howTo'> {
  const e = itemEffect(id);
  const speedup = speedupDescription(id);
  if (speedup) return { description: speedup, use: 'elsewhere', howTo: HOW_TO.speedup };
  if (e?.kind === 'command' && (e.command === 'troops.speedup' || e.command === 'fortifications.speedup')) {
    const code = e.command === 'troops.speedup' ? 'itemInfo.speedup.troopBatch' : 'itemInfo.speedup.fortBatch';
    return { description: msg(code, { percent: pct(BALANCE.items.batchSpeedupShare) }), use: 'elsewhere', howTo: howToFor(e.command) };
  }
  if (BALANCE.items.medalLoyalty[id])
    return {
      description: msg('itemInfo.loyalty', { amount: BALANCE.items.medalLoyalty[id], max: BALANCE.heroMaxLoyalty }),
      use: 'elsewhere',
      howTo: HOW_TO['heroes.useItem'],
    };
  if (HERO_ATTRIBUTE_ITEMS[id]) {
    const description = msg('itemInfo.heroStat', {
      stat: ref.stat(HERO_ATTRIBUTE_ITEMS[id]),
      percent: pct(BALANCE.items.heroAttributeBuff.bonus),
      period: period(BALANCE.items.heroAttributeBuff.durationMs),
    });
    return { description, use: 'elsewhere', howTo: HOW_TO['heroes.useItem'] };
  }
  const experience = experienceDescription(id);
  if (experience) return { description: experience, use: 'elsewhere', howTo: HOW_TO['heroes.useItem'] };
  const chestFor = ITEMS.find((i) => {
    const c = itemEffect(i.id);
    return c?.kind === 'chest' && c.key === id;
  });
  if (chestFor)
    return {
      description: msg('itemInfo.key', { chest: ref.item(chestFor.id) }),
      use: 'elsewhere',
      howTo: msg('itemInfo.howTo.key', { chest: ref.item(chestFor.id) }),
    };

  if (!e) return noEffect();
  switch (e.kind) {
    case 'buff':
      return { description: msg('itemInfo.buff', { effect: e.desc, period: period(e.durationMs) }), use: 'direct' };
    case 'grant': {
      const toCity = !!(e.resources || e.troops);
      const description = msg(toCity ? 'itemInfo.grantCity' : 'itemInfo.grant', { contents: contents(e) });
      // the Welcome Package is never sold or won: every new player gets one (player.createPlayer)
      if (id === ItemId.WELCOME_PACKAGE) return { description, use: 'direct', howTo: msg('itemInfo.howTo.welcome') };
      return { description, use: 'direct' };
    }
    case 'chest':
      return { description: msg('itemInfo.chest', { key: ref.item(e.key), contents: contents(e.contents()) }), use: 'direct' };
    case 'box':
      if (BALANCE.items.medalBoxes[id])
        return {
          description: msg('itemInfo.medalBox', {
            min: BALANCE.items.medalBoxCount.min,
            max: BALANCE.items.medalBoxCount.max,
            medals: BALANCE.items.medalBoxes[id].map((l) => ref.item(medalId(l))),
          }),
          use: 'direct',
        };
      return { description: msg('itemInfo.randomBox'), use: 'direct' };
    case 'special':
      switch (e.handler) {
        case 'civilCode':
          return { description: msg('itemInfo.civilCode', { percent: pct(BALANCE.items.civilCode.share), min: BALANCE.items.civilCode.min }), use: 'direct' };
        case 'cureInjured':
          return { description: msg('itemInfo.cureInjured'), use: 'direct' };
        case 'heroBox': {
          const q = heroBoxQuality(id);
          return {
            description: msg('itemInfo.heroBox', { level: q.level, minStat: q.minStat, building: ref.building(BuildingType.FEASTING_HALL) }),
            use: 'direct',
          };
        }
      }
      break;
    case 'command': {
      const text: Record<string, Message> = {
        [ItemId.CITY_TELEPORTER]: msg('itemInfo.teleporter', { period: period(BALANCE.teleportCooldownMs) }),
        [ItemId.HOLY_WATER]: msg('itemInfo.holyWater'),
        [ItemId.TRUCE_AGREEMENT]: msg('itemInfo.truce', { period: period(BALANCE.truceDurationMs) }),
      };
      if (text[id]) return { description: text[id], use: 'elsewhere', howTo: howToFor(e.command) };
      return { description: msg('itemInfo.notUsable'), use: 'none' };
    }
  }
  return noEffect();
}

/** Description and usage of one item (undefined for unknown ids). */
export function itemInfo(id: string): ItemInfo | undefined {
  const cfg = itemConfig(id);
  if (!cfg) return undefined;
  return { id, category: cfg.type, price: itemGoldPrice(id) ?? 0, ...describe(id) };
}

/** Every item a player can hold, by category (the client sorts by name in the player's language). */
export const ITEM_INFO: ItemInfo[] = ITEMS.map((i) => itemInfo(i.id)!).sort((a, b) => a.category - b.category || a.id.localeCompare(b.id));

/** The shop categories items fall in (item `type`), in order; the client names them (data-item-categories). */
export const ITEM_CATEGORY_IDS: number[] = [...new Set(ITEMS.map((i) => i.type))].sort((a, b) => a - b);

/** Where a medal comes from (Items tab): every number is computed from the same rules the server uses. */
export interface MedalSources {
  /** won attacks: chance per win of getting this medal (expected medals per win), by city level */
  attacks: { cityLevel: number; chance: number }[];
  /** boxes and chests sold for gold that hold it (item ids); price in gold; `key`: the item id that opens a chest */
  containers: { id: string; min: number; max: number; always: boolean; price: number; key: string | null }[];
  /** one-off quest rewards (quest id) */
  quests: { questId: number; count: number }[];
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
    const price = itemGoldPrice(item.id) ?? 0;
    if (!price) continue;
    // random contents: look at many openings
    const rng = seededRng(`medal-sources:${item.id}`);
    const counts = Array.from({ length: e.kind === 'box' ? 200 : 1 }, () => (e.kind === 'box' ? e.contents(rng) : e.contents())?.items?.[id] ?? 0);
    const held = counts.filter((n) => n > 0);
    if (!held.length) continue;
    containers.push({
      id: item.id,
      min: Math.min(...held),
      max: Math.max(...held),
      always: held.length === counts.length,
      price,
      key: e.kind === 'chest' ? e.key : null,
    });
  }
  const quests = QUEST_CATALOGUE.filter((q) => q.award.items?.[id]).map((q) => ({ questId: q.id, count: q.award.items![id] }));
  return { attacks, containers, quests };
}
