import { describe, expect, it } from 'vitest';
import {
  buildCost,
  buildTimeMs,
  coinsForSpeedup,
  computeCityStats,
  createRandomHero,
  generateMap,
  marchTimeMs,
  plunder,
  prestigeOf,
  randomStat,
  rollAmulet,
  seededRng,
  settleCity,
  stateOf,
  troopConfig,
  valleyGarrison,
  type EconomyCity,
  type EconomyContext,
} from '../src/index.ts';

const ctx = (over: Partial<EconomyContext> = {}): EconomyContext => ({
  research: {},
  mayor: null,
  heroLevels: [],
  valleys: [],
  buffs: [],
  awayTroops: {},
  ...over,
});

const city = (over: Partial<EconomyCity> = {}): EconomyCity => ({
  gold: 0,
  food: 0,
  wood: 0,
  stone: 0,
  iron: 0,
  resourcesAt: 0,
  population: 50,
  loyalty: 90,
  grievance: 0,
  taxRate: 10,
  buildings: [{ positionId: -1, typeId: 31, level: 1, status: 0, startTime: 0, endTime: 0 }],
  troops: {},
  workRates: { gold: 100, food: 100, wood: 100, stone: 100, iron: 100 },
  misc: {},
  ...over,
});

describe('economy', () => {
  it('starting city matches the original numbers', () => {
    const s = computeCityStats(city(), ctx(), 0);
    expect(s.maxPopulation).toBe(50);
    expect(s.storage.food).toBe(10_000);
    expect(s.rates.food).toBe(100); // base production only
    expect(s.rates.gold).toBe(5); // 50 pop * 10% tax
  });

  it('fields add production, storage and workers (F table)', () => {
    const c = city({ population: 1000, buildings: [{ positionId: 1001, typeId: 7, level: 3, status: 0, startTime: 0, endTime: 0 }] });
    const s = computeCityStats(c, ctx(), 0);
    expect(s.storage.food).toBe(10_000 + 60_000);
    expect(s.workers.food).toBe(60);
    expect(s.rates.food).toBe(600 + 100);
  });

  it('agriculture tech is capped by academy level', () => {
    const farm = { positionId: 1001, typeId: 7, level: 1, status: 0 as const, startTime: 0, endTime: 0 };
    const academy = { positionId: 0, typeId: 25, level: 2, status: 0 as const, startTime: 0, endTime: 0 };
    const s = computeCityStats(city({ population: 100, buildings: [farm, academy] }), ctx({ research: { 1: { level: 5 } } }), 0);
    expect(s.bonus.food).toBeCloseTo(0.2);
  });

  it('troops eat and starve when food runs out', () => {
    const c = city({ food: 10, troops: { militia: 1000 } });
    const r = settleCity(c, ctx(), 3_600_000);
    expect(c.food).toBe(0);
    expect(r.deserted.militia).toBeGreaterThan(0);
  });

  it('settling integrates resources up to storage', () => {
    const c = city({ food: 9_990 });
    settleCity(c, ctx(), 3_600_000);
    expect(c.food).toBe(10_000);
    expect(c.resourcesAt).toBe(3_600_000);
  });

  it('population drifts towards loyalty-weighted target every 6 minutes', () => {
    const c = city({ population: 50, loyalty: 90 });
    c.buildings.push({ positionId: 0, typeId: 1, level: 5, status: 0, startTime: 0, endTime: 0 });
    const r = settleCity(c, ctx(), 60 * 60_000);
    expect(r.ticks).toBe(10);
    expect(c.population).toBeGreaterThan(50);
  });
});

describe('construction', () => {
  it('costs double per level', () => {
    expect(buildCost(31, 2).wood).toBe(buildCost(31, 1).wood * 2);
  });
  it('mayor management and Construction shorten building time', () => {
    const base = buildTimeMs(1, 1, null, {});
    expect(base).toBe(75_000);
    expect(buildTimeMs(1, 1, { power: 0, management: 100, stratagem: 0 }, { 17: { level: 2 } })).toBeLessThan(base);
  });
  it('prestige formula (orig examples)', () => {
    expect(prestigeOf(2, 1, 1, 1)).toBe(8);
    expect(prestigeOf(2, 31, 2, 2)).toBe(224);
    expect(prestigeOf(3, 3, 1, 3) * 100).toBe(25);
  });
});

describe('speed-up coins', () => {
  it('is monotonic (original 15-minute bug fixed)', () => {
    let last = 0;
    for (let m = 0; m <= 2000; m++) {
      const c = coinsForSpeedup(m * 60_000);
      expect(c).toBeGreaterThanOrEqual(last);
      last = c;
    }
    expect(coinsForSpeedup(60_000)).toBe(5);
    expect(coinsForSpeedup(8 * 3_600_000)).toBe(50);
  });
});

describe('heroes & world', () => {
  it('random stats stay in range', () => {
    const rng = seededRng('stats');
    for (let i = 0; i < 2000; i++) {
      const s = randomStat(rng);
      expect(s).toBeGreaterThanOrEqual(10);
      expect(s).toBeLessThanOrEqual(79);
    }
  });
  it('tavern heroes keep the point invariant', () => {
    const rng = seededRng('heroes');
    for (let i = 0; i < 200; i++) {
      const h = createRandomHero(10, rng);
      expect(h.power + h.management + h.stratagem).toBe(h.basePower + h.baseManagement + h.baseStratagem + h.level);
      expect(h.level).toBeLessThanOrEqual(50);
    }
  });
  it('map generation is deterministic with flats, valleys and NPCs', () => {
    const a = generateMap('x', 100);
    const b = generateMap('x', 100);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
    const counts: Record<number, number> = {};
    for (let i = 0; i < a.length; i += 2) counts[a[i]] = (counts[a[i]] ?? 0) + 1;
    expect(counts[10] / 10_000).toBeGreaterThan(0.3);
    expect(counts[12] / 10_000).toBeGreaterThan(0.05);
  });
  it('states are a 4x4 grid', () => {
    expect(stateOf(0)).toBe(0);
    expect(stateOf(799)).toBe(3);
    expect(stateOf(799 * 800 + 799)).toBe(15);
  });
  it('valley garrisons grow with level', () => {
    const rng = seededRng('valley');
    const total = (lvl: number) => Object.values(valleyGarrison(lvl, rng)).reduce((s, n) => s + (n ?? 0), 0);
    expect(total(8)).toBeGreaterThan(total(1));
  });
});

describe('armies', () => {
  it('cavalry marches one tile per minute', () => {
    expect(marchTimeMs(0, 10, { lightCavalry: 1 }, {}, [])).toBe(10 * 60_000);
  });
  it('slowest unit decides speed', () => {
    expect(marchTimeMs(0, 10, { lightCavalry: 1, catapult: 1 }, {}, [])).toBe(Math.floor((10 * 60_000) / 80) * 1000);
  });
  it('troop table rows 8-10 carry transporter/cavalry/cataphract stats', () => {
    expect(troopConfig(8)?.load).toBe(5000);
    expect(troopConfig(9)?.life).toBe(500);
    expect(troopConfig(10)?.life).toBe(1000);
  });
  it('plunder spreads evenly and respects availability', () => {
    const p = plunder({ gold: 100, food: 1_000_000, wood: 1_000_000, stone: 0, iron: 1_000_000 }, 30_100);
    expect(p.gold).toBe(100);
    expect(p.stone).toBe(0);
    expect(p.food + p.wood + p.iron + p.gold).toBe(30_100);
  });
  it('amulet always returns 24 slots and a winner', () => {
    const rng = seededRng('amulet');
    for (let i = 0; i < 100; i++) {
      const { slots, winner } = rollAmulet(rng);
      expect(slots).toHaveLength(24);
      expect(winner).toBeGreaterThanOrEqual(0);
      expect(winner).toBeLessThan(24);
    }
  });
});
