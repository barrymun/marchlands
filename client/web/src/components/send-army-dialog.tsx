import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { CityBean } from '@evony/api-client';
import { HeroStatus, Mission, TROOP_KEYS, type TroopKey } from '@evony/core';
import { Button } from '@/components/ui/button';
import { useSticky } from '@/hooks/use-sticky';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MISSION_NAMES } from '@/components/armies-panel';
import { qk, useCommand } from '@/hooks/use-game';
import { api, unwrap } from '@/lib/api';
import { duration, fmt, fmtExact, troopName } from '@/lib/format';

export interface SendTarget {
  tileId: number;
  name: string;
  missions: number[];
}

export function SendArmyDialog({ city, target, onClose }: { city: CityBean; target: SendTarget | null; onClose: () => void }) {
  const shown = useSticky(target);
  return (
    <Dialog open={target != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">{shown && <SendForm key={shown.tileId} city={city} target={shown} onDone={onClose} />}</DialogContent>
    </Dialog>
  );
}

const RES = ['gold', 'food', 'wood', 'stone', 'iron'] as const;

function SendForm({ city, target, onDone }: { city: CityBean; target: SendTarget; onDone: () => void }) {
  const [mission, setMission] = useState(String(target.missions[0]));
  const [heroId, setHeroId] = useState('none');
  const [troops, setTroops] = useState<Partial<Record<TroopKey, string>>>({});
  const [resources, setResources] = useState<Partial<Record<(typeof RES)[number], string>>>({});
  const available = Object.entries(TROOP_KEYS).filter(([, key]) => city.troop[key] > 0);
  const idleHeroes = city.heros.filter((h) => h.status === HeroStatus.IDLE && !h.seized);
  const troopBody = Object.fromEntries(Object.entries(troops).map(([k, v]) => [k, Number(v || 0)]).filter(([, n]) => Number(n) > 0));
  const resourceBody = Object.fromEntries(Object.entries(resources).map(([k, v]) => [k, Number(v || 0)]).filter(([, n]) => Number(n) > 0));
  const path = { cityId: city.id };

  const estimate = useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/cities/{cityId}/armies/estimate', { params: { path }, body: { targetTileId: target.tileId, troops: troopBody } })),
  });
  const send = useCommand(
    () =>
      unwrap(
        api.POST('/api/v1/cities/{cityId}/armies', {
          params: { path },
          body: {
            targetTileId: target.tileId,
            mission: Number(mission),
            troops: troopBody,
            resources: Number(mission) === Mission.TRANSPORT || Number(mission) === Mission.BUILD_CITY ? resourceBody : undefined,
            heroId: heroId === 'none' ? null : Number(heroId),
          },
        }),
      ),
    () => [qk.armies, qk.city(city.id)],
    'Army dispatched',
  );
  const carriesResources = Number(mission) === Mission.TRANSPORT || Number(mission) === Mission.BUILD_CITY;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Send army</DialogTitle>
        <DialogDescription>
          From {city.name} to {target.name}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label>Mission</Label>
            <Select value={mission} onValueChange={setMission}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {target.missions.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {MISSION_NAMES[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Hero</Label>
            <Select value={heroId} onValueChange={setHeroId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No hero</SelectItem>
                {idleHeroes.map((h) => (
                  <SelectItem key={h.id} value={String(h.id)}>
                    {h.name} (Lv {h.level})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-2">
          <Label>Troops</Label>
          {available.length === 0 && <p className="text-sm text-muted-foreground">No troops in the city.</p>}
          {available.map(([id, key]) => (
            <div key={key} className="flex items-center justify-between gap-2 text-sm">
              <span>
                {troopName(Number(id))} <span className="text-muted-foreground">({fmtExact(city.troop[key])})</span>
              </span>
              <div className="flex items-center gap-1">
                <Input
                  className="h-8 w-24"
                  inputMode="numeric"
                  value={troops[key] ?? ''}
                  placeholder="0"
                  onChange={(e) => setTroops({ ...troops, [key]: e.target.value.replace(/\D/g, '') })}
                />
                <Button size="xs" variant="ghost" onClick={() => setTroops({ ...troops, [key]: String(city.troop[key]) })}>
                  All
                </Button>
              </div>
            </div>
          ))}
        </div>
        {carriesResources && (
          <div className="grid gap-2">
            <Label>Resources</Label>
            <div className="grid grid-cols-5 gap-2">
              {RES.map((r) => (
                <Input
                  key={r}
                  inputMode="numeric"
                  placeholder={r === 'wood' ? 'lumber' : r}
                  value={resources[r] ?? ''}
                  onChange={(e) => setResources({ ...resources, [r]: e.target.value.replace(/\D/g, '') })}
                />
              ))}
            </div>
          </div>
        )}
        {estimate.data && (
          <p className="text-sm text-muted-foreground">
            March {duration(estimate.data.marchTime)} · carries {fmt(estimate.data.load)}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" disabled={!Object.keys(troopBody).length} onClick={() => estimate.mutate()}>
          Estimate
        </Button>
        <Button disabled={!Object.keys(troopBody).length || send.isPending} onClick={() => send.mutate(undefined, { onSuccess: onDone })}>
          Send
        </Button>
      </DialogFooter>
    </>
  );
}
