// (marchlands) Flows: build a named series of actions (drag to reorder) and run it on any of your cities.
// The server runs each city all-or-nothing between waits; Preview runs up to the first wait and rolls
// everything back. Repeat runs the flow again after every run; one flow runs at a time, others queue.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { type CityBean, deletePlayerFlowsByFlowId, type Flow, getPlayerFlowsOptions, getPlayerFlowsQueryKey, postPlayerFlows } from '@marchlands/api-client';

import { FLOWS_SEARCH, SIDE_BY_SIDE } from '@/components/flows-panel/constants';
import { FlowDetail } from '@/components/flows-panel/flow-detail/flow-detail';
import { FlowEditor } from '@/components/flows-panel/flow-editor/flow-editor';
import { FlowList } from '@/components/flows-panel/flow-list/flow-list';
import type { EditDraft } from '@/components/flows-panel/types';
import { keyed, nextDue, strip } from '@/components/flows-panel/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useNow } from '@/hooks/use-now';
import { useSearchState } from '@/hooks/use-search-state';
import { errorMessage } from '@/lib/api';
import { duration } from '@/lib/format';

export function FlowsPanel({ city }: { city: CityBean }) {
  const { t } = useTranslation(['flows-panel', 'common']);
  const qc = useQueryClient();
  const now = useNow();
  const flows = useQuery(getPlayerFlowsOptions());
  const list = flows.data ?? [];
  // the flow being edited: a saved one (id) or a new one (id null)
  const [editing, setEditing] = useState<EditDraft | null>(null);
  const [{ flow: selectedId }, set] = useSearchState(FLOWS_SEARCH);
  const setSelectedId = (flow: string | null) => set({ flow });
  // the flow chosen, or the first: the detail never opens empty
  const selected = list.find((f) => f.id === selectedId) ?? list[0] ?? null;
  const due = nextDue(list, now);
  // on a narrow screen the detail sits under the list: choosing a flow brings it into view
  const detail = useRef<HTMLDivElement>(null);
  const choose = (id: string) => {
    setSelectedId(id);
    setEditing(null);
    if (!window.matchMedia(SIDE_BY_SIDE).matches) requestAnimationFrame(() => detail.current?.scrollIntoView({ block: 'start' }));
  };

  const save = useMutation({
    mutationFn: async (e: NonNullable<typeof editing>) => {
      const { data } = await postPlayerFlows({ body: { id: e.id, name: e.name.trim(), actions: e.actions.map(strip), cities: e.cities }, throwOnError: true });
      return data;
    },
    onSuccess: (saved, e) => {
      qc.setQueryData(getPlayerFlowsQueryKey(), saved);
      const flow = e.id ? saved.find((f) => f.id === e.id) : (saved.find((f) => f.name === e.name.trim()) ?? saved[saved.length - 1]);
      setSelectedId(flow?.id ?? null);
      setEditing(null);
      toast.success(t('common:savedName', { name: e.name.trim() }));
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await deletePlayerFlowsByFlowId({ path: { flowId: id }, throwOnError: true });
      return data;
    },
    onSuccess: (saved) => {
      qc.setQueryData(getPlayerFlowsQueryKey(), saved);
      setSelectedId(null);
      toast.success(t('toasts.deleted'));
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const startNew = () => setEditing({ id: null, name: '', actions: [keyed({ type: 'setMayor', stat: 'power' })], cities: 'all' });
  const startEdit = (f: Flow) => setEditing({ id: f.id, name: f.name, actions: f.actions.map(keyed), cities: f.cities });

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-0.5">
          <h1 className="text-lg font-semibold">{t('list.title')}</h1>
          <p className="text-xs text-muted-foreground">
            {t('list.description')}
            {due.active > 0 && (
              <>
                {' '}
                {t('header.active', { count: due.active })}
                {due.next != null && <span className="tabular-nums"> · {t('header.next', { time: duration(due.next - now) })}</span>}
              </>
            )}
          </p>
        </div>
        <Button size="sm" onClick={startNew}>
          <Plus /> {t('list.new')}
        </Button>
      </header>
      {flows.isPending ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <FlowList flows={list} selectedId={editing ? null : (selected?.id ?? null)} currentCityId={city.id} onSelect={choose} />
          <div ref={detail} className="min-w-0 scroll-mt-4">
            {editing ? (
              <FlowEditor
                draft={editing}
                locked={list.some((f) => f.id === editing.id && (f.status === 'running' || f.status === 'waiting'))}
                onChange={setEditing}
                saving={save.isPending}
                onSave={() => save.mutate(editing)}
                onCancel={() => setEditing(null)}
              />
            ) : (
              selected && (
                <FlowDetail
                  key={`${selected.id}:${JSON.stringify(selected.cities)}`}
                  flow={selected}
                  currentCityId={city.id}
                  onEdit={() => startEdit(selected)}
                  onDelete={() => remove.mutateAsync(selected.id)}
                  deleting={remove.isPending}
                />
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
