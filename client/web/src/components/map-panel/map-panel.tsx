import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Crosshair, Eye } from 'lucide-react';
import {
  deleteValleysByTileIdMutation,
  getArmiesQueryKey,
  getCitiesByCityIdQueryKey,
  getMapOptions,
  getMapQueryKey,
  getMapTilesByTileIdOptions,
  getMapTilesByTileIdQueryKey,
  getPlayerQueryKey,
  postValleysUpgradeMutation,
  type CityBean,
  type MapCastle,
} from '@marchlands/api-client';
import { Mission, Relation, TileType, VALLEY_RESOURCE, VALLEY_TYPES, valleyBonus } from '@marchlands/core';
import { Badge } from '@/components/ui/badge';
import { ConfirmButton } from '@/components/confirm-button/confirm-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SendArmyDialog } from '@/components/send-army-dialog/send-army-dialog';
import type { SendTarget } from '@/components/send-army-dialog/types';
import { AddToFarmButton } from '@/components/flow-attack/add-to-farm-button/add-to-farm-button';
import { CityDialog } from '@/components/city-dialog/city-dialog';
import { useCommand, usePlayer } from '@/hooks/use-game';
import { allOf } from '@/lib/query-keys';
import { fmt } from '@/lib/format';
import { tileName, zoneName } from '@/lib/game-data';
import { cn } from '@/lib/utils';
import { placeName, relationGroup } from '@/components/map-panel/utils';
import { R, RELATION_STYLE, TILE_STYLE } from '@/components/map-panel/constants';
import { ValleyUpgrade } from '@/components/map-panel/valley-upgrade/valley-upgrade';
import { MedalOdds } from '@/components/map-panel/medal-odds/medal-odds';

export function MapPanel({ city, mapSize }: { city: CityBean; mapSize: number }) {
  const { t } = useTranslation(['map-panel', 'common']);
  const [center, setCenter] = useState({ x: city.x, y: city.y });
  const [selected, setSelected] = useState<number | null>(null);
  const [target, setTarget] = useState<SendTarget | null>(null);
  const [moveTo, setMoveTo] = useState<{ x: number; y: number } | null>(null);
  const wrap = (v: number) => ((v % mapSize) + mapSize) % mapSize;
  const view = useQuery({
    ...getMapOptions({ query: { x1: center.x - R, y1: center.y - R, x2: center.x + R, y2: center.y + R } }),
    placeholderData: keepPreviousData,
  });
  const info = useQuery({
    ...getMapTilesByTileIdOptions({ path: { tileId: selected! } }),
    enabled: selected != null,
  });
  const castles = new Map<string, MapCastle>((view.data?.castles ?? []).map((c) => [`${c.x},${c.y}`, c]));
  // valleys held by this city, then by the lord's other cities
  const player = usePlayer();
  const owned = new Map<number, { cityName: string; here: boolean }>();
  for (const c of player.data?.castles ?? []) if (c.id !== city.id) for (const v of c.fields) owned.set(v.id, { cityName: c.name, here: false });
  for (const v of city.fields) owned.set(v.id, { cityName: city.name, here: true });
  // other lords' valleys in view, coloured by relation
  const others = new Map((view.data?.valleys ?? []).filter((v) => !owned.has(v.id) && v.relation !== Relation.SELF).map((v) => [v.id, v]));
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
  const pan = (dx: number, dy: number) => setCenter((c) => ({ x: wrap(c.x + dx), y: wrap(c.y + dy) }));

  const tiles: { x: number; y: number; type: number; level: number }[] = [];
  if (view.data) {
    const { x1, y1, x2, mapStr } = view.data;
    const w = x2 - x1 + 1;
    for (let i = 0; i * 2 < mapStr.length; i++) {
      tiles.push({ x: wrap(x1 + (i % w)), y: wrap(y1 + Math.floor(i / w)), type: parseInt(mapStr[i * 2], 16), level: parseInt(mapStr[i * 2 + 1], 16) });
    }
  }

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
    <div className="grid items-start gap-4 lg:grid-cols-[auto_minmax(0,1fr)]">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm tabular-nums">{t('title', { x: center.x, y: center.y })}</CardTitle>
          <div className="flex gap-1">
            <Button size="icon-xs" variant="outline" onClick={() => pan(-R, 0)} aria-label={t('pan.west')}>
              <ArrowLeft />
            </Button>
            <Button size="icon-xs" variant="outline" onClick={() => pan(0, -R)} aria-label={t('pan.north')}>
              <ArrowUp />
            </Button>
            <Button size="icon-xs" variant="outline" onClick={() => pan(0, R)} aria-label={t('pan.south')}>
              <ArrowDown />
            </Button>
            <Button size="icon-xs" variant="outline" onClick={() => pan(R, 0)} aria-label={t('pan.east')}>
              <ArrowRight />
            </Button>
            <Button size="icon-xs" variant="outline" onClick={() => setCenter({ x: city.x, y: city.y })} aria-label={t('pan.home')}>
              <Crosshair />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-px overflow-hidden rounded-md border bg-border" style={{ width: 'min(90vw, 600px)' }}>
            {tiles.map((tile) => {
              const castle = castles.get(`${tile.x},${tile.y}`);
              const style = TILE_STYLE[tile.type] ?? TILE_STYLE[TileType.FLAT];
              const id = tile.y * mapSize + tile.x;
              const home = tile.x === city.x && tile.y === city.y;
              const held = owned.get(id);
              const foreign = others.get(id);
              const fStyle = foreign ? RELATION_STYLE[relationGroup(foreign.relation)] : null;
              return (
                <button
                  key={id}
                  title={
                    castle
                      ? castle.userName
                        ? t('tile.castle', { name: castle.name ?? '', player: castle.userName })
                        : (castle.name ?? tileName(TileType.NPC))
                      : [
                          t('tile.summary', { type: tileName(tile.type), level: tile.level, x: tile.x, y: tile.y }),
                          held && t('tile.heldByYou', { city: held.cityName }),
                          foreign &&
                            (foreign.allianceName
                              ? t('tile.heldByAlliance', { city: foreign.cityName, player: foreign.userName, alliance: foreign.allianceName })
                              : t('tile.heldBy', { city: foreign.cityName, player: foreign.userName })),
                          foreign && RELATION_STYLE[relationGroup(foreign.relation)].inline,
                        ]
                          .filter(Boolean)
                          .join(' · ')
                  }
                  onClick={() => setSelected(id)}
                  className={cn(
                    'relative flex aspect-square items-center justify-center text-[10px] font-medium leading-none',
                    style.className,
                    held && (held.here ? 'ring-[3px] ring-fuchsia-500 ring-inset' : 'ring-2 ring-violet-300 ring-inset'),
                    fStyle?.ring,
                    home && 'ring-2 ring-amber-400 ring-inset',
                    selected === id && 'ring-2 ring-primary ring-inset',
                  )}
                >
                  {tile.type === TileType.FLAT ? '' : tile.level}
                  {fStyle && (
                    <span
                      aria-label={t('tile.foreignValley', { relation: fStyle.label })}
                      className={cn('absolute top-0.5 right-0.5 size-1.5 rounded-full ring-1 ring-white', fStyle.dot)}
                    />
                  )}
                  {held && (
                    <span
                      aria-label={t('tile.yourValley')}
                      className={cn('absolute top-0.5 right-0.5 size-1.5 rounded-full ring-1 ring-white', held.here ? 'bg-fuchsia-500' : 'bg-violet-300')}
                    />
                  )}
                </button>
              );
            })}
          </div>
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
              {Object.entries(TILE_STYLE).map(([type, s]) => (
                <span key={type} className={cn('rounded px-1.5 py-0.5 text-[10px]', s.className)}>
                  {tileName(Number(type))}
                </span>
              ))}
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
                const bonus = Math.round(valleyBonus(v.type, v.level) * 100);
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
