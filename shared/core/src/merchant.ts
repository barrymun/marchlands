// The computer merchant (market maker). Pure pricing maths; the market service stores its state.
//
// Each resource has a reference price p. The merchant sells at ask = p(1 + spread/2) and buys at
// bid = p(1 - spread/2). Trading moves p along an exponential curve: buying q units multiplies it
// by e^(q/depth), selling divides it by the same. Fills are priced along the curve (the integral
// of the marginal price), so splitting an order changes nothing and a buy followed by a sell
// always loses the spread. Between trades p decays towards its base price (log-space half-life).
// With BALANCE.merchant.fixedPrice set, the merchant instead trades everything at that one price.

import { BALANCE, scaled } from './balance.ts';

export const MARKET_RESOURCES = ['food', 'wood', 'stone', 'iron'] as const;
export type MarketResource = (typeof MARKET_RESOURCES)[number];

export interface MerchantPrice {
  /** reference price (gold per unit) at `at` */
  price: number;
  at: number;
}
export type MerchantState = Record<MarketResource, MerchantPrice>;

const cfg = () => BALANCE.merchant;
/** the merchant's fixed price, or null when it uses the curve */
export const merchantFixed = (): number | null => cfg().fixedPrice;
export const merchantBase = (r: MarketResource) => merchantFixed() ?? cfg().basePrice[r];

/** Reference price now: `state` decayed towards the base price. */
export function merchantReference(r: MarketResource, state: MerchantPrice | undefined, now: number): number {
  const base = merchantBase(r);
  if (merchantFixed() != null) return base;
  if (!state || !(state.price > 0)) return base;
  const halfLife = Math.max(1, scaled(cfg().recoveryHalfLifeMs));
  const k = Math.pow(0.5, Math.max(0, now - state.at) / halfLife);
  const p = base * Math.pow(state.price / base, k);
  return Math.min(base * cfg().band, Math.max(base / cfg().band, p));
}

export const merchantAsk = (ref: number) => merchantFixed() ?? ref * (1 + cfg().spread / 2);
export const merchantBid = (ref: number) => merchantFixed() ?? ref * (1 - cfg().spread / 2);

export interface MerchantFill {
  qty: number;
  /** gold for the units before fees (buyer pays it, seller receives it) */
  gold: number;
  /** reference price after the fill */
  ref: number;
}

/**
 * The merchant sells up to `qty` units to a buyer, stopping where its marginal ask would exceed
 * `limit` (Infinity for a market order).
 */
export function merchantSells(ref: number, qty: number, limit = Infinity): MerchantFill {
  const fixed = merchantFixed();
  if (fixed != null) {
    const q = limit < fixed ? 0 : Math.max(0, qty);
    return { qty: q, gold: q * fixed, ref: fixed };
  }
  const d = cfg().depth;
  const ask0 = merchantAsk(ref);
  const cap = limit === Infinity ? qty : limit < ask0 ? 0 : Math.floor(d * Math.log(limit / ask0));
  const q = Math.max(0, Math.min(qty, cap));
  return { qty: q, gold: ask0 * d * Math.expm1(q / d), ref: ref * Math.exp(q / d) };
}

/** The merchant buys up to `qty` units from a seller, stopping where its marginal bid would drop below `limit` (0 for a market order). */
export function merchantBuys(ref: number, qty: number, limit = 0): MerchantFill {
  const fixed = merchantFixed();
  if (fixed != null) {
    const q = limit > fixed ? 0 : Math.max(0, qty);
    return { qty: q, gold: q * fixed, ref: fixed };
  }
  const d = cfg().depth;
  const bid0 = merchantBid(ref);
  const cap = limit <= 0 ? qty : limit > bid0 ? 0 : Math.floor(d * Math.log(bid0 / limit));
  const q = Math.max(0, Math.min(qty, cap));
  return { qty: q, gold: -bid0 * d * Math.expm1(-q / d), ref: ref * Math.exp(-q / d) };
}

/** Marginal merchant price after `q` more units on `side` (buy = the merchant sells). */
export function merchantMarginal(ref: number, side: 'buy' | 'sell', q = 0): number {
  const fixed = merchantFixed();
  if (fixed != null) return fixed;
  const d = cfg().depth;
  return side === 'buy' ? merchantAsk(ref) * Math.exp(q / d) : merchantBid(ref) * Math.exp(-q / d);
}

/** Units the merchant sells for `gold`, where each unit costs its price x `feeFactor`. */
export function merchantAffordable(ask: number, gold: number, feeFactor: number): number {
  if (merchantFixed() != null) return Math.floor(gold / (feeFactor * ask));
  const d = cfg().depth;
  return Math.floor(d * Math.log1p(gold / (feeFactor * ask * d)));
}
