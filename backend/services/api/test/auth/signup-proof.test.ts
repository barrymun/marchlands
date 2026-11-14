import { solveChallenge } from 'altcha-lib';
import { deriveKey } from 'altcha-lib/algorithms/pbkdf2';
import { describe, expect, it } from 'vitest';

import type { SignUpChallenge, SignUpProof } from '@marchlands/contracts';

import { ProofCheck, type SignUpProofConfig, SignUpProofs } from '#/auth/signup-proof.ts';

const CONFIG: SignUpProofConfig = { cost: 10, counterMin: 20, counterMax: 40, expiresAfterMs: 10 * 60_000 };

/** The puzzle solved the way the browser does it. */
async function solve(challenge: SignUpChallenge): Promise<SignUpProof> {
  const solution = await solveChallenge({ challenge, deriveKey });
  return { challenge, solution: { counter: solution!.counter, derivedKey: solution!.derivedKey } };
}

describe(SignUpProofs.name, () => {
  it('makes signed PBKDF2 puzzles with a hidden counter in the configured range', async () => {
    const proofs = new SignUpProofs(CONFIG, 'test-jwt-secret');
    for (let i = 0; i < 5; i++) {
      const { challenge, solution } = await solve(await proofs.challenge());
      expect(challenge.parameters).toMatchObject({ algorithm: 'PBKDF2/SHA-256', cost: 10 });
      expect(solution.counter).toBeGreaterThanOrEqual(20);
      expect(solution.counter).toBeLessThanOrEqual(40);
    }
  });

  it('accepts a solved puzzle once', async () => {
    const proofs = new SignUpProofs(CONFIG, 'test-jwt-secret');
    const proof = await solve(await proofs.challenge());
    expect(await proofs.check(proof)).toBe(ProofCheck.OK);
    expect(await proofs.check(proof)).toBe(ProofCheck.USED);
  });

  it('refuses a wrong answer, and a malformed one', async () => {
    const proofs = new SignUpProofs(CONFIG, 'test-jwt-secret');
    const proof = await solve(await proofs.challenge());
    expect(await proofs.check({ ...proof, solution: { ...proof.solution, counter: proof.solution.counter - 1 } })).toBe(ProofCheck.INVALID);
    expect(await proofs.check({ ...proof, solution: { ...proof.solution, derivedKey: 'not hex' } })).toBe(ProofCheck.INVALID);
  });

  it('refuses a puzzle made easier, or signed with another secret', async () => {
    const proofs = new SignUpProofs(CONFIG, 'test-jwt-secret');
    const { challenge, solution } = await solve(await proofs.challenge());
    expect(await proofs.check({ challenge: { ...challenge, parameters: { ...challenge.parameters, cost: 1 } }, solution })).toBe(ProofCheck.INVALID);
    const elsewhere = new SignUpProofs(CONFIG, 'another-jwt-secret');
    expect(await proofs.check(await solve(await elsewhere.challenge()))).toBe(ProofCheck.INVALID);
  });

  it('refuses a puzzle past its expiry', async () => {
    const twentyMinutesAgo = Date.now() - 20 * 60_000;
    const proofs = new SignUpProofs(CONFIG, 'test-jwt-secret', () => twentyMinutesAgo);
    expect(await proofs.check(await solve(await proofs.challenge()))).toBe(ProofCheck.EXPIRED);
  });
});
