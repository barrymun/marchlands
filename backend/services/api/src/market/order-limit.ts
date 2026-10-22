// Limits how often a player places and cancels market orders (BALANCE.marketOrderLimit), so a bot outside the game
// can't flood the order book or out-trade players by speed. A token bucket per account: up to `burst` actions at
// once, then one more every `refillMs`. Kept in memory, like the login backoff: there is one API instance, and a
// restart only forgets the counts.

export interface OrderLimitConfig {
  /** actions allowed at once */
  burst: number;
  /** one more action after this long, ms */
  refillMs: number;
}

/** Accounts tracked at most: past it the least recently active is forgotten (it has long had a full bucket). */
const MAX_TRACKED = 100_000;

export class OrderLimit {
  private readonly config: OrderLimitConfig;
  private readonly now: () => number;
  /**
   * By account id, least recently active first: when its bucket is full again, ms. Each action moves that on by
   * `refillMs`; an action is allowed while it stays within `burst` refills of now. Whole ms, so waits are exact.
   */
  private readonly fullAt = new Map<number, number>();

  constructor(config: OrderLimitConfig, now: () => number = () => Date.now()) {
    this.config = config;
    this.now = now;
  }

  /** One action by the account: 0 when it may go ahead (and is counted), else how long it must wait, ms (nothing counted). */
  take(accountId: number): number {
    const { burst, refillMs } = this.config;
    const now = this.now();
    const next = Math.max(this.fullAt.get(accountId) ?? now, now) + refillMs;
    const wait = next - burst * refillMs - now;
    if (wait > 0) return wait;
    // re-inserted, so the map stays in order of the last action
    this.fullAt.delete(accountId);
    this.fullAt.set(accountId, next);
    if (this.fullAt.size > MAX_TRACKED) {
      const oldest = this.fullAt.keys().next();
      if (!oldest.done) this.fullAt.delete(oldest.value);
    }
    return 0;
  }
}
