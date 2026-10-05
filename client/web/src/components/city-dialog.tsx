import { useState } from 'react';
import type { CityBean } from '@evony/api-client';
import { BALANCE, itemConfig, STATE_NAMES } from '@evony/core';
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
      <DialogContent className="sm:max-w-md"><CityForm city={city} target={target} onDone={onClose} /></DialogContent>
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
  const rename = useCommand(() => unwrap(api.PATCH('/api/v1/cities/{cityId}', { params: { path: { cityId: city.id } }, body: { name: name.trim() } })), refresh, 'City renamed');
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
        <p className="text-xs text-muted-foreground">Moving needs every army of this city at home and no foreign troops on the way. Occupied valleys are released.</p>
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
            <Button disabled={inv.count(ADV_TELEPORT) === 0 || !validXY || move.isPending} onClick={() => move.mutate({ targetTileId: ty * size + tx }, { onSuccess: onDone })}>
              Teleport
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
