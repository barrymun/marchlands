import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/utils';

describe(cn.name, () => {
  it('joins class names and skips falsy ones', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });
  it('lets a later Tailwind class override a conflicting earlier one', () => {
    expect(cn('px-2 text-sm', 'px-4')).toBe('text-sm px-4');
  });
});
