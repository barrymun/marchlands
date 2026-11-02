import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import {
  type CityBean,
  getCitiesByCityIdQueryKey,
  getMapQueryKey,
  getMapTilesByTileIdQueryKey,
  getPlayerQueryKey,
  postPlayerFlagMutation,
  postPlayerGenderMutation,
  postPlayerRenameMutation,
  postPlayerTruceMutation,
} from '@marchlands/api-client';
import { BuffId, itemGoldPrice } from '@marchlands/core';

import { Countdown } from '@/components/countdown/countdown';
import { TRUCE } from '@/components/lord-dialog/lord-form/constants';
import { LanguageSelect } from '@/components/lord-dialog/lord-form/language-select/language-select';
import { TitleSection } from '@/components/lord-dialog/lord-form/title-section/title-section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useCommand, usePlayer } from '@/hooks/use-game';
import { useInventory } from '@/hooks/use-inventory';
import { useNow } from '@/hooks/use-now';
import { fmt } from '@/lib/format';
import { itemName, titleName } from '@/lib/game-data';
import { GENDERS } from '@/lib/genders';
import { allOf } from '@/lib/query-keys';

export function LordForm({ city }: { city?: CityBean }) {
  const { t } = useTranslation(['lord-dialog', 'common']);
  const player = usePlayer();
  const inv = useInventory();
  const info = player.data?.playerInfo;
  const [name, setName] = useState('');
  const [flag, setFlag] = useState('');
  const [gender, setGender] = useState<string | null>(null);
  const refresh = () => [getPlayerQueryKey()];
  // the map shows each castle's player name, flag and status, on the map itself and in a tile's card
  const refreshMap = () => [getPlayerQueryKey(), allOf(getMapQueryKey), allOf(getMapTilesByTileIdQueryKey)];
  const rename = useCommand(postPlayerRenameMutation(), refreshMap, t('toast.renamed'));
  const changeGender = useCommand(postPlayerGenderMutation(), refresh, t('toast.genderChanged'));
  const changeFlag = useCommand(postPlayerFlagMutation(), refreshMap, t('toast.flagChanged'));
  const truce = useCommand(
    postPlayerTruceMutation(),
    () => [...refreshMap(), ...(city ? [getCitiesByCityIdQueryKey({ path: { cityId: city.id } })] : [])],
    t('toast.truce'),
  );
  const truceGold = itemGoldPrice(TRUCE) ?? 0;
  const now = useNow();
  const nextRename = player.data?.nextRenameAt ?? 0;
  const renameWait = nextRename > now;
  const nextGender = player.data?.nextGenderChangeAt ?? 0;
  const genderWait = nextGender > now;
  const currentGender = String(info?.sex ?? 0);
  const pickedGender = gender ?? currentGender;
  const truceBuff = player.data?.buffs.find((b) => b.id === BuffId.TRUCE && b.endTime > now);
  const truceCooldown = player.data?.buffs.find((b) => b.id === BuffId.TRUCE_COOLDOWN && b.endTime > now);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{info?.userName}</DialogTitle>
        <DialogDescription>{t('summary', { title: info ? titleName(info.titleId) : '', flag: info?.flag ?? '' })}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <TitleSection city={city} />
        <Separator />
        <div className="grid gap-2">
          <Label htmlFor="lord-name">{t('name.label')}</Label>
          <div className="flex gap-2">
            <Input id="lord-name" value={name} maxLength={20} placeholder={info?.userName} onChange={(e) => setName(e.target.value)} />
            <Button
              disabled={!name.trim() || renameWait || rename.isPending}
              onClick={() => rename.mutate({ body: { userName: name.trim() } }, { onSuccess: () => setName('') })}
            >
              {t('common:actions.rename')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {renameWait ? <Trans t={t} i18nKey="name.wait" components={{ countdown: <Countdown endTime={nextRename} /> }} /> : t('name.free')}
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="lord-flag">{t('flag.label')}</Label>
          <div className="flex gap-2">
            <Input id="lord-flag" value={flag} maxLength={5} placeholder={info?.flag} onChange={(e) => setFlag(e.target.value)} />
            <Button
              disabled={!flag.trim() || changeFlag.isPending}
              onClick={() => changeFlag.mutate({ body: { flag: flag.trim() } }, { onSuccess: () => setFlag('') })}
            >
              {t('change')}
            </Button>
          </div>
        </div>
        <div className="grid gap-2">
          <Label>{t('gender.label')}</Label>
          <div className="flex gap-2">
            <Select value={pickedGender} onValueChange={setGender}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GENDERS.map((g) => (
                  <SelectItem key={g.value} value={String(g.value)}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              disabled={pickedGender === currentGender || genderWait || changeGender.isPending}
              onClick={() => changeGender.mutate({ body: { sex: Number(pickedGender) } }, { onSuccess: () => setGender(null) })}
            >
              {t('change')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {genderWait ? <Trans t={t} i18nKey="gender.wait" components={{ countdown: <Countdown endTime={nextGender} /> }} /> : t('gender.free')}
          </p>
        </div>
        <LanguageSelect />
        <Separator />
        <div className="grid gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            {t('truce.title')}
            {truceBuff && (
              <Badge variant="secondary">
                <Trans t={t} i18nKey="truce.active" components={{ countdown: <Countdown endTime={truceBuff.endTime} /> }} />
              </Badge>
            )}
            {!truceBuff && truceCooldown && (
              <Badge variant="outline">
                <Trans t={t} i18nKey="truce.cooldown" components={{ countdown: <Countdown endTime={truceCooldown.endTime} /> }} />
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{t('truce.description')}</p>
          <div className="flex flex-wrap gap-2">
            {(() => {
              const owned = inv.count(TRUCE);
              return (
                <Button
                  size="sm"
                  variant={owned > 0 ? 'default' : 'outline'}
                  disabled={!city || !!truceBuff || !!truceCooldown || truce.isPending || (owned === 0 && city.resource.gold < truceGold)}
                  title={owned > 0 ? undefined : city ? t('common:boughtWithCityGold', { city: city.name }) : t('truce.boughtWithAny')}
                  onClick={() => city && truce.mutate({ body: { itemId: TRUCE, cityId: city.id } })}
                >
                  {itemName(TRUCE)} · {owned > 0 ? t('truce.owned', { n: owned }) : t('common:gold', { gold: fmt(truceGold) })}
                </Button>
              );
            })()}
          </div>
        </div>
      </div>
    </>
  );
}
