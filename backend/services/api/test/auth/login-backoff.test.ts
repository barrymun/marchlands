import { describe, expect, it } from 'vitest';
import { LoginBackoff, type LoginBackoffConfig } from '#/auth/login-backoff.ts';

const CONFIG: LoginBackoffConfig = { freeTries: 5, firstWaitMs: 1000, maxWaitMs: 5 * 60_000, forgetAfterMs: 15 * 60_000 };

/** A backoff on a clock the test moves. */
function setup(config = CONFIG) {
  const clock = { now: 1_000_000 };
  return { backoff: new LoginBackoff(config, () => clock.now), clock };
}

/** `n` wrong passwords for the username, each tried as soon as it may be. */
function failTimes(b: ReturnType<typeof setup>, username: string, n: number) {
  for (let i = 0; i < n; i++) {
    b.clock.now += b.backoff.waitFor(username);
    b.backoff.failed(username);
  }
}

describe(LoginBackoff.name, () => {
  it('lets the first wrong passwords through without a wait', () => {
    const b = setup();
    expect(b.backoff.waitFor('alice')).toBe(0);
    failTimes(b, 'alice', 4);
    expect(b.backoff.waitFor('alice')).toBe(0);
  });

  it('then waits 1 s, 2 s, 4 s … after each further wrong password', () => {
    const b = setup();
    const waits = [];
    for (let i = 0; i < 9; i++) {
      failTimes(b, 'alice', 1);
      waits.push(b.backoff.waitFor('alice'));
    }
    expect(waits).toEqual([0, 0, 0, 0, 1000, 2000, 4000, 8000, 16_000]);
  });

  it('counts the wait down as time passes', () => {
    const b = setup();
    failTimes(b, 'alice', 6);
    expect(b.backoff.waitFor('alice')).toBe(2000);
    b.clock.now += 1500;
    expect(b.backoff.waitFor('alice')).toBe(500);
    b.clock.now += 500;
    expect(b.backoff.waitFor('alice')).toBe(0);
  });

  it('never waits longer than the cap', () => {
    const b = setup();
    failTimes(b, 'alice', 30);
    expect(b.backoff.waitFor('alice')).toBe(5 * 60_000);
  });

  it('starts again after the right password', () => {
    const b = setup();
    failTimes(b, 'alice', 7);
    b.clock.now += b.backoff.waitFor('alice');
    b.backoff.succeeded('alice');
    failTimes(b, 'alice', 4);
    expect(b.backoff.waitFor('alice')).toBe(0);
  });

  it('forgets a username with no wrong password for a while', () => {
    const b = setup();
    failTimes(b, 'alice', 8);
    b.clock.now += 15 * 60_000 - 1;
    failTimes(b, 'alice', 1);
    expect(b.backoff.waitFor('alice')).toBe(16_000);
    b.clock.now += 15 * 60_000;
    expect(b.backoff.waitFor('alice')).toBe(0);
    failTimes(b, 'alice', 1);
    expect(b.backoff.waitFor('alice')).toBe(0);
  });

  it('counts each username on its own, in any case', () => {
    const b = setup();
    failTimes(b, 'alice', 5);
    expect(b.backoff.waitFor('ALICE')).toBe(1000);
    expect(b.backoff.waitFor('bob')).toBe(0);
  });

  it('forgets the oldest username past 100,000, so guesses at many names cannot fill the memory', () => {
    const b = setup();
    failTimes(b, 'alice', 6);
    failTimes(b, 'bob', 6);
    for (let i = 0; i < 99_998; i++) b.backoff.failed(`name${i}`);
    expect(b.backoff.waitFor('alice')).toBe(1000);
    b.backoff.failed('one-too-many');
    expect(b.backoff.waitFor('alice')).toBe(0);
    expect(b.backoff.waitFor('bob')).toBe(2000);
  });

  it('follows its settings', () => {
    const b = setup({ freeTries: 2, firstWaitMs: 3000, maxWaitMs: 10_000, forgetAfterMs: 60_000 });
    failTimes(b, 'alice', 2);
    expect(b.backoff.waitFor('alice')).toBe(3000);
    failTimes(b, 'alice', 1);
    expect(b.backoff.waitFor('alice')).toBe(6000);
    failTimes(b, 'alice', 1);
    expect(b.backoff.waitFor('alice')).toBe(10_000);
  });
});
