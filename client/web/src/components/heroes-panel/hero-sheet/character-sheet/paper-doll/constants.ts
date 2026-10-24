import type { GearPieceId } from '@marchlands/core';
import { lazyComponent } from '@/lib/lazy';

/** The gear round the figure, top to bottom: on the sword's side (left of the picture) and on the shield's. */
export const DOLL_LEFT: readonly GearPieceId[] = ['head', 'shoulder', 'chest', 'gauntlets', 'weapon', 'legs', 'mount'];
export const DOLL_RIGHT: readonly GearPieceId[] = ['necklace', 'back', 'charm', 'ring', 'shield', 'belt', 'feet'];

/** localStorage key of the 2D · 3D switch (docs/features/hero-3d.md): the way this browser last chose to draw the figure. */
export const FIGURE_KEY = 'marchlands-hero-figure';

/** The ways to draw the figure, in the switch's order. */
export const FIGURE_MODES = ['2d', '3d'] as const;

/** The 3D figure, its code (three.js) a file of its own, loaded only when the figure is shown in 3D. */
export const HeroFigure3d = lazyComponent(() =>
  import('@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure-3d/hero-figure-3d').then((m) => m.HeroFigure3d),
);
