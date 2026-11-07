// Server state: TanStack Query over the typed client, kept fresh by WebSocket pushes.

import { type MutationFunction, type QueryClient, type QueryKey, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { getCitiesByCityIdOptions, getPlayer, getPlayerQueryKey, PushStatus } from '@marchlands/api-client';
import { BALANCE, type Feature, scaled, setGameSpeed } from '@marchlands/core';

import { errorMessage, push } from '@/lib/api';
import { subscribePushHandlers } from '@/lib/push/handlers';
import { allMarketQueries } from '@/lib/query-keys';

export function usePlayer() {
  return useQuery({
    queryKey: getPlayerQueryKey(),
    queryFn: async ({ signal }) => {
      const { data } = await getPlayer({ signal, throwOnError: true });
      setGameSpeed(data.gameSpeed);
      return data;
    },
    retry: false,
  });
}

/** Whether this server has a part of the game on; off until the player's state has loaded. */
export function useFeature(feature: Feature): boolean {
  return usePlayer().data?.features[feature] ?? false;
}

export function useCity(cityId: number | undefined) {
  return useQuery({
    ...getCitiesByCityIdOptions({ path: { cityId: cityId ?? 0 } }),
    enabled: cityId != null,
    // population drifts a step every city tick on the server; refetch on each tick while it is
    // still moving so the header follows it live
    refetchInterval: (q) => {
      const c = q.state.data;
      if (!c) return false;
      return c.resource.populationDirection !== 0 ? Math.max(1000, scaled(BALANCE.cityTickMs)) : false;
    },
  });
}

/**
 * Wraps a command: toasts failures and refreshes the given queries on success. Pass a generated
 * mutation (`useCommand(postPlayerRenameMutation(), …)`, then `mutate({ body })`) or, for a command
 * that makes several calls, an async function.
 */
export function useCommand<A, R>(
  command: { mutationFn?: MutationFunction<R, A> } | MutationFunction<R, A>,
  refresh: (args: A, qc: QueryClient) => QueryKey[],
  success?: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: typeof command === 'function' ? command : command.mutationFn,
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
  const [status, setStatus] = useState<PushStatus>(PushStatus.CLOSED);
  useEffect(() => {
    if (!enabled) return;
    const offs = subscribePushHandlers(push, qc);
    // pushes sent while the socket was down are lost: on reconnecting, refresh what only pushes keep fresh (the market, and the
    // player's cities, so a screen on a city gone meanwhile moves on)
    let wasOpen = false;
    offs.push(
      push.onStatus((s) => {
        if (s === PushStatus.OPEN && wasOpen) for (const queryKey of [...allMarketQueries(), getPlayerQueryKey()]) void qc.invalidateQueries({ queryKey });
        if (s === PushStatus.OPEN) wasOpen = true;
        setStatus(s);
      }),
    );
    push.connect();
    return () => {
      offs.forEach((off) => off());
      push.close();
    };
  }, [enabled, qc]);
  return status;
}
