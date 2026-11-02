import { ItemId } from '#/item-ids.ts';

// Nobility titles (Evony Age 1). The original kept a `title` field but never changed it, so the requirements are the
// live game's as players recorded them (docs/reference/titles.md): prestige from 1,000 doubling to 256,000, gold, and 10
// medals of one kind with 5 of the next. *(design change)* No military rank is required: Marchlands has none.
// A title raises the number of cities a lord may own.

export interface TitleDef {
  id: number;
  /** cities a lord with this title may own */
  maxCities: number;
  /** prestige required to be promoted to this title (kept, not spent) */
  prestige: number;
  /** gold the promotion costs, from the city the player promotes in */
  gold: number;
  /** medals consumed by the promotion (item id -> count) */
  medals: Record<string, number>;
}

export const TITLES: [TitleDef, ...TitleDef[]] = [
  { id: 0, maxCities: 1, prestige: 0, gold: 0, medals: {} },
  { id: 1, maxCities: 2, prestige: 1_000, gold: 20_000, medals: { [ItemId.CROSS_MEDAL]: 10, [ItemId.ROSE_MEDAL]: 5 } },
  { id: 2, maxCities: 3, prestige: 2_000, gold: 40_000, medals: { [ItemId.ROSE_MEDAL]: 10, [ItemId.LION_MEDAL]: 5 } },
  { id: 3, maxCities: 4, prestige: 4_000, gold: 60_000, medals: { [ItemId.LION_MEDAL]: 10, [ItemId.HONOUR_MEDAL]: 5 } },
  { id: 4, maxCities: 5, prestige: 8_000, gold: 80_000, medals: { [ItemId.HONOUR_MEDAL]: 10, [ItemId.COURAGE_MEDAL]: 5 } },
  { id: 5, maxCities: 6, prestige: 16_000, gold: 100_000, medals: { [ItemId.COURAGE_MEDAL]: 10, [ItemId.WISDOM_MEDAL]: 5 } },
  { id: 6, maxCities: 7, prestige: 32_000, gold: 200_000, medals: { [ItemId.WISDOM_MEDAL]: 10, [ItemId.FREEDOM_MEDAL]: 5 } },
  { id: 7, maxCities: 8, prestige: 64_000, gold: 300_000, medals: { [ItemId.FREEDOM_MEDAL]: 10, [ItemId.JUSTICE_MEDAL]: 5 } },
  { id: 8, maxCities: 9, prestige: 128_000, gold: 400_000, medals: { [ItemId.JUSTICE_MEDAL]: 10, [ItemId.NATION_MEDAL]: 5 } },
  {
    id: 9,
    maxCities: 10,
    prestige: 256_000,
    gold: 500_000,
    medals: { [ItemId.CROSS_MEDAL]: 20, [ItemId.ROSE_MEDAL]: 15, [ItemId.LION_MEDAL]: 10, [ItemId.NATION_MEDAL]: 5 },
  },
];

/** The title by id, clamped to the ones there are. */
export const titleOf = (id: number): TitleDef => TITLES[Math.max(0, Math.min(TITLES.length - 1, id))] ?? TITLES[0];
export const maxCitiesFor = (title: number) => titleOf(title).maxCities;
/**
 * Valleys a city may occupy: one per Town Hall level; (marchlands) a held historic city one per its own level (12 to 18),
 * past its Town Hall's 10.
 */
export const maxValleysFor = (townHallLevel: number, historicLevel: number | null = null) => historicLevel ?? townHallLevel;
