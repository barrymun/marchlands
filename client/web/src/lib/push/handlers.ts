// What each WebSocket push does on the client: patch cached data, refresh the queries it makes stale,
// and tell the player. usePushSync (hooks/use-game.ts) subscribes these while a player is logged in.

import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  type CityBean,
  getArmiesQueryKey,
  getCitiesBuildingsAvailableQueryKey,
  getCitiesBuildingsByPositionIdQueryKey,
  getCitiesByCityIdQueryKey,
  getCitiesFortificationsQueuesQueryKey,
  getCitiesFortificationsTrainableQueryKey,
  getCitiesResearchQueryKey,
  getCitiesTroopsQueuesQueryKey,
  getCitiesTroopsTrainableQueryKey,
  getFactionsQueryKey,
  getMapQueryKey,
  getMapTilesByTileIdQueryKey,
  getMarketAffordableQueryKey,
  getMarketByResTypeQueryKey,
  getMarketHistoryQueryKey,
  getMarketQuoteQueryKey,
  getMarketShipmentsQueryKey,
  getMarketSummaryQueryKey,
  getPlansQueryKey,
  getPlayerFlowsQueryKey,
  getPlayerQueryKey,
  type GetPlayerResponse,
  getReportsQueryKey,
  getReportsUnreadQueryKey,
  type GetReportsUnreadResponse,
  type PushClient,
  PushCmd,
  type PushData,
} from '@marchlands/api-client';

import { noteBuilt } from '@/lib/build-events';
import { fmtExact } from '@/lib/format';
import { buildingName, techName } from '@/lib/game-data';
import { i18n } from '@/lib/i18n';
import { translateMessage } from '@/lib/messages';
import { patchHeroes, patchPlayerHeroes, resourceName } from '@/lib/push/utils';
import { allMarketQueries, allOf } from '@/lib/query-keys';
import { noteServerTime } from '@/lib/server-clock';

type Handler<K extends PushCmd> = (data: PushData<K>, qc: QueryClient) => void;

const cityKey = (cityId: number) => getCitiesByCityIdQueryKey({ path: { cityId } });
const invalidate = (qc: QueryClient, ...keys: QueryKey[]) => keys.forEach((queryKey) => void qc.invalidateQueries({ queryKey }));
const patchCity = (qc: QueryClient, cityId: number, patch: (c: CityBean) => CityBean) => qc.setQueryData<CityBean>(cityKey(cityId), (c) => (c ? patch(c) : c));
const patchPlayer = (qc: QueryClient, patch: (p: GetPlayerResponse) => GetPlayerResponse) =>
  qc.setQueryData<GetPlayerResponse>(getPlayerQueryKey(), (p) => (p ? patch(p) : p));

export const PUSH_HANDLERS: { [K in PushCmd]?: Handler<K> } = {
  [PushCmd.RESOURCE_UPDATE]: ({ castleId, resource }, qc) => patchCity(qc, castleId, (c) => ({ ...c, resource })),
  [PushCmd.TROOP_UPDATE]: ({ castleId, troop }, qc) => patchCity(qc, castleId, (c) => ({ ...c, troop })),
  [PushCmd.INJURED_TROOP_UPDATE]: ({ castleId, troop }, qc) => patchCity(qc, castleId, (c) => ({ ...c, injuredTroop: troop })),
  [PushCmd.FORTIFICATIONS_UPDATE]: ({ castleId, fortification }, qc) => patchCity(qc, castleId, (c) => ({ ...c, fortification })),

  [PushCmd.BUILD_COMPLETE]: ({ castleId, buildingBean }, qc) => {
    const path = { path: { cityId: castleId } };
    invalidate(qc, cityKey(castleId), allOf(getCitiesBuildingsByPositionIdQueryKey, path), allOf(getCitiesBuildingsAvailableQueryKey, path));
    if (buildingBean.typeId && buildingBean.status === 0) {
      noteBuilt(castleId, buildingBean.positionId, performance.now());
      toast(i18n.t('common:push.buildingComplete', { name: buildingName(buildingBean.typeId), level: buildingBean.level }));
    }
  },

  [PushCmd.CASTLE_UPDATE]: (d, qc) => {
    if (d.updateType === 2) qc.setQueryData(cityKey(d.castleBean.id), d.castleBean);
    invalidate(qc, getPlayerQueryKey());
    // a city lost takes its orders, shipments and plan waves with it, and leaves the flows; nothing else tells these screens
    if (d.updateType === 1) invalidate(qc, ...allMarketQueries(), getPlansQueryKey(), getPlayerFlowsQueryKey());
  },

  // patch the hero in place (experience, stats, status) so hero cards update instantly
  [PushCmd.HERO_UPDATE]: ({ castleId, hero, updateType }, qc) => {
    patchCity(qc, castleId, (c) => ({ ...c, heros: patchHeroes(c.heros, hero, updateType) }));
    patchPlayer(qc, (p) => patchPlayerHeroes(p, castleId, hero, updateType));
    // the mayor's stats set production rates and build / research / training times: refresh them
    const path = { path: { cityId: castleId } };
    invalidate(
      qc,
      cityKey(castleId),
      getCitiesResearchQueryKey(path),
      allOf(getCitiesBuildingsByPositionIdQueryKey, path),
      allOf(getCitiesBuildingsAvailableQueryKey, path),
      allOf(getCitiesTroopsTrainableQueryKey, path),
      allOf(getCitiesFortificationsTrainableQueryKey, path),
    );
  },

  [PushCmd.TROOP_QUEUE_UPDATE]: (_d, qc) => invalidate(qc, allOf(getCitiesTroopsQueuesQueryKey)),
  [PushCmd.FORTIFICATIONS_QUEUE_UPDATE]: (_d, qc) => invalidate(qc, allOf(getCitiesFortificationsQueuesQueryKey)),
  [PushCmd.FLOW_UPDATE]: (_d, qc) => invalidate(qc, getPlayerFlowsQueryKey()),

  [PushCmd.RESEARCH_UPDATE]: ({ castleId }, qc) => invalidate(qc, getCitiesResearchQueryKey({ path: { cityId: castleId } })),
  [PushCmd.RESEARCH_COMPLETE_UPDATE]: ({ castleId, typeId, level }, qc) => {
    invalidate(qc, allOf(getCitiesResearchQueryKey), getPlayerQueryKey(), cityKey(castleId));
    toast(i18n.t('common:push.researchComplete', { name: techName(typeId), level }));
  },

  [PushCmd.PLAYER_INFO_UPDATE]: ({ playerInfo }, qc) => patchPlayer(qc, (p) => ({ ...p, playerInfo })),
  [PushCmd.ITEM_UPDATE]: (_d, qc) => invalidate(qc, getPlayerQueryKey()),

  [PushCmd.SELF_ARMIES_UPDATE]: (_d, qc) => invalidate(qc, getArmiesQueryKey()),
  [PushCmd.FRIEND_ARMIES_UPDATE]: (_d, qc) => invalidate(qc, getArmiesQueryKey()),
  [PushCmd.ENEMY_ARMIES_UPDATE]: ({ armys }, qc) => {
    invalidate(qc, getArmiesQueryKey());
    if (armys.length) toast.warning(i18n.t('common:push.hostileArmies', { count: armys.length }));
  },

  [PushCmd.TRADES_UPDATE]: ({ resType, amount, price }, qc) => {
    invalidate(qc, ...allMarketQueries());
    toast.success(i18n.t('common:push.trade', { amount: fmtExact(amount), resource: resourceName(resType), price }));
  },
  // a market moved (the factions' tick, someone's order): what the market screens show of it is stale; only the queries on
  // screen refetch, so players elsewhere pay nothing
  [PushCmd.MARKET_UPDATE]: ({ resTypes }, qc) => {
    for (const resType of resTypes) {
      const path = { path: { resType } };
      invalidate(
        qc,
        allOf(getMarketByResTypeQueryKey, path),
        allOf(getMarketHistoryQueryKey, path),
        allOf(getMarketQuoteQueryKey, path),
        allOf(getMarketAffordableQueryKey, path),
      );
    }
    // the factions' gold moves with every tick and every trade with them
    invalidate(qc, getMarketSummaryQueryKey(), getFactionsQueryKey());
  },
  [PushCmd.TRANSIT_TRADE_UPDATE]: ({ resType, amount }, qc) => {
    invalidate(qc, getMarketShipmentsQueryKey());
    if (resType !== 4) toast(i18n.t('common:push.delivery', { amount: fmtExact(amount), resource: resourceName(resType) }));
  },

  [PushCmd.NEW_REPORT]: (counts, qc) => {
    const before = qc.getQueryData<GetReportsUnreadResponse>(getReportsUnreadQueryKey())?.count ?? 0;
    qc.setQueryData(getReportsUnreadQueryKey(), counts);
    invalidate(qc, allOf(getReportsQueryKey));
    if (counts.count > before) {
      toast(i18n.t('common:push.newReport'), { description: i18n.t('common:push.newReportHint') });
      // a battle can change who holds valleys and cities (no push carries that): refresh them
      invalidate(qc, allOf(getCitiesByCityIdQueryKey), getPlayerQueryKey(), allOf(getMapQueryKey), allOf(getMapTilesByTileIdQueryKey));
    }
  },

  [PushCmd.SYSTEM_INFO_MESSAGE]: ({ msg }) => toast.info(translateMessage(msg)),

  // the server's clock, for countdowns and landing times
  [PushCmd.CONNECTED]: ({ serverTime }) => noteServerTime(serverTime),
  [PushCmd.PONG]: ({ serverTime }) => noteServerTime(serverTime),
};

/** Subscribe every handler to `client`; returns the unsubscribe functions. */
export function subscribePushHandlers(client: PushClient, qc: QueryClient): (() => void)[] {
  return (Object.keys(PUSH_HANDLERS) as PushCmd[]).map((cmd) => client.on(cmd, (data) => (PUSH_HANDLERS[cmd] as Handler<PushCmd>)(data, qc)));
}
