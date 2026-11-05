import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addHeroExp,
  BALANCE,
  buildCost,
  buildingConfig,
  buildingHeroExp,
  BuildingStatus,
  BuildingType,
  buildTimeMs,
  coinsForSpeedup,
  computeCityStats,
  createRandomHero,
  disbandRefund,
  type EconomyCity,
  type EconomyContext,
  freshNpcState,
  fullDemolishRefund,
  GEAR_PIECES,
  gearLevelPoints,
  gearSetBonus,
  gearSetStars,
  gearStarCost,
  gearStarLimit,
  gearStarPoints,
  gearTier,
  generateMap,
  healCost,
  healHonorCost,
  heroBattleAttackBonus,
  heroBuffDesc,
  heroGearBonus,
  heroGearBreakdown,
  heroItemGoldPrice,
  heroTimeMultiplier,
  injuredOf,
  innHeroMaxLevel,
  innOffers,
  ItemId,
  levelsReady,
  levelUpAll,
  lordGear,
  marchTimeMs,
  maxArmyTroops,
  maxTrainableCount,
  mayorProductionBonus,
  medalId,
  merchantBase,
  plunder,
  PrestigeAction,
  prestigeOf,
  randomStat,
  regenerateNpc,
  reliefMarchMs,
  researchConfig,
  researchCost,
  researchHeroExp,
  researchMaxLevel,
  researchTimeMs,
  rollMedalDrops,
  seededRng,
  setGameSpeed,
  settleCity,
  softCapAttribute,
  splitTraining,
  stateOf,
  syncHeroBuffs,
  syncHeroGear,
  TechType,
  trainCost,
  troopConfig,
  unlockedOuterSlots,
  upgradeExpFor,
  valleyBonus,
  valleyGarrison,
  valleyUpgradeCost,
} from '#/index.ts';

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
  taxRate: 0,
  buildings: [{ positionId: -1, typeId: 31, level: 1, status: 0, startTime: 0, endTime: 0 }],
  troops: {},
  workRates: { gold: 100, food: 100, wood: 100, stone: 100, iron: 100 },
  misc: {},
  ...over,
});

describe('economy', () => {
  // these check the original storage numbers; storageMultiplier is tested on its own below
  const storageCfg = BALANCE as { storageMultiplier: number };
  const configuredStorage = storageCfg.storageMultiplier;
  beforeAll(() => {
    storageCfg.storageMultiplier = 1;
  });
  afterAll(() => {
    storageCfg.storageMultiplier = configuredStorage;
  });

  it('starting city matches the original numbers', () => {
    const s = computeCityStats(city(), ctx(), 0);
    expect(s.maxPopulation).toBe(50);
    expect(s.storage.food).toBe(10_000);
    expect(s.rates.food).toBe(100); // base production only
    expect(s.rates.gold).toBe(5); // 50 pop * 10% tax
  });

  it('(marchlands) a held historic city brings its tribute in gold, by its level', () => {
    const s = computeCityStats(city({ historicLevel: 16 }), ctx(), 0);
    expect(s.tribute).toBe(BALANCE.historic.tribute[16]);
    expect(s.rates.gold).toBe(5 + BALANCE.historic.tribute[16]);
    expect(computeCityStats(city(), ctx(), 0).tribute).toBe(0);
  });

  it("(marchlands) a state's capital brings its state's tribute too, per real hour", () => {
    const s = computeCityStats(city({ historicLevel: 16, stateTribute: 42_000 }), ctx(), 0);
    expect(s.stateTribute).toBe(42_000);
    expect(s.rates.gold).toBe(5 + BALANCE.historic.tribute[16] + 42_000);
    expect(computeCityStats(city(), ctx(), 0).stateTribute).toBe(0);
  });

  it('(marchlands) holding a historic city costs no food: only the tribute sets it apart', () => {
    expect(computeCityStats(city({ historicLevel: 12 }), ctx(), 0).rates.food).toBe(computeCityStats(city(), ctx(), 0).rates.food);
  });

  it("(marchlands) the holder's alliance takes its share of both tributes", () => {
    const share = BALANCE.historic.allianceShare;
    const s = computeCityStats(city({ historicLevel: 16, stateTribute: 40_000 }), ctx({ seats: { shared: true } }), 0);
    expect(s.tribute).toBeCloseTo(BALANCE.historic.tribute[16] * (1 - share));
    expect(s.stateTribute).toBeCloseTo(40_000 * (1 - share));
    expect(s.tributeShared).toBeCloseTo((BALANCE.historic.tribute[16] + 40_000) * share);
  });

  it('(marchlands) the tax rate sells that share of field output to the merchant; the base tax stays', () => {
    const c = city({ population: 1000, buildings: [{ positionId: 1001, typeId: 7, level: 3, status: 0, startTime: 0, endTime: 0 }] });
    const free = computeCityStats(c, ctx(), 0);
    const taxed = computeCityStats({ ...c, taxRate: 20 }, ctx(), 0);
    expect(free.taxIncome).toBe(1000 * BALANCE.baseTaxShare);
    expect(taxed.taxed.food).toBeCloseTo(free.rates.food * 0.2);
    expect(taxed.rates.food).toBeCloseTo(free.rates.food * 0.8);
    const sold = (['food', 'wood', 'stone', 'iron'] as const).reduce((g, r) => g + free.rates[r] * 0.2 * merchantBase(r), 0);
    expect(taxed.taxConverted).toBeCloseTo(sold);
    expect(taxed.taxIncome).toBeCloseTo(free.taxIncome + taxed.taxConverted);
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

  it('(marchlands) settling reports what it produced, wasted and ate, for lord statistics', () => {
    const c = city({ food: 9_990 });
    const r = settleCity(c, ctx(), 3_600_000);
    // one game hour of base production (100 food), of which storage held 10
    expect(r.flows.produced.food).toBeCloseTo(100);
    expect(r.flows.wasted.food).toBeCloseTo(90);
    expect(r.flows.produced.gold).toBeGreaterThan(0);
    const fed = city({ food: 5_000, troops: { militia: 100 } });
    const s = computeCityStats(fed, ctx(), 0);
    const f = settleCity(fed, ctx(), 3_600_000).flows;
    expect(f.upkeep).toBeCloseTo(s.upkeep);
    expect(f.produced.food - f.upkeep - f.wasted.food).toBeCloseTo(fed.food - 5_000);
  });

  it("population grows towards the maximum every 6 minutes (lords' cities have no loyalty)", () => {
    const c = city({ population: 50 });
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
      const h = createRandomHero(10, rng, { state: 0 });
      expect(h.power + h.management + h.stratagem).toBe(h.basePower + h.baseManagement + h.baseStratagem + h.level);
      expect(h.level).toBeLessThanOrEqual(50);
    }
  });
  it('the Inn offers one hero per level, up to BALANCE.inn.maxOffers', () => {
    expect(innOffers(0)).toBe(0);
    expect(innOffers(3)).toBe(3);
    expect(innOffers(BALANCE.inn.maxOffers)).toBe(BALANCE.inn.maxOffers);
    expect(innOffers(BALANCE.inn.maxOffers + 2)).toBe(BALANCE.inn.maxOffers);
  });
  it('Inn heroes reach BALANCE.inn.heroLevelsPerInnLevel levels per Inn level', () => {
    expect(innHeroMaxLevel(1)).toBe(BALANCE.inn.heroLevelsPerInnLevel);
    expect(innHeroMaxLevel(10)).toBe(50);
    const rng = seededRng('inn-3');
    for (let i = 0; i < 200; i++) expect(createRandomHero(3, rng, { state: 0 }).level).toBeLessThanOrEqual(innHeroMaxLevel(3));
  });
  it('field slots: outerSlotsBase plus outerSlotsPerTownHall per Town Hall level, up to the 40 positions', () => {
    expect(unlockedOuterSlots(0)).toBe(BALANCE.outerSlotsBase);
    expect(unlockedOuterSlots(5)).toBe(BALANCE.outerSlotsBase + 5 * BALANCE.outerSlotsPerTownHall);
    expect(unlockedOuterSlots(10)).toBe(40);
    expect(unlockedOuterSlots(20)).toBe(40);
  });
  it('map generation is deterministic with flats, valleys and NPCs', () => {
    const a = generateMap('x', 100);
    const b = generateMap('x', 100);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
    const counts: Record<number, number> = {};
    for (let i = 0; i < a.length; i += 2) counts[a[i]!] = (counts[a[i]!] ?? 0) + 1;
    expect(counts[10]! / 10_000).toBeGreaterThan(0.3);
    expect(counts[12]! / 10_000).toBeGreaterThan(0.05);
  });
  it('states are a 4x4 grid', () => {
    expect(stateOf(0)).toBe(0);
    expect(stateOf(799)).toBe(3);
    expect(stateOf(799 * 800 + 799)).toBe(15);
  });
  it('valley garrisons grow with level', () => {
    const rng = seededRng('valley');
    const total = (lvl: number) => Object.values(valleyGarrison(lvl, rng)).reduce((s, n) => s + n, 0);
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
  it("a Relief Station speeds marches between a player's own places by its multiplier, never under a second", () => {
    const relief = (level: number) => [{ positionId: 0, typeId: BuildingType.RELIEF_STATION, level, status: BuildingStatus.IDLE, startTime: 0, endTime: 0 }];
    expect(reliefMarchMs(600_000, [])).toBe(600_000);
    expect(reliefMarchMs(600_000, relief(1))).toBe(300_000);
    expect(reliefMarchMs(600_000, relief(10))).toBe(100_000);
    expect(reliefMarchMs(1001, relief(10))).toBe(1000);
    expect(reliefMarchMs(5000, relief(4))).toBe(1666);
  });
  it('troop table rows 8-10 carry transporter/cavalry/cataphract stats', () => {
    expect(troopConfig(8)?.load).toBe(5000);
    expect(troopConfig(9)?.life).toBe(500);
    expect(troopConfig(10)?.life).toBe(1000);
    expect([8, 9, 10].map((id) => troopConfig(id)?.population)).toEqual([4, 3, 6]);
  });
  it('plunder spreads evenly and respects availability', () => {
    const p = plunder({ gold: 100, food: 1_000_000, wood: 1_000_000, stone: 0, iron: 1_000_000 }, 30_100);
    expect(p.gold).toBe(100);
    expect(p.stone).toBe(0);
    expect(p.food + p.wood + p.iron + p.gold).toBe(30_100);
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
    const busy = splitTraining(
      [
        { positionId: 1, freeAt: 0 },
        { positionId: 2, freeAt: 0 },
        { positionId: 3, freeAt: 5_000 },
      ],
      101,
      100,
    );
    expect(busy.reduce((s, a) => s + a.count, 0)).toBe(101);
    const t = busy.map((a) => a.finishAt);
    expect(Math.max(...t) - Math.min(...t)).toBeLessThanOrEqual(100);
    // a queue busy past the common finish time gets nothing
    expect(
      splitTraining(
        [
          { positionId: 1, freeAt: 0 },
          { positionId: 2, freeAt: 1e9 },
        ],
        10,
        100,
      ).map((a) => a.positionId),
    ).toEqual([1]);
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

describe('troop upkeep and game speed', () => {
  it('is eaten per real hour when upkeepPerRealHour is on', () => {
    const cfg = BALANCE as { upkeepPerRealHour: boolean };
    const was = cfg.upkeepPerRealHour;
    try {
      setGameSpeed(60);
      cfg.upkeepPerRealHour = true;
      const on = computeCityStats(city({ troops: { militia: 1000 } }), ctx(), 0);
      cfg.upkeepPerRealHour = false;
      const off = computeCityStats(city({ troops: { militia: 1000 } }), ctx(), 0);
      expect(off.upkeep).toBeCloseTo(3000);
      // per game hour; x60 game hours per real hour = 3,000 food per real hour
      expect(on.upkeep).toBeCloseTo(3000 / 60);
    } finally {
      cfg.upkeepPerRealHour = was;
      setGameSpeed(1);
    }
  });
});

describe('hero salaries and game speed', () => {
  it('are paid per real hour when salaryPerRealHour is on', () => {
    const cfg = BALANCE as { heroSalaries: boolean; salaryPerRealHour: boolean };
    const was = { ...cfg };
    try {
      setGameSpeed(60);
      cfg.heroSalaries = true;
      cfg.salaryPerRealHour = true;
      const on = computeCityStats(city({ population: 100 }), ctx({ heroLevels: [10] }), 0);
      cfg.salaryPerRealHour = false;
      const off = computeCityStats(city({ population: 100 }), ctx({ heroLevels: [10] }), 0);
      expect(off.heroSalary).toBeCloseTo(10 * BALANCE.heroSalaryPerLevel);
      expect(on.heroSalary).toBeCloseTo((10 * BALANCE.heroSalaryPerLevel) / 60);
    } finally {
      cfg.heroSalaries = was.heroSalaries;
      cfg.salaryPerRealHour = was.salaryPerRealHour;
      setGameSpeed(1);
    }
  });
});

describe('storage multiplier', () => {
  it('multiplies every resource storage after Stockpile', () => {
    const cfg = BALANCE as { storageMultiplier: number };
    const was = cfg.storageMultiplier;
    try {
      cfg.storageMultiplier = 1;
      const one = computeCityStats(city({}), ctx(), 0).storage;
      cfg.storageMultiplier = 20;
      const twenty = computeCityStats(city({}), ctx(), 0).storage;
      for (const r of ['food', 'wood', 'stone', 'iron'] as const) expect(twenty[r]).toBe(one[r] * 20);
    } finally {
      cfg.storageMultiplier = was;
    }
  });
});

describe('hero items for gold', () => {
  it('price experience books by the experience they give, boosts at a flat price, medals not at all', () => {
    expect(heroItemGoldPrice(ItemId.ANABASIS, 1600)).toBe(Math.ceil(1000 * BALANCE.heroItemGold.perExp));
    expect(heroItemGoldPrice(ItemId.ON_WAR, 1_000_000)).toBe(Math.ceil(1_000_000 * BALANCE.heroItemGold.perExp));
    expect(heroItemGoldPrice(ItemId.EXCALIBUR, 1600)).toBe(BALANCE.heroItemGold.attributeBoost);
    expect(heroItemGoldPrice(ItemId.CROSS_MEDAL, 1600)).toBeNull();
  });
});

describe('hero attribute boosts', () => {
  it('follow the attribute as it grows', () => {
    const h = {
      power: 128,
      management: 40,
      stratagem: 30,
      powerAdded: 0,
      managementAdded: 0,
      stratagemAdded: 0,
      powerBuffAdded: 32,
      managementBuffAdded: 0,
      stratagemBuffAdded: 0,
      buffs: [{ id: 'power', desc: heroBuffDesc('power'), endTime: 1, param: 32 }],
    };
    expect(syncHeroBuffs(h)).toBe(false);
    h.power = 161;
    expect(syncHeroBuffs(h)).toBe(true);
    expect(h.powerBuffAdded).toBe(41);
    expect(h.buffs[0]!.param).toBe(41);
    expect(h.managementBuffAdded).toBe(0);
  });
});

describe('hero level experience', () => {
  it('grows as level² × 100', () => {
    expect(upgradeExpFor(10)).toBe(10_000);
    expect(upgradeExpFor(99)).toBe(980_100);
  });

  it('stops at the maximum level', () => {
    const h = { level: 100, experience: 0 };
    addHeroExp(h, 50_000);
    expect(h.experience).toBe(0);
    const young = { level: 99, experience: 0 };
    addHeroExp(young, 50_000);
    expect(young.experience).toBe(50_000);
  });
});

describe('rally spot troop limit', () => {
  const rally = (level: number) => [{ positionId: 5, typeId: 29, level, status: 0 as const, startTime: 0, endTime: 0 }];
  it('is 10,000 troops per level, +25% with a War Ensign', () => {
    expect(maxArmyTroops(rally(1))).toBe(10_000);
    expect(maxArmyTroops(rally(10))).toBe(100_000);
    expect(maxArmyTroops(rally(10), true)).toBe(125_000);
    expect(maxArmyTroops([])).toBe(0);
  });
});

describe('medicine and honor healing', () => {
  it('saves 5% of the fallen per Medicine level, up to 50%', () => {
    expect(injuredOf({ archer: 10000, militia: 999 }, { 16: { level: 7 } })).toEqual({ archer: 3500, militia: 349 });
    expect(injuredOf({ archer: 10000 }, { 16: { level: 20 } })).toEqual({ archer: 5000 });
    expect(injuredOf({ archer: 10000 }, {})).toEqual({});
  });
  it('heals for honor: each unit costs its food upkeep', () => {
    expect(healHonorCost({ archer: 100, militia: 10 })).toBe(100 * 9 * BALANCE.healHonorPerUpkeep + 10 * 3 * BALANCE.healHonorPerUpkeep);
  });
});

describe('medal drops', () => {
  const tally = (level: number, n = 20000) => {
    const rng = seededRng(`medals-${level}`);
    let any = 0,
      two = 0,
      three = 0,
      max = 0,
      min = 99;
    for (let i = 0; i < n; i++) {
      const d = rollMedalDrops(level, rng);
      const count = Object.values(d).reduce((a, b) => a + b, 0);
      if (count >= 1) any++;
      if (count >= 2) two++;
      if (count >= 3) three++;
      for (const id of Object.keys(d)) {
        const l = Number(id.split('.').pop());
        max = Math.max(max, l);
        min = Math.min(min, l);
      }
    }
    return { any: any / n, two: two / n, three: three / n, max, min };
  };
  it('drop more often, and better medals, from higher cities', () => {
    const l1 = tally(1);
    const l10 = tally(10);
    expect(l1.any).toBeCloseTo(0.17, 1);
    expect(l1.max).toBe(1);
    expect(l1.two).toBe(0);
    expect(l10.any).toBeCloseTo(0.8, 1);
    expect(l10.max).toBe(9);
    expect(l10.two).toBeGreaterThan(0.5);
    expect(l10.three).toBeGreaterThan(0.2);
  });

  it('can drop every medal level from a level 10 city', () => {
    const rng = seededRng('medals-every-level');
    const seen = new Set<string>();
    for (let i = 0; i < 20000; i++) for (const id of Object.keys(rollMedalDrops(10, rng))) seen.add(id);
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9].map(medalId));
  });
});

describe('barbarian loyalty recovery', () => {
  it('runs on real time, not game speed', () => {
    setGameSpeed(60);
    try {
      const fresh = freshNpcState(10, 0);
      const hit = { ...fresh.state, loyalty: 50 };
      // 6 real seconds = one game tick at 60x: troops recover, loyalty does not
      const a = regenerateNpc(10, hit, {}, {}, 6_000);
      expect(a.troops.militia).toBe(40_000);
      expect(a.state.loyalty).toBe(50);
      // 6 real minutes: +1 loyalty
      const b = regenerateNpc(10, a.state, a.troops, a.forts, 6 * 60_000);
      expect(b.state.loyalty).toBe(51);
    } finally {
      setGameSpeed(1);
    }
  });
});

describe('level up all at once', () => {
  it('spends experience on every level it pays for', () => {
    // Lv 10 needs 10,000, Lv 11 needs 12,100, Lv 12 needs 14,400
    const h = { level: 10, experience: 10_000 + 12_100 + 500, upgradeExp: upgradeExpFor(10), remainPoint: 0 };
    expect(levelsReady(h)).toBe(2);
    expect(levelUpAll(h)).toBe(2);
    expect(h).toEqual({ level: 12, experience: 500, upgradeExp: 14_400, remainPoint: 2 });
    expect(levelUpAll(h)).toBe(0);
  });

  it('stops at level 100 and drops the experience left over', () => {
    const h = { level: 98, experience: 5_000_000, upgradeExp: upgradeExpFor(98), remainPoint: 5 };
    expect(levelsReady(h)).toBe(2);
    expect(levelUpAll(h)).toBe(2);
    expect(h).toEqual({ level: 100, experience: 0, upgradeExp: 1_000_000, remainPoint: 7 });
    expect(levelUpAll({ ...h, experience: 2_000_000 })).toBe(0);
  });
});

describe('hero gear', () => {
  const allStars = (n: number) => Object.fromEntries(GEAR_PIECES.map((p) => [p.id, n]));
  const hero = (level: number, power: number, gearStat: string | null = null) => ({
    level,
    power,
    management: 20,
    stratagem: 30,
    powerAdded: 0,
    managementAdded: 0,
    stratagemAdded: 0,
    gearStat,
  });

  it('lets a hero use one gear level and star per 10 levels: none below level 10, all 10 at level 100', () => {
    expect([1, 9, 10, 19, 50, 79, 80, 99, 100].map(gearTier)).toEqual([0, 0, 1, 1, 5, 7, 8, 9, 10]);
  });

  it('gives L points per piece level and N for star N', () => {
    expect(gearLevelPoints(10)).toBe(10);
    expect([0, 1, 2, 9, 10].map(gearStarPoints)).toEqual([0, 1, 3, 45, 55]);
    const maxed = { level: 10, stars: allStars(10) };
    // levels 140, stars 770, set bonus 140
    expect(heroGearBonus(100, maxed)).toBe(14 * (10 + 55) + 140);
    // level 50 (tier 5): level 5 pieces, 5 stars of each and a set bonus of 5 star levels; nothing below level 10
    expect(heroGearBonus(50, maxed)).toBe(14 * (5 + 15) + 5 * 14);
    expect(heroGearBonus(9, maxed)).toBe(0);
    // research and stars still limit a maxed hero; one starred piece earns no set bonus
    expect(heroGearBonus(100, { level: 3, stars: { weapon: 2 } })).toBe(14 * 3 + 3);
  });

  it('adds a set bonus for the star level every piece has reached', () => {
    // half the pieces at 9 stars, half at 10, and one at 8: the set counts 8
    const stars = Object.fromEntries(GEAR_PIECES.map((p, i) => [p.id, i === 0 ? 8 : i % 2 ? 9 : 10]));
    const gear = { level: 10, stars };
    expect(gearSetStars(gear)).toBe(8);
    expect(heroGearBreakdown(100, gear)).toMatchObject({ setStars: 8, setBonus: 112 });
    expect(gearSetBonus(10)).toBe(140);
    // the Hero Enhancement level and the hero's tier cap it
    expect(gearSetStars({ level: 5, stars })).toBe(5);
    expect(heroGearBreakdown(60, gear).setStars).toBe(6);
    // a piece with no stars means no set bonus
    expect(gearSetStars({ level: 10, stars: { ...stars, feet: 0 } })).toBe(0);
  });

  it('reaches 1,229 in one attribute for a maxed level 100 hero with the best base roll', () => {
    const h = hero(100, 79 + 100);
    syncHeroGear(h, { level: 10, stars: allStars(10) });
    expect(h.power + h.powerAdded).toBe(1_229);
  });

  it('boosts the chosen attribute, else the strongest one; none without gear', () => {
    const gear = { level: 2, stars: {} };
    const h = hero(30, 100);
    syncHeroGear(h, gear);
    expect([h.powerAdded, h.managementAdded, h.stratagemAdded]).toEqual([28, 0, 0]);
    h.gearStat = 'stratagem';
    expect(syncHeroGear(h, gear)).toBe(true);
    expect([h.powerAdded, h.managementAdded, h.stratagemAdded]).toEqual([0, 0, 28]);
    expect(syncHeroGear(h, gear)).toBe(false);
    syncHeroGear(h, null);
    expect(h.stratagemAdded).toBe(0);
  });

  it('counts no more stars than the Hero Enhancement level', () => {
    expect(gearStarLimit({ level: 3, stars: {} })).toBe(3);
    expect(heroGearBonus(100, { level: 0, stars: { weapon: 10 } })).toBe(0);
    expect(heroGearBonus(100, { level: 3, stars: { weapon: 10 } })).toBe(14 * 3 + gearStarPoints(3));
  });

  it('prices stars 1-9 at two medals of that level and star 10 at six Nation Medals', () => {
    expect(gearStarCost(1)).toEqual({ itemId: ItemId.CROSS_MEDAL, count: 2 });
    expect(gearStarCost(6)).toEqual({ itemId: ItemId.WISDOM_MEDAL, count: 2 });
    expect(gearStarCost(9)).toEqual({ itemId: ItemId.NATION_MEDAL, count: 2 });
    expect(gearStarCost(10)).toEqual({ itemId: ItemId.NATION_MEDAL, count: 6 });
  });

  it('reads the lord gear from Hero Enhancement and the stars bought', () => {
    expect(lordGear({ research: { [TechType.HERO_ENHANCEMENT]: { level: 4 } }, misc: { gearStars: { weapon: 3, bogus: 9 } } })).toEqual({
      level: 4,
      stars: { weapon: 3 },
    });
    expect(researchMaxLevel(TechType.HERO_ENHANCEMENT)).toBe(10);
    expect(researchConfig(TechType.HERO_ENHANCEMENT, 7)?.requires.buildings).toEqual([{ id: BuildingType.ACADEMY, level: 7 }]);
  });

  it('applies attribute boosts to gear too', () => {
    // level 100, base 76: 175 own points + 800 gear = 975, +25% = 1,219
    const h = {
      power: 175,
      management: 0,
      stratagem: 0,
      powerAdded: 800,
      managementAdded: 0,
      stratagemAdded: 0,
      powerBuffAdded: 0,
      managementBuffAdded: 0,
      stratagemBuffAdded: 0,
      buffs: [{ id: 'power', desc: heroBuffDesc('power'), endTime: 1, param: 0 }],
    };
    syncHeroBuffs(h);
    expect(h.power + h.powerAdded + h.powerBuffAdded).toBe(1_219);
  });
});

describe('hero soft caps', () => {
  it('count an attribute in full up to the knee and as √(knee × value) above it', () => {
    expect(softCapAttribute(150, true)).toBe(150);
    expect(softCapAttribute(450, true)).toBeCloseTo(300);
    expect(softCapAttribute(1_250, true)).toBeCloseTo(500);
    expect(softCapAttribute(1_250, false)).toBe(1_250);
  });

  it('soften the mayor production bonus and battle attack when on', () => {
    const cfg = BALANCE.heroSoftCap as { production: boolean; battle: boolean };
    const was = { ...cfg };
    try {
      cfg.production = true;
      cfg.battle = true;
      expect(mayorProductionBonus(150)).toBeCloseTo(1.5);
      expect(mayorProductionBonus(1_250)).toBeCloseTo(5);
      expect(heroBattleAttackBonus(800)).toBeCloseTo(4);
      cfg.production = false;
      cfg.battle = false;
      expect(mayorProductionBonus(1_250)).toBeCloseTo(12.5);
      expect(heroBattleAttackBonus(800)).toBeCloseTo(8);
    } finally {
      Object.assign(cfg, was);
    }
  });

  it('keep at least the floor of build and research times, but not of training', () => {
    const floor = BALANCE.heroTimeFloor as { building: number | null; research: number | null };
    const was = { ...floor };
    try {
      floor.building = 0.1;
      floor.research = 0.1;
      const mayor = { power: 1_500, management: 1_500, stratagem: 1_500 };
      const cfg = researchConfig(TechType.AGRICULTURE, 1)!;
      expect(researchTimeMs(TechType.AGRICULTURE, 1, mayor)).toBe(Math.floor(cfg.buildTime * 0.1) * 1000);
      expect(heroTimeMultiplier(1_500, 0.1)).toBe(0.1);
      expect(heroTimeMultiplier(1_500, null)).toBeLessThan(0.001);
      floor.research = null;
      expect(researchTimeMs(TechType.AGRICULTURE, 1, mayor)).toBeLessThan(Math.floor(cfg.buildTime * 0.1) * 1000);
    } finally {
      Object.assign(floor, was);
    }
  });
});

describe('barbarian city gold', () => {
  it('matches the largest resource and regenerates like it', () => {
    const fresh = freshNpcState(10, 0);
    expect(fresh.state.gold).toBe(19_000_000);
    expect(fresh.state.food).toBe(19_000_000);
    const raided = { ...fresh.state, gold: 0, food: 0 };
    // one regeneration tick (6 game minutes at speed 1): +1/80 of the maximum each
    const r = regenerateNpc(10, raided, fresh.troops, fresh.forts, 6 * 60_000);
    expect(r.state.gold).toBe(19_000_000 / 80);
    expect(r.state.food).toBe(19_000_000 / 80);
  });
});

describe('full demolition', () => {
  it('refunds a third of every level up to the current one', () => {
    const sum = (l: number, k: 'food' | 'wood') => [...Array(l)].reduce((t, _, i) => t + (buildingConfig(BuildingType.COTTAGE, i + 1)?.cost[k] ?? 0), 0);
    const r = fullDemolishRefund(BuildingType.COTTAGE, 3);
    expect(r.wood).toBeCloseTo(sum(3, 'wood') / 3);
    expect(r.food).toBeCloseTo(sum(3, 'food') / 3);
  });
});

describe('(marchlands) troop training discount', () => {
  it('charges the paid share of the cost, rounded up, and counts it in the max', () => {
    const full = trainCost(3, 3);
    const paid = trainCost(3, 3, 0.75);
    for (const k of ['gold', 'food', 'wood', 'stone', 'iron'] as const) expect(paid[k]).toBe(Math.ceil(full[k] * 0.75));
    const have = { gold: 1e9, food: full.food, wood: 1e9, stone: 1e9, iron: 1e9 };
    expect(maxTrainableCount(3, have, 1e9)).toBe(3);
    expect(maxTrainableCount(3, have, 1e9, 0.75)).toBe(4);
  });
});

describe(disbandRefund.name, () => {
  const share = (cost: number, units: number) => Math.floor(cost * units * BALANCE.disbandRefund + 1e-9);

  it('returns the refund share of the training cost, rounded down, for units the credit covers', () => {
    const full = trainCost(3, 10);
    const r = disbandRefund(3, 10, 25);
    expect(r.creditUsed).toBe(10);
    for (const k of ['gold', 'food', 'wood', 'stone', 'iron'] as const) expect(r.refund[k]).toBe(share(full[k] / 10, 10));
  });

  it('refunds only as many units as the credit covers', () => {
    const one = trainCost(3, 1);
    const r = disbandRefund(3, 10, 7.5);
    expect(r.creditUsed).toBe(7.5);
    expect(r.refund.food).toBe(share(one.food, 7.5));
  });

  it('refunds nothing without credit', () => {
    const r = disbandRefund(3, 10, 0);
    expect(r.creditUsed).toBe(0);
    expect(Object.values(r.refund).every((v) => v === 0)).toBe(true);
    expect(disbandRefund(3, 10, -1).creditUsed).toBe(0);
  });

  it('never returns more than the share of what discounted training paid', () => {
    // trained at 0.75 of the cost: 100 units add 75 units of credit
    const paid = trainCost(3, 100, 0.75);
    const r = disbandRefund(3, 100, 100 * 0.75);
    for (const k of ['gold', 'food', 'wood', 'stone', 'iron'] as const) expect(r.refund[k]).toBeLessThanOrEqual(paid[k] * BALANCE.disbandRefund);
  });

  it('works for fortifications', () => {
    const full = trainCost(14, 4);
    expect(disbandRefund(14, 4, 4).refund.wood).toBe(share(full.wood, 1));
  });
});
