// Research descriptions: summary and effect per level (core tech-info.ts) (see index.ts).
// Percentages (`pct`, `march`, `battle`, `injured`, `max`, `life`) are numbers the text follows with "%".
export const TECH_INFO_MESSAGES = {
  /** Agriculture, Lumbering, Masonry, Mining: `resource` production per level */
  'summary.resource': ['resource', 'pct'],
  'summary.stockpile': ['pct'],
  /** times multiplied by `factor` per level */
  'summary.construction': ['factor'],
  'summary.militaryScience': ['factor'],
  /** `troops`: the siege units */
  'summary.metalCasting': ['troops', 'factor'],
  /** `count` gear pieces; gear tiers up to `maxTier` at hero level `heroMaxLevel` */
  'summary.heroEnhancement': ['count', 'maxTier', 'heroMaxLevel'],
  'summary.militaryTradition': ['pct'],
  /** `tower`: Archer's Tower */
  'summary.ironWorking': ['tower', 'pct'],
  /** foot troops `from` … `to`; `injured`% per level of the fallen recover, up to `max`% */
  'summary.medicine': ['from', 'to', 'tower', 'pct', 'injured', 'max'],
  /** `troops`: the units whose range grows */
  'summary.archery': ['troops', 'pct'],
  /** marching speed `march`%, battle speed `battle`% per level */
  'summary.compass': ['march', 'battle'],
  'summary.horsebackRiding': ['march', 'battle'],
  'summary.logistics': ['pct'],
  /** the levels that reveal heroes and buildings */
  'summary.informatics': ['heroes', 'buildings'],
  /** a tech with no effect yet */
  'summary.none': [],
  'effect.resource': ['resource', 'pct'],
  'effect.stockpile': ['pct'],
  'effect.construction': ['pct'],
  'effect.militaryScience': ['pct'],
  'effect.metalCasting': ['pct'],
  /** gear `level`, up to `points` hero attribute */
  'effect.heroEnhancement': ['level', 'points'],
  'effect.militaryTradition': ['pct'],
  'effect.ironWorking': ['pct'],
  'effect.medicine': ['life', 'injured'],
  'effect.archery': ['pct'],
  'effect.compass': ['pct'],
  'effect.horsebackRiding': ['pct'],
  'effect.logistics': ['pct'],
  'effect.informaticsHeroes': [],
  'effect.informaticsBuildings': [],
} as const;
