// Troops: one 32×32 sprite per troop type (client/web/src/lib/game-art.ts, unitArtFile), drawn facing right and lit
// from the top left like the buildings. Foot soldiers share one figure, dressed and armed per type; the mounted troops
// share a horse; the transporter and the siege engines are wooden machines on wheels. Thin things (shafts, blades,
// bowstrings) are drawn after outline() so they stay one pixel wide.

import { TroopType } from '@marchlands/core';

import { PixelCanvas } from './pixel.ts';
import { disc, oval, rect, wheel } from './shapes.ts';
import { Colour } from '../../client/web/src/lib/palette.ts';

const SIZE = 32;

/** Body colours: the garment's lit, mid and shaded tones. */
type Cloth = { hi: Colour; mid: Colour; dark: Colour };

/** A rider's helm: open, the face showing, or closed. */
const HelmKind = { OPEN: 'open', CLOSED: 'closed' } as const;
type HelmKind = (typeof HelmKind)[keyof typeof HelmKind];

const LINEN: Cloth = { hi: Colour.LINEN, mid: Colour.LINEN, dark: Colour.LINEN_DARK };
const LEATHER: Cloth = { hi: Colour.LEATHER, mid: Colour.LEATHER, dark: Colour.LEATHER_DARK };
const PLATE: Cloth = { hi: Colour.STEEL_HI, mid: Colour.STEEL, dark: Colour.STEEL_DARK };
const DARK: Cloth = { hi: Colour.HOOD, mid: Colour.HOOD, dark: Colour.HOOD_DARK };

/** The legs and boots of a foot soldier standing with feet at y = 28. */
function legs(c: PixelCanvas, trousers: Colour, boots: Colour) {
  rect(c, 13, 18, 15, 25, trousers);
  rect(c, 16, 18, 18, 25, trousers);
  c.line([15, 19], [15, 25], Colour.OUTLINE);
  rect(c, 13, 25, 15, 28, boots);
  rect(c, 16, 25, 19, 28, boots);
}

/** The torso, shoulders to belt, and the arm behind it. */
function torso(c: PixelCanvas, cloth: Cloth, belt: Colour = Colour.LEATHER_DARK) {
  rect(c, 10, 10, 11, 16, cloth.dark);
  rect(c, 10, 17, 11, 18, Colour.SKIN_SHADE);
  rect(c, 12, 9, 19, 18, cloth.mid);
  rect(c, 12, 9, 13, 17, cloth.hi);
  rect(c, 18, 10, 19, 18, cloth.dark);
  rect(c, 12, 17, 19, 17, belt);
}

/** A bare head facing right, with hair at the back. */
function head(c: PixelCanvas, hair: Colour = Colour.HAIR) {
  rect(c, 13, 2, 18, 8, Colour.SKIN);
  rect(c, 13, 2, 15, 5, hair);
  rect(c, 13, 2, 18, 3, hair);
  c.set(14, 7, Colour.SKIN_SHADE);
  c.set(17, 5, Colour.OUTLINE);
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
  rect(c, hx - 1, hy - 1, hx + 1, hy + 1, Colour.SKIN);
}

/** Worker: a farmhand in a linen smock and a broad hat, a shovel at their side. */
function worker(): PixelCanvas {
  const c = new PixelCanvas(SIZE, 'worker');
  legs(c, Colour.LEATHER, Colour.LEATHER_DARK);
  torso(c, LINEN, Colour.LEATHER);
  head(c);
  rect(c, 11, 3, 20, 4, Colour.THATCH_L);
  rect(c, 13, 0, 18, 3, Colour.THATCH_HI);
  rect(c, 16, 0, 18, 2, Colour.THATCH_L);
  rect(c, 13, 3, 18, 3, Colour.THATCH_EDGE);
  frontArm(c, LINEN, 22, 16);
  rect(c, 22, 23, 25, 28, Colour.STEEL);
  rect(c, 24, 23, 25, 28, Colour.STEEL_DARK);
  c.outline();
  c.line([23, 4], [23, 22], Colour.WOOD);
  c.line([22, 4], [24, 4], Colour.LOG_DARK);
  rect(c, 21, 15, 22, 16, Colour.SKIN);
  return c;
}

/** Warrior: a militiaman in a dark hood and leather jerkin, with a pitchfork. */
function warrior(): PixelCanvas {
  const c = new PixelCanvas(SIZE, 'warrior');
  legs(c, Colour.HOOD_DARK, Colour.LEATHER_DARK);
  torso(c, LEATHER);
  rect(c, 12, 1, 19, 10, Colour.HOOD);
  rect(c, 17, 1, 19, 10, Colour.HOOD_DARK);
  rect(c, 15, 4, 18, 8, Colour.SKIN_SHADE);
  rect(c, 16, 5, 18, 8, Colour.SKIN);
  c.set(17, 5, Colour.OUTLINE);
  frontArm(c, LEATHER, 22, 15);
  c.outline();
  c.line([23, 4], [23, 28], Colour.WOOD);
  c.line([21, 4], [25, 4], Colour.STEEL_DARK);
  for (const x of [21, 23, 25]) c.line([x, 0], [x, 3], Colour.STEEL);
  rect(c, 21, 14, 22, 15, Colour.SKIN);
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
    Colour.BANNER_DARK,
  );
  legs(c, Colour.HOOD_DARK, Colour.LEATHER_DARK);
  torso(c, DARK, Colour.LEATHER);
  rect(c, 12, 1, 19, 9, Colour.BANNER);
  rect(c, 12, 1, 14, 9, Colour.BANNER_HI);
  rect(c, 18, 2, 19, 9, Colour.BANNER_DARK);
  rect(c, 15, 4, 18, 8, Colour.SKIN_SHADE);
  rect(c, 16, 5, 18, 8, Colour.SKIN);
  c.set(17, 5, Colour.OUTLINE);
  rect(c, 12, 9, 19, 10, Colour.BANNER);
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
    c.set(x, y, Colour.STEEL_HI);
  for (const [x, y] of [
    [24, 13],
    [25, 12],
    [26, 11],
    [27, 10],
    [27, 9],
    [28, 8],
    [28, 7],
  ])
    c.set(x, y, Colour.STEEL);
  c.line([20, 14], [23, 16], Colour.GOLD);
  rect(c, 21, 14, 22, 15, Colour.SKIN);
  return c;
}

/** Pikeman: a soldier in a steel kettle helm and breastplate, holding a long pike upright. */
function pikeman(): PixelCanvas {
  const c = new PixelCanvas(SIZE, 'pikeman');
  legs(c, Colour.BLUE_DARK, Colour.LEATHER_DARK);
  torso(c, PLATE);
  rect(c, 12, 15, 19, 18, Colour.BLUE);
  rect(c, 12, 17, 19, 17, Colour.LEATHER_DARK);
  head(c);
  rect(c, 11, 3, 20, 4, Colour.STEEL);
  rect(c, 13, 0, 18, 3, Colour.STEEL);
  rect(c, 13, 0, 15, 2, Colour.STEEL_HI);
  rect(c, 11, 4, 20, 4, Colour.STEEL_DARK);
  frontArm(c, PLATE, 22, 15);
  c.outline();
  c.line([23, 5], [23, 29], Colour.WOOD);
  c.line([23, 0], [23, 4], Colour.STEEL_HI);
  c.line([22, 3], [22, 4], Colour.STEEL);
  c.line([24, 3], [24, 4], Colour.STEEL_DARK);
  rect(c, 21, 14, 22, 15, Colour.SKIN);
  return c;
}

/** Swordsman: a knight in a great helm and plate behind a white shield with a red cross, sword raised. */
function swordsman(): PixelCanvas {
  const c = new PixelCanvas(SIZE, 'swordsman');
  legs(c, Colour.STEEL_DARK, Colour.HOOD_DARK);
  torso(c, PLATE);
  rect(c, 13, 1, 18, 8, Colour.STEEL);
  rect(c, 13, 1, 14, 8, Colour.STEEL_HI);
  rect(c, 17, 1, 18, 8, Colour.STEEL_DARK);
  rect(c, 15, 4, 18, 4, Colour.OUTLINE);
  rect(c, 16, 6, 16, 7, Colour.OUTLINE);
  c.poly(
    [
      [16, 9],
      [25, 9],
      [25, 18],
      [20.5, 25],
      [16, 18],
    ],
    Colour.WOOL,
  );
  c.poly(
    [
      [21, 9],
      [25, 9],
      [25, 18],
      [20.5, 25],
    ],
    Colour.LINEN,
  );
  rect(c, 20, 10, 21, 22, Colour.BANNER);
  rect(c, 17, 13, 24, 14, Colour.BANNER);
  c.outline();
  c.line([9, 0], [9, 10], Colour.STEEL_HI);
  c.line([10, 1], [10, 10], Colour.STEEL);
  c.line([7, 11], [12, 11], Colour.GOLD);
  c.line([9, 12], [9, 13], Colour.LEATHER_DARK);
  rect(c, 9, 14, 10, 15, Colour.SKIN);
  return c;
}

/** Archer: a bowman in a conical helm and mail, a quiver on their back and an arrow drawn. */
function archer(): PixelCanvas {
  const c = new PixelCanvas(SIZE, 'archer');
  rect(c, 8, 9, 10, 19, Colour.LEATHER);
  rect(c, 10, 9, 10, 19, Colour.LEATHER_DARK);
  legs(c, Colour.LEATHER_DARK, Colour.HOOD_DARK);
  torso(c, { hi: Colour.STEEL, mid: Colour.STEEL, dark: Colour.STEEL_DARK }, Colour.LEATHER);
  for (let y = 10; y <= 16; y += 2) for (let x = 13; x <= 18; x += 2) c.set(x + ((y / 2) % 2), y, Colour.STEEL_DARK);
  rect(c, 12, 15, 19, 18, Colour.GREEN_L);
  rect(c, 12, 17, 19, 17, Colour.LEATHER);
  head(c);
  c.poly(
    [
      [12, 4],
      [15.5, -1],
      [20, 4],
    ],
    Colour.STEEL,
  );
  rect(c, 12, 4, 19, 4, Colour.STEEL_DARK);
  rect(c, 19, 10, 25, 12, Colour.STEEL);
  rect(c, 24, 10, 26, 12, Colour.SKIN);
  c.outline();
  for (const x of [7, 9, 11]) c.line([x, 6], [x, 8], x === 9 ? Colour.WOOL : Colour.BANNER);
  c.line([26, 3], [28, 7], Colour.WOOD);
  c.line([28, 7], [28, 15], Colour.WOOD);
  c.line([28, 15], [26, 19], Colour.WOOD);
  c.line([26, 3], [20, 11], Colour.WOOL);
  c.line([20, 11], [26, 19], Colour.WOOL);
  c.line([20, 11], [29, 11], Colour.LOG_DARK);
  c.set(30, 11, Colour.STEEL_HI);
  c.set(19, 11, Colour.BANNER);
  rect(c, 19, 10, 20, 12, Colour.SKIN);
  return c;
}

/**
 * A bay horse facing right, hooves at y = 29. An `armoured` horse wears a steel chanfron on its head and a red
 * caparison over its neck and body.
 */
function horse(c: PixelCanvas, armoured: boolean) {
  const shade = (_x: number, y: number): Colour => (y < 15 ? Colour.HORSE_HI : y > 19 ? Colour.HORSE_DARK : Colour.HORSE);
  // the tail and the legs on the far side
  c.poly(
    [
      [5, 14],
      [8, 15],
      [6, 25],
      [2, 24],
    ],
    Colour.HAIR,
  );
  rect(c, 9, 20, 11, 28, Colour.HORSE_DARK);
  rect(c, 18, 20, 20, 28, Colour.HORSE_DARK);
  // the body, neck and head
  oval(c, 14, 17, 9.5, 4.5, shade);
  c.poly(
    [
      [18, 16],
      [21, 10],
      [25, 9],
      [25, 18],
    ],
    armoured ? Colour.BANNER : Colour.HORSE,
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
    armoured ? Colour.STEEL : Colour.HORSE,
  );
  c.poly(
    [
      [27, 12],
      [30, 12],
      [30, 15],
      [27, 15],
    ],
    armoured ? Colour.STEEL_DARK : Colour.HORSE_DARK,
  );
  rect(c, 22, 6, 23, 8, armoured ? Colour.STEEL_DARK : Colour.HORSE_DARK);
  c.line([21, 8], [17, 14], armoured ? Colour.GOLD : Colour.HAIR);
  c.line([22, 9], [18, 14], armoured ? Colour.BANNER_DARK : Colour.HAIR);
  c.set(25, 10, Colour.OUTLINE);
  // the legs on the near side
  rect(c, 5, 17, 9, 22, Colour.HORSE);
  rect(c, 6, 22, 8, 29, Colour.HORSE);
  rect(c, 21, 18, 24, 21, Colour.HORSE);
  rect(c, 21, 21, 23, 29, Colour.HORSE);
  if (armoured) {
    c.poly(
      [
        [5, 13],
        [22, 13],
        [24, 24],
        [4, 24],
      ],
      Colour.BANNER,
    );
    rect(c, 4, 13, 23, 14, Colour.BANNER_HI);
    for (const x of [9, 14, 19]) c.line([x, 16], [x, 23], Colour.BANNER_DARK);
    rect(c, 4, 23, 24, 24, Colour.GOLD);
  }
}

/** A rider seated on the horse, the near leg down its side; `helm` is open (the face shows) or closed. */
function rider(c: PixelCanvas, cloth: Cloth, leg: Colour, helm: HelmKind) {
  rect(c, 14, 13, 18, 16, leg);
  rect(c, 16, 16, 18, 20, leg);
  rect(c, 16, 19, 19, 21, Colour.LEATHER_DARK);
  rect(c, 12, 7, 17, 15, cloth.mid);
  rect(c, 12, 7, 13, 15, cloth.hi);
  rect(c, 16, 8, 17, 15, cloth.dark);
  rect(c, 12, 14, 17, 14, Colour.LEATHER_DARK);
  rect(c, 13, 1, 17, 7, Colour.SKIN);
  if (helm === HelmKind.OPEN) {
    rect(c, 13, 1, 17, 3, Colour.STEEL);
    rect(c, 13, 1, 14, 6, Colour.STEEL);
    rect(c, 13, 1, 15, 2, Colour.STEEL_HI);
    c.set(16, 4, Colour.OUTLINE);
  } else {
    rect(c, 13, 1, 17, 7, Colour.STEEL);
    rect(c, 13, 1, 14, 7, Colour.STEEL_HI);
    rect(c, 15, 4, 17, 4, Colour.OUTLINE);
  }
}

/** Cavalry: a rider in mail and a red cloak on a bay horse, sword held high. */
function cavalry(): PixelCanvas {
  const c = new PixelCanvas(SIZE, 'cavalry');
  horse(c, false);
  rect(c, 8, 13, 15, 16, Colour.BLUE);
  rect(c, 8, 16, 15, 16, Colour.BLUE_DARK);
  c.poly(
    [
      [11, 7],
      [13, 7],
      [10, 17],
      [5, 16],
    ],
    Colour.BANNER,
  );
  rider(c, { hi: Colour.STEEL, mid: Colour.STEEL, dark: Colour.STEEL_DARK }, Colour.HOOD_DARK, HelmKind.OPEN);
  for (let y = 9; y <= 13; y += 2) for (const x of [14, 16]) c.set(x + ((y - 9) % 4 ? 1 : 0), y, Colour.STEEL_DARK);
  rect(c, 11, 7, 12, 11, Colour.BANNER_HI);
  rect(c, 17, 8, 20, 10, Colour.STEEL);
  c.outline();
  c.line([22, 6], [27, 1], Colour.STEEL_HI);
  c.line([22, 7], [28, 1], Colour.STEEL);
  c.line([20, 5], [23, 8], Colour.GOLD);
  rect(c, 20, 7, 21, 8, Colour.SKIN);
  return c;
}

/** Cataphract: a rider in full plate on an armoured horse, a lance upright with a pennant. */
function cataphract(): PixelCanvas {
  const c = new PixelCanvas(SIZE, 'cataphract');
  horse(c, true);
  rider(c, PLATE, Colour.STEEL_DARK, HelmKind.CLOSED);
  rect(c, 17, 9, 20, 11, Colour.STEEL);
  c.outline();
  c.line([21, 0], [21, 20], Colour.WOOD);
  c.line([21, 0], [21, 1], Colour.STEEL_HI);
  rect(c, 22, 1, 25, 2, Colour.BANNER);
  c.set(26, 1, Colour.BANNER);
  rect(c, 22, 3, 23, 3, Colour.BANNER_DARK);
  rect(c, 20, 9, 21, 10, Colour.STEEL_HI);
  return c;
}

/** Transporter: a covered wagon with a canvas hood over its load. */
function transporter(): PixelCanvas {
  const c = new PixelCanvas(SIZE, 'transporter');
  c.line([24, 21], [30, 23], Colour.LOG_DARK);
  c.poly(
    [
      [3, 8],
      [7, 4],
      [22, 4],
      [26, 8],
      [26, 17],
      [3, 17],
    ],
    Colour.WALL_L,
  );
  rect(c, 5, 5, 23, 7, Colour.WALL_TOP);
  rect(c, 22, 6, 26, 17, Colour.WALL_R);
  for (const x of [9, 15, 21]) c.line([x, 5], [x, 16], Colour.LINEN_DARK);
  rect(c, 2, 16, 27, 21, Colour.PLANK_L);
  rect(c, 2, 16, 27, 16, Colour.PLANK_TOP);
  rect(c, 23, 17, 27, 21, Colour.PLANK_R);
  for (const x of [8, 14, 20]) c.line([x, 17], [x, 21], Colour.PLANK_R);
  wheel(c, 8, 23, 5);
  wheel(c, 21, 23, 5);
  c.outline();
  return c;
}

/** Ballista: a giant crossbow on a wheeled timber carriage, its bolt laid ready. */
function ballista(): PixelCanvas {
  const c = new PixelCanvas(SIZE, 'ballista');
  rect(c, 4, 19, 26, 22, Colour.PLANK_L);
  rect(c, 4, 19, 26, 19, Colour.PLANK_TOP);
  rect(c, 13, 12, 16, 19, Colour.PLANK_R);
  c.poly(
    [
      [3, 12],
      [26, 8],
      [26, 11],
      [3, 15],
    ],
    Colour.PLANK_L,
  );
  c.line([3, 12], [26, 8], Colour.PLANK_TOP);
  c.poly(
    [
      [22, 9],
      [25, 8],
      [22, 0],
      [19, 1],
    ],
    Colour.WOOD,
  );
  c.poly(
    [
      [22, 11],
      [25, 11],
      [22, 18],
      [19, 17],
    ],
    Colour.WOOD,
  );
  rect(c, 22, 7, 25, 12, Colour.STEEL_DARK);
  rect(c, 22, 7, 25, 7, Colour.STEEL);
  wheel(c, 8, 24, 5);
  wheel(c, 22, 24, 5);
  c.outline();
  c.line([20, 1], [8, 11], Colour.LINEN_DARK);
  c.line([20, 17], [8, 11], Colour.LINEN_DARK);
  c.line([8, 10], [28, 6.5], Colour.LOG_DARK);
  c.line([28, 6], [30, 6], Colour.STEEL_HI);
  c.set(9, 9, Colour.BANNER);
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
    Colour.LEATHER,
  );
  c.poly(
    [
      [2, 17],
      [7, 7],
      [10, 7],
      [6, 17],
    ],
    Colour.HORSE_HI,
  );
  rect(c, 7, 7, 23, 8, Colour.LEATHER_DARK);
  for (const y of [11, 14]) c.line([3 + Math.round((17 - y) / 2), y], [26 - Math.round((17 - y) / 2.5), y], Colour.LEATHER_DARK);
  rect(c, 5, 17, 24, 19, Colour.HOOD_DARK);
  rect(c, 5, 17, 6, 20, Colour.PLANK_R);
  rect(c, 23, 17, 24, 20, Colour.PLANK_R);
  rect(c, 7, 16, 28, 18, Colour.LOG);
  rect(c, 7, 18, 28, 18, Colour.LOG_DARK);
  rect(c, 26, 15, 30, 19, Colour.STEEL);
  rect(c, 26, 15, 30, 15, Colour.STEEL_HI);
  rect(c, 29, 16, 30, 19, Colour.STEEL_DARK);
  rect(c, 3, 20, 26, 21, Colour.PLANK_L);
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
    Colour.PLANK_R,
  );
  c.poly(
    [
      [7, 9],
      [9, 7],
      [21, 18],
      [19, 20],
    ],
    Colour.LOG,
  );
  c.line([9, 7], [21, 18], Colour.LOG_END);
  disc(c, 6, 7, 3.5, Colour.LEATHER_DARK);
  disc(c, 6, 6, 2.5, Colour.STONE_TOP, Colour.STONE_R);
  c.poly(
    [
      [24, 20],
      [27, 20],
      [23, 8],
      [21, 8],
    ],
    Colour.PLANK_L,
  );
  rect(c, 18, 6, 25, 9, Colour.PLANK_L);
  rect(c, 18, 6, 25, 6, Colour.PLANK_TOP);
  rect(c, 18, 9, 25, 9, Colour.PLANK_R);
  rect(c, 3, 18, 28, 21, Colour.PLANK_L);
  rect(c, 3, 18, 28, 18, Colour.PLANK_TOP);
  wheel(c, 8, 24, 5);
  wheel(c, 22, 24, 5);
  c.outline();
  c.line([9, 9], [4, 18], Colour.LINEN_DARK);
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
