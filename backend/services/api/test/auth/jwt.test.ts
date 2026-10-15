import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { signToken, verifyToken } from '#/auth/jwt.ts';

const SECRET = 'fake-jwt-secret-for-tests';
const T0 = Date.UTC(2026, 0, 1, 12);

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
/** a token signed by hand, to forge headers and claims */
const forge = (header: object, claims: object, secret = SECRET) => {
  const head = `${b64(header)}.${b64(claims)}`;
  return `${head}.${createHmac('sha256', secret).update(head).digest('base64url')}`;
};

afterEach(() => {
  vi.useRealTimers();
});

describe(signToken.name, () => {
  it('signs an HS256 JWT with the claims, iat and exp', () => {
    vi.useFakeTimers({ now: T0 });
    const token = signToken({ sub: 7, pid: 42, adm: true }, SECRET, 3600);
    const [header, body, sig] = token.split('.');
    expect(JSON.parse(Buffer.from(header, 'base64url').toString())).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(JSON.parse(Buffer.from(body, 'base64url').toString())).toEqual({ sub: 7, pid: 42, adm: true, iat: T0 / 1000, exp: T0 / 1000 + 3600 });
    expect(sig).toBe(createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url'));
  });
});

describe(verifyToken.name, () => {
  it('returns the claims of a valid token', () => {
    vi.useFakeTimers({ now: T0 });
    const token = signToken({ sub: 7, pid: 42 }, SECRET, 60);
    expect(verifyToken(token, SECRET)).toEqual({ sub: 7, pid: 42, iat: T0 / 1000, exp: T0 / 1000 + 60 });
  });

  it('refuses an expired token, accepting it up to its last second', () => {
    vi.useFakeTimers({ now: T0 });
    const token = signToken({ sub: 7 }, SECRET, 60);
    vi.setSystemTime(T0 + 60_000);
    expect(verifyToken(token, SECRET)).not.toBeNull();
    vi.setSystemTime(T0 + 60_001);
    expect(verifyToken(token, SECRET)).toBeNull();
  });

  it('refuses a token signed with another secret', () => {
    expect(verifyToken(signToken({ sub: 7 }, 'another-fake-secret', 60), SECRET)).toBeNull();
  });

  it('refuses a token whose claims or signature were tampered with', () => {
    const [header, body, sig] = signToken({ sub: 7, adm: false }, SECRET, 60).split('.');
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString());
    expect(verifyToken(`${header}.${b64({ ...claims, adm: true })}.${sig}`, SECRET)).toBeNull();
    expect(verifyToken(`${header}.${b64({ ...claims, sub: 8 })}.${sig}`, SECRET)).toBeNull();
    const flipped = Buffer.from(sig, 'base64url');
    flipped[0] ^= 1;
    expect(verifyToken(`${header}.${body}.${flipped.toString('base64url')}`, SECRET)).toBeNull();
    expect(verifyToken(`${header}.${body}.${sig.slice(0, -4)}`, SECRET)).toBeNull();
    expect(verifyToken(`${header}.${body}.`, SECRET)).toBeNull();
  });

  it('refuses another algorithm, even correctly signed', () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    expect(verifyToken(forge({ alg: 'none', typ: 'JWT' }, { sub: 7, exp }), SECRET)).toBeNull();
    expect(verifyToken(forge({ alg: 'HS512', typ: 'JWT' }, { sub: 7, exp }), SECRET)).toBeNull();
  });

  it('refuses a correctly signed token without a numeric sub, or with unreadable claims', () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    const header = { alg: 'HS256', typ: 'JWT' };
    expect(verifyToken(forge(header, { sub: '7', exp }), SECRET)).toBeNull();
    expect(verifyToken(forge(header, { exp }), SECRET)).toBeNull();
    const head = `${b64(header)}.${Buffer.from('not json').toString('base64url')}`;
    expect(verifyToken(`${head}.${createHmac('sha256', SECRET).update(head).digest('base64url')}`, SECRET)).toBeNull();
  });

  it('refuses malformed tokens', () => {
    for (const token of ['', 'abc', 'a.b', 'a.b.c.d', signToken({ sub: 7 }, SECRET, 60) + '.x']) expect(verifyToken(token, SECRET)).toBeNull();
  });
});
