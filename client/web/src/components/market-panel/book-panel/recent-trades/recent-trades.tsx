import { useTranslation } from 'react-i18next';

import type { MarketTrade } from '@marchlands/api-client';

import { useShortList } from '@/components/market-panel/hooks';
import { ShowMore } from '@/components/market-panel/show-more/show-more';
import { fmtPrice } from '@/components/market-panel/utils';
import { clockTime, fmt } from '@/lib/format';
import { GAIN_TEXT, LOSS_TEXT } from '@/lib/tones';
import { cn } from '@/lib/utils';

/** The latest trades with a player in them, newest first: green where the buyer acted, red where the seller did. */
export function RecentTrades({ trades }: { trades: MarketTrade[] }) {
  const { t } = useTranslation(['market-panel', 'common']);
  const list = useShortList(trades);
  if (trades.length === 0) return <p className="p-3 text-xs text-muted-foreground">{t('common:noneYet')}</p>;
  return (
    <div className="text-xs">
      <div className="sticky top-0 grid grid-cols-[1fr_1fr_auto_auto] gap-2 bg-card px-2 py-1 text-[11px] text-muted-foreground">
        <span>{t('columns.price')}</span>
        <span className="text-end">{t('columns.amount')}</span>
        <span className="w-16 text-end">{t('columns.from')}</span>
        <span className="w-12 text-end">{t('columns.time')}</span>
      </div>
      {list.shown.map((tr) => (
        <div key={tr.id} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 px-2 py-0.5 tabular-nums">
          <span className={cn(tr.takerSide === 0 ? GAIN_TEXT : LOSS_TEXT)}>{fmtPrice(tr.price)}</span>
          <span className="text-end">{fmt(tr.amount)}</span>
          <span className="w-16 text-end text-[11px] text-muted-foreground">
            {tr.factions ? t('priceHistory.factions') : tr.merchant ? t('priceHistory.merchant') : t('priceHistory.players')}
          </span>
          <span className="w-12 text-end text-muted-foreground">{clockTime(tr.createdAt, true)}</span>
        </div>
      ))}
      <ShowMore hidden={list.hidden} onMore={list.showAll} />
    </div>
  );
}
