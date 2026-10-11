import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getMarketByResTypeOptions, type CityBean, type MarketPriceLevel } from '@marchlands/api-client';
import { BuildingType } from '@marchlands/core';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RESOURCES } from '@/components/market-panel/constants';
import type { Mode, Side } from '@/components/market-panel/types';
import { OrderBook } from '@/components/market-panel/order-book/order-book';
import { TradeForm } from '@/components/market-panel/trade-form/trade-form';
import { PriceHistory } from '@/components/market-panel/price-history/price-history';
import { MyOrders } from '@/components/market-panel/my-orders/my-orders';
import { Shipments } from '@/components/market-panel/shipments/shipments';

export function MarketPanel({ city }: { city: CityBean }) {
  const { t } = useTranslation('market-panel');
  const market = city.buildings.filter((b) => b.typeId === BuildingType.MARKETPLACE).reduce((m, b) => Math.max(m, b.level), 0);
  const [resType, setResType] = useState(0);
  const [side, setSide] = useState<Side>(0);
  const [mode, setMode] = useState<Mode>('market');
  const [price, setPrice] = useState('');
  const book = useQuery({
    ...getMarketByResTypeOptions({ path: { resType } }),
    refetchInterval: 5_000,
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
  };
  const pickMerchant = (merchantSells: boolean) => {
    setSide(merchantSells ? 0 : 1);
    setMode('market');
  };

  return (
    <div className="grid gap-4">
      <Tabs value={String(resType)} onValueChange={(v) => setResType(Number(v))}>
        <TabsList>
          {RESOURCES.map((r) => (
            <TabsTrigger key={r.type} value={String(r.type)}>
              {r.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="grid gap-4 lg:grid-cols-2">
        <OrderBook
          resType={resType}
          buyers={book.data?.buyers ?? []}
          sellers={book.data?.sellers ?? []}
          merchant={book.data?.merchant}
          onLevel={pickLevel}
          onMerchant={pickMerchant}
        />
        <TradeForm
          key={resType}
          city={city}
          market={market}
          resType={resType}
          merchant={book.data?.merchant}
          side={side}
          setSide={setSide}
          mode={mode}
          setMode={setMode}
          price={price}
          setPrice={setPrice}
        />
        <PriceHistory resType={resType} />
      </div>
      <MyOrders />
      <Shipments />
    </div>
  );
}
