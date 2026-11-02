import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { getMapTilesByTileIdOptions } from '@marchlands/api-client';
import { tileXY } from '@marchlands/core';

import { placeName } from '@/components/map-panel/utils';
import { usePlayer } from '@/hooks/use-game';

/** "(x,y) Barbarian city Lv 10" for a tile. */
export function TileLabel({ tileId }: { tileId: number }) {
  const { t } = useTranslation('common');
  const mapSize = usePlayer().data?.mapSizeX ?? 800;
  const { x, y } = tileXY(tileId, mapSize);
  const info = useQuery({
    ...getMapTilesByTileIdOptions({ path: { tileId } }),
    staleTime: 60_000,
  });
  return (
    <span className="tabular-nums">
      ({x},{y}) {info.data && <span className="text-muted-foreground">{t('level.named', { name: placeName(info.data), level: info.data.level })}</span>}
    </span>
  );
}
