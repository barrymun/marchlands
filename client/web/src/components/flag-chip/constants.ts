import { FlagColour } from '@marchlands/core';

/** The background of each flag colour, each dark enough for the flag's white text. */
export const FLAG_COLOUR_CLASS: Record<FlagColour, string> = {
  [FlagColour.RED]: 'bg-red-700',
  [FlagColour.ORANGE]: 'bg-orange-700',
  [FlagColour.AMBER]: 'bg-amber-700',
  [FlagColour.GREEN]: 'bg-green-700',
  [FlagColour.TEAL]: 'bg-teal-700',
  [FlagColour.SKY]: 'bg-sky-700',
  [FlagColour.BLUE]: 'bg-blue-700',
  [FlagColour.INDIGO]: 'bg-indigo-700',
  [FlagColour.VIOLET]: 'bg-violet-700',
  [FlagColour.PINK]: 'bg-pink-700',
  [FlagColour.SLATE]: 'bg-slate-600',
  [FlagColour.BLACK]: 'bg-stone-950',
};
