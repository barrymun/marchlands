import { useState } from 'react';
import {
  getCitiesByCityIdQueryKey,
  getMapQueryKey,
  getMapTilesByTileIdQueryKey,
  getPlayerQueryKey,
  patchCitiesByCityIdMutation,
  postCitiesMoveMutation,
  type CityBean,
} from '@marchlands/api-client';
import { BALANCE, itemConfig, itemGoldPrice, BuffId } from '@marchlands/core';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Countdown } from '@/components/countdown/countdown';
import { useCommand, usePlayer } from '@/hooks/use-game';
import { useInventory } from '@/hooks/use-inventory';
import { useNow } from '@/hooks/use-now';
import { allOf } from '@/lib/query-keys';
import { fmt } from '@/lib/format';
import { TELEPORT } from '@/components/city-dialog/city-form/constants';
import { WorkRates } from '@/components/city-dialog/city-form/work-rates/work-rates';
import { TaxRate } from '@/components/city-dialog/city-form/tax-rate/tax-rate';

export function CityForm({ city, target, onDone }: { city: CityBean; target?: { x: number; y: number }; onDone: () => void }) {
  const inv = useInventory();
  const player = usePlayer();
  const [name, setName] = useState('');
  const [x, setX] = useState(target ? String(target.x) : '');
  const [y, setY] = useState(target ? String(target.y) : '');
  const refresh = () => [
    getCitiesByCityIdQueryKey({ path: { cityId: city.id } }),
    getPlayerQueryKey(),
    allOf(getMapQueryKey),
    allOf(getMapTilesByTileIdQueryKey),
  ];
  const rename = useCommand(patchCitiesByCityIdMutation(), refresh, 'City renamed');
  const move = useCommand(postCitiesMoveMutation(), refresh, 'City moved');
  const size = BALANCE.mapSize;
  const tx = Number(x);
  const ty = Number(y);
  const validXY = x !== '' && y !== '' && Number.isInteger(tx) && Number.isInteger(ty) && tx >= 0 && ty >= 0 && tx < size && ty < size;
  const owned = inv.count(TELEPORT);
  const price = itemGoldPrice(TELEPORT) ?? 0;
  const now = useNow();
  const cooldown = player.data?.buffs.find((b) => b.id === BuffId.TELEPORT_COOLDOWN && b.endTime > now);

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
            <Button
              disabled={!name.trim() || rename.isPending}
              onClick={() => rename.mutate({ path: { cityId: city.id }, body: { name: name.trim() } }, { onSuccess: () => setName('') })}
            >
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
              onClick={() => move.mutate({ path: { cityId: city.id }, body: { targetTileId: ty * size + tx } }, { onSuccess: onDone })}
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
