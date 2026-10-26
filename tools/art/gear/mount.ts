// The mount (tools/art/gear.ts): a horse's head facing left, its neck at the bottom right. A chestnut in a rope halter
// (0), a chestnut with a white blaze in a bridle (1), a grey in red-brown barding (2), then from 3 a face plate
// (chanfron) and barding in the level's colour, a plume from 5, a horn from 7, gilded at 9 and at 10 a black horse in
// crimson armour with glowing eyes and two horns.

import type { Colour, PixelCanvas, Pt } from '../pixel.ts';
import { canvas, fill, horn, look, plume, type Shades, shine, sweep, trimmed } from './common.ts';

const CHESTNUT: Shades = ['horseHi', 'horse', 'horseDark'];
const GREY: Shades = ['graniteL', 'stoneTop', 'stoneL'];
const BLACK: Shades = ['hood', 'hoodDark', 'gear0'];

const NECK: Pt[] = [
  [17, 31],
  [29, 31],
  [26, 13],
  [17, 10],
];
const HEAD: Pt[] = [
  [13, 5],
  [20, 7],
  [20, 13],
  [11, 24],
  [5, 23],
  [4, 19],
];
const FACE: Pt[] = [
  [11, 5],
  [17, 7],
  [9, 23],
  [4, 20],
];

export function mount(level: number): PixelCanvas {
  const c = canvas('mount', level);
  const L = look(level);
  const coat: Shades = level === 2 || level === 9 ? GREY : level >= 10 ? BLACK : CHESTNUT;
  const mane: Colour = level === 2 || level === 9 ? 'hood' : level >= 10 ? 'gear0Dark' : 'horseDark';
  fill(c, NECK, coat);
  // barding over the neck: red-brown at 2, the level's colour from 3, crimson at 10
  if (level >= 2) {
    const cloth: Shades = level === 2 ? ['barnHi', 'barnL', 'barnD'] : level >= 10 ? L.metal : L.accent;
    fill(
      c,
      [
        [18, 31],
        [29, 31],
        [27, 19],
        [19, 17],
      ],
      cloth,
    );
    if (level >= 3) for (let x = 19; x < 28; x++) c.set(x, 18 + Math.round((x - 19) * 0.2), L.trim[1]);
  }
  fill(c, HEAD, coat);
  fill(
    c,
    [
      [15, 2],
      [18, 7],
      [14, 7],
    ],
    coat,
  );
  if (level === 1) for (let y = 8; y < 21; y++) c.set(13 - Math.round((y - 8) * 0.55), y, 'wool');
  // the face plate: silver trimmed in crimson at 10, so it stands out from the crimson barding
  if (level >= 3) trimmed(c, FACE, level >= 10 ? ['steelHi', 'steel', 'steelDark'] : L.metal, level >= 10 ? L.metal : L.trim, 1.6);
  if (level >= 5) plume(c, [17, 6], [24, 0], -1, 2.2, L.accent);
  if (L.spikes) horn(c, [11, 8], [3, 0], 7, L.trim);
  if (level >= 10) horn(c, [17, 8], [22, 0], 6, L.trim);
  // the mane down the back of the neck
  sweep(
    c,
    (t) => [19 + t * 9, 6 + t * 22],
    () => 1.6,
    (t) => (Math.floor(t * 7) % 2 ? mane : 'gear0Dark'),
  );
  c.outline();
  // eye and nostril
  if (level >= 10) shine(c, 15, 11);
  else c.set(15, 11, 'gear0Dark');
  if (level >= 10) c.set(14, 11, 'gear10Hi');
  c.set(6, 21, 'gear0Dark');
  // halter, bridle and bit
  if (level === 0) {
    c.line([5, 18], [12, 21], 'linen');
    c.line([12, 21], [18, 10], 'linen');
  }
  if (level === 1) {
    c.line([6, 17], [12, 20], 'leatherDark');
    c.line([12, 20], [18, 9], 'leatherDark');
    c.set(7, 22, 'steelHi');
  }
  if (level >= 3) for (let i = 0; i < 4; i++) c.set(14 - i * 2, 9 + i * 4, L.trim[0]);
  // the head nods from the top of the neck, the muzzle lifting most
  c.spot('nod', [20, 13], 16);
  return c;
}
