import type { Rgb } from '@/components/iso-anim/types';

/** A pixel of the icon's movement: where on the 32×32 sprite, its colour and how opaque (0-255). */
export interface GearPixel {
  x: number;
  y: number;
  c: Rgb;
  a: number;
}

/**
 * A gear icon's movement at a moment, in three layers: `behind` the piece (the backdrop's stars, hidden where the piece
 * stands), on the `piece` (a glint crossing it, a blade's glow; only where the piece is drawn) and `over` both (stones
 * flaring and glowing).
 */
export interface GearFrame {
  behind: GearPixel[];
  piece: GearPixel[];
  over: GearPixel[];
}
