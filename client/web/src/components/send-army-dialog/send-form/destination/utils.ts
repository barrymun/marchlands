import { tileId, tileXY } from '@marchlands/core';

import { parseCoords } from '@/components/map-panel/go-to-coords/utils';
import { MAX_SUGGESTIONS } from '@/components/send-army-dialog/send-form/destination/constants';
import type { DestinationOption } from '@/components/send-army-dialog/send-form/destination/types';

/** Where an army from the city on `fromTileId` may often want to go: the player's other cities, then this city's farm targets. */
export function destinationOptions(
  cities: readonly { name: string; x: number; y: number; fieldId: number }[],
  farmTiles: readonly number[],
  fromTileId: number,
  mapSize: number,
): DestinationOption[] {
  const others = cities.filter((c) => c.fieldId !== fromTileId).map((c) => ({ tileId: c.fieldId, x: c.x, y: c.y, name: c.name }));
  const listed = new Set([fromTileId, ...others.map((c) => c.tileId)]);
  const farms = [...new Set(farmTiles)].filter((id) => !listed.has(id)).map((id) => ({ tileId: id, ...tileXY(id, mapSize) }));
  return [...others, ...farms];
}

/** The options a player's text fits, by name or coordinates, at most MAX_SUGGESTIONS; all of them for no text. */
export function matchOptions(options: readonly DestinationOption[], text: string): DestinationOption[] {
  const name = text.trim().toLowerCase();
  const coords = name
    .replace(/[()]/g, ' ')
    .trim()
    .replace(/[\s,]+/g, ',');
  return options.filter((o) => !name || o.name?.toLowerCase().includes(name) || (coords && `${o.x},${o.y}`.includes(coords))).slice(0, MAX_SUGGESTIONS);
}

/** The tile a player's text means: its coordinates, or an option named exactly that; null for anything else. */
export function resolveDestination(text: string, options: readonly DestinationOption[], mapSize: number): number | null {
  const at = parseCoords(text, mapSize);
  if (at) return tileId(at.x, at.y, mapSize);
  const name = text.trim().toLowerCase();
  return options.find((o) => o.name?.toLowerCase() === name)?.tileId ?? null;
}
