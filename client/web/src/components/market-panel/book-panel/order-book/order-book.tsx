import { Bot, Landmark } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { MarketFactions, MarketMerchant, MarketPriceLevel } from '@marchlands/api-client';
import { TradeCounterparty } from '@marchlands/core';

import { FactionTerms } from '@/components/market-panel/book-panel/order-book/faction-terms/faction-terms';
import { type BookRow, bookSide, spreadOf } from '@/components/market-panel/book-panel/order-book/utils';
import type { Side } from '@/components/market-panel/types';
import { fmtPrice } from '@/components/market-panel/utils';
import { fmt } from '@/lib/format';
import { GAIN_TEXT, LOSS_TEXT } from '@/lib/tones';
import { cn } from '@/lib/utils';

/**
 * The book for one resource, as exchanges show it: sellers above, buyers below, each side highest price first with a
 * bar behind each row for the depth up to it, and the world price and the spread in the middle. Players' levels, the
 * NPC factions' price (with how much they trade before the merchant's band's edge) and the merchant's sit together.
 * Clicking a player's level prepares the opposite order at its price; clicking the factions or the merchant prepares
 * an instant order. Under it, the terms the factions give the city in view.
 */
export function OrderBook({
  buyers,
  sellers,
  merchant,
  factions,
  onLevel,
  onInstant,
}: {
  buyers: MarketPriceLevel[];
  sellers: MarketPriceLevel[];
  merchant?: MarketMerchant;
  factions?: MarketFactions | null;
  onLevel: (level: MarketPriceLevel, side: Side) => void;
  onInstant: (theySell: boolean) => void;
}) {
  const { t } = useTranslation('market-panel');
  const asks = bookSide(true, sellers, factions, merchant);
  const bids = bookSide(false, buyers, factions, merchant);
  const spread = spreadOf(asks, bids);
  const price = factions?.price ?? merchant?.reference;
  const row = (r: BookRow, sells: boolean) => (
    <button
      key={`${sells ? 'a' : 'b'}-${r.key}`}
      type="button"
      onClick={() => (r.level ? onLevel(r.level, sells ? 1 : 0) : onInstant(sells))}
      className="relative grid w-full grid-cols-[1fr_1fr_auto] items-center gap-2 px-2 py-0.5 text-start tabular-nums hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
    >
      <span aria-hidden className={cn('absolute inset-y-0 end-0', sells ? 'bg-red-500/10' : 'bg-emerald-500/10')} style={{ width: `${r.depth * 100}%` }} />
      <span className={cn('relative', sells ? LOSS_TEXT : GAIN_TEXT, r.source !== TradeCounterparty.PLAYER && 'font-semibold')}>{fmtPrice(r.price)}</span>
      <span className="relative text-end" title={r.source === TradeCounterparty.FACTIONS ? t('orderBook.factionsDepth') : undefined}>
        {r.amount == null ? <span className="text-muted-foreground">{t('orderBook.unlimited')}</span> : fmt(r.amount)}
      </span>
      <span className="relative flex w-20 items-center justify-end gap-1 text-[11px] text-muted-foreground">
        {r.source === TradeCounterparty.FACTIONS && <Landmark className="size-3" />}
        {r.source === TradeCounterparty.MERCHANT && <Bot className="size-3" />}
        {t(`orderBook.${r.source}`)}
      </span>
    </button>
  );
  return (
    <div className="text-xs">
      <div className="sticky top-0 z-10 grid grid-cols-[1fr_1fr_auto] gap-2 bg-card px-2 py-1 text-[11px] text-muted-foreground">
        <span>{t('columns.price')}</span>
        <span className="text-end">{t('columns.amount')}</span>
        <span className="w-20 text-end">{t('columns.from')}</span>
      </div>
      {asks.map((r) => row(r, true))}
      <div className="flex items-baseline justify-between gap-2 border-y bg-muted/40 px-2 py-1.5">
        <span className="text-base font-semibold tabular-nums">{price != null ? fmtPrice(price) : '…'}</span>
        <span className="text-[11px] text-muted-foreground">
          {factions ? t('book.worldPrice') : t('book.merchantPrice')}
          {spread != null && ` · ${t('book.spread', { spread: fmtPrice(spread) })}`}
        </span>
      </div>
      {bids.map((r) => row(r, false))}
      {factions && <FactionTerms factions={factions} />}
    </div>
  );
}
