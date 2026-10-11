// The worker's loops without a database: the event loop is given the step it repeats, and time is faked.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '@marchlands/db';
import { eventLoop, every, processOne, type Log } from '../src/worker.ts';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** A stop flag the test sets, and a log it reads. */
function harness() {
  const state = { stop: false };
  const log = vi.fn<Log>();
  return { state, log, stopping: () => state.stop };
}

describe(eventLoop.name, () => {
  it('works through due events in batches without waiting, then waits idleMs when none is due', async () => {
    const { state, log, stopping } = harness();
    const due = [true, true, true, true, true];
    const next = vi.fn(async () => due.shift() ?? false);
    const done = eventLoop(next, { batch: 2, idleMs: 250, stopping, log });

    // batches of 2 + 2 + 1 events (the third ends on an empty claim) with no wait between them; a batch that did
    // some work goes round again at once, so the 7th claim finds nothing and only then does the loop wait
    await vi.advanceTimersByTimeAsync(0);
    expect(next).toHaveBeenCalledTimes(7);
    await vi.advanceTimersByTimeAsync(249);
    expect(next).toHaveBeenCalledTimes(7);
    await vi.advanceTimersByTimeAsync(1);
    expect(next).toHaveBeenCalledTimes(8);

    state.stop = true;
    await vi.advanceTimersByTimeAsync(250);
    await done;
    expect(next).toHaveBeenCalledTimes(8);
    expect(log).not.toHaveBeenCalled();
  });

  it('logs an error, waits idleMs and carries on', async () => {
    const { state, log, stopping } = harness();
    const next = vi.fn(async () => {
      if (next.mock.calls.length === 1) throw new Error('connection lost');
      return false;
    });
    const done = eventLoop(next, { batch: 50, idleMs: 250, stopping, log });

    await vi.advanceTimersByTimeAsync(0);
    expect(next).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('error', 'event loop error', { error: 'Error: connection lost' });
    await vi.advanceTimersByTimeAsync(250);
    expect(next).toHaveBeenCalledTimes(2);

    state.stop = true;
    await vi.advanceTimersByTimeAsync(250);
    await done;
  });

  it('does not wait after an error when the batch had already done work', async () => {
    const { state, log, stopping } = harness();
    const steps: (() => boolean)[] = [
      () => true,
      () => {
        throw new Error('boom');
      },
    ];
    const next = vi.fn(async () => {
      const step = steps.shift();
      if (!step) state.stop = true;
      return step ? step() : false;
    });
    const done = eventLoop(next, { batch: 50, idleMs: 250, stopping, log });

    // the second batch starts at once: next is called a third time without any timer running
    await vi.advanceTimersByTimeAsync(0);
    expect(next).toHaveBeenCalledTimes(3);
    expect(log).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(250);
    await done;
  });

  it('stops between events once the worker is stopping, without claiming another', async () => {
    const { state, log, stopping } = harness();
    const next = vi.fn(async () => {
      if (next.mock.calls.length === 3) state.stop = true;
      return true;
    });
    await eventLoop(next, { batch: 50, idleMs: 250, stopping, log });
    expect(next).toHaveBeenCalledTimes(3);
  });

  it('does not start when the worker is already stopping', async () => {
    const { state, log, stopping } = harness();
    state.stop = true;
    const next = vi.fn(async () => true);
    await eventLoop(next, { batch: 50, idleMs: 250, stopping, log });
    expect(next).not.toHaveBeenCalled();
  });
});

describe(every.name, () => {
  it('runs the job one second after start, then every ms counted from the end of the previous run', async () => {
    const { state, log, stopping } = harness();
    const fn = vi.fn(() => new Promise<void>((r) => setTimeout(r, 500)));
    every('rankings', 10_000, fn, { stopping, log });

    await vi.advanceTimersByTimeAsync(999);
    expect(fn).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(1);
    // the run takes 500 ms; the next one starts 10 s after it ended
    await vi.advanceTimersByTimeAsync(500 + 9_999);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(2);

    state.stop = true;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(log).not.toHaveBeenCalled();
  });

  it('logs a failed run and keeps the schedule', async () => {
    const { log, stopping } = harness();
    const fn = vi.fn(async () => {
      throw new Error('deadlock');
    });
    every('zones', 60_000, fn, { stopping, log });

    await vi.advanceTimersByTimeAsync(1000);
    expect(log).toHaveBeenCalledWith('error', 'zones failed', { error: expect.stringContaining('Error: deadlock') });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledTimes(2);
  });

  it('logs a run that took more than two seconds', async () => {
    const { log, stopping } = harness();
    const durations = [2000, 2001];
    every('stats', 60_000, () => new Promise<void>((r) => setTimeout(r, durations.shift())), { stopping, log });

    await vi.advanceTimersByTimeAsync(1000 + 2000);
    expect(log).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60_000 + 2001);
    expect(log).toHaveBeenCalledExactlyOnceWith('info', 'stats took 2001ms');
  });

  it('never runs when the worker stops before the first run, and is not rescheduled when it stops during one', async () => {
    const { state, log, stopping } = harness();
    const before = vi.fn(async () => {});
    every('beginner', 1000, before, { stopping, log });
    state.stop = true;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(before).not.toHaveBeenCalled();

    state.stop = false;
    const during = vi.fn(async () => {
      state.stop = true;
    });
    every('merchant', 1000, during, { stopping, log });
    await vi.advanceTimersByTimeAsync(1000);
    expect(during).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe(processOne.name, () => {
  it('passes on an error from before an event was claimed, without logging or backing anything off', async () => {
    const log = vi.fn<Log>();
    const execute = vi.fn();
    const db = {
      transaction: async () => {
        throw new Error('database unavailable');
      },
      execute,
    } as unknown as Db;
    await expect(processOne(db, { log })).rejects.toThrow('database unavailable');
    expect(log).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });
});
