import { HeroBuffId } from '@marchlands/core';

export const BUFF_LABEL: Partial<Record<HeroBuffId, string>> = {
  [HeroBuffId.POWER]: 'Attack',
  [HeroBuffId.MANAGEMENT]: 'Politics',
  [HeroBuffId.STRATAGEM]: 'Intelligence',
};
