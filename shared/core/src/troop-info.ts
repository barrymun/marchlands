// Player-facing troop and fortification descriptions: the unit's role, its special rules in the
// battle simulator (battle/simulator.ts: damage modifiers, targeting, fortification triggers) and
// on missions (armies.ts / combat.ts), and fortification wall space (BALANCE.fortSpace).
// Each is a `troopInfo.*` message, worded by the client.

import { BALANCE } from '#/balance.ts';
import { BuildingType, TechType } from '#/constants.ts';
import { troopConfig } from '#/data/index.ts';
import { type Message, msg, ref, share } from '#/messages/index.ts';

const { damage } = BALANCE.battle;
/** Ranged units archers and siege engines shoot first (battle/simulator.ts RANGED, plus the tower). */
const RANGED_IDS = [7, 11, 13, 16];

const load = (id: number) => troopConfig(id)?.load ?? 0;
const space = (id: number) => BALANCE.fortSpace[id] ?? 1;

const TEXT: Record<number, () => Message> = {
  2: () => msg('troopInfo.worker', { count: load(2) }),
  3: () => msg('troopInfo.warrior'),
  4: () => msg('troopInfo.scout'),
  5: () => msg('troopInfo.pikeman', { multiplier: damage.pikemanVsMounted, cavalry: ref.troop(9), cataphract: ref.troop(10) }),
  6: () => msg('troopInfo.swordsman', { multiplier: damage.swordsmanVsPikeman, target: ref.troop(5) }),
  7: () => msg('troopInfo.archer', { targets: RANGED_IDS.map(ref.troop) }),
  8: () => msg('troopInfo.transporter', { count: load(8) }),
  9: () => msg('troopInfo.cavalry', { multiplier: damage.mountedVsArcher, target: ref.troop(7), abatis: ref.troop(15) }),
  10: () => msg('troopInfo.cataphract', { multiplier: damage.mountedVsArcher, target: ref.troop(7), abatis: ref.troop(15) }),
  11: () => msg('troopInfo.ballista'),
  12: () => msg('troopInfo.batteringRam'),
  13: () => msg('troopInfo.catapult'),
  14: () => msg('troopInfo.trap', { space: space(14) }),
  15: () => msg('troopInfo.abatis', { cavalry: ref.troop(9), cataphract: ref.troop(10), space: space(15) }),
  16: () =>
    msg('troopInfo.archerTower', {
      walls: ref.building(BuildingType.WALLS),
      percent: share(BALANCE.battle.towerDamageTaken),
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
