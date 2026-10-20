import { useTranslation } from 'react-i18next';

import type { BuildingBean } from '@marchlands/api-client';

import { OUTSIDE } from '@/components/buildings-panel/constants';
import { FIELD_COLS, FIELD_ROWS } from '@/components/buildings-panel/iso-fields/constants';
import { SLOT_PITCH } from '@/components/buildings-panel/iso-grid/constants';
import { IsoGrid } from '@/components/buildings-panel/iso-grid/iso-grid';
import { fieldLayout } from '@/components/buildings-panel/iso-grid/utils';
import type { TownState } from '@/components/iso-anim/types';

/** The fields outside the walls as an isometric diamond; the fields the Town Hall has not unlocked yet lie rough. */
export function IsoFields({
  cityId,
  people,
  state,
  byPos,
  unlocked,
  onSelect,
  highlight,
}: {
  cityId: number;
  /** how many people work the fields */
  people: number;
  /** what the city is doing, for the buildings that show it */
  state: TownState;
  byPos: ReadonlyMap<number, BuildingBean>;
  unlocked: number;
  onSelect: (pos: number) => void;
  highlight?: (b: BuildingBean) => boolean;
}) {
  const { t } = useTranslation('buildings-panel');
  const layout = fieldLayout({ cols: FIELD_COLS, rows: FIELD_ROWS, pitch: SLOT_PITCH, extra: 1, positions: OUTSIDE, unlocked });
  return (
    <IsoGrid
      cityId={cityId}
      people={people}
      state={state}
      layout={layout}
      byPos={byPos}
      onSelect={onSelect}
      highlight={highlight}
      label={t('scene.label', { area: t('fields.title') })}
    />
  );
}
