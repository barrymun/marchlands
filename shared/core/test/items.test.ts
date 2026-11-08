import { afterEach, describe, expect, it } from 'vitest';
import { ItemEffectKind } from '#/constants.ts';
import {
  BALANCE,
  createBoxHero,
  DAY,
  experienceItemGain,
  goldForCents,
  heroAttributeBuffEnd,
  heroBoxQuality,
  heroBuffAmount,
  heroItemGoldPrice,
  HOUR,
  isRemovedItem,
  ITEM_IDS,
  itemEffect,
  itemGoldPrice,
  ItemId,
  itemInfo,
  ITEMS,
  loyaltyAfterMedal,
  magdeburgRightsPopulation,
  medalId,
  MINUTE,
  seededRng,
  setGameSpeed,
  SPEEDUP_ITEMS,
  speedupCut,
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
    expect(SPEEDUP_ITEMS[ItemId.NOVICES_NOTES]!.reduce(10 * HOUR, rng(0.5))).toBe(15 * MINUTE);
    expect(SPEEDUP_ITEMS[ItemId.JOURNEYMANS_NOTES]!.reduce(0, rng(0.5))).toBe(2.5 * HOUR);
  });

  it('cuts a random whole number of hours in the cutHours range', () => {
    const [min, max] = items.speedups[ItemId.GRANDMASTERS_NOTES]!.cutHours!;
    const reduce = SPEEDUP_ITEMS[ItemId.GRANDMASTERS_NOTES]!.reduce;
    expect(reduce(0, rng(0))).toBe(min * HOUR);
    expect(reduce(0, rng(0.999_999))).toBe(max * HOUR);
    const r = seededRng('speedup');
    for (let i = 0; i < 200; i++) {
      const hours = reduce(0, () => r.next()) / HOUR;
      expect(Number.isInteger(hours) && hours >= min && hours <= max).toBe(true);
    }
  });

  it('cuts a share of the total time', () => {
    expect(SPEEDUP_ITEMS[ItemId.VILLARDS_SKETCHBOOK]!.reduce(10 * HOUR, rng(0))).toBe(10 * HOUR * items.speedups[ItemId.VILLARDS_SKETCHBOOK]!.cutShare!);
    expect(SPEEDUP_ITEMS[SpeedupId.HALF_TIME]!.reduce(4 * HOUR, rng(0))).toBe(2 * HOUR);
  });

  it('costs its gold price when the player has none', () => {
    for (const [id, s] of Object.entries(items.speedups)) expect(speedupItemGold(id), id).toBe(itemGoldPrice(id) ?? goldForCents(s.cents));
  });
});

describe(speedupCut.name, () => {
  afterEach(() => setGameSpeed(1));

  it('takes a share of a job as it is, and a fixed cut scaled by the game speed', () => {
    setGameSpeed(60);
    // a job of 10 real minutes (10 game hours at speed 60)
    const total = 10 * MINUTE;
    expect(speedupCut(SPEEDUP_ITEMS[ItemId.VILLARDS_SKETCHBOOK]!, total, () => 0)).toBe(total * items.speedups[ItemId.VILLARDS_SKETCHBOOK]!.cutShare!);
    expect(speedupCut(SPEEDUP_ITEMS[ItemId.JOURNEYMANS_NOTES]!, total, () => 0)).toBe((2.5 * HOUR) / 60);
  });
});

describe(experienceItemGain.name, () => {
  it('gives a share of the next level, at least the book minimum', () => {
    for (const [id, book] of Object.entries(items.experienceBooks)) {
      expect(experienceItemGain(id, 0), id).toBe(book.min);
      expect(experienceItemGain(id, 10_000_000), id).toBe(Math.floor(10_000_000 * book.share));
    }
    expect(experienceItemGain(ItemId.EPITOME_OF_MILITARY_SCIENCE, 100_000)).toBe(30_000);
    expect(experienceItemGain(ItemId.NIBELUNGENLIED, 250_000)).toBe(250_000);
  });

  it('is 0 for an item that is not an experience book', () => {
    expect(experienceItemGain(ItemId.CROSS_MEDAL, 100_000)).toBe(0);
  });
});

describe(heroBoxQuality.name, () => {
  it('reads a listed hero box, and the fallback for any other', () => {
    expect(heroBoxQuality(ItemId.OATH_OF_FEALTY)).toEqual(items.heroBoxes[ItemId.OATH_OF_FEALTY]);
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
    expect(itemEffect(ItemId.PLOUGHSHARE)).toMatchObject({ kind: ItemEffectKind.BUFF, durationMs: items.buffDurationMs.short });
    expect(itemEffect(ItemId.HEAVY_PLOUGH)).toMatchObject({ kind: ItemEffectKind.BUFF, durationMs: items.buffDurationMs.long });
    expect(items.buffDurationMs).toEqual({ short: DAY, long: 7 * DAY });
  });

  it("grants the Founder's Gift from BALANCE, as a copy", () => {
    const e = itemEffect(ItemId.FOUNDERS_GIFT);
    expect(e).toEqual({ kind: ItemEffectKind.GRANT, items: items.foundersGift.items, resources: items.foundersGift.resources });
    if (e?.kind === ItemEffectKind.GRANT) expect(e.items).not.toBe(items.foundersGift.items);
  });

  it('fills a medal box with medalBoxCount of each of its medal levels', () => {
    const rng = seededRng('medal-box');
    for (const [id, levels] of Object.entries(items.medalBoxes)) {
      const e = itemEffect(id);
      if (e?.kind !== ItemEffectKind.BOX) throw new Error(`${id} is not a box`);
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
    expect(itemInfo(ItemId.MAGDEBURG_RIGHTS)!.description.params).toEqual({ percent: { share: items.civilCode.share }, min: items.civilCode.min });
    expect(itemInfo(ItemId.OTTOS_MUSTER_ROLL)!.description.params).toEqual({ percent: { share: items.batchSpeedupShare } });
    expect(itemInfo(ItemId.FIDELITY_MEDAL)!.description.params).toEqual({ amount: items.medalLoyalty[ItemId.FIDELITY_MEDAL], max: BALANCE.heroMaxLoyalty });
    expect(itemInfo(ItemId.JOYEUSE)!.description.params).toMatchObject({ percent: { share: items.heroAttributeBuff.bonus } });
    expect(itemInfo(ItemId.BRONZE_COFFER)!.description.params).toMatchObject({ min: items.medalBoxCount.min, max: items.medalBoxCount.max });
    const box = items.heroBoxes[ItemId.OATH_OF_FEALTY]!;
    expect(itemInfo(ItemId.OATH_OF_FEALTY)!.description.params).toMatchObject({ level: box.level, minStat: box.minStat });
    expect(itemInfo(ItemId.EPITOME_OF_MILITARY_SCIENCE)!.description.params).toEqual({
      percent: { share: items.experienceBooks[ItemId.EPITOME_OF_MILITARY_SCIENCE]!.share },
      min: items.experienceBooks[ItemId.EPITOME_OF_MILITARY_SCIENCE]!.min,
    });
  });
});

describe(magdeburgRightsPopulation.name, () => {
  const { share, min } = items.civilCode;
  it('adds civilCode.share of the maximum population', () => {
    expect(magdeburgRightsPopulation(1_000, 10_000)).toBe(1_000 + 10_000 * share);
  });
  it('adds at least civilCode.min people', () => {
    expect(magdeburgRightsPopulation(10, 200)).toBe(10 + min);
  });
  it('never goes above the maximum', () => {
    expect(magdeburgRightsPopulation(9_900, 10_000)).toBe(10_000);
    expect(magdeburgRightsPopulation(10_000, 10_000)).toBe(10_000);
  });
});

describe(loyaltyAfterMedal.name, () => {
  it('adds the loyalty of the medal, up to BALANCE.heroMaxLoyalty', () => {
    expect(loyaltyAfterMedal(10, ItemId.LION_MEDAL)).toBe(10 + items.medalLoyalty[ItemId.LION_MEDAL]!);
    expect(loyaltyAfterMedal(BALANCE.heroMaxLoyalty - 5, ItemId.CROWN_MEDAL)).toBe(BALANCE.heroMaxLoyalty);
  });
  it('adds nothing for an item that is not a medal', () => {
    expect(loyaltyAfterMedal(42, ItemId.JOYEUSE)).toBe(42);
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
    const q = items.heroBoxes[ItemId.OATH_OF_FEALTY]!;
    for (let i = 0; i < 100; i++) {
      const h = createBoxHero(ItemId.OATH_OF_FEALTY, rng, { state: 0 });
      expect(h).toMatchObject({ level: q.level, upgradeExp: upgradeExpFor(q.level), remainPoint: q.level, loyalty: BALANCE.heroMaxLoyalty, experience: 0 });
      for (const base of [h.basePower, h.baseManagement, h.baseStratagem]) expect(base).toBeGreaterThanOrEqual(q.minStat);
      expect([h.power, h.management, h.stratagem]).toEqual([h.basePower, h.baseManagement, h.baseStratagem]);
    }
  });
  it('raises each low base attribute to minStat + 0 … heroBoxStatSpread', () => {
    const rng = seededRng('box-spread');
    const q = items.heroBoxes[ItemId.OATH_OF_FEALTY]!;
    const seen = new Set<number>();
    for (let i = 0; i < 2_000; i++) {
      const h = createBoxHero(ItemId.OATH_OF_FEALTY, rng, { state: 0 });
      for (const base of [h.basePower, h.baseManagement, h.baseStratagem]) if (base <= q.minStat + items.heroBoxStatSpread) seen.add(base - q.minStat);
    }
    expect([...seen].sort((a, b) => a - b)).toEqual(Array.from({ length: items.heroBoxStatSpread + 1 }, (_, i) => i));
  });
  it('uses the fallback for a box that is not listed', () => {
    expect(createBoxHero('unknown.box', seededRng('x'), { state: 0 }).level).toBe(items.heroBoxFallback.level);
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

describe(itemGoldPrice.name, () => {
  it('takes a set price over the cents price', () => {
    expect(itemGoldPrice(ItemId.BERNWARDS_HAMMER)).toBe(BALANCE.goldShop[ItemId.BERNWARDS_HAMMER]);
    expect(itemGoldPrice(ItemId.BERNWARDS_HAMMER)).not.toBe(goldForCents(5));
  });

  it("prices an item with no set price at its cents' worth of gold", () => {
    expect(itemGoldPrice(ItemId.WAR_HORN)).toBe(goldForCents(10));
  });

  it("sells neither medals nor the Founder's Gift", () => {
    expect(itemGoldPrice(ItemId.CROSS_MEDAL)).toBeNull();
    expect(itemGoldPrice(ItemId.FOUNDERS_GIFT)).toBeNull();
  });

  it('sells nothing in BALANCE.notInShop, though the original did', () => {
    for (const id of BALANCE.notInShop) {
      expect(itemGoldPrice(id), id).toBeNull();
      expect(ITEMS.find((i) => i.id === id)?.buyable, id).toBe(true);
    }
  });

  it('still prices those speed-ups and experience books at the moment of use', () => {
    expect(speedupItemGold(ItemId.NOVICES_NOTES)).toBe(goldForCents(items.speedups[ItemId.NOVICES_NOTES]!.cents));
    expect(heroItemGoldPrice(ItemId.NIBELUNGENLIED, 0)).toBe(items.experienceBooks[ItemId.NIBELUNGENLIED]!.min * BALANCE.heroItemGold.perExp);
  });
});

describe('SpeedupId', () => {
  it('the half-time speed-up is in BALANCE.items.speedups but is not an item', () => {
    expect(items.speedups[SpeedupId.HALF_TIME]).toBeDefined();
    expect(ITEMS.some((i) => i.id === SpeedupId.HALF_TIME)).toBe(false);
  });
});
