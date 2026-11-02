import { FLOW_MAX_HIRES, FLOW_MAX_WAIT_MINUTES, HERO_BASE_STAT_MAX } from '@marchlands/core';
import type { NumberRange } from '@/lib/ranges';
import { param, type SearchSchema } from '@/lib/search-state';

/** The page's place in the address (lib/search-state.ts): the flow selected. */
export const FLOWS_SEARCH = {
  flow: param.key(),
} satisfies SearchSchema;

/** The numbers each action takes (the server checks the same): its inputs show what is out of range, and Save waits for them. */
export const ACTION_RANGES = {
  waitMinutes: { min: 1, max: FLOW_MAX_WAIT_MINUTES },
  hireCount: { min: 1, max: FLOW_MAX_HIRES },
  hireMin: { min: 1, max: HERO_BASE_STAT_MAX },
  hireGold: { min: 1 },
  trainAmount: { min: 1 },
} as const satisfies Record<string, NumberRange>;
