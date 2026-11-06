import { useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import type { MarketHistory, MarketOrderBook } from '@marchlands/api-client';
import { CANDLE_PERIOD_MS } from '@marchlands/core';

import { CandleChart } from '@/components/market-panel/chart-panel/candle-chart/candle-chart';
import { ChartView, RANGE_IDS, type RangeId, RANGES } from '@/components/market-panel/chart-panel/constants';
import { DepthChart } from '@/components/market-panel/chart-panel/depth-chart/depth-chart';
import { chartData } from '@/components/market-panel/chart-panel/utils';
import { NO_LEVELS } from '@/components/market-panel/constants';
import { Panel } from '@/components/market-panel/panel/panel';
import { PanelTabs } from '@/components/market-panel/panel-tabs/panel-tabs';
import { useNow } from '@/hooks/use-now';

/**
 * The terminal's main pane: the price as candles over an hour to a month, or the book's depth, both drawn with
 * TradingView Lightweight Charts (credited below them, as its licence asks).
 */
export function ChartPanel({
  resType,
  rangeId,
  onRange,
  history,
  book,
  className,
}: {
  resType: number;
  rangeId: RangeId;
  onRange: (range: RangeId) => void;
  /** the chosen resource's history at the chosen range (the previous one while it loads) */
  history?: MarketHistory;
  book?: MarketOrderBook;
  className?: string;
}) {
  const { t } = useTranslation('market-panel');
  const [view, setView] = useState<ChartView>(ChartView.PRICE);
  const range = RANGES[rangeId];
  const now = useNow(10_000);
  const h = history;
  // until the new range or resource loads, the previous one stays on screen: fit the chart once it's in
  const loaded = h?.resType === resType && h.period === range.period;
  const bucketMs = h?.bucketMs ?? CANDLE_PERIOD_MS[range.period];
  const data = useMemo(() => chartData(h?.candles ?? [], bucketMs, now - range.limit * bucketMs, now), [h, bucketMs, now, range.limit]);
  return (
    <Panel
      className={className}
      bodyClassName="flex flex-col overflow-hidden xl:overflow-hidden"
      header={
        <>
          <PanelTabs
            label={t('chart.views')}
            value={view}
            onChange={setView}
            tabs={[
              { id: ChartView.PRICE, label: t('chart.price') },
              { id: ChartView.DEPTH, label: t('chart.depth') },
            ]}
          />
          {view === ChartView.PRICE && (
            <PanelTabs
              label={t('chart.ranges')}
              value={rangeId}
              onChange={onRange}
              tabs={RANGE_IDS.map((id) => ({ id, label: t(`priceHistory.ranges.${id}`) }))}
            />
          )}
        </>
      }
    >
      {view === ChartView.PRICE ? (
        <CandleChart
          className="min-h-0 flex-1"
          prices={data.prices}
          volumes={data.volumes}
          span={range.span}
          fitKey={loaded ? `${resType}:${rangeId}` : null}
          bid={h?.merchant.bid}
          ask={h?.merchant.ask}
          empty={loaded && h.candles.length === 0}
        />
      ) : (
        <DepthChart
          className="min-h-0 flex-1"
          buyers={book?.buyers ?? NO_LEVELS}
          sellers={book?.sellers ?? NO_LEVELS}
          factionBuyers={book?.factions?.buyers ?? NO_LEVELS}
          factionSellers={book?.factions?.sellers ?? NO_LEVELS}
        />
      )}
      <p className="shrink-0 px-2 pb-1 text-[11px] text-muted-foreground">
        <Trans
          t={t}
          i18nKey="priceHistory.credit"
          components={{
            // eslint-disable-next-line jsx-a11y-x/anchor-has-content -- Trans fills the link with the translated text
            link: <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer" className="underline underline-offset-2" />,
          }}
        />
      </p>
    </Panel>
  );
}
