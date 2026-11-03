import { ChevronDown, ChevronUp, SkipForward } from 'lucide-react';
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { FlowRunReport } from '@marchlands/api-client';

import { CitySteps } from '@/components/flows-panel/flow-detail/run-report/city-steps/city-steps';
import { citySummary } from '@/components/flows-panel/flow-detail/run-report/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { translateMessage } from '@/lib/messages';
import { WARN_TEXT } from '@/lib/tones';
import { cn } from '@/lib/utils';

/**
 * A run (or preview) as a table: a row a city, its result and what it did in one line (the failure, if any), opening to
 * every step; then the cities skipped and why.
 */
export function RunReport({
  title,
  preview,
  cities,
  skipped = [],
}: {
  title: string;
  preview: boolean;
  cities: FlowRunReport['cities'];
  skipped?: FlowRunReport['skippedCities'];
}) {
  const { t } = useTranslation(['flows-panel', 'common']);
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set());
  const toggle = (id: number) => setOpen((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])));
  return (
    <div className="grid gap-2">
      <div className="text-sm font-medium">{title}</div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('runFlow.report.city')}</TableHead>
            <TableHead>{t('runFlow.report.result')}</TableHead>
            <TableHead className="w-full">{t('runFlow.report.what')}</TableHead>
            <TableHead>
              <span className="sr-only">{t('runFlow.report.details')}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cities.map((c) => {
            const { failed, details } = citySummary(c.steps);
            const shown = open.has(c.cityId);
            return (
              <Fragment key={c.cityId}>
                <TableRow className={cn(!c.ok && 'bg-destructive/5')}>
                  <TableCell className="font-medium whitespace-nowrap">{c.cityName}</TableCell>
                  <TableCell>
                    <Badge variant={c.ok ? 'secondary' : 'destructive'}>
                      {c.ok ? (preview ? t('runFlow.report.wouldRun') : t('runFlow.report.ok')) : t('runFlow.report.rolledBack')}
                    </Badge>
                  </TableCell>
                  <TableCell className={cn('max-w-0 truncate text-xs', failed ? 'text-destructive' : 'text-muted-foreground')}>
                    {failed ? translateMessage(failed.detail) : details.map((d) => translateMessage(d)).join(' · ')}
                  </TableCell>
                  <TableCell>
                    <Button size="icon-xs" variant="ghost" aria-expanded={shown} aria-label={t('runFlow.report.details')} onClick={() => toggle(c.cityId)}>
                      {shown ? <ChevronUp /> : <ChevronDown />}
                    </Button>
                  </TableCell>
                </TableRow>
                {shown && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={4} className="whitespace-normal">
                      <CitySteps city={c} />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
          {skipped.map((c) => (
            <TableRow key={c.cityId} className="text-muted-foreground">
              <TableCell className="whitespace-nowrap">{c.cityName}</TableCell>
              <TableCell>
                <Badge variant="outline">{preview ? t('runFlow.report.wouldSkip') : t('runFlow.report.skipped')}</Badge>
              </TableCell>
              <TableCell colSpan={2} className={cn('max-w-0 truncate text-xs', WARN_TEXT)}>
                <SkipForward className="me-1 inline size-3" aria-hidden />
                {translateMessage(c.reason)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
