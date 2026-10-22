import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
  type CityBean,
  getCitiesByCityIdQueryKey,
  getMarketOrdersMineOptions,
  getMarketQuoteOptions,
  type MarketMerchant,
  postCitiesMarketOrdersMutation,
} from '@marchlands/api-client';
import { BALANCE, merchantAffordable } from '@marchlands/core';

import { RESOURCES } from '@/components/market-panel/constants';
import type { Mode, Side } from '@/components/market-panel/types';
import { fmtPrice, resInline, resLabel } from '@/components/market-panel/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCommand } from '@/hooks/use-game';
import { fmtExact, percent } from '@/lib/format';
import { allMarketQueries } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

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
  const { t } = useTranslation(['market-panel', 'common']);
  const [amount, setAmount] = useState('');
  const res = RESOURCES[resType] ?? RESOURCES[0]; // the market page only offers its four types
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
  const word = resInline(resType);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{t('tradeForm.title', { resource: word })}</CardTitle>
        <CardDescription>{t('tradeForm.description', { fee: percent(BALANCE.marketFee, 1), level: market, open: openHere, cap })}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid grid-cols-2 gap-2">
          <Button variant={side === 0 ? 'default' : 'outline'} onClick={() => setSide(0)}>
            {t('side.buy')}
          </Button>
          <Button variant={side === 1 ? 'default' : 'outline'} onClick={() => setSide(1)}>
            {t('side.sell')}
          </Button>
        </div>
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="market">{t('tradeForm.instant')}</TabsTrigger>
            <TabsTrigger value="limit">{t('tradeForm.limit')}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className={cn('grid gap-3', mode === 'limit' && 'grid-cols-2')}>
          <div className="grid gap-1.5">
            <Label htmlFor="mk-amount">{t('tradeForm.amount')}</Label>
            <div className="flex gap-1">
              <Input id="mk-amount" inputMode="numeric" value={amount} placeholder="0" onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
              <Button size="sm" variant="ghost" disabled={maxQty < 1} onClick={() => setAmount(String(maxQty))}>
                {t('common:actions.max')}
              </Button>
            </div>
          </div>
          {mode === 'limit' && (
            <div className="grid gap-1.5">
              <Label htmlFor="mk-price">{side === 0 ? t('tradeForm.highestPrice') : t('tradeForm.lowestPrice')}</Label>
              <Input id="mk-price" inputMode="decimal" value={price} placeholder="0.000" onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))} />
            </div>
          )}
        </div>
        <div className="grid gap-1 rounded-md bg-muted/50 p-3 text-sm tabular-nums">
          {!q ? (
            <span className="text-muted-foreground">{mode === 'limit' ? t('tradeForm.enterAmountAndPrice') : t('tradeForm.enterAmount')}</span>
          ) : (
            <>
              {q.filled > 0 ? (
                <div className="flex justify-between gap-2">
                  <span>
                    {t(side === 0 ? 'tradeForm.buyNowQuote' : 'tradeForm.sellNowQuote', { amount: fmtExact(q.filled), price: fmtPrice(q.avgPrice ?? 0) })}
                  </span>
                  <span className="font-medium">{t(side === 0 ? 'tradeForm.goldSpent' : 'tradeForm.goldEarned', { gold: fmtExact(q.gold) })}</span>
                </div>
              ) : (
                <span className="text-muted-foreground">{t('tradeForm.nothingTrades')}</span>
              )}
              {q.filled > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {q.merchantFilled > 0 && t('tradeForm.withMerchant', { amount: fmtExact(q.merchantFilled) })}
                    {q.merchantFilled > 0 && q.playerFilled > 0 && ' · '}
                    {q.playerFilled > 0 && t('tradeForm.withPlayers', { amount: fmtExact(q.playerFilled) })}
                  </span>
                  {q.fee > 0 && <span>{t('tradeForm.inclFee', { fee: fmtExact(q.fee) })}</span>}
                </div>
              )}
              {q.rest > 0 && (
                <div className="flex justify-between text-xs">
                  <span>{t('tradeForm.waits', { amount: fmtExact(q.rest), price: fmtPrice(unit) })}</span>
                  <span>{t('tradeForm.holds', { amount: fmtExact(q.escrow), resource: side === 0 ? resInline(4) : word })}</span>
                </div>
              )}
              <div className={cn('flex justify-between text-xs', affordable ? 'text-muted-foreground' : 'text-destructive')}>
                <span>{t('tradeForm.available', { resource: resLabel(side === 0 ? 4 : resType) })}</span>
                <span>{fmtExact(have)}</span>
              </div>
            </>
          )}
        </div>
        {wouldRest && openHere >= cap && <p className="text-xs text-destructive">{t('tradeForm.limitReached')}</p>}
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
                      t(side === 0 ? 'tradeForm.bought' : 'tradeForm.sold', {
                        amount: fmtExact(r.filled),
                        resource: word,
                        gold: fmtExact(r.gold),
                        price: fmtPrice(r.avgPrice ?? 0),
                      }),
                    );
                  if (r.rest > 0) parts.push(t('tradeForm.waiting', { amount: fmtExact(r.rest) }));
                  toast.success(parts.join('; '));
                },
              },
            )
          }
        >
          {mode === 'market' ? t(side === 0 ? 'tradeForm.buyNow' : 'tradeForm.sellNow') : t(side === 0 ? 'tradeForm.placeBuy' : 'tradeForm.placeSell')}
        </Button>
      </CardContent>
    </Card>
  );
}
