// Names of game data in the current locale, by id: troops and fortifications, buildings, research, items, titles,
// map tiles, zones, NPC factions, alliance ranks, gear pieces and item categories. They live in the `data-<kind>` locale
// namespaces (src/locales/<locale>/data-*.json), keyed by the id the game uses; nothing in core holds them.

import type { FactionId } from '@marchlands/core';
import { i18n } from '@/lib/i18n';

/** A name from a `data-<kind>` namespace; ids may contain dots (item ids), so keys are not split. */
const dataName = (ns: string, id: string | number, fallback: () => string): string => {
  const key = String(id);
  const opts = { ns, keySeparator: false } as never;
  return i18n.exists(key, opts) ? (i18n.t(key, opts) as unknown as string) : fallback();
};

export const troopName = (id: number) => dataName('data-troops', id, () => i18n.t('common:fallback.unit', { id }));
export const buildingName = (typeId: number) => dataName('data-buildings', typeId, () => i18n.t('common:fallback.building', { id: typeId }));
export const techName = (id: number) => dataName('data-techs', id, () => i18n.t('common:fallback.tech', { id }));
export const itemName = (id: string) => dataName('data-items', id, () => id);
export const titleName = (id: number) => dataName('data-titles', id, () => String(id));
/**
 * A historic city's name, by its place (`x,y`), or null: level 14s, 16s and Atlantis have names, level 12s don't
 * (docs/reference/historic-cities.md, Names).
 */
export const historicName = (x: number, y: number): string | null => {
  const opts = { ns: 'data-historic', keySeparator: false } as never;
  return i18n.exists(`${x},${y}`, opts) ? (i18n.t(`${x},${y}`, opts) as unknown as string) : null;
};
/**
 * A state's name for use inside a sentence or a title: the data names are in capitals, as on the original's map, so
 * here they're written in title case (scripts without case are unchanged).
 */
export const stateName = (zoneId: number) => {
  const lang = i18n.language;
  return zoneName(zoneId)
    .toLocaleLowerCase(lang)
    .replace(/(^|\s)(\p{L})/gu, (_m, space: string, letter: string) => space + letter.toLocaleUpperCase(lang));
};
/** A seat title's name: Ruler of a state (its name in title case, stateName), Sovereign of Atlantis. */
export const seatTitleName = (title: { level: number; zoneId: number }) =>
  title.level === 18 ? i18n.t('common:seatTitle.atlantis') : i18n.t('common:seatTitle.ruler', { state: stateName(title.zoneId) });
export const tileName = (type: number) => dataName('data-tiles', type, () => i18n.t('common:fallback.tile', { id: type }));
export const zoneName = (id: number) => dataName('data-zones', id, () => String(id));
export const factionName = (id: FactionId) => dataName('data-factions', id, () => id);
export const rankName = (rank: number) => dataName('data-ranks', rank, () => String(rank));
export const gearName = (piece: string) => dataName('data-gear', piece, () => piece);
export const itemCategoryName = (type: number) => dataName('data-item-categories', type, () => String(type));
/** An item's short name where it has one (a medal without "Medal": "Cross"), else its name. */
export const itemShortName = (id: string) => dataName('data-items', `${id}.short`, () => itemName(id));

/** A quest's name (`data-quests` `quest.<id>`). */
export const questName = (id: number) => {
  const key = `data-quests:quest.${id}` as never;
  return i18n.exists(key) ? (i18n.t(key) as unknown as string) : String(id);
};
/** A quest group's name (`data-quests` `group.<id>`, by its config_quests row id). */
export const questGroupName = (id: number) => {
  const key = `data-quests:group.${id}` as never;
  return i18n.exists(key) ? (i18n.t(key) as unknown as string) : String(id);
};
