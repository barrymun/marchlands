import { useState } from 'react';
import type { CityBean } from '@marchlands/api-client';
import { BALANCE, itemConfig, STATE_NAMES } from '@marchlands/core';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { qk, useCommand } from '@/hooks/use-game';
import { useInventory } from '@/hooks/use-inventory';
import { api, unwrap } from '@/lib/api';

const TELEPORT = 'consume.move.1';
const ADV_TELEPORT = 'player.more.castle.1.a';

/** City settings: rename, and moving the city with a City Teleporter (random spot in a state) or an Adv City Teleporter (chosen flat). */
export function CityDialog({ city, open, onClose, target }: { city: CityBean; open: boolean; onClose: () => void; target?: { x: number; y: number } }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-md">
        <CityForm city={city} target={target} onDone={onClose} />
      </DialogContent>
    </Dialog>
  );
}

function CityForm({ city, target, onDone }: { city: CityBean; target?: { x: number; y: number }; onDone: () => void }) {
  const inv = useInventory();
  const [name, setName] = useState('');
  const [zone, setZone] = useState('0');
  const [x, setX] = useState(target ? String(target.x) : '');
  const [y, setY] = useState(target ? String(target.y) : '');
  const refresh = () => [qk.city(city.id), qk.player, ['map'], ['tile']];
  const rename = useCommand(
    () => unwrap(api.PATCH('/api/v1/cities/{cityId}', { params: { path: { cityId: city.id } }, body: { name: name.trim() } })),
    refresh,
    'City renamed',
  );
  const move = useCommand(
    (body: { zoneId?: number; targetTileId?: number }) => unwrap(api.POST('/api/v1/cities/{cityId}/move', { params: { path: { cityId: city.id } }, body })),
    refresh,
    'City moved',
  );
  const size = BALANCE.mapSize;
  const tx = Number(x);
  const ty = Number(y);
  const validXY = x !== '' && y !== '' && Number.isInteger(tx) && Number.isInteger(ty) && tx >= 0 && ty >= 0 && tx < size && ty < size;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{city.name}</DialogTitle>
        <DialogDescription>
          ({city.x},{city.y}) · {city.zoneName}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <WorkRates city={city} />
        <Separator />
        <div className="grid gap-2">
          <Label htmlFor="city-name">Rename (free)</Label>
          <div className="flex gap-2">
            <Input id="city-name" value={name} maxLength={20} placeholder={city.name} onChange={(e) => setName(e.target.value)} />
            <Button disabled={!name.trim() || rename.isPending} onClick={() => rename.mutate(undefined, { onSuccess: () => setName('') })}>
              Rename
            </Button>
          </div>
        </div>
        <Separator />
        <p className="text-xs text-muted-foreground">
          Moving needs every army of this city at home and no foreign troops on the way. Occupied valleys are released.
        </p>
        <div className="grid gap-2">
          <Label>
            {itemConfig(TELEPORT)?.name} ×{inv.count(TELEPORT)}: random free spot in a state
          </Label>
          <div className="flex gap-2">
            <Select value={zone} onValueChange={setZone}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATE_NAMES.map((n, i) => (
                  <SelectItem key={n} value={String(i)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button disabled={inv.count(TELEPORT) === 0 || move.isPending} onClick={() => move.mutate({ zoneId: Number(zone) }, { onSuccess: onDone })}>
              Teleport
            </Button>
          </div>
        </div>
        <div className="grid gap-2">
          <Label>
            {itemConfig(ADV_TELEPORT)?.name} ×{inv.count(ADV_TELEPORT)}: a free flat tile you choose
          </Label>
          <div className="flex gap-2">
            <Input inputMode="numeric" placeholder="x" value={x} onChange={(e) => setX(e.target.value.replace(/\D/g, ''))} />
            <Input inputMode="numeric" placeholder="y" value={y} onChange={(e) => setY(e.target.value.replace(/\D/g, ''))} />
            <Button
              disabled={inv.count(ADV_TELEPORT) === 0 || !validXY || move.isPending}
              onClick={() => move.mutate({ targetTileId: ty * size + tx }, { onSuccess: onDone })}
            >
              Teleport
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

const FIELD_RES = ['food', 'wood', 'stone', 'iron'] as const;
const FIELD_LABEL = { food: 'Food', wood: 'Lumber', stone: 'Stone', iron: 'Iron' } as const;

/**
 * Work rates (interior.modifyCommenceRate): the share of each field type's workers this city
 * employs. Lower rates produce less but free people as idle population, which barracks train from.
 */
function WorkRates({ city }: { city: CityBean }) {
  const current = Object.fromEntries(FIELD_RES.map((r) => [r, city.resource[r].workRate])) as Record<(typeof FIELD_RES)[number], number>;
  const [draft, setDraft] = useState<Record<string, string>>({});
  const value = (r: (typeof FIELD_RES)[number]) => draft[r] ?? String(current[r]);
  const save = useCommand(
    (rates: Partial<Record<(typeof FIELD_RES)[number], number>>) =>
      unwrap(api.PUT('/api/v1/cities/{cityId}/work-rates', { params: { path: { cityId: city.id } }, body: rates })),
    () => [qk.city(city.id)],
    'Work rates saved',
  );
  const setAll = (n: number) => save.mutate(Object.fromEntries(FIELD_RES.map((r) => [r, n])), { onSuccess: () => setDraft({}) });
  const parsed = Object.fromEntries(FIELD_RES.map((r) => [r, Math.min(100, Math.max(0, Number(value(r)) || 0))])) as Record<(typeof FIELD_RES)[number], number>;
  const dirty = FIELD_RES.some((r) => parsed[r] !== current[r]);
  const workers = FIELD_RES.reduce((t, r) => t + city.resource[r].workPeople, 0);
  return (
    <div className="grid gap-2">
      <Label>Production work rates</Label>
      <p className="text-xs text-muted-foreground">
        Lower a rate to free that field type&apos;s workers: they become idle population you can train troops from. At 0% the fields produce nothing. Idle now:{' '}
        {city.resource.idlePopulation.toLocaleString('en')} · in the fields: {workers.toLocaleString('en')}.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {FIELD_RES.map((r) => (
          <label key={r} className="grid gap-1 text-xs">
            <span className="text-muted-foreground">{FIELD_LABEL[r]} %</span>
            <Input
              inputMode="numeric"
              className="h-8"
              value={value(r)}
              onChange={(e) => setDraft({ ...draft, [r]: e.target.value.replace(/\D/g, '').slice(0, 3) })}
            />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate(parsed, { onSuccess: () => setDraft({}) })}>
          Save rates
        </Button>
        <Button size="sm" variant="outline" disabled={save.isPending} onClick={() => setAll(0)}>
          All 0% (everyone idle)
        </Button>
        <Button size="sm" variant="outline" disabled={save.isPending} onClick={() => setAll(100)}>
          All 100%
        </Button>
      </div>
    </div>
  );
}
