// Minimal HS256 JWT (RFC 7519) using node:crypto.
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface TokenClaims {
  /** account id */
  sub: number;
  /** player id in this world (absent until a player is created) */
  pid?: number;
  adm?: boolean;
  iat: number;
  exp: number;
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');
const HEADER = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));

export function signToken(claims: Omit<TokenClaims, 'iat' | 'exp'>, secret: string, ttlSeconds: number): string {
  const iat = Math.floor(Date.now() / 1000);
  const body = b64url(JSON.stringify({ ...claims, iat, exp: iat + ttlSeconds }));
  const sig = createHmac('sha256', secret).update(`${HEADER}.${body}`).digest('base64url');
  return `${HEADER}.${body}.${sig}`;
}

export function verifyToken(token: string, secret: string): TokenClaims | null {
  const [head, body, signature, ...extra] = token.split('.');
  if (head !== HEADER || body === undefined || signature === undefined || extra.length > 0) return null;
  const expected = createHmac('sha256', secret).update(`${head}.${body}`).digest();
  const given = Buffer.from(signature, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TokenClaims;
    if (typeof claims.sub !== 'number' || typeof claims.exp !== 'number' || claims.exp * 1000 < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}
