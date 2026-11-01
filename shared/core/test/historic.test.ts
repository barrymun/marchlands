import { describe, expect, it } from 'vitest';
import {
  BALANCE,
  BuildingStatus,
  BuildingType,
  fieldFactorAt,
  historicCities,
  historicCityBuildings,
  historicDay,
  historicGarrison,
  historicGuard,
  historicLevelAt,
  historicRallyBonus,
  historicResearch,
  historicState,
  mapLevelDigit,
  mapLevelOf,
  maxArmyTroops,
  seatLoyalty,
  TechType,
  TileType,
} from '#/index.ts';

describe(historicLevelAt.name, () => {
  it('puts Atlantis at (0, 0), a capital in the middle of every state, 14s every 66 tiles and 12s every 18', () => {
    expect(historicLevelAt(0, 0)).toBe(18);
    expect(historicLevelAt(100, 100)).toBe(16);
    expect(historicLevelAt(700, 700)).toBe(16);
    expect(historicLevelAt(33, 33)).toBe(14);
    // the reference's tables: Saxony's and Carinthia's level 14s
    expect(historicLevelAt(231, 165)).toBe(14);
    expect(historicLevelAt(627, 429)).toBe(14);
    expect(historicLevelAt(9, 9)).toBe(12);
    expect(historicLevelAt(207, 9)).toBe(12);
  });

  it('has a level 12 in each state’s middle place of the level 14 grid, as source 9 said', () => {
    for (const v of [99, 297, 495, 693]) expect(historicLevelAt(v, v)).toBe(12);
    expect(historicLevelAt(99, 297)).toBe(12);
  });

  it('puts the wiki’s two named cities, St. Gallen and Vigevano, on level 12 places', () => {
    expect(historicLevelAt(369, 657)).toBe(12);
    expect(historicLevelAt(567, 747)).toBe(12);
  });

  it('is null anywhere else', () => {
    expect(historicLevelAt(1, 0)).toBeNull();
    expect(historicLevelAt(10, 9)).toBeNull();
    expect(historicLevelAt(233, 33)).toBeNull();
    expect(historicLevelAt(101, 100)).toBeNull();
  });
});

describe(historicCities.name, () => {
  it('lists 2,081: one Atlantis, 16 capitals, 128 level 14s and 1,936 level 12s', () => {
    const all = historicCities();
    const count = (level: number) => all.filter((c) => c.level === level).length;
    expect(all).toHaveLength(2081);
    expect([count(18), count(16), count(14), count(12)]).toEqual([1, 16, 128, 1936]);
  });
});

describe(historicDay.name, () => {
  it('is the same all day for a city, and changes with the day and the city', () => {
    expect(historicDay(1234, 20_000)).toEqual(historicDay(1234, 20_000));
    const days = new Set(Array.from({ length: 200 }, (_, d) => JSON.stringify(historicDay(1234, d))));
    // two foot troops, two horse, three siege engines
    expect(days.size).toBe(12);
  });
});

describe(historicGarrison.name, () => {
  it('holds the day’s troops beside the warriors and archers, and the same fortifications at every level', () => {
    const g = historicGarrison(16, { foot: 'swordsmen', horse: 'heavyCavalry', siege: 'catapult' });
    expect(g.troops).toEqual({ militia: 7_000_000, swordsmen: 1_016_665, archer: 428_070, heavyCavalry: 677_777, catapult: 91_500 });
    expect(g.forts).toEqual(BALANCE.historic.forts);
    expect(historicGarrison(12, { foot: 'pikemen', horse: 'lightCavalry', siege: 'batteringRam' }).forts).toEqual(g.forts);
  });
});

describe(historicResearch.name, () => {
  it('has every research at the level but Archery, at 0', () => {
    const r = historicResearch();
    expect(r[TechType.ARCHERY]).toEqual({ level: 0 });
    expect(r[TechType.HORSEBACK_RIDING]).toEqual({ level: BALANCE.historic.researchLevel });
    expect(historicResearch(5)[TechType.IRON_WORKING]).toEqual({ level: 5 });
  });
});

describe(historicRallyBonus.name, () => {
  it('adds a quarter a level step above 10', () => {
    expect([12, 14, 16, 18].map((l) => historicRallyBonus(l as 12 | 14 | 16 | 18))).toEqual([0.25, 0.5, 0.75, 1]);
  });
});

describe(mapLevelDigit.name, () => {
  it('halves a historic city’s level so it fits one hex digit, and mapLevelOf reads it back', () => {
    for (const level of [12, 14, 16, 18]) {
      const digit = mapLevelDigit(TileType.HISTORIC, level);
      expect(digit).toBeLessThan(16);
      expect(mapLevelOf(TileType.HISTORIC, digit)).toBe(level);
    }
    expect(mapLevelDigit(TileType.NPC, 10)).toBe(10);
    expect(mapLevelOf(TileType.NPC, 10)).toBe(10);
  });
});

describe(historicState.name, () => {
  const DAY_MS = 86_400_000;
  const at = 20_000 * DAY_MS + 3_600_000;

  it('starts whole, with the day’s garrison and full loyalty', () => {
    const s = historicState(12, 4567, null, at);
    expect(s.troops).toEqual(historicGarrison(12, historicDay(4567, 20_000)).troops);
    expect(s.forts).toEqual(BALANCE.historic.forts);
    expect(s.state).toMatchObject({ loyalty: BALANCE.historic.loyalty, day: 20_000 });
  });

  it('refills by the second, and stands whole again with the next day’s garrison, keeping its loyalty', () => {
    const fresh = historicState(12, 4567, null, at);
    const hit = { state: { ...fresh.state, loyalty: 40 }, troops: {}, forts: {} };
    const later = historicState(12, 4567, hit, at + 36_000);
    // 10% every 6 minutes: 36 seconds bring back 1%
    expect(later.troops.militia).toBe(11_200);
    expect(later.state.loyalty).toBe(40);
    const tomorrow = historicState(12, 4567, hit, at + DAY_MS);
    expect(tomorrow.troops).toEqual(historicGarrison(12, historicDay(4567, 20_001)).troops);
    expect(tomorrow.state).toMatchObject({ loyalty: 40, day: 20_001 });
  });

  it('gets loyalty back a point every 6 real minutes, up to its own full', () => {
    const fresh = historicState(14, 99, null, at);
    const low = { state: { ...fresh.state, loyalty: 98 }, troops: fresh.troops, forts: fresh.forts };
    expect(historicState(14, 99, low, at + 6 * 60_000).state.loyalty).toBe(99);
    expect(historicState(14, 99, low, at + 60 * 60_000).state.loyalty).toBe(BALANCE.historic.loyalty);
  });
});

describe(historicGuard.name, () => {
  it('is level 100 with the level’s Attack and Intelligence, the same every time', () => {
    const g = historicGuard(16, 1234);
    expect(g).toMatchObject({ level: 100, power: 200, stratagem: 1_100 });
    expect(historicGuard(16, 1234).name).toBe(g.name);
  });
});

describe(historicCityBuildings.name, () => {
  it('has a captured level 10 barbarian city’s buildings, its fields at the seat’s level', () => {
    const list = historicCityBuildings(14);
    const fields = list.filter((b) => b.positionId >= 1001);
    expect(fields).toHaveLength(40);
    expect(fields.every((b) => b.level === 14)).toBe(true);
    expect(list.filter((b) => b.positionId < 1001).every((b) => b.level === 10)).toBe(true);
  });
});

describe(fieldFactorAt.name, () => {
  it('follows the table to level 10, then carries level 10’s on in proportion', () => {
    expect(fieldFactorAt(3)).toBe(BALANCE.fieldFactor[3]);
    expect(fieldFactorAt(10)).toBe(55);
    expect(fieldFactorAt(12)).toBe(66);
    expect(fieldFactorAt(18)).toBe(99);
  });
});

describe(maxArmyTroops.name, () => {
  const rally10 = [{ positionId: 0, typeId: BuildingType.RALLY_SPOT, level: 10, status: BuildingStatus.IDLE, startTime: 0, endTime: 0 }];

  it('sends a quarter more a level step from a held historic city, and a War Ensign adds its quarter on top', () => {
    expect(maxArmyTroops(rally10)).toBe(100_000);
    expect(maxArmyTroops(rally10, false, 12)).toBe(125_000);
    expect(maxArmyTroops(rally10, false, 18)).toBe(200_000);
    expect(maxArmyTroops(rally10, true, 12)).toBe(156_250);
  });
});

describe(seatLoyalty.name, () => {
  it('comes back a point every 6 real minutes, up to full', () => {
    expect(seatLoyalty(40, 0, 6 * 60_000)).toEqual({ loyalty: 41, loyaltyAt: 6 * 60_000 });
    expect(seatLoyalty(40, 0, 6 * 60_000 - 1)).toEqual({ loyalty: 40, loyaltyAt: 0 });
    expect(seatLoyalty(99, 0, 60 * 60_000).loyalty).toBe(BALANCE.historic.loyalty);
  });

  it('keeps its clock with the present while full, so a later loss counts from then', () => {
    expect(seatLoyalty(BALANCE.historic.loyalty, 0, 5_000)).toEqual({ loyalty: BALANCE.historic.loyalty, loyaltyAt: 5_000 });
  });
});
