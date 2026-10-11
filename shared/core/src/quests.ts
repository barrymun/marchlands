// Quests. The original returned a single hard-coded dummy quest; config_quests only names the
// quest groups. This catalogue recreates Evony's beginner quest chains with evaluable targets.
// No text here: quest and group names are `data-quests` in the client's locale files, descriptions and
// targets are messages (`questInfo.*`).

import { FORT_ID_BY_KEY, TROOP_ID_BY_KEY, type FortKey, type TroopKey } from './constants.ts';
import { QUESTS } from './data/index.ts';
import { msg, ref, type Message } from './messages/index.ts';
import type { ResourceSet } from './types.ts';
import { ItemId } from './item-ids.ts';

export type QuestTarget =
  | { kind: 'building'; typeId: number; level: number; count?: number }
  | { kind: 'research'; techId: number; level: number }
  | { kind: 'troops'; key: TroopKey | FortKey; count: number }
  | { kind: 'heroes'; count: number }
  | { kind: 'mayor' }
  | { kind: 'alliance' }
  | { kind: 'cities'; count: number }
  | { kind: 'valleys'; count: number }
  | { kind: 'prestige'; amount: number }
  | { kind: 'population'; amount: number }
  | { kind: 'taxRate'; max: number }
  | { kind: 'mailSent' }
  | { kind: 'friend' };

/**
 * A quest. Its name is game data in the client's locale files (`data-quests`, `quest.<id>`); its description
 * is a message (`questInfo.description.*`) and each target is worded from its kind (questTargetMessage).
 */
export interface QuestDef {
  id: number;
  /**
   * quest group: the id of its config_quests row (named by `data-quests` `group.<id>`). Not the row's typeId:
   * several rows share one (Rebuild, The Medals and Prestige Building are all typeId 1).
   */
  groupId: number;
  description: Message;
  targets: QuestTarget[];
  award: { resources?: Partial<ResourceSet>; items?: Record<string, number> };
  /** quests that must be claimed first */
  after?: number[];
}

/** Everything the quest engine needs to evaluate targets for a player. */
export interface QuestSnapshot {
  /** typeId -> levels of every building of that type across all cities */
  buildings: Record<number, number[]>;
  research: Record<number, number>;
  troops: Record<string, number>;
  heroes: number;
  hasMayor: boolean;
  inAlliance: boolean;
  cities: number;
  valleys: number;
  prestige: number;
  population: number;
  minTaxRate: number;
  mailsSent: number;
  friends: number;
}

const res = (food: number, wood: number, stone: number, iron: number, gold = 0): Partial<ResourceSet> => ({ food, wood, stone, iron, gold });
const b = (typeId: number, level: number, count?: number): QuestTarget => ({ kind: 'building', typeId, level, count });
const troopId = (key: TroopKey | FortKey): number => (key in TROOP_ID_BY_KEY ? TROOP_ID_BY_KEY[key as TroopKey] : FORT_ID_BY_KEY[key as FortKey]);

// descriptions built from the quest's one target, so the numbers and names in them follow its data
const upgrade = (t: QuestTarget) => t.kind === 'building' && msg('questInfo.description.upgrade', { building: ref.building(t.typeId), level: t.level });
const upgradeAny = (t: QuestTarget) => t.kind === 'building' && msg('questInfo.description.upgradeAny', { building: ref.building(t.typeId), level: t.level });
const field = (t: QuestTarget) => t.kind === 'building' && msg('questInfo.description.field', { building: ref.building(t.typeId) });
type BuildCode =
  | 'questInfo.description.cottage'
  | 'questInfo.description.rallySpot'
  | 'questInfo.description.barracks'
  | 'questInfo.description.warehouse'
  | 'questInfo.description.academy'
  | 'questInfo.description.walls'
  | 'questInfo.description.embassy'
  | 'questInfo.description.inn'
  | 'questInfo.description.feastingHall';
const build = (code: BuildCode) => (t: QuestTarget) => t.kind === 'building' && msg(code, { building: ref.building(t.typeId) });
const research = (t: QuestTarget) => t.kind === 'research' && msg('questInfo.description.research', { tech: ref.tech(t.techId) });
const fixed = (m: Message) => () => m;

let nextId = 1000;
/** A quest with one target; `describe` words its description from that target. */
const q = (groupId: number, target: QuestTarget, describe: (t: QuestTarget) => Message | false, award: QuestDef['award'], after?: number[]): QuestDef => {
  const description = describe(target);
  if (!description) throw new Error(`quest ${nextId}: no description for a ${target.kind} target`);
  return { id: nextId++, groupId, description, targets: [target], award, after };
};

// ids are given in order from 1000 and are stored (quest_progress): only ever append quests.
export const QUEST_CATALOGUE: QuestDef[] = [
  // 1 Rebuild
  q(1, b(31, 2), upgrade, { resources: res(2000, 2000, 2000, 2000, 1000) }), // Town Hall
  q(1, b(1, 1), build('questInfo.description.cottage'), { resources: res(1000, 1500, 500, 500) }), // Cottages
  q(1, b(29, 1), build('questInfo.description.rallySpot'), { resources: res(1000, 1000, 2000, 500) }), // Rally Spot
  q(1, b(2, 1), build('questInfo.description.barracks'), { resources: res(2000, 2000, 2000, 1000) }), // Barracks
  q(1, b(3, 1), build('questInfo.description.warehouse'), { resources: res(1000, 2000, 1500, 500) }), // Warehouse
  q(1, b(25, 1), build('questInfo.description.academy'), { resources: res(2000, 3000, 2000, 500, 1000) }), // Academy
  q(1, b(31, 3), upgrade, { resources: res(5000, 5000, 5000, 5000, 3000) }), // Town Hall III
  q(1, b(32, 1), build('questInfo.description.walls'), { resources: res(4000, 2000, 10000, 1000) }), // Walls
  // 2 Domain Expansion
  q(2, b(7, 1), field, { resources: res(500, 300, 200, 150) }), // Farmland
  q(2, b(4, 1), field, { resources: res(100, 200, 250, 300) }), // Sawmill
  q(2, b(5, 1), field, { resources: res(200, 500, 150, 400) }), // Quarry
  q(2, b(6, 1), field, { resources: res(250, 600, 500, 200) }), // Ironmine
  // 3 Commodity Gathering
  q(3, b(7, 3), upgradeAny, { resources: res(3000, 2000, 1000, 1000) }), // Bountiful Fields
  q(3, b(4, 3), upgradeAny, { resources: res(1000, 3000, 1000, 1000) }), // Lumber Industry
  q(3, b(7, 1, 5), (t) => t.kind === 'building' && msg('questInfo.description.ownFields', { building: ref.building(t.typeId), count: t.count ?? 1 }), {
    items: { [ItemId.PLOWSHARES]: 1 },
  }), // Field Network
  // 6 Administration
  q(6, { kind: 'mayor' }, fixed(msg('questInfo.description.appointMayor')), { items: { [ItemId.CROSS_MEDAL]: 1 } }), // Appoint a Mayor
  q(6, { kind: 'taxRate', max: 20 }, (t) => t.kind === 'taxRate' && msg('questInfo.description.taxRate', { max: t.max }), {
    resources: res(1000, 1000, 1000, 1000, 1000),
  }), // Fair Taxes
  // 8 Scientific Research
  q(8, { kind: 'research', techId: 1, level: 1 }, research, { resources: res(2000, 1000, 1000, 1000) }), // Agriculture
  q(8, { kind: 'research', techId: 8, level: 1 }, research, { items: { [ItemId.PRIMARY_GUIDELINES]: 1 } }), // Military Science
  // 9 Alliance
  q(9, b(28, 1), build('questInfo.description.embassy'), { resources: res(1000, 2000, 500, 300) }), // Embassy
  q(9, { kind: 'alliance' }, fixed(msg('questInfo.description.joinAlliance')), { resources: { gold: 50_000 } }), // Join an Alliance
  // 10 Correspondence
  q(10, { kind: 'mailSent' }, fixed(msg('questInfo.description.sendMail')), { resources: res(500, 500, 500, 500) }), // Correspondence
  // 11 Hero Recruitment
  q(11, b(21, 1), build('questInfo.description.inn'), { resources: res(500, 2000, 1000, 400) }), // Inn
  q(11, b(27, 1), build('questInfo.description.feastingHall'), { resources: res(1000, 2500, 1200, 700) }), // Feasting Hall
  q(11, { kind: 'heroes', count: 1 }, fixed(msg('questInfo.description.recruitHero')), { resources: { gold: 20_000 } }), // Recruit a Hero
  // 12 Military Service
  q(
    12,
    { kind: 'troops', key: 'militia', count: 100 },
    (t) => t.kind === 'troops' && msg('questInfo.description.train', { troop: ref.troop(troopId(t.key)), count: t.count }),
    { resources: res(5000, 5000, 0, 2500) },
  ), // Militia
  // 14 Fortification
  q(
    14,
    { kind: 'troops', key: 'trap', count: 100 },
    (t) => t.kind === 'troops' && msg('questInfo.description.fortify', { troop: ref.troop(troopId(t.key)), count: t.count }),
    { resources: res(2000, 10000, 2000, 1000) },
  ), // Traps
  // 16 City Expansion
  q(16, { kind: 'cities', count: 2 }, fixed(msg('questInfo.description.secondCity')), { resources: { gold: 165_000 } }), // Second City (orig 20 cents)
  // 15 Colony
  q(15, { kind: 'valleys', count: 1 }, fixed(msg('questInfo.description.occupyValley')), { resources: res(5000, 5000, 5000, 5000) }), // Valley Holder
  // 20 Population Increase
  q(20, { kind: 'population', amount: 1000 }, (t) => t.kind === 'population' && msg('questInfo.description.population', { amount: t.amount }), {
    items: { [ItemId.CIVIL_CODE]: 1 },
  }), // Growing Town
  // 23 Prestige Building
  q(23, { kind: 'prestige', amount: 10_000 }, (t) => t.kind === 'prestige' && msg('questInfo.description.prestige', { amount: t.amount }), {
    items: { [ItemId.LION_MEDAL]: 1 },
  }), // Rising Star
];

/** What a target asks for, as a message ("Town Hall level 2"). */
export function questTargetMessage(t: QuestTarget): Message {
  switch (t.kind) {
    case 'building':
      return (t.count ?? 1) > 1
        ? msg('questInfo.target.buildings', { building: ref.building(t.typeId), level: t.level, count: t.count ?? 1 })
        : msg('questInfo.target.building', { building: ref.building(t.typeId), level: t.level });
    case 'research':
      return msg('questInfo.target.research', { tech: ref.tech(t.techId), level: t.level });
    case 'troops':
      return msg('questInfo.target.troops', { troop: ref.troop(troopId(t.key)), count: t.count });
    case 'heroes':
      return msg('questInfo.target.heroes', { count: t.count });
    case 'mayor':
      return msg('questInfo.target.mayor');
    case 'alliance':
      return msg('questInfo.target.alliance');
    case 'cities':
      return msg('questInfo.target.cities', { count: t.count });
    case 'valleys':
      return msg('questInfo.target.valleys', { count: t.count });
    case 'prestige':
      return msg('questInfo.target.prestige', { amount: t.amount });
    case 'population':
      return msg('questInfo.target.population', { amount: t.amount });
    case 'taxRate':
      return msg('questInfo.target.taxRate', { max: t.max });
    case 'mailSent':
      return msg('questInfo.target.mailSent');
    case 'friend':
      return msg('questInfo.target.friend');
  }
}

export const questGroups = () => QUESTS;

/** The quest groups that have quests, in config order. */
export const questGroupsWithQuests = () => QUESTS.filter((g) => QUEST_CATALOGUE.some((q) => q.groupId === g.id));

export function evaluateTarget(t: QuestTarget, s: QuestSnapshot): boolean {
  switch (t.kind) {
    case 'building':
      return (s.buildings[t.typeId] ?? []).filter((l) => l >= t.level).length >= (t.count ?? 1);
    case 'research':
      return (s.research[t.techId] ?? 0) >= t.level;
    case 'troops':
      return (s.troops[t.key] ?? 0) >= t.count;
    case 'heroes':
      return s.heroes >= t.count;
    case 'mayor':
      return s.hasMayor;
    case 'alliance':
      return s.inAlliance;
    case 'cities':
      return s.cities >= t.count;
    case 'valleys':
      return s.valleys >= t.count;
    case 'prestige':
      return s.prestige >= t.amount;
    case 'population':
      return s.population >= t.amount;
    case 'taxRate':
      return s.minTaxRate <= t.max;
    case 'mailSent':
      return s.mailsSent > 0;
    case 'friend':
      return s.friends > 0;
  }
}

export const questById = (id: number) => QUEST_CATALOGUE.find((x) => x.id === id);
