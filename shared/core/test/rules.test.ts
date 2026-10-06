import { describe, expect, it } from 'vitest';
import {
  BALANCE,
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
  researchCost,
  researchHeroExp,
  buildingHeroExp,
  PrestigeAction,
  rollAmulet,
  seededRng,
  settleCity,
  splitTraining,
  stateOf,
  troopConfig,
  valleyBonus,
  valleyUpgradeCost,
  healCost,
  trainCost,
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

  it('troops eat and starve when food runs out (with desertion on)', () => {
    const cfg = BALANCE as { starvationDesertion: boolean };
    const was = cfg.starvationDesertion;
    cfg.starvationDesertion = true;
    try {
      const c = city({ food: 10, troops: { militia: 1000 } });
      const r = settleCity(c, ctx(), 3_600_000);
      expect(c.food).toBe(0);
      expect(r.deserted.militia).toBeGreaterThan(0);
    } finally {
      cfg.starvationDesertion = was;
    }
  });

  it('with desertion off, food stops at 0 and troops stay', () => {
    const cfg = BALANCE as { starvationDesertion: boolean };
    const was = cfg.starvationDesertion;
    cfg.starvationDesertion = false;
    try {
      const c = city({ food: 10, troops: { militia: 1000 } });
      const r = settleCity(c, ctx(), 3_600_000);
      expect(c.food).toBe(0);
      expect(c.troops.militia).toBe(1000);
      expect(r.deserted).toEqual({});
    } finally {
      cfg.starvationDesertion = was;
    }
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

  it('every valley type gives the same bonus per level (+3%/level from 8%)', () => {
    // 1 forest, 2 desert, 3 hill, 4 swamp, 5 grass, 6 lake, 10 flat
    for (const t of [1, 2, 3, 4, 5, 6]) {
      expect(valleyBonus(t, 1)).toBeCloseTo(0.08);
      expect(valleyBonus(t, 7)).toBeCloseTo(0.26);
      expect(valleyBonus(t, 10)).toBeCloseTo(0.35);
    }
    expect(valleyBonus(10, 5)).toBe(0);
  });

  it('splits training across barracks so they finish together', () => {
    const lanes = Array.from({ length: 10 }, (_, i) => ({ positionId: i, freeAt: 0 }));
    const even = splitTraining(lanes, 1000, 100);
    expect(even).toHaveLength(10);
    expect(even.every((a) => a.count === 100)).toBe(true);
    expect(Math.max(...even.map((a) => a.finishAt))).toBe(10_000);
    // a barracks already busy for a while gets fewer units; remainders are spread
    const busy = splitTraining([{ positionId: 1, freeAt: 0 }, { positionId: 2, freeAt: 0 }, { positionId: 3, freeAt: 5_000 }], 101, 100);
    expect(busy.reduce((s, a) => s + a.count, 0)).toBe(101);
    const t = busy.map((a) => a.finishAt);
    expect(Math.max(...t) - Math.min(...t)).toBeLessThanOrEqual(100);
    // a queue busy past the common finish time gets nothing
    expect(splitTraining([{ positionId: 1, freeAt: 0 }, { positionId: 2, freeAt: 1e9 }], 10, 100).map((a) => a.positionId)).toEqual([1]);
    expect(splitTraining([{ positionId: 1, freeAt: 0 }], 7, 100)).toEqual([{ positionId: 1, count: 7, finishAt: 700 }]);
  });
});


describe('research hero exp', () => {
  it('is prestige plus a share of the level cost, growing with the level', () => {
    const c = researchCost(1, 5);
    const spent = c.food + c.wood + c.stone + c.iron + c.gold;
    expect(researchHeroExp(1, 5, 5)).toBeCloseTo(prestigeOf(PrestigeAction.RESEARCH, 1, 5, 5) + spent * BALANCE.heroExpPerResearch);
    expect(researchHeroExp(1, 6, 5)).toBeGreaterThan(researchHeroExp(1, 5, 5));
  });
});

describe('building hero exp', () => {
  it('is prestige plus a share of the level cost', () => {
    const c = buildCost(5, 5);
    const spent = c.food + c.wood + c.stone + c.iron + c.gold;
    expect(buildingHeroExp(5, 5, 5)).toBeCloseTo(prestigeOf(PrestigeAction.BUILDING, 5, 5, 5) + spent * BALANCE.heroExpPerBuild);
    expect(buildingHeroExp(5, 6, 5)).toBeGreaterThan(buildingHeroExp(5, 5, 5));
  });
});

describe('valley upgrades', () => {
  it('cost gold doubling per level and stop at the top level', () => {
    expect(valleyUpgradeCost(1)).toBe(BALANCE.valleyUpgrade.baseGold);
    expect(valleyUpgradeCost(2)).toBe(BALANCE.valleyUpgrade.baseGold * 2);
    expect(valleyUpgradeCost(9)).toBe(BALANCE.valleyUpgrade.baseGold * 256);
    expect(valleyUpgradeCost(BALANCE.valleyUpgrade.maxLevel)).toBeNull();
  });
});

describe('hero salaries', () => {
  const cfg = BALANCE as { heroSalaries: boolean };
  const run = (on: boolean) => {
    const was = cfg.heroSalaries;
    cfg.heroSalaries = on;
    try {
      return computeCityStats(city({ population: 100 }), ctx({ heroLevels: [10, 5] }), 0);
    } finally {
      cfg.heroSalaries = was;
    }
  };

  it('cost gold per hero level when on', () => {
    const s = run(true);
    expect(s.heroSalary).toBe(15 * BALANCE.heroSalaryPerLevel);
    expect(s.rates.gold).toBeCloseTo(s.taxIncome - s.heroSalary);
  });

  it('cost nothing when off', () => {
    const s = run(false);
    expect(s.heroSalary).toBe(0);
    expect(s.rates.gold).toBeCloseTo(s.taxIncome);
  });
});

describe('healing injured troops', () => {
  it('costs the configured share of the training cost', () => {
    const c = healCost({ militia: 100, archer: 10 });
    const m = trainCost(3, 100);
    const a = trainCost(7, 10);
    expect(c.food).toBeCloseTo((m.food + a.food) * BALANCE.healCostShare);
    expect(c.wood).toBeCloseTo((m.wood + a.wood) * BALANCE.healCostShare);
  });
});
