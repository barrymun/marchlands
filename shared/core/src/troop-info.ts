// Player-facing troop and fortification descriptions: the unit's role, its special rules in the
// battle simulator (battle/simulator.ts: damage modifiers, targeting, fortification triggers) and
// on missions (armies.ts / combat.ts), and fortification wall space (BALANCE.fortSpace).

import { BALANCE } from './balance.ts';
import { troopConfig } from './data/index.ts';

const fmt = (n: number) => n.toLocaleString('en');
const carries = (id: number) => `carries ${fmt(troopConfig(id)?.load ?? 0)} resources`;
const space = (id: number) => `Takes ${BALANCE.fortSpace[id] ?? 1} wall space.`;

const TEXT: Record<number, () => string> = {
  2: () => `Cheap, weak labourers; each ${carries(2)}. Good for padding an army or hauling plunder, not for fighting.`,
  3: () => 'Basic foot soldiers: cheap melee troops that fight whatever is closest.',
  4: () =>
    'The fastest unit. Needed to scout (scouting battles are fought between scouts only). In a battle they hang back while other troops are still fighting.',
  5: () => 'Melee spearmen built to stop horses: deal ×1.8 damage to Cavalry and Cataphracts.',
  6: () => 'Sturdy melee infantry with high defence; deal ×1.1 damage to Pikemen.',
  7: () => 'Ranged foot troops with long reach; they shoot enemy ranged units (archers, ballistas, catapults, towers) first.',
  8: () => `Supply wagons: each ${carries(8)}, by far the most. They stay out of the fight while other troops remain, so pair them with an escort.`,
  9: () => 'Fast mounted troops; deal ×1.2 damage to Archers. Hurt by enemy Abatis.',
  10: () => 'Heavy armoured cavalry: tough and hard-hitting, deal ×1.2 damage to Archers. Hurt by enemy Abatis.',
  11: () => 'Siege engine with long range and high attack; shoots ranged units first and batters the walls when nothing else is in reach.',
  12: () => 'Siege engine with enormous life (it soaks up damage) that smashes the walls; slow.',
  13: () => 'The longest-range, hardest-hitting siege engine; devastating against walls and ranged units, but slow and fragile up close.',
  14: () => `Hidden pits: when attackers reach the last stretch before the walls, traps kill some of every group there, and are used up. ${space(14)}`,
  15: () => `Spiked barricades that only hit Cavalry and Cataphracts approaching the walls. ${space(15)}`,
  16: () =>
    `Archers on the walls: shoot attackers from range (range grows with the Walls level) and take only 30% damage. Upgraded by Archery, Medicine and Iron Working. ${space(16)}`,
  17: () => `Logs rolled down on the strongest group of foot troops near the walls; used up. ${space(17)}`,
  18: () => `Hurls rocks at the strongest attacking group within long range; used up. ${space(18)}`,
};

/** Role and special rules of a troop or fortification type ('' for unknown ids). */
export function troopDescription(troopId: number): string {
  return TEXT[troopId]?.() ?? '';
}
