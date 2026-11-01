import { afterEach, describe, expect, it } from 'vitest';
import { clockOffset, noteServerTime } from '@/lib/server-clock';

afterEach(() => noteServerTime(0, 0));

describe(noteServerTime.name, () => {
  it('keeps how far the server is ahead of the device, or behind it', () => {
    noteServerTime(10_500, 10_000);
    expect(clockOffset()).toBe(500);
    noteServerTime(9_000, 10_000);
    expect(clockOffset()).toBe(-1000);
  });
});

describe(clockOffset.name, () => {
  it('is 0 while the server has said nothing', () => {
    expect(clockOffset()).toBe(0);
  });
});
