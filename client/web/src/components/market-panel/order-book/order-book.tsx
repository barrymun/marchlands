import { Bot } from 'lucide-react';
import type { MarketMerchant, MarketPriceLevel } from '@marchlands/api-client';
import { BALANCE } from '@marchlands/core';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtExact } from '@/lib/format';
import { cn } from '@/lib/utils';
import { fmtPrice, resLabel } from '@/components/market-panel/utils';
import type { Side } from '@/components/market-panel/types';

export function OrderBook({
  resType,
  buyers,
  sellers,
  merchant,
  onLevel,
  onMerchant,
}: {
  resType: number;
  buyers: MarketPriceLevel[];
  sellers: MarketPriceLevel[];
  merchant?: MarketMerchant;
  onLevel: (level: MarketPriceLevel, side: Side) => void;
  onMerchant: (merchantSells: boolean) => void;
}) {
  const row = (l: MarketPriceLevel, s: Side) => (
    <TableRow key={`${s}-${l.price}`} className="cursor-pointer" onClick={() => onLevel(l, s)}>
      <TableCell className={cn('tabular-nums', s === 1 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400')}>{fmtPrice(l.price)}</TableCell>
      <TableCell className="text-right tabular-nums">{fmtExact(l.amount)}</TableCell>
      <TableCell className="text-right text-xs text-muted-foreground">player</TableCell>
    </TableRow>
  );
  const merchantRow = (sells: boolean) =>
    merchant && (
      <TableRow key={sells ? 'm-ask' : 'm-bid'} className="cursor-pointer bg-amber-500/5" onClick={() => onMerchant(sells)}>
        <TableCell className={cn('tabular-nums font-medium', sells ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400')}>
          {fmtPrice(sells ? merchant.ask : merchant.bid)}
        </TableCell>
        <TableCell className="text-right text-muted-foreground">unlimited</TableCell>
        <TableCell className="text-right">
          <Badge variant="outline" className="gap-1 font-normal">
            <Bot className="size-3" /> merchant
          </Badge>
        </TableCell>
      </TableRow>
    );
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Order book · {resLabel(resType)}</CardTitle>
        <CardDescription>
          {BALANCE.merchant.fixedPrice != null ? (
            <>
              Gold per unit. The merchant always buys and sells any amount at a fixed {fmtPrice(BALANCE.merchant.fixedPrice)}, so you can always sell for at
              least that. Click a row to trade at it.
            </>
          ) : (
            <>
              Gold per unit. The merchant always trades; its price rises as people buy and falls as they sell, then drifts back to{' '}
              {merchant ? fmtPrice(merchant.base) : '…'}. Click a row to trade at it.
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Price</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">From</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {merchantRow(true)}
            {[...sellers].reverse().map((l) => row(l, 1))}
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableCell colSpan={3} className="text-center text-xs text-muted-foreground">
                sellers above · buyers below{merchant && ` · reference ${fmtPrice(merchant.reference)}`}
              </TableCell>
            </TableRow>
            {buyers.map((l) => row(l, 0))}
            {merchantRow(false)}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
