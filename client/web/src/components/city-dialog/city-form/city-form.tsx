import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import {
  type CityBean,
  getCitiesByCityIdQueryKey,
  getMapQueryKey,
  getMapTilesByTileIdQueryKey,
  getPlayerQueryKey,
  patchCitiesByCityIdMutation,
  postCitiesMoveMutation,
} from '@marchlands/api-client';
import { BALANCE, BuffId, itemGoldPrice } from '@marchlands/core';

import { TELEPORT } from '@/components/city-dialog/city-form/constants';
import { TaxRate } from '@/components/city-dialog/city-form/tax-rate/tax-rate';
import { WorkRates } from '@/components/city-dialog/city-form/work-rates/work-rates';
import { Countdown } from '@/components/countdown/countdown';
import { NumberField } from '@/components/number-field/number-field';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useCommand, usePlayer } from '@/hooks/use-game';
import { useInventory } from '@/hooks/use-inventory';
import { useNow } from '@/hooks/use-now';
import { fmt } from '@/lib/format';
import { itemName, zoneName } from '@/lib/game-data';
import { allOf } from '@/lib/query-keys';

export function CityForm({ city, target, onDone }: { city: CityBean; target?: { x: number; y: number }; onDone: () => void }) {
  const { t } = useTranslation(['city-dialog', 'common']);
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
  const rename = useCommand(patchCitiesByCityIdMutation(), refresh, t('cityForm.renamed'));
  const move = useCommand(postCitiesMoveMutation(), refresh, t('cityForm.moved'));
  const size = BALANCE.mapSize;
  const tx = Number(x);
  const ty = Number(y);
  const validXY = x !== '' && y !== '' && Number.isInteger(tx) && Number.isInteger(ty) && tx >= 0 && ty >= 0 && tx < size && ty < size;
  const owned = inv.count(TELEPORT);
  const price = itemGoldPrice(TELEPORT) ?? 0;
  const now = useNow();
  const cooldown = player.data?.buffs.find((b) => b.id === BuffId.TELEPORT_COOLDOWN && b.endTime > now);
  // a held historic city keeps its own name (every one has one; the server refuses a rename)
  const ownName = city.historicLevel ? city.name : null;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{city.name}</DialogTitle>
        <DialogDescription>
          ({city.x},{city.y}) · {zoneName(city.zoneId)}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <WorkRates city={city} />
        <Separator />
        <TaxRate city={city} />
        <Separator />
        {ownName ? (
          <p className="text-sm text-muted-foreground">{t('cityForm.keepsName', { name: ownName })}</p>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor="city-name">{t('common:actions.rename')}</Label>
            <div className="flex gap-2">
              <Input id="city-name" value={name} maxLength={20} placeholder={city.name} onChange={(e) => setName(e.target.value)} />
              <Button
                disabled={!name.trim() || rename.isPending}
                onClick={() => rename.mutate({ path: { cityId: city.id }, body: { name: name.trim() } }, { onSuccess: () => setName('') })}
              >
                {t('common:actions.rename')}
              </Button>
            </div>
          </div>
        )}
        <Separator />
        {city.historicLevel ? (
          <p className="text-sm text-muted-foreground">{t('cityForm.cannotMove', { name: city.name })}</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">{t('cityForm.moveRules')}</p>
            <div className="grid gap-2">
              <Label>
                {owned > 0
                  ? t('cityForm.teleportOwned', { item: itemName(TELEPORT), owned })
                  : t('cityForm.teleportPrice', { item: itemName(TELEPORT), price: fmt(price) })}
              </Label>
              <div className="flex gap-2">
                {/* blank until typed; past the map's edge it shows as invalid with the range, and Teleport waits */}
                <NumberField placeholder="x" range={{ min: 0, max: size - 1 }} blank value={x} onChange={setX} />
                <NumberField placeholder="y" range={{ min: 0, max: size - 1 }} blank value={y} onChange={setY} />
                <Button
                  disabled={!validXY || !!cooldown || move.isPending || (owned === 0 && city.resource.gold < price)}
                  title={owned > 0 ? undefined : t('common:boughtWithCityGold', { city: city.name })}
                  onClick={() => move.mutate({ path: { cityId: city.id }, body: { targetTileId: ty * size + tx } }, { onSuccess: onDone })}
                >
                  {t('cityForm.teleport')}
                </Button>
              </div>
              {cooldown && (
                <p className="text-xs text-muted-foreground">
                  <Trans t={t} i18nKey="cityForm.cooldown" components={{ countdown: <Countdown endTime={cooldown.endTime} /> }} />
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
