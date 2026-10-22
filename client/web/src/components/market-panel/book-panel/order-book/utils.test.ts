import { describe, expect, it } from 'vitest';
import { bookSide, spreadOf } from '@/components/market-panel/book-panel/order-book/utils';

const merchant = { reference: 1, base: 1, bid: 0.85, ask: 1.15 };
const factions = { price: 1, ask: 1.01, bid: 0.99, sells: 300, buys: 500, sellers: [], buyers: [] };

describe(bookSide.name, () => {
  it('lists sellers highest price first, adding up their depth from the lowest price', () => {
    const rows = bookSide(
      true,
      [
        { price: 1.05, amount: 100 },
        { price: 1.0, amount: 100 },
      ],
      factions,
      merchant,
    );
    expect(rows.map((r) => [r.source, r.price, r.amount])).toEqual([
      ['merchant', 1.15, null],
      ['player', 1.05, 100],
      ['factions', 1.01, 300],
      ['player', 1.0, 100],
    ]);
    // 100 at 1.00, then 300 more at 1.01, then 100 more at 1.05, out of 500
    expect(rows.map((r) => r.depth)).toEqual([0, 1, 0.8, 0.2]);
  });

  it('lists buyers highest price first too, adding up their depth from the highest price', () => {
    const rows = bookSide(false, [{ price: 0.995, amount: 500 }], factions, merchant);
    expect(rows.map((r) => [r.source, r.price, r.depth])).toEqual([
      ['player', 0.995, 0.5],
      ['factions', 0.99, 1],
      ['merchant', 0.85, 0],
    ]);
  });

  it("keeps the player's level on its row", () => {
    const level = { price: 1.2, amount: 7 };
    expect(bookSide(true, [level])[0]?.level).toBe(level);
  });

  it('leaves out the factions past the band (no price) and before they trade', () => {
    expect(bookSide(true, [], { ...factions, ask: null }, merchant).map((r) => r.source)).toEqual(['merchant']);
    expect(bookSide(false, [], null, merchant).map((r) => r.source)).toEqual(['merchant']);
  });

  it('is empty with nobody on the side', () => {
    expect(bookSide(true, [], null, null)).toEqual([]);
  });
});

describe(spreadOf.name, () => {
  it('is the lowest selling price less the highest buying price', () => {
    expect(spreadOf(bookSide(true, [], factions, merchant), bookSide(false, [], factions, merchant))).toBeCloseTo(0.02, 12);
  });

  it('is null with a side empty', () => {
    expect(spreadOf([], bookSide(false, [], factions, merchant))).toBeNull();
  });
});
