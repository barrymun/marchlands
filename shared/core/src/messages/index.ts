// (marchlands) Everything the server tells a player is a message: a code plus params, never a sentence. The client
// words it in the player's language (client/web/src/lib/messages.ts, locale files msg-<area>.json), so the server
// stays language-free and all wording lives in the locale files.
//
// A code is `<area>.<name>` (`hero.locked`). Each area has a registry file here listing its messages and the
// names of their params; `msg()` checks both at compile time, and the client's locale tests check every code
// has text in every locale with exactly those placeholders.
//
// A param is a number, a string (names the player chose, coordinates), a nested message, a reference to game
// data the client names itself (troops, buildings, items …), a length of time (`dur(ms)`, real milliseconds, which
// the client shows as a duration), a share (`share(0.25)`, which the client shows as a percent: 25%), or a list of these.

import { GameRefKind, type HeroBuffId, type ResourceKey } from '#/constants.ts';
import { ADMIN_MESSAGES } from '#/messages/admin.ts';
import { ALLIANCE_MESSAGES } from '#/messages/alliance.ts';
import { ARMY_MESSAGES } from '#/messages/army.ts';
import { AUTH_MESSAGES } from '#/messages/auth.ts';
import { BUFF_MESSAGES } from '#/messages/buff.ts';
import { BUILDING_INFO_MESSAGES } from '#/messages/building-info.ts';
import { BUILDING_MESSAGES } from '#/messages/building.ts';
import { CITY_MESSAGES } from '#/messages/city.ts';
import { COMMON_MESSAGES } from '#/messages/common.ts';
import { FLOW_MESSAGES } from '#/messages/flow.ts';
import { HERO_MESSAGES } from '#/messages/hero.ts';
import { ITEM_INFO_MESSAGES } from '#/messages/item-info.ts';
import { ITEM_MESSAGES } from '#/messages/item.ts';
import { MAIL_MESSAGES } from '#/messages/mail.ts';
import { MARKET_MESSAGES } from '#/messages/market.ts';
import { PLAYER_MESSAGES } from '#/messages/player.ts';
import { QUEST_INFO_MESSAGES } from '#/messages/quest-info.ts';
import { QUEST_MESSAGES } from '#/messages/quest.ts';
import { REPORT_MESSAGES } from '#/messages/report.ts';
import { RESEARCH_MESSAGES } from '#/messages/research.ts';
import { SOCIAL_MESSAGES } from '#/messages/social.ts';
import { TECH_INFO_MESSAGES } from '#/messages/tech-info.ts';
import { TRAINING_MESSAGES } from '#/messages/training.ts';
import { TROOP_INFO_MESSAGES } from '#/messages/troop-info.ts';
import { WORLD_MESSAGES } from '#/messages/world.ts';

export const MESSAGES = {
  common: COMMON_MESSAGES,
  auth: AUTH_MESSAGES,
  questInfo: QUEST_INFO_MESSAGES,
  itemInfo: ITEM_INFO_MESSAGES,
  troopInfo: TROOP_INFO_MESSAGES,
  techInfo: TECH_INFO_MESSAGES,
  buildingInfo: BUILDING_INFO_MESSAGES,
  buff: BUFF_MESSAGES,
  flow: FLOW_MESSAGES,
  quest: QUEST_MESSAGES,
  world: WORLD_MESSAGES,
  mail: MAIL_MESSAGES,
  social: SOCIAL_MESSAGES,
  item: ITEM_MESSAGES,
  market: MARKET_MESSAGES,
  research: RESEARCH_MESSAGES,
  training: TRAINING_MESSAGES,
  admin: ADMIN_MESSAGES,
  player: PLAYER_MESSAGES,
  city: CITY_MESSAGES,
  building: BUILDING_MESSAGES,
  hero: HERO_MESSAGES,
  report: REPORT_MESSAGES,
  army: ARMY_MESSAGES,
  alliance: ALLIANCE_MESSAGES,
} as const satisfies Record<string, Record<string, readonly string[]>>;

type Registry = typeof MESSAGES;
export type MsgArea = keyof Registry;
export type MsgCode = { [A in MsgArea]: `${A}.${Extract<keyof Registry[A], string>}` }[MsgArea];
type ParamNames<C extends MsgCode> = C extends `${infer A extends MsgArea}.${infer K}`
  ? K extends keyof Registry[A]
    ? Registry[A][K] extends readonly string[]
      ? Registry[A][K][number]
      : never
    : never
  : never;

/** Game data the client names in the player's language (by id). */
export type GameRef =
  | { ref: typeof GameRefKind.TROOP; id: number }
  | { ref: typeof GameRefKind.BUILDING; id: number }
  | { ref: typeof GameRefKind.TECH; id: number }
  | { ref: typeof GameRefKind.ITEM; id: string }
  | { ref: typeof GameRefKind.TITLE; id: number }
  | { ref: typeof GameRefKind.TILE; id: number }
  | { ref: typeof GameRefKind.RESOURCE; id: ResourceKey }
  | { ref: typeof GameRefKind.STAT; id: HeroBuffId }
  | { ref: typeof GameRefKind.ZONE; id: number }
  | { ref: typeof GameRefKind.RANK; id: number }
  | { ref: typeof GameRefKind.GEAR; id: string }
  | { ref: typeof GameRefKind.ITEM_CATEGORY; id: number };

/** A length of time in real milliseconds; the client shows it as a duration ("1m 30s"). */
export interface MsgDuration {
  duration: number;
}

/** A share (0.25); the client shows it as a percent in the player's locale (25%). */
export interface MsgShare {
  share: number;
}

export type MsgParam = string | number | boolean | Message | GameRef | MsgDuration | MsgShare | MsgParam[];
export interface Message {
  code: MsgCode;
  params?: Record<string, MsgParam>;
}

/** Every code, e.g. for a schema enum. */
export const MSG_CODES = Object.entries(MESSAGES).flatMap(([area, names]) => Object.keys(names).map((n) => `${area}.${n}`)) as [MsgCode, ...MsgCode[]];

/** The param names a code takes. */
export function msgParamNames(code: MsgCode): readonly string[] {
  const dot = code.indexOf('.');
  const area = MESSAGES[code.slice(0, dot) as MsgArea] as Record<string, readonly string[]>;
  return area[code.slice(dot + 1)] ?? [];
}

/** A message: `msg('hero.locked', { name })`; codes without params take none. */
export function msg<C extends MsgCode>(code: C, ...params: [ParamNames<C>] extends [never] ? [] : [Record<ParamNames<C>, MsgParam>]): Message {
  return params[0] ? { code, params: params[0] } : { code };
}

/** A message as text for logs (not for players): `hero.locked {"name":"ATK - 76"}`. */
export const msgLogText = (m: Message) => (m.params ? `${m.code} ${JSON.stringify(m.params)}` : m.code);

/** A length of time (real milliseconds) as a param. */
export const dur = (ms: number): MsgDuration => ({ duration: Math.max(0, Math.round(ms)) });

/** A share (0.25 for 25%) as a param, shown by the client as a percent. Never send a percent number (25). */
export const share = (x: number): MsgShare => ({ share: x });

/** Game data references. */
export const ref = {
  troop: (id: number): GameRef => ({ ref: GameRefKind.TROOP, id }),
  building: (id: number): GameRef => ({ ref: GameRefKind.BUILDING, id }),
  tech: (id: number): GameRef => ({ ref: GameRefKind.TECH, id }),
  item: (id: string): GameRef => ({ ref: GameRefKind.ITEM, id }),
  title: (id: number): GameRef => ({ ref: GameRefKind.TITLE, id }),
  tile: (id: number): GameRef => ({ ref: GameRefKind.TILE, id }),
  resource: (id: ResourceKey): GameRef => ({ ref: GameRefKind.RESOURCE, id }),
  stat: (id: HeroBuffId): GameRef => ({ ref: GameRefKind.STAT, id }),
  zone: (id: number): GameRef => ({ ref: GameRefKind.ZONE, id }),
  rank: (id: number): GameRef => ({ ref: GameRefKind.RANK, id }),
  gear: (id: string): GameRef => ({ ref: GameRefKind.GEAR, id }),
  itemCategory: (id: number): GameRef => ({ ref: GameRefKind.ITEM_CATEGORY, id }),
};
