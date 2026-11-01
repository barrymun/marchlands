import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CirclePlay, Eye, Square } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
  type Flow,
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
} from '@marchlands/api-client';

import { CityPicker } from '@/components/flows-panel/city-picker/city-picker';
import { LastPreview } from '@/components/flows-panel/run-flow/last-preview/last-preview';
import { LastRun } from '@/components/flows-panel/run-flow/last-run/last-run';
import { withPreview } from '@/components/flows-panel/run-flow/utils';
import type { Targets } from '@/components/flows-panel/types';
import { hasHero, hiresHeroes } from '@/components/flows-panel/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { usePlayer } from '@/hooks/use-game';
import { errorMessage } from '@/lib/api';
import { allOf } from '@/lib/query-keys';

/** Pick cities, then preview (up to the first wait, rolled back) or run the flow; repeat; stop; the latest preview or run. */
export function RunFlow({ flow, currentCityId }: { flow: Flow; currentCityId: number }) {
  const { t } = useTranslation('flows-panel');
  const qc = useQueryClient();
  const cities = usePlayer().data?.castles ?? [];
  // starts from the flow's saved cities; changing them here applies to this run only
  const [targets, setTargets] = useState<Targets>(flow.cities);
  const own = new Set(cities.map((c) => c.id));
  // all cities: those with a hero (the server skips the others), or every city when the flow hires heroes
  const hires = hiresHeroes(flow.actions);
  const picked = targets === 'all' ? cities.filter((c) => hires || hasHero(c)).map((c) => c.id) : targets.filter((id) => own.has(id));
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
        qc.setQueryData(getPlayerFlowsQueryKey(), (list: Flow[] | undefined) => withPreview(list, flow.id, r));
        void qc.invalidateQueries({ queryKey: getPlayerFlowsQueryKey() });
        return;
      }
      refresh();
      const failed = r.cities.filter((c) => !c.ok).length;
      if (failed) toast.warning(t('runFlow.toasts.failed', { name: flow.name, count: failed }));
      else if (r.flow?.status === 'waiting') toast.success(t('runFlow.toasts.waiting', { name: flow.name }));
      else toast.success(t('runFlow.toasts.done', { name: flow.name, count: r.cities.length }));
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
      toast.success(on ? t('runFlow.toasts.repeatOn', { name: flow.name }) : t('runFlow.toasts.repeatOff', { name: flow.name }));
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
      toast.success(t('runFlow.toasts.stopped', { name: flow.name }));
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const busy = run.isPending || repeat.isPending || stop.isPending;
  const idle = flow.status === 'idle';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{t('runFlow.title')}</CardTitle>
        <CardDescription>{t('runFlow.description')}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <CityPicker value={targets} onChange={setTargets} currentCityId={currentCityId} hires={hires} />
        <label className="flex items-start gap-2 text-sm">
          <Switch className="mt-0.5" checked={flow.repeat} disabled={busy} onCheckedChange={(on) => repeat.mutate(on)} />
          <span className="grid gap-0.5">
            <span>{t('runFlow.repeat')}</span>
            <span className="text-xs text-muted-foreground">{t('runFlow.repeatHint')}</span>
          </span>
        </label>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" disabled={!picked.length || busy} onClick={() => run.mutate(true)}>
            <Eye /> {t('runFlow.preview')}
          </Button>
          {idle ? (
            <Button disabled={!picked.length || busy} onClick={() => run.mutate(false)}>
              <CirclePlay /> {t('runFlow.run', { count: picked.length })}
            </Button>
          ) : (
            <Button variant="destructive" disabled={busy} onClick={() => stop.mutate()}>
              <Square /> {t('runFlow.stop')}
            </Button>
          )}
        </div>
        {flow.lastPreview ? <LastPreview preview={flow.lastPreview} /> : flow.lastRun && <LastRun run={flow.lastRun} />}
      </CardContent>
    </Card>
  );
}
