import { useQuery } from '@tanstack/react-query';

import { type CityBean, getCitiesFortificationsQueuesOptions, getCitiesResearchOptions, getCitiesTroopsQueuesOptions } from '@marchlands/api-client';
import { buildingLevel, BuildingType } from '@marchlands/core';

import type { Job } from '@/components/activity-dock/types';
import { useGameNav } from '@/hooks/use-game-nav';
import { fmtExact } from '@/lib/format';
import { buildingName, techName, troopName } from '@/lib/game-data';
import { i18n } from '@/lib/i18n';
import { PanelId, viewOf } from '@/lib/nav';

/** Everything running in the city: construction, research here, and the batch each barracks / the walls is producing. */
export function useJobs(city: CityBean): Job[] {
  const nav = useGameNav();
  const path = { path: { cityId: city.id } };
  const hasAcademy = buildingLevel(city.buildings, BuildingType.ACADEMY) > 0;
  const hasBarracks = city.buildings.some((b) => b.typeId === BuildingType.BARRACKS && b.level > 0);
  const hasWalls = buildingLevel(city.buildings, BuildingType.WALLS) > 0;
  const research = useQuery({ ...getCitiesResearchOptions(path), enabled: hasAcademy });
  const troops = useQuery({ ...getCitiesTroopsQueuesOptions(path), enabled: hasBarracks });
  const forts = useQuery({ ...getCitiesFortificationsQueuesOptions(path), enabled: hasWalls });

  const jobs: Job[] = [];
  for (const b of city.buildings) {
    if (b.status === 0) continue;
    jobs.push({
      key: `b${b.positionId}`,
      group: 'Building',
      label: i18n.t('activity-dock:job.level', { name: buildingName(b.typeId), level: b.level + 1 }),
      startTime: b.startTime,
      endTime: b.endTime,
      open: () => nav.go(viewOf(b.positionId), { building: b.positionId }),
    });
  }
  for (const t of research.data?.techs ?? []) {
    if (!t.upgrading || t.castleId !== city.id) continue;
    jobs.push({
      key: `r${t.typeId}`,
      group: 'Research',
      label: i18n.t('activity-dock:job.level', { name: techName(t.typeId), level: t.level + 1 }),
      startTime: t.startTime,
      endTime: t.endTime,
      open: () => nav.open(PanelId.RESEARCH),
    });
  }
  for (const q of [...(troops.data?.queues ?? []), ...(forts.data?.queues ?? [])]) {
    const running = q.allProduceQueue.find((x) => x.startTime > 0 && x.endTime > 0);
    if (!running) continue;
    const waiting = q.allProduceQueue.length - 1;
    jobs.push({
      key: `t${q.positionId}:${running.queueId}`,
      group: 'Training',
      label: i18n.t('activity-dock:job.troops', { troop: troopName(running.type), amount: fmtExact(running.num) }),
      note: waiting > 0 ? i18n.t('activity-dock:job.queued', { n: waiting }) : undefined,
      startTime: running.startTime,
      endTime: running.endTime,
      open: () => nav.open(PanelId.MILITARY),
    });
  }
  return jobs.sort((a, b) => a.endTime - b.endTime);
}
