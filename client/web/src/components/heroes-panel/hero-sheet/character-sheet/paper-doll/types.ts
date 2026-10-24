import type { FIGURE_MODES } from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/constants';

/** How the figure is drawn: the 2D pixel-art layers or the 3D model (docs/features/hero-3d.md). */
export type FigureMode = (typeof FIGURE_MODES)[number];
