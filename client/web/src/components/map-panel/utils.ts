import { Relation } from '@marchlands/core';
import type { RelationGroup } from '@/components/map-panel/types';
import { tileName } from '@/lib/game-data';

export const relationGroup = (r: number): RelationGroup =>
  r === Relation.ALLIANCE || r === Relation.ALLY ? 'friend' : r === Relation.ENEMY ? 'enemy' : 'other';

/** What a map tile is called: a city by its name, anything else (barbarian cities included) by its tile type. */
export const placeName = (t: { type: number; name?: string }): string => t.name || tileName(t.type);
