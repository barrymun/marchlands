// Proof of work on sign-up (ALTCHA, altcha-lib): before an account is made, the browser spends about a second finding
// the hidden counter of a puzzle the server signed. Invisible to players (the sign-up form solves it while they type),
// self-hosted, and no player data goes to a third party; it makes accounts made in bulk by a script cost something.
// The work is PBKDF2/SHA-256, which browsers compute natively: about (counter + 1) × cost rounds. Each solved puzzle
// is accepted once, remembered in memory until it expires (one API instance; a restart only forgets them). A sign-up
// refused because the name or email is taken has spent its puzzle too: asking which names exist costs the work each time.

import { createHmac } from 'node:crypto';

import { CappedMap, createChallenge, randomInt, verifySolution } from 'altcha-lib';
import { deriveKey } from 'altcha-lib/algorithms/pbkdf2';

import type { SignUpChallenge, SignUpProof } from '@marchlands/contracts';

export interface SignUpProofConfig {
  /** PBKDF2 rounds per counter tried */
  cost: number;
  /** the hidden counter is picked from counterMin to counterMax */
  counterMin: number;
  counterMax: number;
  /** how long a puzzle stays valid, ms */
  expiresAfterMs: number;
}

/** What checking a proof found: `ok` spends it. */
export const ProofCheck = { OK: 'ok', EXPIRED: 'expired', INVALID: 'invalid', USED: 'used' } as const;
export type ProofCheck = (typeof ProofCheck)[keyof typeof ProofCheck];

const ALGORITHM = 'PBKDF2/SHA-256';
/** Spent puzzles remembered at most: past it the oldest is forgotten (it has long expired at any real rate). */
const MAX_SPENT = 100_000;

export class SignUpProofs {
  private readonly config: SignUpProofConfig;
  private readonly secret: string;
  private readonly now: () => number;
  /** by signature */
  private readonly spent = new CappedMap<string, true>({ maxSize: MAX_SPENT });

  /** The signing secret is derived from the API's JWT secret, so it needs no setting of its own. */
  constructor(config: SignUpProofConfig, jwtSecret: string, now: () => number = () => Date.now()) {
    this.config = config;
    this.secret = createHmac('sha256', jwtSecret).update('marchlands sign-up challenge').digest('hex');
    this.now = now;
  }

  /** A new signed puzzle. */
  async challenge(): Promise<SignUpChallenge> {
    const { cost, counterMin, counterMax, expiresAfterMs } = this.config;
    const challenge = await createChallenge({
      algorithm: ALGORITHM,
      cost,
      counter: randomInt(counterMax, counterMin),
      deriveKey,
      hmacSignatureSecret: this.secret,
      expiresAt: Math.ceil((this.now() + expiresAfterMs) / 1000),
    });
    return challenge as SignUpChallenge;
  }

  /** Checks a solved puzzle, and spends it when it holds. */
  async check(proof: SignUpProof): Promise<ProofCheck> {
    let result;
    try {
      result = await verifySolution({ challenge: proof.challenge, solution: proof.solution, deriveKey, hmacSignatureSecret: this.secret });
    } catch {
      return ProofCheck.INVALID;
    }
    if (result.expired) return ProofCheck.EXPIRED;
    if (!result.verified) return ProofCheck.INVALID;
    // synchronous, so two sign-ups with the same proof can't both get past it
    return this.spent.setIfAbsent(proof.challenge.signature, true) ? ProofCheck.OK : ProofCheck.USED;
  }
}
