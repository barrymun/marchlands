import type { CityBean } from '@marchlands/api-client';

/** What the chips need of one of the player's cities. */
export type ChipCity = Pick<CityBean, 'id' | 'name' | 'x' | 'y' | 'historicLevel'>;

/** A chip: a city, or several of the same name together (`cities`); `here` when the city in view is among them. */
export interface CityChipData {
  key: string;
  name: string;
  historicLevel: ChipCity['historicLevel'];
  here: boolean;
  cities: ChipCity[];
}
