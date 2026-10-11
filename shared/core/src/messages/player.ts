// Player account: create, rename, title, gender, truce, holiday, presets, bookmarks, system mail (see index.ts).
export const PLAYER_MESSAGES = {
  /** creating a player on an account that already has a city */
  accountExists: [],
  nameTaken: [],
  sameName: [],
  /** hours until the player may rename again */
  renameCooldown: ['count'],
  sameGender: [],
  /** hours until the player may change gender again */
  genderCooldown: ['count'],
  /** a face or gender the player may not choose (or the face was already changed) */
  invalidSetting: [],
  invalidFlag: [],
  'title.highest': [],
  /** the prestige the next title needs */
  'title.prestigeRequired': ['prestige'],
  'title.notEnoughMedals': [],
  /** holiday mode: the longest holiday in days */
  'holiday.invalidDays': ['max'],
  'holiday.troopsOut': [],
  'truce.cooldown': [],
  /** why another player can't be attacked (an error, and the reason a march turns back) */
  'protected.beginner': [],
  'protected.truce': [],
  'protected.holiday': [],
  /** the most bookmarks a player can keep */
  'bookmark.tooMany': ['count'],
  /** the longest preset name, in characters */
  'preset.nameLength': ['count'],
  /** the most army presets a player can keep */
  'preset.tooMany': ['count'],
  'mail.protectionExpired.title': [],
  'mail.protectionExpired.content': [],
} as const;
