// Colour standard for the UI. Colours carry meaning, so each one is used for one thing only:
//
//   hero attributes        politics green, attack red, intelligence blue (ATTRIBUTE_TONE, hero-attributes.ts)
//   running item bonuses   purple (ITEM_BONUS_*)
//   gains, success         green text, never a badge (GAIN_TEXT): +production, market buys, ✓ steps, instant training
//   losses, errors         red (LOSS_TEXT): negative rates, failed or rolled-back steps
//   needs attention        amber (WARN_TEXT): no mayor, storage full, skipped steps
//   live right now         a green dot (LIVE_DOT, with LIVE_EDGE on its row): a flow that is active, as the top bar's connection dot
//   status, finished, info neutral with an icon (STATUS_DONE): max level reached, all research complete
//   a hero at max level    gold with a trophy (MAX_LEVEL_TEXT, HeroLevel): the milestone of the hero's level itself
//   a held historic city   its flags' colour by level, a solid HC badge with a castle, never plain text (HISTORIC_TONE, HistoricBadge)

/** A running item bonus (production boosts, War Ensign, Vesta's, Quartermaster's …): badge background and text, light and dark. */
export const ITEM_BONUS_TONE = 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300';

/** The same bonus as plain text. */
export const ITEM_BONUS_TEXT = 'text-violet-700 dark:text-violet-400';

/** Plain text inside a tooltip, whose colours are inverted (dark in light mode, light in dark mode). */
export const ITEM_BONUS_TEXT_INVERTED = 'text-violet-300 dark:text-violet-700';

/** A gain or a success, as text. @public (AGENTS.md, UI conventions) */
export const GAIN_TEXT = 'text-emerald-600 dark:text-emerald-400';

/** A loss, an error or a failure, as text. @public (AGENTS.md, UI conventions) */
export const LOSS_TEXT = 'text-destructive';

/** Something that needs the player's attention, as text. */
export const WARN_TEXT = 'text-amber-700 dark:text-amber-400';

/** Something live right now, as a dot. */
export const LIVE_DOT = 'bg-emerald-500';

/** The edge of a row that is live right now. */
export const LIVE_EDGE = 'border-s-emerald-500';

/** A hero's level at the maximum (BALANCE.heroMaxLevel), shown with a trophy by HeroLevel. */
export const MAX_LEVEL_TEXT = 'text-yellow-700 dark:text-yellow-300';

/** A status or "finished" note (max level, all research complete): neutral text, shown with an icon such as CircleCheck. */
export const STATUS_DONE = 'text-muted-foreground';

/**
 * A held historic city's badge by its level: solid, in the colours of its flags on the map (the sprites' palette,
 * tools/art/pixel.ts: `banner` red at 12, the darker `greenD` at 14 so it isn't the hero's pale Politics green, `blue`
 * at 16, `gold` at Atlantis), the same in both themes, always a badge with a castle so it isn't read as a gain, loss or
 * warning.
 */
export const HISTORIC_TONE = {
  12: 'bg-[#b22c2c] text-white',
  14: 'bg-[#366844] text-white',
  16: 'bg-[#4870ac] text-white',
  18: 'bg-[#e8ba48] text-[#3a2a06]',
} as const satisfies Record<12 | 14 | 16 | 18, string>;
