// The sign-up puzzle's worker (useSignUpProof, hooks.ts): tries counters with PBKDF2 through the browser's WebCrypto.
// altcha-lib's own PBKDF2 worker uses Node's crypto, so the browser gets this one.
import { deriveKey } from 'altcha-lib/algorithms/web/pbkdf2';
import { handler } from 'altcha-lib/workers/shared';

handler({ deriveKey });
