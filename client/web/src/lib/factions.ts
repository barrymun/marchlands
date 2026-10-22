// The NPC factions' colours (core's factions.ts): a swatch in lists and the map's key, and a tint over the zones each
// holds on the map. Their own colours, apart from the meanings in tones.ts (gains, losses, warnings, item bonuses) and
// the map's outlines (your valleys, your city, other players by relation).

import type { FactionId } from '@marchlands/core';

export const FACTION_STYLE: Record<FactionId, { swatch: string; tint: string }> = {
  saxon: { swatch: 'bg-blue-500', tint: 'fill-blue-500/25' },
  lotharingian: { swatch: 'bg-cyan-500', tint: 'fill-cyan-500/25' },
  franconian: { swatch: 'bg-orange-500', tint: 'fill-orange-500/25' },
  bohemian: { swatch: 'bg-slate-500', tint: 'fill-slate-500/30' },
  italian: { swatch: 'bg-pink-500', tint: 'fill-pink-500/25' },
};
