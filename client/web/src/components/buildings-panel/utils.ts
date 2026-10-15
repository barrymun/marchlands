import type { BuildingBean } from '@marchlands/api-client';
import { TOWN_HALL_POSITION, unlockedOuterSlots } from '@marchlands/core';

/** The city's Town Hall level and how many field slots outside the walls it unlocks. */
export function fieldSlots(buildings: BuildingBean[]): { townHall: number; unlocked: number } {
  const townHall = buildings.find((b) => b.positionId === TOWN_HALL_POSITION)?.level ?? 0;
  return { townHall, unlocked: unlockedOuterSlots(townHall) };
}
