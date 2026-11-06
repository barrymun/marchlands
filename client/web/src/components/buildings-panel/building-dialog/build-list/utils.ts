import { BuildingArea } from '@marchlands/core';

export function areaOf(pos: number): BuildingArea {
  if (pos === -2) return BuildingArea.WALLS;
  return pos >= 1000 ? BuildingArea.OUTSIDE : BuildingArea.INSIDE;
}
