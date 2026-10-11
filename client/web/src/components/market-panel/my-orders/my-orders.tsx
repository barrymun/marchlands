import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { deleteMarketOrdersByOrderIdMutation, getCitiesByCityIdQueryKey, getMarketOrdersMineOptions } from '@marchlands/api-client';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCommand } from '@/hooks/use-game';
import { allMarketQueries, allOf } from '@/lib/query-keys';
import { fmtExact, dateTime } from '@/lib/format';
import { fmtPrice, resInline } from '@/components/market-panel/utils';

export function MyOrders() {
  const { t } = useTranslation(['market-panel', 'common']);
  const orders = useQuery(getMarketOrdersMineOptions());
  const cancel = useCommand(deleteMarketOrdersByOrderIdMutation(), () => [...allMarketQueries(), allOf(getCitiesByCityIdQueryKey)], t('myOrders.cancelled'));
  const list = orders.data ?? [];
  if (list.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          {t('myOrders.title')} <span className="font-normal text-muted-foreground">({list.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('columns.order')}</TableHead>
              <TableHead className="text-right">{t('columns.price')}</TableHead>
              <TableHead className="text-right">{t('columns.filled')}</TableHead>
              <TableHead className="text-right">{t('columns.placed')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((o) => (
              <TableRow key={o.id}>
                <TableCell>
                  <Badge variant={o.tradeType === 0 ? 'secondary' : 'outline'}>{o.tradeType === 0 ? t('side.buy') : t('side.sell')}</Badge>{' '}
                  {t('common:amountOf', { amount: fmtExact(o.amount), resource: resInline(o.resType) })}
                </TableCell>
                <TableCell className="text-right tabular-nums">{fmtPrice(o.price)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtExact(o.dealedTotal)} / {fmtExact(o.amount)}
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">{dateTime(o.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={t('myOrders.cancel')}
                    disabled={cancel.isPending}
                    onClick={() => cancel.mutate({ path: { orderId: o.id } })}
                  >
                    <X />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
