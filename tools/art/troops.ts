// Troops: one 32×32 sprite per troop type (client/web/src/lib/game-art.ts, unitArtFile), drawn facing right and lit
// from the top left like the buildings. Foot soldiers share one figure, dressed and armed per type; the mounted troops
// share a horse; the transporter and the siege engines are wooden machines on wheels. Thin things (shafts, blades,
// bowstrings) are drawn after outline() so they stay one pixel wide.

import { TroopType } from '@marchlands/core';
import { type Colour, PixelCanvas } from './pixel.ts';
import { disc, oval, rect, wheel } from './shapes.ts';

const SIZE = 32;

/** Body colours: the garment's lit, mid and shaded tones. */
type Cloth = { hi: Colour; mid: Colour; dark: Colour };

/** A rider's helm: open, the face showing, or closed. */
const HelmKind = { OPEN: 'open', CLOSED: 'closed' } as const;
type HelmKind = (typeof HelmKind)[keyof typeof HelmKind];

const LINEN: Cloth = { hi: 'linen', mid: 'linen', dark: 'linenDark' };
const LEATHER: Cloth = { hi: 'leather', mid: 'leather', dark: 'leatherDark' };
const PLATE: Cloth = { hi: 'steelHi', mid: 'steel', dark: 'steelDark' };
const DARK: Cloth = { hi: 'hood', mid: 'hood', dark: 'hoodDark' };

/** The legs and boots of a foot soldier standing with feet at y = 28. */
function legs(c: PixelCanvas, trousers: Colour, boots: Colour) {
  rect(c, 13, 18, 15, 25, trousers);
  rect(c, 16, 18, 18, 25, trousers);
  c.line([15, 19], [15, 25], 'outline');
  rect(c, 13, 25, 15, 28, boots);
  rect(c, 16, 25, 19, 28, boots);
}

/** The torso, shoulders to belt, and the arm behind it. */
function torso(c: PixelCanvas, cloth: Cloth, belt: Colour = 'leatherDark') {
  rect(c, 10, 10, 11, 16, cloth.dark);
  rect(c, 10, 17, 11, 18, 'skinShade');
  rect(c, 12, 9, 19, 18, cloth.mid);
  rect(c, 12, 9, 13, 17, cloth.hi);
  rect(c, 18, 10, 19, 18, cloth.dark);
  rect(c, 12, 17, 19, 17, belt);
}

/** A bare head facing right, with hair at the back. */
function head(c: PixelCanvas, hair: Colour = 'hair') {
  rect(c, 13, 2, 18, 8, 'skin');
  rect(c, 13, 2, 15, 5, hair);
  rect(c, 13, 2, 18, 3, hair);
  c.set(14, 7, 'skinShade');
  c.set(17, 5, 'outline');
}

/** The arm in front, from the shoulder down to a hand at (hx, hy). */
function frontArm(c: PixelCanvas, cloth: Cloth, hx: number, hy: number) {
  c.poly(
    [
      [18, 10],
      [21, 10],
      [hx + 1, hy - 1],
      [hx - 1, hy - 1],
    ],
    cloth.mid,
  );
  rect(c, hx - 1, hy - 1, hx + 1, hy + 1, 'skin');
}

/** Worker: a farmhand in a linen smock and a broad hat, a shovel at their side. */
function worker(): PixelCanvas {
  const c = new PixelCanvas(SIZE, 'worker');
  legs(c, 'leather', 'leatherDark');
  torso(c, LINEN, 'leather');
  head(c);
  rect(c, 11, 3, 20, 4, 'thatchL');
  rect(c, 13, 0, 18, 3, 'thatchHi');
  rect(c, 16, 0, 18, 2, 'thatchL');
  rect(c, 13, 3, 18, 3, 'thatchEdge');
  frontArm(c, LINEN, 22, 16);
  rect(c, 22, 23, 25, 28, 'steel');
  rect(c, 24, 23, 25, 28, 'steelDark');
  c.outline();
  c.line([23, 4], [23, 22], 'wood');
  c.line([22, 4], [24, 4], 'logDark');
  rect(c, 21, 15, 22, 16, 'skin');
  return c;
}

/** Warrior: a militiaman in a dark hood and leather jerkin, with a pitchfork. */
function warrior(): PixelCanvas {
  const c = new PixelCanvas(SIZE, 'warrior');
  legs(c, 'hoodDark', 'leatherDark');
  torso(c, LEATHER);
  rect(c, 12, 1, 19, 10, 'hood');
  rect(c, 17, 1, 19, 10, 'hoodDark');
  rect(c, 15, 4, 18, 8, 'skinShade');
  rect(c, 16, 5, 18, 8, 'skin');
  c.set(17, 5, 'outline');
  frontArm(c, LEATHER, 22, 15);
  c.outline();
  c.line([23, 4], [23, 28], 'wood');
  c.line([21, 4], [25, 4], 'steelDark');
  for (const x of [21, 23, 25]) c.line([x, 0], [x, 3], 'steel');
  rect(c, 21, 14, 22, 15, 'skin');
  return c;
}

/** Scout: a light rider on foot in a red hooded cloak and dark leathers, with a curved blade. */
function scout(): PixelCanvas {
  const c = new PixelCanvas(SIZE, 'scout');
  c.poly(
    [
      [11, 8],
      [14, 8],
      [13, 26],
      [7, 26],
    ],
    'bannerDark',
  );
  legs(c, 'hoodDark', 'leatherDark');
  torso(c, DARK, 'leather');
  rect(c, 12, 1, 19, 9, 'banner');
  rect(c, 12, 1, 14, 9, 'bannerHi');
  rect(c, 18, 2, 19, 9, 'bannerDark');
  rect(c, 15, 4, 18, 8, 'skinShade');
  rect(c, 16, 5, 18, 8, 'skin');
  c.set(17, 5, 'outline');
  rect(c, 12, 9, 19, 10, 'banner');
  frontArm(c, DARK, 22, 15);
  c.outline();
  for (const [x, y] of [
    [23, 13],
    [24, 12],
    [25, 11],
    [26, 9],
    [27, 8],
    [27, 7],
    [28, 5],
  ])
    c.set(x, y, 'steelHi');
  for (const [x, y] of [
    [24, 13],
    [25, 12],
    [26, 11],
    [27, 10],
    [27, 9],
    [28, 8],
    [28, 7],
  ])
    c.set(x, y, 'steel');
  c.line([20, 14], [23, 16], 'gold');
  rect(c, 21, 14, 22, 15, 'skin');
  return c;
}

/** Pikeman: a soldier in a steel kettle helm and breastplate, holding a long pike upright. */
function pikeman(): PixelCanvas {
  const c = new PixelCanvas(SIZE, 'pikeman');
  legs(c, 'blueDark', 'leatherDark');
  torso(c, PLATE);
  rect(c, 12, 15, 19, 18, 'blue');
  rect(c, 12, 17, 19, 17, 'leatherDark');
  head(c);
  rect(c, 11, 3, 20, 4, 'steel');
  rect(c, 13, 0, 18, 3, 'steel');
  rect(c, 13, 0, 15, 2, 'steelHi');
  rect(c, 11, 4, 20, 4, 'steelDark');
  frontArm(c, PLATE, 22, 15);
  c.outline();
  c.line([23, 5], [23, 29], 'wood');
  c.line([23, 0], [23, 4], 'steelHi');
  c.line([22, 3], [22, 4], 'steel');
  c.line([24, 3], [24, 4], 'steelDark');
  rect(c, 21, 14, 22, 15, 'skin');
  return c;
}

/** Swordsman: a knight in a great helm and plate behind a white shield with a red cross, sword raised. */
function swordsman(): PixelCanvas {
  const c = new PixelCanvas(SIZE, 'swordsman');
  legs(c, 'steelDark', 'hoodDark');
  torso(c, PLATE);
  rect(c, 13, 1, 18, 8, 'steel');
  rect(c, 13, 1, 14, 8, 'steelHi');
  rect(c, 17, 1, 18, 8, 'steelDark');
  rect(c, 15, 4, 18, 4, 'outline');
  rect(c, 16, 6, 16, 7, 'outline');
  c.poly(
    [
      [16, 9],
      [25, 9],
      [25, 18],
      [20.5, 25],
      [16, 18],
    ],
    'wool',
  );
  c.poly(
    [
      [21, 9],
      [25, 9],
      [25, 18],
      [20.5, 25],
    ],
    'linen',
  );
  rect(c, 20, 10, 21, 22, 'banner');
  rect(c, 17, 13, 24, 14, 'banner');
  c.outline();
  c.line([9, 0], [9, 10], 'steelHi');
  c.line([10, 1], [10, 10], 'steel');
  c.line([7, 11], [12, 11], 'gold');
  c.line([9, 12], [9, 13], 'leatherDark');
  rect(c, 9, 14, 10, 15, 'skin');
  return c;
}

/** Archer: a bowman in a conical helm and mail, a quiver on their back and an arrow drawn. */
function archer(): PixelCanvas {
  const c = new PixelCanvas(SIZE, 'archer');
  rect(c, 8, 9, 10, 19, 'leather');
  rect(c, 10, 9, 10, 19, 'leatherDark');
  legs(c, 'leatherDark', 'hoodDark');
  torso(c, { hi: 'steel', mid: 'steel', dark: 'steelDark' }, 'leather');
  for (let y = 10; y <= 16; y += 2) for (let x = 13; x <= 18; x += 2) c.set(x + ((y / 2) % 2), y, 'steelDark');
  rect(c, 12, 15, 19, 18, 'greenL');
  rect(c, 12, 17, 19, 17, 'leather');
  head(c);
  c.poly(
    [
      [12, 4],
      [15.5, -1],
      [20, 4],
    ],
    'steel',
  );
  rect(c, 12, 4, 19, 4, 'steelDark');
  rect(c, 19, 10, 25, 12, 'steel');
  rect(c, 24, 10, 26, 12, 'skin');
  c.outline();
  for (const x of [7, 9, 11]) c.line([x, 6], [x, 8], x === 9 ? 'wool' : 'banner');
  c.line([26, 3], [28, 7], 'wood');
  c.line([28, 7], [28, 15], 'wood');
  c.line([28, 15], [26, 19], 'wood');
  c.line([26, 3], [20, 11], 'wool');
  c.line([20, 11], [26, 19], 'wool');
  c.line([20, 11], [29, 11], 'logDark');
  c.set(30, 11, 'steelHi');
  c.set(19, 11, 'banner');
  rect(c, 19, 10, 20, 12, 'skin');
  return c;
}

/**
 * A bay horse facing right, hooves at y = 29. An `armoured` horse wears a steel chanfron on its head and a red
 * caparison over its neck and body.
 */
function horse(c: PixelCanvas, armoured: boolean) {
  const shade = (_x: number, y: number): Colour => (y < 15 ? 'horseHi' : y > 19 ? 'horseDark' : 'horse');
  // the tail and the legs on the far side
  c.poly(
    [
      [5, 14],
      [8, 15],
      [6, 25],
      [2, 24],
    ],
    'hair',
  );
  rect(c, 9, 20, 11, 28, 'horseDark');
  rect(c, 18, 20, 20, 28, 'horseDark');
  // the body, neck and head
  oval(c, 14, 17, 9.5, 4.5, shade);
  c.poly(
    [
      [18, 16],
      [21, 10],
      [25, 9],
      [25, 18],
    ],
    armoured ? 'banner' : 'horse',
  );
  c.poly(
    [
      [22, 8],
      [26, 8],
      [30, 12],
      [30, 15],
      [27, 15],
      [23, 12],
    ],
    armoured ? 'steel' : 'horse',
  );
  c.poly(
    [
      [27, 12],
      [30, 12],
      [30, 15],
      [27, 15],
    ],
    armoured ? 'steelDark' : 'horseDark',
  );
  rect(c, 22, 6, 23, 8, armoured ? 'steelDark' : 'horseDark');
  c.line([21, 8], [17, 14], armoured ? 'gold' : 'hair');
  c.line([22, 9], [18, 14], armoured ? 'bannerDark' : 'hair');
  c.set(25, 10, 'outline');
  // the legs on the near side
  rect(c, 5, 17, 9, 22, 'horse');
  rect(c, 6, 22, 8, 29, 'horse');
  rect(c, 21, 18, 24, 21, 'horse');
  rect(c, 21, 21, 23, 29, 'horse');
  if (armoured) {
    c.poly(
      [
        [5, 13],
        [22, 13],
        [24, 24],
        [4, 24],
      ],
      'banner',
    );
    rect(c, 4, 13, 23, 14, 'bannerHi');
    for (const x of [9, 14, 19]) c.line([x, 16], [x, 23], 'bannerDark');
    rect(c, 4, 23, 24, 24, 'gold');
  }
}

/** A rider seated on the horse, the near leg down its side; `helm` is open (the face shows) or closed. */
function rider(c: PixelCanvas, cloth: Cloth, leg: Colour, helm: HelmKind) {
  rect(c, 14, 13, 18, 16, leg);
  rect(c, 16, 16, 18, 20, leg);
  rect(c, 16, 19, 19, 21, 'leatherDark');
  rect(c, 12, 7, 17, 15, cloth.mid);
  rect(c, 12, 7, 13, 15, cloth.hi);
  rect(c, 16, 8, 17, 15, cloth.dark);
  rect(c, 12, 14, 17, 14, 'leatherDark');
  rect(c, 13, 1, 17, 7, 'skin');
  if (helm === HelmKind.OPEN) {
    rect(c, 13, 1, 17, 3, 'steel');
    rect(c, 13, 1, 14, 6, 'steel');
    rect(c, 13, 1, 15, 2, 'steelHi');
    c.set(16, 4, 'outline');
  } else {
    rect(c, 13, 1, 17, 7, 'steel');
    rect(c, 13, 1, 14, 7, 'steelHi');
    rect(c, 15, 4, 17, 4, 'outline');
  }
}

/** Cavalry: a rider in mail and a red cloak on a bay horse, sword held high. */
function cavalry(): PixelCanvas {
  const c = new PixelCanvas(SIZE, 'cavalry');
  horse(c, false);
  rect(c, 8, 13, 15, 16, 'blue');
  rect(c, 8, 16, 15, 16, 'blueDark');
  c.poly(
    [
      [11, 7],
      [13, 7],
      [10, 17],
      [5, 16],
    ],
    'banner',
  );
  rider(c, { hi: 'steel', mid: 'steel', dark: 'steelDark' }, 'hoodDark', HelmKind.OPEN);
  for (let y = 9; y <= 13; y += 2) for (const x of [14, 16]) c.set(x + ((y - 9) % 4 ? 1 : 0), y, 'steelDark');
  rect(c, 11, 7, 12, 11, 'bannerHi');
  rect(c, 17, 8, 20, 10, 'steel');
  c.outline();
  c.line([22, 6], [27, 1], 'steelHi');
  c.line([22, 7], [28, 1], 'steel');
  c.line([20, 5], [23, 8], 'gold');
  rect(c, 20, 7, 21, 8, 'skin');
  return c;
}

/** Cataphract: a rider in full plate on an armoured horse, a lance upright with a pennant. */
function cataphract(): PixelCanvas {
  const c = new PixelCanvas(SIZE, 'cataphract');
  horse(c, true);
  rider(c, PLATE, 'steelDark', HelmKind.CLOSED);
  rect(c, 17, 9, 20, 11, 'steel');
  c.outline();
  c.line([21, 0], [21, 20], 'wood');
  c.line([21, 0], [21, 1], 'steelHi');
  rect(c, 22, 1, 25, 2, 'banner');
  c.set(26, 1, 'banner');
  rect(c, 22, 3, 23, 3, 'bannerDark');
  rect(c, 20, 9, 21, 10, 'steelHi');
  return c;
}

/** Transporter: a covered wagon with a canvas hood over its load. */
function transporter(): PixelCanvas {
  const c = new PixelCanvas(SIZE, 'transporter');
  c.line([24, 21], [30, 23], 'logDark');
  c.poly(
    [
      [3, 8],
      [7, 4],
      [22, 4],
      [26, 8],
      [26, 17],
      [3, 17],
    ],
    'wallL',
  );
  rect(c, 5, 5, 23, 7, 'wallTop');
  rect(c, 22, 6, 26, 17, 'wallR');
  for (const x of [9, 15, 21]) c.line([x, 5], [x, 16], 'linenDark');
  rect(c, 2, 16, 27, 21, 'plankL');
  rect(c, 2, 16, 27, 16, 'plankTop');
  rect(c, 23, 17, 27, 21, 'plankR');
  for (const x of [8, 14, 20]) c.line([x, 17], [x, 21], 'plankR');
  wheel(c, 8, 23, 5);
  wheel(c, 21, 23, 5);
  c.outline();
  return c;
}

/** Ballista: a giant crossbow on a wheeled timber carriage, its bolt laid ready. */
function ballista(): PixelCanvas {
  const c = new PixelCanvas(SIZE, 'ballista');
  rect(c, 4, 19, 26, 22, 'plankL');
  rect(c, 4, 19, 26, 19, 'plankTop');
  rect(c, 13, 12, 16, 19, 'plankR');
  c.poly(
    [
      [3, 12],
      [26, 8],
      [26, 11],
      [3, 15],
    ],
    'plankL',
  );
  c.line([3, 12], [26, 8], 'plankTop');
  c.poly(
    [
      [22, 9],
      [25, 8],
      [22, 0],
      [19, 1],
    ],
    'wood',
  );
  c.poly(
    [
      [22, 11],
      [25, 11],
      [22, 18],
      [19, 17],
    ],
    'wood',
  );
  rect(c, 22, 7, 25, 12, 'steelDark');
  rect(c, 22, 7, 25, 7, 'steel');
  wheel(c, 8, 24, 5);
  wheel(c, 22, 24, 5);
  c.outline();
  c.line([20, 1], [8, 11], 'linenDark');
  c.line([20, 17], [8, 11], 'linenDark');
  c.line([8, 10], [28, 6.5], 'logDark');
  c.line([28, 6], [30, 6], 'steelHi');
  c.set(9, 9, 'banner');
  return c;
}

/** Battering ram: a hide-roofed shed on wheels, an iron-capped log slung inside it. */
function ram(): PixelCanvas {
  const c = new PixelCanvas(SIZE, 'ram');
  c.poly(
    [
      [2, 17],
      [7, 7],
      [23, 7],
      [27, 17],
    ],
    'leather',
  );
  c.poly(
    [
      [2, 17],
      [7, 7],
      [10, 7],
      [6, 17],
    ],
    'horseHi',
  );
  rect(c, 7, 7, 23, 8, 'leatherDark');
  for (const y of [11, 14]) c.line([3 + Math.round((17 - y) / 2), y], [26 - Math.round((17 - y) / 2.5), y], 'leatherDark');
  rect(c, 5, 17, 24, 19, 'hoodDark');
  rect(c, 5, 17, 6, 20, 'plankR');
  rect(c, 23, 17, 24, 20, 'plankR');
  rect(c, 7, 16, 28, 18, 'log');
  rect(c, 7, 18, 28, 18, 'logDark');
  rect(c, 26, 15, 30, 19, 'steel');
  rect(c, 26, 15, 30, 15, 'steelHi');
  rect(c, 29, 16, 30, 19, 'steelDark');
  rect(c, 3, 20, 26, 21, 'plankL');
  wheel(c, 8, 24, 5);
  wheel(c, 21, 24, 5);
  c.outline();
  return c;
}

/** Catapult: a timber A-frame on wheels, its throwing arm cocked back with a stone in the cup. */
function catapult(): PixelCanvas {
  const c = new PixelCanvas(SIZE, 'catapult');
  c.poly(
    [
      [17, 20],
      [20, 20],
      [22, 8],
      [20, 8],
    ],
    'plankR',
  );
  c.poly(
    [
      [7, 9],
      [9, 7],
      [21, 18],
      [19, 20],
    ],
    'log',
  );
  c.line([9, 7], [21, 18], 'logEnd');
  disc(c, 6, 7, 3.5, 'leatherDark');
  disc(c, 6, 6, 2.5, 'stoneTop', 'stoneR');
  c.poly(
    [
      [24, 20],
      [27, 20],
      [23, 8],
      [21, 8],
    ],
    'plankL',
  );
  rect(c, 18, 6, 25, 9, 'plankL');
  rect(c, 18, 6, 25, 6, 'plankTop');
  rect(c, 18, 9, 25, 9, 'plankR');
  rect(c, 3, 18, 28, 21, 'plankL');
  rect(c, 3, 18, 28, 18, 'plankTop');
  wheel(c, 8, 24, 5);
  wheel(c, 22, 24, 5);
  c.outline();
  c.line([9, 9], [4, 18], 'linenDark');
  return c;
}

/** The troops drawn in code, by troop type. */
export const TROOP_DRAWINGS: Record<number, () => PixelCanvas> = {
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
