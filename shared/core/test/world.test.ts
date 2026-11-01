import { describe, expect, it } from 'vitest';
import {
  BALANCE,
  BuildingStatus,
  BuildingType,
  freshNpcState,
  nextRefillAt,
  npcCityBuildings,
  npcTemplate,
  refillCounts,
  regenerateNpc,
  Relation,
  relationPermissions,
  usedWallSpace,
  wallCapacity,
} from '#/index.ts';

describe(npcCityBuildings.name, () => {
  it('lays out a barbarian city as real buildings, all at its level', () => {
    const list = npcCityBuildings(3);
    const at = (pos: number) => list.find((b) => b.positionId === pos);
    expect(at(-1)).toEqual({ positionId: -1, typeId: BuildingType.TOWN_HALL, level: 3, status: BuildingStatus.IDLE, startTime: 0, endTime: 0 });
    expect(at(-2)?.typeId).toBe(BuildingType.WALLS);
    // the twelve inner buildings, then twenty cottages
    expect(list.filter((b) => b.positionId >= 0 && b.positionId < 12).map((b) => b.typeId)).toEqual([
      BuildingType.ACADEMY,
      BuildingType.FORGE,
      BuildingType.EMBASSY,
      BuildingType.FEASTING_HALL,
      BuildingType.MARKETPLACE,
      BuildingType.BEACON_TOWER,
      BuildingType.STABLE,
      BuildingType.INN,
      BuildingType.RALLY_SPOT,
      BuildingType.RELIEF_STATION,
      BuildingType.WORKSHOP,
      BuildingType.BARRACKS,
    ]);
    expect(list.filter((b) => b.positionId >= 12 && b.positionId <= 31).every((b) => b.typeId === BuildingType.COTTAGE)).toBe(true);
    expect(list.filter((b) => b.typeId === BuildingType.COTTAGE)).toHaveLength(20);
    // 10 farms at level 1, 3 more per level, then a sawmill, a quarry and an iron mine
    expect(list.filter((b) => b.typeId === BuildingType.FARM)).toHaveLength(16);
    expect(list.slice(-3).map((b) => [b.positionId, b.typeId])).toEqual([
      [1017, BuildingType.SAWMILL],
      [1018, BuildingType.QUARRY],
      [1019, BuildingType.IRONMINE],
    ]);
    expect(list.every((b) => b.level === 3 && b.status === BuildingStatus.IDLE)).toBe(true);
    expect(new Set(list.map((b) => b.positionId)).size).toBe(list.length);
  });

  it('has 10 farms at level 1 and at most 37', () => {
    const farms = (level: number) => npcCityBuildings(level).filter((b) => b.typeId === BuildingType.FARM).length;
    expect(farms(1)).toBe(10);
    expect(farms(9)).toBe(34);
    expect(farms(10)).toBe(37);
    expect(farms(12)).toBe(37);
    expect(npcCityBuildings(1)).toHaveLength(2 + 12 + 20 + 10 + 3);
  });
});

describe(relationPermissions.name, () => {
  it('friends may be sent to and supplied, everyone else attacked and scouted', () => {
    const friendly = { canLoot: false, canOccupy: false, canScout: false, canSend: true, canTrans: true };
    for (const r of [Relation.SELF, Relation.ALLY, Relation.ALLIANCE]) expect(relationPermissions(r)).toEqual(friendly);
    expect(relationPermissions(Relation.ENEMY)).toEqual({ canLoot: true, canOccupy: true, canScout: true, canSend: true, canTrans: true });
    for (const r of [Relation.NEUTRAL, Relation.NO_RELATION]) {
      expect(relationPermissions(r)).toEqual({ canLoot: true, canOccupy: true, canScout: true, canSend: false, canTrans: false });
    }
  });
});

describe(npcTemplate.name, () => {
  it("fits every level's fortifications on the walls of a barbarian city of that level", () => {
    for (let level = 1; level <= 10; level++) {
      const used = usedWallSpace(npcTemplate(level).forts, []);
      expect(wallCapacity(npcCityBuildings(level))).toBe(BALANCE.wallSpace[level]);
      expect(used, `level ${level}`).toBeLessThanOrEqual(BALANCE.wallSpace[level]!);
    }
  });
});

describe(refillCounts.name, () => {
  const full = { militia: 400_000, archer: 3_600 };

  it('brings counts back a little every second, the share of full each period', () => {
    // 10% every 6 minutes: 36 seconds bring back 1%
    expect(refillCounts({ militia: 0, archer: 0 }, full, 36_000, 0.1, 360_000)).toEqual({ militia: 4_000, archer: 36 });
    expect(refillCounts({ militia: 0, archer: 0 }, full, 1_000, 0.1, 360_000)).toEqual({ militia: 111, archer: 1 });
  });

  it('never goes past full, starts a missing type from 0, and does nothing for no time', () => {
    expect(refillCounts({ militia: 399_000 }, full, 36_000, 0.1, 360_000)).toEqual({ militia: 400_000, archer: 36 });
    expect(refillCounts({ militia: 5 }, full, 0, 0.1, 360_000)).toEqual({ militia: 5, archer: 0 });
    expect(refillCounts({ militia: 5 }, full, -1_000, 0.1, 360_000)).toEqual({ militia: 5, archer: 0 });
  });
});

describe(nextRefillAt.name, () => {
  const full = { militia: 100 };

  it('moves on once something came back', () => {
    expect(nextRefillAt({ militia: 10 }, { militia: 11 }, full, 1_000, 5_000)).toBe(5_000);
  });

  it('moves on when there is nothing to refill, so the next loss counts from now', () => {
    expect(nextRefillAt({ militia: 100 }, { militia: 100 }, full, 1_000, 5_000)).toBe(5_000);
  });

  it('stays while less than a unit has come back, so the fraction is kept', () => {
    expect(nextRefillAt({ militia: 10 }, { militia: 10 }, full, 1_000, 5_000)).toBe(1_000);
  });
});

describe(regenerateNpc.name, () => {
  it('brings troops and fortifications back by the second, resources and loyalty in 6-minute steps', () => {
    const fresh = freshNpcState(10, 0);
    const hit = { ...fresh.state, food: 0, loyalty: 50 };
    const r = regenerateNpc(10, hit, {}, {}, 36_000);
    expect(r.troops.militia).toBe(4_000);
    expect(r.forts.trap).toBe(Math.floor((npcTemplate(10).forts.trap ?? 0) / 100));
    expect(r.state).toMatchObject({ food: 0, loyalty: 50, regenAt: 0, refillAt: 36_000 });
    const later = regenerateNpc(10, r.state, r.troops, r.forts, 6 * 60_000);
    expect(later.troops.militia).toBe(40_000);
    expect(later.state).toMatchObject({ food: 19_000_000 / 80, loyalty: 51, regenAt: 6 * 60_000 });
  });

  it('refills a garrison hit after a long quiet spell from the hit, not from before it', () => {
    const fresh = freshNpcState(10, 0);
    // untouched for an hour, then looked at: the clock moves on, though nothing came back
    const quiet = regenerateNpc(10, fresh.state, fresh.troops, fresh.forts, 3_600_000);
    expect(quiet.state.refillAt).toBe(3_600_000);
    // a battle a second later leaves no warriors; a second after that, one second's worth is back
    const after = regenerateNpc(10, quiet.state, { ...quiet.troops, militia: 0 }, quiet.forts, 3_601_000);
    expect(after.troops.militia).toBe(111);
  });
});
