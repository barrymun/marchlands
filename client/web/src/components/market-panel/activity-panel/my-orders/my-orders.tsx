import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { deleteMarketOrdersByOrderIdMutation, getCitiesByCityIdQueryKey, getMarketOrdersMineOptions } from '@marchlands/api-client';

import { useShortList } from '@/components/market-panel/hooks';
import { ShowMore } from '@/components/market-panel/show-more/show-more';
import { fmtPrice, resInline } from '@/components/market-panel/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCommand } from '@/hooks/use-game';
import { dateTime, fmtExact } from '@/lib/format';
import { allMarketQueries, allOf } from '@/lib/query-keys';

/** The player's orders waiting on the book, in every city, each with a cancel button. */
export function MyOrders() {
  const { t } = useTranslation(['market-panel', 'common']);
  const orders = useQuery(getMarketOrdersMineOptions());
  const cancel = useCommand(deleteMarketOrdersByOrderIdMutation(), () => [...allMarketQueries(), allOf(getCitiesByCityIdQueryKey)], t('myOrders.cancelled'));
  const all = orders.data ?? [];
  const list = useShortList(all);
  if (all.length === 0) return <p className="p-3 text-xs text-muted-foreground">{t('myOrders.none')}</p>;
  return (
    <>
      <Table className="text-xs">
        <TableHeader>
          <TableRow>
            <TableHead>{t('columns.order')}</TableHead>
            <TableHead className="text-end">{t('columns.price')}</TableHead>
            <TableHead className="text-end">{t('columns.filled')}</TableHead>
            <TableHead className="text-end">{t('columns.placed')}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.shown.map((o) => (
            <TableRow key={o.id}>
              <TableCell>
                <Badge variant={o.tradeType === 0 ? 'secondary' : 'outline'}>{o.tradeType === 0 ? t('side.buy') : t('side.sell')}</Badge>{' '}
                {t('common:amountOf', { amount: fmtExact(o.amount), resource: resInline(o.resType) })}
              </TableCell>
              <TableCell className="text-end tabular-nums">{fmtPrice(o.price)}</TableCell>
              <TableCell className="text-end tabular-nums">
                {fmtExact(o.dealedTotal)} / {fmtExact(o.amount)}
              </TableCell>
              <TableCell className="text-end text-xs text-muted-foreground">{dateTime(o.createdAt)}</TableCell>
              <TableCell className="text-end">
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
      <ShowMore hidden={list.hidden} onMore={list.showAll} />
    </>
  );
}
