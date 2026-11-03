import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Sparkline } from '@/components/stats-panel/headline/stat-tile/sparkline/sparkline';
import { dayMoment } from '@/components/stats-panel/headline/stat-tile/sparkline/utils';
import { fmt, fmtExact, shortDate } from '@/lib/format';

/**
 * A headline number: what it counts, the number (exact in its title), a line about it and, given `trend`, the number
 * day by day; pointing at a day shows that day's value in place of the line about it.
 */
export function StatTile({ label, value, sub, trend }: { label: string; value: number; sub?: ReactNode; trend?: { days: string[]; values: number[] } }) {
  const { t } = useTranslation('stats-panel');
  const [picked, setPicked] = useState<number | null>(null);
  const day = picked == null ? undefined : trend?.days[picked];
  const dayValue = picked == null ? undefined : trend?.values[picked];
  return (
    <div className="grid min-w-0 gap-0.5 rounded-xl border bg-card p-3 text-card-foreground">
      <div className="truncate text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums" title={fmtExact(value)}>
        {fmt(value)}
      </div>
      <div className="truncate text-xs text-muted-foreground tabular-nums">
        {day != null && dayValue != null ? t('headline.onDay', { date: shortDate(dayMoment(day)), value: fmtExact(dayValue) }) : (sub ?? ' ')}
      </div>
      {trend && trend.values.length > 1 && <Sparkline values={trend.values} picked={picked} onPick={setPicked} />}
    </div>
  );
}
