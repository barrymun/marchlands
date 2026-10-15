// Timed-event dispatch (used by the worker). Each handler is idempotent: it re-reads state
// and does nothing if the event is stale (e.g. a speed-up already completed the work).

import { BALANCE, BUFF_IDS, BuffId, msg } from '@marchlands/core';

import type { Ctx } from '#/context.ts';
import { completeBuilding } from '#/engine/buildings.ts';
import { processArmy } from '#/engine/combat.ts';
import { resumeFlow, runQueue, runScheduledHeal } from '#/engine/flows.ts';
import { expireHeroBuff } from '#/engine/heroes.ts';
import { deliverShipment } from '#/engine/market.ts';
import { completeResearch, settleAllCities } from '#/engine/research.ts';
import { completeTraining } from '#/engine/training.ts';
import { activeBuff, pushPlayerInfo, removeBuff, setBuff } from '#/helpers.ts';
import { getPlayer, savePlayer } from '#/repo.ts';

export interface EventRow {
  id: number;
  type: string;
  dueAt: number;
  playerId: number | null;
  cityId: number | null;
  payload: Record<string, unknown>;
}

const num = (v: unknown) => Number(v);

/** Buffs whose expiry changes production: cities bank what they made at the boosted rate first. */
const SETTLE_ON_EXPIRE: readonly BuffId[] = [
  BuffId.FOOD_PRODUCTION,
  BuffId.WOOD_PRODUCTION,
  BuffId.STONE_PRODUCTION,
  BuffId.IRON_PRODUCTION,
  BuffId.GOLD_PRODUCTION,
  BuffId.UPKEEP_REDUCE,
];

async function expireBuff(ctx: Ctx, playerId: number, buffId: BuffId) {
  const p = await getPlayer(ctx, playerId, { lock: true });
  const b = p.buffs.find((x) => x.id === buffId);
  if (!b) return;
  if (b.endTime > ctx.now) {
    ctx.schedule({ type: 'buff.expire', dueAt: b.endTime, playerId, refKey: `buff:${playerId}:${buffId}`, payload: { buffId } });
    return;
  }
  // production buffs: bank production at the boosted rate first
  if (SETTLE_ON_EXPIRE.includes(buffId)) await settleAllCities(ctx, p);
  removeBuff(ctx, p, buffId);
  if (buffId === BuffId.TRUCE) {
    setBuff(ctx, p, BuffId.TRUCE_COOLDOWN, msg('buff.truceCooldown'), ctx.now + BALANCE.truceCooldownMs);
    if (p.status === 2) p.status = 0;
  }
  if (buffId === BuffId.HOLIDAY && p.status === 5) p.status = 0;
  await savePlayer(ctx, p);
  if (!activeBuff(p, buffId, ctx.now)) await pushPlayerInfo(ctx, p);
}

export async function dispatchEvent(ctx: Ctx, ev: EventRow): Promise<void> {
  const p = ev.payload ?? {};
  switch (ev.type) {
    case 'building':
      return completeBuilding(ctx, ev.cityId!, num(p.positionId));
    case 'research':
      return completeResearch(ctx, ev.playerId!, num(p.techId));
    case 'train':
      return completeTraining(ctx, ev.cityId!, num(p.positionId));
    case 'army':
      await processArmy(ctx, num(p.armyId));
      return;
    case 'buff.expire':
      return BUFF_IDS.includes(p.buffId as BuffId) ? expireBuff(ctx, ev.playerId!, p.buffId as BuffId) : undefined;
    case 'hero.buff':
      return expireHeroBuff(ctx, num(p.heroId), String(p.attr));
    case 'shipment':
      return deliverShipment(ctx, num(p.shipmentId));
    case 'flow.heal':
      return runScheduledHeal(
        ctx,
        ev.playerId!,
        ev.cityId!,
        p.payWith === 'honor' ? 'honor' : 'resources',
        Array.isArray(p.armyIds) ? p.armyIds.map(Number).filter(Number.isInteger) : [],
      );
    case 'flow.resume':
      return resumeFlow(ctx, ev.playerId!, String(p.flowId));
    case 'flow.queue':
      return runQueue(ctx, ev.playerId!);
    default:
      throw new Error(`unknown timed event type ${ev.type}`);
  }
}
