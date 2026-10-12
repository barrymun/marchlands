import { ItemId } from '#/item-ids.ts';
// Nobility titles (Evony Age 1). The original kept a `title` field but never changed it.
// A title raises the number of cities a lord may own and is bought with prestige + medals.

export interface TitleDef {
  id: number;
  /** cities a lord with this title may own */
  maxCities: number;
  /** prestige required to be promoted to this title */
  prestige: number;
  /** medals consumed by the promotion (item id -> count) */
  medals: Record<string, number>;
}

export const TITLES: TitleDef[] = [
  { id: 0, maxCities: 1, prestige: 0, medals: {} },
  { id: 1, maxCities: 2, prestige: 3_000, medals: { [ItemId.CROSS_MEDAL]: 1 } },
  { id: 2, maxCities: 3, prestige: 10_000, medals: { [ItemId.ROSE_MEDAL]: 1 } },
  { id: 3, maxCities: 4, prestige: 30_000, medals: { [ItemId.LION_MEDAL]: 2 } },
  { id: 4, maxCities: 5, prestige: 80_000, medals: { [ItemId.HONOUR_MEDAL]: 2 } },
  { id: 5, maxCities: 6, prestige: 200_000, medals: { [ItemId.COURAGE_MEDAL]: 3 } },
  { id: 6, maxCities: 7, prestige: 500_000, medals: { [ItemId.WISDOM_MEDAL]: 3 } },
  { id: 7, maxCities: 8, prestige: 1_200_000, medals: { [ItemId.FREEDOM_MEDAL]: 4 } },
  { id: 8, maxCities: 9, prestige: 3_000_000, medals: { [ItemId.JUSTICE_MEDAL]: 4 } },
  { id: 9, maxCities: 10, prestige: 8_000_000, medals: { [ItemId.NATION_MEDAL]: 5 } },
];

export const titleOf = (id: number): TitleDef => TITLES[Math.max(0, Math.min(TITLES.length - 1, id))];
export const maxCitiesFor = (title: number) => titleOf(title).maxCities;
/** Valleys a city may occupy: one per Town Hall level. */
export const maxValleysFor = (townHallLevel: number) => townHallLevel;
