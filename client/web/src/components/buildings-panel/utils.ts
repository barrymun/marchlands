import type { BuildingBean } from '@marchlands/api-client';
import { TOWN_HALL_POSITION, unlockedOuterSlots } from '@marchlands/core';

import { VIEW_KEY } from '@/components/buildings-panel/constants';
import type { CityView } from '@/components/buildings-panel/types';

/** The city's Town Hall level and how many field slots outside the walls it unlocks. */
export function fieldSlots(buildings: BuildingBean[]): { townHall: number; unlocked: number } {
  const townHall = buildings.find((b) => b.positionId === TOWN_HALL_POSITION)?.level ?? 0;
  return { townHall, unlocked: unlockedOuterSlots(townHall) };
}

/** The city view this browser last chose: the isometric town unless the grid was picked. */
export function readView(): CityView {
  try {
    return localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'town';
  } catch {
    return 'town';
  }
}

/** Remember the chosen city view; without storage it lasts until the page reloads. */
export function saveView(view: CityView) {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    /* storage unavailable */
  }
}
