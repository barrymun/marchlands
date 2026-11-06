/** The themes a player can choose (next-themes, which remembers the choice in localStorage, so a value never changes). */
export const Theme = { LIGHT: 'light', DARK: 'dark', SYSTEM: 'system' } as const;
export type Theme = (typeof Theme)[keyof typeof Theme];
