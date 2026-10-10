import type { ItemInfo } from '@marchlands/core';

/** Items with the same name and effect are shown as one entry. */
export interface Entry {
  info: ItemInfo;
  ids: string[];
  owned: number;
}
