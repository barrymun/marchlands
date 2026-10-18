import { describe, expect, it } from 'vitest';

import { wallSprites } from '@/components/buildings-panel/iso-city/utils';
import { WALLS } from '@/components/buildings-panel/iso-grid/constants';
import { depthOf } from '@/components/buildings-panel/iso-grid/utils';

describe(wallSprites.name, () => {
  const walls = wallSprites(6, 6, (piece) => `art-${piece}`);

  it('runs a stretch of wall along every outer tile edge, with three towers and the gate', () => {
    expect(walls.filter((w) => w.src === 'art-wall-x')).toHaveLength(12);
    expect(walls.filter((w) => w.src === 'art-wall-y')).toHaveLength(12);
    expect(walls.filter((w) => w.src === 'art-tower')).toHaveLength(3);
    expect(walls.filter((w) => w.src === 'art-gate')).toHaveLength(1);
    expect(new Set(walls.map((w) => w.key)).size).toBe(walls.length);
  });

  it('puts the gate on the front corner, opening the Walls', () => {
    expect(walls.find((w) => w.src === 'art-gate')).toMatchObject({ col: 5.5, row: 5.5, pos: WALLS });
    expect(walls.filter((w) => w.pos != null)).toHaveLength(1);
  });

  it('draws the back walls before every tile inside and the front walls after', () => {
    const inside = [depthOf(0, 0), depthOf(5, 5)];
    for (const w of walls) {
      const isBack = w.row === -0.5 || w.col === -0.5;
      const isFront = w.row === 5.5 || w.col === 5.5;
      if (isBack && !isFront) expect(w.depth).toBeLessThan(Math.min(...inside));
      if (isFront) expect(w.depth).toBeGreaterThan(Math.max(...inside));
    }
  });

  it('draws the gate last', () => {
    expect(Math.max(...walls.map((w) => w.depth))).toBe(walls.find((w) => w.pos === WALLS)!.depth);
  });
});
