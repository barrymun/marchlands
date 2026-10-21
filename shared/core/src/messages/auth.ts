// Sign-in and account messages (see index.ts).
export const AUTH_MESSAGES = {
  notLoggedIn: [],
  needPlayer: [],
  wrongPassword: [],
  /** `wait`: a duration, until the next password is checked */
  tooManyTries: ['wait'],
  alreadyRegistered: [],
  accountNotFound: [],
  /** the reason is written by an administrator */
  banned: ['reason'],
} as const;
