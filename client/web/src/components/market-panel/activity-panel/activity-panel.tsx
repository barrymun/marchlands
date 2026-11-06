import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getMarketOrdersMineOptions, getMarketShipmentsOptions, type MarketNpcTrade } from '@marchlands/api-client';

import { ActivityView } from '@/components/market-panel/activity-panel/constants';
import { FactionsTicker } from '@/components/market-panel/activity-panel/factions-ticker/factions-ticker';
import { MyOrders } from '@/components/market-panel/activity-panel/my-orders/my-orders';
import { MyTrades } from '@/components/market-panel/activity-panel/my-trades/my-trades';
import { Shipments } from '@/components/market-panel/activity-panel/shipments/shipments';
import { Panel } from '@/components/market-panel/panel/panel';
import { PanelTabs } from '@/components/market-panel/panel-tabs/panel-tabs';
import { useNow } from '@/hooks/use-now';

/** The terminal's bottom strip: the player's waiting orders, their latest trades, their goods in transit, and the factions' latest trades. */
export function ActivityPanel({ ticker, className }: { ticker: MarketNpcTrade[]; className?: string }) {
  const { t } = useTranslation('market-panel');
  const [view, setView] = useState<ActivityView>(ActivityView.ORDERS);
  const now = useNow();
  const orders = useQuery(getMarketOrdersMineOptions()).data?.length ?? 0;
  const shipments = (useQuery(getMarketShipmentsOptions()).data ?? []).filter((s) => s.endTime > now + 1000).length;
  const counted = (label: string, n: number) => (
    <>
      {label} <span className="font-normal text-muted-foreground tabular-nums">{n}</span>
    </>
  );
  return (
    <Panel
      className={className}
      header={
        <PanelTabs
          label={t('activity.views')}
          value={view}
          onChange={setView}
          tabs={[
            { id: ActivityView.ORDERS, label: counted(t('myOrders.title'), orders) },
            { id: ActivityView.TRADES, label: t('myTrades.title') },
            { id: ActivityView.SHIPMENTS, label: counted(t('shipments.title'), shipments) },
            { id: ActivityView.FACTIONS, label: t('ticker.title') },
          ]}
        />
      }
    >
      {view === ActivityView.ORDERS && <MyOrders />}
      {view === ActivityView.TRADES && <MyTrades />}
      {view === ActivityView.SHIPMENTS && <Shipments />}
      {view === ActivityView.FACTIONS && <FactionsTicker trades={ticker} />}
    </Panel>
  );
}
