import { describe, expect, it } from 'vitest';
import { builtAt, noteBuilt } from '@/lib/build-events';

describe(noteBuilt.name, () => {
  it('remembers when a building finished, by city and position, the latest time winning', () => {
    noteBuilt(7, 3, 1000);
    expect(builtAt(7, 3)).toBe(1000);
    noteBuilt(7, 3, 2500);
    expect(builtAt(7, 3)).toBe(2500);
  });
});

describe(builtAt.name, () => {
  it('knows nothing of a building that has not finished while the page was open', () => {
    noteBuilt(8, 1, 10);
    expect(builtAt(8, 2)).toBeUndefined();
    expect(builtAt(9, 1)).toBeUndefined();
  });
});
