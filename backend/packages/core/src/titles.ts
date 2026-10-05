// Nobility titles (Evony Age 1). The original kept a `title` field but never changed it.
// A title raises the number of cities a lord may own and is bought with prestige + medals.

export interface TitleDef {
  id: number;
  name: string;
  /** cities a lord with this title may own */
  maxCities: number;
  /** prestige required to be promoted to this title */
  prestige: number;
  /** medals consumed by the promotion (item id -> count) */
  medals: Record<string, number>;
}

export const TITLES: TitleDef[] = [
  { id: 0, name: 'Civilian', maxCities: 1, prestige: 0, medals: {} },
  { id: 1, name: 'Knight', maxCities: 2, prestige: 3_000, medals: { 'hero.loyalty.1': 1 } },
  { id: 2, name: 'Baronet', maxCities: 3, prestige: 10_000, medals: { 'hero.loyalty.2': 1 } },
  { id: 3, name: 'Baron', maxCities: 4, prestige: 30_000, medals: { 'hero.loyalty.3': 2 } },
  { id: 4, name: 'Viscount', maxCities: 5, prestige: 80_000, medals: { 'hero.loyalty.4': 2 } },
  { id: 5, name: 'Earl', maxCities: 6, prestige: 200_000, medals: { 'hero.loyalty.5': 3 } },
  { id: 6, name: 'Marquis', maxCities: 7, prestige: 500_000, medals: { 'hero.loyalty.6': 3 } },
  { id: 7, name: 'Duke', maxCities: 8, prestige: 1_200_000, medals: { 'hero.loyalty.7': 4 } },
  { id: 8, name: 'Furstin', maxCities: 9, prestige: 3_000_000, medals: { 'hero.loyalty.8': 4 } },
  { id: 9, name: 'Prince', maxCities: 10, prestige: 8_000_000, medals: { 'hero.loyalty.9': 5 } },
];

export const titleOf = (id: number): TitleDef => TITLES[Math.max(0, Math.min(TITLES.length - 1, id))];
export const maxCitiesFor = (title: number) => titleOf(title).maxCities;
/** Valleys a city may occupy: one per Town Hall level. */
export const maxValleysFor = (townHallLevel: number) => townHallLevel;
