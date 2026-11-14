import { describe, expect, it } from 'vitest';
import { isWeakPassword } from '#/auth/password-rule.ts';

const ACCOUNT = { username: 'alice_of_the_march', email: 'alice@example.test' };

describe(isWeakPassword.name, () => {
  it('refuses the commonest passwords long enough to pass the length, in any case', () => {
    for (const password of ['1234567890', 'qwertyuiop', 'password123', 'Password123', 'QWERTYUIOP', '1q2w3e4r5t', 'iloveyou123']) {
      expect(isWeakPassword(password, ACCOUNT), password).toBe(true);
    }
  });

  it('refuses one character repeated', () => {
    expect(isWeakPassword('aaaaaaaaaa', ACCOUNT)).toBe(true);
    expect(isWeakPassword('AAAAAaaaaa', ACCOUNT)).toBe(true);
    expect(isWeakPassword('0000000000000', ACCOUNT)).toBe(true);
    expect(isWeakPassword('aaaaaaaaab', ACCOUNT)).toBe(false);
  });

  it("refuses the account's own username or email, in any case", () => {
    expect(isWeakPassword('alice_of_the_march', ACCOUNT)).toBe(true);
    expect(isWeakPassword('Alice_Of_The_March', ACCOUNT)).toBe(true);
    expect(isWeakPassword('ALICE@example.test', ACCOUNT)).toBe(true);
    // another account's name is as good as any other password
    expect(isWeakPassword('alice_of_the_march', { username: 'bob', email: 'bob@example.test' })).toBe(false);
  });

  it('takes anything else', () => {
    for (const password of ['correct horse battery', 'tr4ding-Lumber!', 'password123 but longer', 'x9$kQ2mvPz']) {
      expect(isWeakPassword(password, ACCOUNT), password).toBe(false);
    }
  });
});
