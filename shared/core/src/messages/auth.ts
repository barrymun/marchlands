// Sign-in and account messages (see index.ts).
export const AUTH_MESSAGES = {
  notLoggedIn: [],
  needPlayer: [],
  wrongPassword: [],
  /** `wait`: a duration, until the next password is checked */
  tooManyTries: ['wait'],
  alreadyRegistered: [],
  /** the sign-up's proof of work didn't hold (wrong, tampered with or already used) */
  signUpCheckFailed: [],
  /** the sign-up's proof of work expired before the form was sent */
  signUpCheckExpired: [],
  accountNotFound: [],
  /** the reason is written by an administrator */
  banned: ['reason'],
} as const;
