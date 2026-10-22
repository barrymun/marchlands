import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type CityBean, getMarketByResTypeOptions, getMarketHistoryOptions, type MarketPriceLevel } from '@marchlands/api-client';
import { BuildingType } from '@marchlands/core';

import { ActivityPanel } from '@/components/market-panel/activity-panel/activity-panel';
import { BookPanel } from '@/components/market-panel/book-panel/book-panel';
import { ChartPanel } from '@/components/market-panel/chart-panel/chart-panel';
import { type RangeId, RANGES } from '@/components/market-panel/chart-panel/constants';
import { MarketBar } from '@/components/market-panel/market-bar/market-bar';
import { TradeBar } from '@/components/market-panel/trade-bar/trade-bar';
import { TradeForm } from '@/components/market-panel/trade-form/trade-form';
import type { Mode, Side } from '@/components/market-panel/types';
import { resInline } from '@/components/market-panel/utils';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useMediaQuery } from '@/hooks/use-media-query';

/**
 * The Market page as a trading terminal: a bar of every resource's price on top; the chart, the order book and the
 * trade form side by side; the player's orders and the factions' trades in a strip below. On a wide screen it fills the
 * viewport and each pane scrolls by itself (routes/game/game.tsx); narrower, the panes stack and grow to their content (the
 * longer lists show their first rows and a Show more), and only the page scrolls. On a
 * phone the trade form opens in a sheet from Buy and Sell kept at the bottom of the screen, or from the order book.
 */
export function MarketPanel({ city }: { city: CityBean }) {
  const { t } = useTranslation('market-panel');
  const market = city.buildings.filter((b) => b.typeId === BuildingType.MARKETPLACE).reduce((m, b) => Math.max(m, b.level), 0);
  const [resType, setResType] = useState(0);
  const [rangeId, setRangeId] = useState<RangeId>('hour');
  const [side, setSide] = useState<Side>(0);
  const [mode, setMode] = useState<Mode>('market');
  const [price, setPrice] = useState('');
  const wide = useMediaQuery('(min-width: 768px)');
  // a phone's trade sheet
  const [trading, setTrading] = useState(false);
  const book = useQuery({
    ...getMarketByResTypeOptions({ path: { resType } }),
    placeholderData: keepPreviousData,
  });
  const range = RANGES[rangeId];
  const history = useQuery({
    ...getMarketHistoryOptions({ path: { resType }, query: { period: range.period, limit: range.limit } }),
    placeholderData: keepPreviousData,
  });

  if (market < 1) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t('noMarketplace.title')}</CardTitle>
          <CardDescription>{t('noMarketplace.description')}</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  // clicking a level of the book prepares the opposite order at that price
  const pickLevel = (level: MarketPriceLevel, levelSide: Side) => {
    setSide(levelSide === 1 ? 0 : 1);
    setMode('limit');
    setPrice(String(level.price));
    setTrading(!wide);
  };
  // clicking the factions or the merchant prepares an instant order against them
  const pickInstant = (theySell: boolean) => {
    setSide(theySell ? 0 : 1);
    setMode('market');
    setTrading(!wide);
  };
  // the history's trades and ticker are of the resource shown (the previous one while the next loads)
  const shown = history.data?.resType === resType ? history.data : undefined;
  // the trade form's state lives here, so the column and a phone's sheet show the same order
  const trade = { city, market, resType, merchant: book.data?.merchant, side, setSide, mode, setMode, price, setPrice };

  return (
    <div className="flex flex-col gap-2 xl:h-full">
      <MarketBar resType={resType} onResType={setResType} />
      <div className="grid gap-2 md:grid-cols-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_17rem_19rem] xl:grid-rows-[minmax(0,1fr)_minmax(11rem,32%)]">
        <ChartPanel
          className="h-96 md:col-span-2 xl:col-span-1 xl:h-auto"
          resType={resType}
          rangeId={rangeId}
          onRange={setRangeId}
          history={history.data}
          book={book.data}
        />
        <BookPanel book={book.data} trades={shown?.trades ?? []} onLevel={pickLevel} onInstant={pickInstant} />
        {wide && <TradeForm key={resType} {...trade} className="xl:row-span-2" />}
        <ActivityPanel className="md:col-span-2" ticker={shown?.ticker ?? []} />
      </div>
      {!wide && (
        <>
          <TradeBar
            onTrade={(s) => {
              setSide(s);
              setTrading(true);
            }}
          />
          <Sheet open={trading} onOpenChange={setTrading}>
            <SheetContent side="bottom" className="max-h-[85svh] gap-0 overflow-y-auto p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>{t('tradeForm.title', { resource: resInline(resType) })}</SheetTitle>
                <SheetDescription>{t('tradeForm.sheetHint')}</SheetDescription>
              </SheetHeader>
              <TradeForm key={resType} {...trade} className="rounded-none border-0" onPlaced={() => setTrading(false)} />
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  );
}
