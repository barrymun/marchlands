import { CircleCheck, CircleX } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { Flow } from '@marchlands/api-client';

import { CitiesSummary } from '@/components/flows-panel/cities-summary/cities-summary';
import { StatusBadge } from '@/components/flows-panel/flow-list/status-badge/status-badge';
import { lastRunSummary } from '@/components/flows-panel/flow-list/utils';
import { ago } from '@/components/flows-panel/utils';
import { Card, CardContent } from '@/components/ui/card';
import { useNow } from '@/hooks/use-now';
import { GAIN_TEXT, LOSS_TEXT } from '@/lib/tones';
import { cn } from '@/lib/utils';

/** The player's flows, a row each: name and state, then its steps, cities and how its last run went, to scan without opening. */
export function FlowList({ flows, selectedId, onSelect }: { flows: Flow[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const { t } = useTranslation('flows-panel');
  const now = useNow(10_000);
  return (
    <Card className="self-start py-2">
      <CardContent className="grid gap-1 px-2">
        {flows.length === 0 && <p className="p-2 text-sm text-muted-foreground">{t('list.empty')}</p>}
        {flows.map((f) => {
          const last = lastRunSummary(f);
          const selected = f.id === selectedId;
          return (
            <button
              key={f.id}
              type="button"
              aria-current={selected}
              onClick={() => onSelect(f.id)}
              className={cn('grid gap-0.5 rounded-md px-3 py-2 text-start text-sm hover:bg-muted/50', selected && 'bg-muted ring-1 ring-border')}
            >
              <span className="flex items-center justify-between gap-2">
                <span className={cn('truncate', selected && 'font-medium')}>{f.name}</span>
                <StatusBadge flow={f} />
              </span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                <span>{t('list.actions', { count: f.actions.length })}</span>
                <span aria-hidden>·</span>
                <CitiesSummary targets={f.cities} />
                <span aria-hidden>·</span>
                {last ? (
                  <span className="flex items-center gap-1">
                    {last.ok ? <CircleCheck className={cn('size-3', GAIN_TEXT)} aria-hidden /> : <CircleX className={cn('size-3', LOSS_TEXT)} aria-hidden />}
                    {last.ok
                      ? t('list.lastRun', { run: last.run, ago: ago(now, last.at) })
                      : t('list.lastRunFailed', { run: last.run, ago: ago(now, last.at) })}
                  </span>
                ) : (
                  <span>{t('list.neverRun')}</span>
                )}
              </span>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
