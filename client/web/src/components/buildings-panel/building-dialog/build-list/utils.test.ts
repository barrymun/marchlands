import { describe, expect, it } from 'vitest';
import { areaOf } from '@/components/buildings-panel/building-dialog/build-list/utils';

describe(areaOf.name, () => {
  it('treats position -2 as the walls', () => {
    expect(areaOf(-2)).toBe('walls');
  });

  it('treats positions from 1000 up as outside the city', () => {
    expect(areaOf(1000)).toBe('outside');
    expect(areaOf(1001)).toBe('outside');
    expect(areaOf(1040)).toBe('outside');
  });

  it('treats everything else as inside the city', () => {
    expect(areaOf(0)).toBe('inside');
    expect(areaOf(31)).toBe('inside');
    expect(areaOf(999)).toBe('inside');
    expect(areaOf(-1)).toBe('inside');
  });
});
