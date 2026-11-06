// Words what the server tells the player (a message: code + params, see shared/core/src/messages) in the
// current locale. A code `<area>.<name>` is the key `<name>` in the namespace `msg-<area>`
// (src/locales/<locale>/msg-<area>.json). Params are worded first: numbers in the locale's format, game data
// by name, durations by their two largest units ("1h 30m"), shares as percents ("12.5%"), nested messages recursively, lists joined; `count` stays a number so the plural form can be chosen
// (write it as `{{count, number}}`).

import { type GameRef, GameRefKind, HeroBuffId, type ResourceKey } from '@marchlands/core';

import { fmtDecimal, fmtExact, percent, shortDuration } from '@/lib/format';
import { buildingName, gearName, itemCategoryName, itemName, rankName, techName, tileName, titleName, troopName, zoneName } from '@/lib/game-data';
import { i18n } from '@/lib/i18n';

/**
 * A message as it arrives: from core (`msg()`) or from the generated API types, which type game references
 * more loosely; both have this shape.
 */
export interface AnyMessage {
  code: string;
  params?: Record<string, unknown>;
}
type AnyRef = { ref: GameRef['ref']; id: number | string };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isMessage = (v: unknown): v is AnyMessage => isObject(v) && typeof v.code === 'string';
const isRef = (v: unknown): v is AnyRef => isObject(v) && typeof v.ref === 'string';
const isDuration = (v: unknown): v is { duration: number } => isObject(v) && typeof v.duration === 'number';
const isShare = (v: unknown): v is { share: number } => isObject(v) && typeof v.share === 'number';

/** The name of a piece of game data, in the current locale. */
export function gameRefName(r: AnyRef): string {
  const id = r.id;
  switch (r.ref) {
    case GameRefKind.TROOP:
      return troopName(Number(id));
    case GameRefKind.BUILDING:
      return buildingName(Number(id));
    case GameRefKind.TECH:
      return techName(Number(id));
    case GameRefKind.ITEM:
      return itemName(String(id));
    case GameRefKind.TITLE:
      return titleName(Number(id));
    case GameRefKind.TILE:
      return tileName(Number(id));
    case GameRefKind.ZONE:
      return zoneName(Number(id));
    case GameRefKind.RANK:
      return rankName(Number(id));
    case GameRefKind.GEAR:
      return gearName(String(id));
    case GameRefKind.ITEM_CATEGORY:
      return itemCategoryName(Number(id));
    case GameRefKind.RESOURCE:
      return i18n.t(`common:resourcesInline.${id as ResourceKey}`);
    case GameRefKind.STAT:
      return i18n.t(
        `common:heroAttributes.${({ [HeroBuffId.POWER]: 'attack', [HeroBuffId.MANAGEMENT]: 'politics', [HeroBuffId.STRATAGEM]: 'intelligence' } as const)[id as HeroBuffId]}`,
      );
  }
}

/** One param as text. */
export function paramText(v: unknown): string {
  if (typeof v === 'number') return Number.isInteger(v) ? fmtExact(v) : fmtDecimal(v, 2);
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(paramText).join(i18n.t('common:list.separator'));
  if (isMessage(v)) return translateMessage(v);
  if (isRef(v)) return gameRefName(v);
  if (isDuration(v)) return shortDuration(v.duration);
  if (isShare(v)) return percent(v.share, 1);
  return '';
}

/** The param i18next picks a plural form by: left a number, for it to read. */
const PLURAL_PARAM = 'count';

/** A server message in the current locale. */
export function translateMessage(m: AnyMessage): string {
  const dot = m.code.indexOf('.');
  const params: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(m.params ?? {})) params[k] = k === PLURAL_PARAM && typeof v === 'number' ? v : paramText(v);
  return i18n.t(`msg-${m.code.slice(0, dot)}:${m.code.slice(dot + 1)}` as never, params as never) as unknown as string;
}
