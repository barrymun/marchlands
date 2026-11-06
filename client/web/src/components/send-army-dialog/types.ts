import type { BattleTarget, TroopKey } from '@marchlands/core';

export interface SendTarget {
  tileId: number;
  name: string;
  missions: number[];
  /** mission selected when the dialog opens (default: the first of `missions`) */
  mission?: number;
  /** troop amounts filled in when the dialog opens */
  troops?: Partial<Record<TroopKey, string>>;
  /** what is at the target, for the scouting note */
  kind?: BattleTarget;
  /** the player's own city or valley: the sending city's Relief Station speeds the march there, as the server works it out */
  own?: boolean;
}

/**
 * Wave plans (camp times, docs/features/camp-times.md): the form adds a wave to this plan instead of sending an army.
 * Opened from the Plans panel, which picks the city.
 */
export interface PlanSlot {
  planId: number;
  /** the plan's landing second */
  landAt: number;
  /** the wave's place in the plan's order: it lands this many milliseconds into the second */
  position: number;
  /** what the city already has in the player's waves not yet sent, left out of what this wave may take */
  planned: { troops: Partial<Record<TroopKey, number>>; heroIds: number[] };
  /** the player's cities, to add the wave from another */
  cities: { id: number; name: string }[];
  onCity: (cityId: number) => void;
}
