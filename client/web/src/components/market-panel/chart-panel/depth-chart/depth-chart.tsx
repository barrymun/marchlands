import { AreaSeries, ColorType, createOptionsChart, type IChartApiBase, type ISeriesApi, LineType } from 'lightweight-charts';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { MarketPriceLevel } from '@marchlands/api-client';

import { depthPoints } from '@/components/market-panel/chart-panel/depth-chart/utils';
import { useDarkMode } from '@/components/market-panel/hooks';
import { cssColour, fmtPrice } from '@/components/market-panel/utils';
import { fmt } from '@/lib/format';
import { GAIN_TEXT, LOSS_TEXT } from '@/lib/tones';
import { cn } from '@/lib/utils';

interface Chart {
  api: IChartApiBase<number>;
  bids: ISeriesApi<'Area', number>;
  asks: ISeriesApi<'Area', number>;
}

/** The book's depth, players' orders and the factions' together, added up from the best price outwards (TradingView Lightweight Charts, price along the bottom). */
export function DepthChart({
  buyers,
  sellers,
  factionBuyers,
  factionSellers,
  className,
}: {
  buyers: MarketPriceLevel[];
  sellers: MarketPriceLevel[];
  /** the factions' depth in price steps, added to the players' */
  factionBuyers: MarketPriceLevel[];
  factionSellers: MarketPriceLevel[];
  /** its size: the chart fills it */
  className?: string;
}) {
  const { t, i18n } = useTranslation('market-panel');
  const dark = useDarkMode();
  const box = useRef<HTMLDivElement>(null);
  const rise = useRef<HTMLSpanElement>(null);
  const fall = useRef<HTMLSpanElement>(null);
  const chart = useRef<Chart | null>(null);
  const { bids, asks } = useMemo(
    () => depthPoints([...buyers, ...factionBuyers], [...sellers, ...factionSellers]),
    [buyers, sellers, factionBuyers, factionSellers],
  );
  const empty = bids.length === 0 && asks.length === 0;

  useEffect(() => {
    if (!box.current) return;
    const api = createOptionsChart(box.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        fontFamily: getComputedStyle(box.current).fontFamily,
        colorParsers: [cssColour],
        attributionLogo: true,
      },
      // prices along the bottom, with the decimals fmtPrice shows
      localization: { precision: 3 },
      handleScroll: false,
      handleScale: false,
    });
    const series = () =>
      api.addSeries(AreaSeries, {
        lineType: LineType.WithSteps,
        lineWidth: 2,
        lastValueVisible: false,
        priceLineVisible: false,
        priceFormat: { type: 'custom', formatter: fmt, minMove: 1 },
      });
    chart.current = { api, bids: series(), asks: series() };
    return () => {
      api.remove();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    chart.current?.api.applyOptions({ localization: { locale: i18n.language, timeFormatter: fmtPrice } });
  }, [i18n.language]);

  useEffect(() => {
    const c = chart.current;
    if (!c || !box.current) return;
    const css = getComputedStyle(box.current);
    const muted = css.getPropertyValue('--muted-foreground').trim() || 'gray';
    const border = css.getPropertyValue('--border').trim() || 'silver';
    c.api.applyOptions({
      layout: { textColor: muted },
      grid: { vertLines: { color: border }, horzLines: { color: border } },
      rightPriceScale: { borderColor: border },
      timeScale: { borderColor: border },
    });
    const paint = (s: ISeriesApi<'Area', number>, el: HTMLSpanElement | null) => {
      const colour = el ? getComputedStyle(el).color : muted;
      s.applyOptions({
        lineColor: colour,
        topColor: `color-mix(in oklch, ${colour} 30%, transparent)`,
        bottomColor: `color-mix(in oklch, ${colour} 5%, transparent)`,
      });
    };
    paint(c.bids, rise.current);
    paint(c.asks, fall.current);
  }, [dark]);

  useEffect(() => {
    chart.current?.bids.setData(bids);
    chart.current?.asks.setData(asks);
    chart.current?.api.timeScale().fitContent();
  }, [bids, asks]);

  return (
    <div className={cn('relative w-full min-w-0', className)}>
      <div ref={box} className="h-full w-full" />
      <span ref={rise} className={cn('hidden', GAIN_TEXT)} />
      <span ref={fall} className={cn('hidden', LOSS_TEXT)} />
      {empty && <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted-foreground">{t('depth.empty')}</p>}
    </div>
  );
}
