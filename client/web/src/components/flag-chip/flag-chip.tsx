import type { FlagColour } from '@marchlands/core';
import { FLAG_COLOUR_CLASS } from '@/components/flag-chip/constants';
import { cn } from '@/lib/utils';

/** A player's flag: its text in white on its colour, as it stands over their castles on the map. */
export function FlagChip({ text, colour }: { text: string; colour: FlagColour }) {
  return <span className={cn('rounded-[3px] px-1 text-xs leading-5 font-bold tracking-wide text-white shadow-sm', FLAG_COLOUR_CLASS[colour])}>{text}</span>;
}
