/** The sections that can show their numbers as a table instead of a chart. */
export const SectionId = { TROOPS: 'troops', RESOURCES: 'resources', SPENDING: 'spending' } as const;
export type SectionId = (typeof SectionId)[keyof typeof SectionId];

/** localStorage key holding the sections the player last left showing their table. */
export const TABLES_KEY = 'marchlands-stats-tables';
