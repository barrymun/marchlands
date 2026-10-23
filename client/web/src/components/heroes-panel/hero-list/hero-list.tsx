import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, GripVertical, Lock, LockOpen } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
  type CityBean,
  getCitiesByCityIdQueryKey,
  getCitiesTavernQueryKey,
  type HeroBean,
  patchHeroesByHeroIdMutation,
  postHeroesFireMutation,
  postHeroesLevelUp,
  postHeroesMayorMutation,
  putCitiesHeroesOrder,
  putHeroesLockMutation,
} from '@marchlands/api-client';
import { heroAtMaxLevel, HeroStatus, levelsReady } from '@marchlands/core';

import { HeroGearLine } from '@/components/hero-gear/hero-gear-line/hero-gear-line';
import { HeroItemsDialog } from '@/components/hero-items-dialog/hero-items-dialog';
import { HeroPointsDialog } from '@/components/hero-points-dialog/hero-points-dialog';
import { STATUS } from '@/components/heroes-panel/constants';
import { DismissHeroDialog } from '@/components/heroes-panel/dismiss-hero-dialog/dismiss-hero-dialog';
import { HeroRow } from '@/components/heroes-panel/hero-row/hero-row';
import { MayorNote } from '@/components/mayor-note/mayor-note';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useCommand } from '@/hooks/use-game';
import { errorMessage } from '@/lib/api';
import { moved } from '@/lib/arrays';
import { fieldOutput } from '@/lib/mayor';
import { cn } from '@/lib/utils';

/**
 * The Heroes tab: the city's heroes in the player's order (drag a row by its handle, or the arrows), each with what it
 * would add as mayor and its actions: attribute points and items (dialogs), lock, level up, make mayor, rename, dismiss.
 */
export function HeroList({ city }: { city: CityBean }) {
  const { t } = useTranslation(['heroes-panel', 'common']);
  const cityPath = { path: { cityId: city.id } };
  const refresh = () => [getCitiesByCityIdQueryKey(cityPath), getCitiesTavernQueryKey(cityPath)];
  const mayor = useCommand(postHeroesMayorMutation(), refresh, t('toast.mayorAppointed'));
  // one click takes every level the experience pays for
  const levelUp = useCommand(async (heroId: number) => {
    const before = city.heros.find((h) => h.id === heroId)?.level;
    const { data: h } = await postHeroesLevelUp({ path: { heroId }, throwOnError: true });
    const gained = before != null ? h.level - before : 1;
    toast.success(
      gained > 1 ? t('toast.levelUpMulti', { name: h.name, level: h.level, levels: gained }) : t('toast.levelUp', { name: h.name, level: h.level }),
    );
    return h;
  }, refresh);
  const rename = useCommand(patchHeroesByHeroIdMutation(), refresh, t('toast.renamed'));
  const fire = useCommand(postHeroesFireMutation(), refresh, t('toast.dismissed'));
  const lock = useCommand(putHeroesLockMutation(), () => [getCitiesByCityIdQueryKey(cityPath)]);
  const [dismissing, setDismissing] = useState<HeroBean | null>(null);
  const [pointsFor, setPointsFor] = useState<number | null>(null);
  const [itemsFor, setItemsFor] = useState<number | null>(null);

  // the lord's order of the hero list: shown at once, saved on the server
  const qc = useQueryClient();
  const reorder = useMutation({
    mutationFn: async (heroIds: number[]) => (await putCitiesHeroesOrder({ ...cityPath, body: { heroIds }, throwOnError: true })).data,
    onMutate: (heroIds) =>
      qc.setQueryData<CityBean>(getCitiesByCityIdQueryKey(cityPath), (c) =>
        c ? { ...c, heros: [...c.heros].sort((a, b) => heroIds.indexOf(a.id) - heroIds.indexOf(b.id)) } : c,
      ),
    onError: (err) => {
      toast.error(errorMessage(err));
      void qc.invalidateQueries({ queryKey: getCitiesByCityIdQueryKey(cityPath) });
    },
  });
  const moveHero = (from: number, to: number) => {
    if (to < 0 || to >= city.heros.length || from === to) return;
    reorder.mutate(moved(city.heros, from, to).map((h) => h.id));
  };
  // a row drags only from its handle (the rest of the row has buttons and the rename field)
  const [armed, setArmed] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const endDrag = () => (setArmed(null), setDragging(null), setOver(null));

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t('heroes.title')}</CardTitle>
          <CardDescription>{t('heroes.description')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {city.heros.length === 0 && <p className="text-sm text-muted-foreground">{t('heroes.empty')}</p>}
          {city.heros.map((h, i) => (
            <div
              key={h.id}
              draggable={armed === h.id}
              onDragStart={(e) => {
                setDragging(i);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                if (dragging == null) return;
                e.preventDefault();
                setOver(i);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragging != null) moveHero(dragging, i);
                endDrag();
              }}
              onDragEnd={endDrag}
              className={cn(
                'rounded-md transition-opacity',
                dragging === i && 'opacity-50',
                over === i && dragging != null && dragging !== i && 'ring-2 ring-primary',
              )}
            >
              <HeroRow
                hero={h}
                leading={
                  city.heros.length > 1 && (
                    <GripVertical
                      className="size-4 shrink-0 cursor-grab text-muted-foreground"
                      aria-hidden
                      onPointerDown={() => setArmed(h.id)}
                      onPointerUp={() => setArmed(null)}
                    />
                  )
                }
                trailing={
                  city.heros.length > 1 && (
                    <>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        aria-label={t('heroes.moveUp', { name: h.name })}
                        disabled={i === 0}
                        onClick={() => moveHero(i, i - 1)}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        aria-label={t('heroes.moveDown', { name: h.name })}
                        disabled={i === city.heros.length - 1}
                        onClick={() => moveHero(i, i + 1)}
                      >
                        <ArrowDown />
                      </Button>
                    </>
                  )
                }
                note={<MayorNote city={city} hero={h} />}
                showExp
                gear={<HeroGearLine hero={h} cityId={city.id} />}
                onRename={h.seized ? undefined : (name) => rename.mutateAsync({ path: { heroId: h.id }, body: { name } }).then(() => undefined)}
              >
                <Badge variant={h.status === HeroStatus.MAYOR ? 'default' : 'secondary'}>
                  {h.seized ? t('status.captive') : (STATUS[h.status] ?? h.status)}
                </Badge>
                {!h.seized && (h.status === HeroStatus.IDLE || h.status === HeroStatus.MAYOR) && (
                  <Button size="xs" variant={h.remainPoint > 0 ? 'default' : 'outline'} onClick={() => setPointsFor(h.id)}>
                    {h.remainPoint > 0 ? t('heroes.pointsCount', { points: h.remainPoint }) : t('heroes.points')}
                  </Button>
                )}
                {!h.seized && (
                  <Button size="xs" variant="outline" onClick={() => setItemsFor(h.id)}>
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
                {h.status === HeroStatus.IDLE && !h.seized && (
                  <>
                    <Button size="xs" variant="outline" onClick={() => mayor.mutate({ path: { heroId: h.id } })}>
                      {t('heroes.makeMayor')}
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      disabled={h.locked}
                      title={h.locked ? t('heroes.lockedHint') : undefined}
                      onClick={() => setDismissing(h)}
                    >
                      {t('heroes.dismiss')}
                    </Button>
                  </>
                )}
              </HeroRow>
            </div>
          ))}
        </CardContent>
      </Card>
      <DismissHeroDialog hero={dismissing} onCancel={() => setDismissing(null)} onConfirm={(h) => fire.mutateAsync({ path: { heroId: h.id } })} />
      <HeroItemsDialog hero={city.heros.find((h) => h.id === itemsFor) ?? null} cityId={city.id} onClose={() => setItemsFor(null)} />
      <HeroPointsDialog
        hero={city.heros.find((h) => h.id === pointsFor) ?? null}
        cityId={city.id}
        fieldOutput={fieldOutput(city)}
        onClose={() => setPointsFor(null)}
      />
    </>
  );
}
