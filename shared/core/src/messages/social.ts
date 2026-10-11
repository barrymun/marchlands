// Friends, blocks and chat (see index.ts).
export const SOCIAL_MESSAGES = {
  /** the player named themselves (friend, block, private chat) */
  selfTarget: [],
  emptyMessage: [],
  /** count: the most characters a message may have */
  messageTooLong: ['count'],
  muted: [],
  notInAlliance: [],
} as const;
