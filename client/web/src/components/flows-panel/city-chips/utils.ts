import type { ChipCity, CityChipData } from '@/components/flows-panel/city-chips/types';

/**
 * The chips of the chosen cities, in the player's order: cities of the same name (and historic level) share one, and
 * the one with the city in view comes first, so a limit never hides it. A chosen city the player no longer holds has none.
 */
export function cityChips(chosen: readonly number[], cities: readonly ChipCity[], currentCityId?: number): CityChipData[] {
  const chips = new Map<string, CityChipData>();
  for (const c of cities) {
    if (!chosen.includes(c.id)) continue;
    const key = `${c.historicLevel ?? ''}:${c.name}`;
    const chip = chips.get(key) ?? { key, name: c.name, historicLevel: c.historicLevel, here: false, cities: [] };
    chip.cities.push(c);
    chip.here ||= c.id === currentCityId;
    chips.set(key, chip);
  }
  const list = [...chips.values()];
  return [...list.filter((c) => c.here), ...list.filter((c) => !c.here)];
}

/**
 * The chips shown within a limit, and the cities of the rest for a "+3 more". One chip over the limit is shown rather
 * than hidden, as "+1 more" takes its room and says less. No limit shows them all.
 */
export function limitChips(chips: readonly CityChipData[], max?: number) {
  if (max == null || chips.length <= max + 1) return { shown: [...chips], hidden: [] };
  return { shown: chips.slice(0, max), hidden: chips.slice(max).flatMap((c) => c.cities) };
}
