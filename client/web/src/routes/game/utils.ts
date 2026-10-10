import type { HeroBean } from '@marchlands/api-client';
import { HeroStatus } from '@marchlands/core';

export function mayorOf(city: { heros: HeroBean[] }): HeroBean | undefined {
  return city.heros.find((h) => h.status === HeroStatus.MAYOR);
}
