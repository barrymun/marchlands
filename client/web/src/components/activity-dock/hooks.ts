import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import type { CityBean } from '@marchlands/api-client';
import { buildingLevel, BuildingType } from '@marchlands/core';
import type { Job } from '@/components/activity-dock/types';
import { qk } from '@/hooks/use-game';
import { api, unwrap } from '@/lib/api';
import { fmtExact, troopName } from '@/lib/format';

/** Everything running in the city: construction, research here, and the batch each barracks / the walls is producing. */
export function useJobs(city: CityBean): Job[] {
  const navigate = useNavigate();
  const go = (tab: string, search = '') => navigate(`/cities/${city.id}/${tab}${search}`);
  const path = { params: { path: { cityId: city.id } } };
  const hasAcademy = buildingLevel(city.buildings, BuildingType.ACADEMY) > 0;
  const hasBarracks = city.buildings.some((b) => b.typeId === BuildingType.BARRACKS && b.level > 0);
  const hasWalls = buildingLevel(city.buildings, BuildingType.WALLS) > 0;
  const research = useQuery({
    queryKey: qk.research(city.id),
    enabled: hasAcademy,
    queryFn: () => unwrap(api.GET('/api/v1/cities/{cityId}/research', path)),
  });
  const troops = useQuery({
    queryKey: qk.queues(city.id, false),
    enabled: hasBarracks,
    queryFn: () => unwrap(api.GET('/api/v1/cities/{cityId}/troops/queues', path)),
  });
  const forts = useQuery({
    queryKey: qk.queues(city.id, true),
    enabled: hasWalls,
    queryFn: () => unwrap(api.GET('/api/v1/cities/{cityId}/fortifications/queues', path)),
  });

  const jobs: Job[] = [];
  for (const b of city.buildings) {
    if (b.status === 0) continue;
    const demolishing = b.status === 2;
    jobs.push({
      key: `b${b.positionId}`,
      group: 'Building',
      label: `${b.name} → Lv ${demolishing ? b.level - 1 : b.level + 1}`,
      note: demolishing ? 'demolishing' : undefined,
      startTime: b.startTime,
      endTime: b.endTime,
      open: () => go('buildings', `?building=${b.positionId}`),
    });
  }
  for (const t of research.data?.techs ?? []) {
    if (!t.upgrading || t.castleId !== city.id) continue;
    jobs.push({
      key: `r${t.typeId}`,
      group: 'Research',
      label: `${t.name} → Lv ${t.level + 1}`,
      startTime: t.startTime,
      endTime: t.endTime,
      open: () => go('research'),
    });
  }
  for (const q of [...(troops.data?.queues ?? []), ...(forts.data?.queues ?? [])]) {
    const running = q.allProduceQueue.find((x) => x.startTime > 0 && x.endTime > 0);
    if (!running) continue;
    const waiting = q.allProduceQueue.length - 1;
    jobs.push({
      key: `t${q.positionId}:${running.queueId}`,
      group: 'Training',
      label: `${troopName(running.type)} ×${fmtExact(running.num)}`,
      note: waiting > 0 ? `+${waiting} queued` : undefined,
      startTime: running.startTime,
      endTime: running.endTime,
      open: () => go('military'),
    });
  }
  return jobs.sort((a, b) => a.endTime - b.endTime);
}
