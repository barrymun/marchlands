import { useQuery } from '@tanstack/react-query';
import { getMapTilesByTileIdOptions } from '@marchlands/api-client';
import { tileXY } from '@marchlands/core';
import { usePlayer } from '@/hooks/use-game';

/** "(x,y) NPC City Lv 10" for a tile. */
export function TileLabel({ tileId }: { tileId: number }) {
  const mapSize = usePlayer().data?.mapSizeX ?? 800;
  const { x, y } = tileXY(tileId, mapSize);
  const info = useQuery({
    ...getMapTilesByTileIdOptions({ path: { tileId } }),
    staleTime: 60_000,
  });
  return (
    <span className="tabular-nums">
      ({x},{y}){' '}
      {info.data && (
        <span className="text-muted-foreground">
          {info.data.name} Lv {info.data.level}
        </span>
      )}
    </span>
  );
}
