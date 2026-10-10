import { describe, expect, it } from 'vitest';
import { ago } from '@/components/flows-panel/run-flow/utils';

const NOW = 1_800_000_000_000;

describe(ago.name, () => {
  it('is just now under a minute', () => {
    expect(ago(NOW, NOW)).toBe('just now');
    expect(ago(NOW, NOW - 59_999)).toBe('just now');
  });

  it('is the largest unit from a minute on', () => {
    expect(ago(NOW, NOW - 60_000)).toBe('1m ago');
    expect(ago(NOW, NOW - 5 * 60_000 - 9_000)).toBe('5m ago');
    expect(ago(NOW, NOW - 2 * 3_600_000 - 60_000)).toBe('2h ago');
    expect(ago(NOW, NOW - 3 * 86_400_000)).toBe('3d ago');
  });

  it('is just now for a time in the future (clock skew)', () => {
    expect(ago(NOW, NOW + 5_000)).toBe('just now');
  });
});
