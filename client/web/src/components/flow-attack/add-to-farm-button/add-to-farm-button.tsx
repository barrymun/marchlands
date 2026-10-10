// (marchlands) The "Attack targets" flow action: a saved army plus each city's own targets, picked by
// typing x,y here or with "Add to farming list" on the Map tab.

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Swords } from 'lucide-react';
import { getPlayerFlowsOptions, getPlayerFlowsQueryKey, postPlayerFlows, type CityBean, type Flow } from '@marchlands/api-client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { errorMessage } from '@/lib/api';
import type { AttackAction } from '@/components/flow-attack/types';
import { targetCap } from '@/components/flow-attack/utils';

/** Map tab: add a tile to this city's targets in a flow that has an "Attack targets" action. */
export function AddToFarmButton({ city, tileId, tileName }: { city: CityBean; tileId: number; tileName: string }) {
  const qc = useQueryClient();
  const flows = useQuery(getPlayerFlowsOptions());
  const farms = (flows.data ?? []).filter((f) => f.actions.some((a) => a.type === 'attackTargets'));
  const [busy, setBusy] = useState(false);

  /** true once saved; toasts what happened either way */
  const addTo = async (flow: Flow): Promise<boolean> => {
    const i = flow.actions.findIndex((a) => a.type === 'attackTargets');
    const action = flow.actions[i] as AttackAction;
    const list = action.targets[String(city.id)] ?? [];
    if (list.includes(tileId)) {
      toast.info(`${tileName} is already in "${flow.name}"`);
      return false;
    }
    if (list.length >= targetCap(city)) {
      toast.error(`${city.name} has no idle hero left for another target in "${flow.name}"`);
      return false;
    }
    const actions = flow.actions.map((a, j) => (j === i ? { ...action, targets: { ...action.targets, [String(city.id)]: [...list, tileId] } } : a));
    // the flow must also run on this city
    const cities = flow.cities === 'all' || flow.cities.includes(city.id) ? flow.cities : [...flow.cities, city.id];
    setBusy(true);
    try {
      const { data: saved } = await postPlayerFlows({ body: { id: flow.id, name: flow.name, actions, cities }, throwOnError: true });
      qc.setQueryData(getPlayerFlowsQueryKey(), saved);
      toast.success(`Added ${tileName} to "${flow.name}" (${city.name}, target ${list.length + 1})`);
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  /** No farming flow yet: start one ("Farming list") holding this tile; the saved army is chosen later in the Flows tab. */
  const createList = async (): Promise<boolean> => {
    setBusy(true);
    try {
      const { data: saved } = await postPlayerFlows({
        body: { name: 'Farming list', actions: [{ type: 'attackTargets', presetId: '', targets: { [String(city.id)]: [tileId] } }], cities: 'all' },
        throwOnError: true,
      });
      qc.setQueryData(getPlayerFlowsQueryKey(), saved);
      toast.success(`Started "Farming list" with ${tileName}`, { description: 'Choose the saved army to send in the Flows tab.' });
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState('');
  const flow = farms.find((f) => f.id === chosen) ?? farms[0];
  const cap = targetCap(city);
  const targets = flow ? ((flow.actions.find((a) => a.type === 'attackTargets') as AttackAction | undefined)?.targets[String(city.id)] ?? []) : [];
  const confirm = async () => {
    if (await (flow ? addTo(flow) : createList())) setOpen(false);
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={busy || (!farms.length && cap === 0)}
        title={!farms.length && cap === 0 ? 'Each target needs an idle hero in this city' : undefined}
        onClick={() => {
          setChosen(farms[0]?.id ?? '');
          setOpen(true);
        }}
      >
        <Swords /> Add to farming list
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add to farming list?</DialogTitle>
            <DialogDescription>
              {flow
                ? `${city.name} will attack ${tileName} as part of the flow below.`
                : `No flow farms yet: this starts a flow called "Farming list" with ${tileName} as ${city.name}'s first target. Choose the saved army to send in the Flows tab.`}
            </DialogDescription>
          </DialogHeader>
          {flow && (
            <div className="grid gap-2 text-sm">
              {farms.length > 1 ? (
                <Select value={flow.id} onValueChange={setChosen}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {farms.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p>
                  Flow: <span className="font-medium">{flow.name}</span>
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {targets.includes(tileId)
                  ? `${tileName} is already one of ${city.name}'s targets in this flow.`
                  : `${city.name} has ${targets.length} of ${cap} targets (one per idle hero).`}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy || (flow != null && (targets.includes(tileId) || targets.length >= cap))} onClick={() => void confirm()}>
              {flow ? 'Add target' : 'Start farming list'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
