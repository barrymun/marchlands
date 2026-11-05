import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type CityBean,
  getArmiesOptions,
  getCitiesByCityIdQueryKey,
  getCitiesResearchOptions,
  getMarketOrdersMineOptions,
  getMarketShipmentsOptions,
  getPlansOptions,
  getPlayerQueryKey,
  postCitiesAbandonMutation,
} from '@marchlands/api-client';
import { abandonPrestigeBack, BALANCE, BuildingType } from '@marchlands/core';

import type { LossRow } from '@/components/city-dialog/city-form/abandon-city/types';
import { countOf, ofCity } from '@/components/city-dialog/city-form/abandon-city/utils';
import { ConfirmDialog } from '@/components/confirm-dialog/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCommand } from '@/hooks/use-game';
import { useNow } from '@/hooks/use-now';
import { duration, fmtExact } from '@/lib/format';
import { techName } from '@/lib/game-data';
import { LOSS_TEXT } from '@/lib/tones';

/** The last step before abandoning a city: what it would lose, with the real numbers, and its name to type, as this can't be got back. */
export function AbandonConfirm({ city, onClose }: { city: CityBean; onClose: () => void }) {
  const { t } = useTranslation(['city-dialog', 'common']);
  const nameId = useId();
  const now = useNow();
  const [typed, setTyped] = useState('');
  const hasAcademy = city.buildings.some((b) => b.typeId === BuildingType.ACADEMY);
  const armies = useQuery(getArmiesOptions());
  const orders = useQuery(getMarketOrdersMineOptions());
  const shipments = useQuery(getMarketShipmentsOptions());
  const plans = useQuery(getPlansOptions());
  const research = useQuery({ ...getCitiesResearchOptions({ path: { cityId: city.id } }), enabled: hasAcademy });
  const time = duration(BALANCE.abandon.delayMs);
  const start = useCommand(
    postCitiesAbandonMutation(),
    () => [getCitiesByCityIdQueryKey({ path: { cityId: city.id } }), getPlayerQueryKey()],
    t('abandon.started', { city: city.name, time }),
  );
  const loading = armies.isLoading || orders.isLoading || shipments.isLoading || plans.isLoading || research.isLoading;

  const armiesOut = ofCity(armies.data?.self, city.id);
  const waves = ofCity(
    plans.data?.flatMap((p) => p.waves),
    city.id,
  ).filter((w) => w.armyId == null);
  const r = city.resource;
  const counted: [string, string, number][] = [
    ['troops', t('abandon.row.troops'), countOf(city.troop)],
    ['injured', t('abandon.row.injured'), countOf(city.injuredTroop)],
    ['fortifications', t('abandon.row.fortifications'), countOf(city.fortification)],
    ['armies', t('abandon.row.armies'), armiesOut.length],
    ['armyTroops', t('abandon.row.armyTroops'), armiesOut.reduce((sum, a) => sum + countOf(a.troop), 0)],
    ['gold', t('common:resources.gold'), r.gold],
    ['food', t('common:resources.food'), r.food.amount],
    ['wood', t('common:resources.wood'), r.wood.amount],
    ['stone', t('common:resources.stone'), r.stone.amount],
    ['iron', t('common:resources.iron'), r.iron.amount],
    ['valleys', t('abandon.row.valleys'), city.fields.length],
    ['orders', t('abandon.row.orders'), ofCity(orders.data, city.id).length],
    ['shipments', t('abandon.row.shipments'), ofCity(shipments.data, city.id).length],
    ['waves', t('abandon.row.waves'), waves.length],
    ['prestige', t('abandon.row.prestige'), abandonPrestigeBack(city, now + BALANCE.abandon.delayMs)],
  ];
  const named = (key: string, label: string, names: string[]): LossRow[] =>
    names.length ? [{ key, label, value: names.join(t('common:list.separator')) }] : [];
  const rows: LossRow[] = [
    ...named(
      'heroes',
      t('abandon.row.heroes'),
      city.heros.map((h) => h.name),
    ),
    ...named('research', t('abandon.row.research'), (research.data?.researchingIds ?? []).map(techName)),
    ...counted.filter(([, , n]) => n > 0).map(([key, label, n]) => ({ key, label, value: fmtExact(n) })),
  ];

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('abandon.confirmTitle', { city: city.name })}
      description={t('abandon.confirmDescription', { time })}
      confirmLabel={t('abandon.confirm')}
      disabled={loading || typed.trim() !== city.name}
      onConfirm={() => start.mutateAsync({ path: { cityId: city.id } })}
    >
      <div className="grid gap-3 text-sm">
        <dl className="grid max-h-52 grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 overflow-auto text-xs [scrollbar-width:thin]">
          {rows.map((row) => (
            <div key={row.key} className="col-span-2 grid grid-cols-subgrid">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="text-end tabular-nums">{row.value}</dd>
            </div>
          ))}
        </dl>
        <p className={`text-xs ${LOSS_TEXT}`}>{t('abandon.road')}</p>
        <div className="grid gap-1.5">
          <Label htmlFor={nameId}>{t('abandon.typeName', { city: city.name })}</Label>
          <Input id={nameId} autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
        </div>
      </div>
    </ConfirmDialog>
  );
}
