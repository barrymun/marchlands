// Placeholder building sprites until the real pixel art is drawn: npm run art:placeholders [-- --force]
// One 32×32 indexed PNG per building type and level band (client/web/src/lib/game-art.ts), written to
// client/web/src/assets/buildings/. Each is a building in its own colour with a two-letter code, growing with the
// band: wider walls, towers from band 3, a flag at band 4, and gold dots for the band. Real art replaces the files
// under the same names. Only missing sprites are written, so real art is never overwritten; --force rewrites them all.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { BuildingType } from '@marchlands/core';

import { indexedPng, type Rgb } from './png.ts';
import { ART_BANDS, BUILDING_ART_TYPES, buildingArtFile } from '../../client/web/src/lib/game-art.ts';

const SIZE = 32;
const OUT = path.resolve(import.meta.dirname, '../../client/web/src/assets/buildings');

// ---- a 3×5 pixel font, A-Z (rows top to bottom, 3 bits each) ----
const FONT: Record<string, number[]> = {
  A: [2, 5, 7, 5, 5],
  B: [6, 5, 6, 5, 6],
  C: [3, 4, 4, 4, 3],
  D: [6, 5, 5, 5, 6],
  E: [7, 4, 6, 4, 7],
  F: [7, 4, 6, 4, 4],
  G: [3, 4, 5, 5, 3],
  H: [5, 5, 7, 5, 5],
  I: [7, 2, 2, 2, 7],
  J: [1, 1, 1, 5, 2],
  K: [5, 5, 6, 5, 5],
  L: [4, 4, 4, 4, 7],
  M: [5, 7, 7, 5, 5],
  N: [6, 5, 5, 5, 5],
  O: [2, 5, 5, 5, 2],
  P: [6, 5, 6, 4, 4],
  Q: [2, 5, 5, 6, 3],
  R: [6, 5, 6, 5, 5],
  S: [3, 4, 2, 1, 6],
  T: [7, 2, 2, 2, 2],
  U: [5, 5, 5, 5, 7],
  V: [5, 5, 5, 5, 2],
  W: [5, 5, 7, 7, 5],
  X: [5, 5, 2, 5, 5],
  Y: [5, 5, 2, 2, 2],
  Z: [7, 1, 2, 4, 7],
};

/** Two-letter codes, unique across the building types: initials, else the first two letters, else first and another. */
function codes(): Map<number, string> {
  const keyOf = new Map(Object.entries(BuildingType).map(([k, id]) => [id, k]));
  const used = new Set<string>();
  const out = new Map<number, string>();
  for (const id of BUILDING_ART_TYPES) {
    const key = keyOf.get(id) ?? 'XX';
    const words = key.split('_');
    const letters = key.replaceAll('_', '');
    const candidates = [words.length > 1 ? words[0][0] + words[1][0] : '', letters.slice(0, 2), ...[...letters.slice(1)].map((c) => letters[0] + c)];
    const code = candidates.find((c) => c.length === 2 && !used.has(c)) ?? 'XX';
    used.add(code);
    out.set(id, code);
  }
  return out;
}

// ---- colours ----
function hsl(h: number, s: number, l: number): Rgb {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}
// palette indices (0 is transparent)
const LINE = 1;
const WALL = 2;
const SHADE = 3;
const ROOF = 4;
const DOOR = 5;
const GOLD = 6;

function palette(hue: number): Rgb[] {
  return [[0, 0, 0], hsl(hue, 0.4, 0.16), hsl(hue, 0.45, 0.64), hsl(hue, 0.42, 0.5), hsl(hue, 0.5, 0.36), hsl(hue, 0.35, 0.24), hsl(45, 0.9, 0.55)];
}

// ---- drawing ----
class Canvas {
  readonly px = new Uint8Array(SIZE * SIZE);
  set(x: number, y: number, c: number) {
    if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) this.px[y * SIZE + x] = c;
  }
  rect(x0: number, y0: number, w: number, h: number, fill: number, line = LINE) {
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) this.set(x, y, x === x0 || x === x0 + w - 1 || y === y0 || y === y0 + h - 1 ? line : fill);
  }
  text(s: string, x0: number, y0: number, c: number) {
    [...s].forEach((ch, i) =>
      (FONT[ch] ?? FONT.X).forEach((row, y) => {
        for (let x = 0; x < 3; x++) if (row & (4 >> x)) this.set(x0 + i * 4 + x, y0 + y, c);
      }),
    );
  }
}

function sprite(code: string, band: number): Canvas {
  const cv = new Canvas();
  const ground = 30;
  const ww = 10 + band * 4; // wall width: 14, 18, 22, 26
  const wh = 7 + band * 2; // wall height: 9, 11, 13, 15
  const x0 = (SIZE - ww) / 2;
  const top = ground - wh;
  // walls, the right third in shade
  cv.rect(x0, top, ww, wh + 1, WALL);
  for (let y = top + 1; y < ground; y++) for (let x = x0 + Math.ceil((ww * 2) / 3); x < x0 + ww - 1; x++) cv.set(x, y, SHADE);
  // roof: a triangle overhanging the walls by one, flat-topped after 9 rows so the band 4 flag fits
  let apex = top;
  for (let i = 0; i < 9; i++) {
    const l = x0 - 1 + i;
    const r = x0 + ww - i;
    if (l > r) break;
    apex = top - 1 - i;
    for (let x = l; x <= r; x++) cv.set(x, apex, x === l || x === r || i === 8 ? LINE : ROOF);
  }
  // towers at both ends from band 3, crenellated
  if (band >= 3) {
    for (const tx of [x0 - 1, x0 + ww - 3]) {
      const th = wh + 5;
      cv.rect(tx, ground - th, 4, th + 1, SHADE);
      for (let x = tx; x < tx + 4; x += 2) cv.set(x, ground - th - 1, LINE);
    }
  }
  // a flag on the apex at band 4
  if (band === 4) {
    for (let y = apex - 4; y < apex; y++) cv.set(SIZE / 2, y, LINE);
    cv.rect(SIZE / 2 + 1, apex - 4, 4, 3, GOLD, GOLD);
  }
  // the code on the walls, and a door below it from band 2
  cv.text(code, SIZE / 2 - 3, top + 2, LINE);
  if (band >= 2) cv.rect(SIZE / 2 - 2, ground - 3, 4, 4, DOOR);
  // gold dots for the band, top left
  for (let i = 0; i < band; i++) cv.rect(1 + i * 3, 1, 2, 2, GOLD, GOLD);
  return cv;
}

const { values } = parseArgs({ options: { force: { type: 'boolean', default: false } } });
fs.mkdirSync(OUT, { recursive: true });
const codeOf = codes();
let written = 0;
let kept = 0;
BUILDING_ART_TYPES.forEach((typeId, i) => {
  const colours = palette((i * 137.5) % 360);
  for (const { band } of ART_BANDS) {
    const target = path.join(OUT, buildingArtFile(typeId, band));
    if (!values.force && fs.existsSync(target)) {
      kept++;
      continue;
    }
    fs.writeFileSync(target, indexedPng(SIZE, SIZE, sprite(codeOf.get(typeId) ?? 'XX', band).px, colours));
    written++;
  }
});
console.log(`${path.relative(process.cwd(), OUT)}: wrote ${written} placeholder sprites, kept ${kept} existing (--force rewrites them)`);
