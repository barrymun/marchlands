import { useDeferredValue, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getCitiesByCityIdQueryKey,
  getMarketOrdersMineOptions,
  getMarketQuoteOptions,
  postCitiesMarketOrdersMutation,
  type CityBean,
  type MarketMerchant,
} from '@marchlands/api-client';
import { BALANCE, merchantAffordable } from '@marchlands/core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCommand } from '@/hooks/use-game';
import { fmtExact } from '@/lib/format';
import { cn } from '@/lib/utils';
import { RESOURCES } from '@/components/market-panel/constants';
import { allMarketQueries } from '@/lib/query-keys';
import { fmtPrice } from '@/components/market-panel/utils';
import type { Mode, Side } from '@/components/market-panel/types';

export function TradeForm({
  city,
  market,
  resType,
  merchant,
  side,
  setSide,
  mode,
  setMode,
  price,
  setPrice,
}: {
  city: CityBean;
  market: number;
  resType: number;
  merchant?: MarketMerchant;
  side: Side;
  setSide: (s: Side) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  price: string;
  setPrice: (p: string) => void;
}) {
  const [amount, setAmount] = useState('');
  const res = RESOURCES[resType];
  const qty = Number(amount) || 0;
  const unit = Number(price) || 0;
  const ready = qty >= 1 && (mode === 'market' || unit >= 0.001);
  const deferred = useDeferredValue({ qty, unit, side, mode });
  const quote = useQuery({
    ...getMarketQuoteOptions({
      path: { resType },
      query: { side: deferred.side, amount: deferred.qty, type: deferred.mode, price: deferred.mode === 'limit' ? deferred.unit : undefined },
    }),
    enabled: ready,
    placeholderData: keepPreviousData,
    refetchInterval: 5_000,
  });
  const orders = useQuery(getMarketOrdersMineOptions());
  const place = useCommand(postCitiesMarketOrdersMutation(), () => [...allMarketQueries(), getCitiesByCityIdQueryKey({ path: { cityId: city.id } })]);

  const have = side === 0 ? city.resource.gold : city.resource[res.key].amount;
  const fee = 1 + BALANCE.marketFee;
  // instant buy: what the gold buys from the merchant (a lower bound: cheaper offers from lords only add to it)
  const maxQty =
    side === 1
      ? Math.floor(have)
      : mode === 'limit'
        ? unit > 0
          ? Math.floor(have / (unit * fee))
          : 0
        : merchant
          ? merchantAffordable(merchant.ask, have, fee)
          : 0;
  const cap = market * BALANCE.marketMaxOrdersPerLevel;
  const openHere = (orders.data ?? []).filter((o) => o.cityId === city.id).length;
  const q = quote.data && ready ? quote.data : undefined;
  const cost = q ? (side === 0 ? q.gold + q.escrow : q.filled + q.escrow) : 0;
  const affordable = cost <= have;
  const wouldRest = !!q && q.rest > 0;
  const valid = ready && !!q && affordable && (!wouldRest || openHere < cap) && (mode === 'limit' || q.filled > 0);
  const word = res.label.toLowerCase();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Trade {word}</CardTitle>
        <CardDescription>
          Trades settle instantly. {BALANCE.marketFee * 100}% fee on purchases. Marketplace Lv {market}: {openHere}/{cap} resting orders here.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid grid-cols-2 gap-2">
          <Button variant={side === 0 ? 'default' : 'outline'} onClick={() => setSide(0)}>
            Buy
          </Button>
          <Button variant={side === 1 ? 'default' : 'outline'} onClick={() => setSide(1)}>
            Sell
          </Button>
        </div>
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="market">Instant</TabsTrigger>
            <TabsTrigger value="limit">Set my price</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className={cn('grid gap-3', mode === 'limit' && 'grid-cols-2')}>
          <div className="grid gap-1.5">
            <Label htmlFor="mk-amount">Amount</Label>
            <div className="flex gap-1">
              <Input id="mk-amount" inputMode="numeric" value={amount} placeholder="0" onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
              <Button size="sm" variant="ghost" disabled={maxQty < 1} onClick={() => setAmount(String(maxQty))}>
                Max
              </Button>
            </div>
          </div>
          {mode === 'limit' && (
            <div className="grid gap-1.5">
              <Label htmlFor="mk-price">{side === 0 ? 'Highest price' : 'Lowest price'} (gold each)</Label>
              <Input id="mk-price" inputMode="decimal" value={price} placeholder="0.000" onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))} />
            </div>
          )}
        </div>
        <div className="grid gap-1 rounded-md bg-muted/50 p-3 text-sm tabular-nums">
          {!q ? (
            <span className="text-muted-foreground">Enter an amount{mode === 'limit' ? ' and a price' : ''} to see a quote.</span>
          ) : (
            <>
              {q.filled > 0 ? (
                <div className="flex justify-between gap-2">
                  <span>
                    {side === 0 ? 'Buy' : 'Sell'} {fmtExact(q.filled)} now · avg {fmtPrice(q.avgPrice ?? 0)}
                  </span>
                  <span className="font-medium">
                    {side === 0 ? '−' : '+'}
                    {fmtExact(q.gold)} gold
                  </span>
                </div>
              ) : (
                <span className="text-muted-foreground">Nothing trades at this price right now.</span>
              )}
              {q.filled > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {q.merchantFilled > 0 && `${fmtExact(q.merchantFilled)} with the merchant`}
                    {q.merchantFilled > 0 && q.playerFilled > 0 && ' · '}
                    {q.playerFilled > 0 && `${fmtExact(q.playerFilled)} with other players`}
                  </span>
                  {q.fee > 0 && <span>incl. fee {fmtExact(q.fee)}</span>}
                </div>
              )}
              {q.rest > 0 && (
                <div className="flex justify-between text-xs">
                  <span>
                    {fmtExact(q.rest)} waits on the book at {fmtPrice(unit)}
                  </span>
                  <span>
                    holds {fmtExact(q.escrow)} {side === 0 ? 'gold' : word}
                  </span>
                </div>
              )}
              <div className={cn('flex justify-between text-xs', affordable ? 'text-muted-foreground' : 'text-destructive')}>
                <span>{side === 0 ? 'Gold' : res.label} available</span>
                <span>{fmtExact(have)}</span>
              </div>
            </>
          )}
        </div>
        {wouldRest && openHere >= cap && <p className="text-xs text-destructive">Resting-order limit reached: upgrade the Marketplace or cancel an order.</p>}
        <Button
          disabled={!valid || place.isPending}
          onClick={() =>
            place.mutate(
              { path: { cityId: city.id }, body: { resType, side, amount: qty, type: mode, price: mode === 'limit' ? unit : undefined } },
              {
                onSuccess: (r) => {
                  setAmount('');
                  const parts = [];
                  if (r.filled > 0)
                    parts.push(
                      `${side === 0 ? 'Bought' : 'Sold'} ${fmtExact(r.filled)} ${word} for ${fmtExact(r.gold)} gold (avg ${fmtPrice(r.avgPrice ?? 0)})`,
                    );
                  if (r.rest > 0) parts.push(`${fmtExact(r.rest)} waiting on the book`);
                  toast.success(parts.join('; '));
                },
              },
            )
          }
        >
          {mode === 'market' ? `${side === 0 ? 'Buy' : 'Sell'} now` : `Place ${side === 0 ? 'buy' : 'sell'} order`}
        </Button>
      </CardContent>
    </Card>
  );
}
