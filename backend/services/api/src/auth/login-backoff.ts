// Slows down password guessing: after a few wrong passwords in a row for a username, each further try waits longer
// (1 s, 2 s, 4 s … up to a cap). Counted per username, never per IP, so a player who logs in correctly is never
// delayed and players sharing an address never affect each other. A delay, not a lockout, so nobody can lock a player
// out for good. Kept in memory: there is one API instance, and a restart only forgets the counts.

export interface LoginBackoffConfig {
  /** wrong passwords in a row that are answered straight away */
  freeTries: number;
  /** the wait after them, ms; it doubles with each further wrong password */
  firstWaitMs: number;
  /** the longest wait, ms */
  maxWaitMs: number;
  /** a username with no wrong password for this long starts again, ms */
  forgetAfterMs: number;
}

/** Usernames tracked at most: past it the oldest is forgotten, so guesses at many names can't fill the memory. */
const MAX_TRACKED = 100_000;

interface Tries {
  /** wrong passwords in a row */
  fails: number;
  /** when the last one was, ms */
  lastAt: number;
  /** no further try before this, ms */
  until: number;
}

export class LoginBackoff {
  private readonly config: LoginBackoffConfig;
  private readonly now: () => number;
  /** by lower-case username, least recently failed first */
  private readonly tries = new Map<string, Tries>();

  constructor(config: LoginBackoffConfig, now: () => number = () => Date.now()) {
    this.config = config;
    this.now = now;
  }

  /** How long the username must still wait before its password is checked, ms (0: it may try now). */
  waitFor(username: string): number {
    const t = this.current(username.toLowerCase());
    return t ? Math.max(0, t.until - this.now()) : 0;
  }

  /** A wrong password for the username (or a username with no account: they're counted alike). */
  failed(username: string): void {
    const key = username.toLowerCase();
    const now = this.now();
    const fails = (this.current(key)?.fails ?? 0) + 1;
    const extra = fails - this.config.freeTries;
    const until = extra < 0 ? now : now + Math.min(this.config.maxWaitMs, this.config.firstWaitMs * 2 ** extra);
    // re-inserted, so the map stays in order of the last wrong password
    this.tries.delete(key);
    this.tries.set(key, { fails, lastAt: now, until });
    if (this.tries.size > MAX_TRACKED) this.tries.delete(this.tries.keys().next().value!);
  }

  /** The right password: the username starts again. */
  succeeded(username: string): void {
    this.tries.delete(username.toLowerCase());
  }

  /** The username's tries, unless they're old enough to forget. */
  private current(key: string): Tries | undefined {
    const t = this.tries.get(key);
    if (t && this.now() - t.lastAt >= this.config.forgetAfterMs) {
      this.tries.delete(key);
      return undefined;
    }
    return t;
  }
}
