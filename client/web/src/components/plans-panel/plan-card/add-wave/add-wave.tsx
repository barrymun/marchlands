import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getCitiesByCityIdOptions, getPlansOptions, type PlanBean } from '@marchlands/api-client';
import { Mission } from '@marchlands/core';

import { nextPosition, plannedFrom } from '@/components/plans-panel/utils';
import { SendArmyDialog } from '@/components/send-army-dialog/send-army-dialog';
import { Button } from '@/components/ui/button';
import { usePlayer } from '@/hooks/use-game';
import { useGameNav } from '@/hooks/use-game-nav';

/**
 * Adds one of the player's armies to the plan, last in its order: the send-army form in plan mode, from the city shown
 * (another can be picked in it), its troops and heroes less what the player's unsent waves already hold.
 */
export function AddWave({ plan, playerId, disabled }: { plan: PlanBean; playerId: number; disabled: boolean }) {
  const { t } = useTranslation('plans-panel');
  const here = useGameNav().cityId;
  const [open, setOpen] = useState(false);
  const [cityId, setCityId] = useState(here);
  // the city shown stays while another loads, so the form doesn't close in between
  const city = useQuery({ ...getCitiesByCityIdOptions({ path: { cityId } }), placeholderData: keepPreviousData });
  const cities = usePlayer().data?.castles ?? [];
  const plans = useQuery(getPlansOptions()).data ?? [plan];
  return (
    <>
      <Button size="sm" variant="outline" disabled={disabled || !city.data} onClick={() => setOpen(true)}>
        {t('addWave')}
      </Button>
      {city.data && (
        <SendArmyDialog
          city={city.data}
          target={open ? { tileId: plan.targetTileId, name: plan.name, missions: [Mission.ATTACK, Mission.SCOUT] } : null}
          slot={{
            planId: plan.id,
            landAt: plan.landAt,
            position: nextPosition(plan),
            planned: plannedFrom(plans, playerId, city.data.id),
            cities: cities.map((c) => ({ id: c.id, name: c.name })),
            onCity: setCityId,
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
