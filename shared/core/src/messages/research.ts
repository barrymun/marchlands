// Research (see index.ts).
export const RESEARCH_MESSAGES = {
  /** `tech` is not being researched in this city */
  notResearching: ['tech'],
  noResearch: [],
  chooseResearch: [],
  /** the city already researches `count` (BALANCE.researchQueues) techs */
  queueFull: ['count'],
  /** `tech` is being researched in another city */
  alreadyResearching: ['tech'],
  /** the free speed-up works only in the last `count` minutes */
} as const;
