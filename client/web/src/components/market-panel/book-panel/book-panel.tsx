import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { MarketOrderBook, MarketPriceLevel, MarketTrade } from '@marchlands/api-client';

import { BookView } from '@/components/market-panel/book-panel/constants';
import { OrderBook } from '@/components/market-panel/book-panel/order-book/order-book';
import { RecentTrades } from '@/components/market-panel/book-panel/recent-trades/recent-trades';
import { NO_LEVELS } from '@/components/market-panel/constants';
import { Panel } from '@/components/market-panel/panel/panel';
import { PanelTabs } from '@/components/market-panel/panel-tabs/panel-tabs';
import type { Side } from '@/components/market-panel/types';

/** The terminal's narrow column beside the chart: the order book, or the latest trades. */
export function BookPanel({
  book,
  trades,
  onLevel,
  onInstant,
  className,
}: {
  book?: MarketOrderBook;
  trades: MarketTrade[];
  onLevel: (level: MarketPriceLevel, side: Side) => void;
  onInstant: (theySell: boolean) => void;
  className?: string;
}) {
  const { t } = useTranslation('market-panel');
  const [view, setView] = useState<BookView>(BookView.BOOK);
  return (
    <Panel
      className={className}
      header={
        <PanelTabs
          label={t('book.views')}
          value={view}
          onChange={setView}
          tabs={[
            { id: BookView.BOOK, label: t('book.book') },
            { id: BookView.TRADES, label: t('book.trades') },
          ]}
        />
      }
    >
      {view === BookView.BOOK ? (
        <OrderBook
          buyers={book?.buyers ?? NO_LEVELS}
          sellers={book?.sellers ?? NO_LEVELS}
          merchant={book?.merchant}
          factions={book?.factions}
          onLevel={onLevel}
          onInstant={onInstant}
        />
      ) : (
        <RecentTrades trades={trades} />
      )}
    </Panel>
  );
}
