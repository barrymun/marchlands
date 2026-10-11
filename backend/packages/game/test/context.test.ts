import { describe, expect, it } from 'vitest';
import { GameError, msg } from '@marchlands/core';
import { isRetryable } from '../src/index.ts';

const withCode = (code: unknown) => Object.assign(new Error('pg'), { code });

describe(isRetryable.name, () => {
  it('retries a serialization failure and a deadlock', () => {
    expect(isRetryable(withCode('40001'))).toBe(true);
    expect(isRetryable(withCode('40P01'))).toBe(true);
    expect(isRetryable({ code: '40001' })).toBe(true);
  });

  it('reads the code from the cause of a wrapped error', () => {
    expect(isRetryable(new Error('wrapped', { cause: withCode('40P01') }))).toBe(true);
    expect(isRetryable(new Error('wrapped', { cause: withCode('23505') }))).toBe(false);
  });

  it('the error’s own code wins over its cause', () => {
    expect(isRetryable(Object.assign(new Error('x', { cause: withCode('40001') }), { code: '23505' }))).toBe(false);
  });

  it('does not retry other errors', () => {
    expect(isRetryable(new Error('boom'))).toBe(false);
    expect(isRetryable(withCode('23505'))).toBe(false); // unique violation
    expect(isRetryable(withCode(''))).toBe(false);
    expect(isRetryable(withCode(40001))).toBe(false);
    expect(isRetryable('40001')).toBe(false);
  });

  it('never retries a game refusal, whatever its code', () => {
    expect(isRetryable(new GameError(msg('common.invalidData')))).toBe(false);
    expect(isRetryable(Object.assign(new GameError(msg('common.invalidData')), { cause: withCode('40001') }))).toBe(false);
  });

  it('does not retry a thrown null or undefined', () => {
    expect(isRetryable(undefined)).toBe(false);
    expect(isRetryable(null)).toBe(false);
  });
});
