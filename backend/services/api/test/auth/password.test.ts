import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '#/auth/password.ts';

describe(hashPassword.name, () => {
  it('stores scrypt$N$r$p$salt$hash with a fresh salt each time', async () => {
    const a = await hashPassword('fake-password');
    const b = await hashPassword('fake-password');
    expect(a).toMatch(/^scrypt\$16384\$8\$1\$[\w-]{22}\$[\w-]{43}$/);
    expect(a).not.toContain('fake-password');
    expect(a).not.toBe(b);
  });
});

describe(verifyPassword.name, () => {
  it('accepts the password it was hashed from, and only that one', async () => {
    const stored = await hashPassword('fake-password');
    expect(await verifyPassword('fake-password', stored)).toBe(true);
    expect(await verifyPassword('fake-passwore', stored)).toBe(false);
    expect(await verifyPassword('Fake-password', stored)).toBe(false);
    expect(await verifyPassword('', stored)).toBe(false);
  });

  it('handles passwords with unicode and dollar signs', async () => {
    const pw = 'pä$$wörd 🗝️';
    expect(await verifyPassword(pw, await hashPassword(pw))).toBe(true);
  });

  it('honours the cost parameters stored with the hash', async () => {
    const stored = await hashPassword('fake-password');
    const [alg, , , , salt, hash] = stored.split('$');
    // same salt and key under other parameters: the derived key differs
    expect(await verifyPassword('fake-password', [alg, 1024, 8, 1, salt, hash].join('$'))).toBe(false);
  });

  it('refuses a stored value that is not an scrypt hash', async () => {
    const stored = await hashPassword('fake-password');
    expect(await verifyPassword('fake-password', stored.replace(/^scrypt/, 'bcrypt'))).toBe(false);
    expect(await verifyPassword('fake-password', 'scrypt$16384$8$1$salt')).toBe(false);
    expect(await verifyPassword('fake-password', '')).toBe(false);
    expect(await verifyPassword('fake-password', 'plain-text')).toBe(false);
  });
});
