// Player-facing troop and fortification descriptions: the unit's role, its special rules in the
// battle simulator (battle/simulator.ts: damage modifiers, targeting, fortification triggers) and
// on missions (armies.ts / combat.ts), and fortification wall space (BALANCE.fortSpace).
// Each is a `troopInfo.*` message, worded by the client.

import { BALANCE } from './balance.ts';
import { BuildingType, TechType } from './constants.ts';
import { troopConfig } from './data/index.ts';
import { msg, ref, type Message } from './messages/index.ts';

/** Damage multipliers and the tower's damage taken, as in battle/simulator.ts damageModifier. */
const PIKEMAN_VS_HORSE = 1.8;
const SWORDSMAN_VS_PIKEMAN = 1.1;
const HORSE_VS_ARCHER = 1.2;
const TOWER_DAMAGE_TAKEN_PERCENT = 30;
/** Ranged units archers and siege engines shoot first (battle/simulator.ts RANGED, plus the tower). */
const RANGED_IDS = [7, 11, 13, 16];

const load = (id: number) => troopConfig(id)?.load ?? 0;
const space = (id: number) => BALANCE.fortSpace[id] ?? 1;

const TEXT: Record<number, () => Message> = {
  2: () => msg('troopInfo.worker', { count: load(2) }),
  3: () => msg('troopInfo.warrior'),
  4: () => msg('troopInfo.scout'),
  5: () => msg('troopInfo.pikeman', { multiplier: PIKEMAN_VS_HORSE, cavalry: ref.troop(9), cataphract: ref.troop(10) }),
  6: () => msg('troopInfo.swordsman', { multiplier: SWORDSMAN_VS_PIKEMAN, target: ref.troop(5) }),
  7: () => msg('troopInfo.archer', { targets: RANGED_IDS.map(ref.troop) }),
  8: () => msg('troopInfo.transporter', { count: load(8) }),
  9: () => msg('troopInfo.cavalry', { multiplier: HORSE_VS_ARCHER, target: ref.troop(7), abatis: ref.troop(15) }),
  10: () => msg('troopInfo.cataphract', { multiplier: HORSE_VS_ARCHER, target: ref.troop(7), abatis: ref.troop(15) }),
  11: () => msg('troopInfo.ballista'),
  12: () => msg('troopInfo.batteringRam'),
  13: () => msg('troopInfo.catapult'),
  14: () => msg('troopInfo.trap', { space: space(14) }),
  15: () => msg('troopInfo.abatis', { cavalry: ref.troop(9), cataphract: ref.troop(10), space: space(15) }),
  16: () =>
    msg('troopInfo.archerTower', {
      walls: ref.building(BuildingType.WALLS),
      percent: TOWER_DAMAGE_TAKEN_PERCENT,
      techs: [ref.tech(TechType.ARCHERY), ref.tech(TechType.MEDICINE), ref.tech(TechType.IRON_WORKING)],
      space: space(16),
    }),
  17: () => msg('troopInfo.rollingLog', { space: space(17) }),
  18: () => msg('troopInfo.trebuchet', { space: space(18) }),
};

/** Role and special rules of a troop or fortification type (undefined for unknown ids). */
export function troopDescription(troopId: number): Message | undefined {
  return TEXT[troopId]?.();
}
