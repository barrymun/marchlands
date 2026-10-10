import { useQuery } from '@tanstack/react-query';
import type { CityBean } from '@marchlands/api-client';
import { Button } from '@/components/ui/button';
import { TimerBar } from '@/components/timer-bar/timer-bar';
import { SpeedupOptions } from '@/components/speedup-options/speedup-options';
import { qk, useCommand } from '@/hooks/use-game';
import { api, unwrap } from '@/lib/api';
import type { Tech } from '@/components/research-panel/research-job/types';

/** One running research in this city: progress, speed-ups and cancel. */
export function ResearchJob({ city, tech }: { city: CityBean; tech: Tech }) {
  const path = { cityId: city.id };
  const techId = tech.typeId;
  const refresh = () => [qk.research(city.id), qk.city(city.id)];
  const cancel = useCommand(
    () => unwrap(api.DELETE('/api/v1/cities/{cityId}/research', { params: { path, query: { techId } } })),
    refresh,
    `${tech.name} research cancelled`,
  );
  const speedup = useCommand(
    (itemId: string) => unwrap(api.POST('/api/v1/cities/{cityId}/research/speedup', { params: { path }, body: { itemId, techId } })),
    () => [...refresh(), qk.player],
  );
  const coins = useQuery({
    queryKey: ['research-speedup-cost', city.id, techId, tech.endTime],
    refetchInterval: 15_000,
    queryFn: () => unwrap(api.GET('/api/v1/cities/{cityId}/research/speedup', { params: { path, query: { techId } } })),
  });
  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium">
        {tech.name} → Lv {tech.level + 1}
      </span>
      <TimerBar startTime={tech.startTime} endTime={tech.endTime} />
      <SpeedupOptions
        endTime={tech.endTime}
        goldNeed={coins.data?.goldNeed}
        gold={city.resource.gold}
        pending={speedup.isPending}
        onUse={(itemId) => speedup.mutate(itemId)}
      />
      <Button size="sm" variant="outline" className="justify-self-start" onClick={() => cancel.mutate(undefined)}>
        Cancel
      </Button>
    </div>
  );
}
