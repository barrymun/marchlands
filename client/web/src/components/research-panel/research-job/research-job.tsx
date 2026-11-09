import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import {
  type CityBean,
  deleteCitiesResearchMutation,
  getCitiesByCityIdQueryKey,
  getCitiesResearchQueryKey,
  getCitiesResearchSpeedupOptions,
  getCitiesResearchSpeedupQueryKey,
  getPlayerQueryKey,
  postCitiesResearchSpeedupMutation,
} from '@marchlands/api-client';

import type { Tech } from '@/components/research-panel/research-job/types';
import { SpeedupOptions } from '@/components/speedup-options/speedup-options';
import { TimerBar } from '@/components/timer-bar/timer-bar';
import { Button } from '@/components/ui/button';
import { useCommand } from '@/hooks/use-game';
import { techName } from '@/lib/game-data';

/** One running research in this city: progress, speed-ups and cancel. */
export function ResearchJob({ city, tech }: { city: CityBean; tech: Tech }) {
  const { t } = useTranslation(['research-panel', 'common']);
  const path = { cityId: city.id };
  const techId = tech.typeId;
  const refresh = () => [getCitiesResearchQueryKey({ path }), getCitiesByCityIdQueryKey({ path })];
  const cancel = useCommand(deleteCitiesResearchMutation(), refresh, t('job.cancelled', { name: techName(techId) }));
  const costOptions = { path, query: { techId } };
  // the speed-up cost depends on the time left, so refresh it with the research
  const speedup = useCommand(postCitiesResearchSpeedupMutation(), () => [...refresh(), getPlayerQueryKey(), getCitiesResearchSpeedupQueryKey(costOptions)]);
  const coins = useQuery({ ...getCitiesResearchSpeedupOptions(costOptions), refetchInterval: 15_000 });
  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium">{t('job.progress', { name: techName(techId), level: tech.level + 1 })}</span>
      <TimerBar startTime={tech.startTime} endTime={tech.endTime} />
      <SpeedupOptions
        endTime={tech.endTime}
        goldNeed={coins.data?.goldNeed}
        city={city}
        pending={speedup.isPending}
        onUse={(itemId) => speedup.mutate({ path, body: { itemId, techId } })}
      />
      <Button size="sm" variant="outline" className="justify-self-start" onClick={() => cancel.mutate({ path, query: { techId } })}>
        {t('common:actions.cancel')}
      </Button>
    </div>
  );
}
