import { medalId } from '@marchlands/core';
import { itemShortName } from '@/lib/game-data';

/** A medal level's short name ("Cross"), from the item's short name (data-items `<id>.short`). */
export const medalName = (level: number) => itemShortName(medalId(level));
