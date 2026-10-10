import { useQuery } from '@tanstack/react-query';
import {
  getCitiesByCityIdQueryKey,
  getMarketShipmentsOptions,
  getMarketShipmentsQueryKey,
  getPlayerQueryKey,
  postMarketShipmentsSpeedupMutation,
} from '@marchlands/api-client';
import { goldForSpeedup } from '@marchlands/core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Countdown } from '@/components/countdown/countdown';
import { useCommand, usePlayer } from '@/hooks/use-game';
import { useNow } from '@/hooks/use-now';
import { allOf } from '@/lib/query-keys';
import { fmtExact } from '@/lib/format';
import { resLabel } from '@/components/market-panel/utils';

/** Only relevant if travel times are re-enabled (BALANCE.marketShipmentBaseMs > 0). */
export function Shipments() {
  const now = useNow();
  // the receiving city pays to deliver now
  const castles = usePlayer().data?.castles ?? [];
  const shipments = useQuery(getMarketShipmentsOptions());
  const rush = useCommand(
    postMarketShipmentsSpeedupMutation(),
    () => [getMarketShipmentsQueryKey(), getPlayerQueryKey(), allOf(getCitiesByCityIdQueryKey)],
    'Delivered',
  );
  const list = (shipments.data ?? []).filter((s) => s.endTime > now + 1000);
  if (list.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Goods in transit</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {list.map((s) => {
          const gold = goldForSpeedup(Math.max(0, s.endTime - now));
          const has = castles.find((c) => c.id === s.cityId)?.resource.gold ?? 0;
          return (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
              <span className="tabular-nums">
                {fmtExact(s.amount)} {resLabel(s.resType).toLowerCase()}
              </span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                arrives in <Countdown endTime={s.endTime} />
                <Button size="xs" variant="outline" disabled={rush.isPending || has < gold} onClick={() => rush.mutate({ path: { shipmentId: s.id } })}>
                  Deliver now · {fmtExact(gold)} gold
                </Button>
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
