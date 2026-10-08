// Colour standard for the UI. Colours carry meaning, so each one is used for one thing only:
//
//   hero attributes        politics green, attack red, intelligence blue (ATTRIBUTE_TONE, hero-attributes.ts)
//   running item bonuses   purple (ITEM_BONUS_*)
//   gains, success         green text, never a badge (GAIN_TEXT): +production, market buys, ✓ steps
//   losses, errors         red (LOSS_TEXT): negative rates, failed or rolled-back steps
//   needs attention        amber (WARN_TEXT): no mayor, storage full, skipped steps
//   status, finished, info neutral with an icon (STATUS_DONE): max level reached, all research complete

/** A running item bonus (production boosts, War Ensign, Vesta's, Quartermaster's …): badge background and text, light and dark. */
export const ITEM_BONUS_TONE = 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300';

/** The same bonus as plain text. */
export const ITEM_BONUS_TEXT = 'text-violet-700 dark:text-violet-400';

/** Plain text inside a tooltip, whose colours are inverted (dark in light mode, light in dark mode). */
export const ITEM_BONUS_TEXT_INVERTED = 'text-violet-300 dark:text-violet-700';

/** An outlined badge for a bonus that is running from another item (items sharing a bonus). */
export const ITEM_BONUS_OUTLINE = 'border-violet-500/40 text-violet-700 dark:text-violet-300';

/** A gain or a success, as text. */
export const GAIN_TEXT = 'text-emerald-600 dark:text-emerald-400';

/** A loss, an error or a failure, as text. */
export const LOSS_TEXT = 'text-destructive';

/** Something that needs the player's attention, as text. */
export const WARN_TEXT = 'text-amber-700 dark:text-amber-400';

/** A status or "finished" note (max level, all research complete): neutral text, shown with an icon such as CircleCheck. */
export const STATUS_DONE = 'text-muted-foreground';
