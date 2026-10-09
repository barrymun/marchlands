import { useState } from 'react';
import type { CityBean } from '@marchlands/api-client';
import { BALANCE, itemConfig, itemGoldPrice, merchantBase, merchantFixed } from '@marchlands/core';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Countdown } from '@/components/countdown';
import { qk, useCommand, usePlayer } from '@/hooks/use-game';
import { useInventory } from '@/hooks/use-inventory';
import { api, unwrap } from '@/lib/api';
import { fmt, signedRate } from '@/lib/format';

const TELEPORT = 'consume.move.1';

/** City settings: rename, and moving the city to a chosen free flat with a City Teleporter (bought with the city's gold when none is owned). */
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
  const player = usePlayer();
  const [name, setName] = useState('');
  const [x, setX] = useState(target ? String(target.x) : '');
  const [y, setY] = useState(target ? String(target.y) : '');
  const refresh = () => [qk.city(city.id), qk.player, ['map'], ['tile']];
  const rename = useCommand(
    () => unwrap(api.PATCH('/api/v1/cities/{cityId}', { params: { path: { cityId: city.id } }, body: { name: name.trim() } })),
    refresh,
    'City renamed',
  );
  const move = useCommand(
    (body: { targetTileId: number }) => unwrap(api.POST('/api/v1/cities/{cityId}/move', { params: { path: { cityId: city.id } }, body })),
    refresh,
    'City moved',
  );
  const size = BALANCE.mapSize;
  const tx = Number(x);
  const ty = Number(y);
  const validXY = x !== '' && y !== '' && Number.isInteger(tx) && Number.isInteger(ty) && tx >= 0 && ty >= 0 && tx < size && ty < size;
  const owned = inv.count(TELEPORT);
  const price = itemGoldPrice(TELEPORT) ?? 0;
  const cooldown = player.data?.buffs.find((b) => b.id === 'MoveCastleCoolDownBuff' && b.endTime > Date.now());

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
        <TaxRate city={city} />
        <Separator />
        <div className="grid gap-2">
          <Label htmlFor="city-name">Rename</Label>
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
            {itemConfig(TELEPORT)?.name} · {owned > 0 ? `×${owned}` : `${fmt(price)} gold`}: a free flat tile you choose
          </Label>
          <div className="flex gap-2">
            <Input inputMode="numeric" placeholder="x" value={x} onChange={(e) => setX(e.target.value.replace(/\D/g, ''))} />
            <Input inputMode="numeric" placeholder="y" value={y} onChange={(e) => setY(e.target.value.replace(/\D/g, ''))} />
            <Button
              disabled={!validXY || !!cooldown || move.isPending || (owned === 0 && city.resource.gold < price)}
              title={owned > 0 ? undefined : `Bought with ${city.name}'s gold`}
              onClick={() => move.mutate({ targetTileId: ty * size + tx }, { onSuccess: onDone })}
            >
              Teleport
            </Button>
          </div>
          {cooldown && (
            <p className="text-xs text-muted-foreground">
              Cooling down: next move in <Countdown endTime={cooldown.endTime} />.
            </p>
          )}
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

/**
 * (marchlands) The tax rate sells that share of the city's field output to the merchant as it is produced
 * (at its price, BALANCE.merchant); the people always pay the base tax on top.
 */
function TaxRate({ city }: { city: CityBean }) {
  const r = city.resource;
  const [draft, setDraft] = useState<string | null>(null);
  const save = useCommand(
    (rate: number) => unwrap(api.PUT('/api/v1/cities/{cityId}/tax', { params: { path: { cityId: city.id } }, body: { rate } })),
    () => [qk.city(city.id)],
    'Tax rate saved',
  );
  const rate = Math.min(100, Math.max(0, Number(draft ?? r.taxRate) || 0));
  // gross output per game hour: the net rate plus what upkeep and the current tax take
  const gross = Object.fromEntries(FIELD_RES.map((k) => [k, r[k].increaseRate - r[k].breakdown.upkeep - r[k].breakdown.tax])) as Record<
    (typeof FIELD_RES)[number],
    number
  >;
  const sold = FIELD_RES.reduce((g, k) => g + gross[k] * (rate / 100) * merchantBase(k), 0);
  const baseTax = r.taxIncome - r.taxConverted;
  return (
    <div className="grid gap-2">
      <Label htmlFor="tax-rate">Tax rate</Label>
      <p className="text-xs text-muted-foreground">
        This share of each hour&apos;s new food, lumber, stone and iron is sold to the merchant
        {merchantFixed() != null ? ` at ${merchantFixed()} gold each` : ''} as it is produced. Stored resources are never sold. The base tax (
        {signedRate(baseTax)} gold) is paid at any rate.
      </p>
      <div className="flex items-center gap-2">
        <Input
          id="tax-rate"
          inputMode="numeric"
          className="h-8 w-24"
          value={draft ?? String(r.taxRate)}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 3))}
        />
        <span className="text-sm text-muted-foreground">%</span>
        <Button size="sm" disabled={rate === r.taxRate || save.isPending} onClick={() => save.mutate(rate, { onSuccess: () => setDraft(null) })}>
          Save rate
        </Button>
      </div>
      <p className="text-xs tabular-nums text-muted-foreground">
        At {rate}%: {signedRate(sold)} gold from sold output
        {rate > 0 && (
          <>
            {' '}
            for{' '}
            {FIELD_RES.filter((k) => gross[k] > 0)
              .map((k) => `${signedRate(-gross[k] * (rate / 100))} ${FIELD_LABEL[k].toLowerCase()}`)
              .join(', ')}
          </>
        )}
        .
      </p>
    </div>
  );
}
