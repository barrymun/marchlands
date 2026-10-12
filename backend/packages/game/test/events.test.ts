// How dispatchEvent reads each timed event: the services it hands them to are replaced by mocks (what they do
// is covered by their own tests, and events.db.test.ts runs real events end to end).

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchEvent, type EventRow } from '#/events.ts';
import type { Ctx } from '#/context.ts';
import { getPlayer } from '#/repo.ts';
import { completeBuilding } from '#/engine/buildings.ts';
import { processArmy } from '#/engine/combat.ts';
import { resumeFlow, runQueue, runScheduledHeal } from '#/engine/flows.ts';
import { expireHeroBuff } from '#/engine/heroes.ts';
import { deliverShipment } from '#/engine/market.ts';
import { completeResearch } from '#/engine/research.ts';
import { completeTraining } from '#/engine/training.ts';

vi.mock('#/engine/buildings.ts', () => ({ completeBuilding: vi.fn() }));
vi.mock('#/engine/combat.ts', () => ({ processArmy: vi.fn(async () => 'army result') }));
vi.mock('#/engine/flows.ts', () => ({ resumeFlow: vi.fn(), runQueue: vi.fn(), runScheduledHeal: vi.fn() }));
vi.mock('#/engine/heroes.ts', () => ({ expireHeroBuff: vi.fn() }));
vi.mock('#/engine/market.ts', () => ({ deliverShipment: vi.fn() }));
vi.mock('#/engine/research.ts', () => ({ completeResearch: vi.fn(), settleAllCities: vi.fn() }));
vi.mock('#/engine/training.ts', () => ({ completeTraining: vi.fn() }));
vi.mock('#/repo.ts', () => ({ getPlayer: vi.fn(), savePlayer: vi.fn() }));

const ctx = { now: 1000 } as Ctx;

const event = (type: string, payload: Record<string, unknown> = {}, ids: Partial<EventRow> = {}): EventRow => ({
  id: 1,
  type,
  dueAt: 1000,
  playerId: 7,
  cityId: 8,
  payload,
  ...ids,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe(dispatchEvent.name, () => {
  it('completes a building at the event’s city and position', async () => {
    await dispatchEvent(ctx, event('building', { positionId: '3' }));
    expect(completeBuilding).toHaveBeenCalledWith(ctx, 8, 3);
  });

  it('completes the player’s research', async () => {
    await dispatchEvent(ctx, event('research', { techId: 5 }));
    expect(completeResearch).toHaveBeenCalledWith(ctx, 7, 5);
  });

  it('completes training at the event’s city and barracks', async () => {
    await dispatchEvent(ctx, event('train', { positionId: 2 }));
    expect(completeTraining).toHaveBeenCalledWith(ctx, 8, 2);
  });

  it('processes the army, and returns nothing', async () => {
    expect(await dispatchEvent(ctx, event('army', { armyId: '12' }))).toBeUndefined();
    expect(processArmy).toHaveBeenCalledWith(ctx, 12);
  });

  it('expires a hero boost', async () => {
    await dispatchEvent(ctx, event('hero.buff', { heroId: 4, attr: 'power' }));
    expect(expireHeroBuff).toHaveBeenCalledWith(ctx, 4, 'power');
  });

  it('delivers a shipment', async () => {
    await dispatchEvent(ctx, event('shipment', { shipmentId: 9 }));
    expect(deliverShipment).toHaveBeenCalledWith(ctx, 9);
  });

  it('runs a scheduled heal, with resources unless honor was chosen, and only whole army ids', async () => {
    await dispatchEvent(ctx, event('flow.heal', { payWith: 'honor', armyIds: [1, '2', 2.5, 'x'] }));
    expect(runScheduledHeal).toHaveBeenLastCalledWith(ctx, 7, 8, 'honor', [1, 2]);
    await dispatchEvent(ctx, event('flow.heal', { payWith: 'gold', armyIds: 'nope' }));
    expect(runScheduledHeal).toHaveBeenLastCalledWith(ctx, 7, 8, 'resources', []);
    await dispatchEvent(ctx, event('flow.heal'));
    expect(runScheduledHeal).toHaveBeenLastCalledWith(ctx, 7, 8, 'resources', []);
  });

  it('resumes a flow, and runs the player’s flow queue', async () => {
    await dispatchEvent(ctx, event('flow.resume', { flowId: 'f1' }));
    expect(resumeFlow).toHaveBeenCalledWith(ctx, 7, 'f1');
    await dispatchEvent(ctx, event('flow.queue'));
    expect(runQueue).toHaveBeenCalledWith(ctx, 7);
  });

  it('ignores the expiry of a buff it does not know', async () => {
    await expect(dispatchEvent(ctx, event('buff.expire', { buffId: 'NoSuchBuff' }))).resolves.toBeUndefined();
    await expect(dispatchEvent(ctx, event('buff.expire'))).resolves.toBeUndefined();
    expect(getPlayer).not.toHaveBeenCalled();
  });

  it('reads a missing payload as empty', async () => {
    await dispatchEvent(ctx, { ...event('flow.queue'), payload: null as unknown as Record<string, unknown> });
    expect(runQueue).toHaveBeenCalledWith(ctx, 7);
  });

  it('refuses an event type it does not know', async () => {
    await expect(dispatchEvent(ctx, event('nope'))).rejects.toThrow('unknown timed event type nope');
  });
});
