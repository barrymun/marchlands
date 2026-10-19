import { useTranslation } from 'react-i18next';

import type { BuildingBean } from '@marchlands/api-client';

import { CITY_ART } from '@/components/buildings-panel/constants';
import { TOWN } from '@/components/buildings-panel/iso-city/constants';
import { wallSprites } from '@/components/buildings-panel/iso-city/utils';
import { WALLS } from '@/components/buildings-panel/iso-grid/constants';
import { IsoGrid } from '@/components/buildings-panel/iso-grid/iso-grid';
import { artBand, cityWallFile } from '@/lib/game-art';

/**
 * The town inside the walls as an isometric diamond, the Town Hall at its heart, ringed by the walls for their level
 * band with the gate on the front corner. With no walls built the town is outlined and the gate is where to build them.
 */
export function IsoCity({
  byPos,
  onSelect,
  highlight,
}: {
  byPos: ReadonlyMap<number, BuildingBean>;
  onSelect: (pos: number) => void;
  highlight?: (b: BuildingBean) => boolean;
}) {
  const { t } = useTranslation('buildings-panel');
  const walls = byPos.get(WALLS);
  const built = !!walls && walls.typeId !== 0;
  const extra = built ? wallSprites(TOWN.cols, TOWN.rows, (piece) => CITY_ART[cityWallFile(artBand(walls.level), piece)]) : [];
  return (
    <IsoGrid
      layout={TOWN}
      extra={extra}
      byPos={byPos}
      onSelect={onSelect}
      outlined={!built}
      highlight={highlight}
      label={t('scene.label', { area: t('inside.title') })}
    />
  );
}
