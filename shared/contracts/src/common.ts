// Envelope and primitives shared by every endpoint.

import { z } from 'zod';
import { FortKeySchema, TroopKeySchema, type FortKey, type TroopKey } from '@marchlands/core';

/** Every successful call answers `{ ok: 1, data }`. */
export const Ok = <T extends z.ZodType>(data: T) => z.object({ ok: z.literal(1), data });

/** Failures answer `{ ok: <negative code>, errorMsg }` with a 4xx/5xx status. */
export const ErrorResponse = z
  .object({
    ok: z.number().int().describe('negative error code (the original server codes)'),
    errorMsg: z.string(),
    issues: z.array(z.object({ path: z.string(), message: z.string().optional() })).optional(),
  })
  .meta({ id: 'ErrorResponse' });
export type ErrorResponse = z.infer<typeof ErrorResponse>;

/** Commands with nothing to return answer `data: null`. */
export const Empty = z.null();

/** Epoch milliseconds. */
export const Ms = z.number().describe('epoch milliseconds');

export const ResourceAmounts = z
  .object({ gold: z.number(), food: z.number(), wood: z.number(), stone: z.number(), iron: z.number() })
  .meta({ id: 'ResourceAmounts' });
export type ResourceAmounts = z.infer<typeof ResourceAmounts>;

/** Every troop type with its count (0 when absent). */
export const TroopBean = z.record(TroopKeySchema, z.number().int()).meta({ id: 'TroopBean' });
export type TroopBean = Record<TroopKey, number>;

/** Every fortification type with its count (0 when absent). */
export const FortBean = z.record(FortKeySchema, z.number().int()).meta({ id: 'FortBean' });
export type FortBean = Record<FortKey, number>;

/** Paged list helper: `{ items, total, pageNo, pageSize }`. */
export const Page = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), total: z.number().int(), pageNo: z.number().int(), pageSize: z.number().int() });

// ---- request helpers ----

export const zId = z.coerce.number().int().nonnegative();
export const zCityParams = z.object({ cityId: zId });
export const zPaging = z.object({
  pageNo: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});
export const zIds = z.object({ ids: z.array(z.number().int()).max(500) });
export const zTroops = z.record(z.string(), z.number().int().nonnegative());
export const zResources = z
  .object({ gold: z.number().nonnegative(), food: z.number().nonnegative(), wood: z.number().nonnegative(), stone: z.number().nonnegative(), iron: z.number().nonnegative() })
  .partial();
