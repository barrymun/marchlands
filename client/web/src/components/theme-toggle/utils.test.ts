import { describe, expect, it } from 'vitest';
import { noSubscribe } from '@/components/theme-toggle/utils';

describe(noSubscribe.name, () => {
  it('returns an unsubscribe function', () => {
    expect(noSubscribe()).toBeTypeOf('function');
  });

  it('never calls the store change callback', () => {
    let calls = 0;
    const unsubscribe = (noSubscribe as (onChange: () => void) => () => void)(() => calls++);
    unsubscribe();
    expect(calls).toBe(0);
  });

  it('unsubscribes as a no-op, safely more than once', () => {
    const unsubscribe = noSubscribe();
    expect(unsubscribe()).toBeUndefined();
    expect(unsubscribe()).toBeUndefined();
  });

  it('hands out a fresh unsubscribe per subscription', () => {
    expect(noSubscribe()).not.toBe(noSubscribe());
  });
});
