import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';

import { getMarketHistoryOptions } from '@marchlands/api-client';

import { chartConfig } from '@/components/market-panel/price-history/constants';
import { fmtPrice, resLabel } from '@/components/market-panel/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { clockTime, fmtExact } from '@/lib/format';
import { cn } from '@/lib/utils';

export function PriceHistory({ resType }: { resType: number }) {
  const { t } = useTranslation(['market-panel', 'common']);
  const history = useQuery({
    ...getMarketHistoryOptions({ path: { resType } }),
    refetchInterval: 10_000,
    placeholderData: keepPreviousData,
  });
  const h = history.data;
  const data = (h?.candles ?? []).map((c) => ({ ...c, label: clockTime(c.t, true) }));
  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t('priceHistory.title', { resource: resLabel(resType) })}</CardTitle>
          <CardDescription>{t('priceHistory.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t('priceHistory.noTrades')}</p>
          ) : (
            <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
              <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis width={48} tickLine={false} axisLine={false} domain={['auto', 'auto']} tickFormatter={(v: number) => v.toFixed(2)} />
                <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmtPrice(Number(v))} />} />
                <Line dataKey="close" type="monotone" stroke="var(--color-close)" strokeWidth={2} dot={data.length < 3} isAnimationActive={false} />
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t('priceHistory.recentTrades')}</CardTitle>
        </CardHeader>
        <CardContent className="max-h-64 overflow-y-auto">
          {(h?.trades ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('common:noneYet')}</p>
          ) : (
            <Table>
              <TableBody>
                {h!.trades.map((tr) => (
                  <TableRow key={tr.id}>
                    <TableCell className={cn('tabular-nums', tr.takerSide === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')}>
                      {fmtPrice(tr.price)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtExact(tr.amount)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{tr.merchant ? t('priceHistory.merchant') : t('priceHistory.players')}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{clockTime(tr.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
