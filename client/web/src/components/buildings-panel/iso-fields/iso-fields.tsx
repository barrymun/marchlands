import type { BuildingBean } from '@marchlands/api-client';

import { OUTSIDE } from '@/components/buildings-panel/constants';
import { FIELD_COLS, FIELD_ROWS } from '@/components/buildings-panel/iso-fields/constants';
import { SLOT_PITCH } from '@/components/buildings-panel/iso-grid/constants';
import { IsoGrid } from '@/components/buildings-panel/iso-grid/iso-grid';
import { fieldLayout } from '@/components/buildings-panel/iso-grid/utils';

/** The fields outside the walls as an isometric diamond; the fields the Town Hall has not unlocked yet lie rough. */
export function IsoFields({ byPos, unlocked, onSelect }: { byPos: ReadonlyMap<number, BuildingBean>; unlocked: number; onSelect: (pos: number) => void }) {
  const layout = fieldLayout({ cols: FIELD_COLS, rows: FIELD_ROWS, pitch: SLOT_PITCH, extra: 1, positions: OUTSIDE, unlocked });
  return <IsoGrid layout={layout} byPos={byPos} onSelect={onSelect} />;
}
