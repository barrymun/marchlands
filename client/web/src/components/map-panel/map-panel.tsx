import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Crosshair, Eye } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type CityBean,
  deleteValleysByTileIdMutation,
  getArmiesQueryKey,
  getCitiesByCityIdQueryKey,
  getMapQueryKey,
  getMapTilesByTileIdOptions,
  getMapTilesByTileIdQueryKey,
  getPlayerQueryKey,
  postValleysUpgradeMutation,
} from '@marchlands/api-client';
import { Mission, TileType, VALLEY_RESOURCE, VALLEY_TYPES, valleyBonus } from '@marchlands/core';

import { CityDialog } from '@/components/city-dialog/city-dialog';
import { ConfirmButton } from '@/components/confirm-button/confirm-button';
import { AddToFarmButton } from '@/components/flow-attack/add-to-farm-button/add-to-farm-button';
import { RELATION_STYLE } from '@/components/map-panel/constants';
import { MedalOdds } from '@/components/map-panel/medal-odds/medal-odds';
import { placeName } from '@/components/map-panel/utils';
import { ValleyUpgrade } from '@/components/map-panel/valley-upgrade/valley-upgrade';
import type { PanDirection } from '@/components/map-panel/world-map/types';
import { panStep } from '@/components/map-panel/world-map/utils';
import { WorldMap } from '@/components/map-panel/world-map/world-map';
import { SendArmyDialog } from '@/components/send-army-dialog/send-army-dialog';
import type { SendTarget } from '@/components/send-army-dialog/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCommand, usePlayer } from '@/hooks/use-game';
import { fmt, percent } from '@/lib/format';
import { tileName, zoneName } from '@/lib/game-data';
import { allOf } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

export function MapPanel({ city, mapSize }: { city: CityBean; mapSize: number }) {
  const { t } = useTranslation(['map-panel', 'common']);
  // the tile at the middle of the map (fractional while dragging, and allowed past the edge, which the map wraps)
  const [center, setCenter] = useState({ x: city.x, y: city.y });
  const [selected, setSelected] = useState<number | null>(null);
  const [target, setTarget] = useState<SendTarget | null>(null);
  const [moveTo, setMoveTo] = useState<{ x: number; y: number } | null>(null);
  const wrap = (v: number) => ((v % mapSize) + mapSize) % mapSize;
  const info = useQuery({
    ...getMapTilesByTileIdOptions({ path: { tileId: selected! } }),
    enabled: selected != null,
  });
  // valleys held by this city, then by the lord's other cities
  const player = usePlayer();
  const owned = new Map<number, { cityName: string; here: boolean }>();
  for (const c of player.data?.castles ?? []) if (c.id !== city.id) for (const v of c.fields) owned.set(v.id, { cityName: c.name, here: false });
  for (const v of city.fields) owned.set(v.id, { cityName: city.name, here: true });
  const release = useCommand(
    deleteValleysByTileIdMutation(),
    () => [
      getCitiesByCityIdQueryKey({ path: { cityId: city.id } }),
      getPlayerQueryKey(),
      allOf(getMapQueryKey),
      allOf(getMapTilesByTileIdQueryKey),
      getArmiesQueryKey(),
    ],
    t('release.success'),
  );
  const upgrade = useCommand(
    postValleysUpgradeMutation(),
    () => [getCitiesByCityIdQueryKey({ path: { cityId: city.id } }), allOf(getMapQueryKey), allOf(getMapTilesByTileIdQueryKey)],
    t('info.upgraded'),
  );
  const goTo = (x: number, y: number) => {
    setCenter({ x, y });
    setSelected(y * mapSize + x);
  };
  const pan = (dir: PanDirection) => {
    const { dx, dy } = panStep(dir);
    setCenter((c) => ({ x: c.x + dx, y: c.y + dy }));
  };

  const scouts = city.troop.scouter ?? 0;
  /** what can be scouted on a tile (empty land has nothing to see) */
  const kindOf = (t: NonNullable<typeof info.data>): SendTarget['kind'] =>
    t.type === TileType.CASTLE ? 'city' : t.type === TileType.NPC ? 'npc' : t.type === TileType.FLAT ? undefined : 'valley';
  const missionsFor = (t: NonNullable<typeof info.data>): number[] => {
    const m: number[] = [];
    if (t.canLoot || t.canOccupy) m.push(Mission.ATTACK);
    if (t.canScout && kindOf(t)) m.push(Mission.SCOUT);
    if (t.canSend) m.push(Mission.REINFORCE);
    if (t.canTrans) m.push(Mission.TRANSPORT);
    if (t.type === TileType.FLAT && !('owner' in t && t.owner)) m.push(Mission.BUILD_CITY);
    return m;
  };

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm tabular-nums">{t('title', { x: wrap(Math.round(center.x)), y: wrap(Math.round(center.y)) })}</CardTitle>
          <div className="flex gap-1">
            <Button size="icon-xs" variant="outline" onClick={() => pan('left')} aria-label={t('pan.left')}>
              <ArrowLeft />
            </Button>
            <Button size="icon-xs" variant="outline" onClick={() => pan('up')} aria-label={t('pan.up')}>
              <ArrowUp />
            </Button>
            <Button size="icon-xs" variant="outline" onClick={() => pan('down')} aria-label={t('pan.down')}>
              <ArrowDown />
            </Button>
            <Button size="icon-xs" variant="outline" onClick={() => pan('right')} aria-label={t('pan.right')}>
              <ArrowRight />
            </Button>
            <Button size="icon-xs" variant="outline" onClick={() => setCenter({ x: city.x, y: city.y })} aria-label={t('pan.home')}>
              <Crosshair />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <WorldMap
            center={center}
            onCenter={setCenter}
            mapSize={mapSize}
            selected={selected}
            onSelect={setSelected}
            home={{ x: city.x, y: city.y }}
            owned={owned}
          />
        </CardContent>
      </Card>
      <div className="grid content-start gap-4">
        <Card className="content-start">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{info.data ? placeName(info.data) : t('info.selectTile')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {info.data && (
              <>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary">{tileName(info.data.type)}</Badge>
                  <Badge variant="secondary">{t('common:level.short', { level: info.data.level })}</Badge>
                  <Badge variant="outline">
                    ({info.data.x}, {info.data.y}) · {zoneName(info.data.zoneId)}
                  </Badge>
                </div>
                {'userName' in info.data && info.data.userName && (
                  <p>
                    {info.data.allianceName
                      ? t('info.playerAlliance', { player: info.data.userName, alliance: info.data.allianceName, prestige: fmt(info.data.prestige ?? 0) })
                      : t('info.player', { player: info.data.userName, prestige: fmt(info.data.prestige ?? 0) })}
                  </p>
                )}
                {(info.data.type === TileType.NPC || (info.data.type === TileType.CASTLE && info.data.canLoot)) && <MedalOdds level={info.data.level} />}
                {'owner' in info.data && info.data.owner && <p>{t('info.heldBy', { city: info.data.owner.cityName, player: info.data.owner.userName })}</p>}
                {owned.get(info.data.id)?.here && (
                  <div className="flex items-center gap-2">
                    <ConfirmButton
                      size="xs"
                      variant="outline"
                      disabled={release.isPending}
                      title={t('release.title')}
                      description={t('release.description')}
                      confirmLabel={t('release.confirm')}
                      onConfirm={() => release.mutateAsync({ path: { tileId: info.data!.id } })}
                    >
                      {t('release.button')}
                    </ConfirmButton>
                    <span className="text-xs text-muted-foreground">{t('release.hint')}</span>
                  </div>
                )}
                {'upgradeCost' in info.data && !info.data.owner && (VALLEY_TYPES.includes(info.data.type) || info.data.type === TileType.NPC) && (
                  <ValleyUpgrade
                    city={city}
                    tile={info.data}
                    onUpgrade={(tileId) => upgrade.mutateAsync({ path: { tileId }, body: { cityId: city.id } })}
                    pending={upgrade.isPending}
                  />
                )}
                {info.data.type === TileType.FLAT && 'owner' in info.data && !info.data.owner && (
                  <Button size="sm" variant="outline" className="justify-self-start" onClick={() => setMoveTo({ x: info.data!.x, y: info.data!.y })}>
                    {t('info.moveCityHere')}
                  </Button>
                )}
                {missionsFor(info.data).length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        setTarget({ tileId: info.data!.id, name: placeName(info.data!), missions: missionsFor(info.data!), kind: kindOf(info.data!) })
                      }
                    >
                      {t('info.sendArmy')}
                    </Button>
                    {missionsFor(info.data).includes(Mission.ATTACK) && <AddToFarmButton city={city} tileId={info.data.id} tileName={placeName(info.data)} />}
                    {missionsFor(info.data).includes(Mission.SCOUT) && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={scouts <= 0}
                          onClick={() => {
                            const kind = kindOf(info.data!);
                            // lords' city scouts fight: send them all; elsewhere one always gets through
                            const n = kind === 'city' ? scouts : 1;
                            setTarget({
                              tileId: info.data!.id,
                              name: placeName(info.data!),
                              missions: missionsFor(info.data!),
                              mission: Mission.SCOUT,
                              troops: { scouter: String(n) },
                              kind,
                            });
                          }}
                        >
                          <Eye /> {t('info.scout')}
                        </Button>
                        {scouts <= 0 && <span className="text-xs text-muted-foreground">{t('info.noScouts')}</span>}
                      </>
                    )}
                  </div>
                )}
              </>
            )}
            <div className="mt-2 flex flex-wrap gap-1">
              <span className="rounded px-1.5 py-0.5 text-[10px] ring-[3px] ring-fuchsia-500 ring-inset">{t('legend.thisCityValleys')}</span>
              <span className="rounded px-1.5 py-0.5 text-[10px] ring-2 ring-violet-300 ring-inset">{t('legend.otherCitiesValleys')}</span>
              <span className="rounded px-1.5 py-0.5 text-[10px] ring-2 ring-amber-400 ring-inset">{t('legend.thisCity')}</span>
              {Object.values(RELATION_STYLE).map((r) => (
                <span key={r.label} className={cn('rounded px-1.5 py-0.5 text-[10px]', r.ring)}>
                  {t('legend.relationValleys', { relation: r.label })}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="content-start">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {t('held.title', { city: city.name })} <span className="font-normal text-muted-foreground">({city.fields.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm">
            {city.fields.length === 0 && <p className="text-muted-foreground">{t('held.none')}</p>}
            {[...city.fields]
              .sort((a, b) => b.level - a.level || a.type - b.type)
              .map((v) => {
                const bonus = percent(valleyBonus(v.type, v.level));
                const res = VALLEY_RESOURCE[v.type]?.[0];
                return (
                  <div key={v.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-muted">
                    <button onClick={() => goTo(v.x, v.y)} className="flex flex-1 items-center justify-between gap-2 text-left">
                      <span>
                        {t('held.row', { type: tileName(v.type), level: v.level })}{' '}
                        <span className="text-xs text-muted-foreground tabular-nums">
                          ({v.x},{v.y})
                        </span>
                      </span>
                      {res && (
                        <span className="text-xs text-emerald-600 tabular-nums dark:text-emerald-400">
                          {t('held.bonus', { bonus, resource: t(`common:resourcesInline.${res}`) })}
                        </span>
                      )}
                    </button>
                    <ConfirmButton
                      size="xs"
                      variant="outline"
                      disabled={release.isPending}
                      title={t('release.title')}
                      description={t('release.description')}
                      confirmLabel={t('release.confirm')}
                      onConfirm={() => release.mutateAsync({ path: { tileId: v.id } })}
                    >
                      {t('release.short')}
                    </ConfirmButton>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      </div>
      <SendArmyDialog city={city} target={target} onClose={() => setTarget(null)} />
      <CityDialog
        key={moveTo ? `${moveTo.x},${moveTo.y}` : 'none'}
        city={city}
        open={moveTo != null}
        target={moveTo ?? undefined}
        onClose={() => setMoveTo(null)}
      />
    </div>
  );
}
