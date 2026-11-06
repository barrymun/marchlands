import { describe, expect, it } from 'vitest';
import { ResourceKey } from '@marchlands/core';
import { honorSpent, spendingRows } from '@/components/stats-panel/spending/utils';

describe(spendingRows.name, () => {
  it('lists each thing spent on, in the resources it took, in the order of the spending groups', () => {
    const c = { 'spent.training.food': 28, 'spent.training.wood': 39, 'spent.training.iron': 29, 'spent.building.stone': 54, 'spent.items.gold': 463 };
    expect(spendingRows(c).map(({ group, amounts }) => ({ group, amounts }))).toEqual([
      { group: 'building', amounts: [{ resource: ResourceKey.STONE, amount: 54 }] },
      {
        group: 'training',
        amounts: [
          { resource: ResourceKey.FOOD, amount: 28 },
          { resource: ResourceKey.WOOD, amount: 39 },
          { resource: ResourceKey.IRON, amount: 29 },
        ],
      },
      { group: 'items', amounts: [{ resource: ResourceKey.GOLD, amount: 463 }] },
    ]);
  });

  it('names each group', () => {
    expect(spendingRows({ 'spent.valleys.gold': 760 })[0]?.label).toBe('Valley upgrades');
  });

  it('leaves out what refunds brought back to nothing or below', () => {
    expect(spendingRows({ 'spent.building.wood': 0, 'spent.research.iron': -5 })).toEqual([]);
    expect(spendingRows({})).toEqual([]);
  });
});

describe(honorSpent.name, () => {
  it('is the honour healing cost, never below nothing', () => {
    expect(honorSpent({ 'spent.healing.honor': 355 })).toBe(355);
    expect(honorSpent({ 'spent.healing.honor': -2 })).toBe(0);
    expect(honorSpent({})).toBe(0);
  });
});
