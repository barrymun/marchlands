import type { Counters } from '@/components/stats-panel/types';

export const sumPrefix = (c: Counters, prefix: string) => Object.entries(c).reduce((s, [k, v]) => (k.startsWith(prefix) ? s + v : s), 0);
