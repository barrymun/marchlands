// The proof of work POST /auth/register asks for (backend/services/api/src/auth/signup-proof.ts): a puzzle from
// GET /auth/challenge, solved with Node's PBKDF2 (about a second at the API's default difficulty).
import { solveChallenge } from 'altcha-lib';
import { deriveKey } from 'altcha-lib/algorithms/pbkdf2';

/** A solved sign-up puzzle from the API at `base` (…/api/v1), to send as `proof`. */
export async function signUpProof(base) {
  const res = await fetch(`${base}/auth/challenge`);
  const body = await res.json();
  if (body.ok !== 1) throw new Error(`GET /auth/challenge answered ${res.status} ${JSON.stringify(body)}`);
  const challenge = body.data;
  const solution = await solveChallenge({ challenge, deriveKey });
  if (!solution) throw new Error('GET /auth/challenge: no solution found');
  return { challenge, solution: { counter: solution.counter, derivedKey: solution.derivedKey } };
}
