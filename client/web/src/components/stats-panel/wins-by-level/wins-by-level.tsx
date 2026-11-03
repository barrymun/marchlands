import { Castle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Section } from '@/components/stats-panel/section/section';
import type { Counters } from '@/components/stats-panel/types';
import { shareOf } from '@/components/stats-panel/utils';
import { winsByLevel } from '@/components/stats-panel/wins-by-level/utils';
import { fmt, fmtExact } from '@/lib/format';
import { HISTORIC_TONE } from '@/lib/tones';
import { cn } from '@/lib/utils';

/** Wins against barbarian cities and historic cities, a column a level, the historic ones in their flags' colours. */
export function WinsByLevel({ c }: { c: Counters }) {
  const { t } = useTranslation(['stats-panel', 'common']);
  const levels = winsByLevel(c);
  const most = Math.max(0, ...levels.map((l) => l.wins));
  return (
    <Section title={t('winsByLevel.title')} description={t('winsByLevel.description')}>
      {levels.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('common:noneYet')}</p>
      ) : (
        <ul className="flex gap-1.5">
          {levels.map(({ level, wins, historic }) => {
            const sentence = t(historic ? 'winsByLevel.historic' : 'winsByLevel.barbarian', { level, count: wins, n: fmtExact(wins) });
            return (
              <li key={level} className="flex min-w-0 flex-1 flex-col items-center gap-1 text-xs" title={sentence}>
                <span className="sr-only">{sentence}</span>
                <span className="flex h-32 w-full max-w-12 items-end border-b" aria-hidden>
                  <span
                    className={cn('w-full min-h-0.5 rounded-t-sm', historic ? HISTORIC_TONE[historic] : 'bg-foreground/60')}
                    style={{ height: `${shareOf(wins, most) * 100}%` }}
                  />
                </span>
                <span className="flex items-center gap-0.5 text-muted-foreground" aria-hidden>
                  {historic && <Castle className="size-3" />}
                  {t('common:level.short', { level })}
                </span>
                <span className="tabular-nums" aria-hidden>
                  {fmt(wins)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
