// Fortifications: one 32×32 sprite per fortification type (client/web/src/lib/game-art.ts, unitArtFile), drawn like
// the troops (tools/art/troops.ts): side on, lit from the top left, outlined. The trap is a pit hidden under brush, the
// abatis crossed sharpened stakes, the archer tower a timber tower under a thatched cone, the rolling logs a stack of
// felled trunks, and the defensive trebuchet is shown by the boulders it hurls.

import { FortType } from '@marchlands/core';
import { type Colour, PixelCanvas, type Pt } from './pixel.ts';
import { log, oval, rect } from './shapes.ts';

const SIZE = 32;

/** A sharpened stake from its butt (x0, y0) to its point (x1, y1), `w` wide, its point cut pale. */
function stake(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, w: number, bark: Colour = 'log') {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const [dx, dy] = [(x1 - x0) / len, (y1 - y0) / len];
  const [nx, ny] = [(-dy * w) / 2, (dx * w) / 2];
  const tip = Math.min(5, len / 3);
  const [bx, by] = [x1 - dx * tip, y1 - dy * tip];
  const side = (t: number): Pt => [x0 + nx * t, y0 + ny * t];
  c.poly([side(-1), side(1), [bx + nx, by + ny], [bx - nx, by - ny]], bark);
  c.poly([side(0), side(1), [bx + nx, by + ny], [bx, by]], 'logDark');
  c.poly(
    [
      [bx + nx, by + ny],
      [bx - nx, by - ny],
      [x1, y1],
    ],
    'logEnd',
  );
}

/** A boulder: an ellipse lit from the top left, its edge a little irregular and drawn dark against what's behind it. */
function boulder(c: PixelCanvas, cx: number, cy: number, rx: number, ry: number) {
  const phase = c.rand() * Math.PI * 2;
  const edge = (u: number, v: number) => {
    const a = Math.atan2(v, u);
    return 1 + 0.1 * Math.sin(3 * a + phase) + 0.06 * Math.sin(5 * a + phase * 2);
  };
  for (const ring of [true, false])
    for (let y = Math.floor(cy - ry - 2); y <= Math.ceil(cy + ry + 2); y++)
      for (let x = Math.floor(cx - rx - 2); x <= Math.ceil(cx + rx + 2); x++) {
        const [u, v] = ring ? [(x - cx) / (rx + 1), (y - cy) / (ry + 1)] : [(x - cx) / rx, (y - cy) / ry];
        if (u * u + v * v > edge(u, v) ** 2) continue;
        const light = u + v;
        c.set(x, y, ring ? 'outline' : light < -0.7 ? 'graniteHi' : light < 0.1 ? 'stoneTop' : light < 0.8 ? 'stoneL' : 'stoneR');
      }
}

/** Trap: a pit of sharpened stakes, hidden under a covering of leafy brush. */
function trap(): PixelCanvas {
  const c = new PixelCanvas(SIZE, 'trap');
  oval(c, 16, 21, 15, 8, 'leafDark');
  oval(c, 16, 20, 14, 7, 'leaf');
  oval(c, 16, 21, 9, 4.5, 'hoodDark');
  oval(c, 16, 19.5, 9, 2.5, 'outline');
  for (const [x, y] of [
    [10, 23],
    [13, 24],
    [16, 22],
    [19, 24],
    [22, 22],
  ]) {
    c.line([x, y - 3], [x, y - 2], 'logEnd');
    c.line([x, y - 1], [x, y], 'log');
  }
  for (let i = 0; i < 50; i++) {
    const a = c.rand() * Math.PI * 2;
    const r = 0.72 + c.rand() * 0.3;
    const x = Math.round(16 + Math.cos(a) * 13 * r);
    const y = Math.round(20.5 + Math.sin(a) * 6.5 * r);
    const col: Colour = c.rand() < 0.4 ? 'grass' : c.rand() < 0.5 ? 'leafDark' : 'pine';
    c.set(x, y, col);
    c.set(x + 1, y, col);
    if (y < 20) c.set(x, y - 1, col);
  }
  for (const [x0, y0, x1, y1] of [
    [5, 18, 12, 22],
    [20, 25, 27, 20],
    [9, 15, 15, 16],
  ])
    c.line([x0, y0], [x1, y1], 'trunk');
  c.outline();
  return c;
}

/** Abatis: sharpened stakes crossed and lashed with rope, their points turned outward. */
function abatis(): PixelCanvas {
  const c = new PixelCanvas(SIZE, 'abatis');
  stake(c, 12, 26, 30, 7, 4, 'trunk');
  stake(c, 26, 29, 4, 5, 5);
  stake(c, 5, 29, 27, 5, 5);
  rect(c, 13, 15, 18, 18, 'linen');
  rect(c, 13, 17, 18, 18, 'linenDark');
  c.outline();
  return c;
}

/** Archer tower: a timber tower on a stone footing, an arrow slit in its side, under a thatched cone. */
function archerTower(): PixelCanvas {
  const c = new PixelCanvas(SIZE, 'archer-tower');
  rect(c, 8, 26, 23, 30, 'stoneL');
  rect(c, 8, 26, 23, 26, 'stoneTop');
  rect(c, 19, 27, 23, 30, 'stoneR');
  rect(c, 9, 13, 22, 26, 'plankL');
  rect(c, 9, 13, 11, 26, 'plankTop');
  rect(c, 19, 13, 22, 26, 'plankR');
  for (const x of [12, 15, 18]) c.line([x, 14], [x, 25], 'logDark');
  c.line([10, 25], [21, 15], 'logDark');
  rect(c, 14, 17, 16, 21, 'outline');
  rect(c, 7, 11, 24, 13, 'plankTop');
  rect(c, 7, 13, 24, 13, 'plankR');
  c.poly(
    [
      [5, 12],
      [15.5, 0],
      [26, 12],
    ],
    'thatchL',
  );
  c.poly(
    [
      [5, 12],
      [15.5, 0],
      [13, 12],
    ],
    'thatchHi',
  );
  c.poly(
    [
      [19, 12],
      [15.5, 0],
      [26, 12],
    ],
    'thatchD',
  );
  for (const [x0, x1] of [
    [9, 22],
    [12, 19],
  ])
    c.line([x0, 12 - (x1 - x0) / 2.6], [x1, 12 - (x1 - x0) / 2.6], 'thatchEdge');
  rect(c, 5, 11, 26, 12, 'thatchEdge');
  c.outline();
  return c;
}

/** Rolling log: three felled trunks stacked ready to roll down on attackers, cut ends showing their rings. */
function rollingLog(): PixelCanvas {
  const c = new PixelCanvas(SIZE, 'rolling-log');
  log(c, 8, 26, 19, 4.5);
  log(c, 5, 22, 12, 4.5);
  log(c, 3, 21, 25, 4.5);
  c.outline();
  return c;
}

/** Defensive trebuchet: shown by the boulders it hurls down from the walls. */
function trebuchet(): PixelCanvas {
  const c = new PixelCanvas(SIZE, 'trebuchet');
  boulder(c, 14, 15, 10, 8);
  boulder(c, 24, 23, 6, 5);
  boulder(c, 9, 24, 7, 5);
  c.outline();
  c.line([11, 12], [14, 15], 'stoneR');
  c.line([7, 22], [9, 24], 'stoneR');
  return c;
}

/** The fortifications drawn in code, by fortification type. */
export const FORT_DRAWINGS: Record<number, () => PixelCanvas> = {
  [FortType.TRAP]: trap,
  [FortType.ABATIS]: abatis,
  [FortType.ARCHER_TOWER]: archerTower,
  [FortType.ROLLING_LOG]: rollingLog,
  [FortType.TREBUCHET]: trebuchet,
};
