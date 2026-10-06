import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Crosshair, Eye } from 'lucide-react';
import type { CityBean, MapCastle } from '@evony/api-client';
import { Mission, Relation, TileType, VALLEY_RESOURCE, valleyBonus } from '@evony/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SendArmyDialog, type SendTarget } from '@/components/send-army-dialog';
import { CityDialog } from '@/components/city-dialog';
import { qk, useCommand, usePlayer } from '@/hooks/use-game';
import { api, unwrap } from '@/lib/api';
import { fmt } from '@/lib/format';
import { cn } from '@/lib/utils';

const R = 7; // 15x15 view
const TILE_STYLE: Record<number, { label: string; className: string }> = {
  [TileType.FOREST]: { label: 'Forest', className: 'bg-emerald-700/70 text-white' },
  [TileType.DESERT]: { label: 'Desert', className: 'bg-amber-300/80' },
  [TileType.HILL]: { label: 'Hill', className: 'bg-stone-400/80' },
  [TileType.SWAMP]: { label: 'Swamp', className: 'bg-teal-800/60 text-white' },
  [TileType.GRASS]: { label: 'Grassland', className: 'bg-lime-400/70' },
  [TileType.LAKE]: { label: 'Lake', className: 'bg-sky-500/70 text-white' },
  [TileType.FLAT]: { label: 'Flat', className: 'bg-yellow-100/70 dark:bg-yellow-950/40' },
  [TileType.CASTLE]: { label: 'City', className: 'bg-blue-600 text-white' },
  [TileType.NPC]: { label: 'Barbarian city', className: 'bg-red-700 text-white' },
};

type RelationGroup = 'friend' | 'enemy' | 'other';
const relationGroup = (r: number): RelationGroup => (r === Relation.ALLIANCE || r === Relation.ALLY ? 'friend' : r === Relation.ENEMY ? 'enemy' : 'other');
const RELATION_STYLE: Record<RelationGroup, { label: string; ring: string; dot: string }> = {
  friend: { label: 'Alliance & allies', ring: 'ring-2 ring-emerald-500 ring-inset', dot: 'bg-emerald-500' },
  enemy: { label: 'Enemy', ring: 'ring-2 ring-red-600 ring-inset', dot: 'bg-red-600' },
  other: { label: 'Other lords', ring: 'ring-2 ring-zinc-900 ring-inset dark:ring-zinc-100', dot: 'bg-zinc-900 dark:bg-zinc-100' },
};

export function MapPanel({ city, mapSize }: { city: CityBean; mapSize: number }) {
  const [center, setCenter] = useState({ x: city.x, y: city.y });
  const [selected, setSelected] = useState<number | null>(null);
  const [target, setTarget] = useState<SendTarget | null>(null);
  const [moveTo, setMoveTo] = useState<{ x: number; y: number } | null>(null);
  const wrap = (v: number) => ((v % mapSize) + mapSize) % mapSize;
  const view = useQuery({
    queryKey: qk.map(center.x, center.y),
    placeholderData: keepPreviousData,
    queryFn: () => unwrap(api.GET('/api/v1/map', { params: { query: { x1: center.x - R, y1: center.y - R, x2: center.x + R, y2: center.y + R } } })),
  });
  const info = useQuery({
    queryKey: ['tile', selected],
    enabled: selected != null,
    queryFn: () => unwrap(api.GET('/api/v1/map/tiles/{tileId}', { params: { path: { tileId: selected! } } })),
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
    (tileId: number) => unwrap(api.DELETE('/api/v1/valleys/{tileId}', { params: { path: { tileId } } })),
    () => [qk.city(city.id), qk.player, ['map'], ['tile'], qk.armies],
    'Valley released; any troops stationed there are marching home',
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
    <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)]">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm tabular-nums">
            Map ({center.x}, {center.y})
          </CardTitle>
          <div className="flex gap-1">
            <Button size="icon-xs" variant="outline" onClick={() => pan(-R, 0)} aria-label="West">
              <ArrowLeft />
            </Button>
            <Button size="icon-xs" variant="outline" onClick={() => pan(0, -R)} aria-label="North">
              <ArrowUp />
            </Button>
            <Button size="icon-xs" variant="outline" onClick={() => pan(0, R)} aria-label="South">
              <ArrowDown />
            </Button>
            <Button size="icon-xs" variant="outline" onClick={() => pan(R, 0)} aria-label="East">
              <ArrowRight />
            </Button>
            <Button size="icon-xs" variant="outline" onClick={() => setCenter({ x: city.x, y: city.y })} aria-label="Home">
              <Crosshair />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-px overflow-hidden rounded-md border bg-border" style={{ width: 'min(90vw, 600px)' }}>
            {tiles.map((t) => {
              const castle = castles.get(`${t.x},${t.y}`);
              const style = TILE_STYLE[t.type] ?? TILE_STYLE[TileType.FLAT];
              const id = t.y * mapSize + t.x;
              const home = t.x === city.x && t.y === city.y;
              const held = owned.get(id);
              const foreign = others.get(id);
              const fStyle = foreign ? RELATION_STYLE[relationGroup(foreign.relation)] : null;
              return (
                <button
                  key={id}
                  title={
                    castle
                      ? `${castle.name}${castle.userName ? ` (${castle.userName})` : ''}`
                      : `${style.label} Lv ${t.level} (${t.x},${t.y})${held ? ` · held by your city ${held.cityName}` : ''}${
                          foreign
                            ? ` · held by ${foreign.cityName} (${foreign.userName}${foreign.allianceName ? `, ${foreign.allianceName}` : ''}) · ${RELATION_STYLE[relationGroup(foreign.relation)].label.toLowerCase()}`
                            : ''
                        }`
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
                  {t.type === TileType.FLAT ? '' : t.level}
                  {fStyle && (
                    <span
                      aria-label={`${fStyle.label} valley`}
                      className={cn('absolute top-0.5 right-0.5 size-1.5 rounded-full ring-1 ring-white', fStyle.dot)}
                    />
                  )}
                  {held && (
                    <span
                      aria-label="your valley"
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
            <CardTitle className="text-sm">{info.data ? info.data.name : 'Select a tile'}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {info.data && (
              <>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary">{TILE_STYLE[info.data.type]?.label ?? info.data.type}</Badge>
                  <Badge variant="secondary">Lv {info.data.level}</Badge>
                  <Badge variant="outline">
                    ({info.data.x}, {info.data.y}) · {info.data.zoneName}
                  </Badge>
                </div>
                {'userName' in info.data && info.data.userName && (
                  <p>
                    Lord {info.data.userName}
                    {info.data.allianceName ? ` of ${info.data.allianceName}` : ''} · prestige {fmt(info.data.prestige ?? 0)}
                  </p>
                )}
                {'owner' in info.data && info.data.owner && (
                  <p>
                    Held by {info.data.owner.cityName} ({info.data.owner.userName})
                  </p>
                )}
                {owned.get(info.data.id)?.here && (
                  <div className="flex items-center gap-2">
                    <ConfirmButton
                      label="Release valley"
                      confirmLabel="Click again to release"
                      disabled={release.isPending}
                      onConfirm={() => release.mutate(info.data!.id)}
                    />
                    <span className="text-xs text-muted-foreground">Stationed troops march home; the production bonus stops.</span>
                  </div>
                )}
                {info.data.type === TileType.FLAT && 'owner' in info.data && !info.data.owner && (
                  <Button size="sm" variant="outline" className="justify-self-start" onClick={() => setMoveTo({ x: info.data!.x, y: info.data!.y })}>
                    Move city here…
                  </Button>
                )}
                {missionsFor(info.data).length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => setTarget({ tileId: info.data!.id, name: info.data!.name, missions: missionsFor(info.data!), kind: kindOf(info.data!) })}
                    >
                      Send army
                    </Button>
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
                              name: info.data!.name,
                              missions: missionsFor(info.data!),
                              mission: Mission.SCOUT,
                              troops: { scouter: String(n) },
                              kind,
                            });
                          }}
                        >
                          <Eye /> Scout
                        </Button>
                        {scouts <= 0 && <span className="text-xs text-muted-foreground">No Scouts in this city: train some in the Military tab.</span>}
                      </>
                    )}
                  </div>
                )}
              </>
            )}
            <div className="mt-2 flex flex-wrap gap-1">
              {Object.values(TILE_STYLE).map((s) => (
                <span key={s.label} className={cn('rounded px-1.5 py-0.5 text-[10px]', s.className)}>
                  {s.label}
                </span>
              ))}
              <span className="rounded px-1.5 py-0.5 text-[10px] ring-[3px] ring-fuchsia-500 ring-inset">This city's valleys</span>
              <span className="rounded px-1.5 py-0.5 text-[10px] ring-2 ring-violet-300 ring-inset">Your other cities' valleys</span>
              <span className="rounded px-1.5 py-0.5 text-[10px] ring-2 ring-amber-400 ring-inset">This city</span>
              {Object.values(RELATION_STYLE).map((r) => (
                <span key={r.label} className={cn('rounded px-1.5 py-0.5 text-[10px]', r.ring)}>
                  {r.label} valleys
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="content-start">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Valleys held by {city.name} <span className="font-normal text-muted-foreground">({city.fields.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm">
            {city.fields.length === 0 && <p className="text-muted-foreground">None yet: attack a valley to occupy it (up to your Town Hall level).</p>}
            {[...city.fields]
              .sort((a, b) => b.level - a.level || a.type - b.type)
              .map((v) => {
                const bonus = Math.round(valleyBonus(v.type, v.level) * 100);
                const res = VALLEY_RESOURCE[v.type]?.[0];
                return (
                  <div key={v.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-muted">
                    <button onClick={() => goTo(v.x, v.y)} className="flex flex-1 items-center justify-between gap-2 text-left">
                      <span>
                        {TILE_STYLE[v.type]?.label ?? 'Valley'} Lv {v.level}{' '}
                        <span className="text-xs text-muted-foreground tabular-nums">
                          ({v.x},{v.y})
                        </span>
                      </span>
                      {res && (
                        <span className="text-xs text-emerald-600 tabular-nums dark:text-emerald-400">
                          +{bonus}% {res === 'wood' ? 'lumber' : res}
                        </span>
                      )}
                    </button>
                    <ConfirmButton label="Release" confirmLabel="Release?" disabled={release.isPending} onConfirm={() => release.mutate(v.id)} />
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

/** Two-step button: the first click arms it for a few seconds, the second confirms. */
function ConfirmButton({ label, confirmLabel, disabled, onConfirm }: { label: string; confirmLabel: string; disabled?: boolean; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Button
      size="xs"
      variant={armed ? 'destructive' : 'outline'}
      disabled={disabled}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        onConfirm();
      }}
    >
      {armed ? confirmLabel : label}
    </Button>
  );
}
