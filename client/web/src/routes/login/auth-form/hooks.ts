import { useEffect, useState } from 'react';
import { getAuthChallenge, type SignUpProofInput } from '@marchlands/api-client';

/** A fresh puzzle this long before the one solved expires, so a player who lingers on the form never sends a stale one. */
const RENEW_BEFORE_MS = 60_000;

/**
 * The sign-up's proof of work (GET /auth/challenge, backend/services/api/src/auth/signup-proof.ts): fetched and solved
 * in a worker as soon as the form opens, so it's ready by the time the player has typed (about a second on a desktop,
 * a few on a slow phone). The solver is loaded only here, so it stays out of the first page. `renew` starts again
 * with a new puzzle, after the server refused one.
 */
export function useSignUpProof(enabled: boolean) {
  const [proof, setProof] = useState<SignUpProofInput | null>(null);
  const [failed, setFailed] = useState(false);
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let renewTimer: ReturnType<typeof setTimeout> | undefined;
    void (async () => {
      try {
        const { data: challenge } = await getAuthChallenge({ throwOnError: true, signal: controller.signal });
        const { solveChallengeWorkers } = await import('altcha-lib');
        // one worker: more didn't make PBKDF2 any faster in the browser, and phones have few cores to spare
        const solution = await solveChallengeWorkers({
          challenge,
          concurrency: 1,
          controller,
          createWorker: () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }),
        });
        if (controller.signal.aborted) return;
        if (!solution) throw new Error('no solution');
        setProof({ challenge, solution: { counter: solution.counter, derivedKey: solution.derivedKey } });
        renewTimer = setTimeout(
          () => {
            setProof(null);
            setRound((r) => r + 1);
          },
          challenge.parameters.expiresAt * 1000 - Date.now() - RENEW_BEFORE_MS,
        );
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    })();
    return () => {
      controller.abort();
      clearTimeout(renewTimer);
    };
  }, [enabled, round]);

  const renew = () => {
    setProof(null);
    setFailed(false);
    setRound((r) => r + 1);
  };
  return { proof, failed, renew };
}
