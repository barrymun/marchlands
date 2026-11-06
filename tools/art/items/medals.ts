// The nine loyalty medals (medalId(level)), each on its own striped ribbon with its own emblem: round bronze for levels
// 1 to 3 (Cross, Rose, Lion), scalloped silver for 4 to 6 (Honour, Courage, Wisdom) and a gold star for 7 to 9
// (Freedom, Justice, Nation), so a medal's level shows at a glance. The Lion Medal shows a lion's paw.

import type { Colour, PixelCanvas } from '../pixel.ts';
import { disc, rect } from '../shapes.ts';
import { BRONZE, canvas, GOLD, sparkle, stamp, STEEL, type Tone } from './common.ts';

const MedalShape = { ROUND: 'round', SCALLOPED: 'scalloped', STAR: 'star' } as const;
type MedalShape = (typeof MedalShape)[keyof typeof MedalShape];

/** An emblem: a 9×9 pattern, `d` engraved in the metal and other letters enamel colours. */
interface Emblem {
  rows: readonly string[];
  colours?: Record<string, Colour>;
}

const EMBLEMS = {
  cross: { rows: ['...ddd...', '....d....', '....d....', 'd...d...d', 'ddddddddd', 'd...d...d', '....d....', '....d....', '...ddd...'] },
  rose: {
    rows: ['..rrrr...', '.rRrrRr..', '.rrRRrr..', '.rRrrRr..', '..rrrr...', '....g.gg.', '..ggg.gg.', '....g....', '....g....'],
    colours: { r: 'banner', R: 'bannerHi', g: 'greenL' },
  },
  lion: { rows: ['..d...d..', '.ddd.ddd.', '..d...d..', 'dd.....dd', 'dd.ddd.dd', '..ddddd..', '.ddddddd.', '.ddddddd.', '..dd.dd..'] },
  laurel: {
    rows: ['..g...g..', '.gG...Gg.', 'gG.....Gg', 'g.......g', 'gG.....Gg', '.gG...Gg.', '..gG.Gg..', '....r....', '...r.r...'],
    colours: { g: 'greenD', G: 'greenL', r: 'banner' },
  },
  sword: { rows: ['....d....', '....d....', '....d....', '....d....', '....d....', '.ddddddd.', '....d....', '....d....', '...ddd...'] },
  lamp: {
    rows: ['....f....', '...fFf...', '....f....', '.....d...', '..dddddd.', 'dddddddd.', '.dddddd..', '...dd....', '..dddd...'],
    colours: { f: 'fire', F: 'fireHi' },
  },
  torch: {
    rows: ['...ff....', '..fFFf...', '..fFFf...', '...ff....', '...dd....', '....d....', '....d....', '....d....', '....d....'],
    colours: { f: 'fire', F: 'fireHi' },
  },
  scales: { rows: ['....d....', 'ddddddddd', '.d..d..d.', 'd.d.d.d.d', 'ddd.d.ddd', '....d....', '....d....', '..ddddd..', '.........'] },
  crown: {
    rows: ['.........', 'd...d...d', 'dd.ddd.dd', 'ddddddddd', 'drddbddrd', 'ddddddddd', '.........', '.........', '.........'],
    colours: { r: 'banner', b: 'blue' },
  },
} as const satisfies Record<string, Emblem>;

/** A medal: a ribbon of three stripes, `shape` in `metal`, and its emblem. */
function medal(seed: string, shape: MedalShape, metal: Metal, stripes: readonly [Colour, Colour], emblem: Emblem): () => PixelCanvas {
  return () => {
    const c = canvas(seed);
    const [outer, inner] = stripes;
    // the ribbon, folded to a point behind the medal
    c.poly(
      [
        [10, 0],
        [22, 0],
        [22, 9],
        [16, 14],
        [10, 9],
      ],
      (x) => (x >= 14 && x <= 17 ? inner : outer),
    );
    rect(c, 10, 0, 21, 0, 'outline');
    const [cx, cy] = [16, 19];
    if (shape === MedalShape.STAR) {
      for (let a = 0; a < 8; a++) {
        const ang = (a * Math.PI) / 4;
        const tip: [number, number] = [cx + Math.cos(ang) * 12.5, cy + Math.sin(ang) * 12.5];
        const l = ang - Math.PI / 8;
        const r = ang + Math.PI / 8;
        c.poly(
          [[cx + Math.cos(l) * 7, cy + Math.sin(l) * 7], tip, [cx + Math.cos(r) * 7, cy + Math.sin(r) * 7], [cx, cy]],
          a >= 1 && a <= 4 ? metal.dark : metal.mid,
        );
      }
    } else if (shape === MedalShape.SCALLOPED) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) disc(c, cx + Math.cos(a) * 8.6, cy + Math.sin(a) * 8.6, 1.9, metal.mid, metal.dark);
    }
    const r = shape === MedalShape.STAR ? 7.5 : 8.5;
    disc(c, cx, cy, r, metal.dark);
    disc(c, cx - 0.4, cy - 0.4, r - 1.1, metal.mid);
    disc(c, cx - r * 0.35, cy - r * 0.35, r * 0.3, metal.hi);
    stamp(c, cx - 4, cy - 4, emblem.rows, { d: metal.engrave, ...emblem.colours });
    c.outline();
    if (shape === MedalShape.STAR) sparkle(c, 26, 12);
    return c;
  };
}

/** A medal's metal: its tones and the darker shade its emblem is engraved in. */
type Metal = Tone & { engrave: Colour };

const BRONZE_MEDAL: Metal = { ...BRONZE, engrave: 'barnEdge' };
const SILVER: Metal = { ...STEEL, engrave: 'slateD' };
const GOLD_MEDAL: Metal = { ...GOLD, engrave: 'bronzeDark' };

export const MEDAL_DRAWINGS = {
  cross: medal('cross-medal', MedalShape.ROUND, BRONZE_MEDAL, ['greenL', 'wool'], EMBLEMS.cross),
  rose: medal('rose-medal', MedalShape.ROUND, BRONZE_MEDAL, ['flower', 'wool'], EMBLEMS.rose),
  lion: medal('lion-medal', MedalShape.ROUND, BRONZE_MEDAL, ['gold', 'hoodDark'], EMBLEMS.lion),
  honour: medal('honour-medal', MedalShape.SCALLOPED, SILVER, ['blue', 'wool'], EMBLEMS.laurel),
  courage: medal('courage-medal', MedalShape.SCALLOPED, SILVER, ['banner', 'wool'], EMBLEMS.sword),
  wisdom: medal('wisdom-medal', MedalShape.SCALLOPED, SILVER, ['tealL', 'gold'], EMBLEMS.lamp),
  freedom: medal('freedom-medal', MedalShape.STAR, GOLD_MEDAL, ['greenL', 'gold'], EMBLEMS.torch),
  justice: medal('justice-medal', MedalShape.STAR, GOLD_MEDAL, ['blue', 'gold'], EMBLEMS.scales),
  nation: medal('nation-medal', MedalShape.STAR, GOLD_MEDAL, ['banner', 'gold'], EMBLEMS.crown),
};
