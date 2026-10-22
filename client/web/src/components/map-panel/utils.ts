import { Relation } from '@marchlands/core';

import { FACTION_TINT_KEY } from '@/components/map-panel/constants';
import type { RelationGroup } from '@/components/map-panel/types';
import { tileName } from '@/lib/game-data';

export const relationGroup = (r: number): RelationGroup =>
  r === Relation.ALLIANCE || r === Relation.ALLY ? 'friend' : r === Relation.ENEMY ? 'enemy' : 'other';

/** What a map tile is called: a city by its name, anything else (barbarian cities included) by its tile type. */
export const placeName = (t: { type: number; name?: string }): string => t.name || tileName(t.type);

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
