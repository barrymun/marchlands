// scrypt password hashing: "scrypt$N$r$p$salt$hash" (base64url parts).
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const scrypt = (pw: string, salt: Buffer, len: number, opts: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) => scryptCb(pw, salt, len, opts, (e, k) => (e ? reject(e) : resolve(k))));

const N = 16384,
  r = 8,
  p = 1,
  LEN = 32;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, LEN, { N, r, p });
  return ['scrypt', N, r, p, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, rr, pp, salt, hash] = stored.split('$');
  if (alg !== 'scrypt' || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const key = await scrypt(password, Buffer.from(salt, 'base64url'), expected.length, {
    N: Number(n),
    r: Number(rr),
    p: Number(pp),
  });
  return timingSafeEqual(key, expected);
}
