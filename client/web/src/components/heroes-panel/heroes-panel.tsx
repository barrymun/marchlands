import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, GripVertical, Lock, LockOpen, RefreshCw } from 'lucide-react';
import {
  getCitiesByCityIdQueryKey,
  getCitiesTavernOptions,
  getCitiesTavernQueryKey,
  patchHeroesByHeroIdMutation,
  postCitiesTavernHireMutation,
  postCitiesTavernRefreshMutation,
  postHeroesFireMutation,
  postHeroesLevelUp,
  postHeroesMayorMutation,
  putCitiesHeroesOrder,
  putHeroesLockMutation,
  type CityBean,
  type HeroBean,
} from '@marchlands/api-client';
import { toast } from 'sonner';
import { BuildingType, HeroStatus, heroAtMaxLevel, heroManagement, mayorProductionBonus, levelsReady, BASIC_RESOURCES } from '@marchlands/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { HeroPointsDialog } from '@/components/hero-points-dialog/hero-points-dialog';
import { HeroItemsDialog } from '@/components/hero-items-dialog/hero-items-dialog';
import { GearCard } from '@/components/hero-gear/gear-card/gear-card';
import { HeroGearLine } from '@/components/hero-gear/hero-gear-line/hero-gear-line';
import { useCommand } from '@/hooks/use-game';
import { errorMessage } from '@/lib/api';
import { fmt, signedRate, percent } from '@/lib/format';
import { cn } from '@/lib/utils';
import { HeroRow } from '@/components/heroes-panel/hero-row/hero-row';
import { DismissHeroDialog } from '@/components/heroes-panel/dismiss-hero-dialog/dismiss-hero-dialog';
import { STATUS } from '@/components/heroes-panel/constants';

export function HeroesPanel({ city }: { city: CityBean }) {
  const { t } = useTranslation(['heroes-panel', 'common']);
  const navigate = useNavigate();
  const hasInn = city.buildings.some((b) => b.typeId === BuildingType.INN && b.level > 0);
  const cityPath = { path: { cityId: city.id } };
  const tavern = useQuery({ ...getCitiesTavernOptions(cityPath), enabled: hasInn });
  const refresh = () => [getCitiesByCityIdQueryKey(cityPath), getCitiesTavernQueryKey(cityPath)];
  const hire = useCommand(postCitiesTavernHireMutation(), refresh, t('toast.hired'));
  const reroll = useCommand(postCitiesTavernRefreshMutation(), refresh, t('toast.rerolled'));
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
    const ids = city.heros.map((h) => h.id);
    const [id] = ids.splice(from, 1);
    ids.splice(to, 0, id);
    reorder.mutate(ids);
  };
  // a row drags only from its handle (the rest of the row has buttons and the rename field)
  const [armed, setArmed] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const endDrag = () => (setArmed(null), setDragging(null), setOver(null));

  // the mayor's politics adds a percentage of (efficiency-adjusted) field output to every basic resource
  const fieldOutput = BASIC_RESOURCES.reduce((sum, r) => sum + city.resource[r].breakdown.fields, 0);
  // (soft-capped above BALANCE.heroSoftCap.knee when BALANCE.heroSoftCap.production is on)
  const mayorPct = (h: HeroBean) => percent(mayorProductionBonus(heroManagement(h)));
  const mayorGain = (h: HeroBean) => Math.round(fieldOutput * mayorProductionBonus(heroManagement(h)));
  const currentMayor = city.heros.find((h) => h.status === HeroStatus.MAYOR);
  const [pointsFor, setPointsFor] = useState<number | null>(null);
  const [itemsFor, setItemsFor] = useState<number | null>(null);
  const currentGain = currentMayor ? mayorGain(currentMayor) : 0;
  const mayorNote = (h: HeroBean) => {
    if (h.seized) return null;
    if (h.status === HeroStatus.MAYOR) {
      return <span className="text-emerald-600 dark:text-emerald-400">{t('mayor.bonus', { pct: mayorPct(h), rate: signedRate(mayorGain(h)) })}</span>;
    }
    if (h.status !== HeroStatus.IDLE) return null;
    const diff = mayorGain(h) - currentGain;
    return (
      <span>
        {t('mayor.asMayor', { pct: mayorPct(h), rate: signedRate(mayorGain(h)) })}
        {currentMayor && (
          <span className={diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : diff < 0 ? 'text-destructive' : ''}>
            {' '}
            {t('mayor.versus', { diff: signedRate(diff), name: currentMayor.name })}
          </span>
        )}
      </span>
    );
  };

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
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
                note={mayorNote(h)}
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
      <div className="grid content-start gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t('inn.title')}</CardTitle>
            <CardDescription>{hasInn ? (tavern.data ? t('inn.freeSlots', { count: tavern.data.posCount }) : '…') : t('inn.noInn')}</CardDescription>
          </CardHeader>
          {hasInn && (
            <CardContent className="grid gap-2">
              {tavern.data && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={reroll.isPending || city.resource.gold < tavern.data.refreshCost}
                    onClick={() => reroll.mutate(cityPath)}
                  >
                    <RefreshCw /> {t('inn.newOffers', { gold: fmt(tavern.data.refreshCost) })}
                  </Button>
                </div>
              )}
              {tavern.data?.heros.map((h) => (
                <HeroRow key={h.id} hero={h} note={mayorNote(h)}>
                  <span className="text-xs text-muted-foreground tabular-nums">{t('common:gold', { gold: fmt(h.level * 1000) })}</span>
                  <Button size="xs" disabled={hire.isPending} onClick={() => hire.mutate({ path: { cityId: city.id, heroId: h.id } })}>
                    {t('inn.hire')}
                  </Button>
                </HeroRow>
              ))}
            </CardContent>
          )}
        </Card>
        <GearCard onResearch={() => navigate(`/cities/${city.id}/research`)} />
      </div>
      <DismissHeroDialog hero={dismissing} onCancel={() => setDismissing(null)} onConfirm={(h) => fire.mutateAsync({ path: { heroId: h.id } })} />
      <HeroItemsDialog hero={city.heros.find((h) => h.id === itemsFor) ?? null} cityId={city.id} onClose={() => setItemsFor(null)} />
      <HeroPointsDialog
        hero={city.heros.find((h) => h.id === pointsFor) ?? null}
        cityId={city.id}
        fieldOutput={fieldOutput}
        onClose={() => setPointsFor(null)}
      />
    </div>
  );
}
