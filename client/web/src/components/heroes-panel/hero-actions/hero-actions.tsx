import { Lock, LockOpen } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
  type CityBean,
  getCitiesByCityIdQueryKey,
  getCitiesTavernQueryKey,
  type HeroBean,
  postHeroesFireMutation,
  postHeroesLevelUp,
  putHeroesLockMutation,
} from '@marchlands/api-client';
import { heroAtMaxLevel, HeroStatus, levelsReady } from '@marchlands/core';

import { HeroItemsDialog } from '@/components/hero-items-dialog/hero-items-dialog';
import { HeroPointsDialog } from '@/components/hero-points-dialog/hero-points-dialog';
import { canAppoint, statusLabel } from '@/components/hero-summary/utils';
import { DismissHeroDialog } from '@/components/heroes-panel/dismiss-hero-dialog/dismiss-hero-dialog';
import { MakeMayorButton } from '@/components/make-mayor-button/make-mayor-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useCommand } from '@/hooks/use-game';
import { fieldOutput } from '@/lib/mayor';

/**
 * A hero's status and what can be done with it: attribute points and items (dialogs), lock, level up, make mayor and
 * dismiss (a dialog), as each applies. Shared by the hero cards (List) and the character sheet (Sheet).
 */
export function HeroActions({ hero: h, city }: { hero: HeroBean; city: CityBean }) {
  const { t } = useTranslation(['heroes-panel', 'common']);
  const cityPath = { path: { cityId: city.id } };
  const refresh = () => [getCitiesByCityIdQueryKey(cityPath), getCitiesTavernQueryKey(cityPath)];
  // one click takes every level the experience pays for
  const levelUp = useCommand(async (heroId: number) => {
    const before = city.heros.find((x) => x.id === heroId)?.level;
    const { data: up } = await postHeroesLevelUp({ path: { heroId }, throwOnError: true });
    const gained = before != null ? up.level - before : 1;
    toast.success(
      gained > 1 ? t('toast.levelUpMulti', { name: up.name, level: up.level, levels: gained }) : t('toast.levelUp', { name: up.name, level: up.level }),
    );
    return up;
  }, refresh);
  const fire = useCommand(postHeroesFireMutation(), refresh, t('toast.dismissed'));
  const lock = useCommand(putHeroesLockMutation(), () => [getCitiesByCityIdQueryKey(cityPath)]);
  const [dismissing, setDismissing] = useState(false);
  const [points, setPoints] = useState(false);
  const [items, setItems] = useState(false);
  return (
    <>
      <Badge variant={h.status === HeroStatus.MAYOR ? 'default' : 'secondary'}>{statusLabel(h)}</Badge>
      {!h.seized && (h.status === HeroStatus.IDLE || h.status === HeroStatus.MAYOR) && (
        <Button size="xs" variant={h.remainPoint > 0 ? 'default' : 'outline'} onClick={() => setPoints(true)}>
          {h.remainPoint > 0 ? t('heroes.pointsCount', { points: h.remainPoint }) : t('heroes.points')}
        </Button>
      )}
      {!h.seized && (
        <Button size="xs" variant="outline" onClick={() => setItems(true)}>
          {t('heroes.items')}
        </Button>
      )}
      {!h.seized && (
        <div className="flex items-center gap-1.5 px-1">
          <Switch
            id={`lock-${h.id}`}
            checked={h.locked}
            disabled={lock.isPending}
            onCheckedChange={(locked) => lock.mutate({ path: { heroId: h.id }, body: { locked } })}
          />
          <Label htmlFor={`lock-${h.id}`} className="gap-1 text-xs font-normal">
            {h.locked ? <Lock className="size-3" /> : <LockOpen className="size-3" />}
            {h.locked ? t('heroes.locked') : t('heroes.lock')}
          </Label>
        </div>
      )}
      {h.experience >= h.upgradeExp && !heroAtMaxLevel(h) && (
        <Button size="xs" onClick={() => levelUp.mutate(h.id)} disabled={levelUp.isPending}>
          {levelsReady(h) > 1 ? t('heroes.levelUpMulti', { times: levelsReady(h), level: h.level + levelsReady(h) }) : t('heroes.levelUp')}
        </Button>
      )}
      {canAppoint(h) && (
        <>
          <MakeMayorButton hero={h} city={city} />
          <Button size="xs" variant="ghost" disabled={h.locked} title={h.locked ? t('heroes.lockedHint') : undefined} onClick={() => setDismissing(true)}>
            {t('heroes.dismiss')}
          </Button>
        </>
      )}
      <DismissHeroDialog hero={dismissing ? h : null} onCancel={() => setDismissing(false)} onConfirm={(x) => fire.mutateAsync({ path: { heroId: x.id } })} />
      <HeroItemsDialog hero={items ? h : null} cityId={city.id} onClose={() => setItems(false)} />
      <HeroPointsDialog hero={points ? h : null} cityId={city.id} fieldOutput={fieldOutput(city)} onClose={() => setPoints(false)} />
    </>
  );
}
