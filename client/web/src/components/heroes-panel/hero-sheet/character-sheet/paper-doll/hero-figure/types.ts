import type { Sex } from '@marchlands/core';
import type { FigureHairColour, FigureHairStyle, FigureSkinTone } from '@/lib/game-art';

/** A hero's body: its sex, skin tone and hair. */
export interface FigureBody {
  sex: Sex;
  tone: FigureSkinTone;
  style: FigureHairStyle;
  hair: FigureHairColour;
}

/** How a layer moves: the cape stirs, the body breathes, the legs stand still. */
type FigureMotion = 'sway' | 'breath' | 'still';

/** A layer of the figure: its file, how it moves, and whether its stones glow. */
export interface FigureLayer {
  file: string;
  motion: FigureMotion;
  glows: boolean;
}

/** The canvas calls drawFigure makes (a CanvasRenderingContext2D does them all). */
export type FigureContext = Pick<CanvasRenderingContext2D, 'clearRect' | 'drawImage' | 'fillRect' | 'save' | 'restore'> & {
  fillStyle: CanvasRenderingContext2D['fillStyle'];
  globalCompositeOperation: CanvasRenderingContext2D['globalCompositeOperation'];
};
