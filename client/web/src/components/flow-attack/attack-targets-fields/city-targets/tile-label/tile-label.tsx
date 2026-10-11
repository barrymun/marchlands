import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { getMapTilesByTileIdOptions } from '@marchlands/api-client';
import { tileXY } from '@marchlands/core';
import { usePlayer } from '@/hooks/use-game';
import { placeName } from '@/components/map-panel/utils';

/** "(x,y) Barbarian city Lv 10" for a tile. */
export function TileLabel({ tileId }: { tileId: number }) {
  const { t } = useTranslation(['flow-attack', 'common']);
  const mapSize = usePlayer().data?.mapSizeX ?? 800;
  const { x, y } = tileXY(tileId, mapSize);
  const info = useQuery({
    ...getMapTilesByTileIdOptions({ path: { tileId } }),
    staleTime: 60_000,
  });
  return (
    <span className="tabular-nums">
      ({x},{y}) {info.data && <span className="text-muted-foreground">{t('common:level.named', { name: placeName(info.data), level: info.data.level })}</span>}
    </span>
  );
}
