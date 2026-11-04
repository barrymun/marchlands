import { CircleCheck, CircleX } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { Flow } from '@marchlands/api-client';

import { ActiveDot } from '@/components/flows-panel/active-dot/active-dot';
import { CityChips } from '@/components/flows-panel/city-chips/city-chips';
import { MAX_ROW_CHIPS } from '@/components/flows-panel/flow-list/constants';
import { StatusBadge } from '@/components/flows-panel/flow-list/status-badge/status-badge';
import { lastRunSummary } from '@/components/flows-panel/flow-list/utils';
import { ago, isActive } from '@/components/flows-panel/utils';
import { Card, CardContent } from '@/components/ui/card';
import { useNow } from '@/hooks/use-now';
import { GAIN_TEXT, LIVE_EDGE, LOSS_TEXT } from '@/lib/tones';
import { cn } from '@/lib/utils';

/** The player's flows, a row each, an active one marked with a green dot and edge: name and state, its cities, then its steps and how its last run went, to scan without opening. */
export function FlowList({
  flows,
  selectedId,
  currentCityId,
  onSelect,
}: {
  flows: Flow[];
  selectedId: string | null;
  currentCityId: number;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation('flows-panel');
  const now = useNow(10_000);
  return (
    <Card className="self-start py-2">
      <CardContent className="grid gap-1 px-2">
        {flows.length === 0 && <p className="p-2 text-sm text-muted-foreground">{t('list.empty')}</p>}
        {flows.map((f) => {
          const last = lastRunSummary(f);
          const selected = f.id === selectedId;
          const active = isActive(f);
          return (
            <button
              key={f.id}
              type="button"
              aria-current={selected}
              onClick={() => onSelect(f.id)}
              className={cn(
                'grid gap-1 rounded-md border-s-2 border-s-transparent px-3 py-2 text-start text-sm hover:bg-muted/50',
                selected && 'bg-muted ring-1 ring-border',
                active && LIVE_EDGE,
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  {active && <ActiveDot />}
                  <span className={cn('truncate', selected && 'font-medium')}>{f.name}</span>
                </span>
                <StatusBadge flow={f} />
              </span>
              <CityChips targets={f.cities} currentCityId={currentCityId} max={MAX_ROW_CHIPS} />
              <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                <span>{t('list.actions', { count: f.actions.length })}</span>
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
