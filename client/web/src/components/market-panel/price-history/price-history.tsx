import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { api, unwrap } from '@/lib/api';
import { fmtExact } from '@/lib/format';
import { cn } from '@/lib/utils';
import { mk } from '@/components/market-panel/constants';
import { fmtPrice, resLabel } from '@/components/market-panel/utils';
import { chartConfig } from '@/components/market-panel/price-history/constants';

export function PriceHistory({ resType }: { resType: number }) {
  const history = useQuery({
    queryKey: mk.history(resType),
    refetchInterval: 10_000,
    placeholderData: keepPreviousData,
    queryFn: () => unwrap(api.GET('/api/v1/market/{resType}/history', { params: { path: { resType } } })),
  });
  const h = history.data;
  const data = (h?.candles ?? []).map((c) => ({ ...c, label: new Date(c.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }));
  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Price · {resLabel(resType)}</CardTitle>
          <CardDescription>Closing price of each game hour (last 24).</CardDescription>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No trades yet.</p>
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
          <CardTitle className="text-sm">Recent trades</CardTitle>
        </CardHeader>
        <CardContent className="max-h-64 overflow-y-auto">
          {(h?.trades ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet.</p>
          ) : (
            <Table>
              <TableBody>
                {h!.trades.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className={cn('tabular-nums', t.takerSide === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')}>
                      {fmtPrice(t.price)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtExact(t.amount)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{t.merchant ? 'merchant' : 'players'}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleTimeString()}</TableCell>
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
