import type { BuildingBean } from '@marchlands/api-client';
import { TOWN_HALL_POSITION, TroopType, unlockedOuterSlots } from '@marchlands/core';

import { CITY_ART, VIEW_KEY } from '@/components/buildings-panel/constants';
import type { CityView } from '@/components/buildings-panel/types';
import type { TownState } from '@/components/iso-anim/types';

/** The city's Town Hall level and how many field slots outside the walls it unlocks. */
/**
 * The URL of a city view piece by file name (CITY_ART), or '' when there is none, which never loads, so the scene
 * draws nothing there. lib/game-art.test.ts checks every piece the scene asks for is there.
 */
export function cityArt(file: string): string {
  return CITY_ART[file] ?? '';
}

export function fieldSlots(buildings: BuildingBean[]): { townHall: number; unlocked: number } {
  const townHall = buildings.find((b) => b.positionId === TOWN_HALL_POSITION)?.level ?? 0;
  return { townHall, unlocked: unlockedOuterSlots(townHall) };
}

/** How this browser last chose to show the buildings: the isometric scene unless the cards were picked. */
export function readView(): CityView {
  try {
    return localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'scene';
  } catch {
    return 'scene';
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

/** How many people walk the town's streets: more as the city grows, from 2 to 16 (the square root keeps a big city calm). */
export function townWalkers(population: number): number {
  return Math.max(2, Math.min(16, Math.round(Math.sqrt(Math.max(0, population)) / 6)));
}

/** How many people work the fields: one for every two fields built, and at least one once any is, up to 10. */
export function fieldWorkers(builtFields: number): number {
  return builtFields > 0 ? Math.min(10, Math.ceil(builtFields / 2)) : 0;
}

/** Report titles a defender gets when its city is attacked, won or lost. */
const ATTACKED = new Set(['report.title.cityAttacked', 'report.title.attackRepelled']);

/** When the city at (x, y) was last attacked, from army reports (newest first or not), or null. */
function lastAttack(
  city: { x: number; y: number },
  reports: readonly { title: { code: string }; targetPos: { code: string; params?: Record<string, unknown> } | null; eventTime: number }[],
): number | null {
  const hits = reports.filter(
    (r) => ATTACKED.has(r.title.code) && r.targetPos?.code === 'world.position.city' && r.targetPos.params?.x === city.x && r.targetPos.params.y === city.y,
  );
  return hits.length ? Math.max(...hits.map((r) => r.eventTime)) : null;
}

/** A queue of a barracks or the walls: where it is, and its batches (running when started and not yet ended). */
interface Queue {
  positionId: number;
  allProduceQueue: readonly { type: number; startTime: number; endTime: number }[];
}

/**
 * What a city is doing, for the buildings that show it: which barracks are training and what (cavalry, siege engines),
 * whether research runs here and fortifications are being built, whether troops lie injured, and whether an enemy army
 * is coming or one of the city's own is away. Each list may still be loading (empty).
 */
export function townState(
  city: { id: number; fieldId: number; zoneId: number; x: number; y: number; injuredTroop: object },
  data: {
    troops?: readonly Queue[];
    forts?: readonly Queue[];
    techs?: readonly { upgrading?: boolean; castleId?: number | null }[];
    reports?: readonly { title: { code: string }; targetPos: { code: string; params?: Record<string, unknown> } | null; eventTime: number }[];
    enemy?: readonly { targetFieldId: number }[];
    own?: readonly { cityId?: number; startFieldId: number }[];
  },
): TownState {
  const running = (q: Queue) => q.allProduceQueue.filter((x) => x.startTime > 0 && x.endTime > 0);
  const training = (data.troops ?? []).filter((q) => running(q).length > 0);
  const types = training.flatMap((q) => running(q).map((x) => x.type));
  return {
    training: training.map((q) => q.positionId),
    cavalry: types.some((t) => t === TroopType.CAVALRY || t === TroopType.CATAPHRACT),
    siege: types.some((t) => t === TroopType.BALLISTA || t === TroopType.RAM || t === TroopType.CATAPULT),
    research: (data.techs ?? []).some((t) => t.upgrading && t.castleId === city.id),
    forts: (data.forts ?? []).some((q) => running(q).length > 0),
    injured: Object.values(city.injuredTroop).some((n) => typeof n === 'number' && n > 0),
    enemy: (data.enemy ?? []).some((a) => a.targetFieldId === city.fieldId),
    armyOut: (data.own ?? []).some((a) => a.cityId === city.id || a.startFieldId === city.fieldId),
    zoneId: city.zoneId,
    attackedAt: lastAttack(city, data.reports ?? []),
  };
}
