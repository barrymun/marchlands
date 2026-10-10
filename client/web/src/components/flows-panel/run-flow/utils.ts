import { duration } from '@/lib/format';

/** How long ago `t` was, for a report title: "just now" under a minute, else the largest unit ("5m ago", "2h ago"). */
export const ago = (now: number, t: number) => (now - t < 60_000 ? 'just now' : `${duration(now - t).split(' ')[0]} ago`);
