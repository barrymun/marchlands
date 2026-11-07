import { afterEach, describe, expect, it } from 'vitest';
import { TroopKey } from '#/constants.ts';
import {
  assertCanUpgrade,
  BALANCE,
  buildingConfig,
  buildingMaxLevel,
  type BuildingState,
  BuildingStatus,
  BuildingType,
  canDraftFrom,
  draftedToday,
  draftsUsed,
  draftTake,
  Feature,
  fieldFactorAt,
  fullDemolishRefund,
  GameError,
  HISTORIC_LEVELS,
  HISTORIC_NAMES,
  historicCities,
  historicCityBuildings,
  historicDay,
  historicGarrison,
  historicGuard,
  historicLevelAt,
  historicLoyalty,
  historicNameAt,
  historicRallyBonus,
  historicResearch,
  historicState,
  inSeatArea,
  INVENTED_LEVEL_12,
  LEVEL_12_NAMES,
  mapLevelDigit,
  mapLevelOf,
  maxArmyTroops,
  nextAutoDraftAt,
  seatLoyalty,
  seatTitle,
  setFeatureFlags,
  stateTribute,
  TechType,
  TileType,
  wearHistoricLoyalty,
} from '#/index.ts';

describe(historicNameAt.name, () => {
  it('names every historic city by its place, the level 12s too, and nothing else', () => {
    expect(historicNameAt(0, 0)).toBe('Atlantis');
    expect(historicNameAt(300, 500)).toBe('Rome');
    expect(historicNameAt(231, 429)).toBe('Antananarivo');
    expect(historicNameAt(9, 9)).toBe('San Jose');
    expect(historicNameAt(243, 585)).toBe('Jihlava');
    // the places with no historic city: off the grids, beside a bigger city, Romagna's empty level 14s
    expect(historicNameAt(1, 1)).toBeNull();
    expect(historicNameAt(99, 99)).toBeNull();
    expect(historicNameAt(693, 759)).toBeNull();
  });

  it('has a name for each of the 1,938 historic cities, only at their places, none twice', () => {
    const all = historicCities();
    for (const { x, y } of all) expect(historicNameAt(x, y), `${x},${y}`).not.toBeNull();
    const places = [...Object.keys(HISTORIC_NAMES), ...Object.keys(LEVEL_12_NAMES)];
    expect(places).toHaveLength(all.length);
    for (const place of places) {
      const [x = -1, y = -1] = place.split(',').map(Number);
      expect(historicLevelAt(x, y), place).toBe(place in LEVEL_12_NAMES ? 12 : historicLevelAt(x, y));
      expect(historicLevelAt(x, y), place).not.toBeNull();
    }
    const names = [...Object.values(HISTORIC_NAMES), ...Object.values(LEVEL_12_NAMES)];
    expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(names.length);
  });

  it('marks the level 12 names we invented: 1,005 of the 1,795, all level 12 places', () => {
    expect(INVENTED_LEVEL_12.size).toBe(1005);
    for (const place of INVENTED_LEVEL_12) expect(place in LEVEL_12_NAMES, place).toBe(true);
    expect(INVENTED_LEVEL_12.has('207,405')).toBe(true);
    expect(INVENTED_LEVEL_12.has('9,9')).toBe(false);
    // ours fit what a player may type (the game's own may run longer: Sao Jose do Rio Preto)
    for (const place of INVENTED_LEVEL_12) expect(LEVEL_12_NAMES[place]?.length ?? 99, place).toBeLessThanOrEqual(20);
  });
});

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

  it('leaves no level 12 within 9 tiles of a bigger one, as on the live map', () => {
    // beside Washington, D.C. (100, 100), Tirana (33, 33) and Harare (627, 297)
    expect(historicLevelAt(99, 99)).toBeNull();
    expect(historicLevelAt(27, 27)).toBeNull();
    expect(historicLevelAt(621, 297)).toBeNull();
    // just past it: 12.7 from Atlantis, 9.9 from Islamabad (700, 700), 17 from Tirana
    expect(historicLevelAt(9, 9)).toBe(12);
    expect(historicLevelAt(693, 693)).toBe(12);
    expect(historicLevelAt(45, 45)).toBe(12);
  });

  it('leaves Romagna’s last two level 14 places empty, and the level 12s beside them standing', () => {
    expect(historicLevelAt(693, 759)).toBeNull();
    expect(historicLevelAt(759, 759)).toBeNull();
    expect(historicLevelAt(693, 765)).toBe(12);
    expect(historicLevelAt(765, 765)).toBe(12);
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
  it('lists 1,938: one Atlantis, 16 capitals, 126 level 14s and 1,795 level 12s, as on the live map', () => {
    const all = historicCities();
    const count = (level: number) => all.filter((c) => c.level === level).length;
    expect(all).toHaveLength(1938);
    expect([count(18), count(16), count(14), count(12)]).toEqual([1, 16, 126, 1795]);
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
    const g = historicGarrison(16, { foot: TroopKey.SWORDSMEN, horse: TroopKey.HEAVY_CAVALRY, siege: TroopKey.CATAPULT });
    expect(g.troops).toEqual({ militia: 7_000_000, swordsmen: 1_016_665, archer: 428_070, heavyCavalry: 677_777, catapult: 91_500 });
    expect(g.forts).toEqual(BALANCE.historic.forts);
    expect(historicGarrison(12, { foot: TroopKey.PIKEMEN, horse: TroopKey.LIGHT_CAVALRY, siege: TroopKey.BATTERING_RAM }).forts).toEqual(g.forts);
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

describe('a siege’s loyalty', () => {
  const at = 20_000 * 86_400_000;
  const SIX_MINUTES = 6 * 60_000;
  const full = BALANCE.historic.loyalty;
  const perWin = BALANCE.historic.loyaltyPerWin;
  const fresh = () => historicState(12, 4567, null, at).state;
  const asha = { id: 1, allianceId: null };
  const ben = { id: 2, allianceId: null };
  const member = { id: 3, allianceId: 9 };
  const comrade = { id: 4, allianceId: 9 };

  afterEach(() => setFeatureFlags({ [Feature.PVP]: false }));

  describe(historicLoyalty.name, () => {
    it('with PvP off, starts whole for a side that has won nothing, whatever others have done', () => {
      const state = wearHistoricLoyalty(fresh(), asha, at).state;
      expect(historicLoyalty(state, ben, at)).toBe(full);
      expect(historicLoyalty(state, member, at)).toBe(full);
    });

    it('with PvP off, is shared within an alliance and not by a player who has left it', () => {
      const state = wearHistoricLoyalty(fresh(), member, at).state;
      expect(historicLoyalty(state, comrade, at)).toBe(full - perWin);
      expect(historicLoyalty(state, { ...comrade, allianceId: null }, at)).toBe(full);
    });

    it('comes back a point every 6 real minutes, up to its full', () => {
      const state = wearHistoricLoyalty(fresh(), asha, at).state;
      expect(historicLoyalty(state, asha, at + SIX_MINUTES - 1)).toBe(full - perWin);
      expect(historicLoyalty(state, asha, at + SIX_MINUTES)).toBe(full - perWin + 1);
      expect(historicLoyalty(state, asha, at + 100 * SIX_MINUTES)).toBe(full);
    });

    it('with PvP on, is the one loyalty everybody shares', () => {
      setFeatureFlags({ [Feature.PVP]: true });
      const state = { ...fresh(), loyalty: 40 };
      expect(historicLoyalty(state, asha, at)).toBe(40);
      expect(historicLoyalty(state, member, at)).toBe(40);
    });

    it('survives the garrison changing at the start of a new day, and refilling within one', () => {
      const state = wearHistoricLoyalty(fresh(), asha, at).state;
      const garrison = historicState(12, 4567, null, at);
      const stored = { state, troops: garrison.troops, forts: garrison.forts };
      expect(historicLoyalty(historicState(12, 4567, stored, at + 1000).state, asha, at + 1000)).toBe(full - perWin);
      // past a regeneration step, where the state is rebuilt
      const later = at + SIX_MINUTES;
      expect(historicLoyalty(historicState(12, 4567, stored, later).state, asha, later)).toBe(full - perWin + 1);
      const tomorrow = at + 86_400_000;
      expect(historicState(12, 4567, stored, tomorrow).state.sieges).toEqual(state.sieges);
    });
  });

  describe(wearHistoricLoyalty.name, () => {
    it('with PvP off, takes a win’s share off the side’s own count and leaves the shared one alone', () => {
      const worn = wearHistoricLoyalty(fresh(), asha, at);
      expect(worn).toMatchObject({ damage: perWin, left: full - perWin });
      expect(worn.state.loyalty).toBe(full);
    });

    it('counts two sides apart, and an alliance’s members together', () => {
      const one = wearHistoricLoyalty(fresh(), member, at);
      const two = wearHistoricLoyalty(one.state, asha, at);
      const three = wearHistoricLoyalty(two.state, comrade, at);
      expect(two.left).toBe(full - perWin);
      expect(three.left).toBe(full - 2 * perWin);
    });

    it('takes no more than is left, and stops at 0', () => {
      const state = { ...fresh(), sieges: { 'player:1': { loyalty: 2, loyaltyAt: at } } };
      expect(wearHistoricLoyalty(state, asha, at)).toMatchObject({ damage: 2, left: 0 });
      const none = { ...fresh(), sieges: { 'player:1': { loyalty: 0, loyaltyAt: at } } };
      expect(wearHistoricLoyalty(none, asha, at)).toMatchObject({ damage: 0, left: 0 });
    });

    it('counts what has come back before taking a win’s share, and starts a whole side’s clock at the win', () => {
      const worn = wearHistoricLoyalty(fresh(), asha, at);
      expect(worn.state.sieges?.['player:1']).toEqual({ loyalty: full - perWin, loyaltyAt: at });
      const later = wearHistoricLoyalty(worn.state, asha, at + 2 * SIX_MINUTES);
      expect(later.left).toBe(full - 2 * perWin + 2);
      expect(later.state.sieges?.['player:1']?.loyaltyAt).toBe(at + 2 * SIX_MINUTES);
    });

    it('drops sides that have counted all the way back up, keeping those still worn down', () => {
      const asha2 = wearHistoricLoyalty(fresh(), asha, at).state;
      const later = at + perWin * SIX_MINUTES;
      const worn = wearHistoricLoyalty({ ...asha2, sieges: { ...asha2.sieges, 'player:7': { loyalty: 50, loyaltyAt: at } } }, ben, later);
      expect(Object.keys(worn.state.sieges ?? {}).sort()).toEqual(['player:2', 'player:7']);
    });

    it('with PvP on, takes it off the one loyalty everybody shares', () => {
      setFeatureFlags({ [Feature.PVP]: true });
      const one = wearHistoricLoyalty(fresh(), asha, at);
      const two = wearHistoricLoyalty(one.state, ben, at);
      expect(two).toMatchObject({ damage: perWin, left: full - 2 * perWin });
      expect(two.state.loyalty).toBe(full - 2 * perWin);
      expect(two.state.sieges).toBeUndefined();
    });
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

const FIELDS = [BuildingType.FARM, BuildingType.SAWMILL, BuildingType.QUARRY, BuildingType.IRONMINE] as const;
const INSIDE = [BuildingType.TOWN_HALL, BuildingType.COTTAGE, BuildingType.BARRACKS, BuildingType.WAREHOUSE, BuildingType.WALLS] as const;
const idle = (typeId: number, level: number): BuildingState => ({ positionId: 1001, typeId, level, status: BuildingStatus.IDLE, startTime: 0, endTime: 0 });
/** What upgrading a building in a city of `historicLevel` (null: an ordinary city) is refused with, or null when it may start. */
const upgradeRefusal = (b: BuildingState, historicLevel: number | null) => {
  try {
    assertCanUpgrade(b, [b], {}, {}, 1, historicLevel);
    return null;
  } catch (e) {
    if (e instanceof GameError) return e.msg.code;
    throw e;
  }
};

describe(buildingMaxLevel.name, () => {
  it('stops every building at level 10 in an ordinary city', () => {
    for (const t of [...FIELDS, ...INSIDE]) expect(buildingMaxLevel(t)).toBe(10);
  });

  it('lets a historic city’s fields go up to its own level and no further', () => {
    for (const level of HISTORIC_LEVELS) for (const t of FIELDS) expect(buildingMaxLevel(t, level)).toBe(level);
  });

  it('keeps everything but the fields at level 10 in a historic city', () => {
    for (const level of HISTORIC_LEVELS) for (const t of INSIDE) expect(buildingMaxLevel(t, level)).toBe(10);
  });
});

describe(`${assertCanUpgrade.name} in a historic city`, () => {
  it('raises a field to the city’s own level, one level at a time', () => {
    for (const level of HISTORIC_LEVELS)
      for (const t of FIELDS)
        for (let l = 10; l < level; l++) {
          expect(upgradeRefusal(idle(t, l), level)).toBeNull();
          expect(assertCanUpgrade(idle(t, l), [idle(t, l)], {}, {}, 1, level).next.level).toBe(l + 1);
        }
  });

  it('refuses a field past the city’s own level: no level 13 in a level 12, no 15 in a 14, no 17 in a 16', () => {
    for (const level of HISTORIC_LEVELS) for (const t of FIELDS) expect(upgradeRefusal(idle(t, level), level)).toBe('building.maxLevel');
  });

  it('refuses a field already above the city’s level, as a lower seat’s never could be', () => {
    expect(upgradeRefusal(idle(BuildingType.FARM, 16), 14)).toBe('building.maxLevel');
    expect(upgradeRefusal(idle(BuildingType.SAWMILL, 14), 12)).toBe('building.maxLevel');
  });

  it('refuses a field past level 10 in an ordinary city', () => {
    for (const t of FIELDS) expect(upgradeRefusal(idle(t, 10), null)).toBe('building.maxLevel');
  });

  it('refuses every other building past level 10, whatever the city’s level', () => {
    for (const level of HISTORIC_LEVELS) for (const t of INSIDE) expect(upgradeRefusal(idle(t, 10), level)).toBe('building.maxLevel');
  });
});

describe(`${buildingConfig.name} for a historic city’s fields`, () => {
  it('doubles each level’s cost and time past 10, up to 18', () => {
    for (const t of FIELDS) {
      const top = buildingConfig(t, 10);
      expect(top).toBeDefined();
      for (let l = 11; l <= 18; l++) {
        const f = BALANCE.historic.fieldLevelStep ** (l - 10);
        expect(buildingConfig(t, l)).toEqual({
          ...top,
          level: l,
          buildTime: top!.buildTime * f,
          cost: Object.fromEntries(Object.entries(top!.cost).map(([k, v]) => [k, v * f])),
        });
      }
      expect(buildingConfig(t, 19)).toBeUndefined();
    }
  });

  it('has no level past 10 for any other building', () => {
    for (const t of INSIDE) expect(buildingConfig(t, 11)).toBeUndefined();
  });

  it('refunds a demolished field’s levels past 10 like the rest', () => {
    const third = (n: number) => n * BALANCE.demolishRefund;
    const cost = (l: number) => buildingConfig(BuildingType.FARM, l)!.cost.food;
    expect(fullDemolishRefund(BuildingType.FARM, 14).food).toBeCloseTo(third([...Array(14).keys()].reduce((s, i) => s + cost(i + 1), 0)));
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

describe(inSeatArea.name, () => {
  it('reaches 9 tiles every way from a level 12, 33 from a 14, its state from a 16 and everywhere from Atlantis', () => {
    const at = (x: number, y: number) => y * 800 + x;
    expect(inSeatArea(at(99, 99), 12, at(108, 90))).toBe(true);
    expect(inSeatArea(at(99, 99), 12, at(109, 99))).toBe(false);
    expect(inSeatArea(at(33, 33), 14, at(66, 0))).toBe(true);
    expect(inSeatArea(at(33, 33), 14, at(67, 33))).toBe(false);
    expect(inSeatArea(at(100, 100), 16, at(199, 0))).toBe(true);
    expect(inSeatArea(at(100, 100), 16, at(200, 0))).toBe(false);
    expect(inSeatArea(at(0, 0), 18, at(400, 400))).toBe(true);
  });

  it('wraps round the map’s edges, for a seat moved aside near one', () => {
    const at = (x: number, y: number) => y * 800 + x;
    expect(inSeatArea(at(4, 4), 12, at(797, 4))).toBe(true);
    expect(inSeatArea(at(4, 4), 12, at(794, 4))).toBe(false);
  });
});

describe(draftTake.name, () => {
  it('takes a fifth of every troop type, rounded down', () => {
    expect(draftTake({ militia: 400_000, archer: 1_000, pikemen: 9 })).toEqual({ militia: 80_000, archer: 200, pikemen: 1 });
    expect(draftTake(historicGarrison(14, { foot: TroopKey.SWORDSMEN, horse: TroopKey.HEAVY_CAVALRY, siege: TroopKey.CATAPULT }).troops)).toEqual({
      militia: 560_000,
      swordsmen: 81_333,
      archer: 34_245,
      heavyCavalry: 54_222,
      catapult: 7_320,
    });
  });

  it('leaves out a type too small to give a whole troop, and takes nothing from a city with none', () => {
    expect(draftTake({ militia: 10, pikemen: 4 })).toEqual({ militia: 2 });
    expect(draftTake({ pikemen: 4 })).toBeNull();
    expect(draftTake({})).toBeNull();
  });
});

describe(canDraftFrom.name, () => {
  it('lets every seat draft from barbarian cities, and from historic cities of lower levels only', () => {
    expect(canDraftFrom(12, { type: TileType.NPC, level: 10 })).toBe(true);
    expect(canDraftFrom(12, { type: TileType.HISTORIC, level: 12 })).toBe(false);
    expect(canDraftFrom(14, { type: TileType.HISTORIC, level: 12 })).toBe(true);
    expect(canDraftFrom(14, { type: TileType.HISTORIC, level: 14 })).toBe(false);
    expect(canDraftFrom(18, { type: TileType.HISTORIC, level: 16 })).toBe(true);
    expect(canDraftFrom(18, { type: TileType.CASTLE, level: 10 })).toBe(false);
    expect(canDraftFrom(18, { type: TileType.FOREST, level: 10 })).toBe(false);
  });
});

describe(draftedToday.name, () => {
  it('lists the tiles drafted from today only', () => {
    expect(draftedToday({ draftDay: 20_000, draftedTiles: [5, 9] }, 20_000 * 86_400_000 + 5)).toEqual([5, 9]);
    expect(draftedToday({ draftDay: 19_999, draftedTiles: [5, 9] }, 20_000 * 86_400_000 + 5)).toEqual([]);
  });
});

describe(draftsUsed.name, () => {
  it('counts the drafts of today only', () => {
    expect(draftsUsed({ draftDay: 20_000, draftsUsed: 3 }, 20_000 * 86_400_000 + 5)).toBe(3);
    expect(draftsUsed({ draftDay: 19_999, draftsUsed: 3 }, 20_000 * 86_400_000 + 5)).toBe(0);
  });
});

describe(nextAutoDraftAt.name, () => {
  const day = 20_000 * 86_400_000;
  const h = 3_600_000;
  it('is the start of the next quarter of the UTC day', () => {
    expect(nextAutoDraftAt(day)).toBe(day + 6 * h);
    expect(nextAutoDraftAt(day + 6 * h - 1)).toBe(day + 6 * h);
    expect(nextAutoDraftAt(day + 6 * h)).toBe(day + 12 * h);
  });

  it('goes on to the next day after the last quarter, without making up the parts before', () => {
    // captured at 22:22: the next draft is at midnight, not at once
    expect(nextAutoDraftAt(day + 22 * h + 22 * 60_000)).toBe(day + 24 * h);
  });
});

describe(seatTitle.name, () => {
  const at = (x: number, y: number) => y * 800 + x;

  it('makes the holder of a state capital its ruler, and Atlantis’s holder its sovereign over all else', () => {
    expect(seatTitle([{ historicLevel: 16, tileId: at(300, 100) }])).toEqual({ level: 16, zoneId: 1 });
    expect(
      seatTitle([
        { historicLevel: 12, tileId: at(9, 9) },
        { historicLevel: 16, tileId: at(300, 100) },
        { historicLevel: 18, tileId: at(0, 0) },
      ]),
    ).toEqual({
      level: 18,
      zoneId: 0,
    });
  });

  it('gives none for level 12s and 14s, or no seat', () => {
    expect(
      seatTitle([
        { historicLevel: 14, tileId: at(33, 33) },
        { historicLevel: null, tileId: at(5, 5) },
      ]),
    ).toBeNull();
    expect(seatTitle([])).toBeNull();
  });
});

describe(stateTribute.name, () => {
  it('pays per member level, by BALANCE.historic.stateTribute', () => {
    const per = BALANCE.historic.stateTribute.perMemberLevel;
    expect(
      stateTribute([
        { level: 5, members: 10 },
        { level: 10, members: 2 },
      ]),
    ).toBe((50 + 20) * per);
    expect(stateTribute([])).toBe(0);
  });
});
