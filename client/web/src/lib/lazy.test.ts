import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lazyComponent, reloadOnce, whenIdle } from '@/lib/lazy';

const Panel = () => null;

/** A sessionStorage stand-in. */
function storage() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe(lazyComponent.name, () => {
  it('preload fetches the code once, however often it is called', async () => {
    const load = vi.fn(async () => Panel);
    const Lazy = lazyComponent(load);
    Lazy.preload();
    Lazy.preload();
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    Lazy.preload();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('a failed preload is tried again on the next one, without throwing', async () => {
    const load = vi.fn<() => Promise<typeof Panel>>().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(Panel);
    const Lazy = lazyComponent(load);
    expect(() => Lazy.preload()).not.toThrow();
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    Lazy.preload();
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe(reloadOnce.name, () => {
  let reload: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers({ now: 1_000_000 });
    reload = vi.fn();
    vi.stubGlobal('window', { location: { reload } });
    vi.stubGlobal('sessionStorage', storage());
  });

  it('reloads the page and rethrows the error', () => {
    const err = new Error('chunk failed');
    expect(() => reloadOnce(err)).toThrow(err);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload again within a minute (no reload loop)', () => {
    expect(() => reloadOnce(new Error('a'))).toThrow();
    vi.advanceTimersByTime(59_000);
    expect(() => reloadOnce(new Error('b'))).toThrow('b');
    expect(reload).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2_000);
    expect(() => reloadOnce(new Error('c'))).toThrow('c');
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('never reloads without sessionStorage', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
    });
    expect(() => reloadOnce(new Error('x'))).toThrow('x');
    expect(reload).not.toHaveBeenCalled();
  });
});

describe(whenIdle.name, () => {
  it('runs on requestIdleCallback when the browser has it, and can be cancelled', () => {
    const cancelIdleCallback = vi.fn();
    const requestIdleCallback = vi.fn((fn: () => void) => {
      fn();
      return 7;
    });
    vi.stubGlobal('window', { requestIdleCallback, cancelIdleCallback });
    const fn = vi.fn();
    const cancel = whenIdle(fn);
    expect(fn).toHaveBeenCalledTimes(1);
    cancel();
    expect(cancelIdleCallback).toHaveBeenCalledWith(7);
  });

  it('falls back to a short timeout, which cancelling stops', () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', {});
    const ran = vi.fn();
    whenIdle(ran);
    vi.advanceTimersByTime(1000);
    expect(ran).toHaveBeenCalledTimes(1);
    const stopped = vi.fn();
    whenIdle(stopped)();
    vi.advanceTimersByTime(1000);
    expect(stopped).not.toHaveBeenCalled();
  });
});
