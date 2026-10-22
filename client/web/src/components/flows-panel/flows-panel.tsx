// (marchlands) Flows: build a named series of actions (drag to reorder) and run it on any of your cities.
// The server runs each city all-or-nothing between waits; Preview runs up to the first wait and rolls
// everything back. Repeat runs the flow again after every run; one flow runs at a time, others queue.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { type CityBean, deletePlayerFlowsByFlowId, type Flow, getPlayerFlowsOptions, getPlayerFlowsQueryKey, postPlayerFlows } from '@marchlands/api-client';
import { flowActionMessage } from '@marchlands/core';

import { ConfirmButton } from '@/components/confirm-button/confirm-button';
import { CitiesSummary } from '@/components/flows-panel/cities-summary/cities-summary';
import { FlowEditor } from '@/components/flows-panel/flow-editor/flow-editor';
import { RunFlow } from '@/components/flows-panel/run-flow/run-flow';
import { StatusBadge } from '@/components/flows-panel/status-badge/status-badge';
import { StatusLine } from '@/components/flows-panel/status-line/status-line';
import type { EditDraft } from '@/components/flows-panel/types';
import { currentAction, keyed, strip } from '@/components/flows-panel/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { errorMessage } from '@/lib/api';
import { translateMessage } from '@/lib/messages';
import { cn } from '@/lib/utils';

export function FlowsPanel({ city }: { city: CityBean }) {
  const { t } = useTranslation(['flows-panel', 'common']);
  const qc = useQueryClient();
  const flows = useQuery(getPlayerFlowsOptions());
  const list = flows.data ?? [];
  // the flow being edited: a saved one (id) or a new one (id null)
  const [editing, setEditing] = useState<EditDraft | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = list.find((f) => f.id === selectedId) ?? null;

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
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <Card className="content-start self-start">
        <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
          <div className="grid gap-1">
            <CardTitle className="text-sm">{t('list.title')}</CardTitle>
            <CardDescription>{t('list.description')}</CardDescription>
          </div>
          <Button size="sm" onClick={startNew}>
            <Plus /> {t('list.new')}
          </Button>
        </CardHeader>
        <CardContent className="grid gap-1.5">
          {list.length === 0 && <p className="text-sm text-muted-foreground">{t('list.empty')}</p>}
          {list.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => (setSelectedId(f.id), setEditing(null))}
              className={cn(
                'grid gap-0.5 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/50',
                f.id === selectedId && !editing && 'border-primary bg-muted/50',
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{f.name}</span>
                <StatusBadge flow={f} />
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {t('list.actions', { count: f.actions.length })} · {f.actions.map((a) => translateMessage(flowActionMessage(a))).join(' → ')}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>
      <div className="grid content-start gap-4">
        {editing ? (
          <FlowEditor
            draft={editing}
            locked={list.some((f) => f.id === editing.id && (f.status === 'running' || f.status === 'waiting'))}
            onChange={setEditing}
            saving={save.isPending}
            onSave={() => save.mutate(editing)}
            onCancel={() => setEditing(null)}
          />
        ) : selected ? (
          <>
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <CardTitle className="text-sm">{selected.name}</CardTitle>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => startEdit(selected)}>
                    {t('common:actions.edit')}
                  </Button>
                  <ConfirmButton
                    size="sm"
                    variant="ghost"
                    aria-label={t('detail.deleteLabel', { name: selected.name })}
                    disabled={remove.isPending}
                    title={t('detail.deleteTitle', { name: selected.name })}
                    description={t('detail.deleteDescription')}
                    confirmLabel={t('detail.deleteConfirm')}
                    onConfirm={() => remove.mutateAsync(selected.id)}
                  >
                    <Trash2 />
                  </ConfirmButton>
                </div>
              </CardHeader>
              <CardContent>
                <ol className="grid gap-1 text-sm">
                  {selected.actions.map((a, i) => (
                    <li key={i} className={cn('flex items-center gap-2', currentAction(selected) === i && 'font-medium text-primary')}>
                      <span
                        className={cn(
                          'flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] tabular-nums',
                          currentAction(selected) === i && 'bg-primary text-primary-foreground',
                        )}
                      >
                        {i + 1}
                      </span>
                      {translateMessage(flowActionMessage(a))}
                    </li>
                  ))}
                </ol>
                <StatusLine flow={selected} />
                <p className="mt-2 text-xs text-muted-foreground">
                  {t('detail.runsOn')} <CitiesSummary targets={selected.cities} />
                </p>
                {selected.actions.some((a) => a.type === 'attackTargets' && !a.presetId) && (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{t('detail.noArmy')}</p>
                )}
              </CardContent>
            </Card>
            <RunFlow key={`${selected.id}:${JSON.stringify(selected.cities)}`} flow={selected} currentCityId={city.id} />
          </>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">{t('detail.pickFlow')}</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
