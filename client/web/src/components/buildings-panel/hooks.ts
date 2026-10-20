import { useQuery } from '@tanstack/react-query';

import {
  type CityBean,
  getArmiesOptions,
  getCitiesFortificationsQueuesOptions,
  getCitiesResearchOptions,
  getCitiesTroopsQueuesOptions,
  getReportsOptions,
} from '@marchlands/api-client';
import { buildingLevel, BuildingType } from '@marchlands/core';

import { townState } from '@/components/buildings-panel/utils';
import type { TownState } from '@/components/iso-anim/types';

/**
 * What the city is doing, for the animated town (`townState`): its training, research and fortification queues (the
 * same queries as the sidebar's In progress list, so they come from its cache), the armies, and the latest army
 * reports (for an attack on it). Loaded only while the town animates (`enabled`).
 */
export function useTownState(city: CityBean, enabled: boolean): TownState {
  const path = { path: { cityId: city.id } };
  const has = (type: number) => city.buildings.some((b) => b.typeId === type && b.level > 0);
  const research = useQuery({ ...getCitiesResearchOptions(path), enabled: enabled && buildingLevel(city.buildings, BuildingType.ACADEMY) > 0 });
  const troops = useQuery({ ...getCitiesTroopsQueuesOptions(path), enabled: enabled && has(BuildingType.BARRACKS) });
  const forts = useQuery({ ...getCitiesFortificationsQueuesOptions(path), enabled: enabled && buildingLevel(city.buildings, BuildingType.WALLS) > 0 });
  const armies = useQuery({ ...getArmiesOptions(), enabled });
  const reports = useQuery({ ...getReportsOptions({ query: { type: 1, pageNo: 1, pageSize: 10 } }), enabled });
  return townState(city, {
    troops: troops.data?.queues,
    forts: forts.data?.queues,
    techs: research.data?.techs,
    enemy: armies.data?.enemy,
    own: armies.data?.self,
    reports: reports.data?.reports,
  });
}
