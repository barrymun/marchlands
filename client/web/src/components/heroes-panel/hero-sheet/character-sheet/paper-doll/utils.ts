import { FIGURE_KEY, FigureMode } from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/constants';

/** How this browser last chose to draw the figure: 3D unless 2D was picked. */
export function figureMode(): FigureMode {
  try {
    return localStorage.getItem(FIGURE_KEY) === FigureMode.TWO_D ? FigureMode.TWO_D : FigureMode.THREE_D;
  } catch {
    return FigureMode.THREE_D;
  }
}

/** Remember the chosen way to draw the figure; without storage it lasts until the page reloads. */
export function saveFigureMode(mode: FigureMode) {
  try {
    localStorage.setItem(FIGURE_KEY, mode);
  } catch {
    /* storage unavailable */
  }
}

/** Whether this browser can draw WebGL 2 at all, tried on a canvas of its own (none: the 2D figure only). */
export function webglWorks(): boolean {
  try {
    return document.createElement('canvas').getContext('webgl2') !== null;
  } catch {
    return false;
  }
}
