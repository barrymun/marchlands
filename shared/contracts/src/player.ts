// Accounts, the lord and the world overview: /auth/*, /player*, /players/:name, /world*.

import { z } from 'zod';
import { createSelectSchema } from 'drizzle-zod';
import { ArmyPresetSchema, CastleSignSchema, FlowActionSchema, FlowSchema, GrantContentsSchema, ResearchStateSchema } from '@evony/core';
import { accounts } from '@evony/db/schema';
import { Ms, zId } from './common.ts';
import { ArmyBean, BuffBean, CityBean, HeroBean, ItemCount, PlayerInfo } from './beans.ts';
import { LordGear } from './military.ts';
import { CityRow, PlayerRow } from './rows.ts';

// ---- auth ----

const Credentials = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(/^[A-Za-z0-9_.-]+$/, 'letters, digits, _ . - only'),
  password: z.string().min(6).max(200),
});
export const LoginBody = Credentials;
export const RegisterBody = Credentials.extend({ email: z.email().max(120) });

/** Not exported from rows.ts (it carries the password hash): only picked from here. */
const AccountRow = createSelectSchema(accounts);

export const AuthSession = z
  .object({
    token: z.string().describe('bearer token'),
    accountId: z.number().int(),
    playerId: z.number().int().nullable().describe('null until the lord is created (POST /player)'),
    hasPlayer: z.boolean(),
    isAdmin: z.boolean(),
  })
  .meta({ id: 'AuthSession' });
export type AuthSession = z.infer<typeof AuthSession>;

export const AuthAccount = AccountRow.pick({ id: true, username: true, email: true, isAdmin: true, createdAt: true })
  .extend({ player: PlayerRow.pick({ id: true, name: true }).nullable().describe('null until the lord is created') })
  .meta({ id: 'AuthAccount' });
export type AuthAccount = z.infer<typeof AuthAccount>;

// ---- world ----

export const ZoneStats = z
  .object({
    id: z.number().int(),
    name: z.string(),
    playerCount: z.number().int(),
    castleCount: z.number().int(),
    openFlats: z.number().int(),
    rate: z.number().int().describe('percent of occupiable tiles that are taken'),
  })
  .meta({ id: 'ZoneStats' });
export type ZoneStats = z.infer<typeof ZoneStats>;

export const WorldInfo = z
  .object({
    mapSize: z.number().int(),
    source: z.enum(['generated', 'legacy']),
    seed: z.string(),
    createdAt: Ms,
  })
  .partial()
  .extend({ online: z.number().int().describe('connected players') })
  .meta({ id: 'WorldInfo', description: 'world fields are absent until the world has been seeded' });
export type WorldInfo = z.infer<typeof WorldInfo>;

// ---- lord ----

export const CreatePlayerBody = z.object({
  userName: z.string(),
  castleName: z.string(),
  flag: z.string(),
  faceUrl: z.string().default('images/icon/player/faceA1.jpg'),
  sex: z.number().int(),
  zone: z.number().int().min(-1).max(15).default(-1),
});
export const PlayerNameParams = z.object({ name: z.string() });
export const ChangeFaceBody = z.object({ faceUrl: z.string(), sex: z.number().int() });
export const ChangeFlagBody = z.object({ flag: z.string() });
export const RenamePlayerBody = z.object({ userName: z.string() });
export const TutorialStepBody = z.object({ step: z.number().int().min(0) });
export const FurloughBody = z.object({ days: z.number().int() });
export const TruceBody = z.object({ itemId: z.string().default('player.peace.1') });
export const BookmarkBody = z.object({ tileId: zId });
export const ArmyPreset = ArmyPresetSchema.meta({ id: 'ArmyPreset' });
export type ArmyPreset = z.infer<typeof ArmyPreset>;
export const ArmyPresetBody = z.object({ name: z.string().describe('replaces a preset with the same name'), troops: z.record(z.string(), z.number().int()) });
export const ArmyPresetParams = z.object({ presetId: z.string() });
export const FlowAction = FlowActionSchema.meta({ id: 'FlowAction' });
export type FlowAction = z.infer<typeof FlowAction>;
const FlowCityResult = z.object({
  cityId: zId,
  cityName: z.string(),
  ok: z.boolean().describe('false: an action failed and everything the flow did in this city since the last wait was rolled back'),
  error: z.string().nullable(),
  steps: z.array(
    z.object({
      action: z.string(),
      ok: z.boolean(),
      detail: z.string(),
      skipped: z.boolean().optional().describe('the city could not do it right now (e.g. nothing affordable to train); the run carried on'),
      items: z
        .array(z.object({ label: z.string(), ok: z.boolean(), detail: z.string() }))
        .optional()
        .describe('per-target outcomes (attack actions)'),
    }),
  ),
});
export const FlowRunLog = z
  .object({
    run: z.number().int().describe('1 for the first run of the flow, counting up'),
    startedAt: Ms,
    finishedAt: Ms.nullable().describe('null while the run is still going'),
    cities: z.array(FlowCityResult),
  })
  .meta({ id: 'FlowRunLog' });
export type FlowRunLog = z.infer<typeof FlowRunLog>;
export const Flow = FlowSchema.extend({
  actions: z.array(FlowAction),
  status: z
    .enum(['idle', 'queued', 'running', 'waiting'])
    .describe("'queued': waits for the lord's active flow to finish its run (one flow runs at a time); 'waiting': paused on a wait action"),
  nextAction: z.number().int().describe('index of the action the run continues with'),
  runs: z.number().int(),
  queuedAt: Ms,
  notBefore: Ms.describe('a queued repeat starts no earlier than this'),
  waitUntil: Ms.describe('while waiting: when the wait ends (or is checked again)'),
  heldSince: Ms.describe('while waiting: held before its next actions until every hero of its cities is home, since then (0 = not held)'),
  stopReason: z.string().nullable().describe('why the flow stopped on its own (a failed run; repeat was switched off)'),
  lastRun: FlowRunLog.nullable(),
}).meta({ id: 'Flow' });
export type Flow = z.infer<typeof Flow>;
export const FlowBody = z.object({
  id: z.string().nullish().describe('a saved flow to replace; omit to create one'),
  name: z.string(),
  actions: z.array(FlowAction).min(1).max(20),
  cities: z
    .union([z.literal('all'), z.array(zId).min(1)])
    .default('all')
    .describe("'all' (every city, including ones gained later) or chosen city ids"),
});
export const FlowParams = z.object({ flowId: z.string() });
export const FlowRunBody = z.object({
  cityIds: z.array(zId).min(1).optional().describe("cities to run the flow on (default: the flow's saved cities)"),
  preview: z.boolean().default(false).describe('run up to the first wait and roll everything back: shows what would happen'),
});
export const FlowRepeatBody = z.object({ repeat: z.boolean() });
export const FlowRunReport = z
  .object({
    preview: z.boolean(),
    flow: Flow.nullable().describe('the flow after starting it (null for a preview)'),
    cities: z.array(FlowCityResult).describe('what ran now, up to the first wait (empty when the flow was queued)'),
  })
  .meta({ id: 'FlowRunReport' });
export type FlowRunReport = z.infer<typeof FlowRunReport>;
export const BookmarkParams = z.object({ tileId: zId });
export const UseItemParams = z.object({ itemId: z.string() });
export const UseItemBody = z.object({ cityId: zId.nullish() }).default({});

export const CastleSign = CastleSignSchema.meta({ id: 'CastleSign' });
export type CastleSign = z.infer<typeof CastleSign>;

/** Everything a client needs after login (orig PlayerBean / server.LoginResponse). */
export const PlayerState = z
  .object({
    playerInfo: PlayerInfo,
    castles: z.array(CityBean),
    items: z.array(ItemCount),
    buffs: z.array(BuffBean),
    research: ResearchStateSchema.describe('techId -> state'),
    gear: LordGear.describe("(evony-re) the lord's hero gear"),
    selfArmys: z.array(ArmyBean),
    friendArmys: z.array(ArmyBean),
    enemyArmys: z.array(ArmyBean),
    castleSignBean: z.array(CastleSign),
    newMailCount: z.number().int(),
    newMaileCount_inbox: z.number().int(),
    newMaileCount_system: z.number().int(),
    newReportCount: z.number().int(),
    newReportCount_army: z.number().int(),
    newReportCount_trade: z.number().int(),
    newReportCount_other: z.number().int(),
    furlough: z.boolean(),
    furloughEndTime: Ms.describe('0 when not on holiday'),
    mapSizeX: z.number().int(),
    mapSizeY: z.number().int(),
    gameSpeed: z.number(),
    currentTime: Ms,
    tutorialStepId: z.number().int(),
  })
  .meta({ id: 'PlayerState' });
export type PlayerState = z.infer<typeof PlayerState>;

export const PlayerCreated = PlayerState.extend({ token: z.string().describe('fresh bearer token carrying the new lord id') }).meta({ id: 'PlayerCreated' });
export type PlayerCreated = z.infer<typeof PlayerCreated>;

export const PublicPlayerInfo = PlayerInfo.extend({
  relation: z.number().int().describe('Relation: 0 alliance, 1 ally, 2 neutral, 3 enemy, 4 none, 5 self'),
  castles: z.array(CityRow.pick({ id: true, name: true }).extend({ fieldId: z.number().int().describe('tile id'), x: z.number().int(), y: z.number().int() })),
}).meta({ id: 'PublicPlayerInfo' });
export type PublicPlayerInfo = z.infer<typeof PublicPlayerInfo>;

export const TitlePromotion = PlayerInfo.pick({ titleId: true, titleName: true }).meta({ id: 'TitlePromotion' });
export type TitlePromotion = z.infer<typeof TitlePromotion>;

// ---- items ----

export const GrantContents = GrantContentsSchema.meta({ id: 'GrantContents' });
export type GrantContents = z.infer<typeof GrantContents>;

export const UseItemResult = z
  .object({
    itemId: z.string(),
    granted: GrantContents.optional().describe('what a grant / box / chest item gave'),
    amulet: z
      .object({
        slots: z.array(z.object({ id: z.string(), count: z.number().int(), kind: z.number().int().describe('rarity tier, 1 best .. 5 common') })),
        winner: z.number().int().describe('index into slots'),
        prize: z.object({ id: z.string(), count: z.number().int() }),
      })
      .optional()
      .describe('Amulet gamble result'),
    hero: HeroBean.optional().describe('hero produced by a hero box'),
  })
  .meta({ id: 'UseItemResult' });
export type UseItemResult = z.infer<typeof UseItemResult>;
