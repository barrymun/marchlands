// Temporary accounts for the browser tests: signed up through the API (fx_e2e_…, AGENTS.md, Running stack), each with
// a player and a city, and listed for the global teardown to delete.
import { randomBytes } from 'node:crypto';
import { appendFileSync } from 'node:fs';

import { solveChallenge } from 'altcha-lib';
import { deriveKey } from 'altcha-lib/algorithms/pbkdf2';

import type {
  AuthSession,
  GetAuthChallengeResponse,
  PostAuthLoginData,
  PostAuthRegisterData,
  PostPlayerData,
  PostPlayerResponse,
} from '@marchlands/api-client';

import { api } from './api.ts';
import { accountsFile } from './stack.ts';

export interface Account {
  username: string;
  password: string;
  /** a bearer token for the API, which the `loggedIn` fixture also gives the page */
  token: string;
  city: { id: number; name: string; x: number; y: number };
}

/** The run's name, set by the global setup. */
export function runName(): string {
  const run = process.env.E2E_RUN;
  if (!run) throw new Error('E2E_RUN is unset: run the tests with npm run e2e, whose global setup names the run');
  return run;
}

/** Note an account for the teardown to delete; before it's made, so a failure halfway still cleans up. */
export function noteAccount(username: string) {
  appendFileSync(accountsFile(runName()), `${username}\n`);
}

/** The sign-up puzzle (GET /auth/challenge), solved with Node's PBKDF2 as tools/smoke/proof.mjs does. */
async function signUpProof(): Promise<PostAuthRegisterData['body']['proof']> {
  const challenge = await api<GetAuthChallengeResponse>('GET', '/auth/challenge');
  const solution = await solveChallenge({ challenge, deriveKey });
  if (!solution) throw new Error('GET /auth/challenge: no solution found');
  return { challenge, solution: { counter: solution.counter, derivedKey: solution.derivedKey } };
}

/** Sign up `fx_e2e_<run>_<n>` with a player and a city. */
export async function createAccount(n: number | string): Promise<Account> {
  const username = `fx_e2e_${runName()}_${n}`;
  const password = randomBytes(12).toString('base64url');
  noteAccount(username);
  const register: PostAuthRegisterData['body'] = { username, password, email: `${username}@example.test`, proof: await signUpProof() };
  const signedUp = await api<AuthSession>('POST', '/auth/register', register);
  const player: PostPlayerData['body'] = { userName: username.replaceAll('_', ''), castleName: `E2E Keep ${n}`, flag: 'E2E', sex: 0, zone: -1 };
  const created = await api<PostPlayerResponse>('POST', '/player', player, signedUp.token);
  const [city] = created.castles;
  if (!city) throw new Error(`POST /player made no city for ${username}`);
  // a token from before the player existed carries no player: log in again for one that does
  const login: PostAuthLoginData['body'] = { username, password };
  const { token } = await api<AuthSession>('POST', '/auth/login', login);
  return { username, password, token, city: { id: city.id, name: city.name, x: city.x, y: city.y } };
}
