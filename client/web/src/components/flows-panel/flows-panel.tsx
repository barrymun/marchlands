// (marchlands) Flows: build a named series of actions (drag to reorder) and run it on any of your cities.
// The server runs each city all-or-nothing between waits; Preview runs up to the first wait and rolls
// everything back. Repeat runs the flow again after every run; one flow runs at a time, others queue.

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import type { CityBean, Flow } from '@marchlands/api-client';
import { describeFlowAction } from '@marchlands/core';
import { toast } from 'sonner';
import { ConfirmButton } from '@/components/confirm-button/confirm-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api, errorMessage, unwrap } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { EditDraft } from '@/components/flows-panel/types';
import { currentAction, keyed, strip } from '@/components/flows-panel/utils';
import { FlowEditor } from '@/components/flows-panel/flow-editor/flow-editor';
import { StatusBadge } from '@/components/flows-panel/status-badge/status-badge';
import { StatusLine } from '@/components/flows-panel/status-line/status-line';
import { RunFlow } from '@/components/flows-panel/run-flow/run-flow';
import { CitiesSummary } from '@/components/flows-panel/cities-summary/cities-summary';

export function FlowsPanel({ city }: { city: CityBean }) {
  const qc = useQueryClient();
  const flows = useQuery({ queryKey: ['flows'], queryFn: () => unwrap(api.GET('/api/v1/player/flows')) });
  const list = flows.data ?? [];
  // the flow being edited: a saved one (id) or a new one (id null)
  const [editing, setEditing] = useState<EditDraft | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = list.find((f) => f.id === selectedId) ?? null;

  const save = useMutation({
    mutationFn: (e: NonNullable<typeof editing>) =>
      unwrap(api.POST('/api/v1/player/flows', { body: { id: e.id, name: e.name.trim(), actions: e.actions.map(strip), cities: e.cities } })),
    onSuccess: (saved, e) => {
      qc.setQueryData(['flows'], saved);
      const flow = e.id ? saved.find((f) => f.id === e.id) : (saved.find((f) => f.name === e.name.trim()) ?? saved[saved.length - 1]);
      setSelectedId(flow?.id ?? null);
      setEditing(null);
      toast.success(`Saved "${e.name.trim()}"`);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE('/api/v1/player/flows/{flowId}', { params: { path: { flowId: id } } })),
    onSuccess: (saved) => {
      qc.setQueryData(['flows'], saved);
      setSelectedId(null);
      toast.success('Flow deleted');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const startNew = () => setEditing({ id: null, name: '', actions: [keyed({ type: 'setMayor', stat: 'power' })], cities: 'all' });
  const startEdit = (f: Flow) => setEditing({ id: f.id, name: f.name, actions: f.actions.map(keyed), cities: f.cities ?? 'all' });

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <Card className="content-start self-start">
        <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
          <div className="grid gap-1">
            <CardTitle className="text-sm">Flows</CardTitle>
            <CardDescription>A series of actions you run on any of your cities at once.</CardDescription>
          </div>
          <Button size="sm" onClick={startNew}>
            <Plus /> New
          </Button>
        </CardHeader>
        <CardContent className="grid gap-1.5">
          {list.length === 0 && <p className="text-sm text-muted-foreground">No flows yet.</p>}
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
                {f.actions.length} action{f.actions.length === 1 ? '' : 's'} · {f.actions.map(describeFlowAction).join(' → ')}
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
                    Edit
                  </Button>
                  <ConfirmButton
                    size="sm"
                    variant="ghost"
                    aria-label={`Delete ${selected.name}`}
                    disabled={remove.isPending}
                    title={`Delete the flow "${selected.name}"?`}
                    description="Its actions and settings are removed, and a run in progress stops. This cannot be undone."
                    confirmLabel="Delete flow"
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
                      {describeFlowAction(a)}
                    </li>
                  ))}
                </ol>
                <StatusLine flow={selected} />
                <p className="mt-2 text-xs text-muted-foreground">
                  Runs on: <CitiesSummary targets={selected.cities ?? 'all'} />
                </p>
                {selected.actions.some((a) => a.type === 'attackTargets' && !a.presetId) && (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                    Choose a saved army for the attack (Edit): until then its targets are skipped.
                  </p>
                )}
              </CardContent>
            </Card>
            <RunFlow key={`${selected.id}:${JSON.stringify(selected.cities)}`} flow={selected} currentCityId={city.id} />
          </>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">Pick a flow, or create a new one.</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
