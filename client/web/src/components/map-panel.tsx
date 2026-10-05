import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Crosshair } from 'lucide-react';
import type { CityBean, MapCastle } from '@evony/api-client';
import { Mission, TileType } from '@evony/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SendArmyDialog, type SendTarget } from '@/components/send-army-dialog';
import { CityDialog } from '@/components/city-dialog';
import { qk } from '@/hooks/use-game';
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
  const pan = (dx: number, dy: number) => setCenter((c) => ({ x: wrap(c.x + dx), y: wrap(c.y + dy) }));

  const tiles: { x: number; y: number; type: number; level: number }[] = [];
  if (view.data) {
    const { x1, y1, x2, mapStr } = view.data;
    const w = x2 - x1 + 1;
    for (let i = 0; i * 2 < mapStr.length; i++) {
      tiles.push({ x: wrap(x1 + (i % w)), y: wrap(y1 + Math.floor(i / w)), type: parseInt(mapStr[i * 2], 16), level: parseInt(mapStr[i * 2 + 1], 16) });
    }
  }

  const missionsFor = (t: NonNullable<typeof info.data>): number[] => {
    const m: number[] = [];
    if (t.canLoot || t.canOccupy) m.push(Mission.ATTACK);
    if (t.canScout) m.push(Mission.SCOUT);
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
              return (
                <button
                  key={id}
                  title={castle ? `${castle.name}${castle.userName ? ` (${castle.userName})` : ''}` : `${style.label} Lv ${t.level} (${t.x},${t.y})`}
                  onClick={() => setSelected(id)}
                  className={cn(
                    'flex aspect-square items-center justify-center text-[10px] font-medium leading-none',
                    style.className,
                    selected === id && 'ring-2 ring-primary ring-inset',
                    home && 'ring-2 ring-amber-400 ring-inset',
                  )}
                >
                  {t.type === TileType.FLAT ? '' : t.level}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
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
              {info.data.type === TileType.FLAT && 'owner' in info.data && !info.data.owner && (
                <Button size="sm" variant="outline" className="justify-self-start" onClick={() => setMoveTo({ x: info.data!.x, y: info.data!.y })}>
                  Move city here…
                </Button>
              )}
              {missionsFor(info.data).length > 0 && (
                <Button
                  size="sm"
                  className="justify-self-start"
                  onClick={() => setTarget({ tileId: info.data!.id, name: info.data!.name, missions: missionsFor(info.data!) })}
                >
                  Send army
                </Button>
              )}
            </>
          )}
          <div className="mt-2 flex flex-wrap gap-1">
            {Object.values(TILE_STYLE).map((s) => (
              <span key={s.label} className={cn('rounded px-1.5 py-0.5 text-[10px]', s.className)}>
                {s.label}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
      <SendArmyDialog city={city} target={target} onClose={() => setTarget(null)} />
      <CityDialog key={moveTo ? `${moveTo.x},${moveTo.y}` : 'none'} city={city} open={moveTo != null} target={moveTo ?? undefined} onClose={() => setMoveTo(null)} />
    </div>
  );
}
