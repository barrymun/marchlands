// Sign-in and account messages (see index.ts).
export const AUTH_MESSAGES = {
  notLoggedIn: [],
  needPlayer: [],
  wrongPassword: [],
  alreadyRegistered: [],
  accountNotFound: [],
  /** the reason is written by an administrator */
  banned: ['reason'],
} as const;
