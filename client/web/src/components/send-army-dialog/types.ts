import type { TroopKey } from '@marchlands/core';

export interface SendTarget {
  tileId: number;
  name: string;
  missions: number[];
  /** mission selected when the dialog opens (default: the first of `missions`) */
  mission?: number;
  /** troop amounts filled in when the dialog opens */
  troops?: Partial<Record<TroopKey, string>>;
  /** what is at the target, for the scouting note */
  kind?: 'city' | 'npc' | 'valley';
}
