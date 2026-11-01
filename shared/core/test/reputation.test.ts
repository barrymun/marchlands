import { afterEach, describe, expect, it } from 'vitest';
import {
  attackStanding,
  BALANCE,
  changeStanding,
  DAY,
  draftStanding,
  FactionId,
  factionRivals,
  factionSpread,
  gameDay,
  homeFaction,
  seatStanding,
  setGameSpeed,
  standingNow,
  StandingTier,
  standingTier,
  tradeStanding,
} from '#/index.ts';

const R = BALANCE.reputation;
const BASE = BALANCE.npcTrade.playerSpread;
/** The tile at (x, y). */
const tile = (x: number, y: number) => y * BALANCE.mapSize + x;
/** A tile in Friesland (zone 0, the Saxon League) and one in Romagna (zone 15, the Italian League). */
const FRIESLAND = tile(10, 10);
const ROMAGNA = tile(BALANCE.mapSize - 10, BALANCE.mapSize - 10);

afterEach(() => setGameSpeed(1));

describe(standingNow.name, () => {
  it('is 0 with no standing stored', () => {
    expect(standingNow(undefined, 1000)).toBe(0);
  });

  it('halves towards 0 every half-life of game time', () => {
    const s = { value: 40, at: 0 };
    expect(standingNow(s, 0)).toBe(40);
    expect(standingNow(s, R.driftHalfLifeMs)).toBeCloseTo(20);
    expect(standingNow({ value: -40, at: 0 }, 2 * R.driftHalfLifeMs)).toBeCloseTo(-10);
  });

  it('drifts faster at a higher game speed', () => {
    setGameSpeed(2);
    expect(standingNow({ value: 40, at: 0 }, R.driftHalfLifeMs / 2)).toBeCloseTo(20);
  });

  it('never grows for a time before it was set', () => {
    expect(standingNow({ value: 40, at: 1000 }, 0)).toBe(40);
  });
});

describe(changeStanding.name, () => {
  it('adds to the standing as it is now, stamped with the time', () => {
    expect(changeStanding({ value: 40, at: 0 }, 5, R.driftHalfLifeMs)).toEqual({ value: 25, at: R.driftHalfLifeMs });
    expect(changeStanding(undefined, -3, 7)).toEqual({ value: -3, at: 7 });
  });

  it('stays within ±max', () => {
    expect(changeStanding({ value: 90, at: 0 }, 50, 0).value).toBe(R.max);
    expect(changeStanding({ value: -90, at: 0 }, -50, 0).value).toBe(-R.max);
  });
});

describe(factionSpread.name, () => {
  it('is the base spread at 0', () => {
    expect(factionSpread(0)).toBe(BASE);
  });

  it('narrows to the best at max, halfway at half', () => {
    expect(factionSpread(R.max)).toBeCloseTo(R.spread.best);
    expect(factionSpread(R.max / 2)).toBeCloseTo((BASE + R.spread.best) / 2);
  });

  it('widens towards the worst as standing falls to the refusal line', () => {
    expect(factionSpread(R.refuseBelow / 2)).toBeCloseTo((BASE + R.spread.worst) / 2);
    expect(factionSpread(R.refuseBelow + 0.001)).toBeCloseTo(R.spread.worst, 3);
  });

  it('is null (no trade) at the refusal line and below', () => {
    expect(factionSpread(R.refuseBelow)).toBeNull();
    expect(factionSpread(-R.max)).toBeNull();
  });

  it('is never negative, so a round trip with the factions never pays', () => {
    for (let s = R.refuseBelow + 1; s <= R.max; s += 7) expect(factionSpread(s)).toBeGreaterThanOrEqual(0);
  });
});

describe(standingTier.name, () => {
  it('bands standing from hostile to honoured', () => {
    expect(standingTier(R.refuseBelow)).toBe(StandingTier.HOSTILE);
    expect(standingTier(R.refuseBelow + 1)).toBe(StandingTier.UNFRIENDLY);
    expect(standingTier(R.tiers.unfriendly)).toBe(StandingTier.NEUTRAL);
    expect(standingTier(0)).toBe(StandingTier.NEUTRAL);
    expect(standingTier(R.tiers.friendly)).toBe(StandingTier.NEUTRAL);
    expect(standingTier(R.tiers.friendly + 1)).toBe(StandingTier.FRIENDLY);
    expect(standingTier(R.tiers.honoured)).toBe(StandingTier.HONOURED);
    expect(standingTier(R.max)).toBe(StandingTier.HONOURED);
  });
});

describe(homeFaction.name, () => {
  it("is the faction holding the tile's zone", () => {
    expect(homeFaction(FRIESLAND)?.id).toBe(FactionId.SAXON_LEAGUE);
    expect(homeFaction(ROMAGNA)?.id).toBe(FactionId.ITALIAN_LEAGUE);
  });
});

describe(attackStanding.name, () => {
  const member = BALANCE.factions.minLevel;

  it("costs standing with a member's faction for any attack, by level", () => {
    expect(attackStanding(FRIESLAND, member, true, false)).toEqual({ faction: homeFaction(FRIESLAND), change: -R.attackPerLevel * member });
    expect(attackStanding(ROMAGNA, 10, false, false)?.change).toBeCloseTo(-R.attackPerLevel * 10);
  });

  it('costs more when the member is captured', () => {
    expect(attackStanding(FRIESLAND, member, true, true)?.change).toBeCloseTo(-(R.attackPerLevel * member + R.capture));
  });

  it("earns a little with the land's faction for a won attack on a bandit camp", () => {
    expect(attackStanding(FRIESLAND, 3, true, false)).toEqual({ faction: homeFaction(FRIESLAND), change: R.banditPerLevel * 3 });
  });

  it('does nothing for a lost attack on a bandit camp', () => {
    expect(attackStanding(FRIESLAND, 3, false, false)).toBeNull();
  });
});

describe(gameDay.name, () => {
  it('counts game days', () => {
    expect(gameDay(0)).toBe(0);
    expect(gameDay(DAY - 1)).toBe(0);
    expect(gameDay(DAY)).toBe(1);
    setGameSpeed(24);
    expect(gameDay(DAY / 24)).toBe(1);
  });
});

describe(tradeStanding.name, () => {
  const { goldPerPoint, maxPerDay } = R.trade;

  it('gives a point per goldPerPoint traded', () => {
    expect(tradeStanding(goldPerPoint * 2, null, 0)).toEqual({ points: 2, day: 0, gained: 2 });
  });

  it("stops at the day's cap", () => {
    expect(tradeStanding(goldPerPoint * 100, null, 0).points).toBe(maxPerDay);
    expect(tradeStanding(goldPerPoint * 100, { day: 0, gained: maxPerDay - 1 }, 0)).toEqual({ points: 1, day: 0, gained: maxPerDay });
    expect(tradeStanding(goldPerPoint, { day: 0, gained: maxPerDay }, 0).points).toBe(0);
  });

  it('starts a new day afresh', () => {
    expect(tradeStanding(goldPerPoint, { day: 0, gained: maxPerDay }, DAY)).toEqual({ points: 1, day: 1, gained: 1 });
  });

  it('gives nothing for no gold', () => {
    expect(tradeStanding(0, null, 0).points).toBe(0);
  });
});

describe(seatStanding.name, () => {
  /** Tuscany's capital (a level 16, the Italian League's land) */
  const TUSCANY = tile(500, 700);
  const S = R.seat;

  it("costs standing with the state's faction for any attack, by level, with nothing for its rivals", () => {
    expect(seatStanding(FRIESLAND, 12, false)).toEqual({ own: { faction: homeFaction(FRIESLAND), change: -R.attackPerLevel * 12 }, rivals: [] });
  });

  it("costs the capture's standing more when it's taken, doubled for a capital, and its rivals gain a share", () => {
    const moved = seatStanding(TUSCANY, 16, true);
    const cost = R.capture * S.captureFactor[16];
    expect(S.captureFactor[16]).toBe(2);
    expect(moved?.own.faction.id).toBe(FactionId.ITALIAN_LEAGUE);
    expect(moved?.own.change).toBeCloseTo(-(R.attackPerLevel * 16 + cost));
    expect(moved?.rivals).toEqual(factionRivals(FactionId.ITALIAN_LEAGUE).map((f) => ({ faction: f, change: cost * S.rivalShare })));
  });

  it('counts Atlantis, at (0, 0), as the Saxon League’s', () => {
    expect(seatStanding(0, 18, false)?.own.faction.id).toBe(FactionId.SAXON_LEAGUE);
  });
});

describe(draftStanding.name, () => {
  it("costs standing with a member's faction", () => {
    expect(draftStanding(ROMAGNA, 10)).toEqual({ faction: homeFaction(ROMAGNA), change: -R.seat.draft });
  });

  it('costs nothing for a bandit camp', () => {
    expect(draftStanding(ROMAGNA, BALANCE.factions.minLevel - 1)).toBeNull();
  });
});
