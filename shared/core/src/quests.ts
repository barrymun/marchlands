// Quests. The original returned a single hard-coded dummy quest; config_quests only names the
// quest groups. This catalogue recreates Evony's beginner quest chains with evaluable targets.

import { QUESTS } from './data/index.ts';
import type { ResourceSet } from './types.ts';

export type QuestTarget =
  | { kind: 'building'; typeId: number; level: number; count?: number }
  | { kind: 'research'; techId: number; level: number }
  | { kind: 'troops'; key: string; count: number }
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

export interface QuestDef {
  id: number;
  /** quest group (config_quests row) */
  groupId: number;
  name: string;
  description: string;
  targets: { name: string; target: QuestTarget }[];
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

let nextId = 1000;
const q = (groupId: number, name: string, description: string, targets: QuestDef['targets'], award: QuestDef['award'], after?: number[]): QuestDef => ({
  id: nextId++,
  groupId,
  name,
  description,
  targets,
  award,
  after,
});

export const QUEST_CATALOGUE: QuestDef[] = [
  // 1 Rebuild
  q(1, 'Town Hall', 'Upgrade your Town Hall to level 2.', [{ name: 'Town Hall level 2', target: b(31, 2) }], { resources: res(2000, 2000, 2000, 2000, 1000) }),
  q(1, 'Cottages', 'Build a Cottage to house more people.', [{ name: 'Cottage level 1', target: b(1, 1) }], { resources: res(1000, 1500, 500, 500) }),
  q(1, 'Rally Spot', 'Build a Rally Spot to organise your troops.', [{ name: 'Rally Spot level 1', target: b(29, 1) }], { resources: res(1000, 1000, 2000, 500) }),
  q(1, 'Barracks', 'Build Barracks to train troops.', [{ name: 'Barracks level 1', target: b(2, 1) }], { resources: res(2000, 2000, 2000, 1000) }),
  q(1, 'Warehouse', 'Build a Warehouse to protect your goods.', [{ name: 'Warehouse level 1', target: b(3, 1) }], { resources: res(1000, 2000, 1500, 500) }),
  q(1, 'Academy', 'Build an Academy to research technologies.', [{ name: 'Academy level 1', target: b(25, 1) }], { resources: res(2000, 3000, 2000, 500, 1000) }),
  q(1, 'Town Hall III', 'Upgrade your Town Hall to level 3.', [{ name: 'Town Hall level 3', target: b(31, 3) }], { resources: res(5000, 5000, 5000, 5000, 3000) }),
  q(1, 'Walls', 'Build Walls to defend your city.', [{ name: 'Walls level 1', target: b(32, 1) }], { resources: res(4000, 2000, 10000, 1000) }),
  // 2 Domain Expansion
  q(2, 'Farmland', 'Build a Farm outside your city.', [{ name: 'Farm level 1', target: b(7, 1) }], { resources: res(500, 300, 200, 150) }),
  q(2, 'Sawmill', 'Build a Sawmill outside your city.', [{ name: 'Sawmill level 1', target: b(4, 1) }], { resources: res(100, 200, 250, 300) }),
  q(2, 'Quarry', 'Build a Quarry outside your city.', [{ name: 'Quarry level 1', target: b(5, 1) }], { resources: res(200, 500, 150, 400) }),
  q(2, 'Ironmine', 'Build an Ironmine outside your city.', [{ name: 'Ironmine level 1', target: b(6, 1) }], { resources: res(250, 600, 500, 200) }),
  // 4 Commodity Gathering
  q(4, 'Bountiful Fields', 'Upgrade a Farm to level 3.', [{ name: 'Farm level 3', target: b(7, 3) }], { resources: res(3000, 2000, 1000, 1000) }),
  q(4, 'Lumber Industry', 'Upgrade a Sawmill to level 3.', [{ name: 'Sawmill level 3', target: b(4, 3) }], { resources: res(1000, 3000, 1000, 1000) }),
  q(4, 'Field Network', 'Own five Farms.', [{ name: '5 Farms', target: b(7, 1, 5) }], { items: { 'player.resinc.1': 1 } }),
  // 6 Administration
  q(6, 'Appoint a Mayor', 'Hire a hero and appoint them mayor.', [{ name: 'Appoint a mayor', target: { kind: 'mayor' } }], { items: { 'hero.loyalty.1': 1 } }),
  q(6, 'Fair Taxes', 'Set your tax rate to 20% or less.', [{ name: 'Tax rate at most 20%', target: { kind: 'taxRate', max: 20 } }], { resources: res(1000, 1000, 1000, 1000, 1000) }),
  // 8 Scientific Research
  q(8, 'Agriculture', 'Research Agriculture.', [{ name: 'Agriculture level 1', target: { kind: 'research', techId: 1, level: 1 } }], { resources: res(2000, 1000, 1000, 1000) }),
  q(8, 'Military Science', 'Research Military Science.', [{ name: 'Military Science level 1', target: { kind: 'research', techId: 8, level: 1 } }], { items: { 'consume.2.b': 1 } }),
  // 9 Alliance
  q(9, 'Embassy', 'Build an Embassy.', [{ name: 'Embassy level 1', target: b(28, 1) }], { resources: res(1000, 2000, 500, 300) }),
  q(9, 'Join an Alliance', 'Create or join an alliance.', [{ name: 'Be in an alliance', target: { kind: 'alliance' } }], { items: { 'player.box.gambling.3': 1 } }),
  // 10 Correspondence
  q(10, 'Correspondence', 'Send a letter to another lord.', [{ name: 'Send a mail', target: { kind: 'mailSent' } }], { resources: res(500, 500, 500, 500) }),
  // 11 Hero Recruitment / Military Service
  q(11, 'Inn', 'Build an Inn to meet heroes.', [{ name: 'Inn level 1', target: b(21, 1) }], { resources: res(500, 2000, 1000, 400) }),
  q(11, 'Feasting Hall', 'Build a Feasting Hall to host heroes.', [{ name: 'Feasting Hall level 1', target: b(27, 1) }], { resources: res(1000, 2500, 1200, 700) }),
  q(11, 'Recruit a Hero', 'Hire your first hero.', [{ name: 'Own 1 hero', target: { kind: 'heroes', count: 1 } }], { items: { 'consume.refreshtavern.1': 1 } }),
  q(11, 'Militia', 'Train 100 Warriors.', [{ name: '100 Warriors', target: { kind: 'troops', key: 'militia', count: 100 } }], { resources: res(5000, 5000, 0, 2500) }),
  // 14 Fortification
  q(14, 'Traps', 'Build 100 traps on your walls.', [{ name: '100 Traps', target: { kind: 'troops', key: 'trap', count: 100 } }], { resources: res(2000, 10000, 2000, 1000) }),
  // 16 City Expansion
  q(16, 'Second City', 'Found or conquer a second city.', [{ name: 'Own 2 cities', target: { kind: 'cities', count: 2 } }], { resources: { gold: 165_000 } }), // (orig 20 cents)
  // 15 Colony
  q(15, 'Valley Lord', 'Occupy a valley.', [{ name: 'Own 1 valley', target: { kind: 'valleys', count: 1 } }], { resources: res(5000, 5000, 5000, 5000) }),
  // 20 Population Increase
  q(20, 'Growing Town', 'Reach a population of 1,000.', [{ name: 'Population 1000', target: { kind: 'population', amount: 1000 } }], { items: { 'player.pop.1.a': 1 } }),
  // 21 The Medals / 23 Prestige
  q(23, 'Rising Lord', 'Reach 10,000 prestige.', [{ name: '10,000 prestige', target: { kind: 'prestige', amount: 10_000 } }], { items: { 'hero.loyalty.3': 1 } }),
];

export const questGroups = () => QUESTS;

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
