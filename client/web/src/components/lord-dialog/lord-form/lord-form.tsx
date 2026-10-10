import { useState } from 'react';
import { itemConfig, itemGoldPrice, BuffId } from '@marchlands/core';
import {
  getCitiesByCityIdQueryKey,
  getPlayerQueryKey,
  postPlayerFlagMutation,
  postPlayerGenderMutation,
  postPlayerRenameMutation,
  postPlayerTruceMutation,
  type CityBean,
} from '@marchlands/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Countdown } from '@/components/countdown/countdown';
import { useCommand, usePlayer } from '@/hooks/use-game';
import { useInventory } from '@/hooks/use-inventory';
import { useNow } from '@/hooks/use-now';
import { fmt } from '@/lib/format';
import { GENDERS } from '@/lib/genders';
import { TRUCE } from '@/components/lord-dialog/lord-form/constants';
import { TitleSection } from '@/components/lord-dialog/lord-form/title-section/title-section';

export function LordForm({ city }: { city?: CityBean }) {
  const player = usePlayer();
  const inv = useInventory();
  const info = player.data?.playerInfo;
  const [name, setName] = useState('');
  const [flag, setFlag] = useState('');
  const [gender, setGender] = useState<string | null>(null);
  const refresh = () => [getPlayerQueryKey()];
  const rename = useCommand(postPlayerRenameMutation(), refresh, 'Player renamed');
  const changeGender = useCommand(postPlayerGenderMutation(), refresh, 'Gender changed');
  const changeFlag = useCommand(postPlayerFlagMutation(), refresh, 'Flag changed');
  const truce = useCommand(
    postPlayerTruceMutation(),
    () => [getPlayerQueryKey(), ...(city ? [getCitiesByCityIdQueryKey({ path: { cityId: city.id } })] : [])],
    'Truce in effect',
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
        <DialogDescription>
          {info?.titleName} · flag {info?.flag}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <TitleSection />
        <Separator />
        <div className="grid gap-2">
          <Label htmlFor="lord-name">New name</Label>
          <div className="flex gap-2">
            <Input id="lord-name" value={name} maxLength={20} placeholder={info?.userName} onChange={(e) => setName(e.target.value)} />
            <Button
              disabled={!name.trim() || renameWait || rename.isPending}
              onClick={() => rename.mutate({ body: { userName: name.trim() } }, { onSuccess: () => setName('') })}
            >
              Rename
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {renameWait ? (
              <>
                Renaming is free once a day: next in <Countdown endTime={nextRename} />.
              </>
            ) : (
              'Free, once a day, if nobody else has the name.'
            )}
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="lord-flag">New flag</Label>
          <div className="flex gap-2">
            <Input id="lord-flag" value={flag} maxLength={5} placeholder={info?.flag} onChange={(e) => setFlag(e.target.value)} />
            <Button
              disabled={!flag.trim() || changeFlag.isPending}
              onClick={() => changeFlag.mutate({ body: { flag: flag.trim() } }, { onSuccess: () => setFlag('') })}
            >
              Change
            </Button>
          </div>
        </div>
        <div className="grid gap-2">
          <Label>Gender</Label>
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
              Change
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {genderWait ? (
              <>
                Changing gender is free once a day: next in <Countdown endTime={nextGender} />.
              </>
            ) : (
              'Free, once a day.'
            )}
          </p>
        </div>
        <Separator />
        <div className="grid gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            Truce
            {truceBuff && (
              <Badge variant="secondary">
                active · <Countdown endTime={truceBuff.endTime} />
              </Badge>
            )}
            {!truceBuff && truceCooldown && (
              <Badge variant="outline">
                cooldown · <Countdown endTime={truceCooldown.endTime} />
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Your cities cannot be attacked for 12 hours, and you cannot attack either. A cooldown follows.</p>
          <div className="flex flex-wrap gap-2">
            {(() => {
              const owned = inv.count(TRUCE);
              return (
                <Button
                  size="sm"
                  variant={owned > 0 ? 'default' : 'outline'}
                  disabled={!city || !!truceBuff || !!truceCooldown || truce.isPending || (owned === 0 && city.resource.gold < truceGold)}
                  title={owned > 0 ? undefined : `Bought with ${city?.name ?? 'the city'}'s gold`}
                  onClick={() => truce.mutate({ body: { itemId: TRUCE, cityId: city!.id } })}
                >
                  {itemConfig(TRUCE)?.name} · {owned > 0 ? `×${owned}` : `${fmt(truceGold)} gold`}
                </Button>
              );
            })()}
          </div>
        </div>
      </div>
    </>
  );
}
