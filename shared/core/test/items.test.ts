import { describe, expect, it } from 'vitest';
import {
  BALANCE,
  civilCodePopulation,
  createBoxHero,
  DAY,
  experienceItemGain,
  goldForCents,
  heroAttributeBuffEnd,
  heroBoxQuality,
  heroBuffAmount,
  HOUR,
  isRemovedItem,
  ITEM_IDS,
  itemEffect,
  itemGoldPrice,
  ItemId,
  itemInfo,
  ITEMS,
  loyaltyAfterMedal,
  medalId,
  MINUTE,
  seededRng,
  SPEEDUP_ITEMS,
  SpeedupId,
  speedupItemGold,
  speedUpTrainBatch,
  type TrainBatch,
  upgradeExpFor,
} from '#/index.ts';

const items = BALANCE.items;

describe('SPEEDUP_ITEMS', () => {
  const rng = (r: number) => () => r;

  it('has every speed-up of BALANCE.items.speedups, at its price in cents', () => {
    expect(Object.keys(SPEEDUP_ITEMS).sort()).toEqual(Object.keys(items.speedups).sort());
    for (const [id, s] of Object.entries(items.speedups)) expect(SPEEDUP_ITEMS[id]!.cents, id).toBe(s.cents);
  });

  it('cuts a fixed time, whatever is left', () => {
    expect(SPEEDUP_ITEMS[ItemId.BEGINNER_GUIDELINES]!.reduce(10 * HOUR, rng(0.5))).toBe(15 * MINUTE);
    expect(SPEEDUP_ITEMS[ItemId.INTERMEDIATE_GUIDELINES]!.reduce(0, rng(0.5))).toBe(2.5 * HOUR);
  });

  it('cuts a random whole number of hours in the cutHours range', () => {
    const [min, max] = items.speedups[ItemId.MASTER_GUIDELINES]!.cutHours!;
    const reduce = SPEEDUP_ITEMS[ItemId.MASTER_GUIDELINES]!.reduce;
    expect(reduce(0, rng(0))).toBe(min * HOUR);
    expect(reduce(0, rng(0.999_999))).toBe(max * HOUR);
    const r = seededRng('speedup');
    for (let i = 0; i < 200; i++) {
      const hours = reduce(0, () => r.next()) / HOUR;
      expect(Number.isInteger(hours) && hours >= min && hours <= max).toBe(true);
    }
  });

  it('cuts a share of the total time', () => {
    expect(SPEEDUP_ITEMS[ItemId.ULTIMATE_GUIDELINES]!.reduce(10 * HOUR, rng(0))).toBe(10 * HOUR * items.speedups[ItemId.ULTIMATE_GUIDELINES]!.cutShare!);
    expect(SPEEDUP_ITEMS[SpeedupId.HALF_TIME]!.reduce(4 * HOUR, rng(0))).toBe(2 * HOUR);
  });

  it('costs its gold price when the player has none', () => {
    for (const [id, s] of Object.entries(items.speedups)) expect(speedupItemGold(id), id).toBe(itemGoldPrice(id) ?? goldForCents(s.cents));
  });
});

describe(experienceItemGain.name, () => {
  it('gives a share of the next level, at least the book minimum', () => {
    for (const [id, book] of Object.entries(items.experienceBooks)) {
      expect(experienceItemGain(id, 0), id).toBe(book.min);
      expect(experienceItemGain(id, 10_000_000), id).toBe(Math.floor(10_000_000 * book.share));
    }
    expect(experienceItemGain(ItemId.EPITOME_OF_MILITARY_SCIENCE, 100_000)).toBe(30_000);
    expect(experienceItemGain(ItemId.ON_WAR, 250_000)).toBe(250_000);
  });

  it('is 0 for an item that is not an experience book', () => {
    expect(experienceItemGain(ItemId.CROSS_MEDAL, 100_000)).toBe(0);
  });
});

describe(heroBoxQuality.name, () => {
  it('reads a listed hero box, and the fallback for any other', () => {
    expect(heroBoxQuality(ItemId.HERO_PACKAGE)).toEqual(items.heroBoxes[ItemId.HERO_PACKAGE]);
    expect(heroBoxQuality('unknown.box')).toEqual(items.heroBoxFallback);
  });
});

describe(heroBuffAmount.name, () => {
  it('adds heroAttributeBuff.bonus of the points, rounded up', () => {
    expect(heroBuffAmount(0)).toBe(0);
    expect(heroBuffAmount(100)).toBe(Math.ceil(100 * items.heroAttributeBuff.bonus));
    expect(heroBuffAmount(7)).toBe(2);
  });
});

describe(itemEffect.name, () => {
  it('lasts buffDurationMs.short for 1-day items and .long for 7-day ones', () => {
    expect(itemEffect(ItemId.PLOWSHARES)).toMatchObject({ kind: 'buff', durationMs: items.buffDurationMs.short });
    expect(itemEffect(ItemId.IRON_RAKE)).toMatchObject({ kind: 'buff', durationMs: items.buffDurationMs.long });
    expect(items.buffDurationMs).toEqual({ short: DAY, long: 7 * DAY });
  });

  it('grants the Welcome Package from BALANCE, as a copy', () => {
    const e = itemEffect(ItemId.WELCOME_PACKAGE);
    expect(e).toEqual({ kind: 'grant', items: items.welcomePackage.items, resources: items.welcomePackage.resources });
    if (e?.kind === 'grant') expect(e.items).not.toBe(items.welcomePackage.items);
  });

  it('fills a medal box with medalBoxCount of each of its medal levels', () => {
    const rng = seededRng('medal-box');
    for (const [id, levels] of Object.entries(items.medalBoxes)) {
      const e = itemEffect(id);
      if (e?.kind !== 'box') throw new Error(`${id} is not a box`);
      for (let i = 0; i < 50; i++) {
        const got = e.contents(rng).items!;
        expect(Object.keys(got).sort()).toEqual(levels.map(medalId).sort());
        for (const n of Object.values(got)) expect(n >= items.medalBoxCount.min && n <= items.medalBoxCount.max).toBe(true);
      }
    }
  });
});

describe('item descriptions', () => {
  it('quote the item numbers from BALANCE.items', () => {
    expect(itemInfo(ItemId.CIVIL_CODE)!.description.params).toEqual({ percent: { share: items.civilCode.share }, min: items.civilCode.min });
    expect(itemInfo(ItemId.NAPOLEONS_DIARY)!.description.params).toEqual({ percent: { share: items.batchSpeedupShare } });
    expect(itemInfo(ItemId.FREEDOM_MEDAL)!.description.params).toEqual({ amount: items.medalLoyalty[ItemId.FREEDOM_MEDAL], max: BALANCE.heroMaxLoyalty });
    expect(itemInfo(ItemId.EXCALIBUR)!.description.params).toMatchObject({ percent: { share: items.heroAttributeBuff.bonus } });
    expect(itemInfo(ItemId.JUNIOR_MEDAL_BOX)!.description.params).toMatchObject({ min: items.medalBoxCount.min, max: items.medalBoxCount.max });
    const box = items.heroBoxes[ItemId.HERO_PACKAGE]!;
    expect(itemInfo(ItemId.HERO_PACKAGE)!.description.params).toMatchObject({ level: box.level, minStat: box.minStat });
    expect(itemInfo(ItemId.EPITOME_OF_MILITARY_SCIENCE)!.description.params).toEqual({
      percent: { share: items.experienceBooks[ItemId.EPITOME_OF_MILITARY_SCIENCE]!.share },
      min: items.experienceBooks[ItemId.EPITOME_OF_MILITARY_SCIENCE]!.min,
    });
  });
});

describe(civilCodePopulation.name, () => {
  const { share, min } = items.civilCode;
  it('adds civilCode.share of the maximum population', () => {
    expect(civilCodePopulation(1_000, 10_000)).toBe(1_000 + 10_000 * share);
  });
  it('adds at least civilCode.min people', () => {
    expect(civilCodePopulation(10, 200)).toBe(10 + min);
  });
  it('never goes above the maximum', () => {
    expect(civilCodePopulation(9_900, 10_000)).toBe(10_000);
    expect(civilCodePopulation(10_000, 10_000)).toBe(10_000);
  });
});

describe(loyaltyAfterMedal.name, () => {
  it('adds the loyalty of the medal, up to BALANCE.heroMaxLoyalty', () => {
    expect(loyaltyAfterMedal(10, ItemId.LION_MEDAL)).toBe(10 + items.medalLoyalty[ItemId.LION_MEDAL]!);
    expect(loyaltyAfterMedal(BALANCE.heroMaxLoyalty - 5, ItemId.NATION_MEDAL)).toBe(BALANCE.heroMaxLoyalty);
  });
  it('adds nothing for an item that is not a medal', () => {
    expect(loyaltyAfterMedal(42, ItemId.EXCALIBUR)).toBe(42);
  });
});

describe(heroAttributeBuffEnd.name, () => {
  it('lasts heroAttributeBuff.durationMs from now', () => {
    expect(heroAttributeBuffEnd(1_000)).toBe(1_000 + items.heroAttributeBuff.durationMs);
  });
  it('adds its time to a boost still running', () => {
    expect(heroAttributeBuffEnd(1_000, 5 * HOUR)).toBe(5 * HOUR + items.heroAttributeBuff.durationMs);
  });
});

describe(createBoxHero.name, () => {
  it('is a hero of the box level with full loyalty and its level in unspent points', () => {
    const rng = seededRng('box-hero');
    const q = items.heroBoxes[ItemId.HERO_PACKAGE]!;
    for (let i = 0; i < 100; i++) {
      const h = createBoxHero(ItemId.HERO_PACKAGE, rng);
      expect(h).toMatchObject({ level: q.level, upgradeExp: upgradeExpFor(q.level), remainPoint: q.level, loyalty: BALANCE.heroMaxLoyalty, experience: 0 });
      for (const base of [h.basePower, h.baseManagement, h.baseStratagem]) expect(base).toBeGreaterThanOrEqual(q.minStat);
      expect([h.power, h.management, h.stratagem]).toEqual([h.basePower, h.baseManagement, h.baseStratagem]);
    }
  });
  it('raises each low base attribute to minStat + 0 … heroBoxStatSpread', () => {
    const rng = seededRng('box-spread');
    const q = items.heroBoxes[ItemId.HERO_PACKAGE]!;
    const seen = new Set<number>();
    for (let i = 0; i < 2_000; i++) {
      const h = createBoxHero(ItemId.HERO_PACKAGE, rng);
      for (const base of [h.basePower, h.baseManagement, h.baseStratagem]) if (base <= q.minStat + items.heroBoxStatSpread) seen.add(base - q.minStat);
    }
    expect([...seen].sort((a, b) => a - b)).toEqual(Array.from({ length: items.heroBoxStatSpread + 1 }, (_, i) => i));
  });
  it('uses the fallback for a box that is not listed', () => {
    expect(createBoxHero('unknown.box', seededRng('x')).level).toBe(items.heroBoxFallback.level);
  });
});

describe(speedUpTrainBatch.name, () => {
  const share = items.batchSpeedupShare;
  const batch = (b: Partial<TrainBatch>): TrainBatch => ({ queueId: 1, troopId: 7, count: 100, startTime: 0, endTime: 0, costTime: 10 * HOUR, ...b });

  it('cuts batchSpeedupShare of the head batch full time, moving its start back', () => {
    const head = batch({ startTime: 1_000, endTime: 1_000 + 10 * HOUR });
    expect(speedUpTrainBatch(head, true, 2_000)).toEqual({ ...head, startTime: 1_000 - 10 * HOUR * share, endTime: 1_000 + 10 * HOUR * (1 - share) });
  });

  it('never ends the head batch before now', () => {
    const head = batch({ startTime: 0, endTime: 10 * HOUR });
    const now = 9.5 * HOUR;
    const out = speedUpTrainBatch(head, true, now);
    expect(out.endTime).toBe(now);
    expect(out.endTime - out.startTime).toBe(10 * HOUR);
  });

  it('shortens a waiting batch by batchSpeedupShare of its full time, down to 0', () => {
    expect(speedUpTrainBatch(batch({}), false, 0)).toMatchObject({ fullTime: 10 * HOUR, costTime: 10 * HOUR * (1 - share) });
    expect(speedUpTrainBatch(batch({ costTime: 2 * HOUR, fullTime: 10 * HOUR }), false, 0)).toMatchObject({ fullTime: 10 * HOUR, costTime: 0 });
  });

  it('finishes any batch with four uses', () => {
    let b = batch({});
    for (let i = 0; i < 4; i++) b = speedUpTrainBatch(b, false, 0);
    expect(b.costTime).toBe(0);
  });
});

describe('ItemId', () => {
  it('names every item exactly once', () => {
    expect([...ITEM_IDS].sort()).toEqual(ITEMS.map((i) => i.id).sort());
    expect(new Set(ITEM_IDS).size).toBe(ITEM_IDS.length);
  });
  it('names no removed item', () => {
    for (const id of ITEM_IDS) expect(isRemovedItem(id), id).toBe(false);
  });
});

describe('SpeedupId', () => {
  it('the half-time speed-up is in BALANCE.items.speedups but is not an item', () => {
    expect(items.speedups[SpeedupId.HALF_TIME]).toBeDefined();
    expect(ITEMS.some((i) => i.id === SpeedupId.HALF_TIME)).toBe(false);
  });
});
