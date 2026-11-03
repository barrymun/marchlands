import { describe, expect, it } from 'vitest';
import { FlowKind } from '@/components/stats-panel/resource-flows/constants';
import { flowScale, resourceFlow } from '@/components/stats-panel/resource-flows/utils';

describe(resourceFlow.name, () => {
  const c = {
    'produced.food': 197,
    'plundered.food': 196,
    'market.bought.food': 62,
    'gained.dailyGift.food': 1,
    'upkeep.food': 313,
    'spent.training.food': 28,
    'spent.building.food': 2,
    'spent.comfort.food': 1,
    'wasted.food': 30,
    'taxed.food': 4,
    'market.sold.food': 12,
    'stolen.food': 3,
    'produced.gold': 3,
    'market.goldReceived': 53,
    'market.goldPaid': 116,
    'salaries.gold': 27,
    'spent.items.gold': 463,
  };

  it('splits a resource into where it came from and where it went, in drawing order', () => {
    expect(resourceFlow(c, 'food')).toEqual({
      resource: 'food',
      gains: [
        { kind: FlowKind.PRODUCED, amount: 197 },
        { kind: FlowKind.PLUNDERED, amount: 196 },
        { kind: FlowKind.MARKET_IN, amount: 62 },
        { kind: FlowKind.GIFT, amount: 1 },
      ],
      losses: [
        { kind: FlowKind.UPKEEP, amount: 313 },
        { kind: FlowKind.SPENT, amount: 31 },
        { kind: FlowKind.WASTED, amount: 30 },
        { kind: FlowKind.TAXED, amount: 4 },
        { kind: FlowKind.MARKET_OUT, amount: 12 },
        { kind: FlowKind.STOLEN, amount: 3 },
      ],
      gained: 456,
      lost: 393,
    });
  });

  it('counts gold from and to the market, and heroes pay as its upkeep', () => {
    const gold = resourceFlow(c, 'gold');
    expect(gold.gains).toEqual([
      { kind: FlowKind.PRODUCED, amount: 3 },
      { kind: FlowKind.MARKET_IN, amount: 53 },
    ]);
    expect(gold.losses).toEqual([
      { kind: FlowKind.UPKEEP, amount: 27 },
      { kind: FlowKind.SPENT, amount: 463 },
      { kind: FlowKind.MARKET_OUT, amount: 116 },
    ]);
  });

  it('has no upkeep for lumber, stone or iron', () => {
    expect(resourceFlow({ 'upkeep.food': 5, 'salaries.gold': 5 }, 'wood')).toEqual({ resource: 'wood', gains: [], losses: [], gained: 0, lost: 0 });
  });

  it('never counts spending refunded past nothing', () => {
    expect(resourceFlow({ 'spent.building.iron': -40, 'spent.training.iron': 10 }, 'iron').losses).toEqual([]);
  });
});

describe(flowScale.name, () => {
  it('is the biggest side of any resource', () => {
    expect(
      flowScale([
        { gained: 456, lost: 393 },
        { gained: 56, lost: 606 },
      ]),
    ).toBe(606);
  });

  it('is 0 with nothing moved', () => {
    expect(flowScale([])).toBe(0);
    expect(flowScale([{ gained: 0, lost: 0 }])).toBe(0);
  });
});
