import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { getMarketTradesMineOptions } from '@marchlands/api-client';

import { RESOURCES } from '@/components/market-panel/constants';
import { useShortList } from '@/components/market-panel/hooks';
import { ShowMore } from '@/components/market-panel/show-more/show-more';
import { fmtPrice, resInline } from '@/components/market-panel/utils';
import { ResourceIcon } from '@/components/resource-icon/resource-icon';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { dateTime, fmt } from '@/lib/format';
import { GAIN_TEXT, LOSS_TEXT } from '@/lib/tones';
import { cn } from '@/lib/utils';

/** The player's latest trades in every resource, newest first: what they bought or sold, at what price, with whom. */
export function MyTrades() {
  const { t } = useTranslation(['market-panel', 'common']);
  const trades = useQuery(getMarketTradesMineOptions()).data ?? [];
  const list = useShortList(trades);
  if (trades.length === 0) return <p className="p-3 text-xs text-muted-foreground">{t('myTrades.none')}</p>;
  return (
    <>
      <Table className="text-xs">
        <TableHeader>
          <TableRow>
            <TableHead>{t('columns.order')}</TableHead>
            <TableHead className="text-end">{t('columns.price')}</TableHead>
            <TableHead className="text-end">{t('myTrades.gold')}</TableHead>
            <TableHead className="text-end">{t('myTrades.with')}</TableHead>
            <TableHead className="text-end">{t('columns.time')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.shown.map((tr) => {
            const bought = tr.side === 0;
            const key = RESOURCES[tr.resType]?.key;
            return (
              <TableRow key={tr.id}>
                <TableCell>
                  <span className="flex items-center gap-1.5">
                    <span className={cn('font-medium', bought ? GAIN_TEXT : LOSS_TEXT)}>{bought ? t('myTrades.bought') : t('myTrades.sold')}</span>
                    {key && <ResourceIcon resource={key} />}
                    {t('common:amountOf', { amount: fmt(tr.amount), resource: resInline(tr.resType) })}
                  </span>
                </TableCell>
                <TableCell className="text-end tabular-nums">{fmtPrice(tr.price)}</TableCell>
                <TableCell className="text-end tabular-nums">{fmt(tr.gold)}</TableCell>
                <TableCell className="text-end text-muted-foreground">{t(`myTrades.counterparty.${tr.with}`)}</TableCell>
                <TableCell className="text-end text-muted-foreground">{dateTime(tr.createdAt)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <ShowMore hidden={list.hidden} onMore={list.showAll} />
    </>
  );
}
