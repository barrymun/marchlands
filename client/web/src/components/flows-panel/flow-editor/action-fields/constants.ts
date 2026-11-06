import { HeroBuffId } from '@marchlands/core';
import type { Stat } from '@/components/flows-panel/flow-editor/action-fields/types';

/** The attributes "set mayor" can pick by, in the order the editor lists them. */
export const FLOW_STATS: readonly Stat[] = [HeroBuffId.POWER, HeroBuffId.MANAGEMENT, HeroBuffId.STRATAGEM];
