import { useMutation, useQueryClient } from '@tanstack/react-query';
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

import { withPreview } from '@/components/flows-panel/flow-detail/utils';
import type { Targets } from '@/components/flows-panel/types';
import { errorMessage } from '@/lib/api';
import { allOf } from '@/lib/query-keys';

/**
 * Running a flow: preview (up to the first wait, rolled back) or run it on `targets` (`picked`, the cities that
 * resolves to), switch repeat, stop it; `busy` while any of them is on its way.
 */
export function useFlowControls(flow: Flow, targets: Targets, picked: number[]) {
  const { t } = useTranslation('flows-panel');
  const qc = useQueryClient();
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
  return { run, repeat, stop, busy: run.isPending || repeat.isPending || stop.isPending };
}
