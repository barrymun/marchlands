// (evony-re) Flows: build a named series of actions (drag to reorder) and run it on any of your cities.
// The server runs each city all-or-nothing; Preview runs it and rolls everything back.

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Check, CirclePlay, Eye, GripVertical, HeartPulse, Plus, Trash2, X } from 'lucide-react';
import type { CityBean, Flow, FlowAction, FlowRunReport } from '@evony/api-client';
import { describeFlowAction, FLOW_STAT_LABEL, FLOW_TROOP_IDS } from '@evony/core';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AttackTargetsFields } from '@/components/flow-attack';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { qk, usePlayer } from '@/hooks/use-game';
import { api, errorMessage, unwrap } from '@/lib/api';
import { attributeOfStat } from '@/lib/hero-attributes';
import { troopName } from '@/lib/format';
import { cn } from '@/lib/utils';

type Stat = keyof typeof FLOW_STAT_LABEL;
/** An action in the editor, with a stable key for drag and drop. */
type Draft = FlowAction & { key: string };
/** Cities a flow runs on: every city (now and later) or chosen ones. */
type Targets = 'all' | number[];
type EditDraft = { id: string | null; name: string; actions: Draft[]; cities: Targets };

let nextKey = 0;
const keyed = (a: FlowAction): Draft => ({ ...a, key: `a${nextKey++}` });
const strip = ({ key: _k, ...a }: Draft): FlowAction => a as FlowAction;

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
              <span className="font-medium">{f.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {f.actions.length} action{f.actions.length === 1 ? '' : 's'} · {f.actions.map(describeFlowAction).join(' → ')}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>
      <div className="grid content-start gap-4">
        {editing ? (
          <FlowEditor draft={editing} onChange={setEditing} saving={save.isPending} onSave={() => save.mutate(editing)} onCancel={() => setEditing(null)} />
        ) : selected ? (
          <>
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <CardTitle className="text-sm">{selected.name}</CardTitle>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => startEdit(selected)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Delete ${selected.name}`}
                    disabled={remove.isPending}
                    onClick={() => confirm(`Delete the flow "${selected.name}"?`) && remove.mutate(selected.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ol className="grid gap-1 text-sm">
                  {selected.actions.map((a, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] tabular-nums">{i + 1}</span>
                      {describeFlowAction(a)}
                    </li>
                  ))}
                </ol>
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

function FlowEditor({
  draft,
  onChange,
  saving,
  onSave,
  onCancel,
}: {
  draft: EditDraft;
  onChange: (d: EditDraft) => void;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const setActions = (actions: Draft[]) => onChange({ ...draft, actions });
  const move = (from: number, to: number) => {
    if (to < 0 || to >= draft.actions.length || from === to) return;
    const next = [...draft.actions];
    const [a] = next.splice(from, 1);
    next.splice(to, 0, a);
    setActions(next);
  };
  const update = (i: number, a: Draft) => setActions(draft.actions.map((x, j) => (j === i ? a : x)));
  const valid =
    draft.name.trim().length > 0 &&
    draft.actions.length > 0 &&
    (draft.cities === 'all' || draft.cities.length > 0) &&
    draft.actions.every((a) => a.type !== 'attackTargets' || !!a.presetId);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{draft.id ? 'Edit flow' : 'New flow'}</CardTitle>
        <CardDescription>Actions run top to bottom in each city. Drag them (or use the arrows) to reorder.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="flow-name">Name</Label>
          <Input
            id="flow-name"
            maxLength={40}
            placeholder="e.g. Instant archers"
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
          />
        </div>
        <CityPicker value={draft.cities} onChange={(cities) => onChange({ ...draft, cities })} />
        <ol className="grid gap-2">
          {draft.actions.map((a, i) => (
            <li
              key={a.key}
              draggable
              onDragStart={(e) => {
                setDragging(i);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(i);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragging != null) move(dragging, i);
                setDragging(null);
                setOver(null);
              }}
              onDragEnd={() => (setDragging(null), setOver(null))}
              className={cn(
                'flex flex-wrap items-center gap-2 rounded-md border bg-card p-2 transition-colors',
                dragging === i && 'opacity-50',
                over === i && dragging != null && dragging !== i && 'border-primary',
              )}
            >
              <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden />
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] tabular-nums">{i + 1}</span>
              <ActionFields action={a} cities={draft.cities} onChange={(x) => update(i, x)} />
              <div className="ml-auto flex gap-0.5">
                <Button size="icon-xs" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, i - 1)}>
                  <ArrowUp />
                </Button>
                <Button size="icon-xs" variant="ghost" aria-label="Move down" disabled={i === draft.actions.length - 1} onClick={() => move(i, i + 1)}>
                  <ArrowDown />
                </Button>
                <Button size="icon-xs" variant="ghost" aria-label="Remove action" onClick={() => setActions(draft.actions.filter((_, j) => j !== i))}>
                  <X />
                </Button>
              </div>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={draft.actions.length >= 20}
            onClick={() => setActions([...draft.actions, keyed({ type: 'setMayor', stat: 'management' })])}
          >
            <Plus /> Set mayor
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={draft.actions.length >= 20}
            onClick={() =>
              setActions([...draft.actions, keyed({ type: 'trainTroops', troopId: FLOW_TROOP_IDS.includes(7) ? 7 : FLOW_TROOP_IDS[0], amount: 'max' })])
            }
          >
            <Plus /> Train troops
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={draft.actions.length >= 20}
            onClick={() => setActions([...draft.actions, keyed({ type: 'attackTargets', presetId: '', targets: {} })])}
          >
            <Plus /> Attack targets
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={draft.actions.length >= 20}
            onClick={() => setActions([...draft.actions, keyed({ type: 'healTroops', payWith: 'resources', when: 'armiesHome' })])}
          >
            <Plus /> Heal troops
          </Button>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button disabled={!valid || saving} onClick={onSave}>
            <Check /> Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** The inputs of one action: which attribute for "set mayor"; troop type and amount (or max) for "train". */
function ActionFields({ action, cities, onChange }: { action: Draft; cities: Targets; onChange: (a: Draft) => void }) {
  if (action.type === 'attackTargets') {
    return <AttackTargetsFields action={action} cities={cities} onChange={(a) => onChange({ ...a, key: action.key })} />;
  }
  if (action.type === 'healTroops') {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <HeartPulse className="size-4 text-muted-foreground" />
        <span>Heal all injured troops with</span>
        <Select value={action.payWith} onValueChange={(v) => onChange({ ...action, payWith: v as 'resources' | 'honor' })}>
          <SelectTrigger size="sm" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="resources">Resources</SelectItem>
            <SelectItem value="honor">Honor</SelectItem>
          </SelectContent>
        </Select>
        <Select value={action.when ?? 'now'} onValueChange={(v) => onChange({ ...action, when: v as 'now' | 'armiesHome' })}>
          <SelectTrigger size="sm" className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="now">right away</SelectItem>
            <SelectItem value="armiesHome">when the city's armies are home</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }
  if (action.type === 'setMayor') {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>Set mayor: highest</span>
        <Select value={action.stat} onValueChange={(v) => onChange({ ...action, stat: v as Stat })}>
          <SelectTrigger size="sm" className={cn('w-36 font-medium', attributeOfStat(action.stat).tone)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(FLOW_STAT_LABEL) as Stat[]).map((s) => (
              <SelectItem key={s} value={s}>
                {FLOW_STAT_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  const max = action.amount === 'max';
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span>Train</span>
      {!max && (
        <Input
          className="h-8 w-28"
          inputMode="numeric"
          aria-label="Amount"
          value={String(action.amount)}
          onChange={(e) => onChange({ ...action, amount: Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1) })}
        />
      )}
      <label className="flex items-center gap-1.5 text-xs">
        <Switch checked={max} onCheckedChange={(on) => onChange({ ...action, amount: on ? 'max' : 1000 })} />
        Max
      </label>
      <Select value={String(action.troopId)} onValueChange={(v) => onChange({ ...action, troopId: Number(v) })}>
        <SelectTrigger size="sm" className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FLOW_TROOP_IDS.map((id) => (
            <SelectItem key={id} value={String(id)}>
              {troopName(id)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Pick cities, then preview (run and roll back) or run the flow; shows what happened in each city. */
function RunFlow({ flow, currentCityId }: { flow: Flow; currentCityId: number }) {
  const qc = useQueryClient();
  const cities = usePlayer().data?.castles ?? [];
  // starts from the flow's saved cities; changing them here applies to this run only
  const [targets, setTargets] = useState<Targets>(flow.cities ?? 'all');
  const own = new Set(cities.map((c) => c.id));
  const picked = targets === 'all' ? cities.map((c) => c.id) : targets.filter((id) => own.has(id));
  const [report, setReport] = useState<FlowRunReport | null>(null);
  const run = useMutation({
    mutationFn: (preview: boolean) =>
      unwrap(api.POST('/api/v1/player/flows/{flowId}/run', { params: { path: { flowId: flow.id } }, body: { cityIds: picked, preview } })),
    onSuccess: (r) => {
      setReport(r);
      if (r.preview) return;
      // heroes, resources, population and queues changed in the cities that ran
      for (const key of [['city'], qk.player, ['queues'], ['trainable'], ['research'], ['upgrade'], ['available']])
        void qc.invalidateQueries({ queryKey: key });
      const failed = r.cities.filter((c) => !c.ok).length;
      if (failed) toast.warning(`${flow.name}: ${r.cities.length - failed} done, ${failed} rolled back`);
      else toast.success(`${flow.name}: done in ${r.cities.length} cit${r.cities.length === 1 ? 'y' : 'ies'}`);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Run</CardTitle>
        <CardDescription>
          Each city runs the whole flow or nothing: if an action fails there, everything the flow did in that city is undone. Preview shows what would happen
          without changing anything.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <CityPicker value={targets} onChange={setTargets} currentCityId={currentCityId} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" disabled={!picked.length || run.isPending} onClick={() => run.mutate(true)}>
            <Eye /> Preview
          </Button>
          <Button disabled={!picked.length || run.isPending} onClick={() => run.mutate(false)}>
            <CirclePlay /> Run on {picked.length} cit{picked.length === 1 ? 'y' : 'ies'}
          </Button>
        </div>
        {report && <RunReport report={report} />}
      </CardContent>
    </Card>
  );
}

function RunReport({ report }: { report: FlowRunReport }) {
  return (
    <div className="grid gap-2">
      <div className="text-xs font-medium text-muted-foreground uppercase">{report.preview ? 'Preview (nothing was changed)' : 'Result'}</div>
      {report.cities.map((c) => (
        <div key={c.cityId} className={cn('grid gap-1 rounded-md border p-2 text-sm', !c.ok && 'border-destructive/50 bg-destructive/5')}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{c.cityName}</span>
            <Badge variant={c.ok ? 'secondary' : 'destructive'}>{c.ok ? (report.preview ? 'Would run' : 'Done') : 'Rolled back'}</Badge>
          </div>
          <ol className="grid gap-0.5 text-xs">
            {c.steps.map((s, i) => (
              <li key={i} className={cn('flex gap-1.5', s.ok ? 'text-muted-foreground' : 'text-destructive')}>
                {s.ok ? <Check className="mt-0.5 size-3 shrink-0 text-emerald-600" /> : <X className="mt-0.5 size-3 shrink-0" />}
                <div className="grid min-w-0 gap-1">
                  <span>
                    <span className="text-foreground">{s.action}:</span> {s.detail}
                  </span>
                  {s.items && s.items.length > 0 && <StepItems items={s.items} />}
                </div>
              </li>
            ))}
          </ol>
          {!c.ok && <p className="text-xs text-destructive">Nothing was changed in this city.</p>}
        </div>
      ))}
    </div>
  );
}

type StepItem = NonNullable<FlowRunReport['cities'][number]['steps'][number]['items']>[number];

/** Per-target outcomes; when every target was skipped for the same reason, the reason is shown once. */
function StepItems({ items }: { items: StepItem[] }) {
  const reasons = new Set(items.map((i) => i.detail));
  if (items.length > 1 && reasons.size === 1 && !items[0].ok) {
    return (
      <div className="grid gap-1">
        <span className="text-amber-700 dark:text-amber-400">
          All {items.length} {items[0].detail}
        </span>
        <span className="flex flex-wrap gap-1">
          {items.map((i) => (
            <span key={i.label} className="rounded bg-muted px-1.5 py-px tabular-nums">
              {i.label}
            </span>
          ))}
        </span>
      </div>
    );
  }
  return (
    <ul className="grid gap-0.5">
      {items.map((i) => (
        <li key={i.label} className="flex gap-1.5">
          <span className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', i.ok ? 'bg-emerald-500' : 'bg-amber-500')} aria-hidden />
          <span>
            <span className="text-foreground tabular-nums">{i.label}</span> <span className={i.ok ? '' : 'text-amber-700 dark:text-amber-400'}>{i.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** "All cities", or the chosen cities' names. */
function CitiesSummary({ targets }: { targets: Targets }) {
  const cities = usePlayer().data?.castles ?? [];
  if (targets === 'all') return <span className="text-foreground">all cities</span>;
  const names = cities.filter((c) => targets.includes(c.id)).map((c) => c.name);
  return <span className="text-foreground">{names.length ? names.join(', ') : 'none of your current cities'}</span>;
}

/** All cities (including ones gained later), or a selection of one or more cities. */
function CityPicker({ value, onChange, currentCityId }: { value: Targets; onChange: (t: Targets) => void; currentCityId?: number }) {
  const cities = usePlayer().data?.castles ?? [];
  const all = value === 'all';
  const chosen = new Set(all ? [] : value);
  const set = (id: number, on: boolean) => onChange(on ? [...chosen, id] : [...chosen].filter((x) => x !== id));
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">Cities</Label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={all}
          onCheckedChange={(on) => onChange(on === true ? 'all' : currentCityId != null ? [currentCityId] : cities.slice(0, 1).map((c) => c.id))}
        />
        All cities <span className="text-xs text-muted-foreground">({cities.length}, and any you gain later)</span>
      </label>
      {!all && (
        <div className="grid gap-1 pl-6 sm:grid-cols-2">
          {cities.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={chosen.has(c.id)} onCheckedChange={(on) => set(c.id, on === true)} />
              <span className="truncate">
                {c.name}{' '}
                <span className="text-xs text-muted-foreground tabular-nums">
                  ({c.x},{c.y}){c.id === currentCityId ? ' · here' : ''}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}
      {!all && chosen.size === 0 && <p className="text-xs text-destructive">Choose at least one city.</p>}
    </div>
  );
}
