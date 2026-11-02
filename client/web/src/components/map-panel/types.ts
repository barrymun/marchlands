export type RelationGroup = 'friend' | 'enemy' | 'other';

/** One of the player's cities' farming list: the targets its flows' "Attack targets" actions list for it. */
export interface FarmList {
  cityId: number;
  cityName: string;
  /** the city the map is open for */
  here: boolean;
  /** each target once, with the flows that list it for this city */
  targets: { tileId: number; flows: string[] }[];
}

/** A tile in any farming list: whether this city farms it, and every city that does. */
export interface FarmMark {
  here: boolean;
  cities: string[];
}
