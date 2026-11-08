// Named battle scenarios: the mechanics the battle simulator implements, one readable case each.
// They come from comparing two Evony Age 2 combat guides with our Age 1 engine
// (docs/reference/combat-guides.md, Tests the guides make possible). Every battle runs as the server
// runs it (`fixes: true`) and is read through the simulator's trace: each round's positions and counts,
// and every kill on an attacking group. Battle indices are troop type id - 2, as in TROOP_KEY_LIST.

import { describe, expect, it } from 'vitest';

import { BALANCE } from '#/balance.ts';
import { type BattleSide, type DefenderSide, type ResearchStats, simulateBattle, type TraceEvent } from '#/battle/simulator.ts';
import { TROOP_KEY_LIST, TroopKey } from '#/constants.ts';
import { fortsToArray, troopsToArray } from '#/troops.ts';
import type { FortCounts, TroopCounts } from '#/types.ts';
import { npcTemplate } from '#/world.ts';

type RoundEvent = Extract<TraceEvent, { kind: 'round' }>;
type KillEvent = Extract<TraceEvent, { kind: 'kill' }>;

const RESEARCH_10: ResearchStats = { militaryTradition: 10, ironWorking: 10, medicine: 10, compass: 10, horsebackRiding: 10, archery: 10, machinery: 10 };
/** the defence item's bonus (Gambeson) */
const GAMBESON = 1 + BALANCE.battleBuffBonus;
/** one trap makes a field of 5200, and never fires: 5-9% of one trap rounds down to none */
const ONE_TRAP: FortCounts = { trap: 1 };

const at = (key: TroopKey) => TROOP_KEY_LIST.indexOf(key);

interface Side extends Omit<BattleSide, 'troops'> {
  troops: TroopCounts;
}
interface Defender extends Omit<DefenderSide, 'troops' | 'fortifications'> {
  troops: TroopCounts;
  forts?: FortCounts;
}

/** Run a battle and keep its trace. */
function fight(atk: Side, def: Defender) {
  const events: TraceEvent[] = [];
  const outcome = simulateBattle(
    { ...atk, troops: troopsToArray(atk.troops) },
    { ...def, troops: troopsToArray(def.troops), fortifications: fortsToArray(def.forts ?? {}) },
    { rng: { next: () => 0 }, fixes: true, trace: (e) => events.push(e) },
  );
  const rounds = events.filter((e): e is RoundEvent => e.kind === 'round');
  const kills = events.filter((e): e is KillEvent => e.kind === 'kill');
  return {
    outcome,
    rounds,
    kills,
    /** where an attacking group stands after round `r` */
    attackerAt: (r: number, key: TroopKey) => rounds[r]!.attacker[at(key)]!.location,
    defenderAt: (r: number, key: TroopKey) => rounds[r]!.defender[at(key)]!.location,
    /** defending troops of a type killed in round `r` */
    defenderLost: (r: number, key: TroopKey) =>
      (r === 0 ? (def.troops[key] ?? 0) : rounds[r - 1]!.defender[at(key)]!.count) - rounds[r]!.defender[at(key)]!.count,
  };
}

describe(simulateBattle.name, () => {
  describe('the field', () => {
    // The field is 200 + the longest base range of any troop or fortification present on either side.
    // A defending transporter never moves, so it stands at the far end: where the defender starts.
    it.each([
      ['archers', { archer: 1 }, {}, 1400],
      ['a ballista', { ballista: 1 }, {}, 1600],
      ['a catapult', { catapult: 1 }, {}, 1700],
      ['a trap', {}, ONE_TRAP, 5200],
    ] as [string, TroopCounts, FortCounts, number][])('with %s is %i long', (_, troops, forts, size) => {
      const { defenderAt } = fight({ research: {}, troops: { militia: 1 } }, { research: {}, troops: { ...troops, carriage: 1 }, forts });
      expect(defenderAt(0, TroopKey.CARRIAGE)).toBe(size);
    });

    // 1,000 cavalry at Horseback Riding 10 move 1500 in round 0. Against 1,000 archers and 1 ballista
    // (field 1600) they end 100 from the defender, inside their reach, and strike first. With a catapult
    // instead (field 1700) they end 200 short and hit nothing: one catapult denies cavalry their first strike.
    it('decides whether cavalry strike in round 1', () => {
      const ballista = fight({ research: RESEARCH_10, troops: { lightCavalry: 1000 } }, { research: RESEARCH_10, troops: { archer: 1000, ballista: 1 } });
      expect(ballista.attackerAt(0, TroopKey.LIGHT_CAVALRY)).toBe(1500);
      expect(ballista.defenderAt(0, TroopKey.ARCHER)).toBe(1600);
      // 1.2 (cavalry vs archers) x 1,000 x 250 attack x 0.925 (Iron Working 10) / 375 life (Medicine 10)
      expect(ballista.defenderLost(0, TroopKey.ARCHER)).toBe(740);

      const catapult = fight({ research: RESEARCH_10, troops: { lightCavalry: 1000 } }, { research: RESEARCH_10, troops: { archer: 1000, catapult: 1 } });
      expect(catapult.attackerAt(0, TroopKey.LIGHT_CAVALRY)).toBe(1500);
      expect(catapult.defenderAt(0, TroopKey.ARCHER)).toBe(1700);
      expect(catapult.defenderLost(0, TroopKey.ARCHER)).toBe(0);
    });
  });

  describe('movement', () => {
    // Speeds with research: cavalry 1000 +5% a level of Horseback Riding (1500 at 10), archers 250
    // +10% a level of Compass (500 at 10). Read from the first round on an open field of 5200.
    it('moves cavalry 1500 at Horseback Riding 10 and archers 500 at Compass 10', () => {
      const none = fight({ research: {}, troops: { lightCavalry: 1, archer: 1 } }, { research: {}, troops: { carriage: 1 }, forts: ONE_TRAP });
      expect([none.attackerAt(0, TroopKey.LIGHT_CAVALRY), none.attackerAt(0, TroopKey.ARCHER)]).toEqual([1000, 250]);
      const full = fight({ research: RESEARCH_10, troops: { lightCavalry: 1, archer: 1 } }, { research: {}, troops: { carriage: 1 }, forts: ONE_TRAP });
      expect([full.attackerAt(0, TroopKey.LIGHT_CAVALRY), full.attackerAt(0, TroopKey.ARCHER)]).toEqual([1500, 500]);
    });

    // 1 cavalry, 1 pikeman and 1 swordsman a side, all research 10, the defender with one trap (field 5200).
    // Speeds 1500, 600 and 550. The attacker starts at 0 and the defender at 5200.
    // Round 1: the defending cavalry move first and stop at 2200, and the attacking cavalry, which would
    // reach 3000, stop there too: a group never passes an enemy.
    it('moves each group toward the nearest enemy, round by round, never past it', () => {
      const { attackerAt, defenderAt } = fight(
        { research: RESEARCH_10, troops: { lightCavalry: 1, pikemen: 1, swordsmen: 1 } },
        { research: RESEARCH_10, troops: { lightCavalry: 1, pikemen: 1, swordsmen: 1 }, forts: ONE_TRAP },
      );
      const groups: TroopKey[] = [TroopKey.LIGHT_CAVALRY, TroopKey.PIKEMEN, TroopKey.SWORDSMEN];
      expect(groups.map((k) => attackerAt(0, k))).toEqual([1500, 600, 550]);
      expect(groups.map((k) => defenderAt(0, k))).toEqual([3700, 4600, 4650]);
      expect(groups.map((k) => attackerAt(1, k))).toEqual([2200, 1200, 1100]);
      expect(groups.map((k) => defenderAt(1, k))).toEqual([2200, 4000, 4100]);
    });
  });

  describe('melee targets', () => {
    // 100 cavalry against warriors and swordsmen on a field of 300 (cavalry range 100 + 200). The cavalry
    // reach 300 in round 0 and both defending groups are in range there, at the same distance, so the cavalry
    // hit the one with the larger attack x count: warriors 50 each, swordsmen 100 each.
    it.each([
      ['2,001 warriors (100,050) over 1,000 swordsmen (100,000)', 2001, 1000, TroopKey.MILITIA],
      ['500 swordsmen (50,000) over 999 warriors (49,950)', 999, 500, TroopKey.SWORDSMEN],
      ['the warriors on an exact tie (2,000 and 1,000), by order', 2000, 1000, TroopKey.MILITIA],
    ] as [string, number, number, TroopKey][])('hit %s', (_, militia, swordsmen, hit) => {
      const { defenderAt, defenderLost } = fight({ research: {}, troops: { lightCavalry: 100 } }, { research: {}, troops: { militia, swordsmen } });
      expect([defenderAt(0, TroopKey.MILITIA), defenderAt(0, TroopKey.SWORDSMEN)]).toEqual([300, 300]);
      const missed = hit === 'militia' ? 'swordsmen' : 'militia';
      expect(defenderLost(0, hit)).toBeGreaterThan(0);
      expect(defenderLost(0, missed)).toBe(0);
    });
  });

  describe('ranged targets', () => {
    // 100,000 defending archers (range 1800 with Archery 10, on a field of 1700, so every attacker is in
    // range from the start) against 1,000 each of archers, ballistae and catapults: they hit the ranged group
    // with the largest attack x count, a group a round: catapults (600 each), ballistae (450), archers (120).
    it('hit the enemy ranged group with the largest attack x count first', () => {
      const { kills } = fight(
        { research: RESEARCH_10, troops: { archer: 1000, ballista: 1000, catapult: 1000 } },
        { research: RESEARCH_10, troops: { archer: 100_000 } },
      );
      const volleys = kills.filter((k) => k.source === at(TroopKey.ARCHER)).map((k) => [k.round, k.target]);
      expect(volleys).toEqual([
        [0, at(TroopKey.CATAPULT)],
        [1, at(TroopKey.BALLISTA)],
        [2, at(TroopKey.ARCHER)],
      ]);
    });

    // 20,000 attacking archers, all research 10, against 1 ballista and 300 each of cataphracts, pikemen
    // and swordsmen: the ballista first (ranged before melee), then the fastest melee group in range, one
    // group wiped each round.
    it('then hit the fastest melee group: a ballista, then cataphracts, pikemen and swordsmen', () => {
      const { defenderLost } = fight(
        { research: RESEARCH_10, troops: { archer: 20_000 } },
        { research: RESEARCH_10, troops: { ballista: 1, heavyCavalry: 300, pikemen: 300, swordsmen: 300 } },
      );
      const groups: TroopKey[] = [TroopKey.BALLISTA, TroopKey.HEAVY_CAVALRY, TroopKey.PIKEMEN, TroopKey.SWORDSMEN];
      expect([0, 1, 2, 3].map((r) => groups.filter((k) => defenderLost(r, k) > 0))).toEqual([
        [TroopKey.BALLISTA],
        [TroopKey.HEAVY_CAVALRY],
        [TroopKey.PIKEMEN],
        [TroopKey.SWORDSMEN],
      ]);
    });

    // Speed, not distance: the attacker's scouts stay at 0 while the rest of the army lives, the farthest
    // from the defender, yet 20,000 defending archers hit them first, then the cataphracts at the front.
    // Ten scouts are a decoy that soaks a whole volley.
    it('pick the fastest melee group however far back: decoy scouts soak a volley', () => {
      const { kills } = fight(
        { research: RESEARCH_10, troops: { scouter: 10, heavyCavalry: 3000, pikemen: 3000 } },
        { research: RESEARCH_10, troops: { archer: 20_000 } },
      );
      const volleys = kills.filter((k) => k.source === at(TroopKey.ARCHER)).slice(0, 2);
      expect(volleys.map((k) => [k.round, k.target, k.location])).toEqual([
        [0, at(TroopKey.SCOUTER), 0],
        [1, at(TroopKey.HEAVY_CAVALRY), 1400],
      ]);
    });

    // 99,000 archers with 3.5 x attack (420 each) against 100,000 cavalry with Iron Working 10
    // (defence factor 1 - 1.5 x 180 / 1000 = 0.73, life 500): 420 x 0.73 x 99,000 / 500 = 60,707 killed.
    // Without Horseback Riding the cavalry stop 400 from the archers: within half the archers' range (600),
    // so full damage. With Horseback Riding 10 they reach the archers (distance 0), inside their own
    // reach of 100: point-blank, a quarter of the damage, 15,177.
    it('deal full damage within half range and a quarter at point-blank', () => {
      const archers = { research: {}, troops: { archer: 99_000 }, attackModifier: 3.5 };
      const full = fight(archers, { research: { ironWorking: 10 }, troops: { lightCavalry: 100_000 } });
      expect(full.defenderAt(0, TroopKey.LIGHT_CAVALRY)).toBe(400);
      expect(full.defenderLost(0, TroopKey.LIGHT_CAVALRY)).toBe(60_707);
      const pointBlank = fight(archers, { research: { ironWorking: 10, horsebackRiding: 10 }, troops: { lightCavalry: 100_000 } });
      expect(pointBlank.defenderAt(0, TroopKey.LIGHT_CAVALRY)).toBe(0);
      expect(pointBlank.defenderLost(0, TroopKey.LIGHT_CAVALRY)).toBe(15_177);
    });
  });

  describe('the defence factor', () => {
    // A troop's defence factor is max(1 - Iron Working x (100 + Intelligence) / 100 x base defence x item / 1000, 0.5),
    // with Iron Working 1 + 5% a level. Archers have base defence 50, so Iron Working 10 gives 0.925, the
    // Gambeson (+20%) 0.91, and Intelligence 35 with it 0.8785. Read from a melee strike, which multiplies
    // by the factor: 100,000 cavalry (Horseback Riding 10, so they reach the archers in round 0) kill
    // 1.2 (cavalry vs archers) x 100,000 x 250 attack x factor / 250 archer life.
    it.each([
      ['Iron Working 10', 1, 0, 111_000],
      ['Iron Working 10 and the Gambeson', GAMBESON, 0, 109_200],
      ['Iron Working 10, the Gambeson and Intelligence 35', GAMBESON, 35, 105_420],
    ])('of archers with %s', (_, defenceModifier, intel, killed) => {
      const { kills } = fight(
        { research: { ironWorking: 10 }, hero: { intel }, troops: { archer: 200_000 }, defenceModifier },
        { research: { horsebackRiding: 10 }, troops: { lightCavalry: 100_000 } },
      );
      const strike = kills.find((k) => k.source === at(TroopKey.LIGHT_CAVALRY));
      expect(strike).toMatchObject({ round: 0, target: at(TroopKey.ARCHER), killed });
    });
  });

  describe('archer towers', () => {
    // Range 1300 +5% a level of Archery +4.5% a wall level: 1300 x 1.95 = 2535 at Archery 10 and wall 10.
    // On a field of 5200 the towers reach attacking groups from 5200 - 2535 = 2665. Pinned with 1,000 towers
    // and 10,000 attackers walking on an open field: catapults at Horseback Riding 3 (92 a round) reach
    // 2576 then 2668, rams at Horseback Riding 6 (156 a round) reach 2652 then 2808. So the range is at least
    // 2532 (2668 is hit) and less than 2548 (2652 is not); a level less of Archery gives 2470 and a wall level less 2476.5.
    const firstHit = (troops: TroopCounts, horsebackRiding: number, archery: number, wallLevel: number) => {
      const { kills } = fight(
        { research: { horsebackRiding }, troops },
        { research: { archery }, troops: {}, forts: { trap: 1, arrowTower: 1000 }, wallLevel },
      );
      return kills.find((k) => k.source === 'tower')?.location;
    };

    it('reach 2535 at wall 10 with Archery 10', () => {
      expect(firstHit({ catapult: 10_000 }, 3, 10, 10)).toBe(2668);
      expect(firstHit({ batteringRam: 10_000 }, 6, 10, 10)).toBe(2808);
      expect(firstHit({ catapult: 10_000 }, 3, 9, 10)).toBe(2760);
      expect(firstHit({ catapult: 10_000 }, 3, 10, 9)).toBe(2760);
    });
  });

  describe('traps and ranged groups (Age 1 rules)', () => {
    // Where the calculator we port differs from Age 1 players' battle reports, server battles follow the reports
    // (docs/reference/ballista-farming-and-wall-range.md, docs/deviations.md): traps only stop ground troops, and an
    // attacking ranged group stands off once the wall is in its range.
    const trapKills = (troops: TroopCounts) =>
      fight({ research: RESEARCH_10, troops }, { research: {}, troops: {}, forts: { trap: 10_000 }, wallLevel: 1 }).kills.filter((k) => k.source === 'trap');

    it('traps hit ground troops, not mounted troops or siege engines', () => {
      expect(trapKills({ militia: 1000 }).length).toBeGreaterThan(0);
      expect(trapKills({ lightCavalry: 1000, heavyCavalry: 1000, carriage: 1000, ballista: 1000, batteringRam: 1000, catapult: 1000 })).toEqual([]);
    });

    it('lets 500 ballistae farm a level 5 barbarian city without losses, standing off the wall', () => {
      // The standard Age 1 farm: the ballistae walk past the traps, stop once the wall is in range, outside the
      // towers' reach, and shoot the towers and then the wall from there.
      const npc = npcTemplate(5);
      const { outcome, rounds, kills } = fight(
        { research: RESEARCH_10, troops: { ballista: 500 } },
        { research: {}, troops: npc.troops, forts: npc.forts, wallLevel: 5 },
      );
      const stops = rounds.map((r) => r.attacker[at(TroopKey.BALLISTA)]!.location);
      const standOff = Math.max(...stops);
      expect(kills).toEqual([]);
      expect(outcome.attackerTroops[at(TroopKey.BALLISTA)]).toBe(500);
      expect(outcome.attackerAlive).toBe(true);
      expect(outcome.wallHitPoints).toBe(0);
      // once at its post it never moves closer
      expect(stops.slice(stops.indexOf(standOff))).toEqual(stops.slice(stops.indexOf(standOff)).map(() => standOff));
    });
  });
});
