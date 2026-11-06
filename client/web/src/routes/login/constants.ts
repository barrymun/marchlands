/** What the login page's form does: log in, or create an account. */
export const AuthMode = { LOGIN: 'login', REGISTER: 'register' } as const;
export type AuthMode = (typeof AuthMode)[keyof typeof AuthMode];
