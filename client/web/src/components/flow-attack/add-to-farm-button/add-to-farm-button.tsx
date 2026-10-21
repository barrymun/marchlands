// (marchlands) The "Attack targets" flow action: a saved army plus each city's own targets, picked by
// typing x,y here or with "Add to farming list" on the Map tab.

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Swords } from 'lucide-react';
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { type CityBean, type Flow, getPlayerFlowsOptions, getPlayerFlowsQueryKey, postPlayerFlows } from '@marchlands/api-client';

import type { AttackAction } from '@/components/flow-attack/types';
import { targetCap } from '@/components/flow-attack/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { errorMessage } from '@/lib/api';

/** Map tab: add a tile to this city's targets in a flow that has an "Attack targets" action. */
export function AddToFarmButton({ city, tileId, tileName }: { city: CityBean; tileId: number; tileName: string }) {
  const { t } = useTranslation(['flow-attack', 'common']);
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
      toast.info(t('addToFarm.toasts.alreadyIn', { tile: tileName, flow: flow.name }));
      return false;
    }
    if (list.length >= targetCap(city)) {
      toast.error(t('addToFarm.toasts.noIdleHero', { city: city.name, flow: flow.name }));
      return false;
    }
    const actions = flow.actions.map((a, j) => (j === i ? { ...action, targets: { ...action.targets, [String(city.id)]: [...list, tileId] } } : a));
    // the flow must also run on this city
    const cities = flow.cities === 'all' || flow.cities.includes(city.id) ? flow.cities : [...flow.cities, city.id];
    setBusy(true);
    try {
      const { data: saved } = await postPlayerFlows({ body: { id: flow.id, name: flow.name, actions, cities }, throwOnError: true });
      qc.setQueryData(getPlayerFlowsQueryKey(), saved);
      toast.success(t('addToFarm.toasts.added', { tile: tileName, flow: flow.name, city: city.name, n: list.length + 1 }));
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
    const name = t('addToFarm.defaultName');
    setBusy(true);
    try {
      const { data: saved } = await postPlayerFlows({
        body: { name, actions: [{ type: 'attackTargets', presetId: '', targets: { [String(city.id)]: [tileId] } }], cities: 'all' },
        throwOnError: true,
      });
      qc.setQueryData(getPlayerFlowsQueryKey(), saved);
      toast.success(t('addToFarm.toasts.started', { name, tile: tileName }), { description: t('addToFarm.toasts.startedHint') });
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
  const targets = flow ? (flow.actions.find((a): a is AttackAction => a.type === 'attackTargets')?.targets[String(city.id)] ?? []) : [];
  const confirm = async () => {
    if (await (flow ? addTo(flow) : createList())) setOpen(false);
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={busy || (!farms.length && cap === 0)}
        title={!farms.length && cap === 0 ? t('addToFarm.needsHero') : undefined}
        onClick={() => {
          setChosen(farms[0]?.id ?? '');
          setOpen(true);
        }}
      >
        <Swords /> {t('addToFarm.button')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('addToFarm.dialogTitle')}</DialogTitle>
            <DialogDescription>
              {flow
                ? t('addToFarm.willAttack', { city: city.name, tile: tileName })
                : t('addToFarm.noFlow', { name: t('addToFarm.defaultName'), tile: tileName, city: city.name })}
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
                  <Trans t={t} i18nKey="addToFarm.flow" values={{ name: flow.name }} components={{ b: <span className="font-medium" /> }} />
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {targets.includes(tileId)
                  ? t('addToFarm.alreadyTarget', { tile: tileName, city: city.name })
                  : t('addToFarm.targetCount', { city: city.name, n: targets.length, count: cap })}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('common:actions.cancel')}
            </Button>
            <Button disabled={busy || (flow != null && (targets.includes(tileId) || targets.length >= cap))} onClick={() => void confirm()}>
              {flow ? t('addToFarm.addTarget') : t('addToFarm.start')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
