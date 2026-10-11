import { useTranslation } from 'react-i18next';
import { Medal } from 'lucide-react';
import { medalOdds } from '@marchlands/core';
import { percent } from '@/lib/format';
import { medalName } from '@/components/map-panel/medal-odds/utils';

/** What winning an attack on this city can drop (core medalOdds; a lord's city counts its Town Hall level). */
export function MedalOdds({ level }: { level: number }) {
  const { t } = useTranslation('map-panel');
  const o = medalOdds(level);
  const names = (r: readonly [number, number]) => (r[0] === r[1] ? medalName(r[0]) : `${medalName(r[0])}–${medalName(r[1])}`);
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
      <Medal className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
      <span>
        {t(o.third > 0 ? 'medalOdds.three' : o.second > 0 ? 'medalOdds.two' : 'medalOdds.one', {
          chance: percent(o.chance),
          medal: names(o.main),
          second: percent(o.second),
          medals: names(o.extra),
          third: percent(o.third),
        })}
      </span>
    </p>
  );
}
