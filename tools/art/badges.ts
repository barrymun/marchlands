// Troop badges: one 24×24 icon per troop type (client/web/src/lib/game-art.ts, troopBadgeFile), for lists of troops
// (the garrison, the send-army dialog). Each is the troop's emblem (its tool or weapon, its horse, its machine) on a
// blue tile bevelled light at the top left. The emblem is drawn on its own canvas and outlined, then stamped onto the
// tile, so its outline never runs into the tile's edge.

import { TroopType } from '@marchlands/core';

import { PixelCanvas, type Pt } from './pixel.ts';
import { oval, rect, wheel } from './shapes.ts';
import { Colour } from '../../client/web/src/lib/palette.ts';

const SIZE = 24;

/** A straight rod from (x0, y0) to (x1, y1), `w` wide. */
function rod(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, w: number, col: Colour) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const [nx, ny] = [(-(y1 - y0) / len) * (w / 2), ((x1 - x0) / len) * (w / 2)];
  const pts: Pt[] = [
    [x0 + nx, y0 + ny],
    [x1 + nx, y1 + ny],
    [x1 - nx, y1 - ny],
    [x0 - nx, y0 - ny],
  ];
  c.poly(pts, col);
}

/** A curved limb two pixels thick, from p0 to p1 bowed towards `ctrl` (a quadratic curve). */
function curve(c: PixelCanvas, p0: Pt, ctrl: Pt, p1: Pt, col: Colour) {
  for (let t = 0; t <= 1; t += 0.02) {
    const x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * ctrl[0] + t * t * p1[0];
    const y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * ctrl[1] + t * t * p1[1];
    rect(c, Math.round(x), Math.round(y), Math.round(x) + 1, Math.round(y) + 1, col);
  }
}

/** The blue tile every badge sits on: rounded corners, a dark rim, lit at the top left and shaded at the bottom right. */
function tile(): PixelCanvas {
  const c = new PixelCanvas(SIZE);
  rect(c, 0, 0, SIZE - 1, SIZE - 1, Colour.BLUE_EDGE);
  rect(c, 1, 1, SIZE - 2, SIZE - 2, Colour.BLUE);
  for (let y = 1; y < SIZE - 1; y++) for (let x = 1; x < SIZE - 1; x++) if (x + y > SIZE + 6) c.set(x, y, Colour.BLUE_DARK);
  c.line([1, 1], [SIZE - 2, 1], Colour.BLUE_HI);
  c.line([1, 1], [1, SIZE - 2], Colour.BLUE_HI);
  for (const [x, y] of [
    [0, 0],
    [SIZE - 1, 0],
    [0, SIZE - 1],
    [SIZE - 1, SIZE - 1],
  ])
    c.set(x, y, Colour.CLEAR);
  return c;
}

/** A badge: the emblem `draw` paints (then outlined) on the blue tile; `after` adds thin details over the outline. */
function badge(seed: string, draw: (c: PixelCanvas) => void, after?: (c: PixelCanvas) => void): () => PixelCanvas {
  return () => {
    const emblem = new PixelCanvas(SIZE, seed);
    draw(emblem);
    emblem.outline();
    after?.(emblem);
    const c = tile();
    for (let i = 0; i < c.px.length; i++) if (emblem.px[i]) c.px[i] = emblem.px[i];
    return c;
  };
}

/** A horse's head and neck in profile, facing right; `armoured` puts a steel chanfron and a red plume on it. */
function horseHead(c: PixelCanvas, armoured: boolean) {
  c.poly(
    [
      [6, 21],
      [14, 21],
      [14, 12],
      [9, 6],
    ],
    Colour.HORSE,
  );
  c.poly(
    [
      [8, 6],
      [13, 4],
      [19, 10],
      [20, 14],
      [17, 15],
      [13, 12],
    ],
    Colour.HORSE,
  );
  c.poly(
    [
      [16, 11],
      [19, 10],
      [20, 14],
      [17, 15],
    ],
    Colour.HORSE_DARK,
  );
  c.poly(
    [
      [9, 6],
      [11, 5],
      [10, 10],
      [12, 21],
      [8, 21],
    ],
    Colour.HORSE_HI,
  );
  rect(c, 10, 2, 11, 5, Colour.HORSE_DARK);
  rod(c, 8, 5, 5, 20, 2.5, Colour.HAIR);
  if (armoured) {
    c.poly(
      [
        [11, 5],
        [14, 4],
        [18, 9],
        [16, 11],
        [12, 9],
      ],
      Colour.STEEL,
    );
    c.line([12, 5], [16, 9], Colour.STEEL_HI);
    rect(c, 6, 15, 14, 21, Colour.BANNER);
    rect(c, 6, 15, 14, 15, Colour.GOLD);
    c.poly(
      [
        [9, 1],
        [12, 0],
        [12, 4],
        [10, 4],
      ],
      Colour.BANNER,
    );
  }
}

const worker = badge(
  'badge-worker',
  (c) => {
    rod(c, 5, 20, 15, 8, 2.5, Colour.WOOD);
    c.poly(
      [
        [9, 6],
        [14, 4],
        [19, 6],
        [22, 11],
        [18, 9],
        [14, 8],
        [10, 9],
      ],
      Colour.STEEL,
    );
    c.line([10, 6], [14, 5], Colour.STEEL_HI);
  },
  (c) => c.line([7, 18], [13, 10], Colour.PLANK_TOP),
);

const warrior = badge(
  'badge-warrior',
  (c) => {
    rod(c, 4, 21, 14, 11, 2.5, Colour.WOOD);
    rod(c, 10, 9, 17, 16, 2.5, Colour.STEEL_DARK);
    for (const [x, y] of [
      [11, 9],
      [13.5, 11.5],
      [16, 14],
    ])
      rod(c, x, y, x + 6, y - 6, 2, Colour.STEEL);
  },
  (c) => c.line([6, 19], [12, 13], Colour.PLANK_TOP),
);

const scout = badge('badge-scout', (c) => {
  c.poly(
    [
      [9, 13],
      [20, 2],
      [21, 3],
      [11, 15],
    ],
    Colour.STEEL,
  );
  c.line([10, 13], [20, 3], Colour.STEEL_HI);
  rod(c, 6, 11, 12, 17, 2.5, Colour.GOLD);
  rod(c, 4, 20, 9, 15, 2.5, Colour.LEATHER_DARK);
  oval(c, 4, 20, 1.5, 1.5, Colour.GOLD);
});

const pikeman = badge(
  'badge-pikeman',
  (c) => {
    rod(c, 3, 21, 16, 8, 2.5, Colour.WOOD);
    c.poly(
      [
        [14, 8],
        [18, 3],
        [22, 2],
        [21, 6],
        [16, 10],
      ],
      Colour.STEEL,
    );
    rod(c, 12, 7, 17, 12, 2, Colour.STEEL_DARK);
  },
  (c) => {
    c.line([16, 7], [20, 3], Colour.STEEL_HI);
    c.line([5, 19], [14, 10], Colour.PLANK_TOP);
  },
);

const swordsman = badge('badge-swordsman', (c) => {
  rod(c, 4, 4, 15, 15, 2.5, Colour.STEEL);
  rod(c, 2, 9, 8, 3, 2, Colour.GOLD);
  c.poly(
    [
      [9, 6],
      [21, 6],
      [21, 14],
      [15, 22],
      [9, 14],
    ],
    Colour.WOOL,
  );
  c.poly(
    [
      [15, 6],
      [21, 6],
      [21, 14],
      [15, 22],
    ],
    Colour.LINEN,
  );
  rect(c, 14, 7, 15, 19, Colour.BANNER);
  rect(c, 10, 10, 20, 11, Colour.BANNER);
});

const archer = badge(
  'badge-archer',
  (c) => {
    for (let t = 0; t <= 1; t += 0.02) {
      const a = (-0.25 + 1.5 * t) * Math.PI * 0.5 - Math.PI * 0.25;
      const x = 7 + Math.cos(a) * 12;
      const y = 12 + Math.sin(a) * 12;
      rect(c, Math.round(x), Math.round(y), Math.round(x) + 1, Math.round(y) + 1, Colour.WOOD);
    }
  },
  (c) => {
    c.line([13, 2], [13, 22], Colour.WOOL);
    c.line([4, 12], [20, 12], Colour.LEATHER_DARK);
    c.line([21, 11], [22, 12], Colour.STEEL_HI);
    c.set(21, 13, Colour.STEEL_HI);
    c.line([4, 11], [5, 11], Colour.BANNER);
    c.line([4, 13], [5, 13], Colour.BANNER);
  },
);

const cavalry = badge(
  'badge-cavalry',
  (c) => horseHead(c, false),
  (c) => c.set(14, 8, Colour.OUTLINE),
);

const cataphract = badge(
  'badge-cataphract',
  (c) => horseHead(c, true),
  (c) => c.set(14, 8, Colour.OUTLINE),
);

const transporter = badge('badge-transporter', (c) => {
  c.poly(
    [
      [2, 9],
      [5, 4],
      [18, 4],
      [21, 9],
      [21, 14],
      [2, 14],
    ],
    Colour.WALL_L,
  );
  rect(c, 4, 5, 18, 7, Colour.WALL_TOP);
  rect(c, 18, 7, 21, 14, Colour.WALL_R);
  for (const x of [8, 13]) c.line([x, 5], [x, 13], Colour.LINEN_DARK);
  rect(c, 1, 13, 22, 16, Colour.PLANK_L);
  rect(c, 1, 13, 22, 13, Colour.PLANK_TOP);
  wheel(c, 6, 18, 4);
  wheel(c, 17, 18, 4);
});

const ballista = badge(
  'badge-ballista',
  (c) => {
    rod(c, 3, 20, 18, 5, 3, Colour.PLANK_L);
    curve(c, [8, 5], [20, 4], [19, 16], Colour.WOOD);
    rect(c, 13, 9, 15, 11, Colour.STEEL_DARK);
  },
  (c) => {
    c.line([9, 5], [9, 13], Colour.LINEN_DARK);
    c.line([18, 15], [9, 13], Colour.LINEN_DARK);
    c.line([6, 17], [21, 2], Colour.LOG_DARK);
    c.line([21, 2], [22, 1], Colour.STEEL_HI);
  },
);

const ram = badge('badge-ram', (c) => {
  c.poly(
    [
      [2, 13],
      [7, 4],
      [16, 4],
      [20, 13],
    ],
    Colour.LEATHER,
  );
  c.poly(
    [
      [2, 13],
      [7, 4],
      [9, 4],
      [5, 13],
    ],
    Colour.HORSE_HI,
  );
  c.line([5, 9], [18, 9], Colour.LEATHER_DARK);
  rect(c, 3, 12, 20, 15, Colour.LOG);
  rect(c, 3, 15, 20, 15, Colour.LOG_DARK);
  rect(c, 19, 11, 22, 16, Colour.STEEL);
  rect(c, 21, 11, 22, 16, Colour.STEEL_DARK);
  wheel(c, 6, 18, 4);
  wheel(c, 16, 18, 4);
});

const catapult = badge(
  'badge-catapult',
  (c) => {
    c.poly(
      [
        [13, 16],
        [15, 16],
        [17, 6],
        [15, 6],
      ],
      Colour.PLANK_R,
    );
    rect(c, 13, 5, 20, 7, Colour.PLANK_L);
    rod(c, 5, 6, 16, 16, 2.5, Colour.LOG);
    oval(c, 4.5, 5, 3, 3, Colour.LEATHER_DARK);
    oval(c, 4.5, 4.5, 2, 2, Colour.STONE_TOP);
    rect(c, 1, 15, 22, 17, Colour.PLANK_L);
    rect(c, 1, 15, 22, 15, Colour.PLANK_TOP);
    wheel(c, 6, 19, 3.5);
    wheel(c, 17, 19, 3.5);
  },
  (c) => c.line([7, 8], [15, 15], Colour.LOG_END),
);

/** The troop badges drawn in code, by troop type. */
export const BADGE_DRAWINGS: Record<number, () => PixelCanvas> = {
  [TroopType.WORKER]: worker,
  [TroopType.WARRIOR]: warrior,
  [TroopType.SCOUT]: scout,
  [TroopType.PIKE]: pikeman,
  [TroopType.SWORDS]: swordsman,
  [TroopType.ARCHER]: archer,
  [TroopType.TRANSPORTER]: transporter,
  [TroopType.CAVALRY]: cavalry,
  [TroopType.CATAPHRACT]: cataphract,
  [TroopType.BALLISTA]: ballista,
  [TroopType.RAM]: ram,
  [TroopType.CATAPULT]: catapult,
};
