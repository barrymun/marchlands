import type { HeroBean } from '@marchlands/api-client';
import { BattleTarget, HeroStatus, Mission } from '@marchlands/core';
import type { SendTarget } from '@/components/send-army-dialog/types';

export function mayorOf(city: { heros: HeroBean[] }): HeroBean | undefined {
  return city.heros.find((h) => h.status === HeroStatus.MAYOR);
}

/** Sending an army to another of the player's own cities: what the server allows there, opening on Transport. */
export function ownCityTarget(city: { fieldId: number; name: string }): SendTarget {
  return {
    tileId: city.fieldId,
    name: city.name,
    missions: [Mission.REINFORCE, Mission.TRANSPORT],
    mission: Mission.TRANSPORT,
    kind: BattleTarget.CITY,
    own: true,
  };
}
