import { Medal } from 'lucide-react';
import { medalOdds } from '@marchlands/core';
import { medalName } from '@/components/map-panel/medal-odds/utils';

/** What winning an attack on this city can drop (core medalOdds; a lord's city counts its Town Hall level). */
export function MedalOdds({ level }: { level: number }) {
  const o = medalOdds(level);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const names = (r: readonly [number, number]) => (r[0] === r[1] ? medalName(r[0]) : `${medalName(r[0])}–${medalName(r[1])}`);
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
      <Medal className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
      <span>
        Win: {pct(o.chance)} chance of a {names(o.main)} medal
        {o.second > 0 && `; then ${pct(o.second)} of a second (${names(o.extra)})`}
        {o.third > 0 && ` and ${pct(o.third)} of a third`}.
      </span>
    </p>
  );
}
