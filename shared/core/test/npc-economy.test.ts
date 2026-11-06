import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ResourceKey, TradeSide } from '#/constants.ts';
import {
  BALANCE,
  BASIC_RESOURCES,
  factionAffordable,
  factionBuys,
  factionMarginal,
  factionSells,
  giveToGroups,
  groupKey,
  groupRates,
  groupTarget,
  groupTreasury,
  HOUR,
  landFactors,
  MINUTE,
  newNpcEconomy,
  type NpcGroup,
  npcTableGold,
  npcTemplate,
  npcTick,
  plunderGroup,
  priceBand,
  priceExponent,
  seededRng,
  setGameSpeed,
  takeFromGroups,
  TileType,
  worldGold,
  worldPrice,
  worldTotals,
} from '#/index.ts';

const cfg = BALANCE.npcTrade as { wander: { sd: number } };
const ZONES = 16;
/** Two groups in each zone, levels 5 and 9, as on a real map but smaller. */
const GROUPS: NpcGroup[] = Array.from({ length: ZONES }, (_, zone) => [
  { zone, level: 5, members: 200 },
  { zone, level: 9, members: 60 },
]).flat();
const FLAT_LAND = Array.from({ length: ZONES }, () => ({ food: 1, wood: 1, stone: 1, iron: 1 }));
const tick = (econ: ReturnType<typeof newNpcEconomy>, at: number, seed = 'test') => npcTick(econ, GROUPS, at, seededRng(seed));

beforeEach(() => setGameSpeed(1));
afterEach(() => setGameSpeed(1));

describe(priceBand.name, () => {
  it("is the merchant's bid and ask around 1.00", () => {
    const half = BALANCE.merchant.spread / 2;
    expect(priceBand()).toEqual({ low: 1 - half, high: 1 + half });
  });
});

describe(priceExponent.name, () => {
  it("puts the price at the band's top when the world is edgeShare short of target", () => {
    expect((1 / (1 - BALANCE.npcTrade.edgeShare)) ** priceExponent()).toBeCloseTo(priceBand().high, 12);
  });
});

describe(worldPrice.name, () => {
  it('is 1.00 at target, higher when short and lower in glut, inside the band', () => {
    expect(worldPrice(100, 100)).toBe(1);
    expect(worldPrice(100, 90)).toBeGreaterThan(1);
    expect(worldPrice(100, 110)).toBeLessThan(1);
    expect(worldPrice(100, 10)).toBe(priceBand().high);
    expect(worldPrice(100, 1000)).toBe(priceBand().low);
  });

  it("is the band's top with no stock at all", () => {
    expect(worldPrice(100, 0)).toBe(priceBand().high);
  });
});

describe(landFactors.name, () => {
  it("weighs each zone's valleys against the average zone, food from swamp, grass and lake together", () => {
    const land = landFactors(
      [
        { zone: 0, type: TileType.FOREST, count: 300 },
        { zone: 1, type: TileType.FOREST, count: 100 },
        { zone: 0, type: TileType.LAKE, count: 50 },
        { zone: 1, type: TileType.GRASS, count: 30 },
        { zone: 1, type: TileType.SWAMP, count: 20 },
        { zone: 0, type: TileType.FLAT, count: 999 },
      ],
      2,
    );
    expect(land).toEqual([
      { food: 1, wood: 1.5, stone: 1, iron: 1 },
      { food: 1, wood: 0.5, stone: 1, iron: 1 },
    ]);
  });

  it('ignores zones out of range', () => {
    expect(landFactors([{ zone: 5, type: TileType.HILL, count: 10 }], 1)).toEqual([{ food: 1, wood: 1, stone: 1, iron: 1 }]);
  });
});

describe(groupRates.name, () => {
  it('makes as much of each resource across the world as it uses', () => {
    const land = FLAT_LAND.map((l, z) => ({ ...l, wood: z % 2 ? 1.5 : 0.7 }));
    const rates = groupRates(GROUPS, land);
    for (const r of BASIC_RESOURCES) {
      const make = rates.reduce((s, x) => s + x.make[r], 0);
      const use = rates.reduce((s, x) => s + x.use[r], 0);
      expect(make / use, r).toBeCloseTo(1, 9);
    }
  });

  it("has a faction make more of its strengths and use more of its shortages, for its target's size", () => {
    const rates = groupRates(GROUPS, FLAT_LAND);
    const at = (zone: number) => {
      const i = GROUPS.findIndex((g) => g.zone === zone && g.level === 5);
      const t = groupTarget({ zone, level: 5, members: 200 });
      return { make: (rates[i]?.make.wood ?? 0) / t.wood, use: (rates[i]?.use.wood ?? 0) / t.wood };
    };
    // Saxony (Saxon League) is strong in lumber, Franconia (Franconian Heartland) short of it, Bohemia neither
    expect(at(1).make).toBeGreaterThan(at(3).make);
    expect(at(5).use).toBeGreaterThan(at(3).use);
  });
});

describe(newNpcEconomy.name, () => {
  it('starts every group at its target and every price at 1.00', () => {
    const econ = newNpcEconomy(GROUPS, FLAT_LAND, 5);
    expect(econ.at).toBe(5);
    expect(econ.stock[groupKey(0, 5)]).toEqual(groupTarget({ zone: 0, level: 5, members: 200 }));
    expect(econ.price).toEqual({ food: 1, wood: 1, stone: 1, iron: 1 });
    expect(econ.ticker).toEqual([]);
  });
});

describe(groupTarget.name, () => {
  it("is the members' full-strength stock", () => {
    expect(groupTarget({ zone: 0, level: 7, members: 3 }).food).toBe(npcTemplate(7).resources.food * 3);
  });
});

describe(npcTick.name, () => {
  it('is the same for the same seed', () => {
    const econ = newNpcEconomy(GROUPS, FLAT_LAND, 0);
    expect(tick(econ, MINUTE)).toEqual(tick(econ, MINUTE));
  });

  it('moves goods from strong factions to short ones, the world keeping its stock in the auction', () => {
    const saved = cfg.wander.sd;
    cfg.wander.sd = 0;
    try {
      let econ = newNpcEconomy(GROUPS, FLAT_LAND, 0);
      for (let t = 1; t <= 24; t++) econ = tick(econ, t * HOUR).econ;
      const wood = (zone: number) => (econ.stock[groupKey(zone, 5)]?.wood ?? 0) / groupTarget({ zone, level: 5, members: 200 }).wood;
      // the Saxon League makes more lumber than it uses and sells it; the Franconian Heartland buys
      const { auctions } = tick(econ, 25 * HOUR);
      expect(auctions.wood.volume).toBeGreaterThan(0);
      expect(auctions.wood.sellers).toBeGreaterThan(0);
      // strong Saxony holds more of its target than short Franconia, though trade narrows the gap
      expect(wood(1)).toBeGreaterThan(wood(5));
      expect(wood(1) - wood(5)).toBeLessThan(0.1);
      // balanced and without wander, the world stays at its target, so the price stays at 1.00
      expect(auctions.wood.close).toBeCloseTo(1, 6);
    } finally {
      cfg.wander.sd = saved;
    }
  });

  it("prices a short world dearer, at most the band's top, the bigger side trading only as much as the smaller", () => {
    let econ = newNpcEconomy(GROUPS, FLAT_LAND, 0);
    for (const g of GROUPS.filter((g) => g.zone < 12)) econ = plunderGroup(econ, g, { iron: groupTarget(g).iron });
    const { econ: next, auctions } = tick(econ, MINUTE);
    expect(auctions.iron.close).toBe(priceBand().high);
    expect(auctions.iron.open).toBe(1);
    expect(next.price.iron).toBe(priceBand().high);
    const before = worldTotals(econ, GROUPS, ResourceKey.IRON).stock;
    const after = worldTotals(next, GROUPS, ResourceKey.IRON).stock;
    expect(after).toBeGreaterThan(before);
    expect(after - before).toBeLessThan(before * 0.01);
  });

  it('catches up at most BALANCE.npcTrade.maxCatchUpMs', () => {
    const econ = newNpcEconomy(GROUPS, FLAT_LAND, 0);
    const late = tick(econ, 50 * BALANCE.npcTrade.maxCatchUpMs).econ;
    const capped = tick(econ, BALANCE.npcTrade.maxCatchUpMs).econ;
    expect(late.stock).toEqual(capped.stock);
    expect(late.at).toBe(50 * BALANCE.npcTrade.maxCatchUpMs);
  });

  it('starts new groups at their target and drops groups that are gone', () => {
    const econ = newNpcEconomy(GROUPS.slice(1), FLAT_LAND, 0);
    const { econ: next } = npcTick({ ...econ, stock: { ...econ.stock, gone: econ.price } }, GROUPS, 0, seededRng('x'));
    expect(next.stock[groupKey(0, 5)]).toEqual(groupTarget({ zone: 0, level: 5, members: 200 }));
    expect(next.stock.gone).toBeUndefined();
  });

  it('adds a few made-up trades per resource to the ticker, newest first, keeping the last few', () => {
    let econ = newNpcEconomy(GROUPS, FLAT_LAND, 0);
    for (let t = 1; t <= 40; t++) econ = tick(econ, t * HOUR, `s${t}`).econ;
    expect(econ.ticker.length).toBeLessThanOrEqual(BALANCE.npcTrade.ticker.keep);
    expect(econ.ticker.length).toBeGreaterThan(0);
    const [first, ...rest] = econ.ticker;
    expect(rest.every((x) => x.at <= (first?.at ?? 0))).toBe(true);
    for (const x of econ.ticker) {
      expect(x.amount).toBeGreaterThan(0);
      expect(x.seller).not.toEqual(x.buyer);
    }
  });

  it("picks the ticker's trades at random among the groups that traded, small ones as well as big", () => {
    let econ = newNpcEconomy(GROUPS, FLAT_LAND, 0);
    const levels = new Set<number>();
    const zones = new Set<number>();
    for (let t = 1; t <= 60; t++) {
      econ = tick(econ, t * HOUR, `r${t}`).econ;
      for (const x of econ.ticker) {
        levels.add(x.seller.level).add(x.buyer.level);
        zones.add(x.seller.zone);
      }
    }
    // both levels of the test map, and many of its zones, not only the biggest groups
    expect([...levels].sort()).toEqual([5, 9]);
    expect(zones.size).toBeGreaterThan(ZONES / 2);
  });
});

describe(factionSells.name, () => {
  const [T, S] = [1_000_000_000, 1_000_000_000];

  it('sells a few units at the curve price plus half the player spread', () => {
    const f = factionSells(T, S, 1000);
    expect(f.qty).toBe(1000);
    expect(f.gold / f.qty).toBeCloseTo(1 + BALANCE.npcTrade.playerSpread / 2, 6);
  });

  it('gets dearer as it sells, stopping where its price reaches the limit or the band', () => {
    const big = factionSells(T, S, 200_000_000);
    expect(big.gold / big.qty).toBeGreaterThan(factionMarginal(T, S, TradeSide.BUY));
    expect(big.gold / big.qty).toBeLessThan(factionMarginal(T, S - big.qty, TradeSide.BUY));
    const all = factionSells(T, S, 10 * T);
    expect(factionMarginal(T, S - all.qty, TradeSide.BUY)).toBeCloseTo(priceBand().high, 6);
    const limited = factionSells(T, S, 10 * T, 1.05);
    expect(factionMarginal(T, S - limited.qty, TradeSide.BUY)).toBeCloseTo(1.05, 6);
    expect(factionSells(T, S, 100, 1).qty).toBe(0);
  });

  it('costs the same split in two', () => {
    const one = factionSells(T, S, 300_000_000);
    const a = factionSells(T, S, 100_000_000);
    const b = factionSells(T, S - a.qty, 200_000_000);
    expect(a.gold + b.gold).toBeCloseTo(one.gold, 0);
  });
});

describe(`${factionBuys.name} with a budget`, () => {
  it('buys only as much as the budget pays for, spending close to all of it', () => {
    const [T, S] = [1_000_000_000, 1_000_000_000];
    const f = factionBuys(T, S, 10 * T, 0, 5_000_000);
    expect(f.gold).toBeLessThanOrEqual(5_000_000);
    expect(f.gold).toBeGreaterThan(5_000_000 - 2);
    expect(factionBuys(T, S, 100, 0, 0).qty).toBe(0);
    // a budget bigger than the band allows changes nothing
    expect(factionBuys(T, S, 10 * T, 0, 1e15)).toEqual(factionBuys(T, S, 10 * T));
  });
});

describe(factionBuys.name, () => {
  const [T, S] = [1_000_000_000, 1_000_000_000];

  it('buys at the curve price less half the player spread, cheaper as it buys, down to the band', () => {
    const f = factionBuys(T, S, 1000);
    expect(f.gold / f.qty).toBeCloseTo(1 - BALANCE.npcTrade.playerSpread / 2, 6);
    const all = factionBuys(T, S, 10 * T);
    expect(factionMarginal(T, S + all.qty, TradeSide.SELL)).toBeCloseTo(priceBand().low, 6);
    expect(factionBuys(T, S, 100, 1).qty).toBe(0);
  });
});

describe(factionMarginal.name, () => {
  it('is the curve price, plus or minus half the player spread', () => {
    const half = BALANCE.npcTrade.playerSpread / 2;
    expect(factionMarginal(100, 100, TradeSide.BUY)).toBeCloseTo(1 + half, 12);
    expect(factionMarginal(100, 100, TradeSide.SELL)).toBeCloseTo(1 - half, 12);
    expect(factionMarginal(100, 0, TradeSide.BUY)).toBe(Infinity);
  });
});

describe(factionAffordable.name, () => {
  it('is the most units the gold buys with the fee', () => {
    const [T, S] = [1_000_000_000, 1_000_000_000];
    const n = factionAffordable(T, S, 50_000_000, 1.005);
    expect(factionSells(T, S, n).gold * 1.005).toBeLessThanOrEqual(50_000_000);
    expect(factionSells(T, S, n + 1).gold * 1.005).toBeGreaterThan(50_000_000);
  });
});

describe(takeFromGroups.name, () => {
  it('takes the goods from every group in proportion to what it holds, and pays each its share of the gold', () => {
    const econ = newNpcEconomy(GROUPS, FLAT_LAND, 0);
    const before = worldTotals(econ, GROUPS, ResourceKey.STONE).stock;
    const share = (e: typeof econ) => (e.stock[groupKey(3, 9)]?.stone ?? 0) / worldTotals(e, GROUPS, ResourceKey.STONE).stock;
    const next = takeFromGroups(econ, GROUPS, ResourceKey.STONE, 1_000_000, 1_010_000);
    expect(worldTotals(next, GROUPS, ResourceKey.STONE).stock).toBeCloseTo(before - 1_000_000, 0);
    expect(share(next)).toBeCloseTo(share(econ), 12);
    expect(worldGold(next, GROUPS).gold - worldGold(econ, GROUPS).gold).toBeCloseTo(1_010_000, 0);
    expect((next.gold[groupKey(3, 9)] ?? 0) - (econ.gold[groupKey(3, 9)] ?? 0)).toBeCloseTo(1_010_000 * share(econ), 0);
  });
});

describe(giveToGroups.name, () => {
  it('gives the goods to every group in proportion to its target, each paying in proportion to the gold it holds', () => {
    const econ = newNpcEconomy(GROUPS, FLAT_LAND, 0);
    const next = giveToGroups(econ, GROUPS, ResourceKey.FOOD, 2_000_000, 1_980_000);
    expect(worldTotals(next, GROUPS, ResourceKey.FOOD).stock - worldTotals(econ, GROUPS, ResourceKey.FOOD).stock).toBeCloseTo(2_000_000, 0);
    expect(worldGold(econ, GROUPS).gold - worldGold(next, GROUPS).gold).toBeCloseTo(1_980_000, 0);
    const key = groupKey(4, 5);
    const paidShare = ((econ.gold[key] ?? 0) - (next.gold[key] ?? 0)) / 1_980_000;
    expect(paidShare).toBeCloseTo((econ.gold[key] ?? 0) / worldGold(econ, GROUPS).gold, 12);
  });

  it('never leaves a group owing gold', () => {
    const econ = newNpcEconomy(GROUPS, FLAT_LAND, 0);
    const next = giveToGroups(econ, GROUPS, ResourceKey.FOOD, 1, 10 * worldGold(econ, GROUPS).gold);
    expect(Object.values(next.gold).every((g) => g === 0)).toBe(true);
  });
});

describe(groupTreasury.name, () => {
  it("is its members' gold in the NPC table", () => {
    expect(groupTreasury({ zone: 0, level: 7, members: 3 })).toBe(npcTableGold(7) * 3);
  });
});

describe(worldGold.name, () => {
  it('adds up what the groups hold and their treasuries; a fresh economy holds its treasuries', () => {
    const econ = newNpcEconomy(GROUPS, FLAT_LAND, 0);
    const { gold, treasury } = worldGold(econ, GROUPS);
    expect(gold).toBe(treasury);
    expect(treasury).toBe(GROUPS.reduce((s, g) => s + groupTreasury(g), 0));
  });
});

describe("the factions' gold", () => {
  const quiet = <T>(fn: () => T) => {
    const saved = cfg.wander.sd;
    cfg.wander.sd = 0;
    try {
      return fn();
    } finally {
      cfg.wander.sd = saved;
    }
  };

  it('makes as much gold across the world as it uses, the Italian League making more for its treasury', () => {
    const rates = groupRates(GROUPS, FLAT_LAND);
    expect(rates.reduce((s, r) => s + r.goldMake, 0) / rates.reduce((s, r) => s + r.goldUse, 0)).toBeCloseTo(1, 9);
    const perTreasury = (zone: number) => {
      const i = GROUPS.findIndex((g) => g.zone === zone && g.level === 5);
      return (rates[i]?.goldMake ?? 0) / groupTreasury({ zone, level: 5, members: 200 });
    };
    // Tuscany (Italian League) is strong in gold, Saxony (Saxon League) is not
    expect(perTreasury(14)).toBeGreaterThan(perTreasury(1));
  });

  it('moves gold from buyers to sellers in the auction without making or losing any', () =>
    quiet(() => {
      let econ = newNpcEconomy(GROUPS, FLAT_LAND, 0);
      for (let t = 1; t <= 12; t++) econ = tick(econ, t * HOUR).econ;
      // balanced making and use, and gold only changing hands: the world keeps its treasuries
      expect(worldGold(econ, GROUPS).gold / worldGold(econ, GROUPS).treasury).toBeCloseTo(1, 6);
    }));

  it('buys nothing in the auction with no gold', () =>
    quiet(() => {
      const econ = newNpcEconomy(GROUPS, FLAT_LAND, 0);
      const broke = { ...econ, gold: Object.fromEntries(Object.keys(econ.gold).map((k) => [k, 0])) };
      // short of iron everywhere but Saxony: there is something to buy, but nobody can pay for it
      const short = GROUPS.reduce((e, g) => (g.zone === 1 ? e : plunderGroup(e, g, { iron: groupTarget(g).iron / 2 })), broke);
      expect(npcTick(short, GROUPS, 0, seededRng('x')).auctions.iron.volume).toBe(0);
    }));

  it('drifts back to its treasury after players drain it', () =>
    quiet(() => {
      let econ = newNpcEconomy(GROUPS, FLAT_LAND, 0);
      econ = giveToGroups(econ, GROUPS, ResourceKey.FOOD, 1, worldGold(econ, GROUPS).gold / 2);
      const drained = worldGold(econ, GROUPS).gold;
      econ = tick(econ, BALANCE.npcTrade.restoreHalfLifeMs).econ;
      expect(worldGold(econ, GROUPS).gold).toBeGreaterThan(drained);
    }));
});

describe(plunderGroup.name, () => {
  it("lowers one group's stock, never below nothing", () => {
    const g = { zone: 2, level: 5, members: 200 };
    const econ = newNpcEconomy(GROUPS, FLAT_LAND, 0);
    const next = plunderGroup(econ, g, { food: 1000, iron: 1e15 });
    expect(next.stock[groupKey(2, 5)]).toEqual({ ...groupTarget(g), food: groupTarget(g).food - 1000, iron: 0 });
    expect(next.stock[groupKey(2, 9)]).toEqual(econ.stock[groupKey(2, 9)]);
  });
});
