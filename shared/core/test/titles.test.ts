import { describe, expect, it } from 'vitest';
import { maxValleysFor } from '#/index.ts';

describe(maxValleysFor.name, () => {
  it('is one valley per Town Hall level for a city', () => {
    expect(maxValleysFor(1)).toBe(1);
    expect(maxValleysFor(10)).toBe(10);
    expect(maxValleysFor(10, null)).toBe(10);
  });

  it('is one per its own level for a held historic city, past its Town Hall', () => {
    expect(maxValleysFor(10, 12)).toBe(12);
    expect(maxValleysFor(10, 14)).toBe(14);
    expect(maxValleysFor(10, 18)).toBe(18);
  });
});
