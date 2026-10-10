import type { GetPlayerResponse, HeroBean } from '@marchlands/api-client';

/** Apply a HeroUpdate push to a city's hero list (updateType 1 = the hero left). */
export function patchHeroes(heros: HeroBean[], hero: HeroBean, updateType: number): HeroBean[] {
  const rest = heros.filter((h) => h.id !== hero.id);
  if (updateType === 1) return rest;
  return heros.some((h) => h.id === hero.id) ? heros.map((h) => (h.id === hero.id ? hero : h)) : [...rest, hero];
}

/** The same HeroUpdate applied to the hero list of one of the player's cities in the login state. */
export function patchPlayerHeroes(player: GetPlayerResponse, castleId: number, hero: HeroBean, updateType: number): GetPlayerResponse {
  return { ...player, castles: player.castles.map((c) => (c.id === castleId ? { ...c, heros: patchHeroes(c.heros, hero, updateType) } : c)) };
}

/** Name of a market resource type (0 food … 3 iron) for messages. */
export const resourceName = (resType: number) => ['food', 'lumber', 'stone', 'iron'][resType] ?? 'goods';
