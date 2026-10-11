import type { BuffId } from '@marchlands/core';
import type { AnyMessage } from '@/lib/messages';

export interface Buff {
  id: BuffId;
  /** what the buff does (`buff.*`) */
  desc: AnyMessage;
  endTime: number;
  itemId?: string;
}

export interface Slot {
  buff: BuffId;
  label: string;
  boost: string;
  /** false: the bonus cannot be extended (the Truce has a cooldown) */
  extend?: boolean;
  /** items that give the bonus (default: every item whose effect is this buff) */
  items?: string[];
}

/** How the + button extends a bonus: use an owned item (the running one first), else buy one with the city's gold. */
export type Extension = { kind: 'use'; itemId: string; owned: number } | { kind: 'buy'; itemId: string; price: number } | null;
