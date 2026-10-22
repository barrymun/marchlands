import { QueryClient, type QueryKey } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type CityBean,
  getArmiesQueryKey,
  getCitiesByCityIdQueryKey,
  getCitiesTroopsQueuesQueryKey,
  getPlayerQueryKey,
  type GetPlayerResponse,
  getReportsUnreadQueryKey,
  type HeroBean,
  type PushClient,
  PushCmd,
} from '@marchlands/api-client';

import { builtAt } from '@/lib/build-events';
import { PUSH_HANDLERS, subscribePushHandlers } from '@/lib/push/handlers';

const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), warning: vi.fn(), info: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

const cityKey = (cityId: number) => getCitiesByCityIdQueryKey({ path: { cityId } });
const city = (id: number) => ({ id, resource: { gold: 1 }, troop: {}, heros: [{ id: 1, level: 1 }] }) as unknown as CityBean;
/** Call one handler with loosely typed test data. */
const handle = (cmd: PushCmd, data: unknown, qc: QueryClient) => (PUSH_HANDLERS[cmd] as (d: unknown, q: QueryClient) => void)(data, qc);

let qc: QueryClient;
/** Seed a query, so invalidation has something to mark stale. */
const seed = (key: QueryKey, data: unknown) => qc.setQueryData(key, data);
const stale = (key: QueryKey) => qc.getQueryState(key)?.isInvalidated ?? false;

beforeEach(() => {
  qc = new QueryClient();
  vi.clearAllMocks();
});

describe('city patches', () => {
  it('ResourceUpdate replaces the cached city resources without a refetch', () => {
    seed(cityKey(7), city(7));
    handle(PushCmd.RESOURCE_UPDATE, { castleId: 7, resource: { gold: 99 } }, qc);
    expect(qc.getQueryData<CityBean>(cityKey(7))?.resource).toEqual({ gold: 99 });
    expect(stale(cityKey(7))).toBe(false);
  });
  it('leaves a city that is not cached alone', () => {
    handle(PushCmd.TROOP_UPDATE, { castleId: 8, troop: { archer: 1 } }, qc);
    expect(qc.getQueryData(cityKey(8))).toBeUndefined();
  });
  it('HeroUpdate patches the hero in the city and in the player state', () => {
    seed(cityKey(7), city(7));
    seed(getPlayerQueryKey(), { castles: [city(7)] });
    const hero = { id: 1, level: 5 } as HeroBean;
    handle(PushCmd.HERO_UPDATE, { castleId: 7, hero, updateType: 0 }, qc);
    expect(qc.getQueryData<CityBean>(cityKey(7))?.heros[0]!.level).toBe(5);
    expect(qc.getQueryData<GetPlayerResponse>(getPlayerQueryKey())?.castles[0]!.heros[0]!.level).toBe(5);
  });
});

describe('invalidation', () => {
  it('TroopQueueUpdate refreshes the troop queues of every city', () => {
    const a = getCitiesTroopsQueuesQueryKey({ path: { cityId: 1 } });
    const b = getCitiesTroopsQueuesQueryKey({ path: { cityId: 2 } });
    seed(a, []);
    seed(b, []);
    handle(PushCmd.TROOP_QUEUE_UPDATE, {}, qc);
    expect([stale(a), stale(b)]).toEqual([true, true]);
  });
  it('BuildComplate refreshes that city only, and announces a finished level', () => {
    seed(cityKey(1), city(1));
    seed(cityKey(2), city(2));
    handle(PushCmd.BUILD_COMPLETE, { castleId: 1, buildingBean: { typeId: 1, status: 0, level: 2, positionId: 4 } }, qc);
    expect([stale(cityKey(1)), stale(cityKey(2))]).toEqual([true, false]);
    expect(toast).toHaveBeenCalledWith('Cottage reached level 2');
    // the town sparkles over it (lib/build-events.ts)
    expect(builtAt(1, 4)).toBeGreaterThanOrEqual(0);
  });
  it('ResearchCompleteUpdate announces the technology by name', () => {
    handle(PushCmd.RESEARCH_COMPLETE_UPDATE, { castleId: 1, typeId: 1, level: 3 }, qc);
    expect(toast).toHaveBeenCalledWith('Agriculture reached level 3');
  });
  it('EnemyArmysUpdate refreshes armies and warns only when armies approach', () => {
    seed(getArmiesQueryKey(), []);
    handle(PushCmd.ENEMY_ARMIES_UPDATE, { armys: [] }, qc);
    expect(stale(getArmiesQueryKey())).toBe(true);
    expect(toast.warning).not.toHaveBeenCalled();
    handle(PushCmd.ENEMY_ARMIES_UPDATE, { armys: [{}, {}] }, qc);
    expect(toast.warning).toHaveBeenCalledWith('2 hostile armies approaching');
  });
});

describe(PushCmd.NEW_REPORT, () => {
  it('stores the unread counts and refreshes holdings only when the count rose', () => {
    seed(getReportsUnreadQueryKey(), { count: 2 });
    seed(cityKey(1), city(1));
    handle(PushCmd.NEW_REPORT, { count: 2 }, qc);
    expect(stale(cityKey(1))).toBe(false);
    expect(toast).not.toHaveBeenCalled();
    handle(PushCmd.NEW_REPORT, { count: 3 }, qc);
    expect(qc.getQueryData(getReportsUnreadQueryKey())).toEqual({ count: 3 });
    expect(stale(cityKey(1))).toBe(true);
    expect(toast).toHaveBeenCalledWith('New report', { description: 'See Reports.' });
  });
});

describe(subscribePushHandlers.name, () => {
  it('subscribes every handler and routes messages to it', () => {
    const subscribed = new Map<string, (data: unknown) => void>();
    const off = vi.fn();
    const client = { on: (cmd: string, fn: (data: unknown) => void) => (subscribed.set(cmd, fn), off) } as unknown as PushClient;
    const offs = subscribePushHandlers(client, qc);
    expect([...subscribed.keys()].sort()).toEqual(Object.keys(PUSH_HANDLERS).sort());
    expect(offs).toHaveLength(subscribed.size);
    subscribed.get(PushCmd.SYSTEM_INFO_MESSAGE)!({ msg: { code: 'admin.broadcast', params: { text: 'Maintenance at noon' } } });
    expect(toast.info).toHaveBeenCalledWith('Maintenance at noon');
  });
});
