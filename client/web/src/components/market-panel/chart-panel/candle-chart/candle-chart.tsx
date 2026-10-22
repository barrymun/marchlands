import {
  type CandlestickData,
  CandlestickSeries,
  ColorType,
  createChart,
  type HistogramData,
  HistogramSeries,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  LineStyle,
  TickMarkType,
  type Time,
  type UTCTimestamp,
  type WhitespaceData,
} from 'lightweight-charts';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { FOLLOW_SLOTS } from '@/components/market-panel/chart-panel/candle-chart/constants';
import { useDarkMode } from '@/components/market-panel/hooks';
import { cssColour, fmtPrice } from '@/components/market-panel/utils';
import { clockTime, dateTime, fmt, shortDate } from '@/lib/format';
import { GAIN_TEXT, LOSS_TEXT } from '@/lib/tones';
import { cn } from '@/lib/utils';

interface Chart {
  api: IChartApi;
  candles: ISeriesApi<'Candlestick'>;
  volume: ISeriesApi<'Histogram'>;
  merchant: IPriceLine[];
}

/**
 * Candles and volume (TradingView Lightweight Charts, drawn on a canvas), the price scale fitted to the candles, with the
 * merchant's prices as dashed lines when they're in range.
 * It opens on the last `span` ms and can be scrolled and zoomed; it goes back there whenever `fitKey` changes.
 */
export function CandleChart({
  prices,
  volumes,
  span,
  fitKey,
  bid,
  ask,
  empty,
  className,
}: {
  prices: (CandlestickData<UTCTimestamp> | WhitespaceData<UTCTimestamp>)[];
  volumes: (HistogramData<UTCTimestamp> | WhitespaceData<UTCTimestamp>)[];
  span: number;
  /** a new key (another resource or range) fits the chart to the last `span` again; null while its data is loading */
  fitKey: string | null;
  bid?: number;
  ask?: number;
  empty: boolean;
  /** its size: the chart fills it */
  className?: string;
}) {
  const { t, i18n } = useTranslation('market-panel');
  const dark = useDarkMode();
  const box = useRef<HTMLDivElement>(null);
  const rise = useRef<HTMLSpanElement>(null);
  const fall = useRef<HTMLSpanElement>(null);
  const chart = useRef<Chart | null>(null);
  const latest = useRef(0);
  /** a fit waiting for the chart to have a width (it has none until it first lays out) */
  const pendingFit = useRef<(() => void) | null>(null);

  // the theme's colours, read from the page (the canvas can't use CSS variables)
  const colours = () => {
    const css = box.current ? getComputedStyle(box.current) : null;
    const muted = css?.getPropertyValue('--muted-foreground').trim() || 'gray';
    return {
      muted,
      border: css?.getPropertyValue('--border').trim() || 'silver',
      rise: rise.current ? getComputedStyle(rise.current).color : 'green',
      fall: fall.current ? getComputedStyle(fall.current).color : 'red',
      volume: `color-mix(in oklch, ${muted} 35%, transparent)`,
    };
  };

  useEffect(() => {
    if (!box.current) return;
    const api = createChart(box.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        fontFamily: getComputedStyle(box.current).fontFamily,
        colorParsers: [cssColour],
        // the library's logo links to TradingView, as its licence asks
        attributionLogo: true,
      },
      timeScale: { timeVisible: true, secondsVisible: false },
      // a finger dragging up or down scrolls the page (a phone), across pans the chart
      handleScroll: { vertTouchDrag: false },
    });
    const candles = api.addSeries(CandlestickSeries, {
      borderVisible: false,
      priceFormat: { type: 'custom', formatter: fmtPrice, minMove: 0.001 },
    });
    candles.priceScale().applyOptions({ scaleMargins: { top: 0.1, bottom: 0.25 } });
    const volume = api.addSeries(HistogramSeries, {
      priceScaleId: 'volume',
      priceFormat: { type: 'custom', formatter: fmt, minMove: 1 },
      lastValueVisible: false,
      priceLineVisible: false,
    });
    api.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    api.timeScale().subscribeSizeChange(() => {
      pendingFit.current?.();
      pendingFit.current = null;
    });
    chart.current = { api, candles, volume, merchant: [] };
    return () => {
      api.remove();
      chart.current = null;
    };
  }, []);

  // times in the player's language and time zone (the chart's own are UTC)
  useEffect(() => {
    const ms = (time: Time) => (typeof time === 'number' ? time * 1000 : 0);
    chart.current?.api.applyOptions({
      localization: { locale: i18n.language, timeFormatter: (time: Time) => dateTime(ms(time)) },
      timeScale: {
        tickMarkFormatter: (time: Time, type: TickMarkType) =>
          type === TickMarkType.Time || type === TickMarkType.TimeWithSeconds ? clockTime(ms(time), true) : shortDate(ms(time)),
      },
    });
  }, [i18n.language]);

  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    const { muted, border, rise, fall, volume } = colours();
    c.api.applyOptions({
      layout: { textColor: muted },
      grid: { vertLines: { color: border }, horzLines: { color: border } },
      rightPriceScale: { borderColor: border },
      timeScale: { borderColor: border },
    });
    c.candles.applyOptions({ upColor: rise, downColor: fall, wickUpColor: rise, wickDownColor: fall });
    c.volume.applyOptions({ color: volume });
    for (const line of c.merchant) c.candles.removePriceLine(line);
    const line = (price: number, title: string) =>
      c.candles.createPriceLine({ price, title, color: muted, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true });
    c.merchant = [...(ask != null ? [line(ask, t('priceHistory.merchantSells'))] : []), ...(bid != null ? [line(bid, t('priceHistory.merchantBuys'))] : [])];
    // `dark` is when the colours colours() reads from the page change
  }, [dark, bid, ask, t]);

  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    const scale = c.api.timeScale();
    // while the latest candles are in view (within a couple of slots of the right edge), follow new ones as they come;
    // once the player scrolls back into the past, stay there
    const following = scale.width() > 0 && scale.scrollPosition() > -FOLLOW_SLOTS;
    c.candles.setData(prices);
    c.volume.setData(volumes);
    latest.current = prices.at(-1)?.time ?? 0;
    if (following) scale.scrollToRealTime();
  }, [prices, volumes]);

  useEffect(() => {
    const scale = chart.current?.api.timeScale();
    const to = latest.current;
    if (fitKey == null || !scale || !to) return;
    const fit = () => scale.setVisibleRange({ from: (to - span / 1000) as UTCTimestamp, to: to as UTCTimestamp });
    if (scale.width() > 0) fit();
    else pendingFit.current = fit;
  }, [fitKey, span]);

  return (
    // min-w-0: in its card's grid the canvas would otherwise hold the column at its old width when the page narrows
    <div className={cn('relative w-full min-w-0', className)}>
      <div ref={box} className="h-full w-full" />
      {/* the colours of gains and losses, read for the canvas */}
      <span ref={rise} className={cn('hidden', GAIN_TEXT)} />
      <span ref={fall} className={cn('hidden', LOSS_TEXT)} />
      {empty && <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted-foreground">{t('priceHistory.noTrades')}</p>}
    </div>
  );
}
