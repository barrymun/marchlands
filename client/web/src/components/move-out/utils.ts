import type { ArmyBean, CityBean } from '@marchlands/api-client';
import { ArmyDirection, buildingLevel, BuildingType, HeroStatus, Mission, splitCounts } from '@marchlands/core';
import type { HeroChoices, MoveOutShare } from '@/components/move-out/types';

/** The cities a city can move out to: the player's others, none being abandoned. The server has the last word. */
export const destinations = <T extends Pick<CityBean, 'id' | 'abandonAt'>>(castles: readonly T[], cityId: number): T[] =>
  castles.filter((c) => c.id !== cityId && !c.abandonAt);

/** A city added to the choice, or taken off it: the first chosen, who gets what's left over, stays first. */
export const toggled = (chosen: readonly number[], id: number): number[] => (chosen.includes(id) ? chosen.filter((c) => c !== id) : [...chosen, id]);

/** What's in a city to move out, as shares of whole units for this many cities, the first getting what's left over (moveOutCity). */
export function moveOutShares(city: Pick<CityBean, 'troop' | 'injuredTroop' | 'resource'>, parts: number): MoveOutShare[] {
  const { gold, food, wood, stone, iron } = city.resource;
  const count = (counts: Record<string, number>) => Object.values(counts).reduce((sum, n) => sum + n, 0);
  const troops = splitCounts(city.troop, parts);
  const injured = splitCounts(city.injuredTroop, parts);
  const goods = splitCounts({ gold, food: food.amount, wood: wood.amount, stone: stone.amount, iron: iron.amount }, parts);
  return goods.map((share, i) => ({
    troops: count(troops[i] ?? {}),
    injured: count(injured[i] ?? {}),
    goods: Math.floor(count(share)),
  }));
}

/** Whether there's anything to move, a fraction of a resource not counting. */
export const hasAnything = (shares: readonly MoveOutShare[]) => shares.some((s) => s.troops > 0 || s.injured > 0 || s.goods > 0);

/** Whether an enemy attack is on its way to the tile (the server refuses it then too), scouts not counting. */
export const attackOnTheWay = (enemy: readonly Pick<ArmyBean, 'targetFieldId' | 'direction' | 'missionType'>[] | undefined, fieldId: number) =>
  (enemy ?? []).some((a) => a.targetFieldId === fieldId && a.direction === ArmyDirection.FORWARD && a.missionType === Mission.ATTACK);

/** The heroes that can move out: those at home and the mayor, not one out with an army. */
export const movableHeroes = <T extends { status: number }>(heroes: readonly T[]): T[] =>
  heroes.filter((h) => h.status === HeroStatus.IDLE || h.status === HeroStatus.MAYOR);

/** The slots a city's Feasting Hall has free. */
export const freeSlots = (city: Pick<CityBean, 'buildings' | 'heros'>) =>
  Math.max(0, buildingLevel(city.buildings, BuildingType.FEASTING_HALL) - city.heros.length);

/** The slots a city has left for this hero, the other heroes chosen for it taken off. */
export function slotsLeftFor(city: Pick<CityBean, 'id' | 'buildings' | 'heros'>, choices: HeroChoices, heroId: number) {
  const taken = Object.entries(choices).filter(([hero, cityId]) => cityId === city.id && Number(hero) !== heroId).length;
  return Math.max(0, freeSlots(city) - taken);
}

/** The choices as the server takes them. */
export const heroMoves = (choices: HeroChoices) => Object.entries(choices).map(([heroId, cityId]) => ({ heroId: Number(heroId), cityId }));
