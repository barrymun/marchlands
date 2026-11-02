import { useTranslation } from 'react-i18next';

import { useMarkets } from '@/components/market-panel/market-bar/hooks';
import { priceChange } from '@/components/market-panel/market-bar/utils';
import { fmtPrice, resLabel } from '@/components/market-panel/utils';
import { ResourceIcon } from '@/components/resource-icon/resource-icon';
import { fmt, percent } from '@/lib/format';
import { GAIN_TEXT, LOSS_TEXT } from '@/lib/tones';
import { cn } from '@/lib/utils';

/**
 * The terminal's top bar: every resource with its price and its move over the last day, to pick which one to trade,
 * and the chosen one's day (high, low, volume) and the merchant's prices.
 */
export function MarketBar({ resType, onResType }: { resType: number; onResType: (resType: number) => void }) {
  const { t } = useTranslation('market-panel');
  const markets = useMarkets();
  const chosen = markets.find((m) => m.type === resType);
  const stat = (label: string, value: string) => (
    <div className="flex flex-col">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-card p-1 text-xs">
      <div className="flex max-w-full min-w-0 items-center gap-1">
        {/* what the tabs' percentages are, once for all four; left out on a phone, where the bar has no room to spare */}
        <span className="hidden shrink-0 px-1.5 text-[11px] leading-tight text-muted-foreground md:inline">{t('bar.changeCaption')}</span>
        <div role="tablist" aria-label={t('bar.markets')} className="flex min-w-0 gap-1 overflow-x-auto">
          {markets.map((m) => {
            const change = m.day && m.price != null ? priceChange(m.day.open, m.price) : null;
            return (
              <button
                key={m.type}
                type="button"
                role="tab"
                aria-selected={m.type === resType}
                onClick={() => onResType(m.type)}
                className={cn(
                  'flex min-w-24 shrink-0 flex-col items-start rounded-md px-3 py-1.5 text-start transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
                  m.type === resType && 'bg-muted',
                )}
              >
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <ResourceIcon resource={m.key} />
                  {resLabel(m.type)}
                </span>
                <span className="flex items-baseline gap-1.5">
                  <span className="text-sm font-semibold tabular-nums">{m.price != null ? fmtPrice(m.price) : '…'}</span>
                  {change != null && (
                    <span className={cn('tabular-nums', change >= 0 ? GAIN_TEXT : LOSS_TEXT)} title={t('bar.changeTitle')}>
                      {change > 0 && '+'}
                      {percent(change, 2, 2)}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <dl className="flex flex-wrap gap-x-5 gap-y-1 px-2 xl:ms-auto">
        {chosen?.day && stat(t('bar.high'), fmtPrice(chosen.day.high))}
        {chosen?.day && stat(t('bar.low'), fmtPrice(chosen.day.low))}
        {chosen?.day && stat(t('bar.volume'), fmt(chosen.day.volume))}
        {chosen?.merchant && stat(t('bar.merchant'), `${fmtPrice(chosen.merchant.bid)} / ${fmtPrice(chosen.merchant.ask)}`)}
      </dl>
    </div>
  );
}
