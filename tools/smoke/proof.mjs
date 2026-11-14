// The proof of work POST /auth/register asks for (backend/services/api/src/auth/signup-proof.ts): a puzzle from
// GET /auth/challenge, solved with Node's PBKDF2 (about a second at the API's default difficulty).
import { solveChallenge } from 'altcha-lib';
import { deriveKey } from 'altcha-lib/algorithms/pbkdf2';

/** The password the scripts' accounts are made with (sign-up asks for 10 characters, and none anyone would guess). */
export const PASSWORD = 'smoke-test-only';
/** What they were made with before: an operator account from then (smoke_admin) still logs in with it. */
const OLD_PASSWORD = 'secret123';

/**
 * Log in as `username`, signing it up first if it doesn't exist. Answers the API's envelope (`{ ok, data }`) of
 * whichever call got furthest.
 */
export async function logInOrSignUp(base, username) {
  const post = async (path, body) =>
    (await fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json();
  for (const password of [PASSWORD, OLD_PASSWORD]) {
    const login = await post('/auth/login', { username, password });
    if (login.ok === 1) return login;
  }
  return post('/auth/register', { username, email: `${username}@example.test`, password: PASSWORD, proof: await signUpProof(base) });
}

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
