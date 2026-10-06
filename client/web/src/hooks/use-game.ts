// Server state: TanStack Query over the typed client, kept fresh by WebSocket pushes.

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BALANCE, scaled, setGameSpeed } from '@evony/core';
import type { CityBean, PushStatus } from '@evony/api-client';
import { api, errorMessage, push, unwrap } from '@/lib/api';

export const qk = {
  player: ['player'] as const,
  city: (id: number) => ['city', id] as const,
  research: (id: number) => ['research', id] as const,
  trainable: (id: number, fort: boolean) => ['trainable', id, fort] as const,
  queues: (id: number, fort: boolean) => ['queues', id, fort] as const,
  available: (id: number, area: string) => ['available', id, area] as const,
  upgrade: (id: number, pos: number) => ['upgrade', id, pos] as const,
  armies: ['armies'] as const,
  map: (x: number, y: number) => ['map', x, y] as const,
};

export function usePlayer() {
  return useQuery({
    queryKey: qk.player,
    queryFn: async () => {
      const state = await unwrap(api.GET('/api/v1/player'));
      setGameSpeed(state.gameSpeed);
      return state;
    },
    retry: false,
  });
}

export function useCity(cityId: number | undefined) {
  return useQuery({
    queryKey: qk.city(cityId ?? 0),
    enabled: cityId != null,
    queryFn: () => unwrap(api.GET('/api/v1/cities/{cityId}', { params: { path: { cityId: cityId! } } })),
    // population and loyalty drift a step every city tick on the server; refetch on each tick
    // while they are still moving so the header follows them live
    refetchInterval: (q) => (q.state.data && cityIsDrifting(q.state.data) ? Math.max(1000, scaled(BALANCE.cityTickMs)) : false),
  });
}

/** Population still moving towards its target, or loyalty towards 100 - (tax + grievance) (core populationTick). */
function cityIsDrifting(c: CityBean): boolean {
  const r = c.resource;
  const targetLoyalty = 100 - Math.min(100, r.taxRate + r.complaint);
  return r.populationDirection !== 0 || r.support !== targetLoyalty;
}

/** Wraps a command: toasts failures and refreshes the given queries on success. */
export function useCommand<A, R>(fn: (args: A) => Promise<R>, refresh: (args: A, qc: QueryClient) => QueryKey[], success?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (_r, args) => {
      for (const key of refresh(args, qc)) void qc.invalidateQueries({ queryKey: key });
      if (success) toast.success(success);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
}

/** Connect the push socket while a lord is logged in and route pushes into the query cache. */
export function usePushSync(enabled: boolean): PushStatus {
  const qc = useQueryClient();
  const [status, setStatus] = useState<PushStatus>('closed');
  useEffect(() => {
    if (!enabled) return;
    const city = (castleId: number) => void qc.invalidateQueries({ queryKey: qk.city(castleId) });
    const offs = [
      push.on('server.ResourceUpdate', ({ castleId, resource }) =>
        qc.setQueryData<CityBean>(qk.city(castleId), (c) => (c ? { ...c, resource } : c)),
      ),
      push.on('server.BuildComplate', ({ castleId, buildingBean }) => {
        city(castleId);
        void qc.invalidateQueries({ queryKey: ['upgrade', castleId] });
        void qc.invalidateQueries({ queryKey: ['available', castleId] });
        if (buildingBean.typeId && buildingBean.status === 0) toast(`${buildingBean.name} reached level ${buildingBean.level}`);
      }),
      push.on('server.TroopUpdate', ({ castleId, troop }) => qc.setQueryData<CityBean>(qk.city(castleId), (c) => (c ? { ...c, troop } : c))),
      push.on('server.InjuredTroopUpdate', ({ castleId, troop }) => qc.setQueryData<CityBean>(qk.city(castleId), (c) => (c ? { ...c, injuredTroop: troop } : c))),
      push.on('server.FortificationsUpdate', ({ castleId, fortification }) =>
        qc.setQueryData<CityBean>(qk.city(castleId), (c) => (c ? { ...c, fortification } : c)),
      ),
      push.on('server.CastleUpdate', (d) => {
        if (d.updateType === 2) qc.setQueryData(qk.city(d.castleBean.id), d.castleBean);
        void qc.invalidateQueries({ queryKey: qk.player });
      }),
      // patch the hero in place (experience, stats, status) so hero cards update instantly
      push.on('server.HeroUpdate', ({ castleId, hero, updateType }) => {
        qc.setQueryData<CityBean>(qk.city(castleId), (c) => {
          if (!c) return c;
          const rest = c.heros.filter((h) => h.id !== hero.id);
          return { ...c, heros: updateType === 1 ? rest : c.heros.some((h) => h.id === hero.id) ? c.heros.map((h) => (h.id === hero.id ? hero : h)) : [...rest, hero] };
        });
        // the mayor's stats set production rates and build / research / training times: refresh them
        for (const key of [qk.city(castleId), qk.research(castleId), ['upgrade', castleId], ['available', castleId], ['trainable', castleId]]) {
          void qc.invalidateQueries({ queryKey: key });
        }
      }),
      push.on('server.TroopQueueUpdate', () => void qc.invalidateQueries({ queryKey: ['queues'] })),
      push.on('server.FortificationsQueueUpdate', () => void qc.invalidateQueries({ queryKey: ['queues'] })),
      push.on('server.ResearchUpdate', ({ castleId }) => void qc.invalidateQueries({ queryKey: qk.research(castleId) })),
      push.on('server.ResearchCompleteUpdate', ({ castleId, typeId, level }) => {
        void qc.invalidateQueries({ queryKey: ['research'] });
        void qc.invalidateQueries({ queryKey: qk.player });
        city(castleId);
        toast(`Research ${typeId} reached level ${level}`);
      }),
      push.on('server.PlayerInfoUpdate', ({ playerInfo }) => qc.setQueryData(qk.player, (p: ReturnType<typeof usePlayer>['data']) => (p ? { ...p, playerInfo } : p))),
      push.on('server.CentsUpdate', ({ cents }) =>
        qc.setQueryData(qk.player, (p: ReturnType<typeof usePlayer>['data']) => (p ? { ...p, playerInfo: { ...p.playerInfo, cents } } : p)),
      ),
      push.on('server.ItemUpdate', () => void qc.invalidateQueries({ queryKey: qk.player })),
      push.on('server.SelfArmysUpdate', () => void qc.invalidateQueries({ queryKey: qk.armies })),
      push.on('server.FriendArmysUpdate', () => void qc.invalidateQueries({ queryKey: qk.armies })),
      push.on('server.EnemyArmysUpdate', ({ armys }) => {
        void qc.invalidateQueries({ queryKey: qk.armies });
        if (armys.length) toast.warning(`${armys.length} hostile ${armys.length === 1 ? 'army' : 'armies'} approaching`);
      }),
      push.on('server.TradesUpdate', ({ resType, amount, price }) => {
        void qc.invalidateQueries({ queryKey: ['market'] });
        toast.success(`Trade: ${amount.toLocaleString('en')} ${['food', 'lumber', 'stone', 'iron'][resType] ?? 'goods'} at ${price} gold`);
      }),
      push.on('server.TransingTradeUpdate', ({ resType, amount }) => {
        void qc.invalidateQueries({ queryKey: ['market', 'shipments'] });
        if (resType !== 4) toast(`Market delivery: ${amount.toLocaleString('en')} ${['food', 'lumber', 'stone', 'iron'][resType] ?? 'goods'} arrived`);
      }),
      push.on('server.NewReport', (counts) => {
        const before = qc.getQueryData<{ count: number }>(['reports', 'unread'])?.count ?? 0;
        qc.setQueryData(['reports', 'unread'], counts);
        void qc.invalidateQueries({ queryKey: ['reports', 'list'] });
        if (counts.count > before) toast('New report', { description: 'See the Reports tab.' });
      }),
      push.on('server.SystemInfoMsg', ({ msg }) => toast.info(msg)),
    ];
    offs.push(push.onStatus(setStatus));
    push.connect();
    return () => {
      offs.forEach((off) => off());
      push.close();
    };
  }, [enabled, qc]);
  return status;
}
