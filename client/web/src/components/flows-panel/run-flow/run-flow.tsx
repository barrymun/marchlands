import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CirclePlay, Eye, Square } from 'lucide-react';
import {
  getCitiesBuildingsAvailableQueryKey,
  getCitiesBuildingsByPositionIdQueryKey,
  getCitiesByCityIdQueryKey,
  getCitiesFortificationsQueuesQueryKey,
  getCitiesFortificationsTrainableQueryKey,
  getCitiesResearchQueryKey,
  getCitiesTroopsQueuesQueryKey,
  getCitiesTroopsTrainableQueryKey,
  getPlayerFlowsQueryKey,
  getPlayerQueryKey,
  postPlayerFlowsRepeat,
  postPlayerFlowsRun,
  postPlayerFlowsStop,
  type Flow,
} from '@marchlands/api-client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { usePlayer } from '@/hooks/use-game';
import { errorMessage } from '@/lib/api';
import { allOf } from '@/lib/query-keys';
import type { Targets } from '@/components/flows-panel/types';
import { LastRun } from '@/components/flows-panel/run-flow/last-run/last-run';
import { LastPreview } from '@/components/flows-panel/run-flow/last-preview/last-preview';
import { CityPicker } from '@/components/flows-panel/city-picker/city-picker';
import { hasHero } from '@/components/flows-panel/utils';

/** Pick cities, then preview (up to the first wait, rolled back) or run the flow; repeat; stop; the latest preview or run. */
export function RunFlow({ flow, currentCityId }: { flow: Flow; currentCityId: number }) {
  const qc = useQueryClient();
  const cities = usePlayer().data?.castles ?? [];
  // starts from the flow's saved cities; changing them here applies to this run only
  const [targets, setTargets] = useState<Targets>(flow.cities ?? 'all');
  const own = new Set(cities.map((c) => c.id));
  // all cities: those with a hero (the server skips the others)
  const picked = targets === 'all' ? cities.filter(hasHero).map((c) => c.id) : targets.filter((id) => own.has(id));
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: getPlayerFlowsQueryKey() });
    // heroes, resources, population and queues changed in the cities that ran
    for (const key of [
      allOf(getCitiesByCityIdQueryKey),
      getPlayerQueryKey(),
      allOf(getCitiesTroopsQueuesQueryKey),
      allOf(getCitiesFortificationsQueuesQueryKey),
      allOf(getCitiesTroopsTrainableQueryKey),
      allOf(getCitiesFortificationsTrainableQueryKey),
      allOf(getCitiesResearchQueryKey),
      allOf(getCitiesBuildingsByPositionIdQueryKey),
      allOf(getCitiesBuildingsAvailableQueryKey),
    ])
      void qc.invalidateQueries({ queryKey: key });
  };
  const run = useMutation({
    mutationFn: async (asPreview: boolean) => {
      const { data } = await postPlayerFlowsRun({
        path: { flowId: flow.id },
        body: { cityIds: targets === 'all' ? 'all' : picked, preview: asPreview },
        throwOnError: true,
      });
      return data;
    },
    onSuccess: (r) => {
      if (r.preview) {
        // the server keeps the report on the flow (so a reload shows it); show it now, then sync
        const lastPreview = { at: Date.now(), cities: r.cities, skippedCities: r.skippedCities };
        qc.setQueryData(getPlayerFlowsQueryKey(), (list: Flow[] | undefined) => list?.map((f) => (f.id === flow.id ? { ...f, lastPreview } : f)));
        void qc.invalidateQueries({ queryKey: getPlayerFlowsQueryKey() });
        return;
      }
      refresh();
      const failed = r.cities.filter((c) => !c.ok).length;
      if (failed) toast.warning(`${flow.name}: failed in ${failed} cit${failed === 1 ? 'y' : 'ies'} and stopped`);
      else if (r.flow?.status === 'waiting') toast.success(`${flow.name}: started, now waiting`);
      else toast.success(`${flow.name}: done in ${r.cities.length} cit${r.cities.length === 1 ? 'y' : 'ies'}`);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const repeat = useMutation({
    mutationFn: async (on: boolean) => {
      const { data } = await postPlayerFlowsRepeat({ path: { flowId: flow.id }, body: { repeat: on }, throwOnError: true });
      return data;
    },
    onSuccess: (list, on) => {
      qc.setQueryData(getPlayerFlowsQueryKey(), list);
      refresh();
      toast.success(on ? `${flow.name}: repeats until a run fails or you switch it off` : `${flow.name}: stops after this run`);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const stop = useMutation({
    mutationFn: async () => {
      const { data } = await postPlayerFlowsStop({ path: { flowId: flow.id }, throwOnError: true });
      return data;
    },
    onSuccess: (list) => {
      qc.setQueryData(getPlayerFlowsQueryKey(), list);
      toast.success(`${flow.name}: stopped`);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const busy = run.isPending || repeat.isPending || stop.isPending;
  const idle = flow.status === 'idle';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Run</CardTitle>
        <CardDescription>
          Each city runs the flow all-or-nothing between waits: if an action fails there, what the flow did in that city since the last wait is undone, and the
          flow stops. Flows take turns between waits, so other flows run while one waits. Preview shows what would happen up to the first wait, without changing
          anything.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <CityPicker value={targets} onChange={setTargets} currentCityId={currentCityId} />
        <label className="flex items-start gap-2 text-sm">
          <Switch className="mt-0.5" checked={flow.repeat} disabled={busy} onCheckedChange={(on) => repeat.mutate(on)} />
          <span className="grid gap-0.5">
            <span>Repeat</span>
            <span className="text-xs text-muted-foreground">
              Runs again after every run (at most once a minute) on the flow&apos;s cities, until a run fails or you switch it off.
            </span>
          </span>
        </label>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" disabled={!picked.length || busy} onClick={() => run.mutate(true)}>
            <Eye /> Preview
          </Button>
          {idle ? (
            <Button disabled={!picked.length || busy} onClick={() => run.mutate(false)}>
              <CirclePlay /> Run on {picked.length} cit{picked.length === 1 ? 'y' : 'ies'}
            </Button>
          ) : (
            <Button variant="destructive" disabled={busy} onClick={() => stop.mutate()}>
              <Square /> Stop
            </Button>
          )}
        </div>
        {flow.lastPreview ? <LastPreview flow={flow} /> : flow.lastRun && <LastRun flow={flow} />}
      </CardContent>
    </Card>
  );
}
