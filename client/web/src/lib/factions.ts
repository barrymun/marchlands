// The NPC factions' colours (core's factions.ts): a swatch in lists and the map's key, and a tint over the zones each
// holds on the map. Their own colours, apart from the meanings in tones.ts (gains, losses, warnings, item bonuses) and
// the map's outlines (your valleys, your city, other players by relation). Also how a player's standing with a faction
// (core's reputation.ts) reads: its band, its value and its colour.

import { type FactionId, StandingTier, standingTier } from '@marchlands/core';

import { fmtDecimal } from '@/lib/format';
import { i18n } from '@/lib/i18n';
import { GAIN_TEXT, LOSS_TEXT } from '@/lib/tones';

export const FACTION_STYLE: Record<FactionId, { swatch: string; tint: string }> = {
  saxon: { swatch: 'bg-blue-500', tint: 'fill-blue-500/25' },
  lotharingian: { swatch: 'bg-cyan-500', tint: 'fill-cyan-500/25' },
  franconian: { swatch: 'bg-orange-500', tint: 'fill-orange-500/25' },
  bohemian: { swatch: 'bg-slate-500', tint: 'fill-slate-500/30' },
  italian: { swatch: 'bg-pink-500', tint: 'fill-pink-500/25' },
};

/** A standing or a change in it, signed, to one decimal: +12.5, −3, 0. */
export function standingText(n: number): string {
  const text = fmtDecimal(Math.abs(n), 1);
  if (text === fmtDecimal(0, 1)) return text;
  return `${n < 0 ? '−' : '+'}${text}`;
}

/** The name of a standing's band: Hostile … Honoured. */
export const standingTierName = (n: number) => i18n.t(`common:standing.${standingTier(n)}`);

/** The colour a standing reads in: below neutral as a loss, above it as a gain, neutral plain. */
export function standingTone(n: number): string {
  const tier = standingTier(n);
  if (tier === StandingTier.HOSTILE || tier === StandingTier.UNFRIENDLY) return LOSS_TEXT;
  if (tier === StandingTier.FRIENDLY || tier === StandingTier.HONOURED) return GAIN_TEXT;
  return '';
}
