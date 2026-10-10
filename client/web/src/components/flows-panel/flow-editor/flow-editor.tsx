import { useState } from 'react';
import { ArrowDown, ArrowUp, Check, GripVertical, Plus, X } from 'lucide-react';
import { FLOW_TROOP_IDS } from '@marchlands/core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { Draft, EditDraft } from '@/components/flows-panel/types';
import { keyed } from '@/components/flows-panel/utils';
import { ActionFields } from '@/components/flows-panel/flow-editor/action-fields/action-fields';
import { CityPicker } from '@/components/flows-panel/city-picker/city-picker';

export function FlowEditor({
  draft,
  locked,
  onChange,
  saving,
  onSave,
  onCancel,
}: {
  draft: EditDraft;
  /** the flow is running: its actions keep their order (settings can change) */
  locked: boolean;
  onChange: (d: EditDraft) => void;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const setActions = (actions: Draft[]) => onChange({ ...draft, actions });
  const move = (from: number, to: number) => {
    if (locked || to < 0 || to >= draft.actions.length || from === to) return;
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
        <CardDescription>
          Actions run top to bottom in each city. A wait pauses the whole flow, every city together. Drag actions (or use the arrows) to reorder.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {locked && (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            This flow is running: you can change its settings (targets, amounts, cities), but stop it to add, remove or reorder actions.
          </p>
        )}
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
              draggable={!locked}
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
              <GripVertical className={cn('size-4 shrink-0 text-muted-foreground', locked ? 'opacity-30' : 'cursor-grab')} aria-hidden />
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] tabular-nums">{i + 1}</span>
              <ActionFields action={a} cities={draft.cities} onChange={(x) => update(i, x)} />
              <div className="ml-auto flex gap-0.5">
                <Button size="icon-xs" variant="ghost" aria-label="Move up" disabled={locked || i === 0} onClick={() => move(i, i - 1)}>
                  <ArrowUp />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Move down"
                  disabled={locked || i === draft.actions.length - 1}
                  onClick={() => move(i, i + 1)}
                >
                  <ArrowDown />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Remove action"
                  disabled={locked}
                  onClick={() => setActions(draft.actions.filter((_, j) => j !== i))}
                >
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
            disabled={locked || draft.actions.length >= 20}
            onClick={() => setActions([...draft.actions, keyed({ type: 'setMayor', stat: 'management' })])}
          >
            <Plus /> Set mayor
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={locked || draft.actions.length >= 20}
            onClick={() =>
              setActions([...draft.actions, keyed({ type: 'trainTroops', troopId: FLOW_TROOP_IDS.includes(7) ? 7 : FLOW_TROOP_IDS[0], amount: 'max' })])
            }
          >
            <Plus /> Train troops
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={locked || draft.actions.length >= 20}
            onClick={() => setActions([...draft.actions, keyed({ type: 'attackTargets', presetId: '', targets: {} })])}
          >
            <Plus /> Attack targets
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={locked || draft.actions.length >= 20}
            onClick={() => setActions([...draft.actions, keyed({ type: 'healTroops', payWith: 'resources', when: 'armiesHome' })])}
          >
            <Plus /> Heal troops
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={locked || draft.actions.length >= 20}
            onClick={() => setActions([...draft.actions, keyed({ type: 'wait', until: 'armiesHome', minutes: 10 })])}
          >
            <Plus /> Wait
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
