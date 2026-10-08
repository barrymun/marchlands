// Timed-event dispatch (used by the worker). Each handler is idempotent: it re-reads state
// and does nothing if the event is stale (e.g. a speed-up already completed the work).

import type { Ctx } from './context.ts';
import { getPlayer, savePlayer } from './repo.ts';
import { activeBuff, pushPlayerInfo, removeBuff, setBuff } from './helpers.ts';
import { completeBuilding } from './services/buildings.ts';
import { processArmy } from './services/combat.ts';
import { resumeFlow, runQueue, runScheduledHeal } from './services/flows.ts';
import { expireHeroBuff } from './services/heroes.ts';
import { deliverShipment } from './services/market.ts';
import { completeResearch, settleAllCities } from './services/research.ts';
import { completeTraining } from './services/training.ts';
import { BALANCE, scaled } from '@marchlands/core';

export interface EventRow {
  id: number;
  type: string;
  dueAt: number;
  playerId: number | null;
  cityId: number | null;
  payload: Record<string, unknown>;
}

const num = (v: unknown) => Number(v);

async function expireBuff(ctx: Ctx, playerId: number, buffId: string) {
  const p = await getPlayer(ctx, playerId, { lock: true });
  const b = p.buffs.find((x) => x.id === buffId);
  if (!b) return;
  if (b.endTime > ctx.now) {
    ctx.schedule({ type: 'buff.expire', dueAt: b.endTime, playerId, refKey: `buff:${playerId}:${buffId}`, payload: { buffId } });
    return;
  }
  // production buffs: bank production at the boosted rate first
  if (/ProductionBuff$|UpkeepReduceBuff$/.test(buffId)) await settleAllCities(ctx, p);
  removeBuff(ctx, p, buffId);
  if (buffId === 'PlayerPeaceBuff') {
    setBuff(ctx, p, 'PlayerPeaceCoolDownBuff', 'Truce Agreement in cooldown.', ctx.now + scaled(BALANCE.truceCooldownMs));
    if (p.status === 2) p.status = 0;
  }
  if (buffId === 'FurloughBuff' && p.status === 5) p.status = 0;
  if (buffId === 'ChatIconBuff') p.misc = { ...p.misc, icon: 0 };
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
      return expireBuff(ctx, ev.playerId!, String(p.buffId));
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
