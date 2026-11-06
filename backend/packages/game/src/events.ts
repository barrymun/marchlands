// Timed-event dispatch (used by the worker). Each handler is idempotent: it re-reads state
// and does nothing if the event is stale (e.g. a speed-up already completed the work).

import { BALANCE, BUFF_IDS, BuffId, HealPayment, msg, TimedEventType } from '@marchlands/core';

import type { Ctx } from '#/context.ts';
import { completeAbandon } from '#/engine/abandon.ts';
import { departArmy } from '#/engine/armies.ts';
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
  type: TimedEventType;
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
    ctx.schedule({ type: TimedEventType.BUFF_EXPIRE, dueAt: b.endTime, playerId, refKey: `buff:${playerId}:${buffId}`, payload: { buffId } });
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

/** A column an event of this type is always scheduled with (ctx.schedule); missing means a bug, so the event fails. */
function scheduledWith(ev: EventRow, value: number | null, what: string): number {
  if (value == null) throw new Error(`timed event ${ev.id} (${ev.type}) has no ${what}`);
  return value;
}

export async function dispatchEvent(ctx: Ctx, ev: EventRow): Promise<void> {
  const p = ev.payload;
  const playerId = () => scheduledWith(ev, ev.playerId, 'playerId');
  const cityId = () => scheduledWith(ev, ev.cityId, 'cityId');
  switch (ev.type) {
    case TimedEventType.BUILDING:
      return completeBuilding(ctx, cityId(), num(p.positionId));
    case TimedEventType.RESEARCH:
      return completeResearch(ctx, playerId(), num(p.techId));
    case TimedEventType.TRAIN:
      return completeTraining(ctx, cityId(), num(p.positionId));
    case TimedEventType.ARMY:
      await processArmy(ctx, num(p.armyId));
      return;
    case TimedEventType.ARMY_DEPART:
      return departArmy(ctx, num(p.armyId));
    case TimedEventType.BUFF_EXPIRE:
      return BUFF_IDS.includes(p.buffId as BuffId) ? expireBuff(ctx, playerId(), p.buffId as BuffId) : undefined;
    case TimedEventType.HERO_BUFF:
      return expireHeroBuff(ctx, num(p.heroId), String(p.attr));
    case TimedEventType.SHIPMENT:
      return deliverShipment(ctx, num(p.shipmentId));
    case TimedEventType.CITY_ABANDON:
      return completeAbandon(ctx, cityId());
    case TimedEventType.FLOW_HEAL:
      return runScheduledHeal(
        ctx,
        playerId(),
        cityId(),
        p.payWith === HealPayment.HONOR ? HealPayment.HONOR : HealPayment.RESOURCES,
        Array.isArray(p.armyIds) ? p.armyIds.map(Number).filter(Number.isInteger) : [],
      );
    case TimedEventType.FLOW_RESUME:
      return resumeFlow(ctx, playerId(), String(p.flowId));
    case TimedEventType.FLOW_QUEUE:
      return runQueue(ctx, playerId());
    default:
      // the type covers every case, but a row outlives the code: one left by another version of the game
      throw new Error(`unknown timed event type ${String(ev.type)}`);
  }
}
