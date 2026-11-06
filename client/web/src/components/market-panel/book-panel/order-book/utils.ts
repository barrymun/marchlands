import type { MarketFactions, MarketMerchant, MarketPriceLevel } from '@marchlands/api-client';
import { TradeCounterparty } from '@marchlands/core';

/** A row of the book: a player's price level, the factions' price or the merchant's. */
export interface BookRow {
  key: string;
  price: number;
  /** null: the merchant, who trades any amount */
  amount: number | null;
  source: TradeCounterparty;
  /** the player's level, to prepare the opposite order at its price */
  level?: MarketPriceLevel;
  /** how much is on offer up to this row from the middle of the book, as a share of the side's most (0 to 1) */
  depth: number;
}

/**
 * One side of the book as rows, highest price first: players' levels, the factions' price with what they trade before
 * the band's edge, and the merchant's price. Each row's depth adds up from the best price outwards (for sellers the
 * lowest, for buyers the highest); the merchant, trading any amount, adds nothing.
 */
export function bookSide(sells: boolean, levels: MarketPriceLevel[], factions?: MarketFactions | null, merchant?: MarketMerchant | null): BookRow[] {
  const rows: Omit<BookRow, 'depth'>[] = levels.map((l) => ({
    key: `p${l.price}`,
    price: l.price,
    amount: l.amount,
    source: TradeCounterparty.PLAYER,
    level: l,
  }));
  const theirs = sells ? factions?.ask : factions?.bid;
  if (factions && theirs != null)
    rows.push({ key: TradeCounterparty.FACTIONS, price: theirs, amount: sells ? factions.sells : factions.buys, source: TradeCounterparty.FACTIONS });
  if (merchant) rows.push({ key: TradeCounterparty.MERCHANT, price: sells ? merchant.ask : merchant.bid, amount: null, source: TradeCounterparty.MERCHANT });
  // from the best price outwards
  const outward = [...rows].sort((a, b) => (sells ? a.price - b.price : b.price - a.price));
  let total = 0;
  const cumulative = new Map(outward.map((r) => [r.key, (total += r.amount ?? 0)]));
  return rows.map((r) => ({ ...r, depth: r.amount != null && total > 0 ? (cumulative.get(r.key) ?? 0) / total : 0 })).sort((a, b) => b.price - a.price);
}

/** The gap between the lowest selling price and the highest buying price; null when a side is empty. */
export function spreadOf(asks: BookRow[], bids: BookRow[]): number | null {
  const bestAsk = asks.at(-1)?.price;
  const bestBid = bids[0]?.price;
  return bestAsk != null && bestBid != null ? bestAsk - bestBid : null;
}
