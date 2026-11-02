import type { CityBean, Flow } from '@marchlands/api-client';
import { Relation, TileType } from '@marchlands/core';

import { FACTION_TINT_KEY } from '@/components/map-panel/constants';
import type { FarmList, FarmMark, RelationGroup } from '@/components/map-panel/types';
import { historicName, tileName } from '@/lib/game-data';

export const relationGroup = (r: number): RelationGroup =>
  r === Relation.ALLIANCE || r === Relation.ALLY ? 'friend' : r === Relation.ENEMY ? 'enemy' : 'other';

/**
 * What a map tile is called: a city by its name, a historic city of level 14 and up by its own (given its place),
 * anything else (barbarian cities and level 12 historic cities included) by its tile type.
 */
export const placeName = (t: { type: number; name?: string; x?: number; y?: number }): string =>
  t.name || (t.type === TileType.HISTORIC && t.x != null && t.y != null ? historicName(t.x, t.y) : null) || tileName(t.type);

/** Whether this browser last chose to tint the map by faction; off until it did. */
export function readFactionTint(): boolean {
  try {
    return localStorage.getItem(FACTION_TINT_KEY) === 'on';
  } catch {
    return false;
  }
}

/** Remember the faction tint; without storage it lasts until the page reloads. */
export function saveFactionTint(on: boolean) {
  try {
    localStorage.setItem(FACTION_TINT_KEY, on ? 'on' : 'off');
  } catch {
    /* storage unavailable */
  }
}

/**
 * The player's farming lists, a city at a time: the targets each flow's "Attack targets" action lists for it, this city
 * first, then the others in the order the player's cities come. Cities with no targets are left out, and a target
 * listed by several flows comes once, with every flow's name.
 */
export function farmLists(flows: readonly Pick<Flow, 'name' | 'actions'>[], cities: readonly Pick<CityBean, 'id' | 'name'>[], cityId: number): FarmList[] {
  const byCity = new Map<number, Map<number, string[]>>();
  for (const f of flows)
    for (const a of f.actions) {
      if (a.type !== 'attackTargets') continue;
      for (const [id, tiles] of Object.entries(a.targets)) {
        const targets = byCity.get(Number(id)) ?? new Map<number, string[]>();
        for (const tile of tiles) targets.set(tile, [...new Set([...(targets.get(tile) ?? []), f.name])]);
        byCity.set(Number(id), targets);
      }
    }
  const ordered = [...cities.filter((c) => c.id === cityId), ...cities.filter((c) => c.id !== cityId)];
  return ordered.flatMap((c) => {
    const targets = byCity.get(c.id);
    return targets?.size
      ? [{ cityId: c.id, cityName: c.name, here: c.id === cityId, targets: [...targets].map(([tileId, names]) => ({ tileId, flows: names })) }]
      : [];
  });
}

/** Every tile in the farming lists: whether this city farms it, and the cities that do, in the lists' order. */
export function farmedTiles(lists: readonly FarmList[]): Map<number, FarmMark> {
  const out = new Map<number, FarmMark>();
  for (const l of lists)
    for (const { tileId } of l.targets) {
      const mark = out.get(tileId) ?? { here: false, cities: [] };
      out.set(tileId, { here: mark.here || l.here, cities: [...mark.cities, l.cityName] });
    }
  return out;
}
