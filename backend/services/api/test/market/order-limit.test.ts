import { describe, expect, it } from 'vitest';
import { OrderLimit } from '#/market/order-limit.ts';

const config = { burst: 3, refillMs: 6_000 };

function limit() {
  let now = 1_000_000;
  const l = new OrderLimit(config, () => now);
  return { l, advance: (ms: number) => (now += ms) };
}

describe(OrderLimit.name, () => {
  it('allows a burst, then refuses with the wait until the next action', () => {
    const { l } = limit();
    expect([l.take(1), l.take(1), l.take(1)]).toEqual([0, 0, 0]);
    expect(l.take(1)).toBe(6_000);
  });

  it('refills one action per refillMs, never past the burst', () => {
    const { l, advance } = limit();
    for (let i = 0; i < 3; i++) l.take(1);
    advance(2_000);
    expect(l.take(1)).toBe(4_000);
    advance(4_000);
    expect(l.take(1)).toBe(0);
    expect(l.take(1)).toBe(6_000);
    advance(60 * 60_000);
    expect([l.take(1), l.take(1), l.take(1), l.take(1)]).toEqual([0, 0, 0, 6_000]);
  });

  it('does not count a refused action', () => {
    const { l, advance } = limit();
    for (let i = 0; i < 3; i++) l.take(1);
    for (let i = 0; i < 5; i++) expect(l.take(1)).toBeGreaterThan(0);
    advance(6_000);
    expect(l.take(1)).toBe(0);
  });

  it('counts each account on its own', () => {
    const { l } = limit();
    for (let i = 0; i < 3; i++) l.take(1);
    expect(l.take(1)).toBeGreaterThan(0);
    expect(l.take(2)).toBe(0);
  });
});
