import { describe, expect, it } from 'vitest';

import { ApiError } from '@marchlands/api-client';
import { msg } from '@marchlands/core';

import { isRefusal, retryUnlessRefused } from '@/lib/errors';

const failed = (status: number) => new ApiError(-99, msg('report.notFound'), status);

describe(isRefusal.name, () => {
  it('is a refusal when the server turned the request down', () => {
    expect(isRefusal(failed(400))).toBe(true);
    expect(isRefusal(failed(404))).toBe(true);
    expect(isRefusal(failed(422))).toBe(true);
  });

  it('is not one when signing in again or slowing down would do', () => {
    expect(isRefusal(failed(401))).toBe(false);
    expect(isRefusal(failed(429))).toBe(false);
  });

  it('is not one for a fault of the server or a lost connection', () => {
    expect(isRefusal(failed(500))).toBe(false);
    expect(isRefusal(failed(0))).toBe(false);
    expect(isRefusal(new TypeError('Failed to fetch'))).toBe(false);
    expect(isRefusal(null)).toBe(false);
  });
});

describe(retryUnlessRefused.name, () => {
  it('tries a lost connection again, three times', () => {
    const lost = new TypeError('Failed to fetch');
    expect(retryUnlessRefused(0, lost)).toBe(true);
    expect(retryUnlessRefused(2, lost)).toBe(true);
    expect(retryUnlessRefused(3, lost)).toBe(false);
  });

  it('never tries a refusal again', () => {
    expect(retryUnlessRefused(0, failed(404))).toBe(false);
  });
});
