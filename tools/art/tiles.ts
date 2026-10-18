// Map tile art for the valleys: one sprite per valley type and level band (client/web/src/lib/game-art.ts). Every band
// keeps the same full diamond, so tiles line up on the map, and grows richer with the level: band 1 (levels 1-3) is
// sparse, band 4 (level 10) is the full scene. The diamond sits at the same place in every sprite (no centring).

import { TileType } from '@marchlands/core';
import { IsoCanvas } from './iso.ts';

const SIZE = 64;
const PLOT = 30;

type Drawing = Record<number, () => IsoCanvas>;

/** A tile canvas with its seed, its whole diamond covered with `ground`. */
function tile(name: string, band: number, ground: (c: IsoCanvas) => void): IsoCanvas {
  const c = new IsoCanvas(SIZE, PLOT, `${name}-${band}`);
  ground(c);
  return c;
}

/** `n` random spots inside the diamond, `margin` in from its edges, sorted back to front. */
function scatter(c: IsoCanvas, n: number, margin: number): [number, number][] {
  const spots: [number, number][] = [];
  for (let i = 0; i < n; i++) spots.push([margin + c.rand() * (PLOT - 2 * margin), margin + c.rand() * (PLOT - 2 * margin)]);
  return spots.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
}

/** Spots on a jittered grid every `step` units, for a dense cover (a forest, a meadow). */
function grid(c: IsoCanvas, step: number, margin: number): [number, number][] {
  const spots: [number, number][] = [];
  for (let y = margin; y <= PLOT - margin; y += step)
    for (let x = margin; x <= PLOT - margin; x += step) spots.push([x + (c.rand() - 0.5) * step * 0.7, y + (c.rand() - 0.5) * step * 0.7]);
  return spots.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
}

const finish = (c: IsoCanvas) => {
  c.outline();
  return c;
};

const lawn = (c: IsoCanvas) => c.grass(0, 0, PLOT, PLOT);

const forest: Drawing = Object.fromEntries(
  [3, 8, 0, 0].map((n, i) => {
    const band = i + 1;
    return [
      band,
      () => {
        const c = tile('forest', band, lawn);
        const spots = band <= 2 ? scatter(c, n, 4) : grid(c, band === 3 ? 5 : 3.6, 3);
        for (const [x, y] of spots) c.pine(x, y, c.between(8 + band, 11 + band * 1.5));
        return finish(c);
      },
    ];
  }),
);

const grass: Drawing = Object.fromEntries(
  [1, 2, 3, 4].map((band) => [
    band,
    () => {
      const c = tile('grass', band, lawn);
      if (band >= 3) c.blob(15, 15, band === 4 ? 13 : 9, band === 4 ? 13 : 9, (x, y) => ((x * 3 + y * 5) % 7 === 0 ? 'grass' : 'grassDark'));
      const spots = band === 4 ? grid(c, 2.2, 3) : scatter(c, [6, 14, 26][band - 1], 3);
      for (const [x, y] of spots) c.tuft(x, y, c.between(2 + band, 3 + band));
      if (band >= 3) for (const [x, y] of scatter(c, band * 2, 5)) c.flower(x, y, c.rand() < 0.5 ? 'flower' : 'flowerB');
      return finish(c);
    },
  ]),
);

const swamp: Drawing = Object.fromEntries(
  [1, 2, 3, 4].map((band) => [
    band,
    () => {
      const mud = (x: number, y: number) => ((x * 3 + y * 7) % 5 === 0 ? 'moss' : 'mud');
      const c = tile('swamp', band, (c) => {
        if (band === 1) {
          c.grass(0, 0, PLOT, PLOT);
          c.blob(15, 15, 10, 10, mud);
        } else c.ground(0, 0, PLOT, PLOT, 'mud');
        if (band > 1) c.blob(15, 15, 15, 15, mud);
      });
      // pools ringed with moss
      const pools = [
        [15, 15, 4],
        [8, 21, 3],
        [22, 8, 3],
        [21, 22, 4],
        [8, 9, 3],
      ].slice(0, [1, 2, 4, 5][band - 1]);
      for (const [x, y, r] of pools) {
        c.blob(x, y, r + 1.5, r + 1.5, 'moss');
        c.blob(x, y, r, r, (sx, sy) => c.water(sx, sy));
      }
      for (const [x, y] of scatter(c, [3, 6, 10, 15][band - 1], 3)) c.reeds(x, y);
      return finish(c);
    },
  ]),
);

const lake: Drawing = Object.fromEntries(
  [1, 2, 3, 4].map((band) => [
    band,
    () => {
      const c = tile('lake', band, lawn);
      const r = [4, 7, 9.5, 11.5][band - 1];
      if (band >= 2) c.blob(15, 15, r + 2, r + 2, 'sandLight');
      c.blob(15, 15, r, r, (x, y) => c.water(x, y));
      if (band >= 3) c.blob(14, 14, r * 0.45, r * 0.45, 'waterDeep');
      const palms = [
        [4, 13],
        [16, 4],
        [26, 18],
        [12, 27],
      ].slice(0, [0, 0, 2, 4][band - 1]);
      for (const [x, y] of palms) c.palm(x, y, 9);
      if (band <= 2) for (const [x, y] of scatter(c, 3, 3)) c.reeds(x, y);
      return finish(c);
    },
  ]),
);

const hill: Drawing = Object.fromEntries(
  [1, 2, 3, 4].map((band) => [
    band,
    () => {
      const c = tile('hill', band, lawn);
      // separate rock pillars, tallest towards the middle, more and taller at each band
      const size = [9, 15, 20, 25][band - 1];
      const from = (PLOT - size) / 2;
      const maxH = [6, 10, 14, 19][band - 1];
      const pillars: [number, number, number][] = [];
      for (let y = from; y < from + size; y += 4)
        for (let x = from; x < from + size; x += 4) {
          const middle = 1 - Math.hypot(x + 1.5 - PLOT / 2, y + 1.5 - PLOT / 2) / (size * 0.75);
          if (middle <= 0) continue;
          pillars.push([x + c.rand() * 1.5, y + c.rand() * 1.5, Math.max(3, Math.round(maxH * middle * (0.55 + 0.45 * c.rand())))]);
        }
      pillars.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
      for (const [x, y, h] of pillars) c.spire(x, y, h, 3, 'sandstone');
      return finish(c);
    },
  ]),
);

const desert: Drawing = Object.fromEntries(
  [1, 2, 3, 4].map((band) => [
    band,
    () => {
      // dunes: wavy darker ridges across the sand, more of them at higher bands
      const dunes = (x: number, y: number) => ((x + 2 * y + Math.round(3 * Math.sin(x / 4))) % [40, 16, 12, 10][band - 1] === 0 ? 'sandDark' : 'sand');
      const c = tile('desert', band, (c) => c.ground(0, 0, PLOT, PLOT, 'sand'));
      c.poly([c.p(0, 0), c.p(PLOT, 0), c.p(PLOT, PLOT), c.p(0, PLOT)], dunes);
      if (band >= 3) c.outcrop(3, 3, band === 4 ? 7 : 4, band === 4 ? 6 : 4, band === 4 ? 6 : 3, 'sandstone');
      for (const [x, y] of scatter(c, [1, 2, 3, 5][band - 1], 7)) c.cactus(x, y, c.between(5, 7 + band));
      return finish(c);
    },
  ]),
);

const flat: Drawing = Object.fromEntries(
  [1, 2, 3, 4].map((band) => [
    band,
    () => {
      const c = tile('flat', band, lawn);
      for (const [x, y] of scatter(c, [0, 3, 5, 7][band - 1], 3)) c.box(x, y, 0, 1, 1, 1, { top: 'graniteHi', left: 'graniteL', right: 'graniteR' });
      for (const [x, y] of scatter(c, [0, 0, 8, 16][band - 1], 2)) c.flower(x, y, c.rand() < 0.5 ? 'flower' : 'flowerB');
      if (band === 4) {
        c.cypress(5, 24, 5);
        c.cypress(24, 5, 5);
      }
      return finish(c);
    },
  ]),
);

/** Map tile drawings by valley type. */
export const TILE_DRAWINGS: Record<number, Drawing> = {
  [TileType.FOREST]: forest,
  [TileType.GRASS]: grass,
  [TileType.SWAMP]: swamp,
  [TileType.LAKE]: lake,
  [TileType.HILL]: hill,
  [TileType.DESERT]: desert,
  [TileType.FLAT]: flat,
};
