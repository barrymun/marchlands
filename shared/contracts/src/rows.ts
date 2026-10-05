// Row schemas generated from the Drizzle table definitions (backend/packages/db/src/schema.ts),
// which are also the source of the SQL migrations. jsonb columns use the persisted-state schemas
// from @evony/core. Contract shapes below pick and extend these, so a column change flows
// through to the API contract, the OpenAPI document and the generated client.
//
// Secrets (accounts.passwordHash) and internal tables (timed_events, push_messages) are not exported.

import { z } from 'zod';
import { createSelectSchema } from 'drizzle-zod';
import {
  BuffStateSchema,
  BuildingStateSchema,
  CastleSignSchema,
  CityMiscSchema,
  FortCountsSchema,
  FortQueueStateSchema,
  ItemCountsSchema,
  PlayerMiscSchema,
  ReportBodySchema,
  ResearchStateSchema,
  ResourceSetSchema,
  TroopCountsSchema,
  TroopQueueStateSchema,
} from '@evony/core';
import {
  allianceEvents,
  allianceRelations,
  allianceRequests,
  alliances,
  armies,
  chatMessages,
  cities,
  heroes,
  mails,
  marketOrders,
  marketShipments,
  players,
  questProgress,
  reports,
  tiles,
} from '@evony/db/schema';

export const PlayerRow = createSelectSchema(players, {
  research: ResearchStateSchema,
  items: ItemCountsSchema,
  buffs: z.array(BuffStateSchema),
  castleSigns: z.array(CastleSignSchema),
  misc: PlayerMiscSchema,
});
export const TileRow = createSelectSchema(tiles, {
  troops: TroopCountsSchema.nullable(),
  forts: FortCountsSchema.nullable(),
  state: z.record(z.string(), z.number()).nullable(),
});
export const CityRow = createSelectSchema(cities, {
  buildings: z.array(BuildingStateSchema),
  troops: TroopCountsSchema,
  injuredTroops: TroopCountsSchema,
  forts: FortCountsSchema,
  troopQueues: z.array(TroopQueueStateSchema),
  fortQueue: FortQueueStateSchema,
  workRates: ResourceSetSchema,
  storePercent: ResourceSetSchema,
  misc: CityMiscSchema,
});
export const HeroRow = createSelectSchema(heroes, { buffs: z.array(BuffStateSchema) });
export const ArmyRow = createSelectSchema(armies, { troops: TroopCountsSchema, resources: ResourceSetSchema });
export const MailRow = createSelectSchema(mails);
export const ReportRow = createSelectSchema(reports, { body: ReportBodySchema });
export const ChatMessageRow = createSelectSchema(chatMessages);
export const AllianceRow = createSelectSchema(alliances);
export const AllianceRelationRow = createSelectSchema(allianceRelations);
export const AllianceRequestRow = createSelectSchema(allianceRequests);
export const AllianceEventRow = createSelectSchema(allianceEvents);
export const MarketOrderRow = createSelectSchema(marketOrders);
export const MarketShipmentRow = createSelectSchema(marketShipments);
export const QuestProgressRow = createSelectSchema(questProgress);
