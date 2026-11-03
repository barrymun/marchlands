import { describe, expect, it } from 'vitest';
import { enemyRows } from '@/components/stats-panel/enemies/utils';

describe(enemyRows.name, () => {
  const c = { 'killed.militia': 4_000, 'killed.trap': 75, 'killed.arrowTower': 38, 'killed.archer': 40, 'trained.archer': 9_999, 'killed.dragon': 1 };

  it('lists the enemy types defeated, troops and fortifications, most first', () => {
    expect(enemyRows(c, 10)).toEqual({
      rows: [
        { key: 'militia', count: 4_000 },
        { key: 'trap', count: 75 },
        { key: 'archer', count: 40 },
        { key: 'arrowTower', count: 38 },
      ],
      rest: { types: 0, count: 0 },
    });
  });

  it('adds up the types past the first few', () => {
    expect(enemyRows(c, 2)).toEqual({
      rows: [
        { key: 'militia', count: 4_000 },
        { key: 'trap', count: 75 },
      ],
      rest: { types: 2, count: 78 },
    });
  });

  it('is empty with nothing defeated', () => {
    expect(enemyRows({ 'trained.archer': 5 }, 6)).toEqual({ rows: [], rest: { types: 0, count: 0 } });
  });
});
