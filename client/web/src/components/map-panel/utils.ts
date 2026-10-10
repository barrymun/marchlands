import { Relation } from '@marchlands/core';
import type { RelationGroup } from '@/components/map-panel/types';

export const relationGroup = (r: number): RelationGroup =>
  r === Relation.ALLIANCE || r === Relation.ALLY ? 'friend' : r === Relation.ENEMY ? 'enemy' : 'other';
