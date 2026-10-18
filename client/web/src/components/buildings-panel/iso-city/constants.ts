import { INSIDE } from '@/components/buildings-panel/constants';
import { SLOT_PITCH, TOWN_HALL, WALLS } from '@/components/buildings-panel/iso-grid/constants';
import type { IsoLayout } from '@/components/buildings-panel/iso-grid/types';
import { townLayout } from '@/components/buildings-panel/iso-grid/utils';

/**
 * The town inside the walls: 6×6 cells spaced out on 9×9 tiles of grass, which leaves most of a tile between the walls
 * and the nearest buildings. The Town Hall covers the 2×2 block in the middle, and the 32 building slots fill every
 * other cell.
 */
export const TOWN: IsoLayout = townLayout({
  cols: 6,
  rows: 6,
  pitch: SLOT_PITCH,
  extra: 1,
  townHall: [2, 2],
  positions: INSIDE,
  townHallPos: TOWN_HALL,
  wallsPos: WALLS,
});
