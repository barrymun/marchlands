// Which passwords a new account may not choose. The length is the contract's (PASSWORD_MIN_LENGTH); this refuses the
// ones long enough but first on any guesser's list. Checked on sign-up only: logging in takes the password an account
// already has.

/**
 * Passwords of PASSWORD_MIN_LENGTH or more that turn up most in leaked lists, in lower case (the check ignores
 * case). Shorter ones need no entry: the length already refuses them.
 */
const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  '1234567890',
  '0123456789',
  '0987654321',
  '9876543210',
  '12345678910',
  '123456789a',
  '1234567891',
  '123456789q',
  '1234512345',
  '1122334455',
  '1q2w3e4r5t',
  '1q2w3e4r5t6y',
  '1qaz2wsx3edc',
  'q1w2e3r4t5',
  'q1w2e3r4t5y6',
  'qwertyuiop',
  'qwerty12345',
  'qwerty123456',
  'qwertyuiop123',
  'asdfghjkl;',
  'asdfghjkl123',
  'zxcvbnm123',
  'password12',
  'password123',
  'password1234',
  'password12345',
  'passw0rd123',
  'p@ssw0rd123',
  'mypassword',
  'mypassword1',
  'password01',
  'passwordpassword',
  'iloveyou12',
  'iloveyou123',
  'iloveyou1234',
  'letmein123',
  'letmein1234',
  'welcome123',
  'welcome1234',
  'admin12345',
  'administrator',
  'changeme123',
  'abcdefghij',
  'abcdefghijk',
  'abc1234567',
  'abcd123456',
  'a123456789',
  'aa12345678',
  'football123',
  'baseball123',
  'superman123',
  'starwars123',
  'dragon1234',
  'monkey1234',
  'sunshine123',
  'princess123',
  'liverpool1',
  'liverpool123',
  'chocolate1',
  'michael123',
  'jennifer123',
  'trustno1trustno1',
  'marchlands',
  'marchlands1',
  'marchlands123',
]);

/** One character, however many times: "aaaaaaaaaa". */
const oneCharacter = (password: string) => new Set(password).size === 1;

/**
 * Whether a password is too easy to guess for a new account: a common one, one character repeated, or the
 * account's own username or email. Case is ignored.
 */
export function isWeakPassword(password: string, account: { username: string; email: string }): boolean {
  const lower = password.toLowerCase();
  return COMMON_PASSWORDS.has(lower) || oneCharacter(lower) || lower === account.username.toLowerCase() || lower === account.email.toLowerCase();
}
