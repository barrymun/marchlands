import { HeroStatus } from '@marchlands/core';

export const STATUS: Record<number, string> = {
  [HeroStatus.IDLE]: 'Idle',
  [HeroStatus.MAYOR]: 'Mayor',
  [HeroStatus.ATTACK]: 'Marching',
  [HeroStatus.SEIZED]: 'Captive',
  [HeroStatus.RETURN]: 'Returning',
};
